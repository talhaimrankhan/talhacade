"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCard } from "@/components/game-card";
import { games, publishedCategories } from "@/lib/catalog";
import type { CategorySlug } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = CategorySlug | "all";
type Sort = "featured" | "az" | "za";

const PAGE_SIZE = 24;

const SORTS: { id: Sort; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "az", label: "A – Z" },
  { id: "za", label: "Z – A" },
];

const CATEGORY_NAMES: Record<string, string> = Object.fromEntries(
  publishedCategories.map((c) => [c.slug, c.name.toLowerCase()]),
);

export function CatalogGrid() {
  const params = useSearchParams();
  const cat = params.get("cat");
  const qParam = params.get("q");

  const startFilter: Filter =
    cat && publishedCategories.some((c) => c.slug === cat)
      ? (cat as Filter)
      : "all";

  const [filter, setFilter] = useState<Filter>(startFilter);
  const [query, setQuery] = useState(qParam ?? "");
  const [sort, setSort] = useState<Sort>("featured");
  const [shown, setShown] = useState(PAGE_SIZE);
  const searchRef = useRef<HTMLInputElement | null>(null);

  /** Keeps the URL shareable without a router round-trip. */
  const syncUrl = useCallback((nextFilter: Filter, nextQuery: string) => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams();
    if (nextFilter !== "all") sp.set("cat", nextFilter);
    const q = nextQuery.trim();
    if (q !== "") sp.set("q", q);
    const suffix = sp.toString();
    window.history.replaceState(
      null,
      "",
      suffix === "" ? "/games/" : `/games/?${suffix}`,
    );
  }, []);

  const visible = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = games.filter((g) => {
      if (filter !== "all" && g.category !== filter) return false;
      if (tokens.length === 0) return true;
      const haystack = [
        g.title,
        g.tagline,
        g.category,
        CATEGORY_NAMES[g.category] ?? "",
        ...g.tags,
      ]
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });

    if (sort === "az") {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sort === "za") {
      return [...filtered].sort((a, b) => b.title.localeCompare(a.title));
    }
    return filtered;
  }, [filter, query, sort]);

  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: `All · ${games.length}` },
    ...publishedCategories.map((c) => ({
      id: c.slug as Filter,
      label: `${c.name} · ${games.filter((g) => g.category === c.slug).length}`,
    })),
  ];

  const pickFilter = useCallback(
    (next: Filter) => {
      setFilter(next);
      setShown(PAGE_SIZE);
      syncUrl(next, query);
    },
    [query, syncUrl],
  );

  const typeQuery = useCallback(
    (next: string) => {
      setQuery(next);
      setShown(PAGE_SIZE);
      syncUrl(filter, next);
    },
    [filter, syncUrl],
  );

  const pickSort = useCallback((next: Sort) => {
    setSort(next);
    setShown(PAGE_SIZE);
  }, []);

  // "/" jumps to search from anywhere on the page.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const hidden = visible.length - Math.min(shown, visible.length);
  const counter =
    visible.length === games.length
      ? `${games.length} games`
      : `${visible.length} of ${games.length} games`;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full max-w-md">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => typeQuery(e.target.value)}
            placeholder="Search by title, tag or vibe…  (press /)"
            aria-label="Search games"
            className="w-full rounded-full border border-line bg-surface py-3 pl-11 pr-4 text-sm text-ink placeholder:text-muted focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </label>

        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest text-muted">
            {counter}
          </span>
          <div
            role="group"
            aria-label="Sort games"
            className="flex rounded-full border border-line bg-surface p-1"
          >
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pickSort(s.id)}
                aria-pressed={sort === s.id}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95",
                  sort === s.id
                    ? "bg-gradient-to-r from-violet-600 to-cyan-600 text-white"
                    : "text-muted hover:text-ink",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

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
