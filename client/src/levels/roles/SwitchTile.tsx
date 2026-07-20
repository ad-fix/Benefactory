interface SwitchTileProps {
  position: [number, number, number];
}

export const SwitchTile = ({ position }: SwitchTileProps) => (
  <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
    <circleGeometry args={[0.5, 32]} />
    <meshStandardMaterial color="#e5e7eb" emissive="#e5e7eb" emissiveIntensity={0.8} />
  </mesh>
);
