interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/75 backdrop-blur-[2px]">
      <div className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-5 rounded-none border border-solid border-white/20 bg-canvas/90 px-6 py-5">
        <p className="font-montreal text-sm font-semibold text-white">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-none border border-white/20 bg-white/5 px-4 py-2 text-xs uppercase tracking-wider text-slate-300 hover:bg-white/10">
            No
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-none border border-emerald-500/50 bg-emerald-950/50 px-4 py-2 text-xs uppercase tracking-wider text-emerald-300 hover:bg-emerald-900/60">
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}