import { ButtonState } from "../../../schema/GameState";
import { RolesLevel } from "../../RolesLevel";
import { BaseButtonBehavior } from "./BaseButtonBehavior";

export class ToggleBehavior extends BaseButtonBehavior {
  onStepOn(button: ButtonState, _level: RolesLevel): void {
    button.isActive = !button.isActive;
  }

  onStepOff(_button: ButtonState, _level: RolesLevel): void {
    // intentionally no-op: toggle state persists after step-off
  }
}
