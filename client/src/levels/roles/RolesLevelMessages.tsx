import { useEffect, useRef, useState } from "react";
import { getStateCallbacks } from "colyseus.js";
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

const FADE_IN_MS = 300;
const HOLD_MS = 1000;
const FADE_OUT_MS = 600;
const MESSAGE_TOTAL_MS = FADE_IN_MS + HOLD_MS + FADE_OUT_MS;

const FLASH_RISE_MS = 150;
const FLASH_FALL_MS = 2000;
const FLASH_PEAK_OPACITY = 0.35;
const FLASH_TOTAL_MS = FLASH_RISE_MS + FLASH_FALL_MS;

interface StageTrigger {
  id: number;
  finishedStage: number;
}

/**
 * Detects genuine stage increases and mounts a fresh, self-contained
 * <StageCompleteFlash> for each one.
 *
 * Multiplayer reliability: this relies on Colyseus's own `.listen()` callback
 * (via getStateCallbacks) rather than a manually-tracked "previous stage" ref.
 * Colyseus's decoder is the single source of truth for the prior value, so
 * the very first genuine change after this listener attaches is always
 * caught correctly — regardless of when this client connected, when its
 * first state sync arrived, or how many unrelated state patches fired in
 * between. A ref-based baseline, by contrast, captures "whatever stage
 * happened to be current the first time this effect ran," which varies
 * per client and can miss or misfire depending on connection timing.
 */
function StageCompleteMessage({ room }: { room: Client.Room | null }) {
  const [trigger, setTrigger] = useState<StageTrigger | null>(null);
  const nextIdRef = useRef(0);

  useEffect(() => {
    if (!room) return;

    const callbacks = getStateCallbacks(room);
    const unlisten = callbacks(room.state).rolesLevel.listen(
      "stage",
      (value: number, previousValue: number) => {
        if (typeof previousValue !== "number" || value <= previousValue) return;
        setTrigger({ id: nextIdRef.current++, finishedStage: previousValue });
      }
    );

    return unlisten;
  }, [room]);

  return (
    <>
      {/* Keyframes are defined once, independent of any single trigger's mount/unmount. */}
      <style>{`
        @keyframes roles-stage-flash {
          0% { opacity: 0; animation-timing-function: ease-out; }
          ${(FLASH_RISE_MS / FLASH_TOTAL_MS) * 100}% { opacity: ${FLASH_PEAK_OPACITY}; animation-timing-function: ease-in; }
          100% { opacity: 0; }
        }
        @keyframes roles-stage-message {
          0% { opacity: 0; transform: scale(1); animation-timing-function: ease-out; }
          ${(FADE_IN_MS / MESSAGE_TOTAL_MS) * 100}% { opacity: 1; transform: scale(1); animation-timing-function: linear; }
          ${((FADE_IN_MS + HOLD_MS) / MESSAGE_TOTAL_MS) * 100}% { opacity: 1; transform: scale(1); animation-timing-function: ease-in; }
          100% { opacity: 0; transform: scale(1.3); }
        }
      `}</style>
      {trigger && (
        <StageCompleteFlash
          key={trigger.id}
          stage={trigger.finishedStage}
          onDone={() => setTrigger(null)}
        />
      )}
    </>
  );
}

/**
 * Fully self-contained: a fresh instance mounts per stage completion (keyed
 * by trigger id in the parent) and animates via pure CSS, so there's no
 * JS-timer/rAF choreography that can be left mid-flight by re-renders,
 * incoming state updates, or a backgrounded tab throttling timers. The
 * longer-running element (the flash) reports completion via the native
 * animationend event, which reliably fires once, unmounting this whole
 * subtree — nothing can get stuck "on".
 */
function StageCompleteFlash({ stage, onDone }: { stage: number; onDone: () => void }) {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[69]"
        aria-hidden="true"
        style={{
          backgroundColor: "#39FF14",
          animation: `roles-stage-flash ${FLASH_TOTAL_MS}ms linear forwards`,
        }}
        onAnimationEnd={onDone}
      />
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
            animation: `roles-stage-message ${MESSAGE_TOTAL_MS}ms linear forwards`,
          }}
        >
          Stage {stage} Complete
        </h1>
      </div>
    </>
  );
}
