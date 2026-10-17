"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

/* ------------------------------------------------------------------ */
/* Levels — '#' wall, ' ' floor, '.' target, '$' box, '@' player,     */
/* '*' box on target, '+' player on target                            */
/* ------------------------------------------------------------------ */

const LEVELS: string[][] = [
  [
    "######",
    "#    #",
    "# +$.#",
    "#    #",
    "######",
  ],
  [
    "########",
    "#      #",
    "# @ $  #",
    "#  .   #",
    "#      #",
    "########",
  ],
  [
    "#######",
    "# . . #",
    "# $ * #",
    "#  @  #",
    "#     #",
    "#######",
  ],
  [
    "########",
    "#      #",
    "# @$   #",
    "#   .  #",
    "#  #   #",
    "#      #",
    "########",
  ],
  [
    "#########",
    "#       #",
    "# @     #",
    "# $$$   #",
    "# ...   #",
    "#       #",
    "#########",
  ],
  [
    "#########",
    "#       #",
    "# . . . #",
    "# $ @ $ #",
    "#   $   #",
    "#       #",
    "#########",
  ],
  [
    "#########",
    "#   #   #",
    "# $   $ #",
    "# . # . #",
    "#   @   #",
    "#       #",
    "#########",
  ],
  [
    "#########",
    "# @     #",
    "# $##   #",
    "#  .    #",
    "#       #",
    "#########",
  ],
  [
    "########",
    "#      #",
    "# @ $  #",
    "#   #  #",
    "#  .   #",
    "#      #",
    "########",
  ],
  [
    "#########",
    "#       #",
    "# @     #",
    "#  $$$  #",
    "#  ...  #",
    "#       #",
    "#########",
  ],
];

interface Level {
  cols: number;
  rows: number;
  walls: Set<number>;
  targets: Set<number>;
  startPlayer: number;
  startBoxes: number[];
}

function parseLevel(map: string[]): Level {
  const rows = map.length;
  const cols = map[0].length;
  const walls = new Set<number>();
  const targets = new Set<number>();
  const startBoxes: number[] = [];
  let startPlayer = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = map[r][c];
      const i = r * cols + c;
      if (ch === "#") walls.add(i);
      else if (ch === "." || ch === "*" || ch === "+") targets.add(i);
      if (ch === "$" || ch === "*") startBoxes.push(i);
      if (ch === "@" || ch === "+") startPlayer = i;
    }
  }
  return { cols, rows, walls, targets, startPlayer, startBoxes };
}

const PARSED = LEVELS.map(parseLevel);

interface Snapshot {
  player: number;
  boxes: number[];
}

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */

export default function BoxPush({ gameId }: { gameId: string }) {
  const [levelIndex, setLevelIndex] = useState(0);
  const [player, setPlayer] = useState(PARSED[0].startPlayer);
  const [boxes, setBoxes] = useState<number[]>(PARSED[0].startBoxes);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [moves, setMoves] = useState(0);
  const [wonLevel, setWonLevel] = useState(false);
  const [cleared, setCleared] = useStored<number[]>(`${gameId}-cleared`, []);
  const { best, submit } = useBestScore(gameId, "high");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const level = PARSED[levelIndex];

  const loadLevel = useCallback((index: number) => {
    setLevelIndex(index);
    setPlayer(PARSED[index].startPlayer);
    setBoxes(PARSED[index].startBoxes);
    setHistory([]);
    setMoves(0);
    setWonLevel(false);
  }, []);

  const move = useCallback(
    (dx: number, dy: number) => {
      if (wonLevel) return;
      const cols = level.cols;
      const target = player + dy * cols + dx;
      // reject row wrap on horizontal moves + wall bumps
      if (level.walls.has(target)) return;
      if (dx !== 0 && Math.floor(target / cols) !== Math.floor(player / cols))
        return;

      let nextBoxes = boxes;
      if (boxes.includes(target)) {
        const beyond = target + dy * cols + dx;
        if (level.walls.has(beyond) || boxes.includes(beyond)) return;
        nextBoxes = boxes.map((b) => (b === target ? beyond : b));
      }

      setHistory((h) => [...h, { player, boxes }]);
      setPlayer(target);
      setBoxes(nextBoxes);
      setMoves((m) => m + 1);

      if (nextBoxes.every((b) => level.targets.has(b))) {
        setWonLevel(true);
        if (!cleared.includes(levelIndex)) {
          const next = [...cleared, levelIndex];
          setCleared(next);
          submit(next.length);
        }
      }
    },
    [level, player, boxes, wonLevel, cleared, levelIndex, setCleared, submit],
  );

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setPlayer(prev.player);
    setBoxes(prev.boxes);
    setMoves((m) => Math.max(0, m - 1));
    setWonLevel(false);
  }, [history]);

  const restartLevel = useCallback(() => {
    loadLevel(levelIndex);
  }, [loadLevel, levelIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "arrowup" || k === "w") {
        e.preventDefault();
        move(0, -1);
      } else if (k === "arrowdown" || k === "s") {
        e.preventDefault();
        move(0, 1);
      } else if (k === "arrowleft" || k === "a") {
        e.preventDefault();
        move(-1, 0);
      } else if (k === "arrowright" || k === "d") {
        e.preventDefault();
        move(1, 0);
      } else if (k === "z") {
        e.preventDefault();
        undo();
      } else if (k === "r") {
        e.preventDefault();
        restartLevel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, undo, restartLevel]);

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 26 && Math.abs(dy) < 26) return;
    suppressClick.current = true;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
    else move(0, dy > 0 ? 1 : -1);
  };

  const onCellTap = (index: number) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const dr = Math.floor(index / level.cols) - Math.floor(player / level.cols);
    const dc = (index % level.cols) - (player % level.cols);
    if (Math.abs(dr) + Math.abs(dc) === 1) move(dc, dr);
  };

  const { cols, rows } = level;

  return (
    <div className="w-full max-w-[480px]">
      {/* HUD */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Level{" "}
          <b className="ml-1 text-sm tabular-nums text-ink">
            {levelIndex + 1}/{LEVELS.length}
          </b>
        </span>
        <span>
          Moves <b className="ml-1 text-sm tabular-nums text-ink">{moves}</b>
        </span>
        <span>
          Undo left{" "}
          <b className="ml-1 text-sm tabular-nums text-ink">{history.length}</b>
        </span>
        <span className="text-warn">
          Best{" "}
          <b className="ml-1 text-sm tabular-nums text-ink">
            {best ?? 0}/{LEVELS.length}
          </b>
        </span>
      </div>

      {/* level select */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {LEVELS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => loadLevel(i)}
            aria-label={`Level ${i + 1}${cleared.includes(i) ? " (cleared)" : ""}`}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg border font-mono text-xs font-bold transition",
              i === levelIndex
                ? "border-primary/70 bg-primary/20 text-ink shadow-[0_0_16px_-6px_rgba(139,92,246,0.9)]"
                : cleared.includes(i)
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-line bg-[#131322] text-muted hover:text-ink",
            )}
          >
            {cleared.includes(i) ? "✓" : i + 1}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={undo}
          disabled={history.length === 0}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink disabled:opacity-40"
        >
          ↩ Undo (Z)
        </button>
        <button
          type="button"
          onClick={restartLevel}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
        >
          ⟳ Restart (R)
        </button>
      </div>

      {/* board */}
      <div
        className="relative touch-none rounded-2xl border border-line bg-surface-2 p-2 shadow-[0_0_60px_-24px_rgba(251,146,60,0.6)]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="mx-auto grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            maxWidth: cols * 44,
          }}
        >
          {Array.from({ length: cols * rows }, (_, i) => {
            const wall = level.walls.has(i);
            const isTarget = level.targets.has(i);
            const isBox = boxes.includes(i);
            const isPlayer = player === i;
            return (
              <div
                key={i}
                role="gridcell"
                aria-label={
                  wall
                    ? "Wall"
                    : `${isPlayer ? "Player" : isBox ? "Box" : "Floor"}${
                        isTarget ? " on target" : ""
                      }`
                }
                onClick={() => onCellTap(i)}
                className={cn(
                  "relative grid aspect-square select-none place-items-center rounded text-xl leading-none",
                  wall
                    ? "bg-[#0c0c18]"
                    : "bg-[#131322] hover:bg-[#191933]",
                  isTarget && !wall && "border border-dashed border-amber-400/50",
                )}
              >
                {isTarget && !isBox && !isPlayer && (
                  <span className="h-2 w-2 rounded-full bg-amber-400/60" />
                )}
                {isBox && (
                  <span
                    className={cn(
                      "drop-shadow",
                      isTarget && "animate-pop",
                    )}
                  >
                    📦
                  </span>
                )}
                {isPlayer && <span>🧑‍🏭</span>}
              </div>
            );
          })}
        </div>

        {wonLevel && (
          <Overlay>
            <p className="text-4xl">📦✨</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              LEVEL CLEARED
            </p>
            <p className="mt-3 font-mono text-3xl font-bold text-white">
              {moves} moves
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {cleared.length}/{LEVELS.length} levels cleared
            </p>
            <div className="flex items-center justify-center gap-3">
              <PrimaryButton
                onClick={() =>
                  loadLevel(levelIndex + 1 < LEVELS.length ? levelIndex + 1 : 0)
                }
                tone="from-amber-400 via-orange-500 to-red-500"
              >
                {levelIndex + 1 < LEVELS.length ? "Next level" : "Back to 1"}
              </PrimaryButton>
            </div>
            <button
              type="button"
              onClick={restartLevel}
              className="mt-3 text-xs uppercase tracking-widest text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Replay this level
            </button>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Arrows / WASD or swipe to move & push · every crate on a dot clears the
        level · Z undoes anything
      </p>
    </div>
  );
}
