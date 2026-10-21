"use client";

import { Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { games } from "@/lib/catalog";
import { sfx } from "@/lib/sfx";

export function RandomButton() {
  const router = useRouter();

  const surprise = useCallback(() => {
    sfx.pop();
    const game = games[Math.floor(Math.random() * games.length)];
    router.push(`/games/${game.slug}/`);
  }, [router]);

  return (
    <button
      type="button"
      onClick={surprise}
      className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-3 py-2 text-sm font-semibold text-white shadow-[0_0_22px_-8px_rgba(139,92,246,0.9)] transition hover:brightness-110 active:scale-95 sm:px-4"
      aria-label="Surprise me — play a random game"
    >
      <Shuffle className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Surprise me</span>
    </button>
  );
}
