import { useGLTF } from "@react-three/drei";

interface LevelMeshProps {
  url: string;
  position?: [number, number, number];
  scale?: number | [number, number, number];
}

export function LevelMesh({ url, position = [0, 0, 0], scale = 1 }: LevelMeshProps) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} position={position} scale={scale} />;
}