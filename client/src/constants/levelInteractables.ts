export interface InteractableConfig {
  id: string;
  imageUrl: string;
  label: string;
  gridX: number;
  gridY: number;
  size?: number;
  pickup?: "red" | "blue" | "green";
  unlockStage?: number;
  requiresLevelComplete?: boolean;
}

export const LEVEL_INTERACTABLES: Record<string, InteractableConfig[]> = {
  level1: [
    { id: "bomb", imageUrl: "/images/bomb.png", label: "The bomb — still ticking. Tools are needed to cut the wires...", gridX: 3.7, gridY: 3.1, size: 4 },
    { id: "note", imageUrl: "/images/found-note.png", label: "A hastily scrawled note.", gridX: 1, gridY: 0.3, size: 1.8 },
  ],
  roles: [
    { id: "wirecutter-blue", imageUrl: "/images/wirecutters-blue.png", label: "A blue wirecutter. It's rusty - probably good for only one use.", gridX: 4, gridY: 1, size: 2.5, pickup: "blue", unlockStage: 2 },
    { id: "wirecutter-red", imageUrl: "/images/wirecutters-red.png", label: "A red wirecutter. It's rusty - probably good for only one use.", gridX: 5, gridY: 1, size: 2.5, pickup: "red", requiresLevelComplete: true },
  ],
  conveyor: [
     { id: "wirecutter-green", imageUrl: "/images/wirecutters-green.png", label: "A green wirecutter. It's rusty - probably good for only one use.", gridX: 12, gridY: 25, size: 2.5, pickup: "green", requiresLevelComplete: true },
   ],
};