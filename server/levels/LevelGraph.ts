export interface DoorZone {
  tiles: { x: number; y: number }[];        // trigger tiles, in the CURRENT level's room-local coordinates
  targetLevelId: string;
  spawnZone: { x: number; y: number }[];    // where players land, in the TARGET level's room-local coordinates
  requiresCompletion?: boolean;              // current level must be solved to use this door
}

export const LEVEL_GRAPH: Record<string, DoorZone[]> = {
  level1: [
    {
      tiles: [{ x: 4, y: 0 }, { x: 5, y: 0 }],       // the real two doorway tiles
      targetLevelId: "roles",
      spawnZone: [{ x: 4, y: 7 }, { x: 5, y: 6 }],   // one row inside Roles, away from its own doors
      requiresCompletion: true,
    },
  ],
  roles: [
    {
      tiles: [{ x: 4, y: 0 }, { x: 5, y: 0 }],       // the real two doorway tiles to Conveyor
      targetLevelId: "conveyor",
      spawnZone: [{ x: 0, y: 1 }, { x: 1, y: 1 }],   // TODO: real Conveyor entry, away from Conveyor's own door
      requiresCompletion: true,
    },
    {
      tiles: [{ x: 4, y: 7 }, { x: 5, y: 7 }],       // the real two doorway tiles back to Level1
      targetLevelId: "level1",
      spawnZone: [{ x: 4, y: 1 }, { x: 5, y: 1 }],   // inside Level1, NOT the {4,0}/{5,0} doorway
    },
  ],
  conveyor: [
    {
      tiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }],       // the real two doorway tiles back to Roles
      targetLevelId: "roles",
      spawnZone: [{ x: 4, y: 1 }, { x: 5, y: 1 }],   // TODO: real return spot in Roles, away from BOTH of its doors
      requiresCompletion: true,
    },
  ],
};