import { Player } from "../schema/GameState";
import { BaseLevel } from "./BaseLevel";

export class RolesLevel extends BaseLevel {
  onLevelStart(): void {}

  canPlayerMoveTo(player: Player, x: number, y: number): boolean {
    for (const [, other] of this.state.players) {
      if (other !== player && other.x === x && other.y === y) {
        return false;
      }
    }
    return true;
  }

  onPlayerMove(_player: Player, _x: number, _y: number): void {}

  isLevelComplete(): boolean {
    return false;
  }

  onDispose(): void {}
}
