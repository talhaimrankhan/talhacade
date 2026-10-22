import { games } from "@/lib/catalog";
import type { Game } from "@/lib/types";

/**
 * The Daily Challenge — one featured game per calendar day, picked
 * deterministically from the full catalog so every visitor (including
 * offline installs) sees the same game with zero server involvement.
 *
 * All date math uses the player's LOCAL calendar day: your streak ends
 * when YOUR day ends.
 */

/** Local-day key, "YYYY-MM-DD" — same convention as achievements.ts. */
export function dayKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** FNV-1a — tiny deterministic hash, no dependencies. */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Today's featured game — stable for a given day string. */
export function dailyGame(day: string): Game {
  return games[fnv1a(day) % games.length];
}

/** Stable "Daily #N" counter — days since the arcade opened. */
const OPENED = Date.UTC(2025, 0, 1);

export function dailyNumber(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, date);
  return Math.floor((utc - OPENED) / 86_400_000) + 1;
}

/** True when `day` is the calendar day immediately before `today`. */
export function isYesterday(day: string, today: string): boolean {
  if (day === "") return false;
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  const prev = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return day === prev;
}
