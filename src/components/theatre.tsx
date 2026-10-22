"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/**
 * Focus ("theatre") mode: hides the site chrome and the page extras so only
 * the game frame is left, and asks the browser for real fullscreen. Esc (or
 * any browser-initiated exit) unwinds both, and leaving the page clears the
 * body flag so the next page renders normally.
 */
export function TheatreToggle() {
  const [active, setActive] = useState(false);

  const enter = useCallback(() => {
    setActive(true);
    document.body.dataset.focus = "on";
    document
      .getElementById("game-frame")
      ?.requestFullscreen?.()
      .catch(() => undefined); // Focus mode works without fullscreen too.
  }, []);

  const exit = useCallback(() => {
    setActive(false);
    delete document.body.dataset.focus;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  // Browser-side exits (Esc, headset menu, ...) must sync state back.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        setActive(false);
        delete document.body.dataset.focus;
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      // Route change: never leak the hidden chrome onto the next page.
      delete document.body.dataset.focus;
    };
  }, []);

  return (
    <button
      type="button"
      onClick={active ? exit : enter}
      aria-pressed={active}
      title={active ? "Exit focus mode (Esc)" : "Focus mode"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition active:scale-95 ${
        active
          ? "border-transparent bg-gradient-to-r from-violet-600 to-cyan-600 text-white"
          : "border-line bg-surface text-muted hover:border-primary/50 hover:text-ink"
      }`}
    >
      {active ? (
        <Minimize2 className="h-3 w-3" aria-hidden />
      ) : (
        <Maximize2 className="h-3 w-3" aria-hidden />
      )}
      {active ? "Exit" : "Focus"}
    </button>
  );
}
