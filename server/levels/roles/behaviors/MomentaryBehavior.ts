import { ButtonState } from "../../../schema/GameState";
import { RolesLevel } from "../../RolesLevel";
import { BaseButtonBehavior } from "./BaseButtonBehavior";

export class MomentaryBehavior extends BaseButtonBehavior {
  onStepOn(button: ButtonState, _level: RolesLevel): void {
    button.isActive = true;
  }

  onStepOff(button: ButtonState, _level: RolesLevel): void {
    button.isActive = false;
  }
}
