import { useGLTF } from "@react-three/drei";

export function Level1Mesh() {
  const { scene } = useGLTF("/models/Level1.glb");
  return <primitive object={scene} position={[0, -2.5, 0]} scale={1} />;
}

useGLTF.preload("/models/Level1.glb");