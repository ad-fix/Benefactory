export interface LevelMeshConfig {
  url: string;
  position?: [number, number, number];
  scale?: number | [number, number, number];
}

export const LEVEL_MESHES: Record<string, LevelMeshConfig> = {
  level1: { url: "/models/Level1.glb", position: [0.15, -2.5, 2.2] },
  // wires:
  conveyor: { url: "/models/ConveyorLevel.glb", position: [0, -2.5, 0] },
  roles: { url: "/models/RolesLevel.glb", position: [0.001, -2.5, 0.025] },
};