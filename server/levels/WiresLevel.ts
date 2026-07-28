import { GameState, WireEndpointState, WireState, PositionState, ActiveDragState } from "../schema/GameState";
import { BaseLevel } from "./BaseLevel";
import { ArraySchema } from "@colyseus/schema";
import type { Player } from "../schema/GameState";


export class WiresLevel extends BaseLevel {
  private onLevelWon?: () => void;

  constructor(state: GameState, onLevelWon?: () => void) {
    super(state);
    this.onLevelWon = onLevelWon;
  }

//added by KB 7.21 to generate puzzle 
onLevelStart(): void {
  console.log("[WiresLevel] Level started.");
  this.spawnEndpoints();
}

//updated by KB 7.22 
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

  const fullPath = this.buildFullGridPath(minX, minY, maxX, maxY);
  const segments = this.splitPathIntoSegments(fullPath, colors.length);

  for (let i = 0; i < colors.length; i++) {
    const color = colors[i];
    const seg = segments[i];
    const start = seg[0];
    const end = seg[seg.length - 1];

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

  console.log(`[WiresLevel] Generated full-board layout: ${ws.endpoints.length} endpoints, ${fullPath.length} cells covered.`);
}

//added by KB 7.22 for more Flow Free esque gameplay
private buildFullGridPath(minX: number, minY: number, maxX: number, maxY: number): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [];

  const flipX = Math.random() < 0.5;
  const flipY = Math.random() < 0.5;
  const sweepByRow = Math.random() < 0.5;

  const xs: number[] = [];
  for (let x = minX; x <= maxX; x++) xs.push(x);
  const ys: number[] = [];
  for (let y = minY; y <= maxY; y++) ys.push(y);

  if (flipX) xs.reverse();
  if (flipY) ys.reverse();

  if (sweepByRow) {
    ys.forEach((y, rowIndex) => {
      const rowXs = rowIndex % 2 === 0 ? xs : [...xs].reverse();
      for (const x of rowXs) path.push({ x, y });
    });
  } else {
    xs.forEach((x, colIndex) => {
      const colYs = colIndex % 2 === 0 ? ys : [...ys].reverse();
      for (const y of colYs) path.push({ x, y });
    });
  }

  return path;
}

private splitPathIntoSegments(path: { x: number; y: number }[], numSegments: number): { x: number; y: number }[][] {
  const total = path.length;
  const minSegLen = 2;
  const lengths: number[] = [];
  let remaining = total;

  for (let i = 0; i < numSegments - 1; i++) {
    const remainingSegments = numSegments - i;
    const maxLen = remaining - minSegLen * (remainingSegments - 1);
    const len = minSegLen + Math.floor(Math.random() * Math.max(1, maxLen - minSegLen + 1));
    lengths.push(len);
    remaining -= len;
  }
  lengths.push(remaining);

  const segments: { x: number; y: number }[][] = [];
  let idx = 0;
  for (const len of lengths) {
    segments.push(path.slice(idx, idx + len));
    idx += len;
  }
  return segments;
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
    this.onLevelWon?.();
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

  const allConnected = ws.endpoints.every((e) => ws.usedEndpointIds.includes(e.id));
  if (!allConnected) return false;

  let filledCells = 0;
  ws.completedWires.forEach((w) => { filledCells += w.points.length; });
  const totalCells = this.state.gridWidth * this.state.gridHeight;

  return filledCells >= totalCells;
}

  onDispose(): void {
    console.log("[WiresLevel] Level disposed.");
  }

//added by KB 7.22 for redoing last move
undoLastWire(): void {
  const ws = this.state.wiresLevel;
  if (ws.completedWires.length === 0) return;

  const removedWire = ws.completedWires.pop();
  if (!removedWire) return;

  // Free up that color's endpoints so they can be reconnected
  const relevantEndpoints = ws.endpoints.filter((e) => e.color === removedWire.color);
  for (const e of relevantEndpoints) {
    const idx = ws.usedEndpointIds.indexOf(e.id);
    if (idx !== -1) ws.usedEndpointIds.splice(idx, 1);
  }

  ws.solved = false;
  console.log(`[WiresLevel] Undid last wire (${removedWire.color}).`);
}

//added by KB 7.22 for resetting level
resetLevel(): void {
  const ws = this.state.wiresLevel;

  while (ws.endpoints.length > 0) ws.endpoints.pop();
  while (ws.completedWires.length > 0) ws.completedWires.pop();
  while (ws.usedEndpointIds.length > 0) ws.usedEndpointIds.pop();
  ws.solved = false;

  this.spawnEndpoints();
  console.log("[WiresLevel] Level reset — new layout generated.");
}

updateActiveDrag(sessionId: string, color: string, points: { x: number; y: number }[]): void {
  const ws = this.state.wiresLevel;
  let drag = ws.activeDrags.get(sessionId);
  if (!drag) {
    drag = new ActiveDragState();
    drag.sessionId = sessionId;
    ws.activeDrags.set(sessionId, drag);
  }
  drag.color = color;
  while (drag.points.length > 0) drag.points.pop();
  for (const p of points) {
    const ps = new PositionState();
    ps.x = p.x;
    ps.y = p.y;
    drag.points.push(ps);
  }
}

clearActiveDrag(sessionId: string): void {
  this.state.wiresLevel.activeDrags.delete(sessionId);
}

}