import { ArraySchema } from "@colyseus/schema";
import { ButtonState, Player, PositionState } from "../schema/GameState";
import { BaseLevel } from "./BaseLevel";
import { BehaviorFactory } from "./roles/behaviors/BehaviorFactory";

const SLOW_TILE_COUNT = 10;
const SLOW_DURATION_MS = 3000;
const SLOWED_MOVE_INTERVAL_MS = 500;
const TOGGLE_EXPIRY_STAGE = 3;
const BUTTON_RELOCATE_STAGE = 4;
const RELOCATE_INTERVAL_MS = 30000;
const HIDDEN_COLOR_STAGE = 4;
const FLIP_COOLDOWN_STAGE = 4;
const FLIP_COOLDOWN_MS = 10000;
const COLOR_CYCLE = ["RED", "GREEN", "BLUE"] as const;

export class RolesLevel extends BaseLevel {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private prevPositions = new Map<string, { x: number; y: number }>();
  private engLastButton = new Map<string, string | null>();
  private lastMoveAt = new Map<string, number>();
  private toggleActivatedAt = new Map<string, number>();
  private engSwitchOn = new Map<string, boolean>();

  onLevelStart(): void {
    this.setupStage(1);
    const tick = setInterval(() => {
      this.tickConfirmation();
      this.tickButtons();
      this.tickButtonRelocation();
    }, 250);
    this.timers.push(tick as unknown as ReturnType<typeof setTimeout>);
  }

  devSetStage(n: number): void {
    if (n < 1 || n > 4) return;
    const rs = this.state.rolesLevel;
    rs.lights = n - 1;
    this.setupStage(n);
    console.log(`[RolesLevel] DEV: jumped to stage ${n} (lights=${rs.lights})`);
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
    rs.operatorSlowTiles.clear();
    rs.engineerSlowTiles.clear();
    rs.monitorSlowTiles.clear();
    rs.slowedUntilBySession.clear();
    rs.hiddenEngineerColor = "";
    rs.engineerSwitchX = -1;
    rs.engineerSwitchY = -1;
    rs.flipCooldownByColor.clear();
    this.lastMoveAt.clear();
    this.toggleActivatedAt.clear();
    this.engSwitchOn.clear();

    if (n === 1) {
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
    } else if (n === 2) {
      for (const color of this.pickDistinctColors(2)) {
        this.spawnButtonPair(n, color);
      }
    } else if (n >= 3) {
      for (const color of this.pickDistinctColors(3)) {
        this.spawnButtonPair(n, color);
      }
    }

    if (n === 3 && rs.blueCutterFor === "") {
      this.assignCutterRecipient("blueCutterFor");
    }

    if (n >= 3) {
      this.setupSlowTiles();
    }

    if (n === BUTTON_RELOCATE_STAGE) {
      this.stampRelocateDeadlines(Date.now());
    }

    if (n === HIDDEN_COLOR_STAGE) {
      rs.hiddenEngineerColor = this.pickDistinctColors(1)[0];
      this.spawnEngineerSwitchTile();
      console.log(`[RolesLevel] Stage ${n}: hidden ENGINEER color = ${rs.hiddenEngineerColor}`);
    }
  }

  private spawnButtonPair(n: number, color: string): void {
    const rs = this.state.rolesLevel;

    const opPos = this.randomFreePosition();
    const opBtn = new ButtonState();
    opBtn.id = `op-${n}-${color}`;
    opBtn.color = color;
    opBtn.x = opPos.x;
    opBtn.y = opPos.y;
    opBtn.behaviorType = "MOMENTARY";
    rs.operatorButtons.set(opBtn.id, opBtn);

    const engPos = this.randomFreePosition();
    const engBtn = new ButtonState();
    engBtn.id = `eng-${n}-${color}`;
    engBtn.color = color;
    engBtn.x = engPos.x;
    engBtn.y = engPos.y;
    engBtn.behaviorType = "MOMENTARY";
    rs.engineerButtons.set(engBtn.id, engBtn);

    console.log(`[RolesLevel] Stage ${n}: OPERATOR (${color}) at (${opPos.x}, ${opPos.y}), ENGINEER (${color}) at (${engPos.x}, ${engPos.y})`);
  }

  private setupSlowTiles(): void {
    const rs = this.state.rolesLevel;

    const occupied = new Set<string>();
    this.state.players.forEach((p) => occupied.add(`${p.x},${p.y}`));
    rs.operatorButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));
    rs.engineerButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));

    const roleTileLists: ArraySchema<PositionState>[] = [
      rs.operatorSlowTiles,
      rs.engineerSlowTiles,
      rs.monitorSlowTiles,
    ];

    for (const tiles of roleTileLists) {
      for (let i = 0; i < SLOW_TILE_COUNT; i++) {
        const pos = this.pickFreePosition(occupied);
        const tile = new PositionState();
        tile.x = pos.x;
        tile.y = pos.y;
        tiles.push(tile);
        occupied.add(`${pos.x},${pos.y}`);
      }
    }

    console.log(`[RolesLevel] Stage ${rs.stage}: generated ${SLOW_TILE_COUNT} slow tiles per role`);
  }

  private slowTilesForRole(role: string): ArraySchema<PositionState> | null {
    const rs = this.state.rolesLevel;
    switch (role) {
      case "OPERATOR": return rs.operatorSlowTiles;
      case "ENGINEER": return rs.engineerSlowTiles;
      case "MONITOR": return rs.monitorSlowTiles;
      default: return null;
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

  private tickButtons(): void {
    const rs = this.state.rolesLevel;
    if (rs.stage < TOGGLE_EXPIRY_STAGE) return;

    const now = Date.now();
    rs.operatorButtons.forEach((btn) => {
      BehaviorFactory.getBehavior(btn.behaviorType).tick(btn, now, this);
    });
  }

  private stampRelocateDeadlines(now: number): void {
    const rs = this.state.rolesLevel;
    rs.operatorButtons.forEach((btn) => { btn.relocateAt = now + RELOCATE_INTERVAL_MS; });
  }

  private tickButtonRelocation(): void {
    const rs = this.state.rolesLevel;
    if (rs.stage !== BUTTON_RELOCATE_STAGE) return;
    if (rs.confirmationVisible) return;

    const now = Date.now();
    let shouldRelocate = false;

    rs.operatorButtons.forEach((btn) => {
      if (btn.isActive) {
        btn.relocateAt = now + RELOCATE_INTERVAL_MS;
      } else if (now >= btn.relocateAt) {
        shouldRelocate = true;
      }
    });

    if (shouldRelocate) {
      this.relocateOperatorButtons(now);
    }
  }

  private relocateOperatorButtons(now: number): void {
    const rs = this.state.rolesLevel;

    const occupied = new Set<string>();
    this.state.players.forEach((p) => occupied.add(`${p.x},${p.y}`));
    rs.operatorButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));
    rs.engineerButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));

    rs.operatorButtons.forEach((btn) => {
      const pos = this.pickFreePosition(occupied);
      console.log(`[RolesLevel] Stage 4: relocation deadline hit — OPERATOR ${btn.id}: (${btn.x},${btn.y}) → (${pos.x},${pos.y})`);
      btn.x = pos.x;
      btn.y = pos.y;
      occupied.add(`${pos.x},${pos.y}`);
      btn.relocateAt = now + RELOCATE_INTERVAL_MS;
      btn.isActive = false;
    });
  }

  isAllButtonsActive(): boolean {
    return this.allButtonsActive();
  }

  isPlayerStandingOn(x: number, y: number): boolean {
    for (const [, p] of this.state.players) {
      if (p.x === x && p.y === y) return true;
    }
    return false;
  }

  getToggleActivatedAt(buttonId: string): number | undefined {
    return this.toggleActivatedAt.get(buttonId);
  }

  setToggleActivatedAt(buttonId: string, timestamp: number): void {
    this.toggleActivatedAt.set(buttonId, timestamp);
  }

  clearToggleActivatedAt(buttonId: string): void {
    this.toggleActivatedAt.delete(buttonId);
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

  private pickDistinctColors(count: number): string[] {
    const pool = [...COLOR_CYCLE];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  private spawnEngineerSwitchTile(): void {
    const rs = this.state.rolesLevel;

    const occupied = new Set<string>();
    this.state.players.forEach((p) => occupied.add(`${p.x},${p.y}`));
    rs.operatorButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));
    rs.engineerButtons.forEach((b) => occupied.add(`${b.x},${b.y}`));
    rs.operatorSlowTiles.forEach((t) => occupied.add(`${t.x},${t.y}`));
    rs.engineerSlowTiles.forEach((t) => occupied.add(`${t.x},${t.y}`));
    rs.monitorSlowTiles.forEach((t) => occupied.add(`${t.x},${t.y}`));

    const pos = this.pickFreePosition(occupied);
    rs.engineerSwitchX = pos.x;
    rs.engineerSwitchY = pos.y;
    console.log(`[RolesLevel] Stage 4: ENGINEER switch tile at (${pos.x}, ${pos.y})`);
  }

  private rotateHiddenEngineerColor(): void {
    const rs = this.state.rolesLevel;
    const idx = COLOR_CYCLE.indexOf(rs.hiddenEngineerColor as typeof COLOR_CYCLE[number]);
    const next = COLOR_CYCLE[(idx + 1) % COLOR_CYCLE.length];
    rs.hiddenEngineerColor = next;
    console.log(`[RolesLevel] Stage 4: ENGINEER switch rotated hidden color → ${next}`);
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

  canPlayerMoveTo(player: Player, _x: number, _y: number): boolean {
    const rs = this.state.rolesLevel;
    const slowedUntil = rs.slowedUntilBySession.get(player.sessionId) ?? 0;
    if (slowedUntil > Date.now()) {
      const last = this.lastMoveAt.get(player.sessionId) ?? 0;
      if (Date.now() - last < SLOWED_MOVE_INTERVAL_MS) return false;
    }
    return true;
  }

  onPlayerMove(player: Player, x: number, y: number): void {
    this.lastMoveAt.set(player.sessionId, Date.now());

    const prev = this.prevPositions.get(player.sessionId);
    this.prevPositions.set(player.sessionId, { x, y });

    const rs = this.state.rolesLevel;

    const slowTiles = this.slowTilesForRole(player.role);
    if (slowTiles?.some((t) => t.x === x && t.y === y)) {
      rs.slowedUntilBySession.set(player.sessionId, Date.now() + SLOW_DURATION_MS);
      console.log(`[RolesLevel] ${player.role} ${player.sessionId} hit a slow tile at (${x}, ${y})`);
    }

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

    if (player.role === "ENGINEER") {
      const lastBtnId = this.engLastButton.get(player.sessionId) ?? null;
      let currentBtnId: string | null = null;

      rs.engineerButtons.forEach((btn) => {
        if (btn.x === x && btn.y === y) {
          currentBtnId = btn.id;
          if (lastBtnId !== btn.id) {
            const now = Date.now();
            const isHidden = rs.stage === HIDDEN_COLOR_STAGE && btn.color === rs.hiddenEngineerColor;
            const onCooldown = rs.stage === FLIP_COOLDOWN_STAGE
              && (rs.flipCooldownByColor.get(btn.color) ?? 0) > now;

            if (isHidden) {
              console.log(`[RolesLevel] Stage 4: ENGINEER press on hidden color ${btn.color} ignored`);
            } else if (onCooldown) {
              console.log(`[RolesLevel] Stage 4: ENGINEER press on ${btn.color} ignored — flip cooldown active`);
            } else {
              rs.operatorButtons.forEach((opBtn) => {
                if (opBtn.color === btn.color) {
                  const next = opBtn.behaviorType === "MOMENTARY" ? "TOGGLE" : "MOMENTARY";
                  console.log(`[RolesLevel] ENGINEER flipped ${opBtn.id}: ${opBtn.behaviorType} → ${next}`);
                  opBtn.behaviorType = next;
                  opBtn.isActive = false;
                }
              });
              if (rs.stage === FLIP_COOLDOWN_STAGE) {
                rs.flipCooldownByColor.set(btn.color, now + FLIP_COOLDOWN_MS);
              }
            }
          }
        }
      });

      this.engLastButton.set(player.sessionId, currentBtnId);

      if (rs.stage === HIDDEN_COLOR_STAGE) {
        const onSwitch = x === rs.engineerSwitchX && y === rs.engineerSwitchY;
        const wasOnSwitch = this.engSwitchOn.get(player.sessionId) ?? false;
        if (onSwitch && !wasOnSwitch) {
          this.rotateHiddenEngineerColor();
        }
        this.engSwitchOn.set(player.sessionId, onSwitch);
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

  private assignCutterRecipient(field: "blueCutterFor" | "redCutterFor"): void {
    const rs = this.state.rolesLevel;
    const eligible: Player[] = [];
    this.state.players.forEach((p) => {
      if (p.heldWirecutter !== "") return;
      if (field === "redCutterFor" && p.role === rs.blueCutterFor) return;
      eligible.push(p);
    });
    if (eligible.length === 0) return;
    const chosen = eligible[Math.floor(Math.random() * eligible.length)];
    rs[field] = chosen.role;
    console.log(`[RolesLevel] ${field} assigned to role ${chosen.role}`);
  }

  isLevelComplete(): boolean {
    const rs = this.state.rolesLevel;
    const complete = rs.lights >= 4;
    if (complete && rs.redCutterFor === "") {
      this.assignCutterRecipient("redCutterFor");
    }
    return complete;
  }

  onDispose(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}
