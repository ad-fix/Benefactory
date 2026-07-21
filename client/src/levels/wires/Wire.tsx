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
  WHITE: "#ffffff",
};

export function Wire({ points, color, gridWidth, gridHeight, spacing }: WireProps) {
  if (points.length < 2) return null;

  const linePoints = points.map((p) => [
    (p.x - (gridWidth - 1) / 2) * spacing,
    -2.4,
    (p.y - (gridHeight - 1) / 2) * spacing,
  ]) as [number, number, number][];

  return (
    <Line
      points={linePoints}
      color={COLOR_MAP[color] ?? "#ffffff"}
      lineWidth={5}
    />
  );
}