"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 520;
const WALL = 26;
const ROUND = 90; // seconds
const TONE = "from-lime-400 via-emerald-500 to-teal-600";

type Status = "idle" | "playing" | "over";

interface Cone {
  x: number;
  y: number;
  down: number; // >0 = knocked over, counts down then respawns
  vx: number;
  vy: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  hue: number;
  glow: number; // lights up while drifting inside
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  c: string;
}

interface Pop {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
}

interface GymkhanaGame {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  time: number; // remaining seconds
  score: number;
  mult: number;
  driftT: number; // continuous drift seconds
  sliding: boolean;
  inRing: Ring | null;
  lastRing: Ring | null;
  lastSwap: number; // seconds-since-last-ring-swap clock
  fig8: number;
  cones: Cone[];
  rings: Ring[];
  parts: Particle[];
  pops: Pop[];
  shake: number;
  flash: number;
  over: boolean;
}

function randRange(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function makeCones(exclude: { x: number; y: number }[]): Cone[] {
  const cones: Cone[] = [];
  let guard = 0;
  while (cones.length < 14 && guard < 400) {
    guard++;
    const x = randRange(WALL + 40, W - WALL - 40);
    const y = randRange(WALL + 40, H - WALL - 40);
    if (exclude.some((e) => Math.hypot(e.x - x, e.y - y) < 90)) continue;
    cones.push({ x, y, down: 0, vx: 0, vy: 0 });
  }
  return cones;
}

function scatterCones(cones: Cone[]): void {
  for (const c of cones) {
    if (c.down > 0) {
      c.down -= 1;
      c.x = randRange(WALL + 40, W - WALL - 40);
      c.y = randRange(WALL + 40, H - WALL - 40);
    }
  }
}

function createGame(): GymkhanaGame {
  const rings: Ring[] = [
    { x: W * 0.28, y: H * 0.3, r: 62, hue: 45, glow: 0 },
    { x: W * 0.72, y: H * 0.3, r: 62, hue: 160, glow: 0 },
    { x: W * 0.5, y: H * 0.72, r: 70, hue: 285, glow: 0 },
  ];
  return {
    x: W / 2,
    y: H / 2,
    angle: 0,
    vx: 0,
    vy: 0,
    time: ROUND,
    score: 0,
    mult: 1,
    driftT: 0,
    sliding: false,
    inRing: null,
    lastRing: null,
    lastSwap: 99,
    fig8: 0,
    cones: makeCones(rings),
    rings,
    parts: [],
    pops: [],
    shake: 0,
    flash: 0,
    over: false,
  };
}

function burst(
  g: GymkhanaGame,
  x: number,
  y: number,
  n: number,
  c: string,
  power = 120,
): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * power;
    g.parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.5,
      max: 0.9,
      c,
    });
  }
}

function pop(g: GymkhanaGame, x: number, y: number, text: string, c: string): void {
  g.pops.push({ x, y, text, life: 1.1, c });
}

export default function GymkhanaDrift() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [boot] = useState(createGame);
  const gameRef = useRef<GymkhanaGame>(boot);

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND);
  const [mult, setMult] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("gymkhana-drift", "high");

  const keysRef = useRef<Set<string>>(new Set());
  const touchRef = useRef({ steer: 0, drift: false });
  const dispScore = useRef(0);
  const dispTime = useRef(ROUND);
  const dispMult = useRef(1);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const sx = (Math.random() - 0.5) * g.shake;
    const sy = (Math.random() - 0.5) * g.shake;

    // tarmac
    ctx.fillStyle = "#101018";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(52, 211, 153, 0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x + sx, 0);
      ctx.lineTo(x + sx, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y + sy);
      ctx.lineTo(W, y + sy);
      ctx.stroke();
    }

    // arena walls
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 4;
    ctx.strokeRect(WALL / 2 + sx, WALL / 2 + sy, W - WALL, H - WALL);

    // rings
    for (const r of g.rings) {
      const active = g.inRing === r && g.sliding;
      r.glow += ((active ? 1 : 0) - r.glow) * 0.12;
      const pulse = 0.35 + r.glow * 0.5 + Math.sin(time / 260 + r.hue) * 0.08;
      ctx.save();
      ctx.shadowColor = `hsl(${r.hue} 90% 60%)`;
      ctx.shadowBlur = 12 + r.glow * 26;
      ctx.strokeStyle = `hsla(${r.hue}, 90%, 65%, ${pulse})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(r.x + sx, r.y + sy, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (r.glow > 0.05) {
        ctx.fillStyle = `hsla(${r.hue}, 90%, 60%, ${r.glow * 0.12})`;
        ctx.beginPath();
        ctx.arc(r.x + sx, r.y + sy, r.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // cones
    for (const c of g.cones) {
      ctx.save();
      ctx.translate(c.x + sx, c.y + sy);
      if (c.down > 0) {
        ctx.rotate(1.4);
        ctx.fillStyle = "rgba(251, 146, 60, 0.55)";
      } else {
        ctx.shadowColor = "#fb923c";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#fb923c";
      }
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, 7);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // particles
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x + sx - 2, p.y + sy - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // tyre marks / smoke while sliding
    if (g.sliding) {
      for (let i = 0; i < 2; i++) {
        g.parts.push({
          x: g.x + randRange(-8, 8),
          y: g.y + randRange(-8, 8),
          vx: randRange(-20, 20),
          vy: randRange(-20, 20),
          life: 0.5,
          max: 0.5,
          c: "rgba(226,232,240,0.5)",
        });
      }
    }
    if (g.parts.length > 320) g.parts.splice(0, g.parts.length - 320);

    // car
    ctx.save();
    ctx.translate(g.x + sx, g.y + sy);
    ctx.rotate(g.angle);
    ctx.shadowColor = "#a3e635";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#a3e635";
    ctx.beginPath();
    ctx.roundRect(-17, -11, 34, 22, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(11,11,22,0.65)";
    ctx.beginPath();
    ctx.roundRect(1, -7, 10, 14, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.roundRect(-14, -7, 6, 14, 3);
    ctx.fill();
    // counter-steered front wheels while drifting
    const steerVis = g.sliding ? -0.5 : 0;
    ctx.fillStyle = "#0f172a";
    for (const [wx, wy] of [
      [10, -12],
      [10, 8],
      [-13, -12],
      [-13, 8],
    ] as const) {
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(steerVis);
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
    ctx.restore();

    // multiplier arc under the car
    if (g.mult > 1.05) {
      ctx.strokeStyle = "rgba(163, 230, 53, 0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.x + sx, g.y + sy, 26, -Math.PI / 2, -Math.PI / 2 + (g.mult / 8) * Math.PI * 2);
      ctx.stroke();
    }

    // pops
    ctx.textAlign = "center";
    ctx.font = "bold 15px ui-monospace, monospace";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.min(1, p.life / 0.5);
      ctx.fillStyle = p.c;
      ctx.fillText(p.text, p.x + sx, p.y + sy - (1.1 - p.life) * 30);
    }
    ctx.globalAlpha = 1;

    // top bar
    ctx.fillStyle = "rgba(2, 6, 23, 0.6)";
    ctx.fillRect(0, 0, W, 34);
    ctx.font = "bold 15px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = g.time < 10 ? "#f87171" : "#e2e8f0";
    ctx.fillText(`⏱ ${Math.ceil(g.time)}s`, 12, 22);
    ctx.textAlign = "center";
    ctx.fillStyle = "#a3e635";
    ctx.fillText(`×${g.mult.toFixed(1)}`, W / 2, 22);
    ctx.textAlign = "right";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`${Math.floor(g.score)}`, W - 12, 22);

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(244, 63, 94, ${Math.min(0.5, g.flash)})`;
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
    setTimeLeft(ROUND);
    setMult(1);
    setNewBest(false);
    dispScore.current = 0;
    dispTime.current = ROUND;
    dispMult.current = 1;
    setStatus("playing");
  }, []);

  const step = useCallback(
    (dt: number): boolean => {
      const g = gameRef.current;
      if (g.over) return true;

      g.time -= dt;
      if (g.shake > 0) g.shake = Math.max(0, g.shake - 30 * dt);
      if (g.flash > 0) g.flash = Math.max(0, g.flash - 2 * dt);
      g.lastSwap += dt;

      const keys = keysRef.current;
      const touch = touchRef.current;
      const left = keys.has("ArrowLeft") || keys.has("a") || touch.steer === -1;
      const right = keys.has("ArrowRight") || keys.has("d") || touch.steer === 1;
      const brake = keys.has(" ") || touch.drift;
      const steer = (right ? 1 : 0) - (left ? 1 : 0);

      const fx = Math.cos(g.angle);
      const fy = Math.sin(g.angle);
      let vf = g.vx * fx + g.vy * fy; // forward speed
      let vl = -g.vx * fy + g.vy * fx; // lateral speed

      // engine pulls toward a steady cruise (this is a drift playground)
      const cruise = brake ? 130 : 235;
      vf += (cruise - vf) * 1.4 * dt;

      // grip: high normally, tiny with the handbrake → slide
      const grip = brake ? 0.9 : 7.5;
      vl *= Math.exp(-grip * dt);

      // steering authority scales with speed; handbrake rotates sharper
      const authority = Math.min(1, Math.abs(vf) / 120);
      g.angle += steer * (brake ? 3.4 : 2.3) * authority * dt;

      g.vx = fx * vf - fy * vl;
      g.vy = fy * vf + fx * vl;
      g.x += g.vx * dt;
      g.y += g.vy * dt;

      // walls
      const lo = WALL + 16;
      const hiX = W - WALL - 16;
      const hiY = H - WALL - 16;
      if (g.x < lo || g.x > hiX || g.y < lo || g.y > hiY) {
        g.x = Math.min(hiX, Math.max(lo, g.x));
        g.y = Math.min(hiY, Math.max(lo, g.y));
        g.vx *= -0.35;
        g.vy *= -0.35;
        if (g.mult > 1.05) {
          pop(g, g.x, g.y - 26, "WALL ×1", "#f87171");
        }
        g.mult = 1;
        g.driftT = 0;
        g.shake = Math.max(g.shake, 6);
        burst(g, g.x, g.y, 8, "rgba(226,232,240,0.7)", 80);
      }

      // drift bookkeeping
      const speed = Math.hypot(g.vx, g.vy);
      const wasSliding = g.sliding;
      g.sliding = Math.abs(vl) > 42 && speed > 110;
      if (g.sliding) {
        g.driftT += dt;
        g.mult = Math.min(8, 1 + g.driftT * 0.55);
        let gain = dt * (Math.abs(vl) * 0.12 + 6) * g.mult;

        // ring bonus: drifting inside a glowing cone circle
        let inside: Ring | null = null;
        for (const r of g.rings) {
          if (Math.hypot(g.x - r.x, g.y - r.y) < r.r - 12) {
            inside = r;
            break;
          }
        }
        g.inRing = inside;
        if (inside) {
          gain *= 3;
          if (g.lastSwap > 0.35 && g.lastRing && g.lastRing !== inside) {
            g.fig8 += 1;
            const figBonus = 120 * g.mult * Math.min(g.fig8, 4);
            gain += figBonus;
            pop(
              g,
              inside.x,
              inside.y - inside.r,
              `FIGURE-8 ×${Math.min(g.fig8, 4)} +${Math.floor(figBonus)}`,
              "#fbbf24",
            );
            g.lastSwap = 0;
          } else if (!g.lastRing || g.lastRing !== inside) {
            g.lastRing = inside;
            g.lastSwap = 0;
          }
        } else {
          g.lastRing = null;
          g.fig8 = Math.max(0, g.fig8 - dt * 0.5);
        }
        g.score += gain;
      } else {
        g.inRing = null;
        g.driftT = Math.max(0, g.driftT - dt * 1.4);
        g.mult = Math.max(1, Math.min(8, 1 + g.driftT * 0.55));
        g.lastSwap += dt;
        if (wasSliding) g.fig8 = Math.max(0, g.fig8 - 1);
      }

      // cones
      for (let i = 0; i < g.cones.length; i++) {
        const c = g.cones[i];
        if (c.down > 0) {
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          c.vx *= Math.exp(-2.5 * dt);
          c.vy *= Math.exp(-2.5 * dt);
          c.down -= dt;
          if (c.down <= 0) {
            c.x = randRange(WALL + 40, W - WALL - 40);
            c.y = randRange(WALL + 40, H - WALL - 40);
            c.vx = 0;
            c.vy = 0;
          }
          continue;
        }
        if (Math.hypot(g.x - c.x, g.y - c.y) < 20) {
          c.down = 4;
          c.vx = g.vx * 0.6 + randRange(-40, 40);
          c.vy = g.vy * 0.6 + randRange(-40, 40);
          burst(g, c.x, c.y, 10, "#fb923c", 140);
          if (g.mult > 1.05) pop(g, c.x, c.y - 18, "CONE ×1", "#f87171");
          g.mult = 1;
          g.driftT = 0;
          g.shake = Math.max(g.shake, 5);
          g.flash = Math.max(g.flash, 0.25);
        }
      }

      // particles
      for (let i = g.parts.length - 1; i >= 0; i--) {
        const p = g.parts[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) g.parts.splice(i, 1);
      }
      for (let i = g.pops.length - 1; i >= 0; i--) {
        g.pops[i].life -= dt;
        if (g.pops[i].life <= 0) g.pops.splice(i, 1);
      }

      // mirror HUD state (throttled to visible changes)
      const s = Math.floor(g.score);
      if (s !== dispScore.current) {
        dispScore.current = s;
        setScore(s);
      }
      const t = Math.ceil(g.time);
      if (t !== dispTime.current) {
        dispTime.current = t;
        setTimeLeft(t);
      }
      const m = Math.round(g.mult * 10) / 10;
      if (m !== dispMult.current) {
        dispMult.current = m;
        setMult(m);
      }

      if (g.time <= 0) {
        g.over = true;
        const final = Math.floor(g.score);
        setScore(final);
        scatterCones(g.cones);
        setNewBest(submit(final));
        setStatus("over");
        return true;
      }
      return false;
    },
    [submit],
  );

  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const done = step(dt);
      draw(t);
      if (!done) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, step, draw]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const keys = keysRef.current;
    const normalize = (k: string) => (k.length === 1 ? k.toLowerCase() : k);
    const onDown = (e: KeyboardEvent) => {
      const k = normalize(e.key);
      if (
        status === "playing" &&
        (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown" || k === " ")
      ) {
        e.preventDefault();
      }
      keys.add(k);
      if ((k === " " || k === "Enter") && status !== "playing") {
        e.preventDefault();
        keys.delete(" ");
        start();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      keys.delete(normalize(e.key));
    };
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [status, start]);

  const touchDown = useCallback(
    (steer: number, drift: boolean) => {
      if (status !== "playing") start();
      touchRef.current = { steer, drift };
    },
    [status, start],
  );
  const touchUp = useCallback(() => {
    touchRef.current = { steer: 0, drift: false };
  }, []);

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-warn">
          Time <b className="ml-1 text-sm text-ink">{timeLeft}s</b>
        </span>
        <span className="text-warn">
          Mult <b className="ml-1 text-sm text-ink">×{mult.toFixed(1)}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(163,230,53,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none"
          aria-label="Gymkhana drift arena"
        />

        {status === "playing" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
            <div className="pointer-events-auto flex gap-2">
              <button
                type="button"
                className="h-14 w-14 rounded-xl bg-black/45 text-xl text-ink backdrop-blur active:scale-95"
                aria-label="Steer left"
                onPointerDown={() => touchDown(-1, false)}
                onPointerUp={touchUp}
                onPointerLeave={touchUp}
                onPointerCancel={touchUp}
              >
                ◀
              </button>
              <button
                type="button"
                className="h-14 w-14 rounded-xl bg-black/45 text-xl text-ink backdrop-blur active:scale-95"
                aria-label="Steer right"
                onPointerDown={() => touchDown(1, false)}
                onPointerUp={touchUp}
                onPointerLeave={touchUp}
                onPointerCancel={touchUp}
              >
                ▶
              </button>
            </div>
            <button
              type="button"
              className="pointer-events-auto h-14 w-24 rounded-xl bg-lime-500/60 text-sm font-bold text-ink backdrop-blur active:scale-95"
              aria-label="Handbrake"
              onPointerDown={() => touchDown(0, true)}
              onPointerUp={touchUp}
              onPointerLeave={touchUp}
              onPointerCancel={touchUp}
            >
              DRIFT
            </button>
          </div>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">GYMKHANA</p>
            <p className="mt-2 text-sm text-muted">
              Hold Space to throw the car sideways. The longer you hold the slide,
              the higher the multiplier — but cones and walls reset it to ×1.
              Drift the glowing rings, weave two of them for figure-eights.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Arrows / A-D steer · Space handbrake · 90 seconds on the clock
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">TIME&apos;S UP</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Drift points · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Send it again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Sideways is the straight line · rings pay 3× · don&apos;t touch the cones
      </p>
    </div>
  );
}
