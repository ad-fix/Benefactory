import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface LevelMeshProps {
  url: string;
  position?: [number, number, number];
  scale?: number | [number, number, number];
  onClickNode?: (nodeName: string) => void;
}

export function LevelMesh({ url, position = [0, 0, 0], scale = 1, onClickNode }: LevelMeshProps) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  const generatorDoor = useMemo(() => clonedScene.getObjectByName("generator door"), [clonedScene]);

  useEffect(() => {
    return () => {
      clonedScene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
    };
  }, [clonedScene]);

  return (
    <primitive
      object={clonedScene}
      position={position}
      scale={scale}
      onClick={(e: any) => {
        if (!onClickNode) return;
        let obj = e.object;
        while (obj) {
          if (obj === generatorDoor) {
            e.stopPropagation();
            onClickNode("generator door");
            return;
          }
          obj = obj.parent;
        }
      }}
    />
  );
}