"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 440;
const H = 640;
const BR = 7;
const GRAV = 0.34;
const MAXV = 15;
const STEP = 16.667;
const LANE_X = 376;
const FLIP_LEN = 50;
const FLIP_R = 7;
const PIVOT_Y = H - 76;
const LEFT_X = 142;
const RIGHT_X = 250;

type Status = "idle" | "playing" | "over";

interface Seg { ax: number; ay: number; bx: number; by: number }
interface Ball { x: number; y: number; vx: number; vy: number }
interface Bumper { x: number; y: number; r: number; pts: number }
interface PinGame {
  ball: Ball; charge: number; holding: boolean; inLane: boolean;
  balls: number; score: number; mult: number; hits: number; multTimer: number;
  flipL: number; flipR: number; wantL: number; wantR: number;
}

const WALLS: Seg[] = [
  { ax: 16, ay: 16, bx: 424, by: 16 },
  { ax: 16, ay: 16, bx: 16, by: H - 150 },
  { ax: 424, ay: 16, bx: 424, by: H - 16 },
  { ax: LANE_X, ay: 16, bx: 424, by: 90 },
  { ax: LANE_X, ay: 90, bx: LANE_X, by: H - 16 },
  { ax: LANE_X, ay: H - 16, bx: 424, by: H - 16 },
  { ax: 16, ay: H - 150, bx: 128, by: H - 96 },
  { ax: 376, ay: H - 150, bx: 264, by: H - 96 },
];

const BUMPERS: Bumper[] = [
  { x: 196, y: 130, r: 24, pts: 1000 },
  { x: 126, y: 200, r: 22, pts: 500 },
  { x: 266, y: 200, r: 22, pts: 500 },
  { x: 146, y: 278, r: 18, pts: 100 },
  { x: 246, y: 278, r: 18, pts: 100 },
];

/** Bumper pop timers — module scope so the game object stays scalar-only. */
const bumperFlash = [0, 0, 0, 0, 0];

function createGame(): PinGame {
  for (let i = 0; i < bumperFlash.length; i++) bumperFlash[i] = 0;
  return {
    ball: { x: 400, y: H - 40, vx: 0, vy: 0 },
    charge: 0, holding: false, inLane: true, balls: 3, score: 0,
    mult: 1, hits: 0, multTimer: 0, flipL: 0, flipR: 0, wantL: 0, wantR: 0,
  };
}

function closestOn(s: Seg, x: number, y: number) {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((x - s.ax) * dx + (y - s.ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { x: s.ax + dx * t, y: s.ay + dy * t };
}

/** Circle-vs-segment response. Returns true on contact. */
function hitSeg(ball: Ball, s: Seg, e: number, extra: number): boolean {
  const c = closestOn(s, ball.x, ball.y);
  const dx = ball.x - c.x;
  const dy = ball.y - c.y;
  const d = Math.hypot(dx, dy);
  const min = BR + extra;
  if (d >= min || d === 0) return false;
  const nx = dx / d;
  const ny = dy / d;
  ball.x = c.x + nx * min;
  ball.y = c.y + ny * min;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + e) * vn * nx;
    ball.vy -= (1 + e) * vn * ny;
  }
  return true;
}

function flipperSeg(px: number, angle: number): Seg {
  return {
    ax: px, ay: PIVOT_Y,
    bx: px + Math.cos(angle) * FLIP_LEN,
    by: PIVOT_Y + Math.sin(angle) * FLIP_LEN,
  };
}

function leftAngle(t: number): number {
  return 0.5 + (-0.45 - 0.5) * t;
}

function rightAngle(t: number): number {
  return Math.PI - 0.5 + (Math.PI + 0.45 - (Math.PI - 0.5)) * t;
}

export default function NeonPinball({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<PinGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [balls, setBalls] = useState(3);
  const [mult, setMult] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    ctx.fillStyle = "#0b0b16";
    ctx.fillRect(0, 0, W, H);

    // shooter lane
    ctx.fillStyle = "#111122";
    ctx.fillRect(LANE_X, 16, W - 16 - LANE_X, H - 32);

    // drain slot
    const pulse = 0.45 + Math.sin(time / 500) * 0.12;
    const grad = ctx.createLinearGradient(0, H - 70, 0, H);
    grad.addColorStop(0, "rgba(244,63,94,0)");
    grad.addColorStop(1, `rgba(244,63,94,${pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(16, H - 70, LANE_X - 16, 70);

    // walls
    ctx.strokeStyle = "#8b5cf6"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.shadowColor = "#8b5cf6"; ctx.shadowBlur = 12;
    for (const s of WALLS) {
      ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // bumpers
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let i = 0; i < BUMPERS.length; i++) {
      const b = BUMPERS[i];
      const pop = bumperFlash[i] > 0 ? 1 + bumperFlash[i] / 60 : 1;
      const r = b.r * pop;
      const ring = b.pts >= 1000 ? "#f43f5e" : b.pts >= 500 ? "#fbbf24" : "#22d3ee";
      ctx.save();
      ctx.shadowColor = ring; ctx.shadowBlur = 18 + bumperFlash[i]; ctx.fillStyle = "#151530";
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = ring; ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#e5e7eb"; ctx.font = "bold 11px ui-monospace, monospace";
      ctx.fillText(String(b.pts), b.x, b.y);
    }

    // flippers
    const lSeg = flipperSeg(LEFT_X, leftAngle(g.flipL));
    const rSeg = flipperSeg(RIGHT_X, rightAngle(g.flipR));
    ctx.lineWidth = FLIP_R * 2; ctx.lineCap = "round";
    ctx.strokeStyle = "#22d3ee"; ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(lSeg.ax, lSeg.ay); ctx.lineTo(lSeg.bx, lSeg.by); ctx.stroke();
    ctx.strokeStyle = "#f43f5e"; ctx.shadowColor = "#f43f5e";
    ctx.beginPath(); ctx.moveTo(rSeg.ax, rSeg.ay); ctx.lineTo(rSeg.bx, rSeg.by); ctx.stroke();
    ctx.shadowBlur = 0;

    // plunger gauge
    if (g.inLane) {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(LANE_X + 8, H - 240, 12, 200);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(LANE_X + 8, H - 40 - 200 * g.charge, 12, 200 * g.charge);
    }

    // ball
    ctx.save(); ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 16; ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(g.ball.x, g.ball.y, BR, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    if (g.mult > 1) {
      ctx.fillStyle = "#fde047"; ctx.font = "bold 20px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.fillText(`×${g.mult}`, 24, 44);
      ctx.textAlign = "center";
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

  /* ---------------- logic ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setBalls(3);
    setMult(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const launch = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.inLane) return;
    g.ball.vy = -(10 + 8 * Math.max(0.12, g.charge));
    g.ball.vx = -0.4;
    g.inLane = false;
    g.charge = 0;
    g.holding = false;
  }, []);

  /** Advances one frame. Returns false when the ball drained. */
  const step = useCallback((): boolean => {
    const g = gameRef.current;
    if (!g) return false;
    const ball = g.ball;

    const rate = 0.34;
    g.flipL += Math.max(-rate, Math.min(rate, g.wantL - g.flipL));
    g.flipR += Math.max(-rate, Math.min(rate, g.wantR - g.flipR));

    if (g.multTimer > 0) {
      g.multTimer -= 1;
      if (g.multTimer === 0) {
        g.hits = 0;
        if (g.mult !== 1) { g.mult = 1; setMult(1); }
      }
    }
    for (let i = 0; i < bumperFlash.length; i++) {
      if (bumperFlash[i] > 0) bumperFlash[i] -= 1;
    }

    if (g.inLane) {
      if (g.holding) g.charge = Math.min(1, g.charge + 0.02);
      ball.x = Math.max(LANE_X + BR + 6, Math.min(W - 16 - BR, ball.x));
      if (ball.y > H - 16 - BR) { ball.y = H - 16 - BR; ball.vy = 0; ball.vx = 0; }
      return true;
    }

    ball.vy += GRAV;
    ball.x += ball.vx;
    ball.y += ball.vy;

    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > MAXV) {
      ball.vx = (ball.vx / sp) * MAXV;
      ball.vy = (ball.vy / sp) * MAXV;
    }

    for (const s of WALLS) hitSeg(ball, s, 0.85, 0);

    // bumper kicks
    for (let i = 0; i < BUMPERS.length; i++) {
      const b = BUMPERS[i];
      const dx = ball.x - b.x;
      const dy = ball.y - b.y;
      const d = Math.hypot(dx, dy);
      const min = b.r + BR;
      if (d >= min || d === 0) continue;
      const nx = dx / d;
      const ny = dy / d;
      ball.x = b.x + nx * min;
      ball.y = b.y + ny * min;
      ball.vx = nx * 8.2;
      ball.vy = ny * 8.2;
      bumperFlash[i] = 26;
      g.hits += 1;
      g.multTimer = 170;
      const next = Math.min(8, 1 + Math.floor(g.hits / 3));
      if (next !== g.mult) {
        g.mult = next;
        setMult(next);
      }
      g.score += b.pts * g.mult;
      setScore(g.score);
    }

    // flippers (capsule + upward kick while swinging)
    const risingL = g.wantL === 1 && g.flipL < 1;
    const risingR = g.wantR === 1 && g.flipR < 1;
    if (hitSeg(ball, flipperSeg(LEFT_X, leftAngle(g.flipL)), 0.5, FLIP_R) && risingL) {
      ball.vx += 3.4;
      ball.vy -= 7.4;
    }
    if (hitSeg(ball, flipperSeg(RIGHT_X, rightAngle(g.flipR)), 0.5, FLIP_R) && risingR) {
      ball.vx -= 3.4;
      ball.vy -= 7.4;
    }

    // rolled back down the shooter lane → kick it up again
    if (ball.x > LANE_X + 12 && ball.y > H - 60) {
      ball.vy = -(13 + Math.random() * 3);
      ball.vx = -1.2;
    }

    // drained
    if (ball.y - BR > H - 16 && ball.x < LANE_X) return false;
    return true;
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (t: number) => {
      const dt = Math.min(t - last, 250);
      last = t;
      acc += dt;
      let drained = false;
      while (acc >= STEP && !drained) {
        acc -= STEP;
        if (!step()) drained = true;
      }

      const g = gameRef.current;
      if (drained && g) {
        g.balls -= 1;
        setBalls(Math.max(0, g.balls));
        if (g.balls <= 0) {
          setScore(g.score);
          setNewBest(submit(g.score));
          setStatus("over");
          draw(t);
          return;
        }
        g.inLane = true; g.charge = 0;
        g.ball.x = 400; g.ball.y = H - 40;
        g.ball.vx = 0; g.ball.vy = 0;
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, step, draw, submit]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const g = gameRef.current;
      if (key === "z") {
        e.preventDefault();
        if (g) g.wantL = 1;
      } else if (key === "m") {
        e.preventDefault();
        if (g) g.wantR = 1;
      } else if (key === " ") {
        e.preventDefault();
        if (status !== "playing") { start(); return; }
        if (g && g.inLane) g.holding = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const g = gameRef.current;
      if (key === "z" && g) g.wantL = 0;
      else if (key === "m" && g) g.wantR = 0;
      else if (key === " ") {
        if (status === "playing" && g && g.inLane) launch();
        else if (g) g.holding = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start, launch]);

  const zoneX = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * W;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "playing") { start(); return; }
    const g = gameRef.current;
    if (!g) return;
    if (g.inLane) { g.holding = true; return; }
    if (zoneX(e) < W / 2) g.wantL = 1;
    else g.wantR = 1;
  };

  const onPointerUp = () => {
    const g = gameRef.current;
    if (!g) return;
    if (g.inLane && g.holding) launch();
    g.holding = false;
    g.wantL = 0;
    g.wantR = 0;
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-rose-400">Balls <b className="ml-1 text-sm text-ink">{balls}</b></span>
        <span className="text-warn">Mult <b className="ml-1 text-sm text-ink">×{mult}</b></span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(139,92,246,0.9)]">
        <canvas ref={canvasRef} className="block w-full touch-none" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onPointerUp} aria-label="Neon Pinball table" />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">NEON PINBALL</p>
            <p className="mt-2 text-sm text-muted">Charge the plunger, launch, then keep the ball alive with the flippers. Chain bumper hits for a multiplier.</p>
            <PrimaryButton onClick={start} tone="from-fuchsia-500 via-purple-500 to-indigo-600">Start game</PrimaryButton>
            <p className="mt-3 text-xs text-muted">Hold Space to charge · Z / M flip · tap left / right on touch</p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">TILT — GAME OVER</p>
            {newBest && <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">✦ New best score!</p>}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">Best {best ?? "—"}</p>
            <PrimaryButton onClick={start} tone="from-fuchsia-500 via-purple-500 to-indigo-600">New game</PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">Hold Space to charge the plunger · Z / M (or tap) flip · 3 balls</p>
    </div>
  );
}
