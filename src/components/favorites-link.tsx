"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useFavorites } from "@/lib/storage";

export function FavoritesLink() {
  const { favorites, ready } = useFavorites();
  const count = ready ? favorites.length : 0;

  return (
    <Link
      href="/favorites/"
      className="relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-ink"
    >
      <Heart className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Favorites</span>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-hot px-1 text-[10px] font-bold leading-none text-black">
          {count}
        </span>
      )}
    </Link>
  );
}
