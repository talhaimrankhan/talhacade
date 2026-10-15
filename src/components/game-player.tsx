"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

interface GameProps {
  /** Stable id used for persisting the player's best score. */
  gameId: string;
}

/**
 * Games are client-only (`ssr: false`): canvases, random boards and timers
 * have no business in the prerendered HTML — and random initial state would
 * otherwise cause hydration mismatches. Each game ships as its own chunk.
 */
const loaders: Record<string, () => Promise<{ default: ComponentType<GameProps> }>> = {
  snake: () => import("@/games/snake"),
  breakout: () => import("@/games/breakout"),
  "2048": () => import("@/games/game-2048"),
  minesweeper: () => import("@/games/minesweeper"),
  memory: () => import("@/games/memory"),
  tictactoe: () => import("@/games/tictactoe"),
  connect4: () => import("@/games/connect4"),
  reaction: () => import("@/games/reaction"),
  "whack-a-mole": () => import("@/games/whack-a-mole"),
};

function GameLoading() {
  return (
    <div className="grid min-h-[440px] place-items-center">
      <div className="text-center">
        <span
          className="inline-block h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <p className="mt-4 text-[11px] uppercase tracking-[0.3em] text-muted">
          Loading game…
        </p>
      </div>
    </div>
  );
}

/** Created once at module scope so component identities stay stable. */
const registry: Record<string, ComponentType<GameProps> | null> = {};
for (const [slug, loader] of Object.entries(loaders)) {
  registry[slug] = dynamic(loader, { ssr: false, loading: GameLoading });
}

export function GamePlayer({ slug }: { slug: string }) {
  const Game = registry[slug] ?? null;

  if (!Game) {
    return (
      <div className="grid min-h-[360px] place-items-center text-center">
        <div>
          <p className="text-4xl">🕹️</p>
          <p className="mt-3 text-sm text-muted">
            This game failed to load. Pick another one from the homepage.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[480px] items-center justify-center p-3 sm:p-6">
      <Game gameId={slug} />
    </div>
  );
}
