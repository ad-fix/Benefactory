import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { SetSchema } from "@colyseus/schema";

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
  @type("string") blueCutterFor: string = "";
  @type("string") redCutterFor: string = "";
}

//this block added by KB 7.20.26
export class WireEndpointState extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") color: string = "";
  @type("string") id: string = "";
}

export class WireState extends Schema {
  @type("string") color: string = "";
  @type([PositionState]) points = new ArraySchema<PositionState>();
}

//added by KB 7.22 for multiplayer visual drag per player 
export class ActiveDragState extends Schema {
  @type("string") sessionId: string = "";
  @type("string") color: string = "";
  @type([PositionState]) points = new ArraySchema<PositionState>();
}

export class WiresLevelState extends Schema {
  @type([WireEndpointState]) endpoints = new ArraySchema<WireEndpointState>();
  @type([WireState]) completedWires = new ArraySchema<WireState>();
  @type(["string"]) usedEndpointIds = new ArraySchema<string>();
  @type("boolean") solved: boolean = false;
  @type({ map: ActiveDragState }) activeDrags = new MapSchema<ActiveDragState>();
}

export class ConveyorState extends Schema {
  @type("string") id: string = "";
  @type("number") startX: number = 0;
  @type("number") startY: number = 0;
  @type("number") endX: number = 0;
  @type("number") endY: number = 0;
  @type("string") owner: string = "";
}

export class MachineState extends Schema {
  @type("string") id: string = "";
  @type("string") machineType: string = "";
  @type("number") order: number = 0;
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

export class ConveyorLevelState extends Schema {
  @type("number") stage: number = 1;
  @type([ConveyorState]) conveyors = new ArraySchema<ConveyorState>();
  @type([MachineState]) machines = new ArraySchema<MachineState>();
  @type("number") itemX: number = 0;
  @type("number") itemY: number = 0;
  @type("number") processedCount: number = 0;
  @type("string") itemState: string = "RAW_PART";
  @type("string") statusMessage: string = "Waiting for factory layout...";
  @type("boolean") complete: boolean = false;
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

  @type("string") currentLevel: string = "level1";

  @type(RolesLevelState) rolesLevel = new RolesLevelState();

@type(WiresLevelState) wiresLevel = new WiresLevelState(); //added by KB 7.20.26

@type(ConveyorLevelState)
conveyorLevel = new ConveyorLevelState();

@type({ set: "string" }) collectedItems = new SetSchema<string>();

@type("boolean") currentLevelComplete: boolean = false;

@type("boolean") bombDefused: boolean = false;
@type("boolean") bombExploded: boolean = false;
@type({ array: "string" }) cutWires = new ArraySchema<string>();
}
