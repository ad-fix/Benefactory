import { ButtonState } from "../../../schema/GameState";
import { RolesLevel } from "../../RolesLevel";

export abstract class BaseButtonBehavior {
  abstract onStepOn(button: ButtonState, level: RolesLevel): void;
  abstract onStepOff(button: ButtonState, level: RolesLevel): void;

  tick(_button: ButtonState, _now: number, _level: RolesLevel): void {
    // no-op default; override for time-based behaviors
  }
}
