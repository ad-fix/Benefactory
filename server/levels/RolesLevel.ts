import { ArraySchema } from "@colyseus/schema";
import { ButtonState, Player, PositionState } from "../schema/GameState";
import { BaseLevel } from "./BaseLevel";
import { BehaviorFactory } from "./roles/behaviors/BehaviorFactory";

const SLOW_TILE_COUNT = 10;
const SLOW_DURATION_MS = 3000;
const SLOWED_MOVE_INTERVAL_MS = 500;

export class RolesLevel extends BaseLevel {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private prevPositions = new Map<string, { x: number; y: number }>();
  private engLastButton = new Map<string, string | null>();
  private lastMoveAt = new Map<string, number>();

  onLevelStart(): void {
    this.setupStage(1);
    const tick = setInterval(() => this.tickConfirmation(), 250);
    this.timers.push(tick as unknown as ReturnType<typeof setTimeout>);
  }

  private setupStage(n: number): void {
    const rs = this.state.rolesLevel;
    rs.stage = n;
    rs.operatorButtons.clear();
    rs.engineerButtons.clear();
    rs.confirmationVisible = false;
    rs.confirmationX = -1;
    rs.confirmationY = -1;
    rs.confirmationExpiresAt = 0;
    rs.operatorSlowTiles.clear();
    rs.engineerSlowTiles.clear();
    rs.monitorSlowTiles.clear();
    rs.slowedUntilBySession.clear();
    this.lastMoveAt.clear();

    if (n === 2) {
      for (const color of this.pickDistinctColors(2)) {
        const opPos = this.randomFreePosition();
        const opBtn = new ButtonState();
        opBtn.id = `op-${n}-${color}`;
        opBtn.color = color;
        opBtn.x = opPos.x;
        opBtn.y = opPos.y;
        opBtn.behaviorType = "MOMENTARY";
        rs.operatorButtons.set(opBtn.id, opBtn);

        const engPos = this.randomFreePosition();
        const engBtn = new ButtonState();
        engBtn.id = `eng-${n}-${color}`;
        engBtn.color = color;
        engBtn.x = engPos.x;
        engBtn.y = engPos.y;
        engBtn.behaviorType = "MOMENTARY";
        rs.engineerButtons.set(engBtn.id, engBtn);

        console.log(`[RolesLevel] Stage ${n}: OPERATOR (${color}) at (${opPos.x}, ${opPos.y}), ENGINEER (${color}) at (${engPos.x}, ${engPos.y})`);
      }
    } else if (n <= 4) {
      const color = "BLUE";

      const opPos = this.randomFreePosition();
      const opBtn = new ButtonState();
      opBtn.id = `op-${n}`;
      opBtn.color = color;
      opBtn.x = opPos.x;
      opBtn.y = opPos.y;
      opBtn.behaviorType = "MOMENTARY";
      rs.operatorButtons.set(opBtn.id, opBtn);
      console.log(`[RolesLevel] Stage ${n}: OPERATOR button at (${opPos.x}, ${opPos.y})`);

      const engPos = this.randomFreePosition();
      const engBtn = new ButtonState();
      engBtn.id = `eng-${n}`;
      engBtn.color = color;
      engBtn.x = engPos.x;
      engBtn.y = engPos.y;
      engBtn.behaviorType = "MOMENTARY";
      rs.engineerButtons.set(engBtn.id, engBtn);
      console.log(`[RolesLevel] Stage ${n}: ENGINEER button at (${engPos.x}, ${engPos.y})`);
    }

    if (n >= 3) {
      this.setupSlowTiles();
    }
  }

  private setupSlowTiles(): void {
    const rs = this.state.rolesLevel;

    const occupied = new Set<string>();
    this.state.players.forEach((p) => occupied.add(`${p.x},${p.y}`));
    rs.operatorButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));
    rs.engineerButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));

    const roleTileLists: ArraySchema<PositionState>[] = [
      rs.operatorSlowTiles,
      rs.engineerSlowTiles,
      rs.monitorSlowTiles,
    ];

    for (const tiles of roleTileLists) {
      for (let i = 0; i < SLOW_TILE_COUNT; i++) {
        const pos = this.pickFreePosition(occupied);
        const tile = new PositionState();
        tile.x = pos.x;
        tile.y = pos.y;
        tiles.push(tile);
        occupied.add(`${pos.x},${pos.y}`);
      }
    }

    console.log(`[RolesLevel] Stage ${rs.stage}: generated ${SLOW_TILE_COUNT} slow tiles per role`);
  }

  private slowTilesForRole(role: string): ArraySchema<PositionState> | null {
    const rs = this.state.rolesLevel;
    switch (role) {
      case "OPERATOR": return rs.operatorSlowTiles;
      case "ENGINEER": return rs.engineerSlowTiles;
      case "MONITOR": return rs.monitorSlowTiles;
      default: return null;
    }
  }

  private tickConfirmation(): void {
    const rs = this.state.rolesLevel;
    if (rs.confirmationVisible && Date.now() >= rs.confirmationExpiresAt) {
      rs.confirmationVisible = false;
      rs.confirmationX = -1;
      rs.confirmationY = -1;
      rs.operatorButtons.forEach((btn) => { btn.isActive = false; });
      rs.expiryCount++;
      console.log(`[RolesLevel] CONFIRMATION EXPIRED (expiry #${rs.expiryCount})`);
      this.relocateAllButtons();
    }
  }

  private relocateAllButtons(): void {
    const rs = this.state.rolesLevel;

    // Seed occupied with players and ALL current button positions (old positions stay excluded throughout).
    const occupied = new Set<string>();
    this.state.players.forEach((p) => occupied.add(`${p.x},${p.y}`));
    rs.operatorButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));
    rs.engineerButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));

    rs.operatorButtons.forEach((btn) => {
      const pos = this.pickFreePosition(occupied);
      console.log(`[RolesLevel] Relocated OPERATOR ${btn.id}: (${btn.x},${btn.y}) → (${pos.x},${pos.y})`);
      btn.x = pos.x;
      btn.y = pos.y;
      occupied.add(`${pos.x},${pos.y}`);
    });

    rs.engineerButtons.forEach((btn) => {
      const pos = this.pickFreePosition(occupied);
      console.log(`[RolesLevel] Relocated ENGINEER ${btn.id}: (${btn.x},${btn.y}) → (${pos.x},${pos.y})`);
      btn.x = pos.x;
      btn.y = pos.y;
      occupied.add(`${pos.x},${pos.y}`);
    });
  }

  private timerForStage(stage: number): number {
    return ([12000, 10000, 8000, 6000] as const)[stage - 1] ?? 6000;
  }

  private randomFreePosition(): { x: number; y: number } {
    const occupied = new Set<string>();
    this.state.players.forEach((p) => occupied.add(`${p.x},${p.y}`));
    this.state.rolesLevel.operatorButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));
    this.state.rolesLevel.engineerButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));
    return this.pickFreePosition(occupied);
  }

  private pickDistinctColors(count: number): string[] {
    const pool = ["RED", "GREEN", "BLUE"];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  private pickFreePosition(occupied: Set<string>): { x: number; y: number } {
    const MAX_GRID = 26;
    const center = Math.floor(MAX_GRID / 2);
    const halfW = Math.floor(this.state.gridWidth / 2);
    const halfH = Math.floor(this.state.gridHeight / 2);
    const minX = center - halfW;
    const maxX = center + halfW - 1;
    const minY = center - halfH;
    const maxY = center + halfH - 1;

    for (let i = 0; i < 200; i++) {
      const x = minX + Math.floor(Math.random() * (maxX - minX + 1));
      const y = minY + Math.floor(Math.random() * (maxY - minY + 1));
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
    return { x: center, y: center };
  }

  canPlayerMoveTo(player: Player, _x: number, _y: number): boolean {
    const rs = this.state.rolesLevel;
    const slowedUntil = rs.slowedUntilBySession.get(player.sessionId) ?? 0;
    if (slowedUntil > Date.now()) {
      const last = this.lastMoveAt.get(player.sessionId) ?? 0;
      if (Date.now() - last < SLOWED_MOVE_INTERVAL_MS) return false;
    }
    return true;
  }

  onPlayerMove(player: Player, x: number, y: number): void {
    this.lastMoveAt.set(player.sessionId, Date.now());

    const prev = this.prevPositions.get(player.sessionId);
    this.prevPositions.set(player.sessionId, { x, y });

    const rs = this.state.rolesLevel;

    const slowTiles = this.slowTilesForRole(player.role);
    if (slowTiles?.some((t) => t.x === x && t.y === y)) {
      rs.slowedUntilBySession.set(player.sessionId, Date.now() + SLOW_DURATION_MS);
      console.log(`[RolesLevel] ${player.role} ${player.sessionId} hit a slow tile at (${x}, ${y})`);
    }

    if (player.role === "OPERATOR") {
      rs.operatorButtons.forEach((btn) => {
        const behavior = BehaviorFactory.getBehavior(btn.behaviorType);
        if (btn.x === x && btn.y === y) {
          behavior.onStepOn(btn, this);
          console.log(`[RolesLevel] OPERATOR stepped on button ${btn.id} at (${x}, ${y}) — isActive: ${btn.isActive}`);
        } else if (prev && btn.x === prev.x && btn.y === prev.y) {
          behavior.onStepOff(btn, this);
          console.log(`[RolesLevel] OPERATOR stepped off button ${btn.id} at (${prev.x}, ${prev.y}) — isActive: ${btn.isActive}`);
        }
      });

      if (this.allButtonsActive() && !rs.confirmationVisible) {
        const pos = this.randomFreePosition();
        rs.confirmationX = pos.x;
        rs.confirmationY = pos.y;
        rs.confirmationExpiresAt = Date.now() + this.timerForStage(rs.stage);
        rs.confirmationVisible = true;
        console.log(`[RolesLevel] STAGE INPUT SATISFIED — confirmation tile at (${pos.x}, ${pos.y}), expires in ${this.timerForStage(rs.stage)}ms`);
      }
    }

    if (player.role === "ENGINEER") {
      const lastBtnId = this.engLastButton.get(player.sessionId) ?? null;
      let currentBtnId: string | null = null;

      rs.engineerButtons.forEach((btn) => {
        if (btn.x === x && btn.y === y) {
          currentBtnId = btn.id;
          if (lastBtnId !== btn.id) {
            rs.operatorButtons.forEach((opBtn) => {
              if (opBtn.color === btn.color) {
                const next = opBtn.behaviorType === "MOMENTARY" ? "TOGGLE" : "MOMENTARY";
                console.log(`[RolesLevel] ENGINEER flipped ${opBtn.id}: ${opBtn.behaviorType} → ${next}`);
                opBtn.behaviorType = next;
                opBtn.isActive = false;
              }
            });
          }
        }
      });

      this.engLastButton.set(player.sessionId, currentBtnId);
    }

    if (player.role === "MONITOR" && rs.confirmationVisible && x === rs.confirmationX && y === rs.confirmationY) {
      this.lockCheckpoint();
    }
  }

  private lockCheckpoint(): void {
    const rs = this.state.rolesLevel;
    rs.confirmationVisible = false;
    rs.confirmationX = -1;
    rs.confirmationY = -1;
    rs.lights++;
    console.log(`[RolesLevel] CHECKPOINT LOCKED — lights: ${rs.lights}`);
    if (rs.stage < 4) {
      this.setupStage(rs.stage + 1);
    } else {
      console.log("[RolesLevel] LEVEL COMPLETE");
    }
  }

  private allButtonsActive(): boolean {
    const rs = this.state.rolesLevel;
    if (rs.operatorButtons.size === 0) return false;
    for (const [, btn] of rs.operatorButtons) {
      if (!btn.isActive) return false;
    }
    return true;
  }

  isLevelComplete(): boolean {
    return false;
  }

  onDispose(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}
