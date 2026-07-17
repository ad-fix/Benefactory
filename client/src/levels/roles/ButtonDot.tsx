import { useMemo } from "react";
import * as THREE from "three";

const COLOR_MAP: Record<string, string> = {
  BLUE: "#38bdf8",
  YELLOW: "#fbbf24",
  RED: "#f87171",
  GREEN: "#4ade80",
};

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
}

export const ButtonDot = ({ button, position, matchedBehaviorType }: ButtonDotProps) => {
  const hex = COLOR_MAP[button.color] ?? "#ffffff";
  const auraTexture = useMemo(() => makeAuraTexture(hex), [hex]);

  // Operator: aura tracks isActive. Engineer: aura tracks matched operator's behaviorType.
  const showAura = matchedBehaviorType !== undefined
    ? matchedBehaviorType === "TOGGLE"
    : button.isActive;

  return (
    <>
      {/* Soft aura — radial gradient plane, additive blending, no hard edge */}
      {showAura && (
        <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.4, 2.4]} />
          <meshBasicMaterial
            map={auraTexture}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Main button dot */}
      <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 32]} />
        <meshStandardMaterial
          color={hex}
          emissive={hex}
          emissiveIntensity={button.isActive ? 1.5 : 0.15}
          opacity={button.isActive ? 1 : 0.45}
          transparent
        />
      </mesh>
    </>
  );
};
