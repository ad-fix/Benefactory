import { GameState, WireEndpointState, WireState, PositionState } from "../schema/GameState";
import { BaseLevel } from "./BaseLevel";
import { ArraySchema } from "@colyseus/schema";
import type { Player } from "../schema/GameState";

export class WiresLevel extends BaseLevel {

//added by KB 7.21 to generate puzzle 
onLevelStart(): void {
  console.log("[WiresLevel] Level started.");
  this.spawnEndpoints();
}

private spawnEndpoints(): void {
  const ws = this.state.wiresLevel;
  const colors = ["RED", "GREEN", "BLUE", "YELLOW", "PURPLE"];
  const gridWidth = this.state.gridWidth;
  const gridHeight = this.state.gridHeight;

  const MAX_GRID = 26;
  const center = Math.floor(MAX_GRID / 2);
  const minX = center - Math.floor(gridWidth / 2);
  const minY = center - Math.floor(gridHeight / 2);
  const maxX = minX + gridWidth - 1;
  const maxY = minY + gridHeight - 1;

  const MAX_LAYOUT_ATTEMPTS = 30;

  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt++) {
    const occupied = new Set<string>();
    const generated: { color: string; path: { x: number; y: number }[] }[] = [];
    let success = true;

    for (const color of colors) {
      const path = this.generateRandomPath(minX, minY, maxX, maxY, occupied);
      if (!path) {
        success = false;
        break;
      }
      for (const p of path) occupied.add(`${p.x},${p.y}`);
      generated.push({ color, path });
    }

    if (success) {
      for (const { color, path } of generated) {
        const start = path[0];
        const end = path[path.length - 1];

        const e1 = new WireEndpointState();
        e1.id = `${color}-0`;
        e1.x = start.x;
        e1.y = start.y;
        e1.color = color;
        ws.endpoints.push(e1);

        const e2 = new WireEndpointState();
        e2.id = `${color}-1`;
        e2.x = end.x;
        e2.y = end.y;
        e2.color = color;
        ws.endpoints.push(e2);
      }
      console.log(`[WiresLevel] Generated guaranteed-solvable layout (attempt ${attempt + 1}): ${ws.endpoints.length} endpoints.`);
      return;
    }
  }

  console.warn("[WiresLevel] Could not generate a solvable layout after max attempts.");
}

private generateRandomPath(minX: number, minY: number, maxX: number, maxY: number, occupied: Set<string>): { x: number; y: number }[] | null {
  const candidates: { x: number; y: number }[] = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (!occupied.has(`${x},${y}`)) candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return null;

  for (let tries = 0; tries < 20; tries++) {
    const start = candidates[Math.floor(Math.random() * candidates.length)];
    const path = [start];
    const visited = new Set<string>([`${start.x},${start.y}`]);
    const targetLength = 3 + Math.floor(Math.random() * 5); // 3 to 7 cells long

    let current = start;
    while (path.length < targetLength) {
      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1},
        { x: current.x, y: current.y - 1 },
      ].filter(n => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
       .filter(n => !occupied.has(`${n.x},${n.y}`) && !visited.has(`${n.x},${n.y}`));

      if (neighbors.length === 0) break;
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      path.push(next);
      visited.add(`${next.x},${next.y}`);
      current = next;
    }

    if (path.length >= 2) return path;
  }

  return null;
}


//added by KB 7.21, this block adds new method that takes proposed wire and accepts or rejects it
submitWire(points: { x: number; y: number }[], color: string): boolean {
  const ws = this.state.wiresLevel;

  if (points.length < 2) return false;

  // Check every step is orthogonal and no cell repeats within this wire
  const visited = new Set<string>();
  visited.add(`${points[0].x},${points[0].y}`);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const dx = Math.abs(cur.x - prev.x);
    const dy = Math.abs(cur.y - prev.y);
    const isOrthogonalStep = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    if (!isOrthogonalStep) return false;

    const key = `${cur.x},${cur.y}`;
    if (visited.has(key)) return false;
    visited.add(key);
  }

  // Check no cell overlaps an already-completed wire
  for (const wire of ws.completedWires) {
    for (const wp of wire.points) {
      if (visited.has(`${wp.x},${wp.y}`)) return false;
    }
  }

  // Check start/end are real endpoints, same color, different endpoint, both unused
  const first = points[0];
  const last = points[points.length - 1];
  const startEndpoint = ws.endpoints.find((e) => e.x === first.x && e.y === first.y);
  const endEndpoint = ws.endpoints.find((e) => e.x === last.x && e.y === last.y);

  if (!startEndpoint || !endEndpoint) return false;
  if (startEndpoint.id === endEndpoint.id) return false;
  if (startEndpoint.color !== color || endEndpoint.color !== color) return false;
  if (ws.usedEndpointIds.includes(startEndpoint.id)) return false;
  if (ws.usedEndpointIds.includes(endEndpoint.id)) return false;

  // Valid — commit it to synced state
  const wire = new WireState();
  wire.color = color;
  for (const p of points) {
    const ps = new PositionState();
    ps.x = p.x;
    ps.y = p.y;
    wire.points.push(ps);
  }
  ws.completedWires.push(wire);
  ws.usedEndpointIds.push(startEndpoint.id);
  ws.usedEndpointIds.push(endEndpoint.id);

  if (this.isLevelComplete()) {
    ws.solved = true;
    console.log("[WiresLevel] LEVEL SOLVED!");
  }

  return true;
}

  // Wires isn't a walk-to-paint level, so movement is unrestricted.
  canPlayerMoveTo(_player: Player, _x: number, _y: number): boolean {
    return true;
  }

  onPlayerMove(_player: Player, _x: number, _y: number): void {
    // No-op: wire logic is driven by the "drawWire" message, not movement.
  }

  isLevelComplete(): boolean {
    const ws = this.state.wiresLevel;
    if (ws.endpoints.length === 0) return false;
    return ws.endpoints.every((e) => ws.usedEndpointIds.includes(e.id));
  }

  onDispose(): void {
    console.log("[WiresLevel] Level disposed.");
  }
}