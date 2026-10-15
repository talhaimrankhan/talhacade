"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

type Dir = "left" | "right" | "up" | "down";
type Status = "playing" | "over";

/** Cell indices per line, ordered toward the direction of movement. */
const LINES: Record<Dir, number[][]> = (() => {
  const lines: Record<Dir, number[][]> = { left: [], right: [], up: [], down: [] };
  for (let r = 0; r < 4; r++) {
    const row = [0, 1, 2, 3].map((c) => r * 4 + c);
    lines.left.push(row);
    lines.right.push([...row].reverse());
  }
  for (let c = 0; c < 4; c++) {
    const col = [0, 1, 2, 3].map((r) => r * 4 + c);
    lines.up.push(col);
    lines.down.push([...col].reverse());
  }
  return lines;
})();

const TILE_STYLES: Record<number, string> = {
  2: "bg-[#1c1c33] text-ink/80",
  4: "bg-[#26264a] text-ink",
  8: "bg-violet-500 text-white",
  16: "bg-violet-600 text-white",
  32: "bg-purple-500 text-white",
  64: "bg-fuchsia-500 text-white",
  128: "bg-fuchsia-400 text-white",
  256: "bg-cyan-500 text-white",
  512: "bg-cyan-400 text-black",
  1024: "bg-teal-400 text-black",
  2048:
    "bg-gradient-to-br from-amber-300 to-orange-500 text-black shadow-[0_0_34px_rgba(251,191,36,0.75)]",
};
const HIGHER_STYLE =
  "bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-[0_0_34px_rgba(244,114,182,0.7)]";

function tileStyle(value: number) {
  return TILE_STYLES[value] ?? HIGHER_STYLE;
}

function tileText(value: number) {
  if (value < 100) return "text-3xl sm:text-4xl";
  if (value < 1000) return "text-2xl sm:text-3xl";
  if (value < 10000) return "text-xl sm:text-2xl";
  return "text-lg sm:text-xl";
}

function spawn(tiles: number[]): void {
  const empty: number[] = [];
  tiles.forEach((v, i) => {
    if (v === 0) empty.push(i);
  });
  if (empty.length === 0) return;
  const i = empty[Math.floor(Math.random() * empty.length)];
  tiles[i] = Math.random() < 0.9 ? 2 : 4;
}

function newBoard(): number[] {
  const tiles = Array<number>(16).fill(0);
  spawn(tiles);
  spawn(tiles);
  return tiles;
}

function move(tiles: number[], dir: Dir) {
  let gained = 0;
  const next = tiles.slice();

  for (const line of LINES[dir]) {
    const values = line.map((i) => tiles[i]).filter((v) => v !== 0);
    const merged: number[] = [];
    let i = 0;
    while (i < values.length) {
      if (i + 1 < values.length && values[i] === values[i + 1]) {
        merged.push(values[i] * 2);
        gained += values[i] * 2;
        i += 2;
      } else {
        merged.push(values[i]);
        i += 1;
      }
    }
    while (merged.length < 4) merged.push(0);
    line.forEach((cell, k) => {
      next[cell] = merged[k];
    });
  }

  const moved = next.some((v, i) => v !== tiles[i]);
  return { tiles: next, gained, moved };
}

function canMove(tiles: number[]): boolean {
  if (tiles.some((v) => v === 0)) return true;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = tiles[r * 4 + c];
      if (c < 3 && v === tiles[r * 4 + c + 1]) return true;
      if (r < 3 && v === tiles[(r + 1) * 4 + c]) return true;
    }
  }
  return false;
}

export default function Game2048({ gameId }: { gameId: string }) {
  const [tiles, setTiles] = useState<number[]>(() => newBoard());
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [milestone, setMilestone] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const tilesRef = useRef<number[]>(tiles);
  const scoreRef = useRef(0);
  const statusRef = useRef<Status>("playing");
  const milestoneShownRef = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const restart = useCallback(() => {
    const board = newBoard();
    tilesRef.current = board;
    scoreRef.current = 0;
    statusRef.current = "playing";
    milestoneShownRef.current = false;
    setTiles(board);
    setScore(0);
    setStatus("playing");
    setMilestone(false);
    setNewBest(false);
  }, []);

  const apply = useCallback(
    (dir: Dir) => {
      if (statusRef.current !== "playing") return;

      const result = move(tilesRef.current, dir);
      if (!result.moved) return;

      const board = result.tiles;
      spawn(board);
      tilesRef.current = board;
      setTiles(board);

      if (result.gained > 0) {
        scoreRef.current += result.gained;
        setScore(scoreRef.current);
      }

      if (!milestoneShownRef.current && board.some((v) => v >= 2048)) {
        milestoneShownRef.current = true;
        setMilestone(true);
      }

      if (!canMove(board)) {
        statusRef.current = "over";
        setStatus("over");
        setNewBest(submit(scoreRef.current));
      }
    },
    [submit],
  );

  /* ---------------- input ---------------- */

  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
      a: "left",
      d: "right",
      w: "up",
      s: "down",
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const dir = map[key];
      if (dir) {
        e.preventDefault();
        apply(dir);
      } else if (key === "r") {
        restart();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [apply, restart]);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    const t = e.changedTouches[0];
    touchStart.current = null;
    if (!start || !t) return;

    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;

    apply(
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up",
    );
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"}>
        <button
          type="button"
          onClick={restart}
          className="rounded-md border border-line px-2 py-1 text-ink transition hover:border-primary/60 hover:bg-surface-2"
        >
          New game
        </button>
      </GameHud>

      <div
        className="relative rounded-2xl border border-line bg-surface-2 p-2.5 shadow-[0_0_60px_-22px_rgba(168,85,247,0.9)] sm:p-3"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="grid grid-cols-4 gap-2.5 [touch-action:none] sm:gap-3">
          {tiles.map((value, i) => (
            <div
              key={`${i}-${value}`}
              className={cn(
                "grid aspect-square place-items-center rounded-xl font-display font-bold",
                value === 0
                  ? "bg-[#131322]"
                  : cn("animate-pop", tileStyle(value), tileText(value)),
              )}
            >
              {value !== 0 ? value : null}
            </div>
          ))}
        </div>

        {milestone && (
          <Overlay>
            <p className="text-4xl">🎉</p>
            <p className="mt-2 font-display text-3xl font-bold text-gradient-hot">
              2048!
            </p>
            <p className="mt-2 text-sm text-muted">
              You made the tile. Keep going for bragging rights.
            </p>
            <PrimaryButton onClick={() => setMilestone(false)} tone="from-amber-300 to-orange-500">
              Keep playing
            </PrimaryButton>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              NO MORE MOVES
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={restart} tone="from-amber-300 to-orange-500">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Arrow keys / WASD or swipe · R for a new game
      </p>
    </div>
  );
}
