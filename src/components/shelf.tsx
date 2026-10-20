"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { GameCard } from "@/components/game-card";
import { gamesBySlugs } from "@/lib/catalog";

export function Shelf({
  eyebrow,
  title,
  blurb,
  slugs,
}: {
  eyebrow: string;
  title: string;
  blurb?: string;
  slugs: readonly string[];
}) {
  const items = gamesBySlugs(slugs);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            {eyebrow}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            {title}
          </h2>
          {blurb && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              {blurb}
            </p>
          )}
        </div>
        <Link
          href="/games/"
          className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-muted transition hover:border-primary/50 hover:text-ink active:scale-95"
        >
          View all
          <ArrowRight
            className="h-4 w-4 transition group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((game, i) => (
          <motion.div
            key={game.slug}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
          >
            <GameCard slug={game.slug} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
