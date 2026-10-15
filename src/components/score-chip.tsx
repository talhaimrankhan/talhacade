"use client";

import { Trophy } from "lucide-react";
import { formatBest, getGame } from "@/lib/catalog";
import { useBestScore } from "@/lib/storage";

export function ScoreChip({ slug }: { slug: string }) {
  const game = getGame(slug);
  const { best } = useBestScore(slug, game?.score?.mode ?? "high");

  if (!game?.score) return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn/10 px-3.5 py-1.5">
      <Trophy className="h-4 w-4 text-warn" aria-hidden />
      <span className="text-xs uppercase tracking-wider text-warn/90">
        {game.score.label}
      </span>
      <span className="font-mono text-sm font-bold text-ink">
        {formatBest(best, game)}
      </span>
    </div>
  );
}
