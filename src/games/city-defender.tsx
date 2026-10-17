"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 540;
const GROUND_Y = H - 54;
const BASE_X = W / 2;
const BASE_Y = H - 16;
const CITY_X = [36, 100, 164, 316, 380, 444];
const MAX_SHOTS = 3;
const SHOT_SPEED = 780;
const KILL_POINTS = 25;
const BLAST_R = 64;

interface City {
  x: number;
  alive: boolean;
  heights: number[];
}

interface Missile {
  sx: number;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  t: number;
  speed: number;
  x: number;
  y: number;
  targetedBase: boolean;
}

interface Shot {
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
}

interface Blast {
  x: number;
  y: number;
  age: number;
  r: number;
  kills: number;
  depth: number;
}

interface Game {
  cities: City[];
  baseAlive: boolean;
  missiles: Missile[];
  shots: Shot[];
  blasts: Blast[];
  toSpawn: number;
  spawnIn: number;
  wave: number;
  score: number;
}

/* ------------------------------------------------------------------ */
/* Module-level helpers                                                */
/* ------------------------------------------------------------------ */

function makeCity(x: number): City {
  const heights: number[] = [];
  for (let i = 0; i < 3; i++) heights.push(14 + Math.random() * 24);
  return { x, alive: true, heights };
}

function createGame(): Game {
  return {
    cities: CITY_X.map(makeCity),
    baseAlive: true,
    missiles: [],
    shots: [],
    blasts: [],
    toSpawn: 7,
    spawnIn: 0.9,
    wave: 1,
    score: 0,
  };
}

function waveMissiles(wave: number): number {
  return Math.min(34, 5 + wave * 2);
}

function spawnGap(wave: number): number {
  return Math.max(0.3, 1.45 - wave * 0.085);
}

function missileSpeed(wave: number): number {
  return 74 + wave * 11;
}

function quadPoint(
  p0: number,
  c: number,
  p1: number,
  t: number,
): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * c + t * t * p1;
}

function launch(g: Game): void {
  const alive = g.cities.filter((c) => c.alive);
  const aimedBase = g.wave >= 3 && Math.random() < 0.22;
  const targetBase = aimedBase || alive.length === 0;
  const pick = targetBase ? BASE_X : alive[Math.floor(Math.random() * alive.length)].x;
  const sx = Math.random() * W;
  const ty = targetBase ? BASE_Y : GROUND_Y - 22;
  g.missiles.push({
    sx,
    cx: sx + (pick - sx) * 0.5,
    cy: ty * 0.25,
    tx: pick,
    ty,
    t: 0,
    speed: missileSpeed(g.wave),
    x: sx,
    y: 0,
    targetedBase: targetBase,
  });
}

/** A shot in flight becomes a bloom the moment it reaches the aim point. */
function advanceShots(g: Game, dt: number): void {
  for (let i = g.shots.length - 1; i >= 0; i--) {
    const s = g.shots[i];
    const step = SHOT_SPEED * dt;
    const dist = Math.hypot(s.tx - s.x, s.ty - s.y);
    if (dist <= step) {
      g.shots.splice(i, 1);
      g.blasts.push({ x: s.tx, y: s.ty, age: 0, r: BLAST_R, kills: 0, depth: 0 });
      continue;
    }
    s.x += (s.vx / dist) * step;
    s.y += (s.vy / dist) * step;
  }
}

/** Blooms eat incoming warheads and set off the next one — 25 × chain. */
function advanceBlasts(g: Game, dt: number): void {
  for (let i = g.blasts.length - 1; i >= 0; i--) {
    const b = g.blasts[i];
    b.age += dt;
    if (b.age >= 1.35) {
      g.blasts.splice(i, 1);
      continue;
    }
    const radius =
      b.r *
      (b.age < 0.45
        ? b.age / 0.45
        : Math.max(0, 1 - (b.age - 0.45) / 0.9));

    for (let m = g.missiles.length - 1; m >= 0; m--) {
      const mi = g.missiles[m];
      if (Math.hypot(mi.x - b.x, mi.y - b.y) > radius) continue;
      g.missiles.splice(m, 1);
      b.kills += 1;
      const chain = b.depth + b.kills;
      g.score += KILL_POINTS * chain;
      if (radius > 24) {
        g.blasts.push({
          x: mi.x,
          y: mi.y,
          age: 0,
          r: radius * 0.66,
          kills: 0,
          depth: chain,
        });
      }
    }
  }
}

function blastRadius(b: Blast): number {
  if (b.age < 0.45) return b.r * (b.age / 0.45);
  return b.r * Math.max(0, 1 - (b.age - 0.45) / 0.9);
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

function drawScene(ctx: CanvasRenderingContext2D, g: Game): void {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#08080f");
  sky.addColorStop(1, "#141033");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(226,232,240,0.5)";
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % W;
    const y = (i * 53) % (GROUND_Y - 30);
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // ground
  ctx.fillStyle = "#1b1b2e";
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = "rgba(139,92,246,0.5)";
  ctx.fillRect(0, GROUND_Y, W, 2);

  // cities
  for (let i = 0; i < g.cities.length; i++) {
    const city = g.cities[i];
    for (let b = 0; b < city.heights.length; b++) {
      const h = city.heights[b];
      const bx = city.x - 26 + b * 18;
      if (city.alive) {
        ctx.fillStyle = b === 1 ? "#22d3ee" : "#38bdf8";
        ctx.fillRect(bx, GROUND_Y - h, 14, h);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(bx + 3, GROUND_Y - h + 4, 3, 3);
      } else {
        ctx.fillStyle = "#3f3f55";
        ctx.beginPath();
        ctx.moveTo(bx, GROUND_Y);
        ctx.lineTo(bx + 7, GROUND_Y - Math.min(8, h * 0.4));
        ctx.lineTo(bx + 14, GROUND_Y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // command base
  ctx.save();
  ctx.shadowColor = "#a78bfa";
  ctx.shadowBlur = g.baseAlive ? 16 : 0;
  ctx.fillStyle = g.baseAlive ? "#c4b5fd" : "#3f3f55";
  ctx.beginPath();
  ctx.moveTo(BASE_X, BASE_Y - 22);
  ctx.lineTo(BASE_X + 30, BASE_Y + 6);
  ctx.lineTo(BASE_X - 30, BASE_Y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // incoming trails
  ctx.lineWidth = 2;
  for (let i = 0; i < g.missiles.length; i++) {
    const m = g.missiles[i];
    ctx.strokeStyle = "rgba(251,113,133,0.75)";
    ctx.beginPath();
    ctx.moveTo(m.sx, 0);
    const steps = 7;
    for (let s = 1; s <= steps; s++) {
      const t = (m.t * s) / steps;
      ctx.lineTo(quadPoint(m.sx, m.cx, m.tx, t), quadPoint(0, m.cy, m.ty, t));
    }
    ctx.stroke();
    ctx.fillStyle = "#fda4af";
    ctx.beginPath();
    ctx.arc(m.x, m.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // interceptors in flight
  ctx.strokeStyle = "rgba(103,232,249,0.85)";
  for (let i = 0; i < g.shots.length; i++) {
    const s = g.shots[i];
    ctx.beginPath();
    ctx.moveTo(BASE_X, BASE_Y - 18);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.fillStyle = "#e0f2fe";
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // blooms
  for (let i = 0; i < g.blasts.length; i++) {
    const b = g.blasts[i];
    const r = Math.max(1, blastRadius(b));
    const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.45, "rgba(251,191,36,0.85)");
    grad.addColorStop(1, "rgba(244,114,182,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function CityDefender({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<"idle" | "playing" | "over">("idle");
  const [hud, setHud] = useState({ score: 0, cities: 6, wave: 1, shots: MAX_SHOTS });
  const [banner, setBanner] = useState<string | null>(null);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudRef = useRef(hud);

  useEffect(
    () => () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    },
    [],
  );

  const flash = useCallback((text: string) => {
    setBanner(text);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 1400);
  }, []);

  const syncHud = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const next = {
      score: g.score,
      cities: g.cities.reduce((n, c) => n + (c.alive ? 1 : 0), 0),
      wave: g.wave,
      shots: MAX_SHOTS - g.shots.length,
    };
    const cur = hudRef.current;
    if (
      cur.score !== next.score ||
      cur.cities !== next.cities ||
      cur.wave !== next.wave ||
      cur.shots !== next.shots
    ) {
      hudRef.current = next;
      setHud(next);
    }
  }, []);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    drawScene(ctx, g);
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

  const start = useCallback(() => {
    gameRef.current = createGame();
    hudRef.current = { score: 0, cities: 6, wave: 1, shots: MAX_SHOTS };
    setHud(hudRef.current);
    setNewBest(false);
    setBanner(null);
    setStatus("playing");
    flash("WAVE 1");
  }, [flash]);

  const tick = useCallback(
    (dt: number): boolean => {
      const g = gameRef.current;
      if (!g) return false;

      if (g.toSpawn > 0) {
        g.spawnIn -= dt;
        if (g.spawnIn <= 0) {
          launch(g);
          g.toSpawn -= 1;
          g.spawnIn = spawnGap(g.wave);
        }
      }

      // incoming warheads
      for (let i = g.missiles.length - 1; i >= 0; i--) {
        const m = g.missiles[i];
        m.t += (m.speed * dt) / Math.max(1, m.ty);
        m.x = quadPoint(m.sx, m.cx, m.tx, m.t);
        m.y = quadPoint(0, m.cy, m.ty, m.t);
        if (m.t < 1) continue;

        g.missiles.splice(i, 1);
        g.blasts.push({ x: m.tx, y: m.ty, age: 0, r: 44, kills: 0, depth: 0 });
        if (m.targetedBase) {
          g.baseAlive = false;
          return false;
        }
        for (let c = 0; c < g.cities.length; c++) {
          const city = g.cities[c];
          if (city.alive && Math.abs(city.x - m.tx) < 34) city.alive = false;
        }
      }

      advanceShots(g, dt);
      advanceBlasts(g, dt);

      // a bloom scorched a city, or the base took a direct hit
      for (let i = 0; i < g.blasts.length; i++) {
        const b = g.blasts[i];
        if (b.depth > 0 || b.kills > 0) continue;
        for (let c = 0; c < g.cities.length; c++) {
          const city = g.cities[c];
          if (city.alive && Math.abs(city.x - b.x) < 34 && Math.abs(b.y - GROUND_Y) < 50) {
            city.alive = false;
          }
        }
      }

      if (g.toSpawn === 0 && g.missiles.length === 0 && g.blasts.length === 0) {
        g.wave += 1;
        g.toSpawn = waveMissiles(g.wave);
        g.spawnIn = 1.1;
        flash(`WAVE ${g.wave}`);
      }

      syncHud();
      return true;
    },
    [flash, syncHud],
  );

  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      if (!tick(dt)) {
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

  const fire = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "playing") {
      start();
      return;
    }
    const g = gameRef.current;
    if (!g || !g.baseAlive || g.shots.length >= MAX_SHOTS) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const tx = ((e.clientX - rect.left) / rect.width) * W;
    const ty = ((e.clientY - rect.top) / rect.height) * H;
    const dx = tx - BASE_X;
    const dy = ty - (BASE_Y - 18);
    const dist = Math.hypot(dx, dy) || 1;
    g.shots.push({
      x: BASE_X,
      y: BASE_Y - 18,
      tx,
      ty,
      vx: (dx / dist) * SHOT_SPEED,
      vy: (dy / dist) * SHOT_SPEED,
    });
    syncHud();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start]);

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[540px]">
      <GameHud score={hud.score} best={best ?? "—"}>
        <span className="text-cyan-400">
          Cities <b className="ml-1 text-sm text-ink">{hud.cities}/6</b>
        </span>
        <span className="text-accent">
          Wave <b className="ml-1 text-sm text-ink">{hud.wave}</b>
        </span>
        <span className="text-rose-400">
          Ammo <b className="ml-1 text-sm text-ink">{hud.shots}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(167,139,250,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-crosshair"
          onPointerDown={fire}
          aria-label="City Defender battlefield"
        />

        {banner && status === "playing" && (
          <div className="animate-pop pointer-events-none absolute inset-x-0 top-6 grid place-items-center">
            <span className="rounded-full border border-white/25 bg-black/70 px-5 py-2 font-display text-lg font-bold tracking-[0.3em] text-white backdrop-blur">
              {banner}
            </span>
          </div>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">CITY DEFENDER</p>
            <p className="mt-2 text-sm text-muted">
              Six cities, one base, endless warheads raining down.
            </p>
            <p className="mt-1 text-xs text-muted">
              Blooms chain — 25 × 50 × 75 per cluster · waves never stop
            </p>
            <PrimaryButton onClick={start} tone="from-fuchsia-500 via-purple-500 to-indigo-600">
              Defend
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Click / tap anywhere to fire</p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">BASE DESTROYED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{hud.score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Held to wave {hud.wave} · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-fuchsia-500 via-purple-500 to-indigo-600">
              Defend again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Aim ahead of the fall · one bloom can swallow a whole cluster
      </p>
    </div>
  );
}
