import { ButtonState, Player } from "../schema/GameState";
import { BaseLevel } from "./BaseLevel";
import { BehaviorFactory } from "./roles/behaviors/BehaviorFactory";

export class RolesLevel extends BaseLevel {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private prevPositions = new Map<string, { x: number; y: number }>();

  onLevelStart(): void {
    this.setupStage(1);
    const tick = setInterval(() => this.tickConfirmation(), 250);
    this.timers.push(tick as unknown as ReturnType<typeof setTimeout>);
  }

  private setupStage(n: number): void {
    const rs = this.state.rolesLevel;
    rs.stage = n;
    rs.operatorButtons.clear();
    rs.engineerButtons.clear();
    rs.confirmationVisible = false;
    rs.confirmationX = -1;
    rs.confirmationY = -1;
    rs.confirmationExpiresAt = 0;

    if (n <= 4) {
      const color = "BLUE";

      const opPos = this.randomFreePosition();
      const opBtn = new ButtonState();
      opBtn.id = `op-${n}`;
      opBtn.color = color;
      opBtn.x = opPos.x;
      opBtn.y = opPos.y;
      opBtn.behaviorType = "MOMENTARY";
      rs.operatorButtons.set(opBtn.id, opBtn);
      console.log(`[RolesLevel] Stage ${n}: OPERATOR button at (${opPos.x}, ${opPos.y})`);

      const engPos = this.randomFreePosition();
      const engBtn = new ButtonState();
      engBtn.id = `eng-${n}`;
      engBtn.color = color;
      engBtn.x = engPos.x;
      engBtn.y = engPos.y;
      engBtn.behaviorType = "MOMENTARY";
      rs.engineerButtons.set(engBtn.id, engBtn);
      console.log(`[RolesLevel] Stage ${n}: ENGINEER button at (${engPos.x}, ${engPos.y})`);
    }
  }

  private tickConfirmation(): void {
    const rs = this.state.rolesLevel;
    if (rs.confirmationVisible && Date.now() >= rs.confirmationExpiresAt) {
      rs.confirmationVisible = false;
      rs.confirmationX = -1;
      rs.confirmationY = -1;
      rs.operatorButtons.forEach((btn) => { btn.isActive = false; });
      rs.expiryCount++;
      console.log(`[RolesLevel] CONFIRMATION EXPIRED (expiry #${rs.expiryCount})`);
      this.relocateAllButtons();
    }
  }

  private relocateAllButtons(): void {
    const rs = this.state.rolesLevel;

    // Seed occupied with players and ALL current button positions (old positions stay excluded throughout).
    const occupied = new Set<string>();
    this.state.players.forEach((p) => occupied.add(`${p.x},${p.y}`));
    rs.operatorButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));
    rs.engineerButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));

    rs.operatorButtons.forEach((btn) => {
      const pos = this.pickFreePosition(occupied);
      console.log(`[RolesLevel] Relocated OPERATOR ${btn.id}: (${btn.x},${btn.y}) → (${pos.x},${pos.y})`);
      btn.x = pos.x;
      btn.y = pos.y;
      occupied.add(`${pos.x},${pos.y}`);
    });

    rs.engineerButtons.forEach((btn) => {
      const pos = this.pickFreePosition(occupied);
      console.log(`[RolesLevel] Relocated ENGINEER ${btn.id}: (${btn.x},${btn.y}) → (${pos.x},${pos.y})`);
      btn.x = pos.x;
      btn.y = pos.y;
      occupied.add(`${pos.x},${pos.y}`);
    });
  }

  private timerForStage(stage: number): number {
    return ([12000, 10000, 8000, 6000] as const)[stage - 1] ?? 6000;
  }

  private randomFreePosition(): { x: number; y: number } {
    const occupied = new Set<string>();
    this.state.players.forEach((p) => occupied.add(`${p.x},${p.y}`));
    this.state.rolesLevel.operatorButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));
    this.state.rolesLevel.engineerButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));
    return this.pickFreePosition(occupied);
  }

  private pickFreePosition(occupied: Set<string>): { x: number; y: number } {
    const MAX_GRID = 26;
    const center = Math.floor(MAX_GRID / 2);
    const halfW = Math.floor(this.state.gridWidth / 2);
    const halfH = Math.floor(this.state.gridHeight / 2);
    const minX = center - halfW;
    const maxX = center + halfW - 1;
    const minY = center - halfH;
    const maxY = center + halfH - 1;

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

    const rs = this.state.rolesLevel;

    if (player.role === "OPERATOR") {
      rs.operatorButtons.forEach((btn) => {
        const behavior = BehaviorFactory.getBehavior(btn.behaviorType);
        if (btn.x === x && btn.y === y) {
          behavior.onStepOn(btn, this);
          console.log(`[RolesLevel] OPERATOR stepped on button ${btn.id} at (${x}, ${y}) — isActive: ${btn.isActive}`);
        } else if (prev && btn.x === prev.x && btn.y === prev.y) {
          behavior.onStepOff(btn, this);
          console.log(`[RolesLevel] OPERATOR stepped off button ${btn.id} at (${prev.x}, ${prev.y}) — isActive: ${btn.isActive}`);
        }
      });

      if (this.allButtonsActive() && !rs.confirmationVisible) {
        const pos = this.randomFreePosition();
        rs.confirmationX = pos.x;
        rs.confirmationY = pos.y;
        rs.confirmationExpiresAt = Date.now() + this.timerForStage(rs.stage);
        rs.confirmationVisible = true;
        console.log(`[RolesLevel] STAGE INPUT SATISFIED — confirmation tile at (${pos.x}, ${pos.y}), expires in ${this.timerForStage(rs.stage)}ms`);
      }
    }

    if (player.role === "MONITOR" && rs.confirmationVisible && x === rs.confirmationX && y === rs.confirmationY) {
      this.lockCheckpoint();
    }
  }

  private lockCheckpoint(): void {
    const rs = this.state.rolesLevel;
    rs.confirmationVisible = false;
    rs.confirmationX = -1;
    rs.confirmationY = -1;
    rs.lights++;
    console.log(`[RolesLevel] CHECKPOINT LOCKED — lights: ${rs.lights}`);
    if (rs.stage < 4) {
      this.setupStage(rs.stage + 1);
    } else {
      console.log("[RolesLevel] LEVEL COMPLETE");
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
