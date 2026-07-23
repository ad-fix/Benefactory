import { useEffect } from "react";

export function useAmbientMusic(url: string, volume = 0.3) {
  useEffect(() => {
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = volume;
    audio.play().catch(() => {}); // ignore if browser blocks autoplay pre-interaction

    return () => {
      audio.pause();
    };
  }, [url, volume]);
}