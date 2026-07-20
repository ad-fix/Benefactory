import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import * as Client from "colyseus.js";
import { Level1Mesh } from "@/components/game/Level1Mesh";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { Player } from "@/components/Player";
import { ParticleFloor } from "@/components/ParticleFloor";
import { useAmbientMusic } from "@/hooks/use-ambient-music";
import { LEVEL_MUSIC, DEFAULT_LEVEL_MUSIC } from "@/constants/levelMusic";
// adding in ambient music to levels

import { PulseRipple } from "@/components/game/PulseRipple";
import { ClickHandler } from "@/components/ClickHandler";
import { Info, LogOut, Settings, TriangleAlert, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSounds } from "@/hooks/use-sounds";
// Removed: PolarAmbientParticlesCanvas, NoiseBlobFieldCanvas — hidden behind opaque R3F canvas, wasted WebGL contexts
import { InteractablePopup } from "@/components/game/InteractablePopup";
// adding interactable objects depending on level and stage
import { InteractableItem } from "@/components/game/InteractableItem";
import { LEVEL_INTERACTABLES } from "@/constants/levelInteractables";
import { HudCornerLs, POLAR_HUD } from "@/components/ui/polar-chrome";
import { NoiseFieldOverlay, type NoiseFieldHandle } from "@/components/game/NoiseFieldOverlay";
import { StageAnnouncement } from "@/components/game/StageAnnouncement";
import { DevStageControls } from "@/components/game/DevStageControls";
import { GameControls } from "@/components/game/GameControls";
import { NebulaBackdrop } from "@/components/game/NebulaBackdrop";
import { RolesLevelView } from "@/levels/roles/RolesLevelView";
import { ButtonDot } from "@/levels/roles/ButtonDot";
import { ConfirmationTile } from "@/levels/roles/ConfirmationTile";
import { SwitchTile } from "@/levels/roles/SwitchTile";
import { StageLights } from "@/levels/roles/StageLights";
import { OperatorGhost } from "@/levels/roles/OperatorGhost";
import { GhostButton } from "@/levels/roles/GhostButton";
import {
  getFloorTint,
  getPlayerDisplayLabel,
  getPlayerUiLabelHex,
  PLAYER_HEX,
} from "@/constants/playerColors";

// Types
type PlayerColor = "RED" | "GREEN" | "BLUE";
type ClueColorLower = "red" | "green" | "blue";

interface PlayerState {
  x: number;
  y: number;
  color: PlayerColor;
  role: string;
  sessionId: string;
  name: string;
  school: string;
  discordName: string;
}

interface ButtonLocal {
  id: string;
  color: string;
  x: number;
  y: number;
  behaviorType: string;
  isActive: boolean;
  relocateAt: number;
}

interface RolesLevelLocal {
  stage: number;
  lights: number;
  frozen: boolean;
  operatorButtons: ButtonLocal[];
  engineerButtons: ButtonLocal[];
  confirmationX: number;
  confirmationY: number;
  confirmationVisible: boolean;
  confirmationExpiresAt: number;
  expiryCount: number;
  slowedUntilBySession: Map<string, number>;
  hiddenEngineerColor: string;
  engineerSwitchX: number;
  engineerSwitchY: number;
  flipCooldownByColor: Map<string, number>;
}

interface Ping {
  id: string;
  x: number;
  y: number;
  timestamp: number;
  color: PlayerColor;
}

const COLOR_MAP_LOWER: Record<PlayerColor, ClueColorLower> = {
  RED: "red",
  GREEN: "green",
  BLUE: "blue",
};

const CONTROL_KEYS = {
  up: ["ArrowUp", "w", "W"],
  down: ["ArrowDown", "s", "S"],
  left: ["ArrowLeft", "a", "A"],
  right: ["ArrowRight", "d", "D"],
};

const SPACING = 2.5;

// Error boundary to catch silent Canvas/Three.js crashes
class CanvasErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Canvas Error Boundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-canvas">
          <div className="text-center">
            <p className="text-slate-400 text-sm mb-3">3D rendering failed</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-none border border-emerald-500/60 bg-emerald-950/40 px-4 py-2 font-montreal text-xs uppercase tracking-wider text-emerald-200 transition hover:border-emerald-400/80 hover:bg-emerald-900/50"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Defers EffectComposer mount until canvas has real dimensions,
// preventing Bloom from creating 0x0 framebuffers inside iframes
const DeferredEffects = () => {
  const { size } = useThree();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (size.width > 0 && size.height > 0) setReady(true);
  }, [size.width, size.height]);

  if (!ready) return null;
  return (
    <EffectComposer>
      <Bloom intensity={0.75} luminanceThreshold={0.5} luminanceSmoothing={0.9} mipmapBlur />
    </EffectComposer>
  );
};

// Calculate 2D camera position (top-down view)
const get2DCameraPosition = (gridWidth: number, gridHeight: number): [number, number, number] => {
  const boardSize = Math.max(gridWidth, gridHeight) * SPACING;
  // Top-down view: camera directly above
  const height = boardSize * 1.5;
  return [0, height, 0];
};

// Calculates the target ortho zoom to fit the board in the viewport
const calcBoardZoom = (gridWidth: number, gridHeight: number, spacing: number, viewportHeight: number) => {
  const boardSize = Math.max(gridWidth, gridHeight) * spacing;
  if (boardSize === 0) return 1000;
  const padding = 1.3;
  return viewportHeight / (boardSize * padding);
};

// Sets camera position + zoom once on first valid data,
// then snaps zoom on grid dimension changes (stage-up).
const SmoothZoom = ({
  gridWidth,
  gridHeight,
  spacing,
}: {
  gridWidth: number;
  gridHeight: number;
  spacing: number;
}) => {
  const { camera, size } = useThree();
  const initialized = useRef(false);
  const prevGrid = useRef({ w: 0, h: 0, vh: 0 });

  useFrame(() => {
    if (size.height === 0 || gridWidth <= 0 || gridHeight <= 0) return;
    const ortho = camera as THREE.OrthographicCamera;
    const zoom = calcBoardZoom(gridWidth, gridHeight, spacing, size.height);
    if (!isFinite(zoom) || zoom <= 0) return;

    const needsUpdate =
      !initialized.current ||
      gridWidth !== prevGrid.current.w ||
      gridHeight !== prevGrid.current.h ||
      size.height !== prevGrid.current.vh;

    if (!needsUpdate) return;

    // Position camera directly above the board center, looking straight down
    const pos = get2DCameraPosition(gridWidth, gridHeight);
    ortho.position.set(pos[0], pos[1], pos[2]);
    // Set rotation explicitly for top-down view (avoid lookAt gimbal lock)
    ortho.rotation.set(-Math.PI / 2, 0, 0);
    ortho.zoom = zoom;
    ortho.updateProjectionMatrix();

    prevGrid.current = { w: gridWidth, h: gridHeight, vh: size.height };
    initialized.current = true;
  });

  return null;
};

interface GameScreenProps {
  room: Client.Room | null;
  players: Map<string, PlayerState>;
  gridWidth: number;
  gridHeight: number;
  myColor: PlayerColor | null;
  myRole?: string | null;
  currentLevel?: string;
  isSoloMode: boolean;
  stage: number;
  timeRemaining: number;
  isDevMode: boolean;
  seed: number;
  isSpectator?: boolean;
  isGameOver?: boolean;
  countdown?: number;
  bgMusicVolume?: number;
  onBgMusicVolumeChange?: (volume: number) => void;
  challengeName?: string;
  rolesLevel?: RolesLevelLocal;
  onLeave?: () => void;
}

/** Horizontal slider styled to match the in-game score bar (cyan frame + navy→white gradient fill). */
const PolarSlider = ({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel: string;
}) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative h-3 min-w-0 flex-1">
      <div
        className="absolute inset-0 overflow-hidden rounded-none border border-solid bg-white/[0.04] ring-1 ring-inset ring-white/[0.05] backdrop-blur-[4px]"
        style={{
          borderColor: POLAR_HUD.barBorder,
          boxShadow: `inset 0 0 20px ${POLAR_HUD.barInset}`,
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-y-0 left-0 overflow-hidden transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%` }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, #1e293b 0%, #2d3f56 8%, #3e5570 18%, #5a7a96 30%, #7da3bf 44%, #a5cfe4 58%, #c8e6f5 72%, #e0f2fe 84%, #f0f9ff 93%, #ffffff 100%)",
            }}
          />
          <div
            className="absolute inset-x-0 top-0 h-[40%] opacity-30"
            style={{
              background: "linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)",
            }}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 right-0 w-3"
            style={{
              background:
                "linear-gradient(to left, rgba(186,230,253,0.6), rgba(186,230,253,0.15) 40%, transparent)",
            }}
            aria-hidden
          />
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label={ariaLabel}
      />
    </div>
  );
};

export const GameScreen = ({
  room,
  players,
  gridWidth,
  gridHeight,
  myColor,
  myRole,
  currentLevel = "roles",
  isSoloMode,
  stage,
  timeRemaining,
  isDevMode,
  seed,
  isSpectator = false,
  isGameOver = false,
  countdown = 0,
  bgMusicVolume,
  onBgMusicVolumeChange,
  challengeName,
  rolesLevel,
  onLeave,
}: GameScreenProps) => {
  const { play: playSound, sfxVolume, setSfxVolume } = useSounds();
  useAmbientMusic(LEVEL_MUSIC[currentLevel] ?? DEFAULT_LEVEL_MUSIC);
  const [activePopup, setActivePopup] = useState<{ imageUrl: string; label: string; triggerId: number } | null>(null);
const popupCounter = useRef(0);

const showPopup = (imageUrl: string, label: string) => {
  popupCounter.current += 1;
  setActivePopup({ imageUrl, label, triggerId: popupCounter.current });
};
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsExiting, setSettingsExiting] = useState(false);
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [pings, setPings] = useState<Ping[]>([]);
  const [rippleTrigger, setRippleTrigger] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [predictedPos, setPredictedPos] = useState<{ x: number, y: number } | null>(null);
  const settingsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SETTINGS_CLOSE_MS = 300;

  const openSettings = () => {
    if (settingsCloseTimerRef.current != null) {
      clearTimeout(settingsCloseTimerRef.current);
      settingsCloseTimerRef.current = null;
    }
    setSettingsExiting(false);
    setSettingsOpen(true);
  };

  const requestCloseSettings = () => {
    if (settingsCloseTimerRef.current != null) return;
    setSettingsExiting(true);
    settingsCloseTimerRef.current = setTimeout(() => {
      settingsCloseTimerRef.current = null;
      setSettingsOpen(false);
      setSettingsExiting(false);
    }, SETTINGS_CLOSE_MS);
  };

  const pendingInputsRef = useRef<Map<number, { x: number, y: number }>>(new Map());
  const seqCounterRef = useRef(0);
  const lastRepeatTimeRef = useRef(0);
  const prevStageRef = useRef(stage);

  // Score burst overlay ref
  // Noise field overlay ref (flashes on stage change)
  const noiseFieldRef = useRef<NoiseFieldHandle>(null);

  // Dev: client-side stage override for effects testing (does NOT affect game)
  const [fakeStage, setFakeStage] = useState<number | null>(null);
  const effectiveStage = fakeStage ?? stage;

  const localPlayerDisplayName = useMemo(() => {
    if (!room) return null;
    const me = Array.from(players.values()).find((p) => p.sessionId === room.sessionId);
    const n = me?.name?.trim();
    return n && n.length > 0 ? n : null;
  }, [room, players]);

  useEffect(() => {
    return () => {
      if (settingsCloseTimerRef.current != null) {
        clearTimeout(settingsCloseTimerRef.current);
        settingsCloseTimerRef.current = null;
      }
    };
  }, []);

  // Listen for room messages
  useEffect(() => {
    if (!room) return;

    const handlePing = (message: { x: number; y: number; color: PlayerColor }) => {
      const now = Date.now();
      const newPing: Ping = {
        id: crypto.randomUUID(),
        x: message.x,
        y: message.y,
        timestamp: now,
        color: message.color,
      };
      setPings((prev) => [...prev, newPing]);
    };

    const handleMoveAck = (message: { seq: number; x: number; y: number }) => {
      // Remove this input from pending
      pendingInputsRef.current.delete(message.seq);

      // If no more pending inputs, sync to server position
      if (pendingInputsRef.current.size === 0) {
        setPredictedPos({ x: message.x, y: message.y });
      }
      // If still pending inputs, keep current predicted position (already calculated)
    };

    const offPing = room.onMessage("ping", handlePing);
    const offMoveAck = room.onMessage("moveAck", handleMoveAck);

    return () => {
      [
        offPing,
        offMoveAck,
      ].forEach((off) => {
        if (typeof off === "function") off();
      });
    };
  }, [room]);

  // Trigger ripple + effects on stage changes (works with both real and fake stage)
  useEffect(() => {
    if (effectiveStage !== prevStageRef.current) {
      prevStageRef.current = effectiveStage;
      setRippleTrigger(prev => prev + 1);
      // Flash noise overlay — stage 1 very subtle, ramps up gradually
      const stageIntensity = 0.07 + (effectiveStage / 8) * 0.33; // 0.07 → 0.4
      const stageDuration = 0.6 + (effectiveStage / 8) * 0.8;   // 0.6s → 1.4s
      noiseFieldRef.current?.flash(stageDuration, stageIntensity);
    }
  }, [effectiveStage]);

  // Log seed in dev mode
  useEffect(() => {
    if (isDevMode && seed) {
      console.log(`[Dev Mode] Seed: ${seed}`);
    }
  }, [isDevMode, seed]);

  // Initialize predicted position when we know our player
  useEffect(() => {
    if (players.size > 0 && !predictedPos) {
      if (isSoloMode) {
        // In solo mode, use the active player's position
        const playerArray = Array.from(players.values());
        if (playerArray[activePlayerIndex]) {
          setPredictedPos({ x: playerArray[activePlayerIndex].x, y: playerArray[activePlayerIndex].y });
        }
      } else if (myColor) {
        // In multiplayer, use our player's position
        const localPlayer = Array.from(players.values()).find(p => p.color === myColor);
        if (localPlayer) {
          setPredictedPos({ x: localPlayer.x, y: localPlayer.y });
        }
      }
    }
  }, [myColor, players, isSoloMode, predictedPos, activePlayerIndex]);

  // Reset prediction when switching players in solo mode (only on activePlayerIndex change)
  const prevActivePlayerIndexRef = useRef(activePlayerIndex);
  useEffect(() => {
    if (isSoloMode && prevActivePlayerIndexRef.current !== activePlayerIndex) {
      prevActivePlayerIndexRef.current = activePlayerIndex;
      const playerArray = Array.from(players.values());
      if (playerArray[activePlayerIndex]) {
        // Clear pending inputs and reset to new active player's position
        pendingInputsRef.current.clear();
        setPredictedPos({ x: playerArray[activePlayerIndex].x, y: playerArray[activePlayerIndex].y });
      }
    }
  }, [activePlayerIndex, isSoloMode, players]);

  // Keyboard controls
  useEffect(() => {
    if (!room || isSpectator || countdown > 0 || isGameOver) return;

    const REPEAT_INTERVAL = 1000 / 5; // 5 times per second

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) {
        const now = performance.now();
        if (now - lastRepeatTimeRef.current < REPEAT_INTERVAL) return;
        lastRepeatTimeRef.current = now;
      }
      if (isSoloMode && e.key === "Tab") {
        e.preventDefault();
        const playerArray = Array.from(players.values());
        if (playerArray.length > 0) {
          const newIndex = (activePlayerIndex + 1) % playerArray.length;
          const newPlayer = playerArray[newIndex];
          // Update both atomically to avoid stale predictedPos on the transition frame
          pendingInputsRef.current.clear();
          setPredictedPos({ x: newPlayer.x, y: newPlayer.y });
          setActivePlayerIndex(newIndex);
        }
        return;
      }

      // Dev mode: 1/2/3 to switch to red/green/blue player
      if (isDevMode && isSoloMode && (e.key === "1" || e.key === "2" || e.key === "3")) {
        const colorMap: Record<string, PlayerColor> = { "1": "RED", "2": "GREEN", "3": "BLUE" };
        const targetColor = colorMap[e.key];
        const playerArray = Array.from(players.values());
        const targetIndex = playerArray.findIndex(p => p.color === targetColor);
        if (targetIndex !== -1 && targetIndex !== activePlayerIndex) {
          const newPlayer = playerArray[targetIndex];
          pendingInputsRef.current.clear();
          setPredictedPos({ x: newPlayer.x, y: newPlayer.y });
          setActivePlayerIndex(targetIndex);
        }
        return;
      }

      let direction: "up" | "down" | "left" | "right" | null = null;
      if (CONTROL_KEYS.up.includes(e.key)) direction = "up";
      else if (CONTROL_KEYS.down.includes(e.key)) direction = "down";
      else if (CONTROL_KEYS.left.includes(e.key)) direction = "left";
      else if (CONTROL_KEYS.right.includes(e.key)) direction = "right";

      if (direction) {
        e.preventDefault();

        const playerArray = Array.from(players.values());
        const currentPlayer = isSoloMode
          ? playerArray[activePlayerIndex]
          : playerArray.find(p => p.color === myColor);
        const activeColor = currentPlayer?.color;

        // Immediately predict local movement
        if (predictedPos && room) {
          const MAX_GRID = 26;
          const center = Math.floor(MAX_GRID / 2);
          const halfWidth = Math.floor(gridWidth / 2);
          const halfHeight = Math.floor(gridHeight / 2);
          const minX = center - halfWidth;
          const maxX = center + halfWidth - 1;
          const minY = center - halfHeight;
          const maxY = center + halfHeight - 1;

          let newX = predictedPos.x;
          let newY = predictedPos.y;
          switch (direction) {
            case "up": newY = Math.max(minY, newY - 1); break;
            case "down": newY = Math.min(maxY, newY + 1); break;
            case "left": newX = Math.max(minX, newX - 1); break;
            case "right": newX = Math.min(maxX, newX + 1); break;
          }

          // Check for collision with other players
          const isBlocked = playerArray.some(
            p => p !== currentPlayer && p.x === newX && p.y === newY
          );

          if (!isBlocked) {
                        // Track this pending input
            const seq = ++seqCounterRef.current;
            pendingInputsRef.current.set(seq, { x: newX, y: newY });
            setPredictedPos({ x: newX, y: newY });

            // Send to server with seq (include targetColor in solo mode)
            room.send("move", {
              direction,
              seq,
              ...(isSoloMode && activeColor ? { targetColor: activeColor } : {}),
            });
            return; // Already sent
          }
        }

        // Fallback: Send with seq but without local prediction (blocked move or no predicted pos yet)
        const seq = ++seqCounterRef.current;
        // Track pending so ack handler can sync position when it returns
        pendingInputsRef.current.set(seq, { x: -1, y: -1 }); // Placeholder - ack will provide real position
        room.send("move", {
          direction,
          seq,
          ...(isSoloMode && currentPlayer ? { targetColor: currentPlayer.color } : {}),
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [room, myColor, isSoloMode, activePlayerIndex, players, gridWidth, gridHeight, predictedPos, isDevMode, isSpectator, countdown, isGameOver]);

  // Role of the player currently controlling/viewing (solo: active player; multiplayer: own role)
  const viewingRole = isSoloMode
    ? (Array.from(players.values())[activePlayerIndex]?.role ?? null)
    : (myRole ?? null);

  // Coordinate Helper
  const getVisualPos = (absX: number, absY: number, height: number = 0) => {
    const MAX_GRID = 26;
    const center = Math.floor(MAX_GRID / 2);
    const halfWidth = Math.floor(gridWidth / 2);
    const halfHeight = Math.floor(gridHeight / 2);
    const minX = center - halfWidth;
    const minY = center - halfHeight;

    const x = absX - minX;
    const y = absY - minY;

    const offsetX = (gridWidth - 1) / 2;
    const offsetY = (gridHeight - 1) / 2;
    return [
      (x - offsetX) * SPACING,
      height,
      (y - offsetY) * SPACING
    ] as [number, number, number];
  };

  return (
    <div className="isolate w-full h-screen relative overflow-hidden bg-canvas">
      {/* Cloud nebula backdrop is rendered inside the R3F Canvas (NebulaBackdrop). */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-canvas/25 via-transparent to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_45%,transparent_35%,hsl(222_45%_6%/0.35)_100%)]"
        aria-hidden
      />
      {/* NOTE: PolarAmbientParticlesCanvas & NoiseBlobFieldCanvas removed —
           hidden behind opaque R3F Canvas (z-[1]), wasted WebGL contexts.
           NoiseFieldOverlay + ScoreBurstOverlay moved AFTER the R3F Canvas below. */}
      {/* HUD: frosted polar chrome (match timer / stage chips); settings swap into same shell */}
      <div className="absolute left-4 top-4 z-20 flex w-[min(11.5rem,calc(100vw-2rem))] flex-col gap-2">
        <div
          className="relative flex flex-col overflow-hidden rounded-none border border-solid bg-canvas/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-[4px]"
          style={{ borderColor: POLAR_HUD.border }}
          role="status"
          aria-live="polite"
          data-ui="game-hud-panel"
        >
          <HudCornerLs />
          <div className="relative z-[1] flex min-h-0 flex-col">
          {settingsOpen && (
            <div className="relative z-30 flex h-9 w-full shrink-0 items-center justify-end border-b border-white/10 bg-canvas/30 px-2">
              <button
                type="button"
                onClick={requestCloseSettings}
                aria-controls="game-settings-panel"
                aria-label="Close settings"
                title="Close"
                className="flex size-7 shrink-0 items-center justify-center rounded-none text-slate-500 transition-colors hover:bg-white/[0.07] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <X className="size-3.5" strokeWidth={1.65} aria-hidden />
              </button>
            </div>
          )}

          {settingsOpen && (
            <div
              id="game-settings-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="game-settings-title"
              className={cn(
                "relative z-20 flex max-h-[min(70vh,22rem)] min-h-0 w-full shrink-0 flex-col gap-3 overflow-y-auto bg-transparent px-3 py-3 transition-opacity duration-300 ease-out",
                settingsExiting ? "pointer-events-none opacity-0" : "opacity-100",
              )}
            >
              <p
                id="game-settings-title"
                className="font-montreal text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500"
              >
                Settings
              </p>
              {bgMusicVolume !== undefined && onBgMusicVolumeChange && (
                <div className="w-full min-w-0">
                  <p className="mb-1.5 font-montreal text-[9px] uppercase tracking-[0.12em] text-slate-500">
                    Music
                  </p>
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onBgMusicVolumeChange(bgMusicVolume > 0 ? 0 : 0.3)}
                      className="shrink-0 text-slate-300 transition-colors hover:text-white"
                      aria-label={bgMusicVolume > 0 ? "Mute music" : "Unmute music"}
                    >
                      {bgMusicVolume > 0 ? (
                        <Volume2 className="size-4" aria-hidden />
                      ) : (
                        <VolumeX className="size-4" aria-hidden />
                      )}
                    </button>
                    <PolarSlider
                      value={bgMusicVolume}
                      onChange={onBgMusicVolumeChange}
                      ariaLabel="Music volume"
                    />
                    <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-slate-500">
                      {Math.round(bgMusicVolume * 100)}
                    </span>
                  </div>
                </div>
              )}
              <div className="w-full min-w-0">
                <p className="mb-1.5 font-montreal text-[9px] uppercase tracking-[0.12em] text-slate-500">
                  SFX
                </p>
                <div className="flex w-full min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSfxVolume(sfxVolume > 0 ? 0 : 0.5)}
                    className="shrink-0 text-slate-300 transition-colors hover:text-white"
                    aria-label={sfxVolume > 0 ? "Mute sound effects" : "Unmute sound effects"}
                  >
                    {sfxVolume > 0 ? (
                      <Volume2 className="size-4" aria-hidden />
                    ) : (
                      <VolumeX className="size-4" aria-hidden />
                    )}
                  </button>
                  <PolarSlider
                    value={sfxVolume}
                    onChange={setSfxVolume}
                    ariaLabel="SFX volume"
                  />
                  <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-slate-500">
                    {Math.round(sfxVolume * 100)}
                  </span>
                </div>
              </div>
              {room?.roomId && (
                <div className="border-t border-white/10 pt-3">
                  <p className="font-montreal text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Room code
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold tracking-widest text-white">
                    {room.roomId}
                  </p>
                </div>
              )}
            </div>
          )}

          {!settingsOpen && (
            <>
          {isSoloMode ? (
            <>
              <div className="relative z-10 flex w-full shrink-0 flex-col gap-3 px-3 py-3">
                <div className="grid min-w-0 gap-1">
                  <p className="font-montreal text-[9px] uppercase leading-none tracking-[0.12em] text-slate-500">
                    Mode
                  </p>
                  <p className="truncate text-xs font-medium tabular-nums leading-tight text-slate-200">
                    Solo mode
                  </p>
                </div>
                <div className="grid min-w-0 gap-1">
                  <p className="font-montreal text-[9px] uppercase leading-none tracking-[0.12em] text-slate-500">
                    Color
                  </p>
                  <p
                    className="truncate text-xs font-medium tabular-nums leading-tight text-slate-200"
                    style={{
                      color: Array.from(players.values())[activePlayerIndex]
                        ? getPlayerUiLabelHex(Array.from(players.values())[activePlayerIndex].color)
                        : undefined,
                    }}
                  >
                    {Array.from(players.values())[activePlayerIndex]
                      ? getPlayerDisplayLabel(Array.from(players.values())[activePlayerIndex].color)
                      : "…"}
                  </p>
                </div>
                {Array.from(players.values())[activePlayerIndex]?.role && (
                  <div className="grid min-w-0 gap-1">
                    <p className="font-montreal text-[9px] uppercase leading-none tracking-[0.12em] text-slate-500">
                      Role
                    </p>
                    <p className="truncate text-xs font-medium tabular-nums leading-tight text-slate-200">
                      {Array.from(players.values())[activePlayerIndex].role}
                    </p>
                  </div>
                )}
              </div>

              <div className="relative z-10 flex min-h-10 w-full shrink-0 flex-nowrap items-center justify-between gap-x-2 border-t border-white/10 px-3 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-x-1.5">
                  <kbd
                    className="inline-flex shrink-0 items-center rounded-none border border-solid bg-canvas/50 px-1.5 py-0.5 font-montreal text-[9px] font-medium uppercase tracking-[0.1em] text-slate-400"
                    style={{ borderColor: POLAR_HUD.border }}
                  >
                    Tab
                  </kbd>
                  <span className="min-w-0 truncate text-[11px] leading-snug text-slate-500">
                    Switch player
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setControlsOpen(v => !v)}
                    aria-expanded={controlsOpen}
                    aria-label="Toggle controls"
                    title="Controls"
                    className="flex size-7 shrink-0 items-center justify-center rounded-none text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  >
                    <Info className="size-3.5" strokeWidth={1.65} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={openSettings}
                    aria-expanded={settingsOpen}
                    aria-controls="game-settings-panel"
                    aria-label="Open settings"
                    title="Settings"
                    className="flex size-7 shrink-0 items-center justify-center rounded-none text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  >
                    <Settings className="size-3.5" strokeWidth={1.65} aria-hidden />
                  </button>
                  {onLeave && (
                    <button
                      type="button"
                      onClick={() => setShowLeaveConfirm(true)}
                      aria-label="Leave game"
                      title="Leave game"
                      className="flex size-7 shrink-0 items-center justify-center rounded-none text-slate-500 transition-colors hover:bg-white/[0.07] hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                    >
                      <LogOut className="size-3.5" strokeWidth={1.65} aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="relative z-10 flex w-full shrink-0 flex-col gap-3 px-3 py-3">
              <div className="grid min-w-0 gap-1">
                <p className="font-montreal text-[9px] uppercase leading-none tracking-[0.12em] text-slate-500">
                  Mode
                </p>
                <p className="truncate text-xs font-medium tabular-nums leading-tight text-slate-200">Multiplayer</p>
              </div>
              {room?.roomId && (
                <div className="grid min-w-0 gap-1">
                  <p className="font-montreal text-[9px] uppercase leading-none tracking-[0.12em] text-slate-500">
                    Room code
                  </p>
                  <p className="truncate font-mono text-xs font-semibold tracking-widest text-white">
                    {room.roomId}
                  </p>
                </div>
              )}
              <div className="grid min-w-0 gap-1">
                <p className="font-montreal text-[9px] uppercase leading-none tracking-[0.12em] text-slate-500">
                  You
                </p>
                <p
                  className="truncate text-xs font-medium tabular-nums leading-tight text-slate-200"
                  style={{ color: myColor ? getPlayerUiLabelHex(myColor) : undefined }}
                >
                  {localPlayerDisplayName ?? (myColor ? getPlayerDisplayLabel(myColor) : "…")}
                </p>
              </div>
              {myRole && (
                <div className="grid min-w-0 gap-1">
                  <p className="font-montreal text-[9px] uppercase leading-none tracking-[0.12em] text-slate-500">
                    Role
                  </p>
                  <p className="truncate text-xs font-medium tabular-nums leading-tight text-slate-200">
                    {myRole}
                  </p>
                </div>
              )}
              <div className="flex w-full shrink-0 justify-end gap-0.5 border-t border-white/10 pt-2">
                <button
                  type="button"
                  onClick={() => setControlsOpen(v => !v)}
                  aria-expanded={controlsOpen}
                  aria-label="Toggle controls"
                  title="Controls"
                  className="flex size-7 shrink-0 items-center justify-center rounded-none text-slate-500 transition-colors hover:bg-white/[0.07] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <Info className="size-3.5" strokeWidth={1.65} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={openSettings}
                  aria-expanded={settingsOpen}
                  aria-controls="game-settings-panel"
                  aria-label="Open settings"
                  title="Settings"
                  className="flex size-7 shrink-0 items-center justify-center rounded-none text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <Settings className="size-3.5" strokeWidth={1.65} aria-hidden />
                </button>
                {onLeave && (
                  <button
                    type="button"
                    onClick={onLeave}
                    aria-label="Leave game"
                    title="Leave game"
                    className="flex size-7 shrink-0 items-center justify-center rounded-none text-slate-500 transition-colors hover:bg-white/[0.07] hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  >
                    <LogOut className="size-3.5" strokeWidth={1.65} aria-hidden />
                  </button>
                )}
              </div>
            </div>
          )}
            </>
          )}
          </div>
        </div>

        {/* Controls reference — toggled via info button */}
        {controlsOpen && <GameControls showPing={!isSoloMode} />}
      </div>

      {/* Stage Display - Top Center (polar blue chrome) */}
      <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2">
        {/* Outer glow — intensity scales with stage */}
        <div
          className="absolute -inset-3 rounded-sm"
          style={{
            background: `radial-gradient(ellipse at center, rgba(56,189,248,${0.06 + (effectiveStage / 8) * 0.18}) 0%, transparent 70%)`,
            filter: `blur(${6 + effectiveStage * 1.5}px)`,
            transition: "all 1.5s ease-out",
          }}
          aria-hidden
        />
        <div
          className="relative min-w-[7rem] rounded-none border border-solid bg-canvas/50 px-5 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-[4px]"
          style={{
            borderColor: `rgba(56,189,248,${0.2 + (effectiveStage / 8) * 0.2})`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 ${8 + effectiveStage * 3}px rgba(56,189,248,${0.05 + (effectiveStage / 8) * 0.15})`,
          }}
          data-ui="game-stage-chip"
        >
          <HudCornerLs />
          <div className="relative z-[1]">
            {challengeName ? (
              <p className="mb-1.5 font-montreal text-[8px] uppercase leading-tight tracking-[0.12em] text-slate-500">
                {challengeName}
              </p>
            ) : null}
            <p className="font-montreal text-[9px] uppercase leading-tight tracking-[0.12em] text-slate-300">Stage</p>
            <p className="font-montreal text-3xl font-bold leading-tight tracking-[-0.02em] text-white">{stage}</p>
          </div>
        </div>
      </div>

      {currentLevel === "roles" && <StageLights lights={rolesLevel?.lights ?? 0} />}

      {currentLevel === "roles" && (rolesLevel?.expiryCount ?? 0) > 0 && (
        <div
          key={rolesLevel!.expiryCount}
          className="absolute left-1/2 z-20 -translate-x-1/2"
          style={{ top: "9.5rem", animation: "expiryBanner 3s ease-out forwards" }}
        >
          <div
            className="flex items-center gap-2.5 rounded-none border border-solid bg-canvas/90 px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[6px]"
            style={{ borderColor: "rgba(239,68,68,0.45)", boxShadow: "0 0 16px rgba(239,68,68,0.15)" }}
          >
            <TriangleAlert className="size-3.5 shrink-0 text-red-400" strokeWidth={1.75} aria-hidden />
            <p className="font-montreal text-[10px] font-semibold uppercase tracking-[0.1em] text-red-300">
              Confirmation failed — relocation activated
            </p>
          </div>
          <style>{`
            @keyframes expiryBanner {
              0%   { opacity: 0; transform: translateX(-50%) translateY(-6px); }
              12%  { opacity: 1; transform: translateX(-50%) translateY(0); }
              75%  { opacity: 1; transform: translateX(-50%) translateY(0); }
              100% { opacity: 0; transform: translateX(-50%) translateY(-6px); }
            }
          `}</style>
        </div>
      )}

      {/* Timer Display - Bottom Center (polar blue chrome) */}
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
        <div
          className="relative min-w-[7.25rem] whitespace-nowrap rounded-none border border-solid bg-canvas/50 px-4 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-[4px]"
          style={{ borderColor: POLAR_HUD.border }}
          data-ui="game-timer-chip"
        >
          <HudCornerLs />
          <div className="relative z-[1]">
            <p className="font-montreal text-[9px] uppercase leading-tight tracking-[0.12em] text-slate-300">Time</p>
            <p className="font-montreal text-[9px] uppercase leading-tight tracking-[0.12em] text-slate-300">Remaining</p>
            <p className="mt-1 font-montreal text-3xl font-bold leading-none tracking-[-0.04em] text-white">
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
            </p>
          </div>
        </div>
      </div>

      {/* Spectator Badge */}
      {isSpectator && (
        <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-none border border-hairline/40 bg-canvas/45 px-4 py-2 font-montreal text-[11px] uppercase tracking-wider text-slate-400 backdrop-blur-[6px]">
          Spectating
        </div>
      )}

      {/* Dev Mode Panel - Bottom Right */}
      {isDevMode && (
        <div className="absolute bottom-8 right-8 z-10 flex flex-col items-end gap-2">
          <div className="rounded-none border border-yellow-500/25 bg-canvas/45 px-3 py-1.5 backdrop-blur-[6px]">
            <p className="text-xs font-mono text-yellow-300/80">Seed: {seed}</p>
          </div>
          <button
            onClick={() => {
              if (room) {
                room.send("devStageUp", {});
              }
            }}
            className="rounded-none border border-yellow-500/35 bg-yellow-950/50 px-4 py-2 font-montreal text-xs uppercase tracking-wider backdrop-blur-[6px] transition-colors hover:border-yellow-400/50 hover:bg-yellow-950/70"
          >
            <p className="text-sm font-bold text-yellow-300">Stage Up</p>
            <p className="text-xs text-yellow-300/60 mt-0.5">Dev Mode</p>
          </button>
        </div>
      )}


      {/* Main Game Canvas */}
      <CanvasErrorBoundary>
      <Canvas
        className="absolute inset-0 z-[1] h-full w-full min-h-0"
        style={{ background: "#000000" }}
        gl={{
          powerPreference: "default",
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            console.warn("[WebGL] Context lost");
          });
          canvas.addEventListener("webglcontextrestored", () => {
            console.log("[WebGL] Context restored");
          });
        }}
      >
        <NebulaBackdrop />

        <OrthographicCamera
          makeDefault
          position={get2DCameraPosition(gridWidth, gridHeight)}
          rotation={[-Math.PI / 2, 0, 0]}
          zoom={calcBoardZoom(gridWidth, gridHeight, SPACING, window.innerHeight)}
        />

        <SmoothZoom
          gridWidth={gridWidth}
          gridHeight={gridHeight}
          spacing={SPACING}
        />

        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color={getFloorTint("GREEN")} />
        < Level1Mesh /> 
        <ParticleFloor key={`floor-${gridWidth}-${gridHeight}`} gridWidth={gridWidth} gridHeight={gridHeight} spacing={SPACING} rippleTrigger={rippleTrigger} />
        
           {(LEVEL_INTERACTABLES[currentLevel]?.[stage] ?? []).map((item) => (
              <InteractableItem
                key={item.id}
                imageUrl={item.imageUrl}
                position={getVisualPos(item.gridX, item.gridY, 0)}
                onInteract={() => showPopup(item.imageUrl, item.label)}
              />
            ))}

            {/* Players */}
            {Array.from(players.values()).map((player, index) => {
              if (currentLevel === "roles") {
                if (isSoloMode && index !== activePlayerIndex) return null;
                if (!isSoloMode && player.sessionId !== room?.sessionId) return null;
              }
              const isMe = isSoloMode ? index === activePlayerIndex : player.color === myColor;
              // Use predicted position for local player in multiplayer
              const playerX = isMe && predictedPos ? predictedPos.x : player.x;
              const playerY = isMe && predictedPos ? predictedPos.y : player.y;
              const pos = getVisualPos(playerX, playerY, -1.5);
              const slowedUntil = currentLevel === "roles"
                ? rolesLevel?.slowedUntilBySession?.get(player.sessionId)
                : undefined;
              return (
                <Player
                  key={player.sessionId || index}
                  color={COLOR_MAP_LOWER[player.color]}
                  position={pos}
                  rotation={0}
                  isMe={isMe}
                  slowedUntil={slowedUntil}
                />
              );
            })}

            {/* Roles level: Monitor-only Operator onion-skin ghost (stage 4) */}
            {currentLevel === "roles" && rolesLevel?.stage === 4 && viewingRole === "MONITOR" && (() => {
              const operatorPlayer = Array.from(players.values()).find(p => p.role === "OPERATOR");
              if (!operatorPlayer) return null;
              return (
                <OperatorGhost
                  color={COLOR_MAP_LOWER[operatorPlayer.color]}
                  position={getVisualPos(operatorPlayer.x, operatorPlayer.y, -1.5)}
                />
              );
            })()}

            {/* Roles level: Monitor-only ghost buttons + relocation countdown (stage 4) */}
            {currentLevel === "roles" && rolesLevel?.stage === 4 && viewingRole === "MONITOR" &&
              rolesLevel.operatorButtons.map(btn => (
                <GhostButton
                  key={btn.id}
                  color={btn.color}
                  position={getVisualPos(btn.x, btn.y, -1.85)}
                  relocateAt={btn.relocateAt}
                />
              ))
            }

            {/* Roles level: buttons (role-gated) */}
            {currentLevel === "roles" && rolesLevel && (() => {
              if (viewingRole === "OPERATOR") {
                return rolesLevel.operatorButtons.map(btn => (
                  <ButtonDot key={btn.id} button={btn} position={getVisualPos(btn.x, btn.y, -1.85)} />
                ));
              }
              if (viewingRole === "ENGINEER") {
                return rolesLevel.engineerButtons
                  .filter(btn => !(rolesLevel.stage === 4 && btn.color === rolesLevel.hiddenEngineerColor))
                  .map(btn => {
                    const matched = rolesLevel.operatorButtons.find(ob => ob.color === btn.color);
                    const cooldownUntil = rolesLevel.stage === 4
                      ? rolesLevel.flipCooldownByColor.get(btn.color)
                      : undefined;
                    return (
                      <ButtonDot
                        key={btn.id}
                        button={btn}
                        position={getVisualPos(btn.x, btn.y, -1.85)}
                        matchedBehaviorType={matched?.behaviorType}
                        cooldownUntil={cooldownUntil}
                      />
                    );
                  });
              }
              return null;
            })()}

            {/* Roles level: confirmation tile (Monitor only) */}
            {currentLevel === "roles" && rolesLevel?.confirmationVisible && viewingRole === "MONITOR" && (
              <ConfirmationTile position={getVisualPos(rolesLevel.confirmationX, rolesLevel.confirmationY, -1.85)} />
            )}

            {/* Roles level: engineer switch tile (stage 4, Engineer only) */}
            {currentLevel === "roles" && rolesLevel?.stage === 4 && viewingRole === "ENGINEER" && (
              <SwitchTile position={getVisualPos(rolesLevel.engineerSwitchX, rolesLevel.engineerSwitchY, -1.85)} />
            )}

            {/* Ping Effects */}
            {pings.map((ping) => {
              const pos: [number, number, number] = [ping.x, -2.4, ping.y];
              const pingColor = PLAYER_HEX[ping.color];
              return (
                <PulseRipple
                  key={ping.id}
                  position={pos}
                  color={pingColor}
                  duration={1.1}
                  maxRadius={2.4}
                  onComplete={() => {
                    setPings((prev) => prev.filter((p) => p.id !== ping.id));
                  }}
                />
              );
            })}

            {!isSpectator && !isGameOver && (
              <ClickHandler
                spacing={SPACING}
                gridWidth={gridWidth}
                gridHeight={gridHeight}
                onPing={(x, y) => {
                  if (room) {
                    room.send("ping", { x, y });
                  }
                }}
              />
            )}

        <DeferredEffects />

      </Canvas>
      </CanvasErrorBoundary>

      {/* Overlays — AFTER R3F Canvas, no wrapper divs, canvases use mix-blend-mode:screen */}
      <NoiseFieldOverlay ref={noiseFieldRef} resolutionScale={0.8} />
      <StageAnnouncement stage={effectiveStage} />
      <DevStageControls room={room} isDevMode={isDevMode} stage={effectiveStage} onFakeStageChange={setFakeStage} />

         {activePopup && (              
        <InteractablePopup
          key={activePopup.triggerId}
          imageUrl={activePopup.imageUrl}
          label={activePopup.label}
          onClose={() => setActivePopup(null)}
        />
      )}

      {currentLevel === "roles" && <RolesLevelView role={myRole ?? ""} room={room} />}

      {/* Leave confirmation dialog */}
      {showLeaveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/75 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-dialog-title"
        >
          <div
            className="relative flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-5 rounded-none border border-solid bg-canvas/90 px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-[8px]"
            style={{ borderColor: POLAR_HUD.border }}
          >
            <HudCornerLs />
            <div className="relative z-[1] flex flex-col gap-1.5">
              <p
                id="leave-dialog-title"
                className="font-montreal text-sm font-semibold text-white"
              >
                Leave game?
              </p>
              <p className="font-montreal text-xs text-slate-400">
                Are you sure you want to leave this game?
              </p>
            </div>
            <div className="relative z-[1] flex gap-3">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 rounded-none border border-emerald-500/50 bg-emerald-950/50 px-4 py-2 font-montreal text-xs font-medium uppercase tracking-wider text-emerald-300 transition-colors hover:border-emerald-400/70 hover:bg-emerald-900/60"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={onLeave}
                className="flex-1 rounded-none border border-red-500/50 bg-red-950/50 px-4 py-2 font-montreal text-xs font-medium uppercase tracking-wider text-red-300 transition-colors hover:border-red-400/70 hover:bg-red-900/60"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
