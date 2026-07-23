import { useMemo } from "react";
import * as THREE from "three";
import { getPlayerPalette, toUpperId, type PlayerColorLower } from "@/constants/playerColors";

interface OperatorGhostProps {
  color: PlayerColorLower;
  position: [number, number, number];
  hexOverride?: string;
}

// Monitor-only onion-skin echo of the Operator's live position (stage 4).
// Heavily transparent/desaturated so it reads as a spectral marker, not a real player.
export const OperatorGhost = ({ color, position, hexOverride }: OperatorGhostProps) => {
  const hex = useMemo(() => {
    const main = hexOverride ? new THREE.Color(hexOverride) : new THREE.Color(getPlayerPalette(toUpperId(color)).main);
    return `#${main.lerp(new THREE.Color("#8a8f98"), 0.6).getHexString()}`;
  }, [color, hexOverride]);

  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshBasicMaterial color={hex} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.64, 32]} />
        <meshBasicMaterial color={hex} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
};