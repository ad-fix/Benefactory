import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface InteractableItemProps {
  imageUrl: string;
  position: [number, number, number];
  size?: number;
  rotation?: [number, number, number];
  onInteract: () => void;
}

  export function InteractableItem({ imageUrl, position, size = 1.2, rotation = [-Math.PI / 2, 0, 0], onInteract }: InteractableItemProps) {
  const texture = useTexture(imageUrl);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 2) * 0.08;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[size * 0.20, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.20} depthWrite={false} />
      </mesh>

      <mesh
        rotation={rotation}
        position={[0, 0.03, 0]}
        scale={hovered ? 1.08 : 1}
        onClick={(e) => { e.stopPropagation(); onInteract(); }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}