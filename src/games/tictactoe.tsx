"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";

type Mark = "X" | "O";
type Cell = Mark | null;
type Outcome = "playing" | "won" | "lost" | "draw";

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function findWin(board: Cell[]): { mark: Mark; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a]!, line };
    }
  }
  return null;
}

/** Classic minimax — O (the CPU) plays perfectly and can never lose. */
function minimax(board: Cell[], turn: Mark, depth: number): number {
  const win = findWin(board);
  if (win) return win.mark === "O" ? 10 - depth : depth - 10;
  if (board.every((c) => c !== null)) return 0;

  if (turn === "O") {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      board[i] = "O";
      best = Math.max(best, minimax(board, "X", depth + 1));
      board[i] = null;
    }
    return best;
  }

  let best = Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = "X";
    best = Math.min(best, minimax(board, "O", depth + 1));
    board[i] = null;
  }
  return best;
}

function cpuMove(board: Cell[]): number {
  let bestScore = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = "O";
    const score = minimax(board, "X", 0);
    board[i] = null;
    if (score > bestScore) {
      bestScore = score;
      move = i;
    }
  }
  return move;
}

export default function TicTacToe({ gameId }: { gameId: string }) {
  const [board, setBoard] = useState<Cell[]>(Array<Cell>(9).fill(null));
  const [outcome, setOutcome] = useState<Outcome>("playing");
  const [winLine, setWinLine] = useState<number[]>([]);
  const [series, setSeries] = useStored(`series:${gameId}`, {
    you: 0,
    draws: 0,
    cpu: 0,
  });
  const [thinking, setThinking] = useState(false);
  const cpuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (cpuTimer.current) clearTimeout(cpuTimer.current);
    },
    [],
  );

  const finish = useCallback((next: Cell[]) => {
    const win = findWin(next);
    if (win) {
      setWinLine(win.line);
      setOutcome(win.mark === "X" ? "won" : "lost");
      setSeries((s) =>
        win.mark === "X"
          ? { ...s, you: s.you + 1 }
          : { ...s, cpu: s.cpu + 1 },
      );
      return true;
    }
    if (next.every((c) => c !== null)) {
      setOutcome("draw");
      setSeries((s) => ({ ...s, draws: s.draws + 1 }));
      return true;
    }
    return false;
  }, [setSeries]);

  const play = (index: number) => {
    if (outcome !== "playing" || board[index] || thinking) return;

    const next = [...board];
    next[index] = "X";
    setBoard(next);
    if (finish(next)) return;

    setThinking(true);
    cpuTimer.current = setTimeout(() => {
      const reply = [...next];
      const move = cpuMove(reply);
      if (move >= 0) reply[move] = "O";
      setBoard(reply);
      setThinking(false);
      finish(reply);
    }, 420);
  };

  const newRound = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setBoard(Array<Cell>(9).fill(null));
    setOutcome("playing");
    setWinLine([]);
    setThinking(false);
  }, []);

  const statusText =
    outcome === "won"
      ? "You win! 🎉"
      : outcome === "lost"
        ? "CPU wins 🤖"
        : outcome === "draw"
          ? "Draw — nobody blinks"
          : thinking
            ? "CPU is thinking…"
            : "Your move (❌)";

  return (
    <div className="w-full max-w-[420px]">
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

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(56,189,248,0.8)]">
        <div className="grid grid-cols-3 gap-2">
          {board.map((cell, i) => {
            const isWin = winLine.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => play(i)}
                aria-label={`Cell ${i + 1}${cell ? `: ${cell}` : ""}`}
                disabled={cell !== null || outcome !== "playing"}
                className={cn(
                  "grid aspect-square place-items-center rounded-xl border font-display text-4xl font-bold transition sm:text-5xl",
                  isWin
                    ? "border-success/70 bg-success/15 shadow-[0_0_26px_-8px_rgba(52,211,153,0.9)]"
                    : "border-line bg-[#131322] hover:border-primary/50 hover:bg-[#191933]",
                  !cell && outcome === "playing" && "cursor-pointer",
                )}
              >
                {cell && (
                  <span
                    className={cn(
                      "animate-pop",
                      cell === "X" ? "text-cyan-400" : "text-rose-400",
                    )}
                  >
                    {cell}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {outcome !== "playing" && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 p-5 text-center backdrop-blur-[2px]">
            <div>
              <p className="font-display text-2xl font-bold text-white">
                {statusText}
              </p>
              <p className="mt-1.5 text-xs uppercase tracking-widest text-muted">
                Series {series.you} – {series.draws} – {series.cpu}
              </p>
              <button
                type="button"
                onClick={newRound}
                className="mt-5 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 px-7 py-2.5 text-sm font-bold text-black shadow-lg transition hover:brightness-110 active:scale-95"
              >
                New round
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        {outcome === "playing" ? statusText : "Tap New round to clear the board"}
        {" · "}
        the CPU plays perfect minimax
      </p>
    </div>
  );
}
