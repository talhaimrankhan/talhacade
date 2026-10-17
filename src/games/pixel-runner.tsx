"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 280;
const GY = 232; // ground line
const PX = 70; // player x
const STAND_H = 40;
const DUCK_H = 22;
const GRAVITY = 2400;
const JUMP_VY = -690;

type Status = "idle" | "playing" | "over";

interface Obstacle {
  x: number;
  w: number;
  h: number;
  kind: "ground" | "fly";
}

interface RunnerGame {
  obstacles: Obstacle[];
  py: number; // feet (bottom of hitbox)
  vy: number;
  ducking: boolean;
  duckT: number;
  distance: number;
  speed: number;
  meters: number;
  legT: number;
  nextSpawn: number;
  over: boolean;
}

function speedAt(distance: number): number {
  return Math.min(440, 250 + distance * 0.02);
}

function metersAt(distance: number): number {
  return Math.floor(distance / 46);
}

function makeCactus(): Obstacle {
  const tall = Math.random() < 0.4;
  return {
    x: W + 20,
    w: 16 + Math.random() * 10,
    h: tall ? 38 + Math.random() * 8 : 26 + Math.random() * 8,
    kind: "ground",
  };
}

function makeFlyer(): Obstacle {
  return { x: W + 20, w: 28, h: 18, kind: "fly" };
}

function createGame(): RunnerGame {
  return {
    obstacles: [],
    py: GY,
    vy: 0,
    ducking: false,
    duckT: 0,
    distance: 0,
    speed: speedAt(0),
    meters: 0,
    legT: 0,
    nextSpawn: 320,
    over: false,
  };
}

function spawnCluster(g: RunnerGame): void {
  const first = Math.random() < 0.22 ? makeFlyer() : makeCactus();
  if (first.kind === "fly") {
    // flyers keep a lone approach so duck timing stays fair
    g.obstacles.push(first);
  } else {
    g.obstacles.push(first);
    if (Math.random() < 0.38) {
      const gap = 24 + Math.random() * 22;
      const second = makeCactus();
      second.x = first.x + first.w + gap;
      second.h = 22 + Math.random() * 10;
      g.obstacles.push(second);
    }
  }
}

function playerHeight(g: RunnerGame): number {
  return g.ducking && g.py >= GY ? DUCK_H : STAND_H;
}

function jump(g: RunnerGame): void {
  if (g.over) return;
  if (g.py >= GY) {
    g.vy = JUMP_VY;
    g.ducking = false;
    g.duckT = 0;
  }
}

function duckFor(g: RunnerGame, seconds: number): void {
  g.duckT = Math.max(g.duckT, seconds);
}

function stepGame(g: RunnerGame, dt: number): void {
  g.distance += g.speed * dt;
  g.speed = speedAt(g.distance);
  g.meters = metersAt(g.distance);
  g.legT += dt;

  // physics
  if (g.py < GY || g.vy < 0) {
    g.vy += GRAVITY * dt;
    g.py += g.vy * dt;
    if (g.py >= GY) {
      g.py = GY;
      g.vy = 0;
    }
  }

  if (g.duckT > 0) {
    g.duckT = Math.max(0, g.duckT - dt);
    if (g.py >= GY) g.ducking = true;
  }

  // obstacles
  for (let i = g.obstacles.length - 1; i >= 0; i--) {
    const o = g.obstacles[i];
    o.x -= g.speed * dt;
    if (o.x + o.w < -10) g.obstacles.splice(i, 1);
  }

  if (g.distance >= g.nextSpawn) {
    spawnCluster(g);
    g.nextSpawn = g.distance + (240 + Math.random() * 180) * (g.speed / 250);
  }

  // collisions
  const h = playerHeight(g);
  const pLeft = PX + 2;
  const pRight = PX + (g.ducking ? 28 : 19);
  const pTop = g.py - h;
  for (const o of g.obstacles) {
    const oTop = o.kind === "fly" ? GY - 53 : GY - o.h;
    const oBottom = o.kind === "fly" ? GY - 35 : GY;
    if (pRight < o.x + 2 || pLeft > o.x + o.w - 2) continue;
    if (pTop < oBottom - 2 && g.py > oTop + 2) {
      g.over = true;
      return;
    }
  }
}

export default function PixelRunner({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<RunnerGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const duckHeld = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    ctx.fillStyle = "#0b0b14";
    ctx.fillRect(0, 0, W, H);

    // distant hills
    ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
    for (let i = 0; i < 5; i++) {
      const hx = ((i * 140 - g.distance * 0.15) % (W + 200)) - 100;
      ctx.beginPath();
      ctx.arc(hx, GY, 60, Math.PI, 0);
      ctx.fill();
    }

    // ground
    ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
    ctx.fillRect(0, GY, W, 2);
    ctx.fillStyle = "rgba(148, 163, 184, 0.22)";
    for (let x = (g.distance * -1) % 36; x < W; x += 36) {
      ctx.fillRect(x, GY + 10, 16, 2);
    }

    // obstacles
    for (const o of g.obstacles) {
      if (o.kind === "fly") {
        const wing = Math.floor(time / 120) % 2 === 0 ? -6 : 6;
        ctx.fillStyle = "#fb7185";
        ctx.shadowColor = "#fb7185";
        ctx.shadowBlur = 8;
        ctx.fillRect(o.x + 6, GY - 51, o.w - 12, 14);
        ctx.fillRect(o.x, GY - 51 + wing, 8, 6);
        ctx.fillRect(o.x + o.w - 8, GY - 51 - wing, 8, 6);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "#34d399";
        ctx.shadowColor = "#34d399";
        ctx.shadowBlur = 8;
        ctx.fillRect(o.x, GY - o.h, o.w, o.h);
        // cactus arms
        ctx.fillRect(o.x - 6, GY - o.h + 10, 6, 4);
        ctx.fillRect(o.x - 6, GY - o.h + 6, 4, 8);
        ctx.fillRect(o.x + o.w, GY - o.h + 16, 6, 4);
        ctx.fillRect(o.x + o.w + 2, GY - o.h + 10, 4, 10);
        ctx.shadowBlur = 0;
      }
    }

    // runner
    const h = playerHeight(g);
    const top = g.py - h;
    const ducking = h === DUCK_H;
    const frame = Math.floor(g.legT * 9) % 4;
    ctx.fillStyle = "#e2e8f0";
    ctx.shadowColor = "#67e8f9";
    ctx.shadowBlur = 10;
    if (ducking) {
      ctx.fillRect(PX, top + 4, 26, 12); // body
      ctx.fillRect(PX + 20, top, 10, 8); // head
      ctx.fillStyle = "#0b0b14";
      ctx.fillRect(PX + 27, top + 2, 2, 2); // eye
    } else {
      ctx.fillRect(PX + 3, top + 12, 13, 16); // body
      ctx.fillRect(PX + 4, top, 12, 12); // head
      ctx.fillStyle = "#0b0b14";
      ctx.fillRect(PX + 12, top + 3, 2, 2); // eye
      ctx.fillStyle = "#e2e8f0";
      // legs
      if (g.py >= GY) {
        const spread = [0, 4, 0, -4][frame];
        ctx.fillRect(PX + 4 + spread, top + 28, 4, 12);
        ctx.fillRect(PX + 12 - spread, top + 28, 4, 12);
      } else {
        ctx.fillRect(PX + 2, top + 28, 5, 9);
        ctx.fillRect(PX + 12, top + 26, 5, 9);
      }
      // arm
      ctx.fillRect(PX + (frame < 2 ? 15 : 1), top + 16, 5, 4);
    }
    ctx.shadowBlur = 0;
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
    duckHeld.current = false;
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

      if (duckHeld.current && g.py >= GY) g.ducking = true;
      else if (g.duckT <= 0 && g.py >= GY) g.ducking = false;
      if (duckHeld.current && g.py < GY) g.vy += GRAVITY * dt * 1.6; // fast fall

      stepGame(g, dt);

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

  const doJump = useCallback(() => {
    if (status !== "playing") return;
    const g = gameRef.current;
    if (g) jump(g);
  }, [status]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        if (status !== "playing") start();
        else if (!e.repeat) doJump();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        duckHeld.current = true;
        const g = gameRef.current;
        if (g && status === "playing") {
          if (g.py >= GY) g.ducking = true;
          else duckFor(g, 0.4);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        duckHeld.current = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start, doJump]);

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    if (status !== "playing") {
      start();
      return;
    }
    doJump();
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const startPt = touchStart.current;
    const t = e.touches[0];
    if (!startPt || !t) return;
    if (t.clientY - startPt.y > 28) {
      touchStart.current = null;
      const g = gameRef.current;
      if (g && status === "playing") {
        duckFor(g, 0.55);
        if (g.py < GY) g.vy = Math.max(g.vy, 340);
      }
    }
  };

  const onTouchEnd = () => {
    touchStart.current = null;
  };

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={`${score} m`} best={best === null ? "—" : `${best} m`} />

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(168,85,247,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          aria-label="Pixel Runner course"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">PIXEL RUNNER</p>
            <p className="mt-2 text-sm text-muted">
              Never stop running. Jump the cacti, duck the flyers.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-fuchsia-500 via-purple-500 to-indigo-600"
            >
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Space / tap to jump · ↓ / swipe down to duck
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">WIPEOUT</p>
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
              tone="from-fuchsia-500 via-purple-500 to-indigo-600"
            >
              Run again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Speed climbs with distance · double cacti arrive in clusters
      </p>
    </div>
  );
}
