"use client";

import { Heart } from "lucide-react";
import { recordFavorite } from "@/lib/achievements";
import { sfx } from "@/lib/sfx";
import { useFavorites } from "@/lib/storage";
import { cn } from "@/lib/utils";

export function FavoriteButton({ slug, title }: { slug: string; title: string }) {
  const { isFavorite, toggle, ready } = useFavorites();
  const favorite = ready && isFavorite(slug);

  return (
    <button
      type="button"
      onClick={() => {
        const adding = !favorite;
        toggle(slug);
        // record after the toggle so the stored list is already updated.
        if (adding) {
          sfx.pop();
          recordFavorite();
        } else {
          sfx.click();
        }
      }}
      aria-pressed={favorite}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95",
        favorite
          ? "border-rose-500/60 bg-rose-500/15 text-rose-400"
          : "border-line bg-surface text-muted hover:border-primary/50 hover:text-ink",
      )}
    >
      <Heart
        className={cn("h-4 w-4 transition", favorite && "fill-rose-500 text-rose-500")}
        aria-hidden
      />
      {favorite ? "Favorited" : "Favorite"}
      <span className="sr-only">{title}</span>
    </button>
  );
}
