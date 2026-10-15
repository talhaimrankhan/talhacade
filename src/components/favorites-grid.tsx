"use client";

import { Heart, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { GameCard } from "@/components/game-card";
import { getGame } from "@/lib/catalog";
import { useFavorites } from "@/lib/storage";

export function FavoritesGrid() {
  const { favorites, ready } = useFavorites();

  if (!ready) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-2xl border border-line bg-surface"
          />
        ))}
      </div>
    );
  }

  const slugs = favorites.filter((slug) => getGame(slug));

  if (slugs.length === 0) {
    return (
      <div className="panel grid place-items-center px-6 py-16 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface-2">
          <Heart className="h-7 w-7 text-muted" aria-hidden />
        </span>
        <h2 className="mt-5 font-display text-xl font-bold">No favorites yet</h2>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Tap the heart on any game and it will live here — stored only in this
          browser, no account required.
        </p>
        <Link
          href="/#games"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-95"
        >
          <Gamepad2 className="h-4 w-4" aria-hidden />
          Find a game
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {slugs.map((slug) => (
        <GameCard key={slug} slug={slug} />
      ))}
    </div>
  );
}
