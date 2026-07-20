import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

const COLOR_MAP: Record<string, string> = {
  BLUE: "#38bdf8",
  YELLOW: "#fbbf24",
  RED: "#f87171",
  GREEN: "#4ade80",
};

interface GhostButtonProps {
  color: string;
  position: [number, number, number];
  relocateAt: number;
}

// Monitor-only spectral echo of an Operator button (stage 4): outline-only
// ring plus a live countdown to relocateAt. A button whose deadline keeps
// getting pushed forward (still active) will show a refreshing full count.
export const GhostButton = ({ color, position, relocateAt }: GhostButtonProps) => {
  const hex = COLOR_MAP[color] ?? "#ffffff";
  const labelRef = useRef<HTMLDivElement>(null);

  useFrame(() => {
    if (!labelRef.current) return;
    const secondsLeft = Math.max(0, Math.ceil((relocateAt - Date.now()) / 1000));
    labelRef.current.textContent = `${secondsLeft}s`;
  });

  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.5, 32]} />
        <meshBasicMaterial color={hex} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <Html position={[0, 0, -1.1]} center zIndexRange={[0, 0]} occlude={false}>
        <div
          ref={labelRef}
          className="pointer-events-none select-none whitespace-nowrap font-montreal text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: hex, textShadow: "0 0 4px rgba(0,0,0,0.85)" }}
        />
      </Html>
    </group>
  );
};
