const COLOR_MAP: Record<string, string> = {
  BLUE: "#38bdf8",
  YELLOW: "#fbbf24",
  RED: "#f87171",
  GREEN: "#4ade80",
};

interface ButtonDotProps {
  button: { id: string; color: string; isActive: boolean };
  position: [number, number, number];
}

export const ButtonDot = ({ button, position }: ButtonDotProps) => {
  const hex = COLOR_MAP[button.color] ?? "#ffffff";

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.5, 32]} />
      <meshStandardMaterial
        color={hex}
        emissive={hex}
        emissiveIntensity={button.isActive ? 1.5 : 0.15}
        opacity={button.isActive ? 1 : 0.45}
        transparent
      />
    </mesh>
  );
};
