import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { SetSchema } from "@colyseus/schema";
// ...

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
  @type("string") heldWirecutter: string = ""; // "" | "red" | "blue" | "green"
}

export class ButtonState extends Schema {
  @type("string") id: string = "";
  @type("string") color: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") behaviorType: string = "MOMENTARY";
  @type("boolean") isActive: boolean = false;
  @type("number") relocateAt: number = 0;
}

export class PositionState extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

export class RolesLevelState extends Schema {
  @type("number") stage: number = 1;
  @type("number") lights: number = 0;
  @type("boolean") frozen: boolean = false;
  @type({ map: ButtonState }) operatorButtons = new MapSchema<ButtonState>();
  @type({ map: ButtonState }) engineerButtons = new MapSchema<ButtonState>();
  @type("number") confirmationX: number = -1;
  @type("number") confirmationY: number = -1;
  @type("boolean") confirmationVisible: boolean = false;
  @type("number") confirmationExpiresAt: number = 0;
  @type("number") expiryCount: number = 0;
  @type([PositionState]) operatorSlowTiles = new ArraySchema<PositionState>();
  @type([PositionState]) engineerSlowTiles = new ArraySchema<PositionState>();
  @type([PositionState]) monitorSlowTiles = new ArraySchema<PositionState>();
  @type({ map: "number" }) slowedUntilBySession = new MapSchema<number>();
  @type("string") hiddenEngineerColor: string = "";
  @type("number") engineerSwitchX: number = -1;
  @type("number") engineerSwitchY: number = -1;
  @type({ map: "number" }) flipCooldownByColor = new MapSchema<number>();
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

  @type("string") currentLevel: string = "roles";

  @type(RolesLevelState) rolesLevel = new RolesLevelState();

  @type({ set: "string" }) collectedItems = new SetSchema<string>();

  @type("boolean") currentLevelComplete: boolean = false;

  @type("boolean") bombDefused: boolean = false;
  @type("boolean") bombExploded: boolean = false;
  @type({ array: "string" }) cutWires = new ArraySchema<string>();

}
