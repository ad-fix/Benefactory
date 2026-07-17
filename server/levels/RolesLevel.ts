import { ButtonState, Player } from "../schema/GameState";
import { BaseLevel } from "./BaseLevel";

export class RolesLevel extends BaseLevel {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private prevPositions = new Map<string, { x: number; y: number }>();

  onLevelStart(): void {
    this.setupStage(1);
  }

  private setupStage(n: number): void {
    const rs = this.state.rolesLevel;
    rs.operatorButtons.clear();
    rs.engineerButtons.clear();

    if (n === 1) {
      const color = "BLUE";

      const opPos = this.randomFreePosition();
      const opBtn = new ButtonState();
      opBtn.id = "op-1";
      opBtn.color = color;
      opBtn.x = opPos.x;
      opBtn.y = opPos.y;
      opBtn.behaviorType = "MOMENTARY";
      rs.operatorButtons.set(opBtn.id, opBtn);
      console.log(`[RolesLevel] Stage 1: OPERATOR button at (${opPos.x}, ${opPos.y})`);

      const engPos = this.randomFreePosition();
      const engBtn = new ButtonState();
      engBtn.id = "eng-1";
      engBtn.color = color;
      engBtn.x = engPos.x;
      engBtn.y = engPos.y;
      engBtn.behaviorType = "MOMENTARY";
      rs.engineerButtons.set(engBtn.id, engBtn);
      console.log(`[RolesLevel] Stage 1: ENGINEER button at (${engPos.x}, ${engPos.y})`);
    }
  }

  private randomFreePosition(): { x: number; y: number } {
    const MAX_GRID = 26;
    const center = Math.floor(MAX_GRID / 2);
    const halfW = Math.floor(this.state.gridWidth / 2);
    const halfH = Math.floor(this.state.gridHeight / 2);
    const minX = center - halfW;
    const maxX = center + halfW - 1;
    const minY = center - halfH;
    const maxY = center + halfH - 1;

    const occupied = new Set<string>();
    this.state.players.forEach((p) => occupied.add(`${p.x},${p.y}`));
    this.state.rolesLevel.operatorButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));
    this.state.rolesLevel.engineerButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));

    for (let i = 0; i < 200; i++) {
      const x = minX + Math.floor(Math.random() * (maxX - minX + 1));
      const y = minY + Math.floor(Math.random() * (maxY - minY + 1));
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
    return { x: center, y: center };
  }

  canPlayerMoveTo(player: Player, x: number, y: number): boolean {
    for (const [, other] of this.state.players) {
      if (other !== player && other.x === x && other.y === y) return false;
    }
    return true;
  }

  onPlayerMove(player: Player, x: number, y: number): void {
    const prev = this.prevPositions.get(player.sessionId);
    this.prevPositions.set(player.sessionId, { x, y });

    if (player.role === "OPERATOR") {
      const rs = this.state.rolesLevel;
      rs.operatorButtons.forEach((btn) => {
        if (btn.x === x && btn.y === y) {
          btn.isActive = true;
          console.log(`[RolesLevel] OPERATOR stepped on button ${btn.id} at (${x}, ${y}) — activated`);
        } else if (prev && btn.x === prev.x && btn.y === prev.y && btn.isActive) {
          btn.isActive = false;
          console.log(`[RolesLevel] OPERATOR stepped off button ${btn.id} at (${prev.x}, ${prev.y}) — deactivated`);
        }
      });

      if (this.allButtonsActive()) {
        console.log("[RolesLevel] STAGE INPUT SATISFIED");
      }
    }
  }

  private allButtonsActive(): boolean {
    const rs = this.state.rolesLevel;
    if (rs.operatorButtons.size === 0) return false;
    for (const [, btn] of rs.operatorButtons) {
      if (!btn.isActive) return false;
    }
    return true;
  }

  isLevelComplete(): boolean {
    return false;
  }

  onDispose(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}
