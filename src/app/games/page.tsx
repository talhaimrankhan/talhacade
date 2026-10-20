import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogGrid } from "@/components/catalog-grid";
import { games, site } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "All Games",
  description: `Browse all ${games.length} free browser games on ${site.name} — filter by genre or search by name. No signup, no downloads.`,
};

export default function GamesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
        The full arcade
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
        All {games.length} games
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
        Filter by genre or search by name — every title boots the moment you
        click it. No login wall, no installs, no waiting rooms.
      </p>

      <div className="mt-9">
        <Suspense
          fallback={<div className="h-64 animate-pulse rounded-2xl bg-surface" />}
        >
          <CatalogGrid />
        </Suspense>
      </div>
    </div>
  );
}
