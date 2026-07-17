import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

interface ConfirmationTileProps {
  position: [number, number, number];
}

export const ConfirmationTile = ({ position }: ConfirmationTileProps) => {
  const ringRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 5) * 0.12;
    ringRef.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={ringRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.38, 0.62, 48]} />
      <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={2.5} />
    </mesh>
  );
};
