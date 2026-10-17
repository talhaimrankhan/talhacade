"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 360;
const H = 520;
const LOG_X = 180;
const LOG_Y = 170;
const LOG_R = 74;
const KNIFE_X = 180;
const KNIFE_LEN = 78;
const BLADE = 44;
const TIP_START = 472;
const SPEED = 26; // px per frame
const SURFACE = LOG_Y + LOG_R - 14; // blade tip bites here, matching stuck blades
const APPLE_RING = LOG_Y + LOG_R + 26;
const KNIFE_WINDOW = 0.26; // rad of log a stuck blade blocks
const APPLE_WINDOW = 0.24;
const PER_LEVEL = 10;
const KNIFE_PTS = 100;
const APPLE_PTS = 250;
const START_OMEGA = 1.4; // rad/s
const MAX_OMEGA = 3.2;

interface Knife {
  rel: number;
}

interface Apple {
  rel: number;
}

interface Game {
  rot: number;
  omega: number;
  dir: 1 | -1;
  knives: Knife[];
  apples: Apple[];
  fly: number | null; // blade tip y while in flight
  level: number;
  landed: number;
  score: number;
}

/* ------------------------------------------------------------------ */
/* Module-level helpers                                                */
/* ------------------------------------------------------------------ */

const norm = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** How far the blade sits from the strike point (the bottom of the log). */
function offCentre(rel: number, rot: number): number {
  return Math.abs(norm(Math.PI / 2 - (rel + rot)));
}

function makeApples(count: number, knives: Knife[]): Apple[] {
  const apples: Apple[] = [];
  let guard = 0;
  while (apples.length < count && guard < 60) {
    guard += 1;
    const rel = Math.random() * Math.PI * 2 - Math.PI;
    const tooClose = knives.some((k) => Math.abs(norm(k.rel - rel)) < 0.6);
    if (tooClose) continue;
    apples.push({ rel });
  }
  return apples;
}

function createGame(): Game {
  const game: Game = {
    rot: 0,
    omega: START_OMEGA,
    dir: 1,
    knives: [],
    apples: [],
    fly: null,
    level: 1,
    landed: 0,
    score: 0,
  };
  game.apples = makeApples(2, game.knives);
  return game;
}

/** Ten sticks and the log speeds up — sometimes spins the other way. */
function levelUp(g: Game): void {
  g.level += 1;
  g.landed = 0;
  g.knives = [];
  g.omega = Math.min(MAX_OMEGA, START_OMEGA + (g.level - 1) * 0.22);
  if (Math.random() < 0.4) g.dir = g.dir === 1 ? -1 : 1;
  g.apples = makeApples(1 + (g.level % 3 === 0 ? 1 : 0), g.knives);
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

function drawKnife(
  ctx: CanvasRenderingContext2D,
  x: number,
  tip: number,
  tilt: number,
): void {
  ctx.save();
  ctx.translate(x, tip);
  ctx.rotate(tilt);
  // blade
  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(3.4, 8);
  ctx.lineTo(3.4, BLADE);
  ctx.lineTo(-3.4, BLADE);
  ctx.lineTo(-3.4, 8);
  ctx.closePath();
  ctx.fill();
  // handle
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.roundRect(-4.2, BLADE, 8.4, KNIFE_LEN - BLADE, 3);
  ctx.fill();
  ctx.fillStyle = "#334155";
  ctx.fillRect(-4.2, BLADE + 8, 8.4, 3);
  ctx.restore();
}

function drawScene(ctx: CanvasRenderingContext2D, g: Game): void {
  const bg = ctx.createRadialGradient(W / 2, 150, 20, W / 2, 260, 420);
  bg.addColorStop(0, "#151026");
  bg.addColorStop(1, "#07070e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // log
  ctx.save();
  ctx.translate(LOG_X, LOG_Y);
  ctx.rotate(g.rot);
  ctx.fillStyle = "#8b5a2b";
  ctx.beginPath();
  ctx.arc(0, 0, LOG_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(46,24,8,0.55)";
  ctx.lineWidth = 3;
  for (const r of [58, 42, 26, 12]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // grain spokes make the spin readable
  ctx.strokeStyle = "rgba(63,34,10,0.7)";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
    ctx.lineTo(Math.cos(a) * (LOG_R - 4), Math.sin(a) * (LOG_R - 4));
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(LOG_X, LOG_Y, LOG_R + 1, 0, Math.PI * 2);
  ctx.stroke();

  // apples riding the rim
  for (let i = 0; i < g.apples.length; i++) {
    const a = g.apples[i];
    const world = a.rel + g.rot;
    const r = LOG_R + 15;
    const ax = LOG_X + Math.cos(world) * r;
    const ay = LOG_Y + Math.sin(world) * r;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(ax, ay, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(ax - 4, ay - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#166534";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 11);
    ctx.lineTo(ax + 5, ay - 17);
    ctx.stroke();
  }

  // blades already buried in the wood
  for (let i = 0; i < g.knives.length; i++) {
    const world = g.knives[i].rel + g.rot;
    ctx.save();
    ctx.translate(LOG_X, LOG_Y);
    ctx.rotate(world - Math.PI / 2);
    drawKnife(ctx, 0, LOG_R - 14, 0);
    ctx.restore();
  }

  // blade in flight
  if (g.fly !== null) drawKnife(ctx, KNIFE_X, g.fly, 0);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function KnifeFrenzy({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<"idle" | "playing" | "over">("idle");
  const [stats, setStats] = useState({ score: 0, level: 1, landed: 0 });
  const [banner, setBanner] = useState<string | null>(null);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    },
    [],
  );

  const flash = useCallback((text: string) => {
    setBanner(text);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 1100);
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
    setStats({ score: 0, level: 1, landed: 0 });
    setNewBest(false);
    setBanner(null);
    setStatus("playing");
  }, []);

  const sync = useCallback((g: Game) => {
    setStats({ score: g.score, level: g.level, landed: g.landed });
  }, []);

  const tick = useCallback(
    (f: number): boolean => {
      const g = gameRef.current;
      if (!g) return false;

      g.rot += g.omega * g.dir * (f / 60);
      if (g.fly === null) return true;

      g.fly -= SPEED * f;

      // apples sit just outside the wood — catch them before the blade lands
      if (g.fly <= APPLE_RING && g.apples.length > 0) {
        for (let i = g.apples.length - 1; i >= 0; i--) {
          if (offCentre(g.apples[i].rel, g.rot) > APPLE_WINDOW) continue;
          g.apples.splice(i, 1);
          g.score += APPLE_PTS;
          sync(g);
        }
      }

      if (g.fly > SURFACE) return true;
      g.fly = null;

      // did the blade land on a blade already in the wood?
      for (let i = 0; i < g.knives.length; i++) {
        if (offCentre(g.knives[i].rel, g.rot) > KNIFE_WINDOW) continue;
        return false;
      }

      g.knives.push({ rel: Math.PI / 2 - g.rot });
      g.landed += 1;
      g.score += KNIFE_PTS;

      if (g.landed >= PER_LEVEL) {
        levelUp(g);
        flash(`LEVEL ${g.level}`);
      }
      sync(g);
      return true;
    },
    [flash, sync],
  );

  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const f = Math.min((t - last) / 16.667, 2.4);
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

  const throwKnife = () => {
    if (status !== "playing") {
      start();
      return;
    }
    const g = gameRef.current;
    if (!g || g.fly !== null) return;
    g.fly = TIP_START;
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={stats.score} best={best ?? "—"}>
        <span className="text-cyan-400">
          Level <b className="ml-1 text-sm text-ink">{stats.level}</b>
        </span>
        <span className="text-accent">
          Sticks <b className="ml-1 text-sm text-ink">
            {stats.landed}/{PER_LEVEL}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(251,113,133,0.85)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-pointer"
          onPointerDown={throwKnife}
          aria-label="Knife Frenzy target log"
        />

        {banner && status === "playing" && (
          <div className="animate-pop pointer-events-none absolute inset-x-0 top-[52%] grid place-items-center">
            <span className="rounded-full border border-white/25 bg-black/75 px-5 py-2 font-display text-lg font-bold tracking-[0.3em] text-white backdrop-blur">
              {banner}
            </span>
          </div>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">KNIFE FRENZY</p>
            <p className="mt-2 text-sm text-muted">
              Time every throw — one blade on another ends the run.
            </p>
            <p className="mt-1 text-xs text-muted">
              +100 per stick · +250 per 🍎 · level up every {PER_LEVEL}
            </p>
            <PrimaryButton onClick={start} tone="from-amber-400 via-orange-500 to-red-500">
              Start throwing
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Click / tap to throw</p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">KNIFED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{stats.score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Level {stats.level} · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-amber-400 via-orange-500 to-red-500">
              Throw again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Let the last blade swing clear before you send the next one
      </p>
    </div>
  );
}
