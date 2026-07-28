import { BaseLevel } from "./BaseLevel";
import { Player } from "../schema/GameState";

// Generator occupies the middle 2x2 tiles of the 10x8 room (room-local,
// 0-indexed) — matches the Blender mesh's generator footprint.
const BLOCKED_TILES = [
  { x: 4, y: 3 }, { x: 5, y: 3 },
  { x: 4, y: 4 }, { x: 5, y: 4 },
];

const LEVEL1_WIDTH = 10;
const LEVEL1_HEIGHT = 8;

export class Level1 extends BaseLevel {
  onLevelStart(): void {
    this.state.gridWidth = LEVEL1_WIDTH;
    this.state.gridHeight = LEVEL1_HEIGHT;
    this.state.currentLevel = "level1";
    this.state.stage = 1;
  }

  canPlayerMoveTo(player: Player, x: number, y: number): boolean {
    const MAX_GRID = 26;
    const center = Math.floor(MAX_GRID / 2);
    const halfWidth = Math.floor(this.state.gridWidth / 2);
    const halfHeight = Math.floor(this.state.gridHeight / 2);
    const minX = center - halfWidth;
    const minY = center - halfHeight;

    const localX = x - minX;
    const localY = y - minY;

    return !BLOCKED_TILES.some(t => t.x === localX && t.y === localY);
  }

  onPlayerMove(_player: Player, _x: number, _y: number): void {
    // hook puzzle/interactable triggers here later
  }

  isLevelComplete(): boolean {
  return this.state.wiresLevel.solved;
  }

  onDispose(): void {
    // nothing to clean up yet
  }
}