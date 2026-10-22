"use client";

import { useSyncExternalStore } from "react";
import { games, getGame, publishedCategories } from "@/lib/catalog";
import { dailyGame, isYesterday } from "@/lib/daily";
import type { BestMode } from "@/lib/storage";

/**
 * Achievements & lifetime stats — 100% local, same as everything else here.
 *
 * Two localStorage blobs hold the whole system:
 *   na:v1:ach:unlocked — achievement id -> unlocked-at epoch ms
 *   na:v1:ach:stats    — played / bests / pbCount / daily counters
 *
 * Reads go through a tiny external store (mirroring src/lib/storage.ts) so
 * static prerender always sees a safe empty snapshot and the client hydrates
 * without loops or flicker. Writes are read-modify-write inside try/catch and
 * never throw. Every newly satisfied achievement is stamped and announced with
 * a `talhacade:achievement` window CustomEvent for the toast layer.
 */

export type { BestMode };

const PREFIX = "na:v1:";
const UNLOCKED_KEY = "ach:unlocked";
const STATS_KEY = "ach:stats";
const FAVORITES_KEY = "favorites";

/* ------------------------------------------------------------------ */
/* Definitions                                                         */
/* ------------------------------------------------------------------ */

export interface Achievement {
  id: string;
  /** Emoji shown on the tile. */
  icon: string;
  title: string;
  desc: string;
}

export interface Progress {
  /** achievement id -> unlocked-at epoch ms */
  unlocked: Record<string, number>;
  /** game slug -> last-played epoch ms */
  played: Record<string, number>;
  /** game slug -> { v: score value, m: mode, t: epoch ms } */
  bests: Record<string, { v: number; m: BestMode; t: number }>;
  /** total number of personal bests ever set (sum across games) */
  pbCount: number;
  /** Daily Challenge state (mirror of the stats blob, for the UI). */
  daily: { day: string; streak: number; best: number };
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-play", icon: "🪙", title: "Insert Coin", desc: "Open your first game." },
  { id: "plays-10", icon: "🎮", title: "Regular", desc: "Play 10 different games." },
  { id: "plays-25", icon: "🕹️", title: "Habitué", desc: "Play 25 different games." },
  { id: "plays-50", icon: "🐀", title: "Arcade Rat", desc: "Play 50 different games." },
  { id: "plays-all", icon: "🏆", title: "The Whole Cabinet", desc: "Play all 160 games." },
  { id: "cats-4", icon: "🧭", title: "Explorer", desc: "Play games from 4 different categories." },
  { id: "cats-all", icon: "🌍", title: "World Tour", desc: "Play games from all 8 categories." },
  { id: "pb-1", icon: "🥇", title: "High Score", desc: "Set your first personal best." },
  { id: "pb-10", icon: "📈", title: "Score Chaser", desc: "Rack up 10 personal bests." },
  { id: "pb-25", icon: "👑", title: "Untouchable", desc: "Rack up 25 personal bests." },
  { id: "pb-50", icon: "🗿", title: "Legend", desc: "Rack up 50 personal bests." },
  { id: "fav-1", icon: "💜", title: "Collector", desc: "Favorite a game." },
  { id: "fav-10", icon: "🖼️", title: "Curator", desc: "Favorite 10 games." },
  { id: "word-5", icon: "📚", title: "Word Smith", desc: "Play 5 Word games." },
  { id: "racing-5", icon: "🏎️", title: "Gearhead", desc: "Play 5 Racing games." },
  { id: "shooting-5", icon: "🎯", title: "Sharpshooter", desc: "Play 5 Shooting games." },
  { id: "night-owl", icon: "🦉", title: "Night Owl", desc: "Play a game between midnight and 5 AM." },
  { id: "marathon-10", icon: "🏃", title: "Marathon", desc: "Play 10 games in a single day." },
  { id: "daily-3", icon: "🔥", title: "On a Roll", desc: "Reach a 3-day Daily Challenge streak." },
  { id: "daily-7", icon: "⚡", title: "Week of Play", desc: "Reach a 7-day Daily Challenge streak." },
  { id: "daily-30", icon: "💎", title: "Iron Habit", desc: "Reach a 30-day Daily Challenge streak." },
];

/* ------------------------------------------------------------------ */
/* Stored shapes                                                       */
/* ------------------------------------------------------------------ */

interface Stats {
  played: Record<string, number>;
  bests: Progress["bests"];
  pbCount: number;
  /** "YYYY-MM-DD" the dayCount below belongs to. */
  day: string;
  /** Games opened on `day` (rolls over with the date). */
  dayCount: number;
  /** Latched true once a game was opened between 00:00 and 05:00. */
  night: boolean;
  /** "YYYY-MM-DD" the Daily Challenge was last completed on. */
  dailyDay: string;
  /** Consecutive days completing the Daily Challenge. */
  dailyStreak: number;
  /** Longest Daily Challenge streak ever. */
  dailyBest: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function normalizeStamps(value: unknown): Record<string, number> {
  const source = isRecord(value) ? value : {};
  const out: Record<string, number> = {};
  for (const [slug, stamp] of Object.entries(source)) {
    if (typeof stamp === "number") out[slug] = stamp;
  }
  return out;
}

function normalizeBests(value: unknown): Progress["bests"] {
  const source = isRecord(value) ? value : {};
  const out: Progress["bests"] = {};
  for (const [slug, entry] of Object.entries(source)) {
    if (
      isRecord(entry) &&
      typeof entry.v === "number" &&
      typeof entry.t === "number" &&
      (entry.m === "high" || entry.m === "low")
    ) {
      out[slug] = { v: entry.v, m: entry.m, t: entry.t };
    }
  }
  return out;
}

function normalizeStats(raw: unknown): Stats {
  const source = isRecord(raw) ? raw : {};
  return {
    played: normalizeStamps(source.played),
    bests: normalizeBests(source.bests),
    pbCount: typeof source.pbCount === "number" ? source.pbCount : 0,
    day: typeof source.day === "string" ? source.day : "",
    dayCount: typeof source.dayCount === "number" ? source.dayCount : 0,
    night: source.night === true,
    dailyDay: typeof source.dailyDay === "string" ? source.dailyDay : "",
    dailyStreak:
      typeof source.dailyStreak === "number" ? source.dailyStreak : 0,
    dailyBest: typeof source.dailyBest === "number" ? source.dailyBest : 0,
  };
}

function normalizeUnlocked(raw: unknown): Record<string, number> {
  return normalizeStamps(raw);
}

/* ------------------------------------------------------------------ */
/* Tiny external store (same discipline as src/lib/storage.ts)         */
/* ------------------------------------------------------------------ */

const EMPTY_PROGRESS: Progress = {
  unlocked: {},
  played: {},
  bests: {},
  pbCount: 0,
  daily: { day: "", streak: 0, best: 0 },
};

interface CacheEntry {
  unlockedRaw: string | null;
  statsRaw: string | null;
  value: Progress;
}

const listeners = new Set<() => void>();
let cache: CacheEntry | null = null;

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(PREFIX + key, raw);
  } catch {
    // Storage full or blocked — the site still works, we just can't remember.
  }
  cache = null;
  listeners.forEach((notify) => notify());
}

/** Cached snapshot so getSnapshot() always returns a stable reference. */
function snapshot(): Progress {
  if (typeof window === "undefined") return EMPTY_PROGRESS;
  const unlockedRaw = readRaw(UNLOCKED_KEY);
  const statsRaw = readRaw(STATS_KEY);
  if (
    cache &&
    cache.unlockedRaw === unlockedRaw &&
    cache.statsRaw === statsRaw
  ) {
    return cache.value;
  }
  const stats = normalizeStats(parseJson(statsRaw));
  const value: Progress = {
    unlocked: normalizeUnlocked(parseJson(unlockedRaw)),
    played: stats.played,
    bests: stats.bests,
    pbCount: stats.pbCount,
    daily: {
      day: stats.dailyDay,
      streak: stats.dailyStreak,
      best: stats.dailyBest,
    },
  };
  cache = { unlockedRaw, statsRaw, value };
  return value;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  // Keep in sync when another tab changes either blob.
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === PREFIX + UNLOCKED_KEY ||
      event.key === PREFIX + STATS_KEY
    ) {
      cache = null;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getServerSnapshot(): Progress {
  return EMPTY_PROGRESS;
}

/** External-store hook (useSyncExternalStore) — safe for static prerender. */
export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, snapshot, getServerSnapshot);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function loadStats(): Stats {
  return normalizeStats(parseJson(readRaw(STATS_KEY)));
}

function loadFavorites(): string[] {
  const parsed = parseJson(readRaw(FAVORITES_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((slug): slug is string => typeof slug === "string");
}

function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function distinctCategories(played: Record<string, number>): Set<string> {
  const seen = new Set<string>();
  for (const slug of Object.keys(played)) {
    const category = getGame(slug)?.category;
    if (category) seen.add(category);
  }
  return seen;
}

function countInCategory(played: Record<string, number>, category: string): number {
  let count = 0;
  for (const slug of Object.keys(played)) {
    if (getGame(slug)?.category === category) count += 1;
  }
  return count;
}

function isSatisfied(
  id: string,
  progress: Progress,
  stats: Stats,
  favorites: string[],
  now: number,
): boolean {
  const playedCount = Object.keys(progress.played).length;

  switch (id) {
    case "first-play":
      return playedCount >= 1;
    case "plays-10":
      return playedCount >= 10;
    case "plays-25":
      return playedCount >= 25;
    case "plays-50":
      return playedCount >= 50;
    case "plays-all":
      return playedCount >= games.length;
    case "cats-4":
      return distinctCategories(progress.played).size >= 4;
    case "cats-all":
      return distinctCategories(progress.played).size >= publishedCategories.length;
    case "pb-1":
      return progress.pbCount >= 1;
    case "pb-10":
      return progress.pbCount >= 10;
    case "pb-25":
      return progress.pbCount >= 25;
    case "pb-50":
      return progress.pbCount >= 50;
    case "fav-1":
      return favorites.length >= 1;
    case "fav-10":
      return favorites.length >= 10;
    case "word-5":
      return countInCategory(progress.played, "word") >= 5;
    case "racing-5":
      return countInCategory(progress.played, "racing") >= 5;
    case "shooting-5":
      return countInCategory(progress.played, "shooting") >= 5;
    case "night-owl":
      return (
        stats.night ||
        Object.keys(progress.played).some(
          (slug) => new Date(progress.played[slug]).getHours() < 5,
        )
      );
    case "marathon-10":
      return stats.day === dayKey(now) && stats.dayCount >= 10;
    case "daily-3":
      return stats.dailyStreak >= 3;
    case "daily-7":
      return stats.dailyStreak >= 7;
    case "daily-30":
      return stats.dailyStreak >= 30;
    default:
      return false;
  }
}

/** Re-checks every achievement; stamps + announces anything newly earned. */
function evaluate(now: number): void {
  const progress = snapshot();
  const stats = loadStats();
  const favorites = loadFavorites();

  const unlocked: Record<string, number> = { ...progress.unlocked };
  const newlyUnlocked: Achievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlocked[achievement.id] !== undefined) continue;
    if (!isSatisfied(achievement.id, progress, stats, favorites, now)) continue;
    unlocked[achievement.id] = now;
    newlyUnlocked.push(achievement);
  }

  if (newlyUnlocked.length === 0) return;

  writeRaw(UNLOCKED_KEY, unlocked);
  for (const achievement of newlyUnlocked) {
    window.dispatchEvent(
      new CustomEvent<Achievement>("talhacade:achievement", {
        detail: achievement,
      }),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Recording API (client-only no-ops on the server)                    */
/* ------------------------------------------------------------------ */

/** Called whenever a game page is opened (client). */
export function recordPlayed(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const stats = loadStats();
    stats.played[slug] = now;

    // Daily counter for the Marathon achievement — resets when the date rolls.
    const today = dayKey(now);
    if (stats.day === today) {
      stats.dayCount += 1;
    } else {
      stats.day = today;
      stats.dayCount = 1;
    }

    // Night Owl: anything between midnight and 5 AM.
    if (new Date(now).getHours() < 5) stats.night = true;

    // Daily Challenge: opening the featured game completes the day and
    // extends (or resets) the streak.
    let dailyCompleted = false;
    if (slug === dailyGame(today).slug && stats.dailyDay !== today) {
      stats.dailyStreak = isYesterday(stats.dailyDay, today)
        ? stats.dailyStreak + 1
        : 1;
      if (stats.dailyStreak > stats.dailyBest) {
        stats.dailyBest = stats.dailyStreak;
      }
      stats.dailyDay = today;
      dailyCompleted = true;
    }

    writeRaw(STATS_KEY, stats);
    evaluate(now);

    // Global signal — the daily card and celebration layer listen for this.
    if (dailyCompleted) {
      window.dispatchEvent(
        new CustomEvent<{ slug: string; streak: number; day: string }>(
          "talhacade:daily",
          { detail: { slug, streak: stats.dailyStreak, day: today } },
        ),
      );
    }
  } catch {
    // Bookkeeping must never break the game itself.
  }
}

/** Called whenever a new personal best is saved. */
export function recordPb(slug: string, score: number, mode: BestMode): void {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const stats = loadStats();
    const previous = stats.bests[slug];
    const isBest =
      previous === undefined ||
      previous.m !== mode ||
      (mode === "high" ? score > previous.v : score < previous.v);

    // Duplicate call (caller already verified) — never double-count a PB.
    if (!isBest) return;

    stats.bests[slug] = { v: score, m: mode, t: now };
    stats.pbCount += 1;
    writeRaw(STATS_KEY, stats);
    evaluate(now);
  } catch {
    // Never throw from stats bookkeeping.
  }
}

/** Called whenever a game is favorited. */
export function recordFavorite(): void {
  if (typeof window === "undefined") return;
  try {
    evaluate(Date.now());
  } catch {
    // Never throw from stats bookkeeping.
  }
}
