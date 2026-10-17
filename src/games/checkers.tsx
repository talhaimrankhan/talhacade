"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

/* ------------------------------------------------------------------ */
/* English draughts engine (pure)                                      */
/* ------------------------------------------------------------------ */

/** 0 empty · 1 your man · 2 your king · 3 CPU man · 4 CPU king */
type Board = number[];

interface CMove {
  from: number;
  lands: number[];
  caps: number[];
}

type Outcome = "playing" | "won" | "lost";
interface Series { you: number; draws: number; cpu: number }

const ROW = (i: number) => (i / 8) | 0;
const COL = (i: number) => i % 8;
const OWNER = [0, 1, 1, 2, 2];
const IS_KING = [false, false, true, false, true];
const KING = [0, 2, 4];
const UP = [[-1, -1], [-1, 1]];
const DOWN = [[1, -1], [1, 1]];
const ALL_D = [...UP, ...DOWN];
const MATE = 100000;
/** Search height below the root move — benchmarked at 25–55ms per reply. */
const CPU_DEPTH = 6;

const dirsFor = (p: number): number[][] =>
  IS_KING[p] ? ALL_D : OWNER[p] === 1 ? UP : DOWN;

const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

function initialBoard(): Board {
  const b: Board = Array(64).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r * 8 + c] = 3;
  }
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r * 8 + c] = 1;
  }
  return b;
}

/** Depth-first over every jump chain. A man crowned mid-capture stops there. */
function captureSeqs(
  board: Board,
  from: number,
  piece: number,
  lands: number[],
  caps: number[],
  out: CMove[],
): void {
  const side = OWNER[piece];
  const r = ROW(from);
  const c = COL(from);
  let found = false;
  for (const [dr, dc] of dirsFor(piece)) {
    const mr = r + dr;
    const mc = c + dc;
    const lr = r + 2 * dr;
    const lc = c + 2 * dc;
    if (!inside(mr, mc) || !inside(lr, lc)) continue;
    const mid = mr * 8 + mc;
    const land = lr * 8 + lc;
    const victim = board[mid];
    if (!victim || OWNER[victim] === side || board[land] !== 0) continue;
    found = true;
    const next = board.slice();
    next[from] = 0;
    next[mid] = 0;
    let placed = piece;
    const crowned =
      !IS_KING[piece] && ((side === 1 && lr === 0) || (side === 2 && lr === 7));
    if (crowned) placed = KING[side];
    next[land] = placed;
    const nLands = [...lands, land];
    const nCaps = [...caps, mid];
    if (crowned) out.push({ from, lands: nLands, caps: nCaps });
    else captureSeqs(next, land, placed, nLands, nCaps, out);
  }
  if (!found && lands.length > 0) out.push({ from, lands, caps });
}

/** Forced captures, otherwise simple diagonal steps. */
function genMoves(board: Board, side: 1 | 2): CMove[] {
  const caps: CMove[] = [];
  for (let i = 0; i < 64; i++) {
    if (OWNER[board[i]] === side) captureSeqs(board, i, board[i], [], [], caps);
  }
  if (caps.length > 0) return caps;

  const moves: CMove[] = [];
  for (let i = 0; i < 64; i++) {
    const piece = board[i];
    if (OWNER[piece] !== side) continue;
    const r = ROW(i);
    const c = COL(i);
    for (const [dr, dc] of dirsFor(piece)) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inside(nr, nc)) continue;
      const t = nr * 8 + nc;
      if (board[t] !== 0) continue;
      moves.push({ from: i, lands: [t], caps: [] });
    }
  }
  return moves;
}

/** Play a whole move (the CPU's multi-jumps resolve in one go). */
function applyCMove(board: Board, m: CMove): Board {
  const next = board.slice();
  const piece = next[m.from];
  const land = m.lands[m.lands.length - 1];
  next[m.from] = 0;
  for (const c of m.caps) next[c] = 0;
  let placed = piece;
  if (
    !IS_KING[piece] &&
    ((OWNER[piece] === 1 && ROW(land) === 0) || (OWNER[piece] === 2 && ROW(land) === 7))
  ) {
    placed = KING[OWNER[piece]];
  }
  next[land] = placed;
  return next;
}

/** Material plus the value of men racing for the king row. */
function evaluate(board: Board): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const piece = board[i];
    if (!piece) continue;
    const side = OWNER[piece];
    const value = IS_KING[piece]
      ? 175
      : 100 + (side === 2 ? ROW(i) : 7 - ROW(i)) * 6;
    score += side === 2 ? value : -value;
  }
  return score;
}

function minimax(board: Board, depth: number, alpha: number, beta: number, side: 1 | 2): number {
  const moves = genMoves(board, side);
  if (moves.length === 0) return side === 2 ? -MATE - depth : MATE + depth;
  if (depth === 0) return evaluate(board);
  // Longest capture chains and crowns first — alpha-beta prunes far harder.
  moves.sort((a, b) => b.caps.length - a.caps.length + (b.lands.length - a.lands.length));

  if (side === 2) {
    let value = -Infinity;
    for (const m of moves) {
      value = Math.max(value, minimax(applyCMove(board, m), depth - 1, alpha, beta, 1));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }
  let value = Infinity;
  for (const m of moves) {
    value = Math.min(value, minimax(applyCMove(board, m), depth - 1, alpha, beta, 2));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

function cpuMove(board: Board): CMove | null {
  const moves = genMoves(board, 2);
  if (moves.length === 0) return null;
  moves.sort((a, b) => b.caps.length - a.caps.length);
  let best = -Infinity;
  let choice = moves[0];
  for (const m of moves) {
    const score = minimax(applyCMove(board, m), CPU_DEPTH, -Infinity, Infinity, 1);
    if (score > best || (score === best && Math.random() < 0.3)) {
      best = score;
      choice = m;
    }
  }
  return choice;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Checkers({ gameId }: { gameId: string }) {
  const [board, setBoard] = useState<Board>(() => initialBoard());
  const [sel, setSel] = useState<number | null>(null);
  /** A multi-jump the player is part-way through: which move, which segment. */
  const [pending, setPending] = useState<{ move: CMove; step: number } | null>(null);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [outcome, setOutcome] = useState<Outcome>("playing");
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

  const moves = useMemo(
    () => (turn === 1 && outcome === "playing" ? genMoves(board, 1) : []),
    [board, turn, outcome],
  );

  const targets = useMemo(
    () =>
      pending
        ? [pending.move.lands[pending.step]]
        : moves
            .filter((m) => m.from === sel)
            .map((m) => m.lands[0]),
    [moves, pending, sel],
  );

  const finish = useCallback(
    (result: Outcome) => {
      setOutcome(result);
      const s = seriesRef.current;
      const key = result === "won" ? "you" : "cpu";
      const updated: Series = { ...s, [key]: s[key] + 1 };
      seriesRef.current = updated;
      setSeries(updated);
      if (result === "won") setNewBest(submit(updated.you));
    },
    [setSeries, submit],
  );

  const startCpu = useCallback(
    (current: Board) => {
      setThinking(true);
      cpuTimer.current = setTimeout(() => {
        const move = cpuMove(current);
        setThinking(false);
        if (!move) {
          finish("won");
          return;
        }
        const reply = applyCMove(current, move);
        setBoard(reply);
        if (genMoves(reply, 1).length === 0) finish("lost");
        else setTurn(1);
      }, 320);
    },
    [finish],
  );

  /** Called when the player's move (or jump chain) is fully complete. */
  const handOver = (next: Board) => {
    setSel(null);
    setPending(null);
    if (genMoves(next, 2).length === 0) {
      finish("won");
      return;
    }
    setTurn(2);
    startCpu(next);
  };

  /** Plays one segment (a single hop or step) of the chosen move. */
  const playSegment = (m: CMove, step: number) => {
    const from = step === 0 ? m.from : m.lands[step - 1];
    const land = m.lands[step];
    const cap = m.caps[step];
    const piece = board[from];
    const side = OWNER[piece];
    const crowned =
      step === m.lands.length - 1 &&
      !IS_KING[piece] &&
      ((side === 1 && ROW(land) === 0) || (side === 2 && ROW(land) === 7));
    const next = board.slice();
    next[from] = 0;
    if (cap !== undefined) next[cap] = 0;
    next[land] = crowned ? KING[side] : piece;
    setBoard(next);
    if (step + 1 < m.lands.length) setPending({ move: m, step: step + 1 });
    else handOver(next);
  };

  const onCell = (i: number) => {
    if (outcome !== "playing" || turn !== 1 || thinking) return;
    if (pending) {
      if (pending.move.lands[pending.step] === i) playSegment(pending.move, pending.step);
      return;
    }
    const hit = moves.find((m) => m.lands[0] === i && m.from === sel);
    if (hit) {
      playSegment(hit, 0);
      return;
    }
    const piece = board[i];
    if (piece && OWNER[piece] === 1 && moves.some((m) => m.from === i)) setSel(i);
    else setSel(null);
  };

  const newGame = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setBoard(initialBoard());
    setSel(null);
    setPending(null);
    setTurn(1);
    setOutcome("playing");
    setThinking(false);
    setNewBest(false);
  }, []);

  let count1 = 0;
  let count2 = 0;
  for (const p of board) {
    if (OWNER[p] === 1) count1++;
    else if (OWNER[p] === 2) count2++;
  }

  const statusText =
    outcome === "won"
      ? "CPU has no men left \uD83C\uDF89"
      : outcome === "lost"
        ? "You're blocked out \uD83E\uDD16"
        : thinking
          ? "CPU is thinking\u2026"
          : pending
            ? "Keep jumping \u2014 same piece"
            : moves.some((m) => m.caps.length > 0)
              ? "Capture is forced!"
              : "Your move (\u25CF)";

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
        <span className="text-muted">
          Men <b className="text-cyan-400">{count1}</b> &middot;{" "}
          <b className="text-rose-400">{count2}</b>
        </span>
        <button
          type="button"
          onClick={newGame}
          className="rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
        >
          New game
        </button>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-2 shadow-[0_0_60px_-24px_rgba(34,211,238,0.7)] sm:p-3">
        <div className="grid grid-cols-8 gap-px overflow-hidden rounded-lg border border-line bg-line">
          {Array.from({ length: 64 }, (_, i) => {
            const r = ROW(i);
            const c = COL(i);
            const piece = board[i];
            const dark = (r + c) % 2 === 1;
            const isSel = sel === i;
            const isTarget = targets.includes(i);
            const isPending = pending !== null && pending.move.lands[pending.step] === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onCell(i)}
                aria-label={`${String.fromCharCode(97 + c)}${8 - r}${piece ? (OWNER[piece] === 1 ? " your piece" : " CPU piece") : ""}${isTarget ? " destination" : ""}`}
                className={cn(
                  "relative grid aspect-square select-none place-items-center border border-transparent text-2xl leading-none transition hover:border-primary/50 hover:brightness-110 sm:text-3xl",
                  dark ? "bg-[#141426]" : "bg-[#282849]",
                  isSel && "z-10 shadow-[inset_0_0_0_2px_#22d3ee]",
                )}
              >
                {piece > 0 && (
                  <span className={OWNER[piece] === 1 ? "text-cyan-400" : "text-rose-400"}>
                    {IS_KING[piece] ? "\u25C9" : "\u25CF"}
                  </span>
                )}
                {isTarget && !piece && (
                  <span
                    className={cn(
                      "pointer-events-none absolute h-3 w-3 rounded-full bg-cyan-400/70",
                      isPending && "h-4 w-4 animate-pulse bg-cyan-300",
                    )}
                  />
                )}
                {isTarget && piece > 0 && (
                  <span className="pointer-events-none absolute h-3.5 w-3.5 rounded-full border-2 border-rose-400/80" />
                )}
              </button>
            );
          })}
        </div>

        {outcome !== "playing" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {outcome === "won" ? "You cleared the board! \uD83C\uDF89" : "CPU takes the round \uD83E\uDD16"}
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
                  : "from-amber-400 via-orange-500 to-red-500"
              }
            >
              New game
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Click a man, then a highlighted square &middot; jumps beat everything
      </p>
    </div>
  );
}
