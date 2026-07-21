import { useRef, useCallback, useState } from "react";

const SOUNDS = ["back", "click", "click2", "confirmation", "confirmation2", "conveyors", "door_close", "door_open", "drop", "fail1", "fail2", "mechanism", "mistake", "snip", "switch", "tick", "unlock"] as const;
type SoundName = (typeof SOUNDS)[number];

export const useSounds = () => {
  const audioRef = useRef<Record<SoundName, HTMLAudioElement> | null>(null);
  const volumeRef = useRef(0.25);
  const [sfxVolume, setSfxVolumeState] = useState(0.25);

  if (!audioRef.current) {
    audioRef.current = {
      back: new Audio("/sounds/back.ogg"),
      click: new Audio("/sounds/click.wav"),
      click2: new Audio("/sounds/click2.wav"),
      confirmation: new Audio("/sounds/confirmation.ogg"),
      confirmation2: new Audio("/sounds/confirmation2.wav"),
      conveyors: new Audio("/sounds/conveyors.wav"),
      door_close: new Audio("/sounds/door_close.mp3"),
      door_open: new Audio("/sounds/door_open.mp3"),
      drop: new Audio("/sounds/drop.ogg"),
      fail1: new Audio("/sounds/fail1.wav"),
      fail2: new Audio("/sounds/fail2.ogg"),
      mechanism: new Audio("/sounds/Mechanism.wav"),
      mistake: new Audio("/sounds/mistake.ogg"),
      snip: new Audio("/sounds/snip.mp3"),
      switch: new Audio("/sounds/switch.ogg"),
      tick: new Audio("/sounds/tick.wav"),
      unlock: new Audio("/sounds/unlock.wav"),
    };
    for (const sound of Object.values(audioRef.current)) {
      sound.preload = "auto";
    }
  }

  const play = useCallback((name: SoundName) => {
    const audio = audioRef.current![name];
    audio.volume = volumeRef.current;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);

  const setSfxVolume = useCallback((volume: number) => {
    volumeRef.current = volume;
    setSfxVolumeState(volume);
  }, []);

  return { play, sfxVolume, setSfxVolume };
};
