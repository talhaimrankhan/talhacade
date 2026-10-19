"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 520;
const TAU = Math.PI * 2;

const HOOP = { x: W / 2, y: 150 };
const RIM_W = 74;
const START_CLOCK = 90;
const TONE = "from-amber-400 via-orange-500 to-red-500";

const SPOTS = [
  { x: 240, y: 424, name: "PAINT", bonus: 0 },
  { x: 134, y: 450, name: "LEFT WING", bonus: 1 },
  { x: 346, y: 450, name: "RIGHT WING", bonus: 1 },
  { x: 56, y: 474, name: "LEFT CORNER", bonus: 2 },
  { x: 424, y: 474, name: "RIGHT CORNER", bonus: 2 },
];
const SEQ = [0, 1, 2, 3, 4];

type Status = "idle" | "playing" | "over";
type Phase = "ready" | "fly";
type Outcome = "swish" | "rim" | "air";

interface Pt {
  x: number;
  y: number;
}
interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  c: string;
  r: number;
}
interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
}

interface Game {
  phase: Phase;
  t: number;
  dur: number;
  clock: number;
  score: number;
  streak: number;
  bestStreak: number;
  shots: number;
  made: number;
  over: boolean;
  // meter
  m: number;
  mDir: number;
  band: number;
  green: number;
  speed: number;
  // spot
  spot: number;
  // flight
  outcome: Outcome;
  from: Pt;
  to: Pt;
  ball: Pt;
  arc: number;
  spin: number;
  netSway: number;
  // juice
  parts: Part[];
  floats: Floater[];
  shake: number;
  flash: number;
  flashC: string;
  banner: string;
  bannerT: number;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
}

function burst(g: Game, x: number, y: number, c: string, n: number, power: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = power * (0.35 + Math.random() * 0.65);
    g.parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.5,
      max: 0.9,
      c,
      r: 1.6 + Math.random() * 2.6,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, c: string): void {
  g.floats.push({ x, y, text, life: 1, c });
}

function pickSpot(g: Game): void {
  if (g.shots < SEQ.length) {
    g.spot = SEQ[g.shots];
  } else {
    let next = g.spot;
    while (next === g.spot) next = Math.floor(Math.random() * SPOTS.length);
    g.spot = next;
  }
}

function shoot(g: Game): void {
  const s = SPOTS[g.spot];
  const d = Math.abs(g.m - g.band);
  g.outcome = d <= g.green ? "swish" : d <= g.green + 0.075 ? "rim" : "air";
  g.from = { x: s.x, y: s.y - 34 };
  const missSide = Math.random() < 0.5 ? -1 : 1;
  g.to =
    g.outcome === "air"
      ? { x: HOOP.x + missSide * (70 + Math.random() * 46), y: HOOP.y - 40 - Math.random() * 30 }
      : { x: HOOP.x + (Math.random() - 0.5) * 10, y: HOOP.y - 4 };
  g.arc = 70 + Math.random() * 40;
  g.ball = { ...g.from };
  g.t = 0;
  g.dur = 0.62;
  g.spin = 0;
  g.phase = "fly";
}

function land(g: Game): void {
  const s = SPOTS[g.spot];
  if (g.outcome === "swish") {
    const pts = 3 + s.bonus;
    g.score += pts;
    g.streak += 1;
    if (g.streak > g.bestStreak) g.bestStreak = g.streak;
    g.made += 1;
    g.netSway = 1;
    g.flash = 0.5;
    g.flashC = "#fbbf24";
    g.shake = Math.max(g.shake, 4);
    burst(g, HOOP.x, HOOP.y + 34, "#fde68a", 22, 200);
    floater(g, HOOP.x, HOOP.y + 74, `+${pts} SWISH!`, "#fde68a");
    if (g.streak >= 3) floater(g, HOOP.x, HOOP.y + 98, `×${g.streak} STREAK`, "#fdba74");
    if (g.streak % 5 === 0) {
      g.clock += 5;
      floater(g, HOOP.x, H / 2, "+5s ON THE CLOCK", "#4ade80");
      g.banner = `BONUS · +5 SECONDS`;
      g.bannerT = 1.4;
    }
  } else if (g.outcome === "rim") {
    g.score += 1;
    g.streak = 0;
    g.shake = Math.max(g.shake, 6);
    burst(g, HOOP.x + RIM_W / 2, HOOP.y, "#fca5a5", 12, 150);
    floater(g, HOOP.x, HOOP.y + 60, "+1 RIMMED OUT", "#fca5a5");
  } else {
    g.streak = 0;
    floater(g, g.to.x, g.to.y + 40, "AIRBALL", "#f87171");
    g.shake = Math.max(g.shake, 3);
  }
  g.shots += 1;
  pickSpot(g);
  g.band = 0.12 + Math.random() * 0.76;
  g.green = Math.max(0.05, 0.13 - g.shots * 0.004);
  g.speed = 0.9 + Math.min(1.4, g.shots * 0.022);
  g.phase = "ready";
}

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt * 1.8);
  g.netSway = Math.max(0, g.netSway - dt * 1.6);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.15;
    f.y -= 30 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (g.clock > 0) g.clock = Math.max(0, g.clock - dt);

  if (g.phase === "ready") {
    g.m += g.mDir * g.speed * dt;
    if (g.m >= 1) {
      g.m = 1;
      g.mDir = -1;
    } else if (g.m <= 0) {
      g.m = 0;
      g.mDir = 1;
    }
    if (g.clock <= 0) {
      g.over = true;
    }
    return;
  }

  // flight
  g.t += dt;
  g.spin += dt * 9;
  const k = Math.min(1, g.t / g.dur);
  const lift = Math.sin(k * Math.PI) * g.arc;
  g.ball = {
    x: g.from.x + (g.to.x - g.from.x) * k,
    y: g.from.y + (g.to.y - g.from.y) * k - lift,
  };
  if (k >= 1) {
    if (g.outcome === "swish") {
      // drop through the net
      g.ball = { x: HOOP.x, y: HOOP.y + 30 };
      land(g);
    } else if (g.outcome === "rim") {
      g.ball = { x: HOOP.x + RIM_W / 2 + 8, y: HOOP.y + 6 };
      land(g);
    } else {
      g.ball = { x: g.to.x, y: g.to.y + 130 };
      land(g);
    }
    if (g.clock <= 0) g.over = true;
  }
}

/* ------------------------------ render ------------------------------ */

function drawCourt(ctx: CanvasRenderingContext2D, time: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#160c05");
  bg.addColorStop(0.55, "#1c1008");
  bg.addColorStop(1, "#241508");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // stands glow
  ctx.fillStyle = "rgba(251, 191, 36, 0.05)";
  ctx.beginPath();
  ctx.ellipse(W / 2, 40, 230, 90, 0, 0, TAU);
  ctx.fill();
  const crowd = ["#fb923c", "#fbbf24", "#f87171", "#fde68a", "#e2e8f0"];
  for (let i = 0; i < 70; i++) {
    const cx = ((i * 61) % (W + 20)) - 10;
    const cy = 4 + ((i * 37) % 76);
    ctx.fillStyle = crowd[i % crowd.length];
    ctx.globalAlpha = 0.12 + ((i * 7) % 10) * 0.03 + Math.sin(time / 540 + i) * 0.05;
    ctx.fillRect(cx, cy, 3, 3);
  }
  ctx.globalAlpha = 1;

  // floor
  const floor = ctx.createLinearGradient(0, 300, 0, H);
  floor.addColorStop(0, "#3b2411");
  floor.addColorStop(1, "#25150a");
  ctx.fillStyle = floor;
  ctx.fillRect(-14, 300, W + 28, H - 286);
  for (let i = 0; i < 16; i++) {
    ctx.strokeStyle = "rgba(251, 191, 36, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-14, 300 + i * 15);
    ctx.lineTo(W + 14, 300 + i * 15);
    ctx.stroke();
  }

  // key + arc in perspective
  ctx.strokeStyle = "rgba(253, 230, 138, 0.35)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(HOOP.x, 470, 200, 96, 0, Math.PI, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(HOOP.x - 74, 340);
  ctx.lineTo(HOOP.x - 108, 470);
  ctx.moveTo(HOOP.x + 74, 340);
  ctx.lineTo(HOOP.x + 108, 470);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(HOOP.x, 336, 74, 30, 0, 0, TAU);
  ctx.stroke();
}

function drawHoop(ctx: CanvasRenderingContext2D, g: Game | null, time: number): void {
  // backboard
  ctx.save();
  ctx.shadowColor = "rgba(251, 146, 60, 0.7)";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "rgba(255, 255, 255, 0.09)";
  ctx.strokeStyle = "#fdba74";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(HOOP.x - 84, 74, 168, 74, 8);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(253, 186, 116, 0.9)";
  ctx.lineWidth = 2;
  ctx.strokeRect(HOOP.x - 34, 112, 68, 32);
  ctx.restore();

  // pole
  ctx.strokeStyle = "rgba(120, 53, 15, 0.9)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(HOOP.x, 148);
  ctx.lineTo(HOOP.x, 74);
  ctx.stroke();

  const sway = g ? Math.sin(time / 60) * g.netSway * 6 : 0;

  // net
  const netTop = HOOP.y;
  ctx.strokeStyle = `rgba(248, 250, 252, ${0.55 + (g?.netSway ?? 0) * 0.35})`;
  ctx.lineWidth = 1.6;
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const x0 = HOOP.x - RIM_W / 2 + t * RIM_W;
    const x1 = HOOP.x - RIM_W / 2 + 10 + t * (RIM_W - 20) + sway * (t - 0.5) * 2;
    ctx.beginPath();
    ctx.moveTo(x0, netTop);
    ctx.lineTo(x1, netTop + 44);
    ctx.stroke();
  }
  for (let j = 1; j <= 3; j++) {
    const yy = netTop + (j / 3) * 42;
    const inset = (j / 3) * 10;
    ctx.beginPath();
    ctx.moveTo(HOOP.x - RIM_W / 2 + inset + sway * 0.4, yy);
    ctx.lineTo(HOOP.x + RIM_W / 2 - inset + sway * 0.4, yy);
    ctx.stroke();
  }

  // rim
  ctx.save();
  ctx.shadowColor = "#f97316";
  ctx.shadowBlur = 16;
  ctx.strokeStyle = "#fb923c";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(HOOP.x, HOOP.y, RIM_W / 2, 12, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, s: (typeof SPOTS)[number], time: number, active: boolean): void {
  const bob = Math.sin(time / 300) * 2;
  const x = s.x;
  const y = s.y + bob;
  ctx.save();
  ctx.translate(x, y);
  if (active) {
    ctx.strokeStyle = "rgba(251, 191, 36, 0.75)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 6, 26, 11, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.shadowColor = active ? "#fbbf24" : "rgba(255,255,255,0.4)";
  ctx.shadowBlur = active ? 16 : 6;
  ctx.fillStyle = active ? "#f59e0b" : "#78716c";
  ctx.beginPath();
  ctx.roundRect(-9, -34, 18, 30, 7);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(0, -42, 7, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = active ? "#fde68a" : "#a8a29e";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, -26);
  ctx.lineTo(-12, -42);
  ctx.moveTo(6, -26);
  ctx.lineTo(13, -44);
  ctx.stroke();
  ctx.restore();
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  drawCourt(ctx, time);
  drawHoop(ctx, g, time);

  if (g) {
    // current spot marker
    const cur = SPOTS[g.spot];
    const pulse = 1 + Math.sin(time / 160) * 0.1;
    ctx.save();
    ctx.strokeStyle = "rgba(253, 230, 138, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cur.x, cur.y + 6, 30 * pulse, 13 * pulse, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    for (const s of SPOTS) drawPlayer(ctx, s, time, s === cur);

    // spot label
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(254, 243, 199, 0.9)";
    ctx.fillText(`${cur.name} · ${3 + cur.bonus} PTS`, cur.x, cur.y - 56);

    // ball
    const flying = g.phase === "fly";
    const bx = flying ? g.ball.x : cur.x;
    const by = flying ? g.ball.y : cur.y - 44 - Math.abs(Math.sin(time / 380)) * 6;
    ctx.save();
    ctx.shadowColor = "rgba(251, 146, 60, 0.9)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#7c2d12";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(bx, by, 9, g.spin, g.spin + Math.PI);
    ctx.moveTo(bx - 9, by);
    ctx.quadraticCurveTo(bx, by - 4, bx + 9, by);
    ctx.stroke();
    ctx.restore();

    // particles
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // meter
    const bw = 404;
    const bx0 = (W - bw) / 2;
    const by0 = H - 40;
    ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
    ctx.beginPath();
    ctx.roundRect(bx0 - 6, by0 - 6, bw + 12, 32, 14);
    ctx.fill();
    ctx.fillStyle = "rgba(120, 53, 15, 0.5)";
    ctx.beginPath();
    ctx.roundRect(bx0, by0, bw, 20, 10);
    ctx.fill();
    // rim zones
    const rimHalf = g.green + 0.075;
    ctx.fillStyle = "rgba(253, 186, 116, 0.45)";
    ctx.fillRect(bx0 + (g.band - rimHalf) * bw, by0, rimHalf * 2 * bw, 20);
    // green band
    ctx.fillStyle = "rgba(74, 222, 128, 0.85)";
    ctx.fillRect(bx0 + (g.band - g.green) * bw, by0, g.green * 2 * bw, 20);
    // cursor
    const cx = bx0 + g.m * bw;
    ctx.save();
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, by0 - 5);
    ctx.lineTo(cx, by0 + 25);
    ctx.stroke();
    ctx.restore();
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(254, 243, 199, 0.85)";
    ctx.fillText("TAP IN THE GREEN", W / 2, by0 - 12);

    // clock
    const secs = Math.ceil(g.clock);
    ctx.font = "800 26px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = secs <= 10 ? "#f87171" : "rgba(255, 255, 255, 0.92)";
    if (secs <= 10 && Math.floor(time / 250) % 2 === 0) ctx.fillStyle = "#fca5a5";
    ctx.fillText(`${secs}s`, W / 2, 42);

    // streak
    if (g.streak > 1) {
      ctx.font = "700 14px ui-monospace, monospace";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`SWISH ×${g.streak}`, W / 2, 64);
    }

    // floaters
    ctx.font = "800 15px ui-monospace, monospace";
    for (const f of g.floats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.4);
      ctx.font = "800 26px ui-sans-serif, system-ui, sans-serif";
      ctx.shadowColor = "rgba(251, 191, 36, 0.9)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 30);
      ctx.restore();
    }

    if (g.flash > 0.01) {
      ctx.fillStyle = hexA(g.flashC, g.flash * 0.3);
      ctx.fillRect(-14, -14, W + 28, H + 28);
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

function createGame(): Game {
  return {
    phase: "ready",
    t: 0,
    dur: 0.62,
    clock: START_CLOCK,
    score: 0,
    streak: 0,
    bestStreak: 0,
    shots: 0,
    made: 0,
    over: false,
    m: 0.5,
    mDir: 1,
    band: 0.5,
    green: 0.13,
    speed: 0.9,
    spot: 0,
    outcome: "swish",
    from: { x: SPOTS[0].x, y: SPOTS[0].y - 34 },
    to: { x: HOOP.x, y: HOOP.y },
    ball: { x: SPOTS[0].x, y: SPOTS[0].y - 44 },
    arc: 90,
    spin: 0,
    netSway: 0,
    parts: [],
    floats: [],
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    banner: "90 SECONDS",
    bannerT: 1.5,
  };
}

export default function HoopRush({ gameId = "hoop-rush" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (canvas) render(canvas, gameRef.current, time);
  }, []);

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
    setStreak(0);
    setBestStreak(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastStreak = -1;
    let lastBest = -1;

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
      if (g.streak !== lastStreak) {
        lastStreak = g.streak;
        setStreak(g.streak);
      }
      if (g.bestStreak !== lastBest) {
        lastBest = g.bestStreak;
        setBestStreak(g.bestStreak);
      }

      draw(t);
      if (g.over) {
        setScore(g.score);
        setStreak(g.streak);
        setBestStreak(g.bestStreak);
        setNewBest(submit(g.score));
        setStatus("over");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

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
    <div className="w-full max-w-[500px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-amber-300">
          Streak <b className="ml-1 text-sm text-ink">{streak}</b>
        </span>
        <span className="text-orange-300">
          Best run <b className="ml-1 text-sm text-ink">{bestStreak}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(251,146,60,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Hoop Rush basketball court"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g || g.phase !== "ready" || g.clock <= 0) return;
            shoot(g);
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">HOOP RUSH</p>
            <p className="mt-2 text-sm text-muted">
              Ninety seconds, five spots, one swinging meter. Nail the green band for a swish —
              three points plus your streak — rim it for one, and clank an airball for nothing.
              Five swishes in a row drop five seconds back on the clock. The meter gets twitchier
              the longer you last.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start the clock
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Click or tap to shoot · corners and wings pay more than the paint
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">BUZZER</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Score {score} · Best {best ?? "—"} · best run {bestStreak} swishes
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Rhythm beats reflex — watch the band, not the ball
            </p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Green band = swish · amber = rim out · five swishes in a row = +5s
      </p>
    </div>
  );
}
