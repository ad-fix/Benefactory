import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

interface ClickHandlerProps {
  spacing: number;
  onPing: (x: number, y: number) => void;
  gridWidth: number;
  gridHeight: number;
}

export const ClickHandler = ({ spacing, onPing, gridWidth, gridHeight }: ClickHandlerProps) => {
  const { camera, gl } = useThree();

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;

      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 2.5);
      const intersection = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, intersection)) {
        onPing(intersection.x, intersection.z);
      }
    };

    const canvas = gl.domElement;
    canvas.addEventListener("mousedown", handleMouseDown);
    return () => canvas.removeEventListener("mousedown", handleMouseDown);
  }, [camera, gl, onPing, gridWidth, gridHeight, spacing]);

  return null;
};
