"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 320;
const H = 460;
const GROUND_Y = H - 38;
const BIRD_X = 86;
const BIRD_R = 11;
const GRAVITY = 1350;
const FLAP_VY = -405;
const PIPE_W = 56;
const PIPE_GAP = 210;

type Status = "idle" | "playing" | "over";

interface Pipe {
  x: number;
  gapY: number;
  scored: boolean;
}

interface Star {
  x: number;
  y: number;
  r: number;
  layer: number;
}

interface FlapGame {
  birdY: number;
  vy: number;
  rot: number;
  pipes: Pipe[];
  nextX: number;
  passed: number;
  score: number;
  speed: number;
  stars: Star[];
  groundX: number;
  flapT: number;
  dying: boolean;
  over: boolean;
}

function gapSize(passed: number): number {
  return Math.max(104, 132 - passed * 3);
}

function scrollSpeed(passed: number): number {
  return Math.min(258, 152 + passed * 2.6);
}

function makeStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < 46; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * (GROUND_Y - 30),
      r: 0.6 + Math.random() * 1.6,
      layer: i % 3,
    });
  }
  return stars;
}

function createGame(): FlapGame {
  return {
    birdY: GROUND_Y / 2,
    vy: 0,
    rot: 0,
    pipes: [],
    nextX: W + 90,
    passed: 0,
    score: 0,
    speed: scrollSpeed(0),
    stars: makeStars(),
    groundX: 0,
    flapT: 0,
    dying: false,
    over: false,
  };
}

function spawnPipe(g: FlapGame): void {
  const gap = gapSize(g.passed);
  const margin = 60;
  const gapY = margin + gap / 2 + Math.random() * (GROUND_Y - margin * 2 - gap);
  g.pipes.push({ x: g.nextX, gapY, scored: false });
  g.nextX += PIPE_GAP;
}

function flap(g: FlapGame): void {
  if (g.dying) return;
  g.vy = FLAP_VY;
  g.flapT = 0;
}

function stepGame(g: FlapGame, dt: number): void {
  for (const s of g.stars) {
    s.x -= (14 + s.layer * 22) * dt;
    if (s.x < -2) {
      s.x = W + 2;
      s.y = Math.random() * (GROUND_Y - 30);
    }
  }

  if (g.dying) {
    g.vy += GRAVITY * dt;
    g.birdY += g.vy * dt;
    g.rot = Math.min(Math.PI / 2, g.rot + 4 * dt);
    if (g.birdY >= GROUND_Y - BIRD_R) {
      g.birdY = GROUND_Y - BIRD_R;
      g.over = true;
    }
    return;
  }

  g.vy += GRAVITY * dt;
  g.birdY += g.vy * dt;
  g.flapT += dt;
  g.rot = Math.max(-0.5, Math.min(1.1, g.vy / 620));
  if (g.birdY < BIRD_R) {
    g.birdY = BIRD_R;
    g.vy = Math.max(g.vy, 0);
  }

  if (g.pipes.length === 0 || g.nextX - g.pipes[g.pipes.length - 1].x >= PIPE_GAP) {
    spawnPipe(g);
  }
  for (let i = g.pipes.length - 1; i >= 0; i--) {
    g.pipes[i].x -= g.speed * dt;
    if (g.pipes[i].x < -PIPE_W - 10) g.pipes.splice(i, 1);
  }

  g.groundX = (g.groundX - g.speed * dt) % 24;

  // scoring
  for (const p of g.pipes) {
    if (!p.scored && p.x + PIPE_W < BIRD_X - BIRD_R) {
      p.scored = true;
      g.passed += 1;
      g.score += 1;
      g.speed = scrollSpeed(g.passed);
    }
  }

  // collisions
  const gap = gapSize(g.passed);
  for (const p of g.pipes) {
    if (BIRD_X + BIRD_R < p.x || BIRD_X - BIRD_R > p.x + PIPE_W) continue;
    const topH = p.gapY - gap / 2;
    const botY = p.gapY + gap / 2;
    if (g.birdY - BIRD_R < topH || g.birdY + BIRD_R > botY) {
      g.dying = true;
      g.vy = Math.min(g.vy, 60);
      return;
    }
  }

  if (g.birdY + BIRD_R >= GROUND_Y) {
    g.birdY = GROUND_Y - BIRD_R;
    g.dying = true;
    g.vy = 0;
  }
}

export default function FlapNova({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<FlapGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0a0f22");
    sky.addColorStop(1, "#101026");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // parallax stars
    for (const s of g.stars) {
      ctx.fillStyle = `rgba(226, 232, 240, ${0.25 + s.layer * 0.22})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // pipes
    const gap = gapSize(g.passed);
    for (const p of g.pipes) {
      const topH = p.gapY - gap / 2;
      const botY = p.gapY + gap / 2;
      ctx.save();
      ctx.shadowColor = "#34d399";
      ctx.shadowBlur = 16;
      const pipeGrad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
      pipeGrad.addColorStop(0, "#065f46");
      pipeGrad.addColorStop(0.5, "#34d399");
      pipeGrad.addColorStop(1, "#065f46");
      ctx.fillStyle = pipeGrad;
      ctx.fillRect(p.x, 0, PIPE_W, topH);
      ctx.fillRect(p.x, botY, PIPE_W, GROUND_Y - botY);
      ctx.restore();
      // lips
      ctx.fillStyle = "#10b981";
      ctx.fillRect(p.x - 4, topH - 14, PIPE_W + 8, 14);
      ctx.fillRect(p.x - 4, botY, PIPE_W + 8, 14);
    }

    // ground
    ctx.fillStyle = "#141428";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "rgba(52, 211, 153, 0.55)";
    for (let x = g.groundX; x < W; x += 24) {
      ctx.fillRect(x, GROUND_Y, 12, 2);
    }

    // bird
    const flapPhase = Math.sin(time / 70) * (g.vy < 0 ? 5 : 2);
    ctx.save();
    ctx.translate(BIRD_X, g.birdY);
    ctx.rotate(g.rot);
    ctx.shadowColor = "#facc15";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
    ctx.fill();
    // wing
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.ellipse(-2, 2 + flapPhase * 0.4, 6, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // eye
    ctx.fillStyle = "#0b0b16";
    ctx.beginPath();
    ctx.arc(4.5, -3, 2.4, 0, Math.PI * 2);
    ctx.fill();
    // beak
    ctx.fillStyle = "#fb7185";
    ctx.beginPath();
    ctx.moveTo(9, -1);
    ctx.lineTo(16, 1);
    ctx.lineTo(9, 4);
    ctx.closePath();
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
    draw(performance.now());
  }, [draw]);

  /* ---------------- game loop ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = 0;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      stepGame(g, dt);
      if (g.score !== lastScore) {
        lastScore = g.score;
        setScore(g.score);
      }

      if (g.over) {
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

  const doFlap = useCallback(() => {
    if (status === "idle") {
      start();
      return;
    }
    if (status !== "playing") return;
    const g = gameRef.current;
    if (g) flap(g);
  }, [status, start]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowUp") {
        e.preventDefault();
        doFlap();
      } else if (e.key === "Enter" && status !== "playing") {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [doFlap, status, start]);

  return (
    <div className="w-full max-w-[380px]">
      <GameHud score={score} best={best ?? "—"} accent="text-success" />

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(250,204,21,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          aria-label="Flap Nova sky"
          onPointerDown={(e) => {
            e.preventDefault();
            doFlap();
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">FLAP NOVA</p>
            <p className="mt-2 text-sm text-muted">
              One button, one bird, an endless sky. Squeeze every gap.
            </p>
            <PrimaryButton onClick={start} tone="from-yellow-400 via-amber-500 to-orange-600">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Click, tap or Space to flap</p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">CRASHED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-yellow-400 via-amber-500 to-orange-600">
              Fly again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        +1 per pipe · the sky tightens the longer you last
      </p>
    </div>
  );
}
