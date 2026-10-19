"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 560;
const TAU = Math.PI * 2;
const TONE = "from-orange-500 via-red-500 to-rose-600";

const GAP = 60; // half-width between the uprights
const BAR_Y = 150; // crossbar
const TOP_Y = 44; // top of the uprights
const BX = W / 2;
const BY = H - 118; // ball on the tee

const DIST = [20, 25, 30, 33, 37, 40, 45, 50, 55, 62];

type Status = "idle" | "playing" | "over";
type Phase = "aim" | "power" | "fly" | "land";

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  c: string;
}
interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
}

interface Game {
  kick: number;
  score: number;
  made: number;
  phase: Phase;
  aim: number;
  aimDir: number;
  aimLock: number;
  power: number;
  pDir: number;
  pLock: number;
  need: number;
  wind: number;
  t: number;
  dur: number;
  lat: number;
  endY: number;
  success: boolean;
  center: boolean;
  points: number;
  missText: string;
  landT: number;
  spin: number;
  postFlash: number;
  parts: Part[];
  floats: Floater[];
  shake: number;
  flash: number;
  flashC: string;
  banner: string;
  bannerT: number;
  over: boolean;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
}

function burst(g: Game, x: number, y: number, c: string, n: number, power: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = power * (0.4 + Math.random() * 0.6);
    g.parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.5,
      max: 0.85,
      r: 1.5 + Math.random() * 2.6,
      c,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, c: string): void {
  g.floats.push({ x, y, text, life: 1, c });
}

function aimRate(kick: number): number {
  return 1.05 + kick * 0.06;
}
function powerRate(kick: number): number {
  return 1.15 + kick * 0.055;
}

function rollWind(kick: number): number {
  if (kick < 3) return 0;
  const mag = Math.min(1, 0.35 + (kick - 3) * 0.11);
  return Math.round((Math.random() * 2 - 1) * mag * 10) / 10;
}

function createGame(): Game {
  return {
    kick: 0,
    score: 0,
    made: 0,
    phase: "aim",
    aim: -0.9,
    aimDir: 1,
    aimLock: 0,
    power: 0,
    pDir: 1,
    pLock: 0,
    need: 0.65,
    wind: 0,
    t: 0,
    dur: 1.05,
    lat: 0,
    endY: 100,
    success: false,
    center: false,
    points: 0,
    missText: "",
    landT: 0,
    spin: 0,
    postFlash: 0,
    parts: [],
    floats: [],
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    banner: `KICK 1 · ${DIST[0]} YDS`,
    bannerT: 1.6,
    over: false,
  };
}

function nextKick(g: Game): void {
  g.kick += 1;
  g.phase = "aim";
  g.aim = -(0.6 + Math.random() * 0.5);
  g.aimDir = 1;
  g.power = 0;
  g.pDir = 1;
  g.wind = rollWind(g.kick);
  g.need = Math.min(1, 0.5 + DIST[g.kick] * 0.0075);
  g.banner = g.wind !== 0 ? `KICK ${g.kick + 1} · ${DIST[g.kick]} YDS · GUST` : `KICK ${g.kick + 1} · ${DIST[g.kick]} YDS`;
  g.bannerT = 1.5;
}

function tapFn(g: Game): void {
  if (g.phase === "aim") {
    g.aimLock = g.aim;
    g.phase = "power";
    g.power = 0;
    g.pDir = 1;
  } else if (g.phase === "power") {
    g.pLock = g.power;
    launch(g);
  }
}

function launch(g: Game): void {
  const d = DIST[g.kick];
  const drift = g.wind * GAP * (0.35 + d / 70);
  const gust = g.wind === 0 ? 0 : (Math.random() - 0.5) * 0.24 * Math.abs(g.wind) * GAP;
  g.lat = g.aimLock * GAP * 1.35 + drift + gust;

  const overshoot = g.pLock - g.need;
  g.endY = overshoot >= 0 ? 100 - overshoot * 70 : 100 + Math.min(190, -overshoot * 420);

  const short = overshoot < 0 && g.endY > BAR_Y - 4;
  const wide = Math.abs(g.lat) > GAP;
  g.success = !short && !wide;
  g.center = g.success && Math.abs(g.lat) <= GAP * 0.28;
  g.points = g.success ? d + (g.center ? 15 : 0) : 0;
  g.missText = short ? "SHORT" : g.lat < 0 ? "WIDE LEFT" : "WIDE RIGHT";

  g.t = 0;
  g.dur = 1.0;
  g.phase = "fly";
  g.spin = 0;
}

function land(g: Game): void {
  if (g.success) {
    g.score += g.points;
    g.made += 1;
    g.postFlash = 1;
    g.shake = Math.max(g.shake, 6);
    g.flash = 0.55;
    g.flashC = g.center ? "#fde68a" : "#a5f3fc";
    burst(g, BX, BAR_Y, g.center ? "#fde68a" : "#a5f3fc", 26, 240);
    floater(g, BX, BAR_Y + 46, `+${g.points}${g.center ? " CENTERED!" : ""}`, "#fef3c7");
    g.banner = g.center ? "DEAD CENTER!" : "GOOD!";
    g.bannerT = 1.6;
  } else {
    g.shake = Math.max(g.shake, 9);
    g.flash = 0.4;
    g.flashC = "#f87171";
    burst(g, BX + g.lat, g.endY + 40, "#f87171", 14, 170);
    floater(g, BX + Math.max(-150, Math.min(150, g.lat)), Math.min(H - 150, g.endY + 46), g.missText, "#fda4af");
    g.banner = `${g.missText} · 0`;
    g.bannerT = 1.6;
  }
  g.phase = "land";
  g.landT = 1.25;
}

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt * 1.8);
  g.postFlash = Math.max(0, g.postFlash - dt * 1.4);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 320 * dt;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.1;
    f.y -= 30 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (g.phase === "aim") {
    g.aim += g.aimDir * aimRate(g.kick) * dt;
    if (g.aim >= 1) {
      g.aim = 1;
      g.aimDir = -1;
    } else if (g.aim <= -1) {
      g.aim = -1;
      g.aimDir = 1;
    }
    return;
  }
  if (g.phase === "power") {
    g.power += g.pDir * powerRate(g.kick) * dt;
    if (g.power >= 1) {
      g.power = 1;
      g.pDir = -1;
    } else if (g.power <= 0) {
      g.power = 0;
      g.pDir = 1;
    }
    return;
  }
  if (g.phase === "fly") {
    g.t += dt;
    g.spin += dt * 12;
    if (g.t >= g.dur) land(g);
    return;
  }
  // land
  g.landT -= dt;
  if (g.landT <= 0) {
    if (g.kick >= DIST.length - 1) {
      g.over = true;
    } else {
      nextKick(g);
    }
  }
}

function ballPos(g: Game, time: number): { x: number; y: number; r: number } {
  if (g.phase === "fly") {
    const k = Math.min(1, g.t / g.dur);
    const e = 1 - Math.pow(1 - k, 1.5);
    return {
      x: BX + g.lat * Math.pow(k, 1.4),
      y: BY + (g.endY - BY) * e - Math.sin(k * Math.PI) * 46,
      r: 11 - 5 * k,
    };
  }
  if (g.phase === "land") {
    const drop = Math.min(30, (1.25 - g.landT) * 46);
    return { x: BX + g.lat, y: Math.min(H - 96, g.endY + drop), r: 6 };
  }
  const bob = g.phase === "power" ? Math.sin(time / 120) * 1.5 : 0;
  return { x: BX, y: BY + bob, r: 11 };
}

/* ------------------------------ render ------------------------------ */

function drawField(ctx: CanvasRenderingContext2D, time: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#180703");
  bg.addColorStop(0.45, "#12060a");
  bg.addColorStop(1, "#0a0407");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // stadium lights
  for (const lx of [70, W - 70]) {
    const gl = ctx.createRadialGradient(lx, 30, 4, lx, 30, 130);
    gl.addColorStop(0, "rgba(253, 224, 71, 0.35)");
    gl.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = gl;
    ctx.fillRect(lx - 130, -30, 260, 190);
  }

  // turf with perspective yard lines
  const turf = ctx.createLinearGradient(0, 210, 0, H);
  turf.addColorStop(0, "#0c1f12");
  turf.addColorStop(1, "#06120b");
  ctx.fillStyle = turf;
  ctx.fillRect(-14, 210, W + 28, H - 196);
  ctx.strokeStyle = "rgba(74, 222, 128, 0.14)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = 220 + Math.pow(i / 8, 1.6) * (H - 240);
    ctx.globalAlpha = 0.3 + (i / 8) * 0.7;
    ctx.beginPath();
    ctx.moveTo(-14, y);
    ctx.lineTo(W + 14, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // hash marks
  ctx.strokeStyle = "rgba(74, 222, 128, 0.1)";
  ctx.lineWidth = 6;
  for (const hx of [W / 2 - 120, W / 2 + 120]) {
    ctx.beginPath();
    ctx.moveTo(hx, 250);
    ctx.lineTo(hx, H - 40);
    ctx.stroke();
  }

  // wind streaks
  ctx.strokeStyle = "rgba(226, 232, 240, 0.16)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = 66 + i * 26;
    const off = ((time / (i % 2 ? 5 : 7)) % (W + 120)) - 60;
    ctx.beginPath();
    ctx.moveTo(off, y);
    ctx.lineTo(off + 46, y);
    ctx.stroke();
  }
}

function drawPosts(ctx: CanvasRenderingContext2D, g: Game | null): void {
  const flash = g ? g.postFlash : 0;
  const post = flash > 0.02 ? "#ffffff" : "#facc15";
  ctx.save();
  ctx.shadowColor = flash > 0.02 ? "#ffffff" : "#facc15";
  ctx.shadowBlur = 14 + flash * 26;
  ctx.strokeStyle = post;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  // support
  ctx.beginPath();
  ctx.moveTo(W / 2, BAR_Y);
  ctx.lineTo(W / 2, BAR_Y + 64);
  ctx.stroke();
  // crossbar
  ctx.beginPath();
  ctx.moveTo(W / 2 - GAP - 12, BAR_Y);
  ctx.lineTo(W / 2 + GAP + 12, BAR_Y);
  ctx.stroke();
  // uprights
  ctx.beginPath();
  ctx.moveTo(W / 2 - GAP, BAR_Y);
  ctx.lineTo(W / 2 - GAP, TOP_Y);
  ctx.moveTo(W / 2 + GAP, BAR_Y);
  ctx.lineTo(W / 2 + GAP, TOP_Y);
  ctx.stroke();
  ctx.restore();

  // goal-line
  ctx.strokeStyle = "rgba(254, 243, 199, 0.5)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(W / 2 - GAP - 30, BAR_Y + 66);
  ctx.lineTo(W / 2 + GAP + 30, BAR_Y + 66);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin % (Math.PI * 2) * 0.5);
  ctx.shadowColor = "rgba(251, 146, 60, 0.8)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#92400e";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.35, r * 0.85, 0, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, 0);
  ctx.lineTo(r * 0.5, 0);
  ctx.stroke();
  ctx.strokeStyle = "#fef3c7";
  ctx.lineWidth = Math.max(1, r * 0.1);
  for (let i = -2; i <= 2; i++) {
    const lx = i * r * 0.24;
    ctx.beginPath();
    ctx.moveTo(lx, -r * 0.24);
    ctx.lineTo(lx, r * 0.24);
    ctx.stroke();
  }
  ctx.restore();
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  drawField(ctx, time);
  drawPosts(ctx, g);

  if (g) {
    // HUD panels
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(2, 6, 23, 0.75)";
    ctx.beginPath();
    ctx.roundRect(14, 14, 132, 46, 10);
    ctx.fill();
    ctx.fillStyle = "#fed7aa";
    ctx.fillText(`KICK ${g.kick + 1} / ${DIST.length}`, 26, 33);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 17px ui-monospace, monospace";
    ctx.fillText(`${DIST[g.kick]} YDS`, 26, 53);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(2, 6, 23, 0.75)";
    ctx.beginPath();
    ctx.roundRect(W - 146, 14, 132, 46, 10);
    ctx.fill();
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.fillStyle = "#fda4af";
    ctx.fillText("MADE", W - 26, 33);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 17px ui-monospace, monospace";
    ctx.fillText(`${g.made} / ${g.kick + (g.phase === "land" ? 1 : 0)}`, W - 26, 53);

    // wind gauge
    if (g.wind !== 0) {
      const dir = Math.sign(g.wind);
      ctx.textAlign = "center";
      ctx.font = "700 11px ui-monospace, monospace";
      ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
      ctx.fillText(`WIND ${dir > 0 ? "→" : "←"} ${Math.abs(g.wind).toFixed(1)}`, W / 2, 74);
      ctx.strokeStyle = "rgba(226, 232, 240, 0.6)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const ax = W / 2 + dir * (16 + i * 14) + dir * ((time / 40) % 12);
        ctx.beginPath();
        ctx.moveTo(ax, 84);
        ctx.lineTo(ax + dir * 10, 89);
        ctx.lineTo(ax, 94);
        ctx.stroke();
      }
    }

    const ball = ballPos(g, time);

    // aim arrow
    if (g.phase === "aim" || g.phase === "power") {
      const tx = BX + g.aim * GAP * 1.35;
      ctx.save();
      ctx.strokeStyle = g.phase === "aim" ? "rgba(165, 243, 252, 0.85)" : "rgba(165, 243, 252, 0.35)";
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 7]);
      ctx.beginPath();
      ctx.moveTo(BX, BY - 6);
      ctx.lineTo(tx, BAR_Y - 6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(165, 243, 252, 0.9)";
      ctx.beginPath();
      ctx.moveTo(tx, BAR_Y - 14);
      ctx.lineTo(tx - 7, BAR_Y - 26);
      ctx.lineTo(tx + 7, BAR_Y - 26);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // tee
    if (g.phase === "aim" || g.phase === "power") {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(BX - 3, BY + 8, 6, 12);
    }

    drawBall(ctx, ball.x, ball.y, ball.r, g.spin);

    // power meter
    if (g.phase === "power") {
      const mw = 340;
      const mx = (W - mw) / 2;
      const my = H - 56;
      ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
      ctx.beginPath();
      ctx.roundRect(mx - 7, my - 7, mw + 14, 34, 14);
      ctx.fill();
      ctx.fillStyle = "rgba(148, 163, 184, 0.2)";
      ctx.beginPath();
      ctx.roundRect(mx, my, mw, 20, 9);
      ctx.fill();
      // required power zone
      ctx.fillStyle = "rgba(74, 222, 128, 0.35)";
      ctx.fillRect(mx + g.need * mw, my, mw - g.need * mw, 20);
      // fill
      const fw = g.power * mw;
      const grad = ctx.createLinearGradient(mx, 0, mx + mw, 0);
      grad.addColorStop(0, "#34d399");
      grad.addColorStop(0.7, "#fbbf24");
      grad.addColorStop(1, "#f43f5e");
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.roundRect(mx, my, Math.max(4, fw), 20, 9);
      ctx.fill();
      ctx.globalAlpha = 1;
      // need tick
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx + g.need * mw, my - 5);
      ctx.lineTo(mx + g.need * mw, my + 25);
      ctx.stroke();
      ctx.font = "700 9px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText("POWER", W / 2, my - 12);
      ctx.fillStyle = "#86efac";
      ctx.fillText("NEED", mx + g.need * mw, my - 22);
    } else if (g.phase === "fly" || g.phase === "land") {
      ctx.font = "700 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(154, 154, 182, 0.75)";
      ctx.fillText(
        `AIM ${Math.abs(Math.round(g.aimLock * 100))}${g.aimLock < 0 ? "L" : "R"} · POWER ${Math.round(g.pLock * 100)}%`,
        W / 2,
        H - 44,
      );
    }

    // particles
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // floaters
    ctx.font = "800 16px ui-monospace, monospace";
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
      ctx.font = "800 24px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(251, 146, 60, 0.9)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 60);
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

export default function FieldGoal({ gameId = "field-goal" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [made, setMade] = useState(0);
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
    setMade(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const onTap = useCallback(() => {
    const g = gameRef.current;
    if (g && !g.over) tapFn(g);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastMade = -1;

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
      if (g.made !== lastMade) {
        lastMade = g.made;
        setMade(g.made);
      }

      draw(t);
      if (g.over) {
        setScore(g.score);
        setMade(g.made);
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
        if (status === "playing") onTap();
        else start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start, onTap]);

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-orange-300">
          Made <b className="ml-1 text-sm text-ink">{made}/10</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(249,115,22,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Field Goal kicking tee"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") return;
            onTap();
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">FIELD GOAL</p>
            <p className="mt-2 text-sm text-muted">
              Ten kicks, twenty to sixty-two yards, wind that shows up after the third. First tap
              freezes the sweeping direction, second tap locks the power meter — get over the green
              &quot;need&quot; zone and between the uprights. Split the center band for a bonus,
              shank it and that kick scores nothing.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Tee it up
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Click or tap twice — direction, then power</p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">FINAL WHISTLE</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {made}/10 made · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Wind right, post high — aim off-line early</p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap 1: direction · Tap 2: power · green zone = enough leg · gusts bend it late
      </p>
    </div>
  );
}
