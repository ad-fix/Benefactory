import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";

interface LevelMeshProps {
  url: string;
  position?: [number, number, number];
  scale?: number | [number, number, number];
  onClickNode?: (nodeName: string) => void;   // ← new
}

export function LevelMesh({ url, position = [0, 0, 0], scale = 1, onClickNode }: LevelMeshProps) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  const generatorDoor = useMemo(() => clonedScene.getObjectByName("generator door"), [clonedScene]);

  return (
    <primitive
      object={clonedScene}
      position={position}
      scale={scale}
      onClick={(e: any) => {
        if (!onClickNode) return;
        // Walk up from whatever was actually clicked to see if it's the door (or a child of it)
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