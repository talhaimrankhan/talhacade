"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 560;
const ROWS = 5;
const COLS = 8;
const BRICK_W = 51;
const BRICK_H = 18;
const GAP = 6;
const OFFSET_X = 16;
const OFFSET_Y = 58;
const PADDLE_H = 13;
const PADDLE_Y = H - 42;
const BALL_R = 7;

const ROW_COLORS = ["#f472b6", "#a78bfa", "#22d3ee", "#34d399", "#fbbf24"];

type Status = "idle" | "playing" | "over";

interface Brick {
  x: number;
  y: number;
  row: number;
  alive: boolean;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  stuck: boolean;
}

interface BreakoutGame {
  paddleX: number;
  targetX: number;
  ball: Ball;
  bricks: Brick[];
  lives: number;
  level: number;
  score: number;
}

function paddleWidth(level: number) {
  return Math.max(62, 94 - (level - 1) * 8);
}

function ballSpeed(level: number) {
  return Math.min(9, 5 + (level - 1) * 0.7);
}

function buildBricks(): Brick[] {
  const bricks: Brick[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      bricks.push({
        x: OFFSET_X + col * (BRICK_W + GAP),
        y: OFFSET_Y + row * (BRICK_H + GAP),
        row,
        alive: true,
      });
    }
  }
  return bricks;
}

function createGame(): BreakoutGame {
  const pw = paddleWidth(1);
  return {
    paddleX: (W - pw) / 2,
    targetX: (W - pw) / 2,
    ball: { x: W / 2, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, stuck: true },
    bricks: buildBricks(),
    lives: 3,
    level: 1,
    score: 0,
  };
}

function stickBall(g: BreakoutGame) {
  const pw = paddleWidth(g.level);
  g.ball.x = g.paddleX + pw / 2;
  g.ball.y = PADDLE_Y - BALL_R - 1;
  g.ball.vx = 0;
  g.ball.vy = 0;
  g.ball.stuck = true;
}

function launch(g: BreakoutGame) {
  if (!g.ball.stuck) return;
  const speed = ballSpeed(g.level);
  const angle = -Math.PI / 2 + (Math.random() * 0.7 - 0.35);
  g.ball.vx = Math.cos(angle) * speed;
  g.ball.vy = Math.sin(angle) * speed;
  g.ball.stuck = false;
}

export default function Breakout({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<BreakoutGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------------- drawing ---------------- */

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    // backdrop
    ctx.fillStyle = "#0b0b16";
    ctx.fillRect(0, 0, W, H);

    // bricks
    for (const brick of g.bricks) {
      if (!brick.alive) continue;
      const color = ROW_COLORS[brick.row % ROW_COLORS.length];
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(brick.x, brick.y, BRICK_W, BRICK_H, 4);
      ctx.fill();
      ctx.restore();
      // inner sheen
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.roundRect(brick.x + 2, brick.y + 2, BRICK_W - 4, 4, 2);
      ctx.fill();
    }

    // paddle
    const pw = paddleWidth(g.level);
    const grad = ctx.createLinearGradient(g.paddleX, 0, g.paddleX + pw, 0);
    grad.addColorStop(0, "#22d3ee");
    grad.addColorStop(1, "#8b5cf6");
    ctx.save();
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 16;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(g.paddleX, PADDLE_Y, pw, PADDLE_H, 7);
    ctx.fill();
    ctx.restore();

    // ball
    ctx.save();
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(g.ball.x, g.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }, [draw]);

  /* ---------------- logic ---------------- */

  const flashBanner = useCallback((text: string) => {
    setBanner(text);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 1500);
  }, []);

  useEffect(
    () => () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    },
    [],
  );

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setLives(3);
    setLevel(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  /** Advances one frame. Returns false when the run ends. */
  const tick = useCallback(
    (f: number): boolean => {
      const g = gameRef.current;
      if (!g) return false;
      const pw = paddleWidth(g.level);

      // paddle follows pointer
      g.paddleX += (g.targetX - g.paddleX) * Math.min(1, 0.45 * f);
      g.paddleX = Math.max(0, Math.min(W - pw, g.paddleX));

      if (g.ball.stuck) {
        g.ball.x = g.paddleX + pw / 2;
        g.ball.y = PADDLE_Y - BALL_R - 1;
        return true;
      }

      g.ball.x += g.ball.vx * f;
      g.ball.y += g.ball.vy * f;

      // walls
      if (g.ball.x < BALL_R) {
        g.ball.x = BALL_R;
        g.ball.vx = Math.abs(g.ball.vx);
      } else if (g.ball.x > W - BALL_R) {
        g.ball.x = W - BALL_R;
        g.ball.vx = -Math.abs(g.ball.vx);
      }
      if (g.ball.y < BALL_R) {
        g.ball.y = BALL_R;
        g.ball.vy = Math.abs(g.ball.vy);
      }

      // paddle
      if (
        g.ball.vy > 0 &&
        g.ball.y + BALL_R >= PADDLE_Y &&
        g.ball.y - BALL_R <= PADDLE_Y + PADDLE_H &&
        g.ball.x >= g.paddleX - BALL_R &&
        g.ball.x <= g.paddleX + pw + BALL_R
      ) {
        const offset = Math.max(
          -1,
          Math.min(1, (g.ball.x - (g.paddleX + pw / 2)) / (pw / 2)),
        );
        const speed = Math.hypot(g.ball.vx, g.ball.vy) || ballSpeed(g.level);
        const angle = (Math.PI / 2.6) * offset; // ±~69°
        g.ball.vx = speed * Math.sin(angle);
        g.ball.vy = -Math.abs(speed * Math.cos(angle));
        g.ball.y = PADDLE_Y - BALL_R;
      }

      // bricks
      for (const brick of g.bricks) {
        if (!brick.alive) continue;
        const hit =
          g.ball.x + BALL_R > brick.x &&
          g.ball.x - BALL_R < brick.x + BRICK_W &&
          g.ball.y + BALL_R > brick.y &&
          g.ball.y - BALL_R < brick.y + BRICK_H;
        if (!hit) continue;

        g.bricks = g.bricks.map((b) => (b === brick ? { ...b, alive: false } : b));
        const overlapX = Math.min(
          g.ball.x + BALL_R - brick.x,
          brick.x + BRICK_W - (g.ball.x - BALL_R),
        );
        const overlapY = Math.min(
          g.ball.y + BALL_R - brick.y,
          brick.y + BRICK_H - (g.ball.y - BALL_R),
        );
        if (overlapX < overlapY) g.ball.vx = -g.ball.vx;
        else g.ball.vy = -g.ball.vy;

        g.score += (ROWS - brick.row) * 10;
        setScore(g.score);
        break;
      }

      // level cleared
      if (g.bricks.every((b) => !b.alive)) {
        g.level += 1;
        g.score += 100;
        setScore(g.score);
        setLevel(g.level);
        g.bricks = buildBricks();
        stickBall(g);
        flashBanner(`LEVEL ${g.level}`);
      }

      // fell out
      if (g.ball.y - BALL_R > H) {
        g.lives -= 1;
        setLives(g.lives);
        if (g.lives <= 0) return false;
        stickBall(g);
      }

      return true;
    },
    [flashBanner],
  );

  // main loop
  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();

    const loop = (t: number) => {
      const f = Math.min((t - last) / 16.667, 2);
      last = t;

      if (!tick(f)) {
        setNewBest(submit(gameRef.current?.score ?? 0));
        setStatus("over");
        draw();
        return;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, tick, draw, submit]);

  useEffect(() => {
    if (status !== "playing") draw();
  }, [status, draw]);

  /* ---------------- input ---------------- */

  const movePaddle = (clientX: number, element: HTMLCanvasElement) => {
    const rect = element.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const g = gameRef.current;
    if (!g) return;
    g.targetX = Math.max(
      0,
      Math.min(W - paddleWidth(g.level), x - paddleWidth(g.level) / 2),
    );
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    movePaddle(e.clientX, e.currentTarget);
    if (status === "playing") {
      launch(gameRef.current!);
    } else {
      start();
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        e.preventDefault();
        const g = gameRef.current;
        if (g) g.targetX = Math.max(0, g.targetX - 34);
      } else if (key === "arrowright" || key === "d") {
        e.preventDefault();
        const g = gameRef.current;
        if (g)
          g.targetX = Math.min(
            W - paddleWidth(g.level),
            g.targetX + 34,
          );
      } else if (key === " " || key === "enter") {
        e.preventDefault();
        if (status === "playing") launch(gameRef.current!);
        else start();
      } else if (key === "r") {
        start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start]);

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-rose-400">
          Lives <b className="ml-1 text-sm text-ink">{"❤".repeat(Math.max(0, lives)) || "—"}</b>
        </span>
        <span className="text-accent">
          Lvl <b className="ml-1 text-sm text-ink">{level}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(168,85,247,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full [touch-action:none]"
          onPointerDown={handlePointerDown}
          onPointerMove={(e) => movePaddle(e.clientX, e.currentTarget)}
          aria-label="Neon Breakout game board"
        />

        {banner && (
          <div className="animate-pop pointer-events-none absolute inset-x-0 top-1/3 grid place-items-center">
            <span className="rounded-full border border-white/25 bg-black/70 px-5 py-2 font-display text-xl font-bold tracking-[0.3em] text-white backdrop-blur">
              {banner}
            </span>
          </div>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              NEON BREAKOUT
            </p>
            <p className="mt-2 text-sm text-muted">
              Clear every brick. Three lives, endless attitude.
            </p>
            <PrimaryButton onClick={start} tone="from-fuchsia-400 to-indigo-500">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Move with mouse, finger or arrow keys
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
              Cleared to level {level} · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-fuchsia-400 to-indigo-500">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Click / tap to launch · R to restart · angle off the paddle edges
      </p>
    </div>
  );
}
