"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 560;
const TAU = Math.PI * 2;
const TONE = "from-teal-400 via-cyan-500 to-sky-600";

const JUMPS = 5;
const LIP = { x: 168, y: 300 };
const RAMP = {
  p0: { x: 48, y: 56 },
  p1: { x: 84, y: 196 },
  p2: LIP,
};
const ZONE_FROM = 0.8;
const ZONE_TO = 0.96;

type Status = "idle" | "playing" | "over";
type Phase = "inrun" | "flight" | "landed";
type Quality = "good" | "early" | "late";

function slopeY(x: number): number {
  return 336 + (x - 200) * 0.62;
}

function distOf(landX: number): number {
  return Math.max(38, Math.min(120, 65 + (landX - 340) * 0.444));
}
function xOfDist(d: number): number {
  return 340 + (d - 65) / 0.444;
}

function bez(s: number): { x: number; y: number } {
  const u = 1 - s;
  return {
    x: u * u * RAMP.p0.x + 2 * u * s * RAMP.p1.x + s * s * RAMP.p2.x,
    y: u * u * RAMP.p0.y + 2 * u * s * RAMP.p1.y + s * s * RAMP.p2.y,
  };
}

function simulate(vx: number, vy: number, grav: number): number {
  let x = LIP.x;
  let y = LIP.y;
  const sx = vx;
  let sy = vy;
  const dt = 1 / 100;
  for (let i = 0; i < 500; i++) {
    sy += grav * dt;
    x += sx * dt;
    y += sy * dt;
    if (y >= slopeY(x)) return x;
    if (x > W + 120) return x;
  }
  return x;
}

function rollWind(jump: number): number {
  const mag = Math.min(1, 0.35 + jump * 0.16);
  return Math.round((Math.random() * 2 - 1) * mag * 10) / 10;
}

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
  r: number;
  c: string;
}

interface Game {
  phase: Phase;
  jump: number;
  s: number;
  spd: number;
  holding: boolean;
  leanUp: boolean;
  leanDown: boolean;
  wind: number;
  quality: Quality;
  vx: number;
  vy: number;
  grav: number;
  x: number;
  y: number;
  rot: number;
  zoneX: number;
  trail: Pt[];
  landX: number;
  dist: number;
  style: number;
  ghost: number;
  beats: number;
  roundScore: number;
  jumpScore: number;
  bestJump: number;
  bestDist: number;
  slide: number;
  landT: number;
  parts: Part[];
  banner: string;
  bannerT: number;
  grade: string;
  gradeC: string;
  shake: number;
  flash: number;
  flashC: string;
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
      life: 0.4 + Math.random() * 0.5,
      max: 0.9,
      r: 1.5 + Math.random() * 2.4,
      c,
    });
  }
}

function startJump(g: Game): void {
  g.phase = "inrun";
  g.s = 0.05;
  g.spd = 118;
  g.holding = false;
  g.leanUp = false;
  g.leanDown = false;
  g.wind = rollWind(g.jump - 1);
  g.trail = [];
  g.vx = 0;
  g.vy = 0;
  g.rot = 0;
  g.grade = "";
  g.gradeC = "#ffffff";
  g.x = bez(g.s).x;
  g.y = bez(g.s).y;
  g.zoneX = 0;
  g.slide = 0;
  g.landT = 0;
  g.dist = 0;
  g.style = 0;
  g.jumpScore = 0;
  g.banner = `JUMP ${g.jump} / ${JUMPS}`;
  g.bannerT = 1.7;
}

function createGame(): Game {
  const g: Game = {
    phase: "inrun",
    jump: 1,
    s: 0,
    spd: 118,
    holding: false,
    leanUp: false,
    leanDown: false,
    wind: 0,
    quality: "good",
    vx: 0,
    vy: 0,
    grav: 340,
    x: LIP.x,
    y: LIP.y,
    rot: 0,
    zoneX: 0,
    trail: [],
    landX: 0,
    dist: 0,
    style: 0,
    ghost: 88,
    beats: 0,
    roundScore: 0,
    jumpScore: 0,
    bestJump: 0,
    bestDist: 0,
    slide: 0,
    landT: 0,
    parts: [],
    banner: "",
    bannerT: 0,
    grade: "",
    gradeC: "#ffffff",
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    over: false,
  };
  g.ghost = 74 + Math.floor(Math.random() * 22);
  startJump(g);
  return g;
}

function takeoff(g: Game): void {
  if (g.phase !== "inrun") return;
  let q: Quality;
  if (g.s >= ZONE_FROM && g.s <= ZONE_TO) q = "good";
  else if (g.s < ZONE_FROM) q = "early";
  else q = "late";

  g.quality = q;
  g.vx = g.spd * (q === "good" ? 0.92 : q === "early" ? 0.8 : 1.0);
  g.vy = -g.spd * (q === "good" ? 0.4 : q === "early" ? 0.62 : 0.16);
  g.x = bez(Math.min(g.s, 1)).x;
  g.y = bez(Math.min(g.s, 1)).y;
  g.phase = "flight";
  g.grav = 340;
  g.trail = [{ x: g.x, y: g.y }];
  g.zoneX = simulate(g.spd * 0.92, -g.spd * 0.4, 300 - g.wind * 40);
  g.grade = q === "good" ? "GOOD TAKEOFF" : q === "early" ? "POPPED EARLY" : "FLAT OFF THE LIP";
  g.gradeC = q === "good" ? "#5eead4" : q === "early" ? "#fbbf24" : "#fb7185";
  burst(g, g.x, g.y + 6, "#e0f2fe", 12, 130);
}

function land(g: Game): void {
  g.phase = "landed";
  g.landX = Math.min(g.x, W - 12);
  g.dist = Math.round(distOf(g.landX));
  const zc = distOf(g.zoneX);
  const off = Math.abs(g.dist - zc);
  const crash = g.landX < 300;

  if (crash) {
    g.style = 0;
    g.grade = "CRASHED";
    g.gradeC = "#fb7185";
    g.shake = 12;
    g.flash = 0.5;
    g.flashC = "#fb7185";
    burst(g, g.landX, slopeY(g.landX), "#fb7185", 20, 210);
  } else if (off <= 5) {
    g.style = 30;
    g.grade = "TELEMARK! +30";
    g.gradeC = "#34d399";
    g.flash = 0.5;
    g.flashC = "#34d399";
    burst(g, g.landX, slopeY(g.landX), "#6ee7b7", 22, 190);
  } else if (off <= 10) {
    g.style = 12;
    g.grade = "STEADY +12";
    g.gradeC = "#a5f3fc";
    burst(g, g.landX, slopeY(g.landX), "#a5f3fc", 10, 140);
  } else {
    g.style = 0;
    g.grade = g.dist < zc ? "FELL SHORT" : "OVERSHOT";
    g.gradeC = "#fbbf24";
  }

  let ghost = 0;
  if (!crash && g.dist > g.ghost) {
    ghost = 10;
    g.beats += 1;
    g.grade = `${g.grade} · PAST THE GHOST`;
  }
  g.jumpScore = g.dist + g.style + ghost;
  g.roundScore += g.jumpScore;
  if (g.dist > g.bestDist) g.bestDist = g.dist;
  if (g.jumpScore > g.bestJump) g.bestJump = g.jumpScore;
  g.banner = `${g.dist} M`;
  g.bannerT = 2.4;
  g.slide = g.vx * 0.5;
  g.landT = 2.6;
}

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt * 1.6);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    if (p.life <= 0) g.parts.splice(i, 1);
  }

  if (g.phase === "inrun") {
    if (g.holding) g.spd = Math.min(268, g.spd + 96 * dt);
    else g.spd = Math.max(96, g.spd - 78 * dt);
    g.s += (g.spd * dt) / 460;
    if (g.s >= 1) {
      g.s = 1;
      takeoff(g);
      return;
    }
    const p = bez(g.s);
    g.x = p.x;
    g.y = p.y;
    return;
  }

  if (g.phase === "flight") {
    const toward = g.leanUp && !g.leanDown;
    const against = g.leanDown && !g.leanUp;
    g.grav = 340;
    if (toward) g.grav = 250 - g.wind * 70;
    else if (against) g.grav = 430 + g.wind * 60;

    g.vy += g.grav * dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.rot = Math.atan2(g.vy, g.vx) * 0.55;
    g.trail.push({ x: g.x, y: g.y });
    if (g.trail.length > 70) g.trail.shift();

    if (g.y >= slopeY(g.x) || g.x > W + 60) land(g);
    return;
  }

  // landed — slide out
  g.landT -= dt;
  if (g.slide > 4) {
    g.x = Math.min(W - 16, g.x + g.slide * dt);
    g.y = slopeY(g.x);
    g.slide = Math.max(0, g.slide - 140 * dt);
    g.rot = 0.55;
  }
  if (g.landT <= 0) {
    if (g.jump >= JUMPS) {
      g.over = true;
    } else {
      g.jump += 1;
      startJump(g);
    }
  }
}

/* ------------------------------ render ------------------------------ */

function drawScene(ctx: CanvasRenderingContext2D, g: Game | null, time: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#062b33");
  bg.addColorStop(0.55, "#08202e");
  bg.addColorStop(1, "#050d18");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // aurora bands
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(${i === 1 ? "103, 232, 249" : "45, 212, 191"}, ${0.1 + i * 0.03})`;
    ctx.lineWidth = 18;
    ctx.beginPath();
    for (let x = -20; x <= W + 20; x += 20) {
      const y = 40 + i * 26 + Math.sin(x / 70 + time / 900 + i * 1.7) * 14;
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // pines along the horizon
  ctx.fillStyle = "rgba(15, 118, 110, 0.5)";
  for (let i = 0; i < 14; i++) {
    const px = i * 38 + ((i * 29) % 12);
    const ph = 34 + ((i * 17) % 30);
    ctx.beginPath();
    ctx.moveTo(px, 322);
    ctx.lineTo(px + 14, 322 - ph);
    ctx.lineTo(px + 28, 322);
    ctx.closePath();
    ctx.fill();
  }

  // hill / outrun slope
  ctx.fillStyle = "#0b2233";
  ctx.beginPath();
  ctx.moveTo(196, 320);
  ctx.lineTo(W + 14, slopeY(W + 14));
  ctx.lineTo(W + 14, H + 14);
  ctx.lineTo(150, H + 14);
  ctx.lineTo(150, 360);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(165, 243, 252, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(196, 320);
  ctx.lineTo(W + 14, slopeY(W + 14));
  ctx.stroke();

  // in-run ramp
  ctx.strokeStyle = "rgba(186, 230, 253, 0.7)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(RAMP.p0.x, RAMP.p0.y);
  ctx.quadraticCurveTo(RAMP.p1.x, RAMP.p1.y, RAMP.p2.x, RAMP.p2.y);
  ctx.stroke();

  // lip zone (release window)
  ctx.strokeStyle = "#34d399";
  ctx.lineWidth = 8;
  ctx.beginPath();
  const z0 = bez(ZONE_FROM);
  const z1 = bez(ZONE_TO);
  ctx.moveTo(z0.x, z0.y);
  ctx.lineTo(z1.x, z1.y);
  ctx.stroke();
  ctx.font = "700 10px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = "#6ee7b7";
  ctx.fillText("RELEASE", z0.x - 54, z0.y + 4);
}

function drawSkier(ctx: CanvasRenderingContext2D, g: Game, time: number): void {
  const { x, y } = g;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(g.phase === "inrun" ? 0.62 : g.rot);

  // skis
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-20, 6);
  ctx.lineTo(22, 6);
  ctx.moveTo(-20, 11);
  ctx.lineTo(22, 11);
  ctx.stroke();

  // body
  ctx.strokeStyle = "#2dd4bf";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-4, 4);
  ctx.lineTo(2, -14);
  ctx.stroke();
  // arm back
  ctx.strokeStyle = "#5eead4";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(2, -12);
  ctx.lineTo(-12, -6);
  ctx.stroke();
  // head
  ctx.fillStyle = "#fbbf24";
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(5, -20, 6, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  // spray while on snow
  if (g.phase === "inrun" && Math.floor(time / 60) % 2 === 0) {
    ctx.fillStyle = "rgba(224, 242, 254, 0.7)";
    ctx.beginPath();
    ctx.arc(x - 14, y + 8, 2.4, 0, TAU);
    ctx.fill();
  }
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  drawScene(ctx, g, time);

  // wind streaks
  const w = g ? g.wind : 0;
  ctx.strokeStyle = "rgba(226, 232, 240, 0.2)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const yy = 100 + i * 58;
    const span = W + 160;
    const off = ((time / (2.6 - Math.abs(w)) * (0.4 + Math.abs(w)) + i * 130) % span) - 80;
    const dir = w >= 0 ? 1 : -1;
    const sx = w >= 0 ? off : W + 80 - (off + 80);
    ctx.beginPath();
    ctx.moveTo(sx, yy);
    ctx.lineTo(sx + dir * (30 + Math.abs(w) * 40), yy);
    ctx.stroke();
  }

  if (g) {
    // telemark zone band on the slope
    if (g.phase !== "landed" || g.landT > 0) {
      const zx = g.zoneX || xOfDist(88);
      const zc = distOf(zx);
      const x0 = xOfDist(zc - 5);
      const x1 = xOfDist(zc + 5);
      ctx.strokeStyle = "rgba(52, 211, 153, 0.9)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x0, slopeY(x0));
      ctx.lineTo(x1, slopeY(x1));
      ctx.stroke();
      ctx.font = "700 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#6ee7b7";
      ctx.fillText(`TELEMARK ${Math.round(zc)}M`, (x0 + x1) / 2, slopeY((x0 + x1) / 2) + 22);
    }

    // ghost line
    const gx = xOfDist(g.ghost);
    if (gx < W + 10) {
      ctx.strokeStyle = "rgba(196, 181, 253, 0.75)";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.moveTo(gx, slopeY(gx) - 44);
      ctx.lineTo(gx, slopeY(gx) + 6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "700 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#c4b5fd";
      ctx.fillText(`GHOST ${g.ghost}M`, gx, slopeY(gx) - 52);
    }

    // flight trail
    if (g.trail.length > 1) {
      ctx.strokeStyle = "rgba(165, 243, 252, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      g.trail.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }

    drawSkier(ctx, g, time);

    // HUD
    ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
    ctx.beginPath();
    ctx.roundRect(14, 14, 150, 58, 12);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.fillStyle = "#a5f3fc";
    ctx.fillText(`JUMP ${g.jump} / ${JUMPS}`, 28, 36);
    ctx.font = "800 17px ui-monospace, monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${g.roundScore} PTS`, 28, 58);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
    ctx.beginPath();
    ctx.roundRect(W - 164, 14, 150, 58, 12);
    ctx.fill();
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.fillStyle = "#93c5fd";
    ctx.fillText("WIND", W - 28, 36);
    const dir = g.wind >= 0 ? 1 : -1;
    const mag = Math.abs(g.wind);
    ctx.strokeStyle = mag > 0.05 ? "#7dd3fc" : "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 3;
    const woff = Math.sin(time / 160) * 6 * mag;
    ctx.beginPath();
    ctx.moveTo(W - 60 - dir * 30 + woff, 54);
    ctx.lineTo(W - 60 + dir * 30 + woff, 54);
    ctx.lineTo(W - 60 + dir * 18 + woff, 46);
    ctx.moveTo(W - 60 + dir * 30 + woff, 54);
    ctx.lineTo(W - 60 + dir * 18 + woff, 62);
    ctx.stroke();
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillStyle = "#bae6fd";
    ctx.fillText(`${mag.toFixed(1)}`, W - 28, 70);

    // speed gauge on the inrun
    if (g.phase === "inrun") {
      const bw = 300;
      const bx = (W - bw) / 2;
      const by = H - 54;
      ctx.fillStyle = "rgba(2, 6, 23, 0.88)";
      ctx.beginPath();
      ctx.roundRect(bx - 7, by - 7, bw + 14, 34, 14);
      ctx.fill();
      ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, 20, 9);
      ctx.fill();
      const frac = (g.spd - 96) / (268 - 96);
      const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      grad.addColorStop(0, "#22d3ee");
      grad.addColorStop(0.6, "#34d399");
      grad.addColorStop(1, "#fbbf24");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(bx, by, Math.max(6, frac * bw), 20, 9);
      ctx.fill();
      ctx.font = "700 9px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(g.holding ? "HOLDING — RELEASE ON THE GREEN" : "HOLD SPACE TO BUILD SPEED", W / 2, by - 12);
    }

    if (g.phase === "flight") {
      ctx.font = "700 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(165, 243, 252, 0.85)";
      ctx.fillText("↑ LEAN WITH THE WIND · ↓ LEAN AGAINST IT", W / 2, H - 28);
      if (g.grade) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - g.trail.length / 45);
        ctx.font = "800 15px ui-monospace, monospace";
        ctx.fillStyle = g.gradeC;
        ctx.fillText(g.grade, g.x, g.y - 40);
        ctx.restore();
      }
    }

    if (g.phase === "landed") {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.landT);
      ctx.textAlign = "center";
      ctx.font = "800 20px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = g.gradeC;
      ctx.shadowColor = "rgba(45, 212, 191, 0.8)";
      ctx.shadowBlur = 14;
      ctx.fillText(g.grade, g.x - 40, g.y - 44);
      ctx.font = "800 26px ui-monospace, monospace";
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      ctx.fillText(`+${g.jumpScore}`, g.x - 40, g.y - 16);
      ctx.restore();
    }

    // particles
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.4);
      ctx.font = "800 30px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(34, 211, 238, 0.9)";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, 140);
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

export default function SkiJump({ gameId = "ski-jump" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [jump, setJump] = useState(1);
  const [roundScore, setRoundScore] = useState(0);
  const [bestDist, setBestDist] = useStored<number>(`${gameId}:dist`, 0);
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
    setJump(1);
    setRoundScore(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const hold = useCallback((on: boolean) => {
    const g = gameRef.current;
    if (!g) return;
    if (on) {
      g.holding = true;
    } else if (g.phase === "inrun" && g.holding) {
      g.holding = false;
      takeoff(g);
    }
  }, []);

  const lean = useCallback((dir: "up" | "down" | "none") => {
    const g = gameRef.current;
    if (!g) return;
    g.leanUp = dir === "up";
    g.leanDown = dir === "down";
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastJump = -1;
    let lastRound = -1;
    let lastDist = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      if (g.bestJump !== lastScore) {
        lastScore = g.bestJump;
        setScore(g.bestJump);
      }
      if (g.jump !== lastJump) {
        lastJump = g.jump;
        setJump(g.jump);
      }
      if (g.roundScore !== lastRound) {
        lastRound = g.roundScore;
        setRoundScore(g.roundScore);
      }
      if (g.bestDist !== lastDist) {
        lastDist = g.bestDist;
        setBestDist(g.bestDist);
      }

      draw(t);
      if (g.over) {
        setScore(g.bestJump);
        setRoundScore(g.roundScore);
        setNewBest(submit(g.bestJump));
        setStatus("over");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit, setBestDist]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (status === "playing") hold(true);
        else start();
        return;
      }
      if (status !== "playing") return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        lean("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        lean("down");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") hold(false);
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") lean("none");
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start, hold, lean]);

  const padBtn =
    "touch-none rounded-xl border bg-surface py-3 text-sm font-bold uppercase tracking-wider transition active:scale-95";

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-cyan-300">
          Jump <b className="ml-1 text-sm text-ink">{jump}/5</b>
        </span>
        <span className="text-teal-300">
          Longest <b className="ml-1 text-sm text-ink">{bestDist}m</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(34,211,238,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Ski Jump hill"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">SKI JUMP</p>
            <p className="mt-2 text-sm text-muted">
              Five jumps, wind that won&apos;t hold still, one ghost to beat every round. Hold
              Space down the in-run to load speed, let go on the green strip at the lip — pop it
              early or flat and you&apos;ll lose the hill. Then lean with the wind to float, against
              it to dive, and drop into the green telemark band for the style bonus. Distance plus
              style is your score.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Drop in
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Hold / release Space · ↑ ↓ to lean — or use the pads
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-sky-300">ROUND OVER</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best jump · Round {roundScore} · Longest {bestDist}m
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Go again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Steady on the in-run · fly into the green band
            </p>
          </Overlay>
        )}
      </div>

      <div className="mt-2 grid touch-none select-none grid-cols-3 gap-2">
        <button
          type="button"
          onPointerDown={() => hold(true)}
          onPointerUp={() => hold(false)}
          onPointerLeave={() => hold(false)}
          onPointerCancel={() => hold(false)}
          aria-label="Hold to build speed, release to jump"
          className={`${padBtn} border-emerald-400/50 text-emerald-300`}
        >
          Hold
        </button>
        <button
          type="button"
          onPointerDown={() => lean("up")}
          onPointerUp={() => lean("none")}
          onPointerCancel={() => lean("none")}
          aria-label="Lean with the wind"
          className={`${padBtn} border-sky-400/50 text-sky-300`}
        >
          ▲ With wind
        </button>
        <button
          type="button"
          onPointerDown={() => lean("down")}
          onPointerUp={() => lean("none")}
          onPointerCancel={() => lean("none")}
          aria-label="Lean against the wind"
          className={`${padBtn} border-sky-400/50 text-sky-300`}
        >
          ▼ Against
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Release on the green strip · teal band = telemark · dashed purple = ghost
      </p>
    </div>
  );
}
