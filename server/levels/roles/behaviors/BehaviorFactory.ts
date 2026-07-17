import { BaseButtonBehavior } from "./BaseButtonBehavior";
import { MomentaryBehavior } from "./MomentaryBehavior";
import { ToggleBehavior } from "./ToggleBehavior";

export class BehaviorFactory {
  private static behaviors: Map<string, BaseButtonBehavior> = new Map([
    ["MOMENTARY", new MomentaryBehavior()],
    ["TOGGLE", new ToggleBehavior()],
  ]);

  static getBehavior(type: string): BaseButtonBehavior {
    const behavior = this.behaviors.get(type);
    if (!behavior) {
      throw new Error(`No behavior found for button type: ${type}`);
    }
    return behavior;
  }
}
