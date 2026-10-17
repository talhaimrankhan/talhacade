"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

/* ------------------------------------------------------------------ */
/* Gomoku engine (pure)                                                */
/* ------------------------------------------------------------------ */

const SIZE = 15;
const CELLS = SIZE * SIZE;
/** 0 empty · 1 you · 2 CPU */
type Board = number[];

interface Series { you: number; draws: number; cpu: number }

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const WIN = 10000000;

const rc = (i: number): [number, number] => [Math.floor(i / SIZE), i % SIZE];
const at = (r: number, c: number) => r * SIZE + c;
const inside = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

function findWin(board: Board, i: number): number[] | null {
  const [r, c] = rc(i);
  const side = board[i];
  if (side === 0) return null;
  for (const [dr, dc] of DIRS) {
    const line = [i];
    for (const sign of [1, -1]) {
      let rr = r + dr * sign;
      let cc = c + dc * sign;
      while (inside(rr, cc) && board[at(rr, cc)] === side) {
        line.push(at(rr, cc));
        rr += dr * sign;
        cc += dc * sign;
      }
    }
    if (line.length >= 5) return line;
  }
  return null;
}

/**
 * Value of putting `side` on empty cell `i` along one line, scored from
 * classic templates: five, open four, closed four, open three, and so on.
 */
function runScore(board: Board, i: number, side: number, dr: number, dc: number): number {
  const [r, c] = rc(i);
  let n = 1;
  let open = 0;
  let rr = r + dr;
  let cc = c + dc;
  while (inside(rr, cc) && board[at(rr, cc)] === side) {
    n++;
    rr += dr;
    cc += dc;
  }
  if (inside(rr, cc) && board[at(rr, cc)] === 0) open++;
  rr = r - dr;
  cc = c - dc;
  while (inside(rr, cc) && board[at(rr, cc)] === side) {
    n++;
    rr -= dr;
    cc -= dc;
  }
  if (inside(rr, cc) && board[at(rr, cc)] === 0) open++;
  if (n >= 5) return WIN;
  if (open === 0) return 0;
  if (n === 4) return open === 2 ? 150000 : 12000;
  if (n === 3) return open === 2 ? 8000 : 600;
  if (n === 2) return open === 2 ? 500 : 80;
  return open === 2 ? 60 : 15;
}

function cellScore(board: Board, i: number, side: number): number {
  let best = 0;
  for (const [dr, dc] of DIRS) best = Math.max(best, runScore(board, i, side, dr, dc));
  return best;
}

/**
 * Threat heuristic: take an immediate five, otherwise block the CPU's
 * incoming five, otherwise play the cell that blends making our own threat
 * with denying theirs.
 */
function cpuChoose(board: Board): number {
  let blockIdx = -1;
  let blockScore = -1;
  let bestTotal = -1;
  let best: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (board[i] !== 0) continue;
    if (cellScore(board, i, 2) >= WIN) return i; // make five
    const defence = cellScore(board, i, 1);
    if (defence >= WIN && defence > blockScore) {
      blockScore = defence;
      blockIdx = i;
    }
    const total = cellScore(board, i, 2) + defence * 0.9;
    if (total > bestTotal) {
      bestTotal = total;
      best = [i];
    } else if (total === bestTotal) {
      best.push(i);
    }
  }
  if (blockIdx >= 0) return blockIdx; // stop their five
  if (best.length === 0) return -1;
  return best[Math.floor(Math.random() * best.length)];
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Gomoku({ gameId }: { gameId: string }) {
  const [board, setBoard] = useState<Board>(() => Array(CELLS).fill(0));
  const [winCells, setWinCells] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<"playing" | "won" | "lost" | "draw">("playing");
  const [thinking, setThinking] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [series, setSeries] = useStored<Series>(`series:${gameId}`, {
    you: 0,
    draws: 0,
    cpu: 0,
  });
  const { best, submit } = useBestScore(gameId, "high");
  const cpuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seriesRef = useRef<Series>(series);
  useEffect(() => {
    seriesRef.current = series;
  }, [series]);

  useEffect(
    () => () => {
      if (cpuTimer.current) clearTimeout(cpuTimer.current);
    },
    [],
  );

  const stones = useMemo(() => {
    let mine = 0;
    let theirs = 0;
    for (const cell of board) {
      if (cell === 1) mine++;
      else if (cell === 2) theirs++;
    }
    return { mine, theirs };
  }, [board]);

  const finish = useCallback(
    (result: "won" | "lost" | "draw") => {
      setOutcome(result);
      const s = seriesRef.current;
      const key = result === "won" ? "you" : result === "lost" ? "cpu" : "draws";
      const updated: Series = { ...s, [key]: s[key] + 1 };
      seriesRef.current = updated;
      setSeries(updated);
      if (result === "won") setNewBest(submit(updated.you));
    },
    [setSeries, submit],
  );

  /** Drops a stone, resolves win / draw, returns true when the round ends. */
  const drop = (current: Board, i: number, side: 1 | 2): boolean => {
    const next = current.slice();
    next[i] = side;
    setBoard(next);
    const line = findWin(next, i);
    if (line) {
      setWinCells(line);
      finish(side === 1 ? "won" : "lost");
      return true;
    }
    if (next.every((cell) => cell !== 0)) {
      finish("draw");
      return true;
    }
    return false;
  };

  const onCell = (i: number) => {
    if (outcome !== "playing" || thinking || board[i] !== 0) return;
    if (drop(board, i, 1)) return;
    const afterYou = board.slice();
    afterYou[i] = 1;
    setThinking(true);
    cpuTimer.current = setTimeout(() => {
      const move = cpuChoose(afterYou);
      if (move < 0) {
        setThinking(false);
        finish("draw");
        return;
      }
      drop(afterYou, move, 2);
      setThinking(false);
    }, 380);
  };

  const newGame = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setBoard(Array(CELLS).fill(0));
    setWinCells([]);
    setOutcome("playing");
    setThinking(false);
    setNewBest(false);
  }, []);

  const statusText =
    outcome === "won"
      ? "Five in a row! \uD83C\uDF89"
      : outcome === "lost"
        ? "CPU lines up five \uD83E\uDD16"
        : outcome === "draw"
          ? "Board is full \u2014 draw"
          : thinking
            ? "CPU is thinking\u2026"
            : "Your move \u2014 place a stone";

  return (
    <div className="w-full max-w-[560px]">
      <div className="mb-3 grid grid-cols-3 gap-2 font-mono text-xs uppercase tracking-wider">
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-center text-cyan-300">
          You <b className="ml-1 text-sm text-ink">{series.you}</b>
        </div>
        <div className="rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-muted">
          Draw <b className="ml-1 text-sm text-ink">{series.draws}</b>
        </div>
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-center text-rose-300">
          CPU <b className="ml-1 text-sm text-ink">{series.cpu}</b>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs uppercase tracking-wider">
        <span className={thinking ? "text-rose-300" : "text-muted"}>
          <b className="text-ink">{thinking ? "Thinking\u2026 " : ""}{statusText}</b>
        </span>
        <span className="flex items-center gap-3 text-muted">
          Stones <b className="text-cyan-400">{stones.mine}</b> &middot;{" "}
          <b className="text-rose-400">{stones.theirs}</b>
          <button
            type="button"
            onClick={newGame}
            className="rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            New game
          </button>
        </span>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-2 shadow-[0_0_60px_-24px_rgba(34,211,238,0.7)] sm:p-3">
        <div
          className="grid gap-px overflow-hidden rounded-lg border border-line bg-line"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: CELLS }, (_, i) => {
            const cell = board[i];
            const isWin = winCells.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onCell(i)}
                aria-label={`${String.fromCharCode(97 + (i % SIZE))}${SIZE - Math.floor(i / SIZE)}${cell === 1 ? " your stone" : cell === 2 ? " CPU stone" : ""}`}
                disabled={cell !== 0 || outcome !== "playing"}
                className={cn(
                  "relative grid aspect-square select-none place-items-center rounded-none transition disabled:cursor-default",
                  cell === 0
                    ? "bg-[#131322] hover:bg-[#1d1d38]"
                    : "bg-[#131322]",
                  isWin && "bg-success/20 shadow-[inset_0_0_0_2px_#34d399]",
                )}
              >
                {cell !== 0 && (
                  <span
                    className={cn(
                      "relative grid h-[76%] w-[76%] place-items-center rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.6)]",
                      cell === 1
                        ? "animate-pop bg-gradient-to-br from-cyan-300 to-cyan-600"
                        : "animate-pop bg-gradient-to-br from-rose-400 to-rose-600",
                    )}
                  >
                    {cell === 2 && (
                      <span className="h-[26%] w-[26%] rounded-full bg-black/45" />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {outcome !== "playing" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {outcome === "won" ? "Five in a row \uD83C\uDF89" : outcome === "lost" ? "The CPU connects five \uD83E\uDD16" : "Board locked \u2014 draw"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                &#10022; Most games won &mdash; new best!
              </p>
            )}
            <p className="mt-2 text-xs uppercase tracking-widest text-muted">
              All-time wins {best ?? 0} &middot; Series {series.you}&ndash;
              {series.draws}&ndash;{series.cpu}
            </p>
            <PrimaryButton
              onClick={newGame}
              tone={
                outcome === "won"
                  ? "from-cyan-400 via-sky-500 to-blue-600"
                  : outcome === "lost"
                    ? "from-amber-400 via-orange-500 to-red-500"
                    : "from-slate-400 via-zinc-500 to-neutral-700"
              }
            >
              New game
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Five stones in a row wins &middot; the CPU reads every threat on the board
      </p>
    </div>
  );
}
