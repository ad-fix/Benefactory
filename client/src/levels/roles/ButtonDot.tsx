import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COLOR_MAP: Record<string, string> = {
  BLUE: "#38bdf8",
  YELLOW: "#fbbf24",
  RED: "#f87171",
  GREEN: "#4ade80",
};

function makeShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.8)");
  grad.addColorStop(0.6, "rgba(0, 0, 0, 0.55)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// Ring segment centered on the upper-left of the button's circumference (in the
// mesh's local XY plane, before the -90° X rotation maps +X→world +X and
// +Y→world -Z — so local 135° lands on world (-X, -Z), i.e. top-left).
const HIGHLIGHT_ARC_CENTER = (3 * Math.PI) / 4;
const HIGHLIGHT_ARC_SPAN = Math.PI * 0.4;
const HIGHLIGHT_MAX_OPACITY = 0.45;
// Tapered fade: stack several thin arc slices across the span with opacity
// following a sine curve, so the crescent is brightest at its middle and
// fades to fully transparent at both tips instead of cutting off abruptly.
const HIGHLIGHT_SEGMENT_COUNT = 7;

// Must match the server's FLIP_COOLDOWN_MS (server/levels/RolesLevel.ts) —
// used purely to derive sweep progress from the absolute cooldownUntil prop.
const COOLDOWN_DURATION_MS = 10000;
const COOLDOWN_WEDGE_RADIUS = 0.5;

const UNLIT_EMISSIVE_INTENSITY = 0.15;
const UNLIT_OPACITY = 0.45;
const LIT_EMISSIVE_INTENSITY = 1.5;
const LIT_OPACITY = 1;

function makeAuraTexture(hex: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.55)`);
  grad.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, 0.4)`);
  grad.addColorStop(0.75, `rgba(${r}, ${g}, ${b}, 0.18)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

interface ButtonDotProps {
  button: { id: string; color: string; isActive: boolean };
  position: [number, number, number];
  // Engineer view only: the matched operator button's current behaviorType.
  // Presence of this prop marks the button as an engineer button.
  matchedBehaviorType?: string;
  // Engineer view, stage 4 only: timestamp (ms) until which this color's flip
  // is on cooldown — dims the whole button while in the future.
  cooldownUntil?: number;
}

export const ButtonDot = ({ button, position, matchedBehaviorType, cooldownUntil }: ButtonDotProps) => {
  const hex = COLOR_MAP[button.color] ?? "#ffffff";
  const auraTexture = useMemo(() => makeAuraTexture(hex), [hex]);
  const shadowTexture = useMemo(() => makeShadowTexture(), []);
  const shadowPosition: [number, number, number] = [position[0] + 0.14, position[1] - 0.005, position[2] + 0.14];
  const highlightPosition: [number, number, number] = [position[0], position[1] + 0.01, position[2]];
  // Dim (turn-off cooldown) wedge sits just above the highlight; the reveal
  // (turn-on cooldown) wedge sits between the dim base and the highlight.
  const dimWedgePosition: [number, number, number] = [position[0], position[1] + 0.02, position[2]];
  const revealWedgePosition: [number, number, number] = [position[0], position[1] + 0.005, position[2]];

  // Operator: lit tracks isActive. Engineer: lit tracks matched operator's behaviorType.
  const isLit = matchedBehaviorType !== undefined
    ? matchedBehaviorType === "TOGGLE"
    : button.isActive;

  const mainMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const auraMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const dimWedgeMeshRef = useRef<THREE.Mesh>(null);
  const revealWedgeMeshRef = useRef<THREE.Mesh>(null);

  const baseEmissiveIntensity = isLit ? LIT_EMISSIVE_INTENSITY : UNLIT_EMISSIVE_INTENSITY;
  const baseOpacity = isLit ? LIT_OPACITY : UNLIT_OPACITY;

  useFrame(() => {
    const now = Date.now();
    const isLocked = !!cooldownUntil && now < cooldownUntil;
    // A flip always starts a cooldown, in either direction. isLit reflects the
    // post-flip state, so isLit here means the button was just activated
    // (dim base + bright reveal wedge); !isLit means it was just deactivated
    // (existing dim-further behavior, unchanged).
    const isRevealing = isLocked && isLit;
    const isDimming = isLocked && !isLit;

    if (mainMaterialRef.current) {
      if (isRevealing) {
        // Base appearance during the reveal sweep is the plain dim/unlit look.
        mainMaterialRef.current.emissiveIntensity = UNLIT_EMISSIVE_INTENSITY;
        mainMaterialRef.current.opacity = UNLIT_OPACITY;
      } else if (isDimming) {
        // Lighter dim than before — just enough that "locked" reads at a glance.
        mainMaterialRef.current.emissiveIntensity = baseEmissiveIntensity * 0.75;
        mainMaterialRef.current.opacity = baseOpacity * 0.85;
      } else {
        mainMaterialRef.current.emissiveIntensity = baseEmissiveIntensity;
        mainMaterialRef.current.opacity = baseOpacity;
      }
    }
    if (auraMaterialRef.current) {
      auraMaterialRef.current.opacity = isLocked ? 0.5 : 1;
    }

    const progress = cooldownUntil
      ? Math.min(1, Math.max(0, (COOLDOWN_DURATION_MS - (cooldownUntil - now)) / COOLDOWN_DURATION_MS))
      : 0;

    if (dimWedgeMeshRef.current) {
      if (isDimming) {
        const oldGeometry = dimWedgeMeshRef.current.geometry;
        dimWedgeMeshRef.current.geometry = new THREE.CircleGeometry(
          COOLDOWN_WEDGE_RADIUS, 32, -Math.PI / 2, progress * Math.PI * 2
        );
        oldGeometry.dispose();
        dimWedgeMeshRef.current.visible = true;
      } else {
        dimWedgeMeshRef.current.visible = false;
      }
    }

    if (revealWedgeMeshRef.current) {
      if (isRevealing) {
        const oldGeometry = revealWedgeMeshRef.current.geometry;
        revealWedgeMeshRef.current.geometry = new THREE.CircleGeometry(
          COOLDOWN_WEDGE_RADIUS, 32, -Math.PI / 2, progress * Math.PI * 2
        );
        oldGeometry.dispose();
        revealWedgeMeshRef.current.visible = true;
      } else {
        revealWedgeMeshRef.current.visible = false;
      }
    }
  });

  return (
    <>
      {/* Soft aura — radial gradient plane, additive blending, no hard edge */}
      {isLit && (
        <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.4, 2.4]} />
          <meshBasicMaterial
            ref={auraMaterialRef}
            map={auraTexture}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Drop shadow — soft dark radial plane, offset to one side, sitting just under the button */}
      <mesh position={shadowPosition} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.3, 1.3]} />
        <meshBasicMaterial
          map={shadowTexture}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Main button dot */}
      <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 32]} />
        <meshStandardMaterial
          ref={mainMaterialRef}
          color={hex}
          emissive={hex}
          emissiveIntensity={baseEmissiveIntensity}
          opacity={baseOpacity}
          transparent
        />
      </mesh>

      {/* Highlight — thin glossy arc hugging the upper-left edge, tapered to transparent at both tips */}
      {Array.from({ length: HIGHLIGHT_SEGMENT_COUNT }, (_, i) => {
        const segmentSpan = HIGHLIGHT_ARC_SPAN / HIGHLIGHT_SEGMENT_COUNT;
        const t = i / (HIGHLIGHT_SEGMENT_COUNT - 1);
        const opacity = Math.sin(t * Math.PI) * HIGHLIGHT_MAX_OPACITY;
        const thetaStart = HIGHLIGHT_ARC_CENTER - HIGHLIGHT_ARC_SPAN / 2 + i * segmentSpan;
        return (
          <mesh key={i} position={highlightPosition} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.4, 0.47, 8, 1, thetaStart, segmentSpan]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={opacity}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* Turn-off cooldown — dark wedge growing over the lit-then-dimmed button (unchanged) */}
      <mesh position={dimWedgePosition} rotation={[-Math.PI / 2, 0, 0]} ref={dimWedgeMeshRef} visible={false}>
        <circleGeometry args={[COOLDOWN_WEDGE_RADIUS, 32, -Math.PI / 2, 0]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.55} depthWrite={false} />
      </mesh>

      {/* Turn-on cooldown — bright lit-colored wedge revealing full brightness over the dim base */}
      <mesh position={revealWedgePosition} rotation={[-Math.PI / 2, 0, 0]} ref={revealWedgeMeshRef} visible={false}>
        <circleGeometry args={[COOLDOWN_WEDGE_RADIUS, 32, -Math.PI / 2, 0]} />
        <meshStandardMaterial
          color={hex}
          emissive={hex}
          emissiveIntensity={LIT_EMISSIVE_INTENSITY}
          opacity={LIT_OPACITY}
          transparent
        />
      </mesh>
    </>
  );
};
