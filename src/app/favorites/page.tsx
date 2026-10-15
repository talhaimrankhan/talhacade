import type { Metadata } from "next";
import { FavoritesGrid } from "@/components/favorites-grid";

export const metadata: Metadata = {
  title: "Your Favorites",
  description:
    "Games you've hearted in this browser. Stored locally — no account, no sync, no servers.",
};

export default function FavoritesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
        Saved in this browser
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
        Your favorites
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Hearted games live in this browser&apos;s storage only — nothing is
        uploaded anywhere. Clearing your browser data clears this list.
      </p>

      <div className="mt-9">
        <FavoritesGrid />
      </div>
    </div>
  );
}
