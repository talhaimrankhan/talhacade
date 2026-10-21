"use client";

import { useCallback, useSyncExternalStore } from "react";
import { recordPb } from "@/lib/achievements";

/**
 * All persistence lives in the visitor's own browser (localStorage).
 * Nothing is ever sent to a server — that's the whole point of this site.
 *
 * Implemented as an external store (useSyncExternalStore) so values hydrate
 * safely on the server, stay referentially stable across renders, and even
 * stay in sync across browser tabs.
 */

const PREFIX = "na:v1:";

export type BestMode = "high" | "low";

interface Entry {
  raw: string | null;
  value: unknown;
}

const EMPTY: string[] = [];
const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Cached snapshot so getSnapshot() returns a stable reference. */
function snapshot<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = readRaw(key);
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.value as T | null;
  const entry: Entry = { raw, value: parse(raw) };
  cache.set(key, entry);
  return entry.value as T | null;
}

function write(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(PREFIX + key, raw);
  } catch {
    // Storage full or blocked — the site still works, we just can't remember.
  }
  cache.set(key, { raw, value });
  listeners.get(key)?.forEach((notify) => notify());
}

function subscribe(key: string, onChange: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(onChange);

  // Keep in sync when another tab changes the same key.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === PREFIX + key) {
      cache.delete(key);
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    set?.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function useStore<T>(key: string): T | null {
  return useSyncExternalStore(
    useCallback((cb: () => void) => subscribe(key, cb), [key]),
    useCallback(() => snapshot<T>(key), [key]),
    // Server / hydration snapshot: always the "empty" render.
    useCallback(() => null, []),
  );
}

/** Generic persisted value; falls back to `initial` until something is stored. */
export function useStored<T>(key: string, initial: T) {
  const stored = useStore<T>(key);
  const value = stored ?? initial;

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const previous = snapshot<T>(key) ?? initial;
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(previous) : next;
      write(key, resolved);
    },
    [key, initial],
  );

  return [value, set] as const;
}

/**
 * Best score for a single game. `mode: "high"` keeps the biggest number,
 * `"low"` keeps the smallest (times, moves). `submit` reports whether the
 * given score set a new record.
 */
export function useBestScore(gameId: string, mode: BestMode = "high") {
  const key = `best:${gameId}`;
  const best = useStore<number>(key);

  const submit = useCallback(
    (score: number): boolean => {
      const previous = snapshot<number>(key);
      const isBest =
        previous === null ||
        (mode === "high" ? score > previous : score < previous);
      if (isBest) {
        write(key, score);
        recordPb(gameId, score, mode);
      }
      return isBest;
    },
    [gameId, key, mode],
  );

  return { best, submit } as const;
}

/** Favorited game slugs (localStorage-backed). */
export function useFavorites() {
  const stored = useStore<string[]>("favorites");
  const favorites = stored ?? EMPTY;

  const toggle = useCallback((slug: string) => {
    const list = snapshot<string[]>("favorites") ?? EMPTY;
    const next = list.includes(slug)
      ? list.filter((s) => s !== slug)
      : [slug, ...list];
    write("favorites", next);
  }, []);

  return {
    favorites,
    isFavorite: (slug: string) => favorites.includes(slug),
    toggle,
    /** false until localStorage has been read — avoids first-paint flicker. */
    ready: stored !== null,
  } as const;
}

/** Recently played slugs, most recent first. */
export function useRecent() {
  const recent = useStore<string[]>("recent") ?? EMPTY;

  const record = useCallback((slug: string) => {
    const list = snapshot<string[]>("recent") ?? EMPTY;
    const next = [slug, ...list.filter((s) => s !== slug)].slice(0, 6);
    write("recent", next);
  }, []);

  return { recent, record } as const;
}
