"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const COLS = 10;
const ROWS = 20;
const CELL = 24;
const W = COLS * CELL;
const H = ROWS * CELL;
const LOCK_MS = 450;

type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
type Status = "idle" | "playing" | "over";
type Repeat = "left" | "right" | "soft";

const PIECE_COLOR: Record<PieceId, string> = {
  I: "#22d3ee",
  O: "#facc15",
  T: "#a78bfa",
  S: "#34d399",
  Z: "#f87171",
  J: "#60a5fa",
  L: "#fb923c",
};

const PIECE_CLASS: Record<PieceId, string> = {
  I: "bg-cyan-400",
  O: "bg-yellow-300",
  T: "bg-violet-400",
  S: "bg-emerald-400",
  Z: "bg-rose-400",
  J: "bg-blue-400",
  L: "bg-orange-400",
};

const BASE: Record<PieceId, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

const PIECE_IDS = Object.keys(BASE) as PieceId[];

function rotCW(m: number[][]): number[][] {
  const n = m.length;
  return m.map((row, y) => row.map((_, x) => m[n - 1 - x][y]));
}

/** All four rotation states, precomputed once at module load. */
const ROT: Record<PieceId, number[][][]> = (() => {
  const out = {} as Record<PieceId, number[][][]>;
  for (const id of PIECE_IDS) {
    const states = [BASE[id]];
    for (let i = 1; i < 4; i++) states.push(rotCW(states[i - 1]));
    out[id] = states;
  }
  return out;
})();

/** Simple wall-kick offsets tried in order when a rotation collides. */
const KICKS: [number, number][] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [-2, 0],
  [2, 0],
  [0, -1],
];

interface Piece {
  id: PieceId;
  rot: number;
  x: number;
  y: number;
}

interface BlocksGame {
  grid: (PieceId | null)[][];
  bag: PieceId[];
  cur: Piece;
  hold: PieceId | null;
  held: boolean;
  score: number;
  lines: number;
  level: number;
  combo: number;
  lockT: number;
  over: boolean;
  dirty: boolean;
}

function emptyGrid(): (PieceId | null)[][] {
  return Array.from({ length: ROWS }, () =>
    Array<PieceId | null>(COLS).fill(null),
  );
}

function shuffledBag(): PieceId[] {
  const bag = [...PIECE_IDS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function takeFromBag(g: BlocksGame): PieceId {
  if (g.bag.length === 0) g.bag = shuffledBag();
  const id = g.bag.shift()!;
  while (g.bag.length < 3) g.bag.push(...shuffledBag());
  return id;
}

function spawnPiece(id: PieceId): Piece {
  return { id, rot: 0, x: 3, y: 0 };
}

function createGame(): BlocksGame {
  const g: BlocksGame = {
    grid: emptyGrid(),
    bag: [],
    cur: spawnPiece("T"),
    hold: null,
    held: false,
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    lockT: 0,
    over: false,
    dirty: true,
  };
  g.cur = spawnPiece(takeFromBag(g));
  return g;
}

function canPlace(
  g: BlocksGame,
  id: PieceId,
  rot: number,
  px: number,
  py: number,
): boolean {
  const shape = ROT[id][rot];
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const gx = px + x;
      const gy = py + y;
      if (gx < 0 || gx >= COLS || gy >= ROWS) return false;
      if (gy >= 0 && g.grid[gy][gx]) return false;
    }
  }
  return true;
}

function gravityMs(level: number): number {
  return Math.max(80, 780 - (level - 1) * 70);
}

function spawnNext(g: BlocksGame, id: PieceId): void {
  g.cur = spawnPiece(id);
  g.held = false;
  g.lockT = 0;
  if (!canPlace(g, g.cur.id, g.cur.rot, g.cur.x, g.cur.y)) g.over = true;
  g.dirty = true;
}

function lockPiece(g: BlocksGame): void {
  const shape = ROT[g.cur.id][g.cur.rot];
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const gy = g.cur.y + y;
      const gx = g.cur.x + x;
      if (gy >= 0) g.grid[gy][gx] = g.cur.id;
    }
  }

  // clear full rows
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (g.grid[y].every((c) => c !== null)) {
      g.grid.splice(y, 1);
      g.grid.unshift(Array<PieceId | null>(COLS).fill(null));
      cleared++;
      y++;
    }
  }

  if (cleared > 0) {
    const table = [0, 100, 300, 500, 800];
    g.combo += 1;
    g.score += table[cleared] * g.level;
    if (g.combo > 0) g.score += 50 * g.combo * g.level;
    g.lines += cleared;
    g.level = Math.floor(g.lines / 10) + 1;
  } else {
    g.combo = -1;
  }

  spawnNext(g, takeFromBag(g));
}

function tryMove(g: BlocksGame, dx: number, dy: number): boolean {
  if (!canPlace(g, g.cur.id, g.cur.rot, g.cur.x + dx, g.cur.y + dy)) return false;
  g.cur.x += dx;
  g.cur.y += dy;
  g.lockT = 0;
  return true;
}

function tryRotate(g: BlocksGame): void {
  const next = (g.cur.rot + 1) % 4;
  for (const [kx, ky] of KICKS) {
    if (canPlace(g, g.cur.id, next, g.cur.x + kx, g.cur.y + ky)) {
      g.cur.rot = next;
      g.cur.x += kx;
      g.cur.y += ky;
      g.lockT = 0;
      return;
    }
  }
}

function hardDrop(g: BlocksGame): void {
  while (canPlace(g, g.cur.id, g.cur.rot, g.cur.x, g.cur.y + 1)) {
    g.cur.y++;
  }
  lockPiece(g);
}

function doHold(g: BlocksGame): void {
  if (g.held) return;
  const swapped = g.hold;
  g.hold = g.cur.id;
  g.held = true;
  if (swapped) {
    g.cur = spawnPiece(swapped);
    g.lockT = 0;
    if (!canPlace(g, g.cur.id, g.cur.rot, g.cur.x, g.cur.y)) g.over = true;
  } else {
    spawnNext(g, takeFromBag(g));
    g.held = true;
  }
  g.dirty = true;
}

/** 4×4 boolean grid used by the hold / next preview panels. */
function previewGrid(id: PieceId): boolean[] {
  const shape = ROT[id][0];
  const cells: [number, number][] = [];
  let minX = 4;
  let maxX = 0;
  let minY = 4;
  let maxY = 0;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      cells.push([x, y]);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  const ox = Math.floor((4 - (maxX - minX + 1)) / 2) - minX;
  const oy = Math.floor((4 - (maxY - minY + 1)) / 2) - minY;
  const grid = Array<boolean>(16).fill(false);
  for (const [x, y] of cells) grid[(y + oy) * 4 + (x + ox)] = true;
  return grid;
}

function MiniPiece({ label, id }: { label: string; id: PieceId | null }) {
  const grid = id ? previewGrid(id) : null;
  return (
    <div className="rounded-xl border border-line bg-surface px-1.5 py-1.5">
      {label && (
        <p className="mb-1 text-center font-mono text-[10px] uppercase tracking-widest text-muted">
          {label}
        </p>
      )}
      <div className="grid grid-cols-4 gap-0.5">
        {Array.from({ length: 16 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "aspect-square rounded-[2px]",
              id && grid?.[i] ? PIECE_CLASS[id] : "bg-[#0d0d1a]",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export default function NeonBlocks({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<BlocksGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [hold, setHold] = useState<PieceId | null>(null);
  const [next, setNext] = useState<PieceId[]>([]);
  const [newBest, setNewBest] = useState(false);
  const [repeat, setRepeat] = useState<Repeat | null>(null);
  const { best, submit } = useBestScore(gameId, "high");
  const softRef = useRef(false);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, W, H);

    // faint grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.07)";
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, H);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(W, y * CELL);
      ctx.stroke();
    }

    const cellRect = (cx: number, cy: number, inset: number) => {
      ctx.beginPath();
      ctx.roundRect(cx * CELL + inset, cy * CELL + inset, CELL - inset * 2, CELL - inset * 2, 4);
    };

    // locked cells
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const id = g.grid[y][x];
        if (!id) continue;
        ctx.save();
        ctx.shadowColor = PIECE_COLOR[id];
        ctx.shadowBlur = 8;
        ctx.fillStyle = PIECE_COLOR[id];
        cellRect(x, y, 1.5);
        ctx.fill();
        ctx.restore();
      }
    }

    const shape = ROT[g.cur.id][g.cur.rot];

    // ghost piece
    let ghostY = g.cur.y;
    while (canPlace(g, g.cur.id, g.cur.rot, g.cur.x, ghostY + 1)) ghostY++;
    ctx.strokeStyle = "rgba(226, 232, 240, 0.28)";
    ctx.lineWidth = 1.5;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const gy = ghostY + y;
        if (gy < 0) continue;
        cellRect(g.cur.x + x, gy, 3);
        ctx.stroke();
      }
    }

    // falling piece (pulsing glow)
    const pulse = 12 + Math.sin(time / 160) * 4;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const gy = g.cur.y + y;
        if (gy < 0) continue;
        ctx.save();
        ctx.shadowColor = PIECE_COLOR[g.cur.id];
        ctx.shadowBlur = pulse;
        ctx.fillStyle = PIECE_COLOR[g.cur.id];
        cellRect(g.cur.x + x, gy, 1.5);
        ctx.fill();
        ctx.restore();
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }, [draw]);

  /* ---------------- game loop ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame();
    softRef.current = false;
    setScore(0);
    setLines(0);
    setLevel(1);
    setHold(null);
    setNext([]);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (t: number) => {
      const dt = Math.min(t - last, 250);
      last = t;
      const g = gameRef.current;
      if (!g || g.over) return;

      const interval = softRef.current
        ? Math.min(gravityMs(g.level), 45)
        : gravityMs(g.level);
      acc += dt;
      while (acc >= interval) {
        acc -= interval;
        if (tryMove(g, 0, 1)) {
          if (softRef.current) {
            g.score += 1;
            g.dirty = true;
          }
        }
      }

      if (!canPlace(g, g.cur.id, g.cur.rot, g.cur.x, g.cur.y + 1)) {
        g.lockT += dt;
        if (g.lockT >= LOCK_MS) lockPiece(g);
      } else {
        g.lockT = 0;
      }

      if (g.dirty) {
        g.dirty = false;
        setScore(g.score);
        setLines(g.lines);
        setLevel(g.level);
        setHold(g.hold);
        setNext(g.bag.slice(0, 3));
      }

      if (g.over) {
        setScore(g.score);
        setNewBest(submit(g.score));
        setStatus("over");
        draw(t);
        return;
      }

      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, submit, draw]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  const act = useCallback((key: Repeat | "rotate" | "drop" | "hold") => {
    const g = gameRef.current;
    if (!g || g.over || status !== "playing") return;
    switch (key) {
      case "left":
        tryMove(g, -1, 0);
        break;
      case "right":
        tryMove(g, 1, 0);
        break;
      case "soft":
        if (tryMove(g, 0, 1)) {
          g.score += 1;
          g.dirty = true;
        }
        break;
      case "rotate":
        tryRotate(g);
        break;
      case "drop":
        hardDrop(g);
        break;
      case "hold":
        doHold(g);
        break;
    }
    draw(performance.now());
  }, [status, draw]);

  // held on-screen buttons repeat on an interval, cleaned up on release
  useEffect(() => {
    if (repeat === null || status !== "playing") return;
    const id = setInterval(() => act(repeat), 110);
    return () => clearInterval(id);
  }, [repeat, status, act]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === " " || key === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
        else if (key === " ") act("drop");
        return;
      }
      if (status !== "playing") return;
      switch (key) {
        case "ArrowLeft":
          e.preventDefault();
          act("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          act("right");
          break;
        case "ArrowDown":
          e.preventDefault();
          softRef.current = true;
          break;
        case "ArrowUp":
        case "x":
        case "X":
          e.preventDefault();
          if (!e.repeat) act("rotate");
          break;
        case "c":
        case "C":
        case "Shift":
          e.preventDefault();
          if (!e.repeat) act("hold");
          break;
        default:
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") softRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start, act]);

  const padCls =
    "rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-sm text-ink transition select-none hover:border-primary/40 active:scale-95";

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Lines <b className="ml-1 text-sm text-ink">{lines}</b>
        </span>
        <span>
          Level <b className="ml-1 text-sm text-ink">{level}</b>
        </span>
      </GameHud>

      <div className="flex gap-3">
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-[0_0_60px_-24px_rgba(34,211,238,0.8)]">
          <canvas
            ref={canvasRef}
            className="block w-full touch-none"
            aria-label="Neon Blocks well"
          />

          {status === "idle" && (
            <Overlay>
              <p className="font-display text-2xl font-bold text-white">NEON BLOCKS</p>
              <p className="mt-2 text-sm text-muted">
                Stack the neon tiles, clear lines, keep the well alive.
              </p>
              <PrimaryButton
                onClick={start}
                tone="from-cyan-400 via-sky-500 to-blue-600"
              >
                Start game
              </PrimaryButton>
              <p className="mt-3 text-xs text-muted">
                Arrows move · Space drops · C holds
              </p>
            </Overlay>
          )}

          {status === "over" && (
            <Overlay>
              <p className="font-display text-2xl font-bold text-rose-400">STACKED OUT</p>
              {newBest && (
                <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                  ✦ New best score!
                </p>
              )}
              <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
              <p className="text-xs uppercase tracking-widest text-muted">
                Best {best ?? "—"} · {lines} lines · level {level}
              </p>
              <PrimaryButton
                onClick={start}
                tone="from-cyan-400 via-sky-500 to-blue-600"
              >
                Play again
              </PrimaryButton>
            </Overlay>
          )}
        </div>

        <div className="w-[86px] shrink-0 space-y-2">
          <MiniPiece label="Hold" id={hold} />
          <MiniPiece label="Next" id={next[0] ?? null} />
          <MiniPiece label="" id={next[1] ?? null} />
          <MiniPiece label="" id={next[2] ?? null} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-6 gap-2">
        <button
          type="button"
          aria-label="Move left"
          onPointerDown={(e) => {
            e.preventDefault();
            setRepeat("left");
            act("left");
          }}
          onPointerUp={() => setRepeat(null)}
          onPointerCancel={() => setRepeat(null)}
          onPointerLeave={() => setRepeat(null)}
          className={padCls}
        >
          ◀
        </button>
        <button
          type="button"
          aria-label="Move right"
          onPointerDown={(e) => {
            e.preventDefault();
            setRepeat("right");
            act("right");
          }}
          onPointerUp={() => setRepeat(null)}
          onPointerCancel={() => setRepeat(null)}
          onPointerLeave={() => setRepeat(null)}
          className={padCls}
        >
          ▶
        </button>
        <button
          type="button"
          aria-label="Rotate clockwise"
          onPointerDown={(e) => {
            e.preventDefault();
            act("rotate");
          }}
          className={padCls}
        >
          ⟳
        </button>
        <button
          type="button"
          aria-label="Soft drop"
          onPointerDown={(e) => {
            e.preventDefault();
            setRepeat("soft");
            act("soft");
          }}
          onPointerUp={() => setRepeat(null)}
          onPointerCancel={() => setRepeat(null)}
          onPointerLeave={() => setRepeat(null)}
          className={padCls}
        >
          ▼
        </button>
        <button
          type="button"
          aria-label="Hard drop"
          onPointerDown={(e) => {
            e.preventDefault();
            act("drop");
          }}
          className={padCls}
        >
          ⤓
        </button>
        <button
          type="button"
          aria-label="Hold piece"
          onPointerDown={(e) => {
            e.preventDefault();
            act("hold");
          }}
          className={padCls}
        >
          Hold
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Ten lines per level · combos stack the score · watch the next three
      </p>
    </div>
  );
}
