import { useEffect } from "react";

interface PopupProps {
  imageUrl: string;
  label: string;
  onClose: () => void;
}

export function InteractablePopup({ imageUrl, label, onClose }: PopupProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-black/80 rounded-lg p-4 flex items-center gap-3 animate-in fade-in">
      <img src={imageUrl} alt={label} className="w-16 h-16 object-contain" />
      <span className="text-white">{label}</span>
    </div>
  );
}