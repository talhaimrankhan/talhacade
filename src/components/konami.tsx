"use client";

import { useEffect } from "react";
import { unlockAchievement } from "@/lib/achievements";

const CODE = [
  "arrowup",
  "arrowup",
  "arrowdown",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "arrowleft",
  "arrowright",
  "b",
  "a",
];

/**
 * The Konami code, unlocked as the "8-Bit Legend" badge. The toast and
 * confetti ride the existing `talhacade:achievement` event, so this only
 * has to notice the sequence and stamp the badge once.
 */
export function KonamiListener() {
  useEffect(() => {
    let index = 0;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      index = key === CODE[index] ? index + 1 : key === CODE[0] ? 1 : 0;
      if (index === CODE.length) {
        index = 0;
        unlockAchievement("konami");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
