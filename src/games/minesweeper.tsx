"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

interface Difficulty {
  id: string;
  name: string;
  cols: number;
  rows: number;
  mines: number;
}

const LEVELS: Difficulty[] = [
  { id: "beginner", name: "Beginner", cols: 9, rows: 9, mines: 10 },
  { id: "intermediate", name: "Medium", cols: 12, rows: 12, mines: 22 },
  { id: "expert", name: "Expert", cols: 15, rows: 15, mines: 40 },
];

const ADJ_COLORS: Record<number, string> = {
  1: "#60a5fa",
  2: "#34d399",
  3: "#fb7185",
  4: "#818cf8",
  5: "#fbbf24",
  6: "#22d3ee",
  7: "#f472b6",
  8: "#94a3b8",
};

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adj: number;
}

interface Board {
  cells: Cell[];
  level: Difficulty;
  armed: boolean;
  over: boolean;
  won: boolean;
  exploded: number;
}

function freshBoard(level: Difficulty): Board {
  return {
    cells: Array.from({ length: level.cols * level.rows }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adj: 0,
    })),
    level,
    armed: false,
    over: false,
    won: false,
    exploded: -1,
  };
}

/** Milliseconds since epoch — only ever called from click/timer handlers. */
function now(): number {
  return Date.now();
}

function neighbors(i: number, level: Difficulty): number[] {
  const r = Math.floor(i / level.cols);
  const c = i % level.cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= level.rows || nc >= level.cols) continue;
      out.push(nr * level.cols + nc);
    }
  }
  return out;
}

/** Places mines after the first click so the opening move is always safe. */
function armBoard(board: Board, safe: number): Board {
  const level = board.level;
  const cells = board.cells.map((cell) => ({ ...cell }));
  const forbidden = new Set([safe, ...neighbors(safe, level)]);
  const candidates: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (!forbidden.has(i)) candidates.push(i);
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (let m = 0; m < level.mines && m < candidates.length; m++) {
    cells[candidates[m]].mine = true;
  }
  for (let i = 0; i < cells.length; i++) {
    cells[i].adj = neighbors(i, level).filter((n) => cells[n].mine).length;
  }
  return { ...board, cells, armed: true };
}

function revealCell(board: Board, index: number): Board {
  const cells = board.cells.map((cell) => ({ ...cell }));
  const level = board.level;

  if (cells[index].mine) {
    cells.forEach((cell) => {
      if (cell.mine) cell.revealed = true;
    });
    return { ...board, cells, over: true, exploded: index };
  }

  const stack = [index];
  while (stack.length) {
    const i = stack.pop()!;
    const cell = cells[i];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.adj === 0) {
      for (const n of neighbors(i, level)) {
        if (!cells[n].revealed && !cells[n].flagged) stack.push(n);
      }
    }
  }

  const cleared = cells.every((cell) => cell.mine || cell.revealed);
  return { ...board, cells, won: cleared };
}

function toggleFlag(board: Board, index: number): Board {
  if (board.over || board.won) return board;
  const cell = board.cells[index];
  if (cell.revealed) return board;
  const cells = board.cells.map((c, i) =>
    i === index ? { ...c, flagged: !c.flagged } : c,
  );
  return { ...board, cells };
}

export default function Minesweeper({ gameId }: { gameId: string }) {
  const [level, setLevel] = useState<Difficulty>(LEVELS[0]);
  const [board, setBoard] = useState<Board>(() => freshBoard(LEVELS[0]));
  const [flagMode, setFlagMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "low");
  const startedAt = useRef<number>(0);

  const restart = useCallback(
    (next: Difficulty) => {
      setLevel(next);
      setBoard(freshBoard(next));
      setElapsed(0);
      setNewBest(false);
    },
    [],
  );

  // ticking clock
  useEffect(() => {
    if (!board.armed || board.over || board.won) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [board.armed, board.over, board.won]);

  const handleCell = (index: number) => {
    if (board.over || board.won) return;

    if (flagMode || board.cells[index].flagged) {
      setBoard((b) => toggleFlag(b, index));
      return;
    }

    let next = board;
    if (!next.armed) {
      next = armBoard(next, index);
      startedAt.current = now();
    }
    next = revealCell(next, index);

    if (next.won) {
      const seconds = Math.max(
        1,
        Math.round((now() - startedAt.current) / 1000),
      );
      setElapsed(seconds);
      setNewBest(submit(seconds));
    }
    setBoard(next);
  };

  const flagCount = board.cells.filter((c) => c.flagged).length;
  const remaining = level.mines - flagCount;

  const face = board.won
    ? "😎"
    : board.over
      ? "😵"
      : board.armed
        ? "🙂"
        : "🤔";

  return (
    <div className="w-full max-w-[560px]">
      {/* control panel */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2">
        <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-ink">
          💣 <span className="tabular-nums">{String(Math.max(0, remaining)).padStart(3, "0")}</span>
        </div>
        <button
          type="button"
          onClick={() => restart(level)}
          aria-label="Restart board"
          className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2 text-lg transition hover:scale-105 active:scale-90"
        >
          {face}
        </button>
        <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-ink">
          ⏱ <span className="tabular-nums">{String(elapsed).padStart(3, "0")}</span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => restart(l)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                l.id === level.id
                  ? "bg-primary text-white shadow-[0_0_18px_-6px_rgba(139,92,246,0.9)]"
                  : "border border-line text-muted hover:text-ink",
              )}
            >
              {l.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFlagMode((f) => !f)}
          aria-pressed={flagMode}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition",
            flagMode
              ? "bg-rose-500 text-white shadow-[0_0_18px_-6px_rgba(244,63,94,0.9)]"
              : "border border-line text-muted hover:text-ink",
          )}
        >
          🚩 Flag mode {flagMode ? "ON" : "off"}
        </button>
      </div>

      {/* board */}
      <div className="relative inline-block w-full rounded-2xl border border-line bg-surface-2 p-2 shadow-[0_0_60px_-24px_rgba(148,163,184,0.8)]">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))`,
            maxWidth: level.cols * 34,
            marginInline: "auto",
          }}
        >
          {board.cells.map((cell, i) => {
            const exploded = i === board.exploded;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleCell(i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setBoard((b) => toggleFlag(b, i));
                }}
                aria-label={`Cell ${i + 1}`}
                className={cn(
                  "grid aspect-square select-none items-center justify-center rounded font-mono text-[11px] font-bold transition sm:text-xs",
                  cell.revealed
                    ? exploded
                      ? "bg-rose-600 text-white"
                      : "bg-[#0f0f1e] text-ink"
                    : "bg-[#22223d] hover:bg-[#2c2c50]",
                )}
                style={
                  cell.revealed && !exploded && cell.adj > 0
                    ? { color: ADJ_COLORS[cell.adj] }
                    : undefined
                }
              >
                {cell.revealed
                  ? cell.mine
                    ? "💣"
                    : cell.adj > 0
                      ? cell.adj
                      : ""
                  : cell.flagged
                    ? "🚩"
                    : ""}
              </button>
            );
          })}
        </div>

        {board.won && (
          <Overlay>
            <p className="text-4xl">😎</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              FIELD CLEARED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fastest time!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {elapsed}s
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : `${best}s`}
            </p>
            <PrimaryButton onClick={() => restart(level)} tone="from-slate-300 to-slate-500">
              Play again
            </PrimaryButton>
          </Overlay>
        )}

        {board.over && !board.won && (
          <div className="animate-pop pointer-events-none absolute inset-x-0 bottom-3 grid place-items-center">
            <span className="rounded-full border border-rose-500/40 bg-black/80 px-4 py-2 text-xs font-bold uppercase tracking-widest text-rose-400 backdrop-blur">
              💥 Boom — tap the face to try again
            </span>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Click to reveal · right-click or flag mode to mark mines
      </p>
    </div>
  );
}
