"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

/* ------------------------------------------------------------------ */
/* Board layout — a fixed 3-layer pyramid, 36 tiles                    */
/* ------------------------------------------------------------------ */

const TILE_W = 52;
const TILE_H = 58;
const PITCH_X = TILE_W + 4;
const PITCH_Y = TILE_H + 4;
const BOARD_W = 5 * PITCH_X + TILE_W;
const BOARD_H = 3 * PITCH_Y + TILE_H;

interface Slot {
  x: number;
  y: number;
  layer: number;
}

/** 24 on the bottom, 8 in the middle, 4 on top — classic stepped pyramid. */
function buildSlots(): Slot[] {
  const slots: Slot[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      slots.push({ x: c * PITCH_X, y: r * PITCH_Y, layer: 0 });
    }
  }
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      slots.push({
        x: c * PITCH_X + PITCH_X / 2,
        y: r * PITCH_Y + PITCH_Y / 2,
        layer: 1,
      });
    }
  }
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      slots.push({
        x: c * PITCH_X + PITCH_X,
        y: r * PITCH_Y + PITCH_Y,
        layer: 2,
      });
    }
  }
  return slots;
}

const SLOTS = buildSlots();

/** 18 distinct faces, doubled = 36 tiles. */
const FACES = [
  "🀄", "🀅", "🀆", "🀁", "🀂", "🀃",
  "🀇", "🀈", "🀉", "🀊", "🀋", "🀌",
  "🀍", "🀎", "🀏", "🀐", "🀑", "🀒",
];

interface Tile {
  id: number;
  face: string;
  x: number;
  y: number;
  layer: number;
}

function shuffled<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function deal(): Tile[] {
  // "Peeling" deal: repeatedly pair up two currently-free slots, so a legal
  // clearing order is guaranteed to exist (the reverse of the deal order).
  const bag = shuffled(FACES);
  const tiles: Tile[] = SLOTS.map((slot, id) => ({
    id,
    face: "",
    x: slot.x,
    y: slot.y,
    layer: slot.layer,
  }));
  let remaining = tiles;
  for (const face of bag) {
    const free = [...freeIds(remaining)];
    const pair = free.slice(0, 2);
    const chosen =
      pair.length === 2
        ? pair
        : remaining.slice(0, 2).map((t) => t.id);
    tiles[chosen[0]].face = face;
    tiles[chosen[1]].face = face;
    remaining = remaining.filter(
      (t) => t.id !== chosen[0] && t.id !== chosen[1],
    );
  }
  return tiles;
}

/** A tile is free when nothing stacks on top and at least one side is open. */
function freeIds(tiles: Tile[]): Set<number> {
  const free = new Set<number>();
  for (const a of tiles) {
    let covered = false;
    for (const b of tiles) {
      if (b.id === a.id) continue;
      if (
        b.layer > a.layer &&
        Math.abs(b.x - a.x) < TILE_W &&
        Math.abs(b.y - a.y) < TILE_H
      ) {
        covered = true;
        break;
      }
    }
    if (covered) continue;
    const leftBlocked = tiles.some(
      (b) =>
        b.id !== a.id &&
        b.layer === a.layer &&
        b.y === a.y &&
        a.x - b.x === PITCH_X,
    );
    const rightBlocked = tiles.some(
      (b) =>
        b.id !== a.id &&
        b.layer === a.layer &&
        b.y === a.y &&
        b.x - a.x === PITCH_X,
    );
    if (!leftBlocked || !rightBlocked) free.add(a.id);
  }
  return free;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */

export default function TileMahjong({ gameId }: { gameId: string }) {
  const [tiles, setTiles] = useState<Tile[]>(() => deal());
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<number[]>([]);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [shufflesLeft, setShufflesLeft] = useState(3);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "low");
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  // ticking clock while the board is in play
  useEffect(() => {
    if (!started || won) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [started, won]);

  const free = useMemo(() => freeIds(tiles), [tiles]);

  const restart = useCallback(() => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setTiles(deal());
    setSelected(null);
    setHint([]);
    setHintsLeft(3);
    setShufflesLeft(3);
    setStarted(false);
    setElapsed(0);
    setWon(false);
    setNewBest(false);
  }, []);

  const tap = useCallback(
    (id: number) => {
      if (won) return;
      if (!started) setStarted(true);
      if (!free.has(id)) return;

      if (selected === null) {
        setSelected(id);
        return;
      }
      if (selected === id) {
        setSelected(null);
        return;
      }

      const picked = tiles.find((t) => t.id === id);
      const pickedSel = tiles.find((t) => t.id === selected);
      if (picked && pickedSel && picked.face === pickedSel.face) {
        const left = tiles.filter((t) => t.id !== id && t.id !== selected);
        setTiles(left);
        setSelected(null);
        setHint([]);
        if (left.length === 0) {
          setWon(true);
          const seconds = Math.max(1, elapsed);
          setElapsed(seconds);
          setNewBest(submit(seconds));
        }
      } else {
        setSelected(id);
      }
    },
    [won, started, free, selected, tiles, elapsed, submit],
  );

  const showHint = useCallback(() => {
    if (won || hintsLeft <= 0) return;
    const pool = tiles.filter((t) => free.has(t.id));
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        if (pool[i].face === pool[j].face) {
          if (hintTimer.current) clearTimeout(hintTimer.current);
          setHint([pool[i].id, pool[j].id]);
          setHintsLeft((n) => n - 1);
          setSelected(null);
          hintTimer.current = setTimeout(() => setHint([]), 1300);
          return;
        }
      }
    }
  }, [won, hintsLeft, tiles, free]);

  const shuffle = useCallback(() => {
    if (won || shufflesLeft <= 0 || tiles.length === 0) return;
    const bag = shuffled(tiles.map((t) => t.face));
    setTiles((prev) => prev.map((t, i) => ({ ...t, face: bag[i] })));
    setSelected(null);
    setHint([]);
    setShufflesLeft((n) => n - 1);
  }, [won, shufflesLeft, tiles]);

  return (
    <div className="w-full max-w-[560px]">
      <GameHud
        score={formatClock(elapsed)}
        best={best === null ? "—" : `${best}s`}
        accent="text-cyan-400"
      >
        <span className="text-muted">
          Hints <b className="ml-1 text-sm text-ink">{hintsLeft}</b>
        </span>
        <span className="text-muted">
          Mixes <b className="ml-1 text-sm text-ink">{shufflesLeft}</b>
        </span>
      </GameHud>

      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={showHint}
          disabled={hintsLeft === 0 || won}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink disabled:opacity-40"
        >
          💡 Hint ({hintsLeft})
        </button>
        <button
          type="button"
          onClick={shuffle}
          disabled={shufflesLeft === 0 || won}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink disabled:opacity-40"
        >
          🔀 Shuffle ({shufflesLeft})
        </button>
        <button
          type="button"
          onClick={restart}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
        >
          ⟳ New game
        </button>
      </div>

      <div
        className="relative w-full rounded-2xl border border-line bg-surface-2 shadow-[0_0_60px_-24px_rgba(34,211,238,0.7)]"
        style={{ aspectRatio: `${BOARD_W} / ${BOARD_H}` }}
      >
        {tiles.map((tile) => {
          const isFree = free.has(tile.id);
          const isSelected = selected === tile.id;
          const isHint = hint.includes(tile.id);
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => tap(tile.id)}
              aria-label={`Tile ${tile.face}${isFree ? "" : " (blocked)"}`}
              className={cn(
                "absolute grid select-none place-items-center rounded-lg border text-xl leading-none transition sm:text-3xl",
                isFree
                  ? isSelected
                    ? "border-cyan-400 bg-[#1d2b3a] shadow-[0_0_18px_rgba(34,211,238,0.8)]"
                    : "border-line bg-[#131322] hover:border-cyan-400/50"
                  : "border-line bg-[#171728]",
                isHint && "animate-pulse border-warn bg-[#2c2613] shadow-[0_0_18px_rgba(251,191,36,0.8)]",
              )}
              style={{
                left: `${(tile.x / BOARD_W) * 100}%`,
                top: `${(tile.y / BOARD_H) * 100}%`,
                width: `${(TILE_W / BOARD_W) * 100}%`,
                height: `${(TILE_H / BOARD_H) * 100}%`,
                zIndex: 10 + tile.layer * 10,
              }}
            >
              {tile.face}
            </button>
          );
        })}

        {won && (
          <Overlay>
            <p className="text-4xl">🀄</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              BOARD CLEARED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fastest clear!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {formatClock(elapsed)}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : `${best}s`}
            </p>
            <PrimaryButton
              onClick={restart}
              tone="from-cyan-400 via-sky-500 to-blue-600"
            >
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap a free tile, then its twin — tiles need an open side and nothing
        stacked on top
      </p>
    </div>
  );
}
