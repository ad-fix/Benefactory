interface WiresLevelViewProps {
  room: any;
}

export const WiresLevelView = ({ room: _room }: WiresLevelViewProps) => {
  if (!import.meta.env.DEV) return null;

  return (
    <div
      className="fixed bottom-3 right-3 z-[100] flex gap-1.5 rounded-lg border border-white/10 bg-black/85 px-2 py-1 text-[10px] text-white"
      data-ui="dev-wires-controls"
    >
      Wires Level (dev)
    </div>
  );
};