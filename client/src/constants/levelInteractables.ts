export interface InteractableConfig {
  id: string;
  imageUrl: string;
  label: string;
  gridX: number;
  gridY: number;
  size?: number;
}

export const LEVEL_INTERACTABLES: Record<string, Record<number, InteractableConfig[]>> = {
  level1: {
    1: [
      { id: "bomb", imageUrl: "/images/bomb.png", label: "The bomb — still ticking. Tools are needed to cut the wires...", gridX: 3.7, gridY: 3.1, size: 4 },
      { id: "note", imageUrl: "/images/found-note.png", label: "A hastily scrawled note.", gridX: 1, gridY: 0.3, size: 1.8 },
    ],
      // { id: "wirecutter-blue", imageUrl: "/images/wirecutter-blue.png", label: "Blue wirecutter", gridX: 1, gridY: 1 },
      // { id: "wirecutter-green", imageUrl: "/images/wirecutter-green.png", label: "Green wirecutter", gridX: 8, gridY: 6 },
  },
  roles: {
    4: [
      { id: "wirecutter-red", imageUrl: "/images/wirecutter-red.png", label: "Red wirecutter", gridX: 6, gridY: 2 },
    ]
  }
  // test that interactable only appears in stage four (after completion), and is on right gridspace
  // add conveyor level and interactable
};
