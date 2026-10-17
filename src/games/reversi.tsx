"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

/* ------------------------------------------------------------------ */
/* Othello engine (pure)                                               */
/* ------------------------------------------------------------------ */

/** 0 empty · 1 you · 2 CPU */
type Board = number[];
interface Series { you: number; draws: number; cpu: number }

const ROW = (i: number) => (i / 8) | 0;
const COL = (i: number) => i % 8;
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const foe = (side: number) => (side === 1 ? 2 : 1);
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];
/** Search height below the CPU's move. */
const CPU_DEPTH = 3;

/** Corner-heavy positional weights, index 0 = a8 … 63 = h1. */
const W = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];

function initialBoard(): Board {
  const b: Board = Array(64).fill(0);
  b[28] = 1;
  b[35] = 1;
  b[27] = 2;
  b[36] = 2;
  return b;
}

function flipsFor(board: Board, i: number, side: number): number[] {
  if (board[i] !== 0) return [];
  const r = ROW(i);
  const c = COL(i);
  const other = foe(side);
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let nr = r + dr;
    let nc = c + dc;
    while (inside(nr, nc) && board[nr * 8 + nc] === other) {
      line.push(nr * 8 + nc);
      nr += dr;
      nc += dc;
    }
    if (line.length > 0 && inside(nr, nc) && board[nr * 8 + nc] === side) {
      out.push(...line);
    }
  }
  return out;
}

function validMoves(board: Board, side: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) {
    if (board[i] === 0 && flipsFor(board, i, side).length > 0) out.push(i);
  }
  return out;
}

function applyFlip(board: Board, i: number, side: number): Board {
  const next = board.slice();
  next[i] = side;
  for (const f of flipsFor(board, i, side)) next[f] = side;
  return next;
}

function discs(board: Board, side: number): number {
  let n = 0;
  for (const cell of board) if (cell === side) n++;
  return n;
}

/** Positional weight + mobility, scored from the CPU's seat. */
function evaluate(board: Board): number {
  let pos = 0;
  for (let i = 0; i < 64; i++) {
    if (board[i] === 2) pos += W[i];
    else if (board[i] === 1) pos -= W[i];
  }
  const mine = discs(board, 2);
  const theirs = discs(board, 1);
  if (mine + theirs === 64) return (mine - theirs) * 500;
  const mobility = validMoves(board, 2).length - validMoves(board, 1).length;
  return pos + 14 * mobility + 5 * (mine - theirs);
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  turn: number,
): number {
  const moves = validMoves(board, turn);
  if (moves.length === 0) {
    // Pass — only terminal once neither side can move.
    if (validMoves(board, foe(turn)).length === 0) return evaluate(board);
    return minimax(board, depth, alpha, beta, foe(turn));
  }
  if (depth === 0) return evaluate(board);

  if (turn === 2) {
    let value = -Infinity;
    for (const m of moves) {
      value = Math.max(value, minimax(applyFlip(board, m, 2), depth - 1, alpha, beta, 1));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }
  let value = Infinity;
  for (const m of moves) {
    value = Math.min(value, minimax(applyFlip(board, m, 1), depth - 1, alpha, beta, 2));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

function cpuMove(board: Board): number {
  const moves = validMoves(board, 2);
  let best = -Infinity;
  let choice = moves[0] ?? -1;
  for (const m of moves) {
    const score = minimax(applyFlip(board, m, 2), CPU_DEPTH - 1, -Infinity, Infinity, 1);
    if (score > best || (score === best && Math.random() < 0.35)) {
      best = score;
      choice = m;
    }
  }
  return choice;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Reversi({ gameId }: { gameId: string }) {
  const [board, setBoard] = useState<Board>(() => initialBoard());
  const [last, setLast] = useState(-1);
  const [over, setOver] = useState<"won" | "lost" | "draw" | null>(null);
  const [overMsg, setOverMsg] = useState("");
  const [thinking, setThinking] = useState(false);
  const [note, setNote] = useState("");
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

  const open = validMoves(board, 1);
  const myCount = useMemo(() => discs(board, 1), [board]);
  const cpuCount = useMemo(() => discs(board, 2), [board]);

  const finish = useCallback(
    (result: "won" | "lost" | "draw", msg: string) => {
      setOver(result);
      setOverMsg(msg);
      const s = seriesRef.current;
      const key = result === "won" ? "you" : result === "lost" ? "cpu" : "draws";
      const updated: Series = { ...s, [key]: s[key] + 1 };
      seriesRef.current = updated;
      setSeries(updated);
      if (result === "won") setNewBest(submit(updated.you));
    },
    [setSeries, submit],
  );

  const endGame = (next: Board) => {
    const mine = discs(next, 1);
    const theirs = discs(next, 2);
    if (mine > theirs) finish("won", `${mine}\u2013${theirs} \u2014 you out-flip the CPU \uD83C\uDF89`);
    else if (theirs > mine) finish("lost", `${theirs}\u2013${mine} \u2014 CPU takes the board \uD83E\uDD16`);
    else finish("draw", `${mine}\u2013${theirs} \u2014 dead even`);
  };

  /** Hand the turn to the CPU, or pass / close the game if it can't move. */
  const startCpu = (current: Board) => {
    if (validMoves(current, 2).length === 0) {
      if (validMoves(current, 1).length === 0) endGame(current);
      else setNote("CPU has no move \u2014 you play on");
      return;
    }
    setNote("");
    setThinking(true);
    cpuTimer.current = setTimeout(() => {
      const move = cpuMove(current);
      const after = move >= 0 ? applyFlip(current, move, 2) : current;
      setBoard(after);
      setLast(move);
      setThinking(false);
      if (validMoves(after, 1).length > 0) return;
      if (validMoves(after, 2).length === 0) {
        endGame(after);
        return;
      }
      setNote("You have no move \u2014 CPU plays on");
      startCpu(after);
    }, 420);
  };

  const onCell = (i: number) => {
    if (over || thinking) return;
    if (flipsFor(board, i, 1).length === 0) return;
    const next = applyFlip(board, i, 1);
    setBoard(next);
    setLast(i);
    setNote("");
    startCpu(next);
  };

  const newGame = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setBoard(initialBoard());
    setLast(-1);
    setOver(null);
    setOverMsg("");
    setThinking(false);
    setNote("");
    setNewBest(false);
  }, []);

  const statusText = over
    ? overMsg
    : thinking
      ? "CPU is thinking\u2026"
      : note || "Your move \u2014 flip discs";

  return (
    <div className="w-full max-w-[520px]">
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
        <span className="flex items-center gap-3">
          <span className="text-cyan-400">
            &#9679; <b className="text-ink">{myCount}</b>
          </span>
          <span className="text-rose-400">
            &#9679; <b className="text-ink">{cpuCount}</b>
          </span>
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
        <div className="grid grid-cols-8 gap-px overflow-hidden rounded-lg border border-line bg-line">
          {Array.from({ length: 64 }, (_, i) => {
            const cell = board[i];
            const isOpen = !over && !thinking && open.includes(i);
            const isLast = last === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onCell(i)}
                aria-label={`${String.fromCharCode(97 + COL(i))}${8 - ROW(i)}${cell === 1 ? " your disc" : cell === 2 ? " CPU disc" : isOpen ? " empty, valid move" : " empty"}`}
                disabled={cell !== 0}
                className={cn(
                  "relative grid aspect-square select-none place-items-center rounded-none border border-transparent transition disabled:cursor-default",
                  cell === 0
                    ? "bg-[#123029] hover:border-primary/50 hover:brightness-125"
                    : "bg-[#0e2722]",
                  isLast && "ring-2 ring-inset ring-cyan-300/70",
                )}
              >
                {cell !== 0 && (
                  <span
                    className={cn(
                      "h-[70%] w-[70%] rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.6)]",
                      cell === 1
                        ? "animate-pop bg-gradient-to-br from-cyan-300 to-cyan-500"
                        : "animate-pop bg-gradient-to-br from-rose-300 to-rose-500",
                    )}
                  />
                )}
                {cell === 0 && isOpen && (
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-400/70" />
                )}
              </button>
            );
          })}
        </div>

        {over && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {over === "won" ? "Board flipped your way! \uD83C\uDF89" : over === "lost" ? "CPU smothers the board \uD83E\uDD16" : "Dead even \uD83E\uDD1D"}
            </p>
            <p className="mt-2 font-mono text-4xl font-bold text-white">
              {myCount} <span className="text-muted">&ndash;</span> {cpuCount}
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
                over === "won"
                  ? "from-cyan-400 via-sky-500 to-blue-600"
                  : over === "lost"
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
        Dots mark legal plays &middot; corners are worth more than anything else
      </p>
    </div>
  );
}
