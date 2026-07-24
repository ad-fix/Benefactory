import { useEffect, useRef, useState } from "react";
import type * as Client from "colyseus.js";

interface RolesLevelMessagesProps {
  room: Client.Room | null;
}

/**
 * RolesLevelMessages — container for all on-screen messages specific to the
 * roles level. Each message type is its own component below; mount
 * additional ones here as they're introduced.
 */
export const RolesLevelMessages = ({ room }: RolesLevelMessagesProps) => {
  return (
    <>
      <StageCompleteMessage room={room} />
    </>
  );
};

type MessagePhase = "idle" | "entering" | "visible" | "exiting";
type FlashPhase = "idle" | "rising" | "peak" | "falling";

const FADE_IN_MS = 300;
const HOLD_MS = 1000;
const FADE_OUT_MS = 600;

const FLASH_RISE_MS = 150;
const FLASH_FALL_MS = 2000;
const FLASH_PEAK_OPACITY = 0.35;

function StageCompleteMessage({ room }: { room: Client.Room | null }) {
  const [phase, setPhase] = useState<MessagePhase>("idle");
  const [flashPhase, setFlashPhase] = useState<FlashPhase>("idle");
  const [completedStage, setCompletedStage] = useState(0);
  const prevStageRef = useRef<number | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafIdsRef = useRef<number[]>([]);
  // Bumped on every genuine stage increase. Deferred callbacks (rAF/timeout)
  // capture the id they were scheduled under and no-op if a newer trigger has
  // since started, so a stale callback from a superseded animation can never
  // corrupt the currently-playing one.
  const triggerIdRef = useRef(0);

  useEffect(() => {
    if (!room) return;

    const clearPending = () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      rafIdsRef.current.forEach(cancelAnimationFrame);
      rafIdsRef.current = [];
    };

    const checkStage = () => {
      const stage = room.state?.rolesLevel?.stage;
      if (typeof stage !== "number") return;

      if (prevStageRef.current === null) {
        prevStageRef.current = stage;
        return;
      }

      if (stage > prevStageRef.current) {
        const finishedStage = prevStageRef.current;
        prevStageRef.current = stage;
        clearPending();

        const triggerId = ++triggerIdRef.current;
        const isCurrent = () => triggerIdRef.current === triggerId;

        setCompletedStage(finishedStage);
        setPhase("entering");
        setFlashPhase("rising");

        // Double rAF lets the "entering"/"rising" (opacity 0) frame paint
        // before switching to "visible"/"peak", so the fade-in actually transitions.
        const raf1 = requestAnimationFrame(() => {
          const raf2 = requestAnimationFrame(() => {
            if (!isCurrent()) return;
            setPhase("visible");
            setFlashPhase("peak");
          });
          rafIdsRef.current.push(raf2);
        });
        rafIdsRef.current.push(raf1);

        timeoutsRef.current.push(
          setTimeout(() => { if (isCurrent()) setPhase("exiting"); }, FADE_IN_MS + HOLD_MS)
        );
        timeoutsRef.current.push(
          setTimeout(() => { if (isCurrent()) setPhase("idle"); }, FADE_IN_MS + HOLD_MS + FADE_OUT_MS)
        );
        timeoutsRef.current.push(
          setTimeout(() => { if (isCurrent()) setFlashPhase("falling"); }, FLASH_RISE_MS)
        );
        timeoutsRef.current.push(
          setTimeout(() => { if (isCurrent()) setFlashPhase("idle"); }, FLASH_RISE_MS + FLASH_FALL_MS)
        );
      } else {
        prevStageRef.current = stage;
      }
    };

    checkStage();
    room.onStateChange(checkStage);

    return clearPending;
  }, [room]);

  if (phase === "idle" && flashPhase === "idle") return null;

  const isExiting = phase === "exiting";
  const isFalling = flashPhase === "falling";

  return (
    <>
      {flashPhase !== "idle" && (
        <div
          className="pointer-events-none fixed inset-0 z-[69]"
          aria-hidden="true"
          style={{
            backgroundColor: "#39FF14",
            opacity: flashPhase === "peak" ? FLASH_PEAK_OPACITY : 0,
            transition: isFalling
              ? `opacity ${FLASH_FALL_MS}ms ease-in`
              : `opacity ${FLASH_RISE_MS}ms ease-out`,
          }}
        />
      )}
      {phase !== "idle" && (
        <div
          className="pointer-events-none fixed inset-0 z-[70] flex items-start justify-center overflow-hidden"
          style={{ paddingTop: "30vh" }}
          aria-live="assertive"
          role="status"
        >
          <h1
            className="font-sans font-black uppercase leading-none text-white"
            style={{
              fontSize: "clamp(1.5rem, 5vw, 3.25rem)",
              letterSpacing: "-0.02em",
              transformOrigin: "center",
              textShadow:
                "0 0 6px rgba(218, 236, 249, 0.8), 0 0 14px rgb(167, 216, 240), 0 0 24px rgb(59, 116, 141), 0 0 40px rgb(69, 103, 120)",
              transition: isExiting
                ? `opacity ${FADE_OUT_MS}ms ease-in, transform ${FADE_OUT_MS}ms ease-in`
                : `opacity ${FADE_IN_MS}ms ease-out, transform ${FADE_IN_MS}ms ease-out`,
              opacity: phase === "visible" ? 1 : 0,
              transform: isExiting ? "scale(1.3)" : "scale(1)",
            }}
          >
            Stage {completedStage} Complete
          </h1>
        </div>
      )}
    </>
  );
}
