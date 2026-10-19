"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 540;
const TAU = Math.PI * 2;
const MAG_SIZE = 6;
const RELOAD_TIME = 1.0;
const MAX_HEARTS = 3;
const GOLDEN_PTS = 50;
const NORMAL_PTS = 10;
const CENTER_BONUS = 5;

const COLORS = ["#f472b6", "#60a5fa", "#34d399", "#fbbf24", "#a78bfa", "#fb7185"];

type Status = "idle" | "playing" | "over";

interface Balloon {
  x: number;
  y: number;
  r: number;
  vy: number;
  wind: number;
  wobble: number;
  color: string;
  golden: boolean;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}
interface Floater {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
}
interface Ring {
  x: number;
  y: number;
  t: number;
  color: string;
}

interface Game {
  balloons: Balloon[];
  particles: Particle[];
  floaters: Floater[];
  rings: Ring[];
  hearts: number;
  score: number;
  pops: number;
  level: number;
  ammo: number;
  reloadT: number;
  spawnT: number;
  slowT: number;
  flash: number;
  shake: number;
  hurt: number;
  banner: string;
  bannerT: number;
  aim: { x: number; y: number };
  clock: number;
  over: boolean;
}

/* ------------------------------ helpers ------------------------------ */

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
}

function burst(
  g: Game,
  x: number,
  y: number,
  color: string,
  n: number,
  power: number,
): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = power * (0.35 + Math.random() * 0.65);
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      life: 0.4 + Math.random() * 0.45,
      max: 0.85,
      color,
      size: 1.5 + Math.random() * 2.6,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, color: string): void {
  g.floaters.push({ x, y, text, t: 1, color });
}

function spawnGap(level: number): number {
  return Math.max(0.36, 1.15 - (level - 1) * 0.06);
}
function riseSpeed(level: number): number {
  return Math.min(160, 44 + level * 6 + Math.random() * 16);
}

function createGame(): Game {
  return {
    balloons: [],
    particles: [],
    floaters: [],
    rings: [],
    hearts: MAX_HEARTS,
    score: 0,
    pops: 0,
    level: 1,
    ammo: MAG_SIZE,
    reloadT: 0,
    spawnT: 0.3,
    slowT: 0,
    flash: 0,
    shake: 0,
    hurt: 0,
    banner: "READY",
    bannerT: 1.1,
    aim: { x: W / 2, y: H / 2 },
    clock: 0,
    over: false,
  };
}

function spawn(g: Game): void {
  const golden = Math.random() < 0.08;
  const r = golden ? 20 : 20 + Math.random() * 8;
  g.balloons.push({
    x: 36 + Math.random() * (W - 72),
    y: H + r + 10 + Math.random() * 40,
    r,
    vy: riseSpeed(g.level),
    wind: (Math.random() - 0.5) * 34,
    wobble: Math.random() * TAU,
    color: golden ? "#fde047" : COLORS[Math.floor(Math.random() * COLORS.length)],
    golden,
  });
}

/* ------------------------------ shooting ------------------------------ */

function shoot(g: Game, x: number, y: number): void {
  if (g.ammo <= 0) {
    g.rings.push({ x, y, t: 1, color: "#6b7280" });
    return;
  }
  g.ammo -= 1;
  g.rings.push({ x, y, t: 1, color: "#ffffff" });
  if (g.ammo === 0) g.reloadT = RELOAD_TIME;

  for (let i = g.balloons.length - 1; i >= 0; i--) {
    const b = g.balloons[i];
    const dx = (x - b.x) / b.r;
    const dy = (y - b.y) / (b.r * 1.15);
    if (dx * dx + dy * dy > 1) continue;

    g.balloons.splice(i, 1);
    g.pops += 1;
    const offCenter = Math.hypot(x - b.x, y - b.y) > b.r * 0.35;
    let pts = b.golden ? GOLDEN_PTS : NORMAL_PTS;
    const color = b.golden ? "#fde047" : b.color;

    if (b.golden) {
      g.slowT = 1.25;
      g.flash = 1;
      burst(g, b.x, b.y, "#fde047", 30, 230);
      g.rings.push({ x: b.x, y: b.y, t: 1, color: "#fde047" });
      g.shake = Math.max(g.shake, 7);
    } else {
      burst(g, b.x, b.y, b.color, 18, 170);
      g.shake = Math.max(g.shake, 3);
    }

    if (!offCenter) {
      pts += CENTER_BONUS;
      floater(g, b.x, b.y - b.r - 12, "BULLSEYE!", "#ffffff");
    }
    g.score += pts;
    floater(g, b.x, b.y, `+${pts}`, color);

    const nextLevel = 1 + Math.floor(g.pops / 8);
    if (nextLevel > g.level) {
      g.level = nextLevel;
      g.banner = `LEVEL ${g.level}`;
      g.bannerT = 1.1;
    }
    return;
  }
}

/* ------------------------------ step ------------------------------ */

function step(g: Game, dtRaw: number): void {
  g.clock += dtRaw;
  g.shake = Math.max(0, g.shake - dtRaw * 24);
  g.hurt = Math.max(0, g.hurt - dtRaw * 1.8);
  g.flash = Math.max(0, g.flash - dtRaw * 2.2);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dtRaw);

  if (g.slowT > 0) {
    g.slowT = Math.max(0, g.slowT - dtRaw);
  }
  const dt = dtRaw * (g.slowT > 0 ? 0.35 : 1);

  if (g.reloadT > 0) {
    g.reloadT -= dtRaw;
    if (g.reloadT <= 0) {
      g.reloadT = 0;
      g.ammo = MAG_SIZE;
    }
  }

  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dtRaw;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 240 * dt;
    if (p.life <= 0) g.particles.splice(i, 1);
  }
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.t -= dtRaw * 1.3;
    f.y -= 34 * dt;
    if (f.t <= 0) g.floaters.splice(i, 1);
  }
  for (let i = g.rings.length - 1; i >= 0; i--) {
    g.rings[i].t -= dtRaw * 2.4;
    if (g.rings[i].t <= 0) g.rings.splice(i, 1);
  }

  g.spawnT -= dt;
  if (g.spawnT <= 0) {
    spawn(g);
    if (g.level >= 3 && Math.random() < Math.min(0.55, (g.level - 2) * 0.09)) {
      spawn(g);
    }
    g.spawnT = spawnGap(g.level) * (0.8 + Math.random() * 0.45);
  }

  const gust = Math.sin(g.clock * 0.7) * 16;
  for (let i = g.balloons.length - 1; i >= 0; i--) {
    const b = g.balloons[i];
    b.wobble += dt * (1.4 + b.r * 0.02);
    b.y -= b.vy * dt;
    b.x += (b.wind + gust + Math.sin(b.wobble) * 12) * dt;
    if (b.x < b.r) {
      b.x = b.r;
      b.wind = Math.abs(b.wind);
    } else if (b.x > W - b.r) {
      b.x = W - b.r;
      b.wind = -Math.abs(b.wind);
    }

    if (b.y + b.r < 0) {
      g.balloons.splice(i, 1);
      g.hearts -= 1;
      g.hurt = 1;
      g.shake = Math.max(g.shake, 12);
      floater(g, b.x, 26, b.golden ? "GOLDEN LOST!" : "MISSED!", "#f87171");
      if (g.hearts <= 0) {
        g.hearts = 0;
        g.over = true;
        return;
      }
    }
  }
}

/* ------------------------------ render ------------------------------ */

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#120c22");
  bg.addColorStop(1, "#2a1608");
  ctx.fillStyle = bg;
  ctx.fillRect(-12, -12, W + 24, H + 24);

  // stars + moon
  ctx.fillStyle = "rgba(254, 243, 199, 0.5)";
  for (let i = 0; i < 34; i++) {
    const x = (i * 83) % W;
    const y = (i * 47) % (H * 0.6);
    const tw = 0.5 + 0.5 * Math.sin(time / 600 + i);
    ctx.globalAlpha = 0.25 + tw * 0.4;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.shadowColor = "#fde68a";
  ctx.shadowBlur = 26;
  ctx.fillStyle = "#fef3c7";
  ctx.beginPath();
  ctx.arc(W - 64, 62, 22, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#120c22";
  ctx.beginPath();
  ctx.arc(W - 54, 54, 19, 0, TAU);
  ctx.fill();

  if (g) {
    // balloons
    for (const b of g.balloons) {
      const ry = b.r * 1.15;
      const sway = Math.sin(b.wobble) * 4;

      // string
      ctx.strokeStyle = hexA("#e2e8f0", 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + ry + 4);
      ctx.quadraticCurveTo(b.x + sway, b.y + ry + 26, b.x - sway * 0.5, b.y + ry + 48);
      ctx.stroke();

      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.golden ? 22 : 12;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r, ry, 0, 0, TAU);
      ctx.fill();
      ctx.restore();

      // knot
      ctx.fillStyle = hexA(b.color, 0.9);
      ctx.beginPath();
      ctx.moveTo(b.x - 4, b.y + ry - 2);
      ctx.lineTo(b.x + 4, b.y + ry - 2);
      ctx.lineTo(b.x, b.y + ry + 5);
      ctx.closePath();
      ctx.fill();

      // highlight
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.ellipse(b.x - b.r * 0.34, b.y - ry * 0.35, b.r * 0.24, ry * 0.2, -0.5, 0, TAU);
      ctx.fill();

      if (b.golden) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        const sp = time / 300;
        for (let i = 0; i < 3; i++) {
          const a = sp + (i * TAU) / 3;
          ctx.beginPath();
          ctx.arc(b.x + Math.cos(a) * b.r * 0.6, b.y + Math.sin(a) * ry * 0.6, 1.6, 0, TAU);
          ctx.fill();
        }
      }
    }

    // shot rings
    for (const r of g.rings) {
      const rad = 5 + (1 - Math.max(0, r.t)) * 26;
      ctx.strokeStyle = hexA(r.color, Math.max(0, r.t));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
    }

    // particles
    for (const p of g.particles) {
      ctx.fillStyle = hexA(p.color, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }

    // floaters
    ctx.textAlign = "center";
    for (const f of g.floaters) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.t));
      ctx.font = "800 15px ui-monospace, monospace";
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // hearts + level
    ctx.font = "700 15px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fb7185";
    ctx.fillText("♥".repeat(Math.max(0, g.hearts)), 16, 30);
    ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
    ctx.fillText(`LVL ${g.level}`, 16, 48);

    // ammo pips + reload bar
    const pipY = H - 18;
    for (let i = 0; i < MAG_SIZE; i++) {
      const filled = i < g.ammo;
      ctx.fillStyle = filled ? "#67e8f9" : "rgba(103, 232, 249, 0.16)";
      ctx.beginPath();
      ctx.roundRect(16 + i * 15, pipY - 5, 10, 10, 3);
      ctx.fill();
    }
    if (g.reloadT > 0) {
      const frac = 1 - g.reloadT / RELOAD_TIME;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 50, pipY - 4, 100, 8, 4);
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 50, pipY - 4, 100 * Math.max(0, Math.min(1, frac)), 8, 4);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.font = "800 11px ui-monospace, monospace";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText("RELOADING", W / 2, pipY - 10);
    }

    // crosshair
    if (!g.over) {
      const { x, y } = g.aim;
      ctx.save();
      ctx.strokeStyle = g.ammo > 0 ? "#fde047" : "#6b7280";
      ctx.lineWidth = 1.6;
      ctx.shadowColor = g.ammo > 0 ? "#f59e0b" : "#6b7280";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, TAU);
      ctx.moveTo(x - 17, y);
      ctx.lineTo(x - 5, y);
      ctx.moveTo(x + 5, y);
      ctx.lineTo(x + 17, y);
      ctx.moveTo(x, y - 17);
      ctx.lineTo(x, y - 5);
      ctx.moveTo(x, y + 5);
      ctx.lineTo(x, y + 17);
      ctx.stroke();
      ctx.restore();
    }

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.5);
      ctx.font = "800 30px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(253, 224, 71, 0.8)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 60);
      ctx.restore();
    }

    // golden slow-time flash
    if (g.flash > 0.01) {
      ctx.fillStyle = `rgba(254, 240, 138, ${(g.flash * 0.22).toFixed(3)})`;
      ctx.fillRect(-12, -12, W + 24, H + 24);
    }
    // hurt vignette
    if (g.hurt > 0.01) {
      const grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.74);
      grd.addColorStop(0, "rgba(248, 113, 113, 0)");
      grd.addColorStop(1, `rgba(248, 113, 113, ${(g.hurt * 0.45).toFixed(3)})`);
      ctx.fillStyle = grd;
      ctx.fillRect(-12, -12, W + 24, H + 24);
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function BalloonBurst() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [ammo, setAmmo] = useState(MAG_SIZE);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("balloon-burst", "high");

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (canvas) render(canvas, gameRef.current, time);
  }, []);

  // canvas setup + idle frame
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

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setHearts(MAX_HEARTS);
    setAmmo(MAG_SIZE);
    setNewBest(false);
    setStatus("playing");
  }, []);

  // main loop
  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastAmmo = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      if (g.score !== lastScore) {
        lastScore = g.score;
        setScore(g.score);
      }
      if (g.ammo !== lastAmmo) {
        lastAmmo = g.ammo;
        setAmmo(g.ammo);
      }

      draw(t);
      if (g.over) {
        setScore(g.score);
        setHearts(0);
        setNewBest(submit(g.score));
        setStatus("over");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit]);

  // static frame after mount / on the game-over screen
  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  const toPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  /* ------------------------------ view ------------------------------ */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className={ammo === 0 ? "text-warn" : ""}>
          Ammo{" "}
          <b className="ml-1 text-sm text-ink">
            {ammo === 0 ? "RELOAD" : `${ammo}/${MAG_SIZE}`}
          </b>
        </span>
        <span className="text-rose-400">
          Hearts{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${hearts} hearts`}>
            {"♥".repeat(Math.max(0, hearts))}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(253,224,71,0.7)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full cursor-crosshair touch-none"
          aria-label="Balloon burst playfield"
          onPointerMove={(e) => {
            const g = gameRef.current;
            if (g && status === "playing") g.aim = toPos(e);
          }}
          onPointerDown={(e) => {
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g) return;
            const pt = toPos(e);
            g.aim = pt;
            shoot(g, pt.x, pt.y);
            setScore(g.score);
            setAmmo(g.ammo);
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">BALLOON BURST</p>
            <p className="mt-2 text-sm text-muted">
              Six balloons-worth of ammo and an endless sky. Pop them before they
              drift off the top — every escape costs a heart.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-yellow-400 via-amber-500 to-orange-600"
            >
              Start popping
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Aim with the mouse · click or tap to pop · golden balloons pay 5×
              and slow time · center hits bonus
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              SKY&apos;S EMPTY
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Score · Best {best ?? "—"} · {Math.floor(score / NORMAL_PTS)}+ pops
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-yellow-400 via-amber-500 to-orange-600"
            >
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Six shots, then a one-second reload · golden balloons slow the world ·
        don&apos;t let one escape
      </p>
    </div>
  );
}
