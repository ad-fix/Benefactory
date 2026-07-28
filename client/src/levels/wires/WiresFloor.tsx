import { useState } from "react";
import type * as Client from "colyseus.js";
import { Wire } from "./Wire";

interface WiresFloorProps {
  room: Client.Room | null;
  gridWidth: number;
  gridHeight: number;
  spacing: number;
  endpoints: { id: string; x: number; y: number; color: string }[];
}

const MAX_GRID = 26;

export function WiresFloor({ room, gridWidth, gridHeight, spacing, endpoints }: WiresFloorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pathPoints, setPathPoints] = useState<{ x: number; y: number }[]>([]);
  const [pathColor, setPathColor] = useState("#ffffff");

  const toAbsolute = (localX: number, localZ: number) => {
    const center = Math.floor(MAX_GRID / 2);
    const halfWidth = Math.floor(gridWidth / 2);
    const halfHeight = Math.floor(gridHeight / 2);
    const minX = center - halfWidth;
    const minY = center - halfHeight;
    return { x: localX + minX, y: localZ + minY };
  };

  const toLocalCell = (worldX: number, worldZ: number) => {
    const offsetX = (gridWidth - 1) / 2;
    const offsetZ = (gridHeight - 1) / 2;
    return {
      x: Math.round(worldX / spacing + offsetX),
      z: Math.round(worldZ / spacing + offsetZ),
    };
  };

  return (
  <>
    <mesh
      position={[0, -2.55, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(e) => {
        const { x: gridX, z: gridZ } = toLocalCell(e.point.x, e.point.z);
        const abs = toAbsolute(gridX, gridZ);

        const endpoint = endpoints.find((ep) => ep.x === abs.x && ep.y === abs.y);
        if (!endpoint) return;

        setPathColor(endpoint.color);
        setIsDragging(true);
        setPathPoints([{ x: gridX, y: gridZ }]);
      }}
      onPointerMove={(e) => {
        if (!isDragging) return;
        const { x: gridX, z: gridZ } = toLocalCell(e.point.x, e.point.z);

        setPathPoints((prev) => {
          const last = prev[prev.length - 1];
          if (!last) return prev;
          const dx = Math.abs(gridX - last.x);
          const dz = Math.abs(gridZ - last.y);
          if (dx === 0 && dz === 0) return prev;
          const isOrthogonal = (dx === 1 && dz === 0) || (dx === 0 && dz === 1);
          if (!isOrthogonal) return prev;

          const newPath = [...prev, { x: gridX, y: gridZ }];

          const absPoints = newPath.map((p) => toAbsolute(p.x, p.y));
          room?.send("dragProgress", { color: pathColor, points: absPoints });

          return newPath;

        });
      }}
      onPointerUp={() => {
        if (pathPoints.length > 1) {
          const absPoints = pathPoints.map((p) => toAbsolute(p.x, p.y));
          room?.send("drawWire", { color: pathColor, points: absPoints });
        }
        room?.send("dragEnd", {});
        setIsDragging(false);
        setPathPoints([]);
      }}
    >
      <planeGeometry args={[gridWidth * spacing, gridHeight * spacing]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>

    {pathPoints.length > 1 && (
      <Wire
        points={pathPoints.map((p) => {
          const center = Math.floor(26 / 2);
          const minX = center - Math.floor(gridWidth / 2);
          const minY = center - Math.floor(gridHeight / 2);
          return { x: p.x + minX, y: p.y + minY };
        })}
        color={pathColor}
        gridWidth={gridWidth}
        gridHeight={gridHeight}
        spacing={spacing}
      />
    )}
  </>
);
}