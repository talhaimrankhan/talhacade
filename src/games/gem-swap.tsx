"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const SIZE = 8;
const TYPES = 6;
const START_MOVES = 30;

/** Literal Tailwind colours — one per gem, darker border for the bevel. */
const GEM_STYLES = [
  "bg-rose-500 border-rose-700",
  "bg-cyan-400 border-cyan-600",
  "bg-emerald-500 border-emerald-700",
  "bg-amber-400 border-amber-600",
  "bg-violet-500 border-violet-700",
  "bg-sky-500 border-sky-700",
];
const GEM_GLYPHS = ["◆", "●", "▲", "★", "✦", "❖"];
const GEM_NAMES = ["ruby", "aqua", "emerald", "topaz", "amethyst", "sapphire"];

const at = (r: number, c: number) => r * SIZE + c;
const rowOf = (i: number) => Math.floor(i / SIZE);
const colOf = (i: number) => i % SIZE;

function adjacent(a: number, b: number): boolean {
  return Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1;
}

function swapCells(b: number[], a: number, c: number): number[] {
  const next = [...b];
  [next[a], next[c]] = [next[c], next[a]];
  return next;
}

/** Board with no runs of three already in it. */
function deal(): number[] {
  const b: number[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const r = rowOf(i);
    const c = colOf(i);
    let v = 0;
    do {
      v = Math.floor(Math.random() * TYPES);
    } while (
      (c >= 2 && b[i - 1] === v && b[i - 2] === v) ||
      (r >= 2 && b[i - SIZE] === v && b[i - 2 * SIZE] === v)
    );
    b.push(v);
  }
  return b;
}

/** Every cell that is part of a horizontal or vertical run of three plus. */
function findRuns(b: number[]): number[] {
  const out = new Set<number>();
  for (let r = 0; r < SIZE; r++) {
    let run = 1;
    for (let c = 1; c < SIZE; c++) {
      if (b[at(r, c)] === b[at(r, c - 1)]) {
        run++;
      } else {
        if (run >= 3) for (let k = c - run; k < c; k++) out.add(at(r, k));
        run = 1;
      }
    }
    if (run >= 3) for (let k = SIZE - run; k < SIZE; k++) out.add(at(r, k));
  }
  for (let c = 0; c < SIZE; c++) {
    let run = 1;
    for (let r = 1; r < SIZE; r++) {
      if (b[at(r, c)] === b[at(r - 1, c)]) {
        run++;
      } else {
        if (run >= 3) for (let k = r - run; k < r; k++) out.add(at(k, c));
        run = 1;
      }
    }
    if (run >= 3) for (let k = SIZE - run; k < SIZE; k++) out.add(at(k, c));
  }
  return [...out];
}

/** Does at least one legal swap create a run? */
function hasMove(b: number[]): boolean {
  for (let i = 0; i < b.length; i++) {
    if (colOf(i) < SIZE - 1 && findRuns(swapCells(b, i, i + 1)).length) {
      return true;
    }
    if (i + SIZE < b.length && findRuns(swapCells(b, i, i + SIZE)).length) {
      return true;
    }
  }
  return false;
}

/** Deal a board that is actually playable. */
function freshBoard(): number[] {
  for (let t = 0; t < 60; t++) {
    const b = deal();
    if (hasMove(b)) return b;
  }
  return deal();
}

/** Holes (-1) sink to the bottom, gems above fall, gaps refill from above. */
function collapse(b: number[]): number[] {
  const next = b.slice();
  for (let c = 0; c < SIZE; c++) {
    const stack: number[] = [];
    for (let r = SIZE - 1; r >= 0; r--) {
      const v = next[at(r, c)];
      if (v >= 0) stack.push(v);
    }
    for (let r = SIZE - 1; r >= 0; r--) {
      next[at(r, c)] =
        stack[SIZE - 1 - r] ?? Math.floor(Math.random() * TYPES);
    }
  }
  return next;
}

type Resolve = (b: number[], step: number, movesLeft: number) => void;
export default function GemSwap({ gameId }: { gameId: string }) {
  const [board, setBoard] = useState<number[]>(() => freshBoard());
  const [sel, setSel] = useState<number | null>(null);
  const [popping, setPopping] = useState<number[]>([]);
  const [cascade, setCascade] = useState(0);
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState(START_MOVES);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<"playing" | "over">("playing");
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scoreRef = useRef(0);
  const dragFrom = useRef<number | null>(null);
  /** Keeps the cascade chain pointed at the latest resolve. */
  const resolveRef = useRef<Resolve>(() => {});

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const restart = useCallback(() => {
    clearTimers();
    scoreRef.current = 0;
    setBoard(freshBoard());
    setSel(null);
    setPopping([]);
    setCascade(0);
    setBusy(false);
    setMoves(START_MOVES);
    setScore(0);
    setStatus("playing");
    setNewBest(false);
  }, [clearTimers]);

  /** Clear runs, drop, refill and repeat — cascades multiply the payout. */
  const resolve: Resolve = useCallback(
    (b, step, movesLeft) => {
      const runs = findRuns(b);
      if (runs.length === 0) {
        setCascade(0);
        setBusy(false);
        if (movesLeft <= 0) {
          setStatus("over");
          setNewBest(submit(scoreRef.current));
        } else if (!hasMove(b)) {
          setBoard(freshBoard());
        }
        return;
      }

      const popSet = new Set(runs);
      setCascade(step);
      scoreRef.current += runs.length * 10 * step;
      setScore(scoreRef.current);
      setPopping(runs);

      const t1 = setTimeout(() => {
        const holes = b.map((v, i) => (popSet.has(i) ? -1 : v));
        setBoard(holes);
        setPopping([]);
        const t2 = setTimeout(() => {
          const next = collapse(holes);
          setBoard(next);
          resolveRef.current(next, step + 1, movesLeft);
        }, 90);
        timers.current.push(t2);
      }, 260);
      timers.current.push(t1);
    },
    [submit],
  );

  useEffect(() => {
    resolveRef.current = resolve;
  }, [resolve]);

  const trySwap = useCallback(
    (a: number, b: number) => {
      if (busy || status !== "playing" || !adjacent(a, b)) return;
      const swapped = swapCells(board, a, b);

      // A swap that makes nothing just bounces back.
      if (findRuns(swapped).length === 0) {
        setBusy(true);
        setSel(null);
        setBoard(swapped);
        const t = setTimeout(() => {
          setBoard(board);
          setBusy(false);
        }, 300);
        timers.current.push(t);
        return;
      }

      const movesLeft = moves - 1;
      setMoves(movesLeft);
      setSel(null);
      setBusy(true);
      resolve(swapped, 1, movesLeft);
    },
    [busy, status, board, moves, resolve],
  );

  const pick = useCallback(
    (i: number) => {
      if (busy || status !== "playing") return;
      if (sel === null) {
        setSel(i);
      } else if (sel === i) {
        setSel(null);
      } else if (adjacent(sel, i)) {
        trySwap(sel, i);
      } else {
        setSel(i);
      }
    },
    [busy, status, sel, trySwap],
  );

  const onPointerUp = useCallback(
    (i: number) => {
      const from = dragFrom.current;
      dragFrom.current = null;
      if (from === null || from === i) return;
      if (adjacent(from, i)) trySwap(from, i);
    },
    [trySwap],
  );

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-accent">
          Moves{" "}
          <b className="ml-1 text-sm text-ink tabular-nums">{moves}</b>
        </span>
        {cascade > 1 && (
          <span className="animate-pop rounded-full bg-warn/15 px-2 py-0.5 font-bold text-warn">
            ×{cascade} cascade
          </span>
        )}
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-2.5 shadow-[0_0_60px_-22px_rgba(244,63,94,0.7)] sm:p-3">
        <div
          className="grid grid-cols-8 gap-1 select-none [touch-action:none] sm:gap-1.5"
          role="grid"
          aria-label="Gem board, tap two adjacent gems to swap them"
        >
          {board.map((v, i) => {
            const isPop = popping.includes(i);
            const isSel = sel === i;
            const near = sel !== null && sel !== i && adjacent(sel, i);
            return (
              <button
                key={`${i}-${v}`}
                type="button"
                onClick={() => pick(i)}
                onPointerDown={() => {
                  dragFrom.current = i;
                }}
                onPointerUp={() => onPointerUp(i)}
                aria-label={`Row ${rowOf(i) + 1} column ${colOf(i) + 1}: ${
                  v < 0 ? "empty" : GEM_NAMES[v]
                }`}
                className={cn(
                  "grid aspect-square place-items-center rounded-xl border-2 font-display text-sm transition duration-200",
                  v < 0
                    ? "border-line bg-[#131322]"
                    : cn(GEM_STYLES[v], "text-white/85 shadow-[0_2px_0_rgba(0,0,0,0.35)]"),
                  v >= 0 && !isPop && "animate-pop",
                  isPop && "scale-125 opacity-0",
                  isSel && "ring-2 ring-white",
                  near && !isSel && "ring-1 ring-primary/70",
                )}
              >
                {v >= 0 && !isPop ? GEM_GLYPHS[v] : null}
              </button>
            );
          })}
        </div>

        {status === "over" && (
          <Overlay>
            <p className="text-4xl">💎</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              OUT OF MOVES
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New high score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">
              {score}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={restart}
              tone="from-rose-400 via-pink-500 to-fuchsia-600"
            >
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap a gem, then an adjacent one (or drag) · match 3+ · every swap
        spends a move · cascades multiply points
      </p>
    </div>
  );
}
