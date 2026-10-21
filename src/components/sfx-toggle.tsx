"use client";

import { Volume2, VolumeX } from "lucide-react";
import { setSfxEnabled, useSfxEnabled } from "@/lib/sfx";

/** Header speaker toggle — persists across visits and tabs. */
export function SfxToggle() {
  const enabled = useSfxEnabled();

  return (
    <button
      type="button"
      onClick={() => setSfxEnabled(!enabled)}
      aria-pressed={enabled}
      aria-label={enabled ? "Mute sound effects" : "Unmute sound effects"}
      title={enabled ? "Sound on" : "Sound off"}
      className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:border-primary/50 hover:text-ink active:scale-95"
    >
      {enabled ? (
        <Volume2 className="h-4 w-4" aria-hidden />
      ) : (
        <VolumeX className="h-4 w-4 line-through" aria-hidden />
      )}
    </button>
  );
}
