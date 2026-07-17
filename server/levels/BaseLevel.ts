import { GameState, Player } from "../schema/GameState";

export abstract class BaseLevel {
  protected state: GameState;

  constructor(state: GameState) {
    this.state = state;
  }

  abstract onLevelStart(): void;
  abstract canPlayerMoveTo(player: Player, x: number, y: number): boolean;
  abstract onPlayerMove(player: Player, x: number, y: number): void;
  abstract isLevelComplete(): boolean;
  abstract onDispose(): void;
}
