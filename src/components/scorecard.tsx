"use client";

import {
  Award,
  Compass,
  Gamepad2,
  Heart,
  History,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import {
  ACHIEVEMENTS,
  useProgress,
  type Achievement,
  type Progress,
} from "@/lib/achievements";
import { GameCard } from "@/components/game-card";
import {
  formatBest,
  games,
  getCategory,
  getGame,
  publishedCategories,
} from "@/lib/catalog";
import { useFavorites, useRecent } from "@/lib/storage";
import type { Game } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_BESTS = 12;

interface BestRow {
  slug: string;
  entry: Progress["bests"][string];
  game: Game;
}

function StatTile({ label, value, icon: Icon }: {
  label: string;
  value: string;
  icon: typeof Gamepad2;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
          {label}
        </p>
        <Icon className="h-4 w-4 text-muted" aria-hidden />
      </div>
      <p className="mt-2 font-display text-3xl font-bold text-gradient sm:text-4xl">
        {value}
      </p>
    </div>
  );
}

function AchievementTile({ achievement, unlockedAt }: {
  achievement: Achievement;
  unlockedAt: number | undefined;
}) {
  const locked = unlockedAt === undefined;

  return (
    <div
      className={cn(
        "panel relative flex items-start gap-3 p-4",
        locked && "opacity-40 grayscale",
      )}
    >
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 text-xl">
        <span aria-hidden>{achievement.icon}</span>
        {locked && (
          <span
            aria-hidden
            className="absolute -bottom-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full border border-line bg-surface text-[10px]"
          >
            🔒
          </span>
        )}
      </span>
      <div className="min-w-0">
        <p className="font-display text-sm font-bold text-ink">
          {achievement.title}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted">
          {achievement.desc}
        </p>
      </div>
      {locked && <span className="sr-only">Locked</span>}
    </div>
  );
}

function RailEmpty({ icon: Icon, title, body }: {
  icon: typeof Heart;
  title: string;
  body: string;
}) {
  return (
    <div className="panel grid place-items-center px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface-2">
        <Icon className="h-5 w-5 text-muted" aria-hidden />
      </span>
      <h3 className="mt-4 font-display text-base font-bold">{title}</h3>
      <p className="mt-1.5 max-w-xs text-xs text-muted">{body}</p>
      <Link
        href="/games/"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted transition hover:border-primary/50 hover:text-ink active:scale-95"
      >
        Browse games
      </Link>
    </div>
  );
}

export function Scorecard() {
  const progress = useProgress();
  const { favorites, ready } = useFavorites();
  const { recent } = useRecent();

  const playedCount = Object.keys(progress.played).length;
  const unlockedCount = ACHIEVEMENTS.filter(
    (achievement) => progress.unlocked[achievement.id] !== undefined,
  ).length;

  const categoriesTouched = new Set(
    Object.keys(progress.played)
      .map((slug) => getGame(slug)?.category)
      .filter((category) => category !== undefined),
  ).size;

  const bestRows: BestRow[] = [];
  for (const [slug, entry] of Object.entries(progress.bests)) {
    const game = getGame(slug);
    if (game) bestRows.push({ slug, entry, game });
  }
  bestRows.sort((a, b) => b.entry.t - a.entry.t);
  const visibleBests = bestRows.slice(0, MAX_BESTS);

  const favoriteSlugs = favorites.filter((slug) => getGame(slug)).slice(0, 4);
  const recentSlugs = recent.filter((slug) => getGame(slug)).slice(0, 4);

  const unlockPercent = Math.round(
    (unlockedCount / Math.max(ACHIEVEMENTS.length, 1)) * 100,
  );

  return (
    <div>
      {/* Intro */}
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
        Your arcade
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
        Scorecard
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Every number below lives in this browser only — no account, no server,
        no tracking.
      </p>

      {/* Stat tiles */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Games played"
          icon={Gamepad2}
          value={`${playedCount}/${games.length}`}
        />
        <StatTile
          label="Categories touched"
          icon={Compass}
          value={`${categoriesTouched}/${publishedCategories.length}`}
        />
        <StatTile
          label="Personal bests"
          icon={Trophy}
          value={String(progress.pbCount)}
        />
        <StatTile
          label="Achievements"
          icon={Award}
          value={`${unlockedCount}/${ACHIEVEMENTS.length}`}
        />
      </div>

      {playedCount === 0 && (
        <p className="mt-4 text-sm text-muted">
          Nothing here yet — open any game and this page fills itself in.
        </p>
      )}

      {/* Achievements */}
      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              Trophies
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">Achievements</h2>
          </div>
          <p className="text-sm text-muted">
            {unlockedCount} of {ACHIEVEMENTS.length} unlocked
          </p>
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={ACHIEVEMENTS.length}
          aria-valuenow={unlockedCount}
          className="mt-4 h-2 overflow-hidden rounded-full border border-line bg-surface"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 transition-[width] duration-500"
            style={{ width: `${unlockPercent}%` }}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((achievement) => (
            <AchievementTile
              key={achievement.id}
              achievement={achievement}
              unlockedAt={progress.unlocked[achievement.id]}
            />
          ))}
        </div>
      </section>

      {/* Personal bests */}
      <section className="mt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Records
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold">Personal bests</h2>

        {visibleBests.length === 0 ? (
          <div className="panel mt-5 grid place-items-center px-6 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface-2">
              <Trophy className="h-6 w-6 text-muted" aria-hidden />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold">
              No personal bests yet — go set one.
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted">
              Beat your own score in any game and the record shows up here,
              newest first.
            </p>
            <Link
              href="/games/"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-95"
            >
              <Gamepad2 className="h-4 w-4" aria-hidden />
              Find a game
            </Link>
          </div>
        ) : (
          <>
            <div className="panel mt-5 divide-y divide-line overflow-hidden">
              {visibleBests.map((row) => (
                <Link
                  key={row.slug}
                  href={`/games/${row.slug}/`}
                  className="group flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-lg",
                      row.game.cover.gradient,
                    )}
                    aria-hidden
                  >
                    {row.game.cover.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm font-semibold text-ink transition group-hover:text-white">
                      {row.game.title}
                    </span>
                    <span className="block text-xs text-muted">
                      {getCategory(row.game.category)?.name}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-sm text-accent">
                    {formatBest(row.entry.v, row.game)}
                  </span>
                </Link>
              ))}
            </div>
            {bestRows.length > MAX_BESTS && (
              <p className="mt-3 text-xs text-muted">
                Showing the {MAX_BESTS} most recent of {bestRows.length} records
                — {bestRows.length - MAX_BESTS} older ones are tucked away.
              </p>
            )}
          </>
        )}
      </section>

      {/* Favorites & recently played rails */}
      <section className="mt-12 grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
                Your shelf
              </p>
              <h2 className="mt-1 font-display text-xl font-bold">Favorites</h2>
            </div>
            <Link
              href="/games/"
              className="text-xs font-semibold text-muted transition hover:text-ink"
            >
              Find games
            </Link>
          </div>

          {!ready ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-2xl border border-line bg-surface"
                />
              ))}
            </div>
          ) : favoriteSlugs.length === 0 ? (
            <RailEmpty
              icon={Heart}
              title="No favorites yet"
              body="Tap the heart on any game and it will live here."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {favoriteSlugs.map((slug) => (
                <GameCard key={slug} slug={slug} />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
                Jump back in
              </p>
              <h2 className="mt-1 font-display text-xl font-bold">
                Recently played
              </h2>
            </div>
            <Link
              href="/games/"
              className="text-xs font-semibold text-muted transition hover:text-ink"
            >
              Find games
            </Link>
          </div>

          {recentSlugs.length === 0 ? (
            <RailEmpty
              icon={History}
              title="Nothing played yet"
              body="Open a game and it shows up here for a quick rematch."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {recentSlugs.map((slug) => (
                <GameCard key={slug} slug={slug} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
