"use client";

import { Heart, Keyboard, MousePointer2, Play, Smartphone } from "lucide-react";
import Link from "next/link";
import { categories, formatBest, getGame } from "@/lib/catalog";
import { useBestScore, useFavorites } from "@/lib/storage";
import { cn } from "@/lib/utils";

const inputIcon = {
  keyboard: Keyboard,
  mouse: MousePointer2,
  touch: Smartphone,
} as const;

export function GameCard({ slug }: { slug: string }) {
  const game = getGame(slug);
  const { isFavorite, toggle, ready } = useFavorites();
  const { best } = useBestScore(slug, game?.score?.mode ?? "high");

  if (!game) return null;

  const category = categories.find((c) => c.slug === game.category);
  const favorite = ready && isFavorite(slug);

  return (
    <div className="group relative">
      <Link
        href={`/games/${game.slug}/`}
        className="block overflow-hidden rounded-2xl border border-line bg-surface transition duration-300 hover:-translate-y-1.5 hover:border-primary/60 hover:shadow-[0_24px_54px_-26px_rgba(139,92,246,0.95)]"
      >
        <div
          className={cn(
            "scanlines relative aspect-[16/10] overflow-hidden bg-gradient-to-br",
            game.cover.gradient,
          )}
        >
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-6xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)] transition duration-300 group-hover:-rotate-6 group-hover:scale-125">
              {game.cover.emoji}
            </span>
          </div>

          <span className="absolute left-3 top-3 rounded-full border border-white/25 bg-black/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
            {category?.name}
          </span>

          <div className="absolute inset-0 hidden items-center justify-center bg-black/50 opacity-0 backdrop-blur-[2px] transition duration-300 group-hover:opacity-100 sm:flex">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black shadow-lg">
              <Play className="h-4 w-4 fill-black" aria-hidden />
              Play now
            </span>
          </div>
        </div>

        <div className="p-4">
          <h3 className="font-display font-semibold tracking-wide text-ink transition group-hover:text-white">
            {game.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-sm text-muted">{game.tagline}</p>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-muted">
              {game.input.map((input) => {
                const Icon = inputIcon[input];
                return (
                  <span key={input} title={input} className="grid place-items-center">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                );
              })}
            </div>
            {game.score && (
              <span className="font-mono text-[11px] text-muted">
                <span className="uppercase tracking-wider">Best </span>
                <span className="text-accent">{formatBest(best, game)}</span>
              </span>
            )}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => toggle(slug)}
        aria-label={
          favorite ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`
        }
        aria-pressed={favorite}
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-sm transition hover:scale-110 active:scale-90"
      >
        <Heart
          className={cn(
            "h-4 w-4 transition",
            favorite ? "fill-rose-500 text-rose-500" : "text-white",
          )}
          aria-hidden
        />
      </button>
    </div>
  );
}
