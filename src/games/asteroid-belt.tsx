"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 520;
const SHIP_R = 13;
const MAX_BULLETS = 3;
const TURN = 0.058;
const PUSH = 0.135;
const DRAG = 0.994;
const TOP_SPEED = 6.4;

/** rank 1 = boulder, 3 = shard. */
const RADIUS = [0, 34, 21, 12];
const POINTS = [0, 20, 50, 100];

type Pad = "left" | "right" | "thrust" | "fire";

/** On-screen controls — the whole ship on one thumb. */
const PADS: Array<{ pad: Pad; label: string; aria: string; hot?: boolean }> = [
  { pad: "left", label: "◀", aria: "Rotate left" },
  { pad: "right", label: "▶", aria: "Rotate right" },
  { pad: "thrust", label: "⬆", aria: "Thrust" },
  { pad: "fire", label: "🔥", aria: "Fire cannons", hot: true },
];

interface Star {
  x: number;
  y: number;
  s: number;
  a: number;
}

interface Rock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rank: number;
  r: number;
  rot: number;
  spin: number;
  shape: number[];
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  foe: boolean;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface Ufo {
  x: number;
  y: number;
  vx: number;
  cool: number;
}

interface Ship {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  thrust: boolean;
  inv: number;
}

interface Game {
  ship: Ship;
  rocks: Rock[];
  bullets: Bullet[];
  sparks: Spark[];
  stars: Star[];
  ufo: Ufo | null;
  wave: number;
  lives: number;
  score: number;
  fireCd: number;
  ufoIn: number;
}

/* ------------------------------------------------------------------ */
/* Module-level helpers                                                */
/* ------------------------------------------------------------------ */

function makeStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      s: Math.random() < 0.22 ? 2 : 1,
      a: 0.25 + Math.random() * 0.6,
    });
  }
  return stars;
}

function shapeFor(): number[] {
  const pts: number[] = [];
  const n = 9 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) pts.push(0.72 + Math.random() * 0.34);
  return pts;
}

function makeRock(
  rank: number,
  x: number,
  y: number,
  speed: number,
  heading?: number,
): Rock {
  const a = heading ?? Math.random() * Math.PI * 2;
  const pace = speed * (rank === 1 ? 1 : rank === 2 ? 1.45 : 1.9);
  return {
    x,
    y,
    vx: Math.cos(a) * pace,
    vy: Math.sin(a) * pace,
    rank,
    r: RADIUS[rank],
    rot: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.04,
    shape: shapeFor(),
  };
}

/** Rocks arrive from the rim, never on top of the ship. */
function spawnWave(count: number, wave: number): Rock[] {
  const rocks: Rock[] = [];
  const speed = 0.55 + wave * 0.07;
  while (rocks.length < count) {
    const edge = Math.floor(Math.random() * 4);
    const x = edge === 0 ? 0 : edge === 1 ? W : Math.random() * W;
    const y = edge === 2 ? 0 : edge === 3 ? H : Math.random() * H;
    if (Math.hypot(x - W / 2, y - H / 2) < 150) continue;
    const heading = Math.atan2(H / 2 - y, W / 2 - x) + (Math.random() - 0.5) * 1.4;
    rocks.push(makeRock(1, x, y, speed, heading));
  }
  return rocks;
}

function burst(sparks: Spark[], x: number, y: number, color: string, n: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 0.7 + Math.random() * 2.6;
    sparks.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 26 + Math.random() * 18,
      color,
    });
  }
}

function wrap(p: { x: number; y: number }): void {
  if (p.x < -40) p.x = W + 40;
  else if (p.x > W + 40) p.x = -40;
  if (p.y < -40) p.y = H + 40;
  else if (p.y > H + 40) p.y = -40;
}

/** Player shots chew through the belt, splitting boulders as they go. */
function resolveShots(g: Game): void {
  for (let bi = g.bullets.length - 1; bi >= 0; bi--) {
    const b = g.bullets[bi];
    if (b.foe) continue;

    if (g.ufo && Math.hypot(b.x - g.ufo.x, b.y - g.ufo.y) < 26) {
      g.bullets.splice(bi, 1);
      burst(g.sparks, g.ufo.x, g.ufo.y, "#f472b6", 20);
      g.score += 200;
      g.ufo = null;
      continue;
    }

    for (let ri = g.rocks.length - 1; ri >= 0; ri--) {
      const r = g.rocks[ri];
      if (Math.hypot(b.x - r.x, b.y - r.y) > r.r + 4) continue;
      g.bullets.splice(bi, 1);
      g.rocks.splice(ri, 1);
      g.score += POINTS[r.rank];
      burst(g.sparks, r.x, r.y, "#67e8f9", 12);
      if (r.rank < 3) {
        const heading = Math.atan2(r.vy, r.vx);
        for (const off of [-0.8, 0.8]) {
          g.rocks.push(
            makeRock(r.rank + 1, r.x, r.y, Math.hypot(r.vx, r.vy), heading + off),
          );
        }
      }
      break;
    }
  }
}

function createGame(): Game {
  return {
    ship: { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, thrust: false, inv: 0 },
    rocks: spawnWave(4, 1),
    bullets: [],
    sparks: [],
    stars: makeStars(),
    ufo: null,
    wave: 1,
    lives: 3,
    score: 0,
    fireCd: 0,
    ufoIn: 60 * (10 + Math.random() * 8),
  };
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

function drawShip(ctx: CanvasRenderingContext2D, s: Ship, t: number): void {
  if (s.inv > 0 && Math.floor(s.inv / 5) % 2 === 0) return;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);
  if (s.thrust) {
    ctx.fillStyle = Math.sin(t / 40) > 0 ? "#fbbf24" : "#fb7185";
    ctx.beginPath();
    ctx.moveTo(-11, -6);
    ctx.lineTo(-24 - Math.random() * 8, 0);
    ctx.lineTo(-11, 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowColor = "#22d3ee";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#0b0b16";
  ctx.strokeStyle = "#67e8f9";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(17, 0);
  ctx.lineTo(-12, -12);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-12, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRock(ctx: CanvasRenderingContext2D, r: Rock): void {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.rot);
  ctx.beginPath();
  for (let i = 0; i < r.shape.length; i++) {
    const a = (i / r.shape.length) * Math.PI * 2;
    const rad = r.r * r.shape[i];
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#1c2333";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(148,163,184,0.35)";
  ctx.beginPath();
  ctx.arc(-r.r * 0.3, -r.r * 0.2, r.r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r.r * 0.32, r.r * 0.3, r.r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawUfo(ctx: CanvasRenderingContext2D, u: Ufo): void {
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.shadowColor = "#f472b6";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#a78bfa";
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e9d5ff";
  ctx.beginPath();
  ctx.ellipse(0, -6, 11, 8, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawScene(ctx: CanvasRenderingContext2D, g: Game, t: number): void {
  ctx.fillStyle = "#07070e";
  ctx.fillRect(0, 0, W, H);
  for (const s of g.stars) {
    ctx.fillStyle = `rgba(226,232,240,${s.a})`;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }

  for (const r of g.rocks) drawRock(ctx, r);
  if (g.ufo) drawUfo(ctx, g.ufo);

  for (const b of g.bullets) {
    ctx.save();
    ctx.shadowColor = b.foe ? "#fb7185" : "#67e8f9";
    ctx.shadowBlur = 10;
    ctx.fillStyle = b.foe ? "#fb7185" : "#e0f2fe";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const s of g.sparks) {
    ctx.globalAlpha = Math.max(0, Math.min(1, s.life / 30));
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  drawShip(ctx, g.ship, t);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AsteroidBelt({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<"idle" | "playing" | "over">("idle");
  const [hud, setHud] = useState({ score: 0, lives: 3, wave: 1 });
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const keys = useRef({ left: false, right: false, thrust: false, fire: false });
  const hudRef = useRef(hud);

  const syncHud = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const next = { score: g.score, lives: g.lives, wave: g.wave };
    const cur = hudRef.current;
    if (cur.score !== next.score || cur.lives !== next.lives || cur.wave !== next.wave) {
      hudRef.current = next;
      setHud(next);
    }
  }, []);

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
    hudRef.current = { score: 0, lives: 3, wave: 1 };
    setHud(hudRef.current);
    setNewBest(false);
    keys.current = { left: false, right: false, thrust: false, fire: false };
    setStatus("playing");
  }, []);

  /* ---------------- simulation ---------------- */

  const tick = useCallback(
    (f: number): boolean => {
      const g = gameRef.current;
      if (!g) return false;
      const s = g.ship;
      const k = keys.current;

      s.thrust = k.thrust;
      if (k.left) s.angle -= TURN * f;
      if (k.right) s.angle += TURN * f;
      if (k.thrust) {
        s.vx += Math.cos(s.angle) * PUSH * f;
        s.vy += Math.sin(s.angle) * PUSH * f;
      }
      s.vx *= Math.pow(DRAG, f);
      s.vy *= Math.pow(DRAG, f);
      const speed = Math.hypot(s.vx, s.vy);
      if (speed > TOP_SPEED) {
        s.vx = (s.vx / speed) * TOP_SPEED;
        s.vy = (s.vy / speed) * TOP_SPEED;
      }
      s.x += s.vx * f;
      s.y += s.vy * f;
      wrap(s);
      if (s.inv > 0) s.inv -= f;

      // cannon — three shots in the air at most
      g.fireCd -= f;
      const guns = g.bullets.reduce((n, b) => (b.foe ? n : n + 1), 0);
      if (k.fire && g.fireCd <= 0 && guns < MAX_BULLETS) {
        g.bullets.push({
          x: s.x + Math.cos(s.angle) * 18,
          y: s.y + Math.sin(s.angle) * 18,
          vx: Math.cos(s.angle) * 9 + s.vx * 0.4,
          vy: Math.sin(s.angle) * 9 + s.vy * 0.4,
          life: 54,
          foe: false,
        });
        g.fireCd = 9;
      }

      for (let i = 0; i < g.bullets.length; i++) {
        const b = g.bullets[i];
        b.x += b.vx * f;
        b.y += b.vy * f;
        b.life -= f;
        wrap(b);
      }
      g.bullets = g.bullets.filter((b) => b.life > 0);

      for (let i = 0; i < g.rocks.length; i++) {
        const r = g.rocks[i];
        r.x += r.vx * f;
        r.y += r.vy * f;
        r.rot += r.spin * f;
        wrap(r);
      }

      // bullets vs rocks (and the occasional saucer)
      resolveShots(g);

      // ufo strafer
      if (g.ufo) {
        g.ufo.x += g.ufo.vx * f;
        g.ufo.cool -= f;
        if (g.ufo.cool <= 0) {
          const aim = Math.atan2(s.y - g.ufo.y, s.x - g.ufo.x) + (Math.random() - 0.5) * 0.3;
          g.bullets.push({
            x: g.ufo.x,
            y: g.ufo.y,
            vx: Math.cos(aim) * 5,
            vy: Math.sin(aim) * 5,
            life: 90,
            foe: true,
          });
          g.ufo.cool = 46;
        }
        if (g.ufo.x < -60 || g.ufo.x > W + 60) g.ufo = null;
      } else {
        g.ufoIn -= f;
        if (g.ufoIn <= 0 && g.rocks.length > 0) {
          const fromLeft = Math.random() < 0.5;
          g.ufo = { x: fromLeft ? -40 : W + 40, y: 70 + Math.random() * 160, vx: fromLeft ? 2.1 : -2.1, cool: 40 };
          g.ufoIn = 60 * (12 + Math.random() * 10);
        }
      }

      for (let i = 0; i < g.sparks.length; i++) {
        const sp = g.sparks[i];
        sp.x += sp.vx * f;
        sp.y += sp.vy * f;
        sp.life -= f;
      }
      g.sparks = g.sparks.filter((sp) => sp.life > 0);

      // ship vs rocks / foe shots
      if (s.inv <= 0) {
        const hitRock = g.rocks.some((r) => Math.hypot(s.x - r.x, s.y - r.y) < r.r + SHIP_R * 0.7);
        const hitShot = g.bullets.some(
          (b) => b.foe && Math.hypot(s.x - b.x, s.y - b.y) < SHIP_R + 4,
        );
        if (hitRock || hitShot) {
          burst(g.sparks, s.x, s.y, "#fbbf24", 26);
          g.lives -= 1;
          if (g.lives <= 0) return false;
          s.x = W / 2;
          s.y = H / 2;
          s.vx = 0;
          s.vy = 0;
          s.angle = -Math.PI / 2;
          s.inv = 110;
          g.bullets = g.bullets.filter((b) => b.foe);
        }
      }

      // next wave
      if (g.rocks.length === 0 && !g.ufo) {
        g.wave += 1;
        g.rocks = spawnWave(3 + g.wave, g.wave);
        g.ufoIn = 60 * (8 + Math.random() * 6);
      }

      syncHud();
      return true;
    },
    [syncHud],
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
    const setKey = (key: string, down: boolean): boolean => {
      const k = keys.current;
      switch (key) {
        case "arrowleft":
        case "a":
          k.left = down;
          return true;
        case "arrowright":
        case "d":
          k.right = down;
          return true;
        case "arrowup":
        case "w":
          k.thrust = down;
          return true;
        case " ":
        case "spacebar":
          k.fire = down;
          return true;
        default:
          return false;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === " " || key.startsWith("arrow")) e.preventDefault();
      if (key === " " && !e.repeat && status !== "playing") {
        start();
        return;
      }
      setKey(key, true);
    };
    const onKeyUp = (e: KeyboardEvent) => setKey(e.key.toLowerCase(), false);
    const release = () => {
      keys.current.left = false;
      keys.current.right = false;
      keys.current.thrust = false;
      keys.current.fire = false;
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

  const hold = (which: Pad, down: boolean) => {
    if (down && status !== "playing") start();
    keys.current[which] = down;
  };

  /* ---------------- view ---------------- */

  const padCls =
    "grid h-14 flex-1 touch-none select-none place-items-center rounded-xl border border-line bg-surface text-xl text-ink transition active:scale-95 active:border-primary/60 hover:border-primary/40";

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={hud.score} best={best ?? "—"}>
        <span className="text-rose-400">
          Lives <b className="ml-1 text-sm text-ink">{"🛸".repeat(Math.max(0, hud.lives)) || "—"}</b>
        </span>
        <span className="text-accent">
          Wave <b className="ml-1 text-sm text-ink">{hud.wave}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(56,189,248,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          aria-label="Asteroid Belt game board"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">ASTEROID BELT</p>
            <p className="mt-2 text-sm text-muted">
              Rotate, thrust and blast — three bullets max, screen wraps.
            </p>
            <p className="mt-1 text-xs text-muted">
              20 / 50 / 100 points per rock size · waves grow · 🛸 = 200
            </p>
            <PrimaryButton onClick={start} tone="from-sky-400 via-blue-500 to-indigo-600">
              Launch
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ←/→ rotate · ↑ thrust · Space fire
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">SHIP LOST</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{hud.score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Wave {hud.wave} · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-sky-400 via-blue-500 to-indigo-600">
              Fly again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      {/* full touch control pad */}
      <div className="mt-3 flex gap-2">
        {PADS.map((p) => (
          <button
            key={p.pad}
            type="button"
            aria-label={p.aria}
            className={p.hot ? `${padCls} border-rose-500/50 text-rose-400` : padCls}
            onPointerDown={() => hold(p.pad, true)}
            onPointerUp={() => hold(p.pad, false)}
            onPointerLeave={() => hold(p.pad, false)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Split every rock twice — small shards are worth the most
      </p>
    </div>
  );
}
