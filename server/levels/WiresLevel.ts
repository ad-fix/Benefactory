import { GameState, WireEndpointState, WireState, PositionState } from "../schema/GameState";
import { BaseLevel } from "./BaseLevel";
import { ArraySchema } from "@colyseus/schema";
import type { Player } from "../schema/GameState";

export class WiresLevel extends BaseLevel {
  onLevelStart(): void {
    console.log("[WiresLevel] Level started.");
    // Endpoint spawning will go here later.
    // For now, this just confirms the level boots correctly.
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