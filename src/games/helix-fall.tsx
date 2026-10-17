"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 420;
const H = 560;
const CX = W / 2;
const R = 128;
const RY = 34;
const ROW = 74;
const BALL_R = 13;
const GRAV = 0.15;
const TERMINAL = 4.6;
const BOUNCE = -5.5;
const TAP = Math.PI / 6;
const STEP = 16.667;
const RING_COLORS = ["#38bdf8", "#a78bfa", "#34d399"];

type Status = "idle" | "playing" | "over";

interface Gap {
  a: number;
  w: number;
}

interface Ring {
  y: number;
  base: number;
  color: string;
  gaps: Gap[];
}

interface HelixGame {
  rings: Ring[];
  cur: number;
  worldY: number;
  vy: number;
  rot: number;
  targetRot: number;
  score: number;
  alive: boolean;
}

function norm(a: number): number {
  const two = Math.PI * 2;
  return ((a % two) + two) % two;
}

function inGap(ring: Ring, angle: number): boolean {
  for (const g of ring.gaps) {
    const d = norm(angle - g.a);
    if (d <= g.w) return true;
  }
  return false;
}

function makeRing(y: number, prevBase: number): Ring {
  const count = 1 + Math.floor(Math.random() * 3);
  const base = prevBase + (Math.random() - 0.5) * 1.7;
  const width = Math.min(1.7, ((Math.PI * 2) / count) * 0.55);
  const gaps: Gap[] = [];
  for (let k = 0; k < count; k++) {
    gaps.push({ a: base + (k * Math.PI * 2) / count, w: width });
  }
  return {
    y,
    base,
    color: RING_COLORS[Math.floor(Math.random() * RING_COLORS.length)],
    gaps,
  };
}

function createGame(): HelixGame {
  const rings: Ring[] = [];
  const first = makeRing(210, Math.PI / 2 + 2.1);
  rings.push(first);
  for (let i = 1; i < 10; i++) {
    rings.push(makeRing(first.y + i * ROW, rings[rings.length - 1].base));
  }
  return {
    rings,
    cur: 0,
    worldY: first.y - 130,
    vy: -2,
    rot: 0,
    targetRot: 0,
    score: 0,
    alive: true,
  };
}

export default function HelixFall({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<HelixGame | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const camY = g.worldY - 170;

    ctx.fillStyle = "#0b0b16";
    ctx.fillRect(0, 0, W, H);

    // central pole
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.roundRect(CX - 7, 0, 14, H, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.roundRect(CX - 5, 0, 4, H, 2);
    ctx.fill();

    // rings, furthest (lowest) first
    const visible: Ring[] = [];
    for (const ring of g.rings) {
      const sy = ring.y - camY;
      if (sy > -60 && sy < H + 60) visible.push(ring);
    }
    visible.sort((a, b) => b.y - a.y);

    ctx.lineCap = "butt";
    for (const ring of visible) {
      const cy = ring.y - camY;
      const passed = g.rings.indexOf(ring) < g.cur;
      const sorted = ring.gaps
        .map((gp) => ({ a: norm(gp.a), w: gp.w }))
        .sort((p, q) => p.a - q.a);

      for (let k = 0; k < sorted.length; k++) {
        const cur = sorted[k];
        const nxt = sorted[(k + 1) % sorted.length];
        const a0 = cur.a + cur.w;
        const a1 = k + 1 < sorted.length ? nxt.a : nxt.a + Math.PI * 2;
        if (a1 - a0 < 0.05) continue;
        ctx.strokeStyle = passed ? "rgba(100,116,139,0.35)" : ring.color;
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.ellipse(CX, cy, R, RY, 0, a0 + g.rot, a1 + g.rot);
        ctx.stroke();
        ctx.strokeStyle = passed
          ? "rgba(148,163,184,0.18)"
          : "rgba(255,255,255,0.35)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(
          CX,
          cy - 5,
          R,
          RY,
          0,
          a0 + g.rot,
          a1 + g.rot,
        );
        ctx.stroke();
      }
    }

    // fall guide
    const ballY = g.worldY - camY;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.setLineDash([4, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CX, ballY);
    ctx.lineTo(CX, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // ball
    ctx.save();
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 18;
    const shade = ctx.createRadialGradient(
      CX - 4,
      ballY - 5,
      2,
      CX,
      ballY,
      BALL_R,
    );
    shade.addColorStop(0, "#ffffff");
    shade.addColorStop(1, "#7dd3fc");
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(CX, ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (status === "idle") {
      ctx.fillStyle = `rgba(56,189,248,${0.25 + Math.sin(time / 400) * 0.15})`;
      ctx.font = "bold 13px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("TAP LEFT / RIGHT TO ROTATE", CX, H - 24);
    }
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!gameRef.current) gameRef.current = createGame();
    draw(performance.now());
  }, [draw]);

  /* ---------------- logic ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  /** Advances one frame. Returns false when the ball is crushed. */
  const step = useCallback((): boolean => {
    const g = gameRef.current;
    if (!g) return false;

    g.rot += (g.targetRot - g.rot) * 0.45;
    g.vy = Math.min(TERMINAL, g.vy + GRAV);
    g.worldY += g.vy;

    // keep the tower fed with fresh rings
    while (g.rings.length < g.cur + 13) {
      const last = g.rings[g.rings.length - 1];
      g.rings = [...g.rings, makeRing(last.y + ROW, last.base)];
    }
    if (g.cur > 32) {
      const drop = g.cur - 6;
      g.rings = g.rings.slice(drop);
      g.cur -= drop;
    }

    const ring = g.rings[g.cur];
    if (!ring) return false;
    const frontY = ring.y + RY;
    if (g.worldY + BALL_R >= frontY) {
      const local = Math.PI / 2 - g.rot;
      if (inGap(ring, local)) {
        g.cur += 1;
        g.score = g.cur;
        setScore(g.cur);
      } else if (g.cur === 0) {
        g.worldY = frontY - BALL_R;
        g.vy = BOUNCE;
      } else {
        return false;
      }
    }
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
      let alive = true;
      while (acc >= STEP && alive) {
        acc -= STEP;
        alive = step();
      }

      if (!alive) {
        const g = gameRef.current;
        const final = g ? g.score : 0;
        setScore(final);
        setNewBest(submit(final));
        setStatus("over");
        draw(t);
        return;
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

  const rotate = useCallback((dir: number) => {
    const g = gameRef.current;
    if (!g) return;
    g.targetRot += dir * TAP;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === "ArrowLeft" || key === "a") {
        e.preventDefault();
        if (status === "playing") rotate(-1);
      } else if (key === "ArrowRight" || key === "d") {
        e.preventDefault();
        if (status === "playing") rotate(1);
      } else if (key === " " || key === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start, rotate]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "playing") {
      start();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    rotate(x < W / 2 ? -1 : 1);
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-cyan-400">
          Drop <b className="ml-1 text-sm text-ink">{1 + Math.floor(score / 10)}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(59,130,246,0.85)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          onPointerDown={onPointerDown}
          aria-label="Helix Fall tower"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              HELIX FALL
            </p>
            <p className="mt-2 text-sm text-muted">
              Rotate the tower so the ball keeps finding gaps. Land on solid
              stone and it&apos;s over.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-sky-400 via-blue-500 to-indigo-600"
            >
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Tap left / right half · ← / → also rotate
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              SMASHED
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
              Rings passed · Best {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-sky-400 via-blue-500 to-indigo-600"
            >
              Drop again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap the left or right half (or ← / →) to spin ±30° · fall through the
        gaps
      </p>
    </div>
  );
}
