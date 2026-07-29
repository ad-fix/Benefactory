import { useEffect, useRef } from "react";

interface PopupProps {
  imageUrl?: string;
  label: string;
  onClose: () => void;
}

export function InteractablePopup({ imageUrl, label, onClose }: PopupProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), 3000);
    return () => clearTimeout(timer);
  }, []); // empty array — only runs once, when this popup instance first mounts

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-black/80 rounded-lg p-4 flex items-center gap-3 animate-in fade-in">
      {imageUrl && <img src={imageUrl} alt={label} className="w-16 h-16 object-contain" />}
      <span className="text-white">{label}</span>
    </div>
  );
}