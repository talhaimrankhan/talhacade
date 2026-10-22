"use client";

import { CalendarDays, Flame, Play } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ShareButton } from "@/components/share-button";
import { useProgress } from "@/lib/achievements";
import { getCategory, site } from "@/lib/catalog";
import { dailyGame, dailyNumber, dayKey } from "@/lib/daily";

/**
 * "Today" as an external store: the static shell renders a same-size
 * skeleton (build-time HTML knows nothing about the viewing date), the
 * client fills in the real pick after hydration, and a timer re-reads when
 * the calendar day flips so a parked homepage rolls over at midnight.
 */
function msUntilTomorrow(): number {
  const now = new Date();
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    2,
  );
  return next.getTime() - now.getTime();
}

function subscribeDate(onChange: () => void): () => void {
  const timer = window.setTimeout(onChange, msUntilTomorrow());
  return () => window.clearTimeout(timer);
}

/**
 * Today's Challenge banner — one featured game per calendar day with the
 * player's streak and a one-tap share card.
 */
export function DailyChallenge() {
  const progress = useProgress();
  const today = useSyncExternalStore<string | null>(
    subscribeDate,
    () => dayKey(),
    () => null,
  );

  if (today === null) {
    return (
      <section
        aria-hidden
        className="panel min-h-[110px] animate-pulse px-6 py-5"
      />
    );
  }

  const game = dailyGame(today);
  const number = dailyNumber(today);
  const category = getCategory(game.category);
  const completed = progress.daily.day === today;
  const streak = progress.daily.streak;

  const shareText = [
    `🕹️ Talhacade Daily #${number} — ${game.title}`,
    streak > 0 ? `🔥 ${streak}-day streak` : "",
    `Beat my run: ${site.url}/games/${game.slug}/`,
    `Play free, no signup: ${site.url}/`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <section aria-label="Daily challenge" className="panel relative overflow-hidden px-6 py-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-violet-600/30 to-cyan-600/30 blur-2xl"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-accent">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Today&apos;s challenge · Daily #{number}
          </p>
          <h2 className="mt-2 font-display text-xl font-bold sm:text-2xl">
            {game.title}
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            {category?.name ?? game.category} · {game.tagline}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="text-right">
            <p className="flex items-center justify-end gap-1 font-display text-lg font-bold">
              <Flame
                className={`h-4 w-4 ${streak > 0 ? "text-orange-400" : "text-muted"}`}
                aria-hidden
              />
              {streak} day{streak === 1 ? "" : "s"}
            </p>
            <p className="text-[11px] uppercase tracking-widest text-muted">
              {completed
                ? "done today ✓"
                : progress.daily.best > 0
                  ? `best ${progress.daily.best}`
                  : "starts today"}
            </p>
          </div>
          <Link
            href={`/games/${game.slug}/`}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_30px_-10px_rgba(139,92,246,0.95)] transition hover:brightness-110 active:scale-95"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden />
            Play
          </Link>
          {completed && <ShareButton text={shareText} label="Share" />}
        </div>
      </div>
    </section>
  );
}
