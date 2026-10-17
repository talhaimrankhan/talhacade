"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 340;
const H = 460;
const WALL = 8;
const FLOOR = H - 8;
const LINE_Y = 72;
const GRAVITY = 1400;
const BOUNCE_FLOOR = 0.26;
const BOUNCE_WALL = 0.32;
const DROP_COOLDOWN = 240;
const COMBO_WINDOW = 0.7; // seconds

const TIERS = [
  { r: 14, color: "#ef4444", deep: "#991b1b", face: "🍒" },
  { r: 18, color: "#f43f5e", deep: "#9f1239", face: "🍓" },
  { r: 23, color: "#8b5cf6", deep: "#5b21b6", face: "🍇" },
  { r: 29, color: "#f97316", deep: "#9a3412", face: "🍊" },
  { r: 36, color: "#ef4444", deep: "#991b1b", face: "🍎" },
  { r: 44, color: "#eab308", deep: "#854d0e", face: "🍐" },
  { r: 53, color: "#22c55e", deep: "#166534", face: "🍉" },
];

type Status = "idle" | "playing" | "over";

interface Fruit {
  id: number;
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  over: number;
}

interface MergeGame {
  fruits: Fruit[];
  current: number;
  next: number;
  aim: number;
  dropAt: number;
  score: number;
  combo: number;
  lastMerge: number;
  nextId: number;
  over: boolean;
}

function randTier(): number {
  return Math.floor(Math.random() * 3);
}

function createGame(): MergeGame {
  return {
    fruits: [],
    current: randTier(),
    next: randTier(),
    aim: W / 2,
    dropAt: -9999,
    score: 0,
    combo: 0,
    lastMerge: -9999,
    nextId: 1,
    over: false,
  };
}

/** One fixed physics tick: gravity, walls, pairwise collisions, merges. */
function stepPhysics(g: MergeGame, dt: number, now: number): void {
  for (const f of g.fruits) {
    f.vy += GRAVITY * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vx *= 1 - Math.min(0.9, 0.5 * dt);
  }

  for (const f of g.fruits) {
    const t = TIERS[f.tier];
    if (f.x - t.r < WALL) {
      f.x = WALL + t.r;
      f.vx = Math.abs(f.vx) * BOUNCE_WALL;
    } else if (f.x + t.r > W - WALL) {
      f.x = W - WALL - t.r;
      f.vx = -Math.abs(f.vx) * BOUNCE_WALL;
    }
    if (f.y + t.r > FLOOR) {
      f.y = FLOOR - t.r;
      f.vy = -Math.abs(f.vy) * BOUNCE_FLOOR;
      f.vx *= 0.92;
      if (Math.abs(f.vy) < 22) f.vy = 0;
    }
  }

  // pairwise circle resolution (positional correction + soft impulse)
  for (let i = 0; i < g.fruits.length; i++) {
    for (let j = i + 1; j < g.fruits.length; j++) {
      const a = g.fruits[i];
      const b = g.fruits[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(0.001, Math.hypot(dx, dy));
      const min = TIERS[a.tier].r + TIERS[b.tier].r;
      if (dist >= min) continue;

      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = min - dist;
      const ma = TIERS[a.tier].r ** 2;
      const mb = TIERS[b.tier].r ** 2;
      const total = ma + mb;
      a.x -= nx * overlap * (mb / total);
      a.y -= ny * overlap * (mb / total);
      b.x += nx * overlap * (ma / total);
      b.y += ny * overlap * (ma / total);

      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) {
        const impulse = (-(1 + 0.14) * vn) / 2;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
    }
  }

  // merging same-tier fruit that touch (chains cascade naturally)
  const dead = new Set<number>();
  const born: Fruit[] = [];
  for (let i = 0; i < g.fruits.length; i++) {
    for (let j = i + 1; j < g.fruits.length; j++) {
      const a = g.fruits[i];
      const b = g.fruits[j];
      if (a.tier !== b.tier || a.tier >= TIERS.length - 1) continue;
      if (dead.has(a.id) || dead.has(b.id)) continue;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (dist > TIERS[a.tier].r + TIERS[b.tier].r + 1) continue;

      dead.add(a.id);
      dead.add(b.id);
      g.combo = now - g.lastMerge < COMBO_WINDOW ? g.combo + 1 : 1;
      g.lastMerge = now;
      const tier = a.tier + 1;
      g.score += (tier + 1) ** 2 * 10 * g.combo;
      born.push({
        id: g.nextId++,
        tier,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        vx: (a.vx + b.vx) / 2,
        vy: (a.vy + b.vy) / 2 - 30,
        over: 0,
      });
    }
  }
  if (dead.size > 0) {
    g.fruits = g.fruits.filter((f) => !dead.has(f.id)).concat(born);
  }

  if (now - g.lastMerge > COMBO_WINDOW) g.combo = 0;

  // any fruit loitering above the line ends the run
  for (const f of g.fruits) {
    const speed = Math.hypot(f.vx, f.vy);
    if (f.y - TIERS[f.tier].r < LINE_Y && speed < 45) f.over += dt;
    else f.over = 0;
    if (f.over > 1) g.over = true;
  }
}

export default function FruitMerge({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<MergeGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [preview, setPreview] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const scoreRef = useRef(0);
  const comboRef = useRef(0);

  /* ----------------------------- render ----------------------------- */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    ctx.fillStyle = "#0b0b16";
    ctx.fillRect(0, 0, W, H);

    // pit walls + floor
    ctx.fillStyle = "#191932";
    ctx.fillRect(0, 0, WALL, FLOOR);
    ctx.fillRect(W - WALL, 0, WALL, FLOOR);
    ctx.fillRect(0, FLOOR, W, H - FLOOR);

    // the danger line
    ctx.strokeStyle = "rgba(244, 63, 94, 0.75)";
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 7]);
    ctx.beginPath();
    ctx.moveTo(WALL, LINE_Y);
    ctx.lineTo(W - WALL, LINE_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // aim guide + ghost fruit
    if (status === "playing") {
      const t = TIERS[g.current];
      const ax = Math.min(W - WALL - t.r, Math.max(WALL + t.r, g.aim));
      ctx.strokeStyle = "rgba(148, 163, 184, 0.28)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 8]);
      ctx.beginPath();
      ctx.moveTo(ax, 16);
      ctx.lineTo(ax, FLOOR);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(ax, 36, t.r, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // fruit
    for (const f of g.fruits) {
      const t = TIERS[f.tier];
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      const grad = ctx.createRadialGradient(
        f.x - t.r * 0.35,
        f.y - t.r * 0.4,
        t.r * 0.15,
        f.x,
        f.y,
        t.r,
      );
      grad.addColorStop(0, t.color);
      grad.addColorStop(1, t.deep);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.font = `${Math.round(t.r * 1.05)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.face, f.x, f.y + 1);
    }
  }, [status]);

  // canvas sizing + first frame
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

  useEffect(() => {
    if (status !== "playing") draw();
  }, [status, draw]);

  /* ------------------------------ loop ------------------------------ */

  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const dtStep = 1 / 120;

    const loop = (t: number) => {
      const g = gameRef.current;
      if (!g) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      acc += dt;
      let guard = 0;
      while (acc >= dtStep && guard < 8) {
        stepPhysics(g, dtStep, t / 1000);
        acc -= dtStep;
        guard += 1;
      }

      if (g.score !== scoreRef.current) {
        scoreRef.current = g.score;
        setScore(g.score);
      }
      if (g.combo !== comboRef.current) {
        comboRef.current = g.combo;
        setCombo(g.combo);
      }

      draw();

      if (g.over) {
        setScore(g.score);
        setNewBest(submit(g.score));
        setStatus("over");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit]);

  /* ----------------------------- input ----------------------------- */

  const start = useCallback(() => {
    const fresh = createGame();
    gameRef.current = fresh;
    scoreRef.current = 0;
    comboRef.current = 0;
    setScore(0);
    setCombo(0);
    setPreview(fresh.next);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const drop = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const now = performance.now();
    if (now - g.dropAt < DROP_COOLDOWN) return;
    g.dropAt = now;

    const t = TIERS[g.current];
    const x = Math.min(W - WALL - t.r, Math.max(WALL + t.r, g.aim));
    g.fruits.push({
      id: g.nextId++,
      tier: g.current,
      x,
      y: 38,
      vx: 0,
      vy: 0,
      over: 0,
    });
    g.current = g.next;
    g.next = randTier();
    setPreview(g.next);
  }, []);

  const toAim = (e: React.PointerEvent<HTMLCanvasElement>): number => {
    const rect = e.currentTarget.getBoundingClientRect();
    return (e.clientX - rect.left) * (W / rect.width);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "playing") return;
    const g = gameRef.current;
    if (!g) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    g.aim = toAim(e);
    drop();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "playing") return;
    const g = gameRef.current;
    if (!g) return;
    g.aim = toAim(e);
  };

  /* ------------------------------ view ------------------------------ */

  return (
    <div className="w-full max-w-[400px]">
      <GameHud score={score} best={best ?? "—"} accent="text-warn">
        <span className="text-accent">
          Next{" "}
          <b className="ml-1 align-middle text-lg leading-none">{TIERS[preview].face}</b>
        </span>
        {combo > 1 && (
          <span className="text-hot">
            Combo <b className="ml-1 text-sm text-ink">×{combo}</b>
          </span>
        )}
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(249,115,22,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          style={{ aspectRatio: `${W} / ${H}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          aria-label="Fruit Merge pit"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">FRUIT MERGE</p>
            <p className="mt-2 text-sm text-muted">
              Match falling fruit to fuse them into bigger ones — mind the red line.
            </p>
            <PrimaryButton onClick={start} tone="from-amber-400 via-orange-500 to-red-500">
              Drop in
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Aim with the pointer · click or tap to drop</p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="text-4xl">🍉</p>
            <p className="mt-2 font-display text-2xl font-bold text-rose-400">PIT OVERFLOWED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New high score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">Best {best ?? "—"}</p>
            <PrimaryButton onClick={start} tone="from-amber-400 via-orange-500 to-red-500">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Two same fruits merge · chain them fast for combo points
      </p>
    </div>
  );
}
