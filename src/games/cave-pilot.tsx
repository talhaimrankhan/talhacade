"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 340;
const PLAYER_X = 110;
const R = 14;
const SEG = 20; // cave segment spacing
const START_HALF = 124;
const MIN_HALF = 48;
const SHRINK = 0.085; // cave narrows this much per segment
const GRAVITY = 0.36;
const LIFT = 0.72;
const MAX_V = 5;
const SCROLL_MIN = 2.4;
const SCROLL_MAX = 4.8;
const METERS = 10; // pixels per point

interface Seg {
  x: number;
  center: number;
  top: number;
  bottom: number;
}

interface Game {
  segs: Seg[];
  y: number;
  vy: number;
  holding: boolean;
  dist: number;
  score: number;
  made: number;
}

/* ------------------------------------------------------------------ */
/* Module-level helpers                                                */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function carve(x: number, made: number, center: number): Seg {
  const tight = Math.max(MIN_HALF, START_HALF - made * SHRINK);
  const half = tight * (0.9 + Math.random() * 0.16);
  const next = clamp(
    center + (Math.random() - 0.5) * 26,
    half + 12,
    H - half - 12,
  );
  return { x, center: next, top: next - half, bottom: next + half };
}

function createGame(): Game {
  const segs: Seg[] = [];
  let center = H / 2;
  let made = 0;
  for (let x = -SEG * 2; x <= W + SEG * 2; x += SEG) {
    const seg = carve(x, made, center);
    center = seg.center;
    made += 1;
    segs.push(seg);
  }
  return { segs, y: H / 2, vy: 0, holding: false, dist: 0, score: 0, made };
}

function scrollSpeed(dist: number): number {
  return Math.min(SCROLL_MAX, SCROLL_MIN + dist / 9000);
}

function segAt(g: Game, x: number): Seg | null {
  for (let i = 0; i < g.segs.length; i++) {
    const s = g.segs[i];
    if (x >= s.x && x < s.x + SEG) return s;
  }
  return null;
}

/** Nose, body and tail all have to stay inside the rock. */
function grazes(g: Game): boolean {
  for (const dx of [-18, 0, 18]) {
    const s = segAt(g, PLAYER_X + dx);
    if (!s) continue;
    if (g.y - R < s.top || g.y + R > s.bottom) return true;
  }
  return false;
}

function drawScene(ctx: CanvasRenderingContext2D, g: Game, t: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#07070e");
  bg.addColorStop(1, "#101024");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // parallax flecks behind the rock
  ctx.fillStyle = "rgba(148,163,184,0.28)";
  for (let i = 0; i < 30; i++) {
    const raw = (i * 131 - g.dist * 0.35) % (W + 40);
    const x = raw < 0 ? raw + W + 40 : raw;
    ctx.fillRect(x, (i * 47) % H, 2, 2);
  }

  // cave walls
  const first = g.segs[0];
  const last = g.segs[g.segs.length - 1];
  if (!first || !last) return;
  const right = last.x + SEG;

  ctx.fillStyle = "#1c2436";
  ctx.beginPath();
  ctx.moveTo(first.x, 0);
  for (let i = 0; i < g.segs.length; i++) {
    ctx.lineTo(g.segs[i].x, g.segs[i].top);
    ctx.lineTo(g.segs[i].x + SEG, g.segs[i].top);
  }
  ctx.lineTo(right, 0);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(first.x, H);
  for (let i = 0; i < g.segs.length; i++) {
    ctx.lineTo(g.segs[i].x, g.segs[i].bottom);
    ctx.lineTo(g.segs[i].x + SEG, g.segs[i].bottom);
  }
  ctx.lineTo(right, H);
  ctx.closePath();
  ctx.fill();

  // rock edges
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < g.segs.length; i++) {
    const s = g.segs[i];
    if (i === 0) ctx.moveTo(s.x, s.top);
    else ctx.lineTo(s.x, s.top);
    ctx.lineTo(s.x + SEG, s.top);
  }
  ctx.stroke();
  ctx.strokeStyle = "#f472b6";
  ctx.beginPath();
  for (let i = 0; i < g.segs.length; i++) {
    const s = g.segs[i];
    if (i === 0) ctx.moveTo(s.x, s.bottom);
    else ctx.lineTo(s.x, s.bottom);
    ctx.lineTo(s.x + SEG, s.bottom);
  }
  ctx.stroke();

  drawCopter(ctx, g.y, g.vy, t);
}

function drawCopter(ctx: CanvasRenderingContext2D, y: number, vy: number, t: number): void {
  ctx.save();
  ctx.translate(PLAYER_X, y);
  ctx.rotate(clamp(vy * 0.045, -0.32, 0.32));

  // tail boom + fin
  ctx.fillStyle = "#d97706";
  ctx.fillRect(8, -4, 24, 7);
  ctx.beginPath();
  ctx.moveTo(30, -10);
  ctx.lineTo(38, 0);
  ctx.lineTo(30, 3);
  ctx.closePath();
  ctx.fill();

  // cabin
  ctx.save();
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.roundRect(-20, -10, 32, 20, 9);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#0b0b16";
  ctx.beginPath();
  ctx.arc(-6, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  // main rotor
  const a = (t * 0.02) % Math.PI;
  ctx.save();
  ctx.translate(-4, -13);
  ctx.rotate(a);
  ctx.fillStyle = "rgba(226,232,240,0.85)";
  ctx.fillRect(-20, -1.5, 40, 3);
  ctx.restore();
  ctx.fillStyle = "rgba(226,232,240,0.35)";
  ctx.fillRect(-24, -15, 48, 2);

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function CavePilot({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<"idle" | "playing" | "over">("idle");
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const scoreRef = useRef(0);
  const holdRef = useRef(false);

  const draw = useCallback((t: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    drawScene(ctx, g, t);
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

  const start = useCallback(() => {
    gameRef.current = createGame();
    scoreRef.current = 0;
    holdRef.current = false;
    setScore(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const tick = useCallback(
    (f: number): boolean => {
      const g = gameRef.current;
      if (!g) return false;

      g.holding = holdRef.current;
      g.vy += (g.holding ? -LIFT : GRAVITY) * f;
      g.vy *= Math.pow(0.99, f);
      g.vy = clamp(g.vy, -MAX_V, MAX_V);
      g.y += g.vy * f;
      g.y = clamp(g.y, R, H - R);

      const speed = scrollSpeed(g.dist);
      const travel = speed * f;
      g.dist += travel;

      for (let i = 0; i < g.segs.length; i++) g.segs[i].x -= travel;
      while (g.segs.length > 0 && g.segs[0].x < -SEG * 3) g.segs.shift();

      let tail = g.segs[g.segs.length - 1];
      while (tail && tail.x < W + SEG * 3) {
        const next = carve(tail.x + SEG, g.made, tail.center);
        g.made += 1;
        g.segs.push(next);
        tail = next;
      }

      if (grazes(g)) return false;

      const meters = Math.floor(g.dist / METERS);
      if (meters !== scoreRef.current) {
        scoreRef.current = meters;
        setScore(meters);
      }
      return true;
    },
    [],
  );

  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const f = Math.min((t - last) / 16.667, 2.4);
      last = t;
      if (!tick(f)) {
        setNewBest(submit(scoreRef.current));
        setStatus("over");
        draw(t);
        return;
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, tick, draw, submit]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      if (status !== "playing") start();
      holdRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") holdRef.current = false;
    };
    const release = () => {
      holdRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [status, start]);

  const pressDown = () => {
    if (status !== "playing") start();
    holdRef.current = true;
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[540px]">
      <GameHud score={score} best={best ?? "—"} />

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(56,189,248,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-pointer"
          onPointerDown={pressDown}
          aria-label="Cave Pilot flight area"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">CAVE PILOT</p>
            <p className="mt-2 text-sm text-muted">
              Hold to climb, let go to drop. The cave only gets tighter.
            </p>
            <p className="mt-1 text-xs text-muted">Pure survival — distance is the score</p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">
              Start engines
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Hold click / tap · Space to climb and start
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">ROCKED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">
              Fly again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Feather the hold — steady beats frantic through the tight stuff
      </p>
    </div>
  );
}
