"use client";

import { useCallback, useEffect, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const SIZE = 5;
const CELLS = SIZE * SIZE;

/** Clicking a cell toggles it and its orthogonal neighbours. */
function toggle(grid: boolean[], index: number): boolean[] {
  const next = [...grid];
  const r = Math.floor(index / SIZE);
  const c = index % SIZE;
  for (const [dr, dc] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= SIZE || nc >= SIZE) continue;
    const i = nr * SIZE + nc;
    next[i] = !next[i];
  }
  return next;
}

/** Scramble = 12–20 random clicks from all-off, so it's always solvable. */
function scramble(): boolean[] {
  for (let attempt = 0; attempt < 12; attempt++) {
    let grid = Array<boolean>(CELLS).fill(false);
    const clicks = 12 + Math.floor(Math.random() * 9);
    for (let i = 0; i < clicks; i++) {
      grid = toggle(grid, Math.floor(Math.random() * CELLS));
    }
    if (grid.some(Boolean)) return grid;
  }
  return toggle(Array<boolean>(CELLS).fill(false), 12);
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */

export default function LightsOut({ gameId }: { gameId: string }) {
  const [grid, setGrid] = useState<boolean[]>(() => scramble());
  const [moves, setMoves] = useState(0);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "low");

  // ticking clock while a game is in play
  useEffect(() => {
    if (!started || won) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [started, won]);

  const newGame = useCallback(() => {
    setGrid(scramble());
    setMoves(0);
    setStarted(false);
    setElapsed(0);
    setWon(false);
    setNewBest(false);
  }, []);

  const tap = useCallback(
    (index: number) => {
      if (won) return;
      if (!started) setStarted(true);

      const next = toggle(grid, index);
      const nextMoves = moves + 1;
      setGrid(next);
      setMoves(nextMoves);

      if (next.every((v) => !v)) {
        const seconds = Math.max(1, elapsed);
        setElapsed(seconds);
        setWon(true);
        setNewBest(submit(seconds));
      }
    },
    [grid, won, started, moves, elapsed, submit],
  );

  const lit = grid.filter(Boolean).length;

  return (
    <div className="w-full max-w-[400px]">
      <GameHud
        score={`${moves} moves`}
        best={best === null ? "—" : `${best}s`}
        accent="text-warn"
      >
        <span className="text-muted">
          Time{" "}
          <b className="ml-1 text-sm tabular-nums text-ink">
            {formatClock(elapsed)}
          </b>
        </span>
        <span className="text-muted">
          Lit <b className="ml-1 text-sm tabular-nums text-ink">{lit}</b>
        </span>
      </GameHud>

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={newGame}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
        >
          ⟳ New game
        </button>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(251,191,36,0.7)]">
        <div className="mx-auto grid max-w-[320px] grid-cols-5 gap-2.5">
          {grid.map((on, i) => (
            <button
              key={i}
              type="button"
              onClick={() => tap(i)}
              aria-label={`Light ${i + 1}, ${on ? "on" : "off"}`}
              className={cn(
                "aspect-square select-none rounded-xl border transition-all duration-200 active:scale-95",
                on
                  ? "border-amber-300/70 bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-600 shadow-[0_0_24px_rgba(251,191,36,0.65)]"
                  : "border-line bg-[#131322] hover:border-primary/40",
              )}
            />
          ))}
        </div>

        {won && (
          <Overlay>
            <p className="text-4xl">💡</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              LIGHTS OUT
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fastest clear!
              </p>
            )}
            <p className="mt-3 font-mono text-3xl font-bold text-white">
              {moves} moves · {formatClock(elapsed)}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : `${best}s`}
            </p>
            <PrimaryButton
              onClick={newGame}
              tone="from-yellow-400 via-amber-500 to-orange-600"
            >
              Scramble again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Each tap flips a plus-shaped cluster · kill every light to win
      </p>
    </div>
  );
}
