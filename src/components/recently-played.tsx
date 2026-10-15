"use client";

import { GameCard } from "@/components/game-card";
import { getGame } from "@/lib/catalog";
import { useRecent } from "@/lib/storage";

export function RecentlyPlayed() {
  const { recent } = useRecent();
  const slugs = recent.filter((slug) => getGame(slug)).slice(0, 4);

  if (slugs.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            Saved in this browser
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            Jump back in
          </h2>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {slugs.map((slug) => (
          <GameCard key={slug} slug={slug} />
        ))}
      </div>
    </section>
  );
}
