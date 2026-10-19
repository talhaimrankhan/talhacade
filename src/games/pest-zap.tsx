"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 520;
const TAU = Math.PI * 2;
const ROUND_TIME = 60;
const MAX_HEARTS = 3;
const ZAP_R = 38;
const COMBO_WINDOW = 1.6;

type Status = "idle" | "playing" | "over";
type Phase = "countdown" | "live" | "break";
type Kind = "roach" | "silver" | "butterfly";

const KIND_COLOR: Record<Kind, string> = {
  roach: "#a16207",
  silver: "#cbd5e1",
  butterfly: "#60a5fa",
};
const KIND_PTS: Record<Kind, number> = { roach: 10, silver: 25, butterfly: 0 };

interface Pest {
  kind: Kind;
  x: number;
  y: number;
  bx: number;
  by: number; // base heading target
  angle: number;
  speed: number;
  t: number;
  seed: number;
  spawnT: number;
}
interface Zap {
  x: number;
  y: number;
  t: number;
  lines: { x: number; y: number }[][];
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

interface Game {
  pests: Pest[];
  zaps: Zap[];
  particles: Particle[];
  floaters: Floater[];
  hearts: number;
  score: number;
  round: number;
  timer: number;
  phase: Phase;
  phaseT: number;
  combo: number;
  comboT: number;
  spawnT: number;
  banner: string;
  bannerT: number;
  shake: number;
  hurt: number;
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
      vy: Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.4,
      max: 0.75,
      color,
      size: 1.5 + Math.random() * 2.4,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, color: string): void {
  g.floaters.push({ x, y, text, t: 1, color });
}

/* ------------------------------ waves ------------------------------ */

function spawnGap(round: number): number {
  return Math.max(0.34, 1.35 - (round - 1) * 0.1);
}
function baseSpeed(round: number): number {
  return Math.min(150, 46 + round * 7);
}

function spawnPest(g: Game): void {
  const side = Math.floor(Math.random() * 4);
  let x: number;
  let y: number;
  if (side === 0) {
    x = -18;
    y = Math.random() * H;
  } else if (side === 1) {
    x = W + 18;
    y = Math.random() * H;
  } else if (side === 2) {
    x = Math.random() * W;
    y = -18;
  } else {
    x = Math.random() * W;
    y = H + 18;
  }
  const tx = W - x - (Math.random() - 0.5) * W * 0.5;
  const ty = H - y - (Math.random() - 0.5) * H * 0.5;

  const butterflyChance = Math.min(0.22, Math.max(0, (g.round - 1) * 0.05));
  const silverChance = Math.min(0.3, 0.07 + g.round * 0.035);
  const roll = Math.random();
  const kind: Kind =
    g.round >= 2 && roll < butterflyChance
      ? "butterfly"
      : roll < butterflyChance + silverChance
        ? "silver"
        : "roach";

  const base = baseSpeed(g.round);
  const speed =
    kind === "silver" ? base * 1.4 : kind === "butterfly" ? base * 0.7 : base;

  g.pests.push({
    kind,
    x,
    y,
    bx: tx,
    by: ty,
    angle: Math.atan2(ty - y, tx - x),
    speed,
    t: 0,
    seed: Math.random() * TAU,
    spawnT: 0.25,
  });
}

function createGame(): Game {
  return {
    pests: [],
    zaps: [],
    particles: [],
    floaters: [],
    hearts: MAX_HEARTS,
    score: 0,
    round: 1,
    timer: ROUND_TIME,
    phase: "countdown",
    phaseT: 1.6,
    combo: 0,
    comboT: 0,
    spawnT: 0.4,
    banner: "ROUND 1",
    bannerT: 1.6,
    shake: 0,
    hurt: 0,
    over: false,
  };
}

/* ------------------------------ zapping ------------------------------ */

function makeZap(x: number, y: number): Zap {
  const lines: { x: number; y: number }[][] = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const len = 26 + Math.random() * 30;
    const pts = [{ x, y }];
    let px = x;
    let py = y;
    for (let s = 1; s <= 3; s++) {
      const jag = a + (Math.random() - 0.5) * 0.9;
      px += Math.cos(jag) * (len / 3);
      py += Math.sin(jag) * (len / 3);
      pts.push({ x: px, y: py });
    }
    lines.push(pts);
  }
  return { x, y, t: 1, lines };
}

function zap(g: Game, x: number, y: number): void {
  g.zaps.push(makeZap(x, y));
  g.shake = Math.max(g.shake, 4);

  const hits: Pest[] = [];
  const hurtButterflies: Pest[] = [];
  for (const p of g.pests) {
    if (Math.hypot(p.x - x, p.y - y) > ZAP_R) continue;
    if (p.kind === "butterfly") hurtButterflies.push(p);
    else hits.push(p);
  }

  if (hurtButterflies.length > 0) {
    for (const b of hurtButterflies) {
      const idx = g.pests.indexOf(b);
      if (idx >= 0) g.pests.splice(idx, 1);
      burst(g, b.x, b.y, KIND_COLOR.butterfly, 16, 160);
      floater(g, b.x, b.y - 14, "NO! −1", "#60a5fa");
    }
    // caught a butterfly — blast still kills the pests, but no points
    for (const h of hits) {
      const idx = g.pests.indexOf(h);
      if (idx >= 0) g.pests.splice(idx, 1);
      burst(g, h.x, h.y, KIND_COLOR[h.kind], 10, 140);
    }
    g.hearts -= 1;
    g.combo = 0;
    g.comboT = 0;
    g.hurt = 1;
    g.shake = Math.max(g.shake, 12);
    if (g.hearts <= 0) {
      g.hearts = 0;
      g.over = true;
    }
    return;
  }

  if (hits.length === 0) {
    g.combo = 0; // whiffed zap breaks the chain
    return;
  }

  g.comboT = COMBO_WINDOW;
  g.combo += 1;
  const mult = Math.min(8, 1 + Math.floor((g.combo - 1) / 3));
  let gained = 0;
  for (const h of hits) {
    const idx = g.pests.indexOf(h);
    if (idx >= 0) g.pests.splice(idx, 1);
    burst(g, h.x, h.y, KIND_COLOR[h.kind], 14, 170);
    gained += KIND_PTS[h.kind] * mult;
  }
  g.score += gained;
  floater(g, x, y - ZAP_R - 6, `+${gained}`, "#fbbf24");
  if (mult > 1) floater(g, x, y - ZAP_R - 24, `COMBO ×${mult}`, "#34d399");
  if (g.combo % 5 === 0) floater(g, x, y - ZAP_R - 42, `${g.combo} CHAIN!`, "#ffffff");
}

/* ------------------------------ step ------------------------------ */

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.hurt = Math.max(0, g.hurt - dt * 1.8);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);

  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-2.5 * dt);
    p.vy *= Math.exp(-2.5 * dt);
    if (p.life <= 0) g.particles.splice(i, 1);
  }
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.t -= dt * 1.3;
    f.y -= 34 * dt;
    if (f.t <= 0) g.floaters.splice(i, 1);
  }
  for (let i = g.zaps.length - 1; i >= 0; i--) {
    g.zaps[i].t -= dt * 4.5;
    if (g.zaps[i].t <= 0) g.zaps.splice(i, 1);
  }

  if (g.comboT > 0) {
    g.comboT -= dt;
    if (g.comboT <= 0) g.combo = 0;
  }

  if (g.phase === "countdown") {
    g.phaseT -= dt;
    if (g.phaseT <= 0) {
      g.phase = "live";
      g.bannerT = 0;
    }
    return;
  }

  if (g.phase === "break") {
    g.phaseT -= dt;
    if (g.phaseT <= 0) {
      g.round += 1;
      g.phase = "countdown";
      g.phaseT = 1.6;
      g.banner = `ROUND ${g.round}`;
      g.bannerT = 1.6;
      g.spawnT = 0.5;
    }
    return;
  }

  // -------- live round --------
  g.timer = Math.max(0, g.timer - dt);
  if (g.timer <= 0) {
    const bonus = 50 * g.round;
    g.score += bonus;
    g.phase = "break";
    g.phaseT = 2.2;
    g.banner = `ROUND CLEAR +${bonus}`;
    g.bannerT = 2.2;
    g.pests = [];
    g.combo = 0;
    return;
  }

  g.spawnT -= dt;
  if (g.spawnT <= 0) {
    const cap = Math.min(12, 4 + g.round);
    if (g.pests.length < cap) spawnPest(g);
    g.spawnT = spawnGap(g.round) * (0.75 + Math.random() * 0.5);
  }

  for (let i = g.pests.length - 1; i >= 0; i--) {
    const p = g.pests[i];
    p.t += dt;
    p.spawnT = Math.max(0, p.spawnT - dt);

    const base = Math.atan2(p.by - p.y, p.bx - p.x);
    if (p.kind === "roach") {
      p.angle = base + Math.sin(p.t * 8 + p.seed) * 0.16;
    } else if (p.kind === "silver") {
      p.angle = base + Math.sin(p.t * 5 + p.seed) * 0.7;
    } else {
      p.angle = base + Math.sin(p.t * 3 + p.seed) * 0.5;
    }

    let sp = p.speed;
    if (p.kind === "silver") sp *= 1 + 0.45 * Math.sin(p.t * 7 + p.seed);
    if (p.kind === "butterfly") sp *= 1 + 0.3 * Math.sin(p.t * 9 + p.seed);
    p.x += Math.cos(p.angle) * sp * dt;
    p.y += Math.sin(p.angle) * sp * dt;

    const off = p.x < -34 || p.x > W + 34 || p.y < -34 || p.y > H + 34;
    if (off) {
      g.pests.splice(i, 1);
      if (p.kind !== "butterfly") {
        g.hearts -= 1;
        g.hurt = 1;
        g.shake = Math.max(g.shake, 12);
        g.combo = 0;
        floater(
          g,
          Math.max(30, Math.min(W - 30, p.x)),
          Math.max(30, Math.min(H - 30, p.y)),
          p.kind === "roach" ? "ESCAPED! −1" : "SLIPPED AWAY! −1",
          "#f87171",
        );
        if (g.hearts <= 0) {
          g.hearts = 0;
          g.over = true;
          return;
        }
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

  // counter tiles
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#141210");
  bg.addColorStop(1, "#1d1813");
  ctx.fillStyle = bg;
  ctx.fillRect(-12, -12, W + 24, H + 24);
  ctx.strokeStyle = "rgba(214, 190, 150, 0.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // counter edge
  ctx.fillStyle = "rgba(214, 190, 150, 0.12)";
  ctx.fillRect(0, 0, W, 4);

  // drifting warm lamp glow
  ctx.fillStyle = "rgba(255, 244, 214, 0.035)";
  ctx.beginPath();
  ctx.ellipse(
    W / 2 + Math.sin(time / 2000) * 90,
    H * 0.3,
    210,
    130,
    0,
    0,
    TAU,
  );
  ctx.fill();

  if (g) {
    // pests
    for (const p of g.pests) {
      const fade = Math.min(1, p.spawnT / 0.25 + 0.35);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      if (p.kind === "roach") {
        const wig = Math.sin(p.t * 26 + p.seed) * 0.35;
        ctx.strokeStyle = "#5b3a10";
        ctx.lineWidth = 1.6;
        for (const side of [-1, 1]) {
          for (let i = 0; i < 3; i++) {
            const lx = -5 + i * 5;
            ctx.beginPath();
            ctx.moveTo(lx, side * 4);
            ctx.lineTo(lx + wig * side * 2 + (i - 1) * 3, side * 9);
            ctx.stroke();
          }
        }
        ctx.shadowColor = "#a16207";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#a16207";
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 5.5, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#5b3a10";
        ctx.beginPath();
        ctx.ellipse(6, 0, 3.5, 3.5, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#5b3a10";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(8, -1.5);
        ctx.quadraticCurveTo(13, -5 + wig, 15, -6);
        ctx.moveTo(8, 1.5);
        ctx.quadraticCurveTo(13, 5 - wig, 15, 6);
        ctx.stroke();
      } else if (p.kind === "silver") {
        const wig = Math.sin(p.t * 18 + p.seed) * 2.2;
        ctx.shadowColor = "#cbd5e1";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#cbd5e1";
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.quadraticCurveTo(2, -3.6 + wig, -9, -1.6 + wig);
        ctx.lineTo(-11, wig);
        ctx.lineTo(-9, 1.6 + wig);
        ctx.quadraticCurveTo(2, 3.6 + wig, 10, 0);
        ctx.fill();
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-11, wig);
        ctx.lineTo(-15, -2 + wig);
        ctx.moveTo(-11, wig);
        ctx.lineTo(-15, 2 + wig);
        ctx.stroke();
      } else {
        const flap = 0.45 + 0.55 * Math.abs(Math.sin(p.t * 11 + p.seed));
        ctx.shadowColor = "#60a5fa";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#60a5fa";
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(0, side * 4.5 * flap, 6, 5 * flap, side * 0.5, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = "#bfdbfe";
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.5, 1.8, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#93c5fd";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(9, -2.5);
        ctx.moveTo(5, 0);
        ctx.lineTo(9, 2.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // zap flashes
    for (const z of g.zaps) {
      const a = Math.max(0, z.t);
      const rad = ZAP_R * (1.15 - a * 0.35);
      ctx.save();
      ctx.globalAlpha = a;
      const grd = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, rad);
      grd.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      grd.addColorStop(0.55, "rgba(103, 232, 249, 0.45)");
      grd.addColorStop(1, "rgba(103, 232, 249, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(z.x, z.y, rad, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#67e8f9";
      ctx.shadowBlur = 12;
      for (const line of z.lines) {
        ctx.beginPath();
        ctx.moveTo(line[0].x, line[0].y);
        for (let i = 1; i < line.length; i++) ctx.lineTo(line[i].x, line[i].y);
        ctx.stroke();
      }
      // scorch
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(z.x, z.y, ZAP_R * 0.5, 0, TAU);
      ctx.fill();
      ctx.restore();
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

    // hearts + round + combo
    ctx.font = "700 15px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fb7185";
    ctx.fillText("♥".repeat(Math.max(0, g.hearts)), 16, 26);
    ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
    ctx.fillText(`ROUND ${g.round}`, 16, 44);
    if (g.combo > 1) {
      ctx.fillStyle = g.comboT < 0.4 ? "rgba(251, 191, 36, 0.5)" : "#fbbf24";
      ctx.fillText(`CHAIN ${g.combo}`, 16, 62);
    }

    // timer
    if (g.phase === "live") {
      const secs = Math.ceil(g.timer);
      ctx.font = "800 17px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = secs <= 10 ? "#fb7185" : "rgba(226, 232, 240, 0.9)";
      ctx.fillText(`${secs}s`, W / 2, 28);
    }

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.4);
      ctx.font = "800 30px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(52, 211, 153, 0.85)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 60);
      ctx.restore();
    }

    // hurt vignette
    if (g.hurt > 0.01) {
      const grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      grd.addColorStop(0, "rgba(248, 113, 113, 0)");
      grd.addColorStop(1, `rgba(248, 113, 113, ${(g.hurt * 0.45).toFixed(3)})`);
      ctx.fillStyle = grd;
      ctx.fillRect(-12, -12, W + 24, H + 24);
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function PestZap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [round, setRound] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("pest-zap", "high");

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
    setRound(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  // main loop
  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastRound = -1;

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
      if (g.round !== lastRound) {
        lastRound = g.round;
        setRound(g.round);
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
    <div className="w-full max-w-[520px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Round <b className="ml-1 text-sm text-ink">{round}</b>
        </span>
        <span className="text-rose-400">
          Hearts{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${hearts} hearts`}>
            {"♥".repeat(Math.max(0, hearts))}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(52,211,153,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full cursor-crosshair touch-none"
          aria-label="Pest zap kitchen counter"
          onPointerDown={(e) => {
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g) return;
            const pt = toPos(e);
            zap(g, pt.x, pt.y);
            setScore(g.score);
            setHearts(g.hearts);
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">PEST ZAP</p>
            <p className="mt-2 text-sm text-muted">
              The counter is crawling. Roaches pay 10, silverfish pay 25 — and
              blue butterflies will cost you a heart if you fry one. Let a roach
              walk and it costs a heart too.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-emerald-400 via-teal-500 to-cyan-600"
            >
              Start zapping
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Click or tap to zap · chain fast kills for multipliers · 60-second
              rounds, endless waves
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              COUNTER&apos;S CLOSED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Score · Best {best ?? "—"} · survived to round {round}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-emerald-400 via-teal-500 to-cyan-600"
            >
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Zap fast, watch the blue · silverfish zigzag and speed-jink · a whiffed
        zap breaks your chain
      </p>
    </div>
  );
}
