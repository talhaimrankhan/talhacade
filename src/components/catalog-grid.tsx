"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { GameCard } from "@/components/game-card";
import { games, publishedCategories } from "@/lib/catalog";
import type { CategorySlug } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = CategorySlug | "all";

const PAGE_SIZE = 24;

export function CatalogGrid() {
  const cat = useSearchParams().get("cat");

  const startFilter: Filter =
    cat && publishedCategories.some((c) => c.slug === cat)
      ? (cat as Filter)
      : "all";

  const [filter, setFilter] = useState<Filter>(startFilter);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter((g) => {
      if (filter !== "all" && g.category !== filter) return false;
      if (q === "") return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.tagline.toLowerCase().includes(q) ||
        g.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [filter, query]);

  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: `All · ${games.length}` },
    ...publishedCategories.map((c) => ({
      id: c.slug as Filter,
      label: `${c.name} · ${games.filter((g) => g.category === c.slug).length}`,
    })),
  ];

  const pickFilter = (next: Filter) => {
    setFilter(next);
    setShown(PAGE_SIZE);
  };

  const typeQuery = (next: string) => {
    setQuery(next);
    setShown(PAGE_SIZE);
  };

  const hidden = visible.length - Math.min(shown, visible.length);

  return (
    <div>
      <label className="relative block max-w-md">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => typeQuery(e.target.value)}
          placeholder="Search by title, tag or vibe…"
          className="w-full rounded-full border border-line bg-surface py-3 pl-11 pr-4 text-sm text-ink placeholder:text-muted focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
      </label>

      <div className="mb-7 mt-5 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => pickFilter(chip.id)}
            aria-pressed={filter === chip.id}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95",
              filter === chip.id
                ? "border-transparent bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-[0_0_24px_-10px_rgba(139,92,246,0.9)]"
                : "border-line bg-surface text-muted hover:border-primary/50 hover:text-ink",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          Nothing matches “{query}”. Try another word — or just hit
          {" "}
          <button
            type="button"
            onClick={() => typeQuery("")}
            className="font-semibold text-accent underline-offset-4 hover:underline"
          >
            clear the search
          </button>
          .
        </p>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {visible.slice(0, shown).map((game, i) => (
              <motion.div
                key={game.slug}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.28, delay: Math.min((i % PAGE_SIZE) * 0.03, 0.3) }}
              >
                <GameCard slug={game.slug} />
              </motion.div>
            ))}
          </div>

          {hidden > 0 && (
            <div className="mt-9 flex justify-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE_SIZE)}
                className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-7 py-3 text-sm font-bold text-white shadow-[0_0_30px_-10px_rgba(139,92,246,0.95)] transition hover:brightness-110 active:scale-95"
              >
                Show more · {hidden} left
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
