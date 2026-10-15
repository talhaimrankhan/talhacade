"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";

const COLS = 7;
const ROWS = 6;
/** Search from the centre out — stronger play and faster pruning. */
const COL_ORDER = [3, 2, 4, 1, 5, 0, 6];

type Cell = 0 | 1 | 2; // 0 empty · 1 you (red) · 2 cpu (yellow)
type Outcome = "playing" | "won" | "lost" | "draw";

interface Series {
  you: number;
  draws: number;
  cpu: number;
}

function emptyBoard(): Cell[] {
  return Array<Cell>(COLS * ROWS).fill(0);
}

function validCols(board: Cell[]): number[] {
  return COL_ORDER.filter((c) => board[c] === 0);
}

function dropRow(board: Cell[], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r * COLS + col] === 0) return r;
  }
  return -1;
}

/** Returns the winning mark (1 or 2) plus its four cells, or 0. */
function findWin(
  board: Cell[],
): { mark: Cell; cells: number[] } | null {
  const dirs = [
    [0, 1], // →
    [1, 0], // ↓
    [1, 1], // ↘
    [1, -1], // ↙
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const mark = board[r * COLS + c];
      if (mark === 0) continue;
      for (const [dr, dc] of dirs) {
        const cells = [0, 1, 2, 3].map(
          (k) => (r + dr * k) * COLS + (c + dc * k),
        );
        const inBounds = cells.every((i) => {
          const rr = Math.floor(i / COLS);
          const cc = i % COLS;
          return rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS;
        });
        if (!inBounds) continue;
        if (cells.every((i) => board[i] === mark)) return { mark, cells };
      }
    }
  }
  return null;
}

function scoreWindows(board: Cell[], player: Cell): number {
  const opp: Cell = player === 1 ? 2 : 1;
  let score = 0;

  const evaluate = (window: Cell[]) => {
    const mine = window.filter((c) => c === player).length;
    const theirs = window.filter((c) => c === opp).length;
    const empty = window.filter((c) => c === 0).length;
    if (mine === 4) score += 100000;
    else if (mine === 3 && empty === 1) score += 60;
    else if (mine === 2 && empty === 2) score += 10;
    if (theirs === 3 && empty === 1) score -= 90;
  };

  // centre column weight
  let centre = 0;
  for (let r = 0; r < ROWS; r++) if (board[r * COLS + 3] === player) centre++;
  score += centre * 7;

  // horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      evaluate([0, 1, 2, 3].map((k) => board[r * COLS + c + k]));
    }
  }
  // vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      evaluate([0, 1, 2, 3].map((k) => board[(r + k) * COLS + c]));
    }
  }
  // diagonals
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      evaluate([0, 1, 2, 3].map((k) => board[(r + k) * COLS + c + k]));
    }
  }
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 3; c < COLS; c++) {
      evaluate([0, 1, 2, 3].map((k) => board[(r + k) * COLS + c - k]));
    }
  }

  return score;
}

function minimax(
  board: Cell[],
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  const win = findWin(board);
  if (win) return win.mark === 2 ? 1000000 + depth : -1000000 - depth;
  const valid = validCols(board);
  if (valid.length === 0) return 0;
  if (depth === 0) return scoreWindows(board, 2);

  if (maximizing) {
    let value = -Infinity;
    for (const col of valid) {
      const row = dropRow(board, col);
      board[row * COLS + col] = 2;
      value = Math.max(
        value,
        minimax(board, depth - 1, alpha, beta, false),
      );
      board[row * COLS + col] = 0;
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  let value = Infinity;
  for (const col of valid) {
    const row = dropRow(board, col);
    board[row * COLS + col] = 1;
    value = Math.min(value, minimax(board, depth - 1, alpha, beta, true));
    board[row * COLS + col] = 0;
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

function cpuMove(board: Cell[]): number {
  let bestScore = -Infinity;
  let move = validCols(board)[0] ?? -1;
  for (const col of validCols(board)) {
    const row = dropRow(board, col);
    board[row * COLS + col] = 2;
    const score = minimax(board, 5, -Infinity, Infinity, false);
    board[row * COLS + col] = 0;
    if (score > bestScore) {
      bestScore = score;
      move = col;
    }
  }
  return move;
}

export default function Connect4({ gameId }: { gameId: string }) {
  const [board, setBoard] = useState<Cell[]>(() => emptyBoard());
  const [outcome, setOutcome] = useState<Outcome>("playing");
  const [winCells, setWinCells] = useState<number[]>([]);
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

  const finish = useCallback(
    (next: Cell[]) => {
      const win = findWin(next);
      if (win) {
        setWinCells(win.cells);
        if (win.mark === 1) {
          setOutcome("won");
          const updated = {
            ...seriesRef.current,
            you: seriesRef.current.you + 1,
          };
          seriesRef.current = updated;
          setSeries(updated);
          setNewBest(submit(updated.you));
        } else {
          setOutcome("lost");
          const updated = {
            ...seriesRef.current,
            cpu: seriesRef.current.cpu + 1,
          };
          seriesRef.current = updated;
          setSeries(updated);
        }
        return;
      }
      if (next.every((c) => c !== 0)) {
        setOutcome("draw");
        const updated = {
          ...seriesRef.current,
          draws: seriesRef.current.draws + 1,
        };
        seriesRef.current = updated;
        setSeries(updated);
      }
    },
    [setSeries, submit],
  );

  const drop = (col: number) => {
    if (outcome !== "playing" || thinking) return;
    const row = dropRow(board, col);
    if (row < 0) return; // column full

    const next = [...board];
    next[row * COLS + col] = 1;
    setBoard(next);
    if (findWin(next) || next.every((c) => c !== 0)) {
      finish(next);
      return;
    }

    setThinking(true);
    cpuTimer.current = setTimeout(() => {
      const reply = [...next];
      const move = cpuMove(reply);
      if (move >= 0) {
        const cpuRow = dropRow(reply, move);
        if (cpuRow >= 0) reply[cpuRow * COLS + move] = 2;
      }
      setBoard(reply);
      setThinking(false);
      finish(reply);
    }, 380);
  };

  const newRound = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setBoard(emptyBoard());
    setOutcome("playing");
    setWinCells([]);
    setThinking(false);
  }, []);

  const statusText =
    outcome === "won"
      ? "Four in a row! 🎉"
      : outcome === "lost"
        ? "CPU connects four 🤖"
        : outcome === "draw"
          ? "Board locked — draw"
          : thinking
            ? "CPU is thinking…"
            : "Your turn (🔴)";

  return (
    <div className="w-full max-w-[520px]">
      <div className="mb-3 grid grid-cols-3 gap-2 font-mono text-xs uppercase tracking-wider">
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-center text-rose-300">
          You <b className="ml-1 text-sm text-ink">{series.you}</b>
        </div>
        <div className="rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-muted">
          Draw <b className="ml-1 text-sm text-ink">{series.draws}</b>
        </div>
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-center text-amber-300">
          CPU <b className="ml-1 text-sm text-ink">{series.cpu}</b>
        </div>
      </div>

      <div className="relative rounded-2xl border border-line bg-gradient-to-b from-[#14142a] to-[#0d0d1c] p-3 shadow-[0_0_60px_-24px_rgba(251,191,36,0.7)]">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {board.map((cell, i) => {
            const col = i % COLS;
            const isWin = winCells.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => drop(col)}
                aria-label={`Column ${col + 1}`}
                disabled={outcome !== "playing" || thinking}
                className={cn(
                  "group grid aspect-square place-items-center rounded-full border transition",
                  isWin
                    ? "border-success/80 bg-success/20"
                    : "border-[#1e1e38] bg-[#0a0a16] hover:border-primary/60",
                )}
              >
                {cell !== 0 && (
                  <span
                    className={cn(
                      "h-[78%] w-[78%] rounded-full shadow-inner transition group-hover:brightness-110",
                      cell === 1
                        ? "animate-pop bg-gradient-to-br from-rose-400 to-red-600 shadow-[0_0_16px_-6px_rgba(244,63,94,0.9)]"
                        : "animate-pop bg-gradient-to-br from-amber-300 to-yellow-500 shadow-[0_0_16px_-6px_rgba(251,191,36,0.9)]",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        {outcome !== "playing" && (
          <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/65 p-5 text-center backdrop-blur-[2px]">
            <div>
              <p className="font-display text-2xl font-bold text-white">
                {statusText}
              </p>
              {newBest && (
                <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                  ✦ Most games won — new best!
                </p>
              )}
              <p className="mt-2 text-xs uppercase tracking-widest text-muted">
                All-time wins {best ?? 0} · Series {series.you}–{series.draws}–
                {series.cpu}
              </p>
              <button
                type="button"
                onClick={newRound}
                className="mt-5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-7 py-2.5 text-sm font-bold text-black shadow-lg transition hover:brightness-110 active:scale-95"
              >
                New round
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Click a column to drop · your series is saved in this browser
      </p>
    </div>
  );
}
