export type WireColor = "purple" | "red" | "green" | "yellow" | "blue";

const WIRE_COLORS: { color: WireColor; hex: string }[] = [
  { color: "purple", hex: "#a855f7" },
  { color: "red", hex: "#ef4444" },
  { color: "green", hex: "#22c55e" },
  { color: "yellow", hex: "#eab308" },
  { color: "blue", hex: "#3b82f6" },
];

interface WireSelectionModalProps {
  hasWirecutter: boolean;
  onSelectWire: (color: WireColor) => void;
  onClose: () => void;
}

export function WireSelectionModal({ hasWirecutter, onSelectWire, onClose }: WireSelectionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/75 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <div className="relative flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-5 rounded-none border border-solid border-white/20 bg-canvas/90 px-6 py-5">
        <p className="font-sans text-sm font-semibold text-white">
          {hasWirecutter ? "Cut a wire" : "You need a wirecutter to cut a wire"}
        </p>
        {hasWirecutter && (
          <div className="grid grid-cols-5 gap-3">
            {WIRE_COLORS.map((wire) => (
              <button
                key={wire.color}
                onClick={() => onSelectWire(wire.color)}
                className="h-12 w-full rounded-none border border-white/20 transition-transform hover:scale-105"
                style={{ backgroundColor: wire.hex }}
                aria-label={`Cut the ${wire.color} wire`}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-1 flex h-10 w-full items-center justify-center rounded-none border border-white/20 font-montreal text-xs uppercase tracking-wider text-slate-300 hover:bg-white/[0.07]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}