"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const COLS = 20;
const ROWS = 20;
const CELL = 22;
const SIZE = COLS * CELL;

type Pt = { x: number; y: number };
type Dir = { x: number; y: number };
type Status = "idle" | "playing" | "over";

interface SnakeGame {
  snake: Pt[];
  dir: Dir;
  queue: Dir[];
  food: Pt;
  foods: number;
  alive: boolean;
}

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

function randInt(max: number) {
  return Math.floor(Math.random() * max);
}

function spawnFood(snake: Pt[]): Pt {
  let p: Pt;
  do {
    p = { x: randInt(COLS), y: randInt(ROWS) };
  } while (snake.some((s) => s.x === p.x && s.y === p.y));
  return p;
}

function createGame(): SnakeGame {
  const snake: Pt[] = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ];
  return {
    snake,
    dir: { x: 1, y: 0 },
    queue: [],
    food: spawnFood(snake),
    foods: 0,
    alive: true,
  };
}

function stepInterval(foods: number) {
  return Math.max(70, 115 - foods * 3);
}

export default function Snake({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<SnakeGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const touchStart = useRef<Pt | null>(null);

  /* ---------------- rendering ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    // board
    ctx.fillStyle = "#0b0b16";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // grid dots
    ctx.fillStyle = "rgba(139, 92, 246, 0.16)";
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        ctx.beginPath();
        ctx.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // food (pulsing)
    const pulse = 1 + Math.sin(time / 220) * 0.14;
    ctx.save();
    ctx.shadowColor = "#f472b6";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.arc(
      g.food.x * CELL + CELL / 2,
      g.food.y * CELL + CELL / 2,
      CELL * 0.32 * pulse,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    // snake body → head
    for (let i = g.snake.length - 1; i >= 0; i--) {
      const seg = g.snake[i];
      const isHead = i === 0;
      const inset = isHead ? 1 : 2;
      ctx.save();
      ctx.fillStyle = isHead ? "#67e8f9" : "#34d399";
      ctx.shadowColor = isHead ? "#22d3ee" : "#34d399";
      ctx.shadowBlur = isHead ? 16 : 8;
      ctx.beginPath();
      ctx.roundRect(
        seg.x * CELL + inset,
        seg.y * CELL + inset,
        CELL - inset * 2,
        CELL - inset * 2,
        isHead ? 7 : 6,
      );
      ctx.fill();
      ctx.restore();
    }

    // eyes
    const head = g.snake[0];
    if (head) {
      const cx = head.x * CELL + CELL / 2;
      const cy = head.y * CELL + CELL / 2;
      const fx = g.dir.x * 3.5;
      const fy = g.dir.y * 3.5;
      const px = g.dir.y * 4;
      const py = -g.dir.x * 4;
      ctx.fillStyle = "#0b0b16";
      for (const side of [1, -1]) {
        ctx.beginPath();
        ctx.arc(cx + fx + px * side, cy + fy + py * side, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []);

  // canvas setup + first frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }, [draw]);

  /* ---------------- game logic ---------------- */

  const step = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;

    const next = g.queue.shift();
    if (next && !(next.x === -g.dir.x && next.y === -g.dir.y)) {
      g.dir = next;
    }

    const head = g.snake[0];
    const nh = { x: head.x + g.dir.x, y: head.y + g.dir.y };

    const wall = nh.x < 0 || nh.y < 0 || nh.x >= COLS || nh.y >= ROWS;
    const body = g.snake.slice(0, -1); // tail vacates this tick
    const self = body.some((s) => s.x === nh.x && s.y === nh.y);
    if (wall || self) {
      g.alive = false;
      return;
    }

    g.snake.unshift(nh);
    if (nh.x === g.food.x && nh.y === g.food.y) {
      g.foods += 1;
      g.food = spawnFood(g.snake);
      setScore(g.foods * 10);
    } else {
      g.snake.pop();
    }
  }, []);

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  // main loop
  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (t: number) => {
      const dt = Math.min(t - last, 250);
      last = t;
      acc += dt;

      let interval = stepInterval(gameRef.current?.foods ?? 0);
      while (acc >= interval) {
        acc -= interval;
        step();
        const g = gameRef.current;
        if (!g) break;
        if (!g.alive) {
          const finalScore = g.foods * 10;
          setScore(finalScore);
          setNewBest(submit(finalScore));
          setStatus("over");
          draw(t);
          return;
        }
        interval = stepInterval(g.foods);
      }

      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, step, draw, submit]);

  // draw static frame when not playing (after mount / game over)
  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  const pushDir = useCallback((dir: Dir) => {
    const g = gameRef.current;
    if (g && g.queue.length < 2) g.queue.push(dir);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const dir = KEY_DIRS[key];

      if (dir) {
        e.preventDefault();
        if (status === "idle") start();
        if (status !== "over") pushDir(dir);
        return;
      }
      if (key === " " || key === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start, pushDir]);

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const startPt = touchStart.current;
    const t = e.changedTouches[0];
    touchStart.current = null;
    if (!startPt || !t) return;

    const dx = t.clientX - startPt.x;
    const dy = t.clientY - startPt.y;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
      if (status !== "playing") start();
      return;
    }

    const dir: Dir =
      Math.abs(dx) > Math.abs(dy)
        ? { x: Math.sign(dx), y: 0 }
        : { x: 0, y: Math.sign(dy) };

    if (status === "idle") start();
    if (status !== "over") pushDir(dir);
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"} />

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(52,211,153,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full [touch-action:none]"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          aria-label="Neon Snake game board"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              NEON SNAKE
            </p>
            <p className="mt-2 text-sm text-muted">
              Devour the orbs, grow your tail, dodge everything.
            </p>
            <PrimaryButton onClick={start} tone="from-emerald-400 to-cyan-500">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Arrow keys / WASD · swipe on mobile
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              GAME OVER
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {score}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-emerald-400 to-cyan-500">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Space or tap to start · keep your head off the walls
      </p>
    </div>
  );
}
