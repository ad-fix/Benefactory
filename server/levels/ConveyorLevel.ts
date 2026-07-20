import { BaseLevel } from "./BaseLevel";
import {
  ConveyorState,
  MachineState,
  Player,
  PlayerRole,
} from "../schema/GameState";

type Direction = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };

const ROLES: PlayerRole[] = ["OPERATOR", "ENGINEER", "MONITOR"];
const ROLE_BY_COLOR: Record<"RED" | "GREEN" | "BLUE", PlayerRole> = {
  RED: "ENGINEER",
  GREEN: "MONITOR",
  BLUE: "OPERATOR",
};
const MACHINES_PER_PHASE = 3;
const TOTAL_MACHINE_COUNT = 9;
const NO_DEADLINE_SECONDS = 10 * 365 * 24 * 60 * 60;

// GameRoom clamps movement to a 26x26 world, so the final standalone phase's
// 28-wide floor is fitted to 26 columns while preserving its 20-row height.
const PHASES = [
  { width: 16, height: 12, beltCount: 28 },
  { width: 22, height: 16, beltCount: 44 },
  { width: 26, height: 20, beltCount: 64 },
] as const;

class SeededRng {
  constructor(private seed: number) {}

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

/**
 * Three-player factory routing puzzle adapted to the BaseLevel contract.
 * GameRoom sends ordinary directional intents; this level turns an intent into
 * a request to run one of the current player's role-owned conveyor belts.
 */
export class ConveyorLevel extends BaseLevel {
  private pendingMoves = new Map<string, { from: Point; to: Point; beltId: string }>();
  private rng = new SeededRng(1);
  private removeDeadlineTimeout: ReturnType<typeof setTimeout> | null = null;

  onLevelStart(): void {
    this.rng = new SeededRng(this.state.seed || 1);
    this.assignRolesByColor();
    this.resetState();
    this.generateFactoryLayout(0);
    this.disableDeadline();
  }

  private assignRolesByColor(): void {
    this.state.players.forEach((player) => {
      player.role = ROLE_BY_COLOR[player.color];
    });
  }

  private disableDeadline(): void {
    if (this.removeDeadlineTimeout) clearTimeout(this.removeDeadlineTimeout);
    // GameRoom installs its countdown immediately after onLevelStart and writes
    // the old 30-minute value when that countdown finishes. Replace it once,
    // after the countdown, so this level has no practical time limit.
    this.removeDeadlineTimeout = setTimeout(() => {
      this.removeDeadlineTimeout = null;
      if (!this.state.conveyorLevel.complete && !this.state.isGameOver) {
        this.state.timeRemaining = NO_DEADLINE_SECONDS;
      }
    }, 4_000);
  }

  private resetState(): void {
    const cs = this.state.conveyorLevel;
    cs.stage = 1;
    cs.conveyors.clear();
    cs.machines.clear();
    cs.processedCount = 0;
    cs.itemState = "RAW_STOCK";
    cs.statusMessage = "Move the raw stock through Machine 1, then continue in numerical order.";
    cs.complete = false;
    this.state.stage = 1;
    this.state.isGameOver = false;
    this.pendingMoves.clear();
  }

  private generateFactoryLayout(phaseIndex: number): void {
    const cs = this.state.conveyorLevel;
    cs.conveyors.clear();
    cs.machines.clear();

    const phase = PHASES[Math.min(phaseIndex, PHASES.length - 1)];
    this.state.gridWidth = phase.width;
    this.state.gridHeight = phase.height;

    let belts: ConveyorState[] = [];
    for (let attempt = 0; attempt < 140; attempt++) {
      const candidate = this.createRandomConveyorNetwork(phase.beltCount);
      if (candidate.length < phase.beltCount - 8 || !this.layoutIsSpreadOut(candidate, phase.beltCount)) continue;
      this.assignRandomOwners(candidate);
      belts = candidate;
      if (this.getInvalidConveyorConnections(candidate).length === 0) break;
    }

    if (belts.length === 0) {
      belts = this.createRandomConveyorNetwork(phase.beltCount);
      this.assignRandomOwners(belts);
    }

    belts.forEach((belt) => cs.conveyors.push(belt));

    const [machinePoint1, machinePoint2, machinePoint3, itemPoint] = this.pickDistinctBeltPoints(belts, 4);
    const firstMachineNumber = phaseIndex * MACHINES_PER_PHASE + 1;
    this.addMachine(firstMachineNumber, machinePoint1);
    this.addMachine(firstMachineNumber + 1, machinePoint2);
    this.addMachine(firstMachineNumber + 2, machinePoint3);

    cs.itemX = itemPoint.x;
    cs.itemY = itemPoint.y;
    this.syncPlayersToItem();
  }

  canPlayerMoveTo(player: Player, x: number, y: number): boolean {
    if (this.state.conveyorLevel.complete || this.state.isGameOver) return false;
    const direction = this.directionFrom(player, x, y);
    if (!direction) return false;

    const move = this.findDestination(player.role as PlayerRole, direction);
    if (!move) return false;

    this.pendingMoves.set(player.sessionId, {
      from: { x: this.state.conveyorLevel.itemX, y: this.state.conveyorLevel.itemY },
      to: move.destination,
      beltId: move.beltId,
    });
    return true;
  }

  onPlayerMove(player: Player, _x: number, _y: number): void {
    const move = this.pendingMoves.get(player.sessionId);
    this.pendingMoves.delete(player.sessionId);
    if (!move) return;

    const cs = this.state.conveyorLevel;
    cs.itemX = move.to.x;
    cs.itemY = move.to.y;
    this.syncPlayersToItem();

    const hitWrongMachine = this.processMachinesOnPath(move.from, move.to);
    if (!cs.complete && !hitWrongMachine) {
      cs.statusMessage = `Part moved by ${this.roleLabel(player.role as PlayerRole)}. Next stop: Machine ${cs.processedCount + 1}.`;
    }
  }

  private findDestination(role: PlayerRole, direction: Direction): { destination: Point; beltId: string } | null {
    const cs = this.state.conveyorLevel;
    const item = { x: cs.itemX, y: cs.itemY };
    const candidates: Array<{ destination: Point; beltId: string }> = [];

    for (const belt of cs.conveyors) {
      if (belt.owner !== role || !this.beltContainsPoint(belt, item.x, item.y)) continue;
      for (const destination of [
        { x: belt.startX, y: belt.startY },
        { x: belt.endX, y: belt.endY },
      ]) {
        if (this.matchesDirection(item, destination, direction)) {
          candidates.push({ destination, beltId: belt.id });
        }
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => this.distanceSquared(item, b.destination) - this.distanceSquared(item, a.destination));
    return candidates[0];
  }

  private processMachinesOnPath(from: Point, to: Point): boolean {
    const cs = this.state.conveyorLevel;
    const machinesOnPath = Array.from(cs.machines)
      .filter((machine) => this.pointOnSegment(machine.x, machine.y, from, to))
      .sort((a, b) => this.distanceSquared(from, a) - this.distanceSquared(from, b));

    for (const machine of machinesOnPath) {
      if (machine.order <= cs.processedCount) continue;
      if (machine.order !== cs.processedCount + 1) {
        cs.statusMessage = `Wrong station. Send the part through Machine ${cs.processedCount + 1} before Machine ${machine.order}.`;
        return true;
      }

      cs.processedCount = machine.order;
      cs.itemState = machine.order >= TOTAL_MACHINE_COUNT ? "WIRE_CUTTER" : `PROCESSED_${machine.order}`;

      if (machine.order >= TOTAL_MACHINE_COUNT) {
        cs.complete = true;
        cs.statusMessage = "Wire cutter complete. Factory run successful.";
        this.state.isGameOver = true;
        return false;
      }

      if (machine.order % MACHINES_PER_PHASE === 0) {
        this.expandFactoryFloor();
        return true;
      }
    }

    return false;
  }

  private expandFactoryFloor(): void {
    const cs = this.state.conveyorLevel;
    const phaseIndex = Math.min(Math.floor(cs.processedCount / MACHINES_PER_PHASE), PHASES.length - 1);
    this.generateFactoryLayout(phaseIndex);
    cs.stage = phaseIndex + 1;
    this.state.stage = phaseIndex + 1;
    cs.statusMessage = `Factory floor expanded. Machine ${cs.processedCount + 1} is online.`;
  }

  private createRandomConveyorNetwork(targetBeltCount: number): ConveyorState[] {
    const belts: ConveyorState[] = [];
    const nodes = new Map<string, Point>();
    const edgeKeys = new Set<string>();
    let beltCount = 0;
    const bounds = this.bounds();

    const addNode = (point: Point) => nodes.set(this.pointKey(point), point);
    const canAddBelt = (start: Point, end: Point): boolean => {
      if (start.x !== end.x && start.y !== end.y) return false;
      const distance = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
      if (distance < 2 || distance > 6) return false;
      const normalized = this.normalizeSegment(start, end);
      if (edgeKeys.has(this.segmentKey(normalized.start, normalized.end))) return false;

      const interiorPoints = this.pointsOnSegment(start, end).slice(1, -1);
      if (interiorPoints.some((point) => Array.from(nodes.values()).some((node) => this.samePoint(node, point)))) return false;

      for (const belt of belts) {
        const startInside = this.beltContainsPoint(belt, start.x, start.y) && !this.beltEndpointMatches(belt, start);
        const endInside = this.beltContainsPoint(belt, end.x, end.y) && !this.beltEndpointMatches(belt, end);
        if (startInside || endInside || interiorPoints.some((point) => this.beltContainsPoint(belt, point.x, point.y))) return false;
      }
      return true;
    };

    const addBelt = (start: Point, end: Point): boolean => {
      if (!canAddBelt(start, end)) return false;
      const normalized = this.normalizeSegment(start, end);
      const belt = new ConveyorState();
      belt.id = `belt-${beltCount++}`;
      belt.startX = normalized.start.x;
      belt.startY = normalized.start.y;
      belt.endX = normalized.end.x;
      belt.endY = normalized.end.y;
      belt.owner = this.randomRole();
      edgeKeys.add(this.segmentKey(normalized.start, normalized.end));
      addNode(normalized.start);
      addNode(normalized.end);
      belts.push(belt);
      return true;
    };

    const addLoop = (anchor: Point, width: number, height: number, horizontalSign: 1 | -1, verticalSign: 1 | -1): boolean => {
      const right = { x: anchor.x + width * horizontalSign, y: anchor.y };
      const corner = { x: right.x, y: anchor.y + height * verticalSign };
      const down = { x: anchor.x, y: corner.y };
      const points = [anchor, right, corner, down];
      if (points.some((point) => !this.insideBounds(point, bounds))) return false;

      const edges: Array<[Point, Point]> = [[anchor, right], [right, corner], [corner, down], [down, anchor]];
      if (edges.some(([start, end]) => !canAddBelt(start, end))) return false;
      edges.forEach(([start, end]) => addBelt(start, end));
      return true;
    };

    for (let attempt = 0; attempt < 40 && belts.length === 0; attempt++) {
      const width = this.rng.int(2, 6);
      const height = this.rng.int(2, 6);
      const anchor = {
        x: this.rng.int(bounds.minX, bounds.maxX - width),
        y: this.rng.int(bounds.minY, bounds.maxY - height),
      };
      addLoop(anchor, width, height, 1, 1);
    }

    for (let attempt = 0; attempt < 400 && belts.length + 4 <= targetBeltCount; attempt++) {
      const anchors = Array.from(nodes.values());
      if (anchors.length === 0) break;
      const anchor = anchors[this.rng.int(0, anchors.length - 1)];
      addLoop(
        anchor,
        this.rng.int(2, 6),
        this.rng.int(2, 6),
        this.rng.next() < 0.5 ? 1 : -1,
        this.rng.next() < 0.5 ? 1 : -1,
      );
    }

    return belts;
  }

  private assignRandomOwners(belts: ConveyorState[]): void {
    const connections = belts.map((belt) => this.getBeltConnections(belt, belts).map((connected) => belts.indexOf(connected)));
    const order = belts.map((_, index) => index).sort((a, b) => connections[b].length - connections[a].length);

    for (let attempt = 0; attempt < 600; attempt++) {
      const owners: Array<PlayerRole | null> = belts.map(() => null);
      const counts: Record<PlayerRole, number> = { OPERATOR: 0, ENGINEER: 0, MONITOR: 0 };
      let failed = false;

      for (const beltIndex of this.shuffle(order)) {
        const owner = this.shuffle(ROLES)
          .sort((a, b) => counts[a] - counts[b])
          .find((role) => this.canUseOwner(beltIndex, role, owners, connections));
        if (!owner) {
          failed = true;
          break;
        }
        owners[beltIndex] = owner;
        counts[owner] += 1;
      }

      if (!failed) {
        owners.forEach((owner, index) => { belts[index].owner = owner ?? this.randomRole(); });
        return;
      }
    }

    belts.forEach((belt, index) => { belt.owner = ROLES[index % ROLES.length]; });
  }

  private canUseOwner(
    beltIndex: number,
    owner: PlayerRole,
    owners: Array<PlayerRole | null>,
    connections: number[][],
  ): boolean {
    const sameOwnerConnections = connections[beltIndex].filter((index) => owners[index] === owner);
    if (sameOwnerConnections.length > 1) return false;
    return sameOwnerConnections.every((connectedIndex) =>
      connections[connectedIndex].filter((index) => index === beltIndex || owners[index] === owner).length <= 1,
    );
  }

  private layoutIsSpreadOut(belts: ConveyorState[], targetBeltCount: number): boolean {
    const uniquePoints = new Map<string, Point>();
    belts.forEach((belt) => this.pointsOnBelt(belt).forEach((point) => uniquePoints.set(this.pointKey(point), point)));
    if (uniquePoints.size < targetBeltCount * 2) return false;
    const values = Array.from(uniquePoints.values());
    const bounds = this.bounds();
    return Math.min(...values.map((point) => point.x)) <= bounds.minX + 2
      && Math.max(...values.map((point) => point.x)) >= bounds.maxX - 2
      && Math.min(...values.map((point) => point.y)) <= bounds.minY + 2
      && Math.max(...values.map((point) => point.y)) >= bounds.maxY - 2;
  }

  private getInvalidConveyorConnections(belts: ConveyorState[]): ConveyorState[] {
    return belts.filter((belt) => {
      const connections = this.getBeltConnections(belt, belts);
      return connections.length < 2 || connections.filter((connected) => connected.owner === belt.owner).length > 1;
    });
  }

  private getBeltConnections(belt: ConveyorState, belts: ConveyorState[]): ConveyorState[] {
    return belts.filter((candidate) => candidate.id !== belt.id && this.beltsConnect(belt, candidate));
  }

  private beltsConnect(a: ConveyorState, b: ConveyorState): boolean {
    return this.beltContainsPoint(b, a.startX, a.startY)
      || this.beltContainsPoint(b, a.endX, a.endY)
      || this.beltContainsPoint(a, b.startX, b.startY)
      || this.beltContainsPoint(a, b.endX, b.endY);
  }

  private pickDistinctBeltPoints(belts: ConveyorState[], count: number): Point[] {
    const pointMap = new Map<string, Point>();
    belts.forEach((belt) => this.pointsOnBelt(belt).forEach((point) => pointMap.set(this.pointKey(point), point)));
    const points = this.shuffle(Array.from(pointMap.values()));
    const bounds = this.bounds();
    while (points.length < count) {
      points.push({ x: this.rng.int(bounds.minX, bounds.maxX), y: this.rng.int(bounds.minY, bounds.maxY) });
    }
    return points.slice(0, count);
  }

  private addMachine(order: number, point: Point): void {
    const machine = new MachineState();
    machine.id = `machine-${order}`;
    machine.machineType = "FACTORY_MACHINE";
    machine.order = order;
    machine.x = point.x;
    machine.y = point.y;
    this.state.conveyorLevel.machines.push(machine);
  }

  private syncPlayersToItem(): void {
    const { itemX, itemY } = this.state.conveyorLevel;
    this.state.players.forEach((player) => {
      player.x = itemX;
      player.y = itemY;
    });
  }

  private directionFrom(player: Player, x: number, y: number): Direction | null {
    if (x < player.x) return "left";
    if (x > player.x) return "right";
    if (y < player.y) return "up";
    if (y > player.y) return "down";
    return null;
  }

  private matchesDirection(from: Point, to: Point, direction: Direction): boolean {
    if (direction === "left") return to.x < from.x && to.y === from.y;
    if (direction === "right") return to.x > from.x && to.y === from.y;
    if (direction === "up") return to.y < from.y && to.x === from.x;
    return to.y > from.y && to.x === from.x;
  }

  private beltContainsPoint(belt: ConveyorState, x: number, y: number): boolean {
    if (belt.startY === belt.endY) {
      return y === belt.startY && x >= Math.min(belt.startX, belt.endX) && x <= Math.max(belt.startX, belt.endX);
    }
    return x === belt.startX && y >= Math.min(belt.startY, belt.endY) && y <= Math.max(belt.startY, belt.endY);
  }

  private beltEndpointMatches(belt: ConveyorState, point: Point): boolean {
    return (belt.startX === point.x && belt.startY === point.y)
      || (belt.endX === point.x && belt.endY === point.y);
  }

  private pointsOnBelt(belt: ConveyorState): Point[] {
    return this.pointsOnSegment(
      { x: belt.startX, y: belt.startY },
      { x: belt.endX, y: belt.endY },
    );
  }

  private pointsOnSegment(from: Point, to: Point): Point[] {
    const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    return Array.from({ length: length + 1 }, (_, index) => ({
      x: from.x + dx * index,
      y: from.y + dy * index,
    }));
  }

  private pointOnSegment(x: number, y: number, from: Point, to: Point): boolean {
    if (from.x === to.x) return x === from.x && y >= Math.min(from.y, to.y) && y <= Math.max(from.y, to.y);
    return y === from.y && x >= Math.min(from.x, to.x) && x <= Math.max(from.x, to.x);
  }

  private normalizeSegment(start: Point, end: Point): { start: Point; end: Point } {
    return start.x < end.x || start.y < end.y ? { start, end } : { start: end, end: start };
  }

  private bounds() {
    const center = Math.floor(26 / 2);
    const minX = center - Math.floor(this.state.gridWidth / 2);
    const minY = center - Math.floor(this.state.gridHeight / 2);
    return {
      minX,
      minY,
      maxX: minX + this.state.gridWidth - 1,
      maxY: minY + this.state.gridHeight - 1,
    };
  }

  private insideBounds(point: Point, bounds: ReturnType<ConveyorLevel["bounds"]>): boolean {
    return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
  }

  private shuffle<T>(items: readonly T[]): T[] {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapIndex = this.rng.int(0, index);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  private randomRole(): PlayerRole {
    return ROLES[this.rng.int(0, ROLES.length - 1)];
  }

  private distanceSquared(from: Point, to: Point): number {
    return (from.x - to.x) ** 2 + (from.y - to.y) ** 2;
  }

  private pointKey(point: Point): string {
    return `${point.x},${point.y}`;
  }

  private segmentKey(start: Point, end: Point): string {
    return `${start.x},${start.y}-${end.x},${end.y}`;
  }

  private samePoint(a: Point, b: Point): boolean {
    return a.x === b.x && a.y === b.y;
  }

  private roleLabel(role: PlayerRole): string {
    if (role === "OPERATOR") return "Operator";
    if (role === "ENGINEER") return "Engineer";
    return "Monitor";
  }

  isLevelComplete(): boolean {
    return this.state.conveyorLevel.complete;
  }

  onDispose(): void {
    this.pendingMoves.clear();
    if (this.removeDeadlineTimeout) {
      clearTimeout(this.removeDeadlineTimeout);
      this.removeDeadlineTimeout = null;
    }
  }
}
