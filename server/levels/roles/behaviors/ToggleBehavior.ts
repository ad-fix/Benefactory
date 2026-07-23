import { ButtonState } from "../../../schema/GameState";
import { RolesLevel } from "../../RolesLevel";
import { BaseButtonBehavior } from "./BaseButtonBehavior";

const TOGGLE_EXPIRY_MS = 15000;

export class ToggleBehavior extends BaseButtonBehavior {
  onStepOn(button: ButtonState, level: RolesLevel): void {
    button.isActive = !button.isActive;
    if (button.isActive) {
      level.setToggleActivatedAt(button.id, Date.now());
    } else {
      level.clearToggleActivatedAt(button.id);
    }
  }

  onStepOff(_button: ButtonState, _level: RolesLevel): void {
    // intentionally no-op: toggle state persists after step-off
  }

  tick(button: ButtonState, now: number, level: RolesLevel): void {
    if (!button.isActive) return;
    if (level.isPlayerStandingOn(button.x, button.y)) return;
    if (level.isAllButtonsActive()) return;

    const activatedAt = level.getToggleActivatedAt(button.id);
    if (activatedAt === undefined) return;

    if (now - activatedAt >= TOGGLE_EXPIRY_MS) {
      button.isActive = false;
      level.clearToggleActivatedAt(button.id);
      console.log(`[ToggleBehavior] Button ${button.id} expired after ${TOGGLE_EXPIRY_MS}ms`);
    }
  }
}
