import { Line } from "@react-three/drei";

interface WirePoint {
  x: number;
  y: number;
}

interface WireProps {
  points: WirePoint[];
  color: string;
  gridWidth: number;
  gridHeight: number;
  spacing: number;
}

const COLOR_MAP: Record<string, string> = {
  RED: "#f87171",
  GREEN: "#4ade80",
  BLUE: "#38bdf8",
  YELLOW: "#fbbf24",
  PURPLE: "#c084fc",
};

const MAX_GRID = 26;

export function Wire({ points, color, gridWidth, gridHeight, spacing }: WireProps) {
  if (points.length < 2) return null;

  const center = Math.floor(MAX_GRID / 2);
  const minX = center - Math.floor(gridWidth / 2);
  const minY = center - Math.floor(gridHeight / 2);
  const offsetX = (gridWidth - 1) / 2;
  const offsetY = (gridHeight - 1) / 2;

  const linePoints = points.map((p) => {
    const localX = p.x - minX;
    const localY = p.y - minY;
    return [
      (localX - offsetX) * spacing,
      -2.4,
      (localY - offsetY) * spacing,
    ];
  }) as [number, number, number][];

  return (
    <Line
      points={linePoints}
      color={COLOR_MAP[color] ?? "#ffffff"}
      lineWidth={5}
    />
  );
}