import { useEffect } from "react";
import type * as Client from "colyseus.js";

interface RolesLevelViewProps {
  role: string;
  room: Client.Room | null;
}

const STAGES = [1, 2, 3, 4] as const;
const SHIFT_DIGIT_RE = /^Digit([1-4])$/;

// Role-specific views mount here as the level is implemented.
export const RolesLevelView = ({ role: _role, room }: RolesLevelViewProps) => {
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.shiftKey) return;
      const match = SHIFT_DIGIT_RE.exec(e.code);
      if (!match) return;
      e.preventDefault();
      room?.send("devSetStage", { stage: Number(match[1]) });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [room]);

  if (!import.meta.env.DEV) return null;

  return (
    <div
      className="fixed bottom-3 right-3 z-[100] flex gap-1.5 rounded-lg border border-white/10 bg-black/85 p-2 backdrop-blur-sm"
      data-ui="dev-roles-stage-controls"
    >
      {STAGES.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => room?.send("devSetStage", { stage: n })}
          className="rounded border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-white/20"
          title={`Jump to stage ${n} (Shift+${n})`}
        >
          Stage {n}
        </button>
      ))}
    </div>
  );
};
