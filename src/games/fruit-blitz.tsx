"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 420;
const H = 560;
const GRAV = 0.45;
const STEP = 16.667;
const MAX_MISSED = 3;

type Status = "idle" | "playing" | "over";

interface Item { x: number; y: number; vx: number; vy: number; r: number; emoji: string; bomb: boolean; color: string }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; color: string }
interface Trail { x: number; y: number; t: number }

const FRUITS: { emoji: string; color: string }[] = [
  { emoji: "🍉", color: "#34d399" },
  { emoji: "🍊", color: "#fb923c" },
  { emoji: "🍋", color: "#fde047" },
  { emoji: "🍇", color: "#a78bfa" },
  { emoji: "🍓", color: "#fb7185" },
  { emoji: "🍒", color: "#f43f5e" },
  { emoji: "🥝", color: "#84cc16" },
  { emoji: "🍑", color: "#f9a8d4" },
  { emoji: "🍍", color: "#facc15" },
  { emoji: "🍏", color: "#22c55e" },
];

interface BlitzGame {
  items: Item[]; parts: Particle[]; trail: Trail[]; spawnIn: number; elapsed: number;
  score: number; missed: number; cuts: number; bonusAt: number; flash: number; alive: boolean;
}

function createGame(): BlitzGame {
  return {
    items: [], parts: [], trail: [], spawnIn: 350, elapsed: 0, score: 0,
    missed: 0, cuts: 0, bonusAt: 0, flash: 0, alive: true,
  };
}

/** Shortest distance from a circle centre to segment ab. */
function segCircle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((cx - ax) * dx + (cy - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  const px = ax + dx * t - cx;
  const py = ay + dy * t - cy;
  return px * px + py * py <= r * r;
}

function burst(g: BlitzGame, item: Item): void {
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
    const sp = 1.4 + Math.random() * 3.4;
    g.parts.push({
      x: item.x,
      y: item.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1.4,
      life: 46,
      max: 46,
      r: 2 + Math.random() * 3,
      color: item.bomb ? "#ef4444" : item.color,
    });
  }
}

function volley(g: BlitzGame): void {
  const level = 1 + Math.floor(g.elapsed / 20000);
  const scale = Math.min(1.32, 1 + (level - 1) * 0.11);
  const count = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const bomb = Math.random() < 0.14;
    const pick = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    const x = 55 + Math.random() * (W - 110);
    g.items.push({
      x,
      y: H + 24,
      vx: (W / 2 - x) / 52 + (Math.random() * 2 - 1),
      vy: -(20.5 + Math.random() * 3.2) * scale,
      r: 22,
      emoji: bomb ? "💣" : pick.emoji,
      bomb,
      color: bomb ? "#ef4444" : pick.color,
    });
  }
}

export default function FruitBlitz({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<BlitzGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const dragging = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    ctx.fillStyle = "#0b0b16";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(251, 146, 60, 0.10)";
    ctx.fillRect(0, H - 46, W, 46);

    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const it of g.items) {
      ctx.save();
      ctx.shadowColor = it.bomb ? "#ef4444" : it.color;
      ctx.shadowBlur = 16;
      ctx.font = `${it.r * 2}px serif`;
      ctx.fillText(it.emoji, it.x, it.y);
      ctx.restore();
    }

    // slice trail
    if (g.trail.length > 1) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 1; i < g.trail.length; i++) {
        const a = g.trail[i - 1];
        const b = g.trail[i];
        const age = time - b.t;
        if (age > 220) continue;
        ctx.strokeStyle = `rgba(255,255,255,${(1 - age / 220) * 0.85})`;
        ctx.lineWidth = 7 * (1 - age / 260);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    if (g.cuts >= 3 && time - g.bonusAt < 900) {
      ctx.fillStyle = "#fde047";
      ctx.font = "bold 22px ui-monospace, monospace";
      ctx.fillText(`COMBO ×${g.cuts}`, W / 2, 96);
    }

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(239,68,68,${(g.flash / 400) * 0.55})`;
      ctx.fillRect(0, 0, W, H);
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
    setMissed(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const step = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;

    g.elapsed += STEP;
    g.spawnIn -= STEP;
    if (g.spawnIn <= 0) {
      volley(g);
      const level = 1 + Math.floor(g.elapsed / 20000);
      g.spawnIn = Math.max(620, 1150 - (level - 1) * 90);
    }
    if (g.flash > 0) g.flash = Math.max(0, g.flash - STEP);
    if (g.trail.length > 0) {
      g.trail = g.trail.filter((p) => performance.now() - p.t < 260);
    }

    let dropDelta = 0;
    const kept: Item[] = [];
    for (const it of g.items) {
      const vy = it.vy + GRAV;
      const x = it.x + it.vx;
      const y = it.y + vy;
      const gone = y - it.r > H + 30 || x < -60 || x > W + 60;
      if (gone) {
        if (!it.bomb) dropDelta += 1;
      } else {
        kept.push({ ...it, x, y, vy });
      }
    }
    g.items = kept;
    if (dropDelta > 0) {
      g.missed += dropDelta;
      setMissed(g.missed);
      if (g.missed >= MAX_MISSED) g.alive = false;
    }

    const parts: Particle[] = [];
    for (const p of g.parts) {
      const vy = p.vy + 0.16;
      const life = p.life - 1;
      if (life <= 0) continue;
      parts.push({ ...p, x: p.x + p.vx, y: p.y + vy, vy, life });
    }
    g.parts = parts;
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
      while (acc >= STEP) {
        acc -= STEP;
        step();
      }

      const g = gameRef.current;
      if (g && !g.alive) {
        const finalScore = Math.max(0, g.score);
        setScore(finalScore);
        setNewBest(submit(finalScore));
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

  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const cutAt = (ax: number, ay: number, bx: number, by: number) => {
    const g = gameRef.current;
    if (!g) return;
    const survivors: Item[] = [];
    for (const it of g.items) {
      if (!segCircle(ax, ay, bx, by, it.x, it.y, it.r)) {
        survivors.push(it);
        continue;
      }
      burst(g, it);
      if (it.bomb) {
        g.flash = 400;
        g.cuts = 0;
        g.score = Math.max(0, g.score - 25);
      } else {
        g.cuts += 1;
        g.score += 10;
        if (g.cuts === 3) g.bonusAt = performance.now();
        if (g.cuts >= 3) g.score += 25;
      }
      setScore(g.score);
    }
    g.items = survivors;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "playing") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toLocal(e);
    dragging.current = true;
    lastPt.current = p;
    const g = gameRef.current;
    if (g) g.cuts = 0;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current || status !== "playing") return;
    const p = toLocal(e);
    const prev = lastPt.current ?? p;
    lastPt.current = p;
    const g = gameRef.current;
    if (!g) return;
    g.trail.push({ x: p.x, y: p.y, t: performance.now() });
    if (g.trail.length > 40) g.trail.shift();
    if (prev.x !== p.x || prev.y !== p.y) cutAt(prev.x, prev.y, p.x, p.y);
  };

  const onPointerUp = () => {
    dragging.current = false;
    lastPt.current = null;
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === " " || key === "enter" || key === "r") {
        e.preventDefault();
        if (status !== "playing") start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start]);

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-rose-400">
          Missed{" "}
          <b className="ml-1 text-sm text-ink">
            {missed}/{MAX_MISSED}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(251,146,60,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label="Fruit Blitz slicing board"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              FRUIT BLITZ
            </p>
            <p className="mt-2 text-sm text-muted">
              Swipe through fruit. Three misses and the stand closes. Watch for
              bombs.
            </p>
            <PrimaryButton onClick={start} tone="from-amber-400 via-orange-500 to-red-500">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Drag to slice · 3+ in one swipe pays a combo bonus
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
            <PrimaryButton onClick={start} tone="from-amber-400 via-orange-500 to-red-500">
              New run
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Swipe to slice · 💣 costs 25 · let 3 fruits drop and it&apos;s over
      </p>
    </div>
  );
}
