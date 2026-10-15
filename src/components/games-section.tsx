"use client";

import { motion } from "framer-motion";
import { GameCard } from "@/components/game-card";
import { categories, games } from "@/lib/catalog";
import type { CategorySlug } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Filter = CategorySlug | "all";

export function GamesSection() {
  const [filter, setFilter] = useState<Filter>("all");

  const visible =
    filter === "all" ? games : games.filter((g) => g.category === filter);

  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: `All · ${games.length}` },
    ...categories.map((c) => ({
      id: c.slug as Filter,
      label: `${c.name} · ${games.filter((g) => g.category === c.slug).length}`,
    })),
  ];

  return (
    <div>
      <div className="mb-7 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
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

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((game, i) => (
          <motion.div
            key={game.slug}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: Math.min(i * 0.05, 0.3) }}
          >
            <GameCard slug={game.slug} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
