"use client";

import { useCallback, useEffect, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const SIZE = 4;
const CELLS = SIZE * SIZE;

const SOLVED = Array.from({ length: CELLS }, (_, i) =>
  i === CELLS - 1 ? 0 : i + 1,
);

function isSolved(tiles: number[]): boolean {
  return tiles.every((v, i) => v === SOLVED[i]);
}

function neighbors(index: number): number[] {
  const r = Math.floor(index / SIZE);
  const c = index % SIZE;
  const out: number[] = [];
  if (r > 0) out.push(index - SIZE);
  if (r < SIZE - 1) out.push(index + SIZE);
  if (c > 0) out.push(index - 1);
  if (c < SIZE - 1) out.push(index + 1);
  return out;
}

/** Shuffle = 200 random legal moves from the solved board (always solvable). */
function shuffleTiles(): number[] {
  const tiles = [...SOLVED];
  let blank = CELLS - 1;
  let last = -1;
  for (let i = 0; i < 200; i++) {
    const options = neighbors(blank).filter((n) => n !== last);
    const pick = options[Math.floor(Math.random() * options.length)];
    last = blank;
    [tiles[blank], tiles[pick]] = [tiles[pick], tiles[blank]];
    blank = pick;
  }
  if (isSolved(tiles)) {
    const swap = neighbors(blank)[0];
    [tiles[blank], tiles[swap]] = [tiles[swap], tiles[blank]];
  }
  return tiles;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */

export default function Sliding15({ gameId }: { gameId: string }) {
  const [tiles, setTiles] = useState<number[]>(() => shuffleTiles());
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
    setTiles(shuffleTiles());
    setMoves(0);
    setStarted(false);
    setElapsed(0);
    setWon(false);
    setNewBest(false);
  }, []);

  /** Move the tile at `index` into the blank if it's adjacent. */
  const slideAt = useCallback(
    (index: number) => {
      if (won) return;
      const blank = tiles.indexOf(0);
      if (!neighbors(blank).includes(index)) return;
      if (!started) setStarted(true);

      const next = [...tiles];
      [next[blank], next[index]] = [next[index], next[blank]];
      const nextMoves = moves + 1;
      setTiles(next);
      setMoves(nextMoves);

      if (isSolved(next)) {
        const seconds = Math.max(1, elapsed);
        setElapsed(seconds);
        setWon(true);
        setNewBest(submit(nextMoves));
      }
    },
    [tiles, won, started, moves, elapsed, submit],
  );

  /** Arrow direction = direction the tile travels into the blank. */
  const slideDirection = useCallback(
    (dx: number, dy: number) => {
      if (won) return;
      const blank = tiles.indexOf(0);
      const r = Math.floor(blank / SIZE) + dy;
      const c = (blank % SIZE) + dx;
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return;
      slideAt(r * SIZE + c);
    },
    [tiles, won, slideAt],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        slideDirection(0, 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        slideDirection(0, -1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        slideDirection(1, 0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        slideDirection(-1, 0);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        newGame();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slideDirection, newGame]);

  return (
    <div className="w-full max-w-[420px]">
      <GameHud
        score={`${moves} moves`}
        best={best === null ? "—" : `${best} moves`}
        accent="text-cyan-400"
      >
        <span className="text-muted">
          Time{" "}
          <b className="ml-1 text-sm tabular-nums text-ink">
            {formatClock(elapsed)}
          </b>
        </span>
      </GameHud>

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={newGame}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
        >
          ⟳ New game (R)
        </button>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(56,189,248,0.7)]">
        <div className="grid grid-cols-4 gap-2">
          {tiles.map((value, i) => {
            if (value === 0) {
              return (
                <div
                  key="blank"
                  aria-hidden
                  className="aspect-square rounded-xl border border-dashed border-line/40"
                />
              );
            }
            return (
              <button
                key={value}
                type="button"
                onClick={() => slideAt(i)}
                aria-label={`Tile ${value}`}
                className={cn(
                  "grid aspect-square select-none place-items-center rounded-xl border border-line bg-gradient-to-br from-[#1b1b33] to-[#131322] font-display text-2xl font-bold text-ink transition hover:border-cyan-400/60 hover:text-cyan-300 active:scale-95 sm:text-3xl",
                )}
              >
                {value}
              </button>
            );
          })}
        </div>

        {won && (
          <Overlay>
            <p className="text-4xl">🔟</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              PUZZLE IN ORDER
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fewest moves!
              </p>
            )}
            <p className="mt-3 font-mono text-3xl font-bold text-white">
              {moves} moves · {formatClock(elapsed)}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : `${best} moves`}
            </p>
            <PrimaryButton
              onClick={newGame}
              tone="from-sky-400 via-blue-500 to-indigo-600"
            >
              Shuffle again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap a tile next to the gap — or use the arrow keys — to slide it home
      </p>
    </div>
  );
}
