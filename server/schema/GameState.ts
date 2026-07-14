import { Schema, type, MapSchema } from "@colyseus/schema";

export type PlayerColor = "RED" | "GREEN" | "BLUE";
export type PlayerRole = "OPERATOR" | "ENGINEER" | "MONITOR";

export class Player extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") color: PlayerColor = "RED";
  @type("string") role: string = "";
  @type("string") sessionId: string = "";
  @type("string") name: string = "";
  @type("string") school: string = "";
  @type("string") discordName: string = "";
}

export class GameState extends Schema {
  @type("number") gridWidth: number = 10;
  @type("number") gridHeight: number = 8;

  @type({ map: Player }) players = new MapSchema<Player>();

  @type("boolean") gameStarted: boolean = false;

  @type("number") countdown: number = 0;

  @type("boolean") isGameOver: boolean = false;

  @type("number") timeRemaining: number = 30 * 60; // 30 minutes in seconds

  @type("number") stage: number = 1;

  @type("number") seed: number = 0;
}
