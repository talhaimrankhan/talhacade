"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 360;
const H = 520;
const PW = 64;
const PH = 12;
const R = 13;
const GRAVITY = 980;
const BOUNCE = -565;
const SPRING = -920;

type Status = "idle" | "playing" | "over";
type PlatType = "static" | "moving" | "crumble" | "spring" | "hazard";

interface Hazard {
  x: number;
  dir: number;
}

interface Platform {
  x: number;
  y: number;
  type: PlatType;
  vx: number;
  state: "idle" | "crumbling";
  t: number;
  dead: boolean;
  hazard: Hazard | null;
}

interface HopperGame {
  x: number;
  y: number;
  vx: number;
  vy: number;
  platforms: Platform[];
  topY: number;
  cameraY: number;
  minY: number;
  meters: number;
  over: boolean;
}

function metersAt(g: HopperGame): number {
  return Math.floor(Math.max(0, -g.minY) / 10);
}

function makePlatform(g: HopperGame, y: number, forced?: PlatType): Platform {
  const roll = Math.random();
  const type: PlatType =
    forced ??
    (roll < 0.12
      ? "moving"
      : roll < 0.24
        ? "crumble"
        : roll < 0.33
          ? "spring"
          : roll < 0.38
            ? "hazard"
            : "static");
  return {
    x: 14 + Math.random() * (W - 28 - PW),
    y,
    type,
    vx: Math.random() < 0.5 ? -44 : 44,
    state: "idle",
    t: 0,
    dead: false,
    hazard: type === "hazard" ? { x: 14, dir: 1 } : null,
  };
}

function createGame(): HopperGame {
  const g: HopperGame = {
    x: W / 2,
    y: H - 120,
    vx: 0,
    vy: BOUNCE,
    platforms: [],
    topY: H - 60,
    cameraY: 0,
    minY: 0,
    meters: 0,
    over: false,
  };
  g.platforms.push(makePlatform(g, H - 60, "static"));
  while (g.topY > -220) {
    const p = makePlatform(g, g.topY - (70 + Math.random() * 38));
    g.platforms.push(p);
    g.topY = p.y;
  }
  return g;
}

function stepGame(
  g: HopperGame,
  dt: number,
  steer: { left: boolean; right: boolean; targetX: number | null },
): void {
  // steering
  if (steer.left) g.vx = -285;
  else if (steer.right) g.vx = 285;
  else if (steer.targetX !== null) {
    g.vx = Math.max(-330, Math.min(330, (steer.targetX - g.x) * 7));
  } else {
    g.vx *= 0.86;
  }

  const prevY = g.y;
  g.x += g.vx * dt;
  if (g.x < -R) g.x += W + R * 2;
  if (g.x > W + R) g.x -= W + R * 2;

  g.vy += GRAVITY * dt;
  g.y += g.vy * dt;

  // platforms tick
  for (const p of g.platforms) {
    if (p.type === "moving") {
      p.x += p.vx * dt;
      if (p.x < 8 || p.x + PW > W - 8) p.vx *= -1;
    }
    if (p.state === "crumbling") {
      p.t -= dt;
      if (p.t <= 0) p.dead = true;
    }
    if (p.hazard) {
      p.hazard.x += p.hazard.dir * 42 * dt;
      if (p.hazard.x <= 2) {
        p.hazard.x = 2;
        p.hazard.dir = 1;
      }
      if (p.hazard.x >= PW - 18) {
        p.hazard.x = PW - 18;
        p.hazard.dir = -1;
      }
    }
  }

  // hazard contact ends the run
  for (const p of g.platforms) {
    if (!p.hazard) continue;
    const hx = p.x + p.hazard.x + 8;
    const hy = p.y - 7;
    const dx = g.x - hx;
    const dy = g.y - hy;
    if (dx * dx + dy * dy < (R + 8) * (R + 8)) {
      g.over = true;
      return;
    }
  }

  // land on platforms while falling
  if (g.vy > 0) {
    for (const p of g.platforms) {
      if (p.dead) continue;
      const wasAbove = prevY + R <= p.y + 4;
      const nowBelow = g.y + R >= p.y;
      const overX = g.x + R > p.x + 2 && g.x - R < p.x + PW - 2;
      if (!wasAbove || !nowBelow || !overX) continue;

      g.y = p.y - R;
      g.vy = p.type === "spring" ? SPRING : BOUNCE;
      if (p.type === "crumble" && p.state === "idle") {
        p.state = "crumbling";
        p.t = 0.4;
      }
      break;
    }
  }

  // camera follows the climb
  const screenY = g.y - g.cameraY;
  if (screenY < H * 0.42) {
    g.cameraY = g.y - H * 0.42;
  }
  if (g.y < g.minY) {
    g.minY = g.y;
    g.meters = metersAt(g);
  }

  // recycle platforms and keep the tower generated
  g.platforms = g.platforms.filter((p) => !p.dead && p.y - g.cameraY < H + 40);
  while (g.topY > g.cameraY - 160) {
    const p = makePlatform(g, g.topY - (68 + Math.random() * 42));
    g.platforms.push(p);
    g.topY = p.y;
  }

  // fell off the bottom
  if (g.y - g.cameraY > H + R + 10) g.over = true;
}

const PLAT_STYLE: Record<PlatType, string> = {
  static: "#34d399",
  moving: "#22d3ee",
  crumble: "#fb923c",
  spring: "#34d399",
  hazard: "#34d399",
};

export default function SkyHopper({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<HopperGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const steer = useRef({ left: false, right: false, targetX: null as number | null });

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0b1030");
    sky.addColorStop(1, "#0a0a18");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // drifting stars
    ctx.fillStyle = "rgba(226, 232, 240, 0.45)";
    for (let i = 0; i < 34; i++) {
      const x = (i * 79) % W;
      const y = (((i * 53) - g.cameraY * 0.25) % H + H) % H;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // platforms
    for (const p of g.platforms) {
      const sy = p.y - g.cameraY;
      if (sy < -20 || sy > H + 20) continue;
      const shake = p.state === "crumbling" ? Math.sin(time / 22) * 2 : 0;
      ctx.fillStyle = PLAT_STYLE[p.type];
      ctx.shadowColor = PLAT_STYLE[p.type];
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(p.x + shake, sy, PW, PH, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (p.type === "moving") {
        ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
        ctx.fillRect(p.x + shake + 8, sy + 4, 8, 4);
        ctx.fillRect(p.x + shake + PW - 16, sy + 4, 8, 4);
      }
      if (p.type === "crumble") {
        ctx.strokeStyle = "rgba(15, 23, 42, 0.5)";
        ctx.beginPath();
        ctx.moveTo(p.x + shake + PW / 3, sy);
        ctx.lineTo(p.x + shake + PW / 3 - 3, sy + PH);
        ctx.moveTo(p.x + shake + (2 * PW) / 3, sy);
        ctx.lineTo(p.x + shake + (2 * PW) / 3 + 3, sy + PH);
        ctx.stroke();
      }
      if (p.type === "spring") {
        const bounce = Math.sin(time / 90) * 1.5;
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x + PW / 2 - 6, sy);
        ctx.lineTo(p.x + PW / 2 + 6, sy - 6 - bounce);
        ctx.moveTo(p.x + PW / 2 + 6, sy);
        ctx.lineTo(p.x + PW / 2 - 6, sy - 6 - bounce);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (p.hazard) {
        const hx = p.x + p.hazard.x + 8;
        const hy = sy - 7;
        ctx.fillStyle = "#f43f5e";
        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(hx, hy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#0b0b16";
        ctx.fillRect(hx - 4 + p.hazard.dir * 2, hy - 2, 2.5, 2.5);
        ctx.fillRect(hx + 2 + p.hazard.dir * 2, hy - 2, 2.5, 2.5);
      }
    }

    // player (drawn twice near the edges so the wrap reads clearly)
    const drawPlayer = (px: number) => {
      const py = g.y - g.cameraY;
      ctx.save();
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(px, py, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0b0b16";
      ctx.beginPath();
      ctx.arc(px + (g.vx >= 0 ? 4 : -4), py - 3, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0b0b16";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py + 2, 5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.restore();
    };
    drawPlayer(g.x);
    if (g.x < R + 4) drawPlayer(g.x + W + R * 2);
    if (g.x > W - R - 4) drawPlayer(g.x - W - R * 2);
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
    steer.current = { left: false, right: false, targetX: null };
    setScore(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastMeters = 0;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      stepGame(g, dt, steer.current);

      if (g.meters !== lastMeters) {
        lastMeters = g.meters;
        setScore(g.meters);
      }

      if (g.over) {
        setScore(g.meters);
        setNewBest(submit(g.meters));
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        steer.current.left = true;
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        steer.current.right = true;
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        steer.current.left = false;
      }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        steer.current.right = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start]);

  const aim = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    steer.current.targetX = ((clientX - rect.left) / rect.width) * W;
  };

  return (
    <div className="w-full max-w-[400px]">
      <GameHud score={`${score} m`} best={best === null ? "—" : `${best} m`} accent="text-cyan-400" />

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(250,204,21,0.7)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          aria-label="Sky Hopper climbing field"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") {
              start();
              return;
            }
            aim(e.clientX);
          }}
          onPointerMove={(e) => {
            if (status === "playing") aim(e.clientX);
          }}
          onPointerLeave={() => {
            steer.current.targetX = null;
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">SKY HOPPER</p>
            <p className="mt-2 text-sm text-muted">
              Bounce upward, steer your arc, never touch the spiky ones.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-lime-400 via-emerald-500 to-teal-600"
            >
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ←/→ or point to steer · springs double your bounce
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">DOWN YOU GO</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score} m</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : `${best} m`}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-lime-400 via-emerald-500 to-teal-600"
            >
              Bounce again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Moving and crumbling platforms keep you honest · springs launch you twice as high
      </p>
    </div>
  );
}
