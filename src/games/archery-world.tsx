"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 560;
const H = 440;
const TAU = Math.PI * 2;
const CX = 280;
const CY = 205;
const APERTURE = 216;
const ARROWS_PER_ROUND = 6;
const ROUNDS = 5;
const TONE = "from-lime-400 via-emerald-500 to-teal-600";

const DISTANCES = [10, 30, 50, 70, 90];
const SCALE = [1.6, 1.2, 1.05, 2.1, 1.9];
const SCOPED = [false, false, false, true, true];
const WIND_MAX = [4, 6, 9, 13, 17];

type Status = "idle" | "playing" | "over";
type Phase = "aim" | "fly" | "score" | "round";

interface Pt {
  x: number;
  y: number;
}
interface Sw {
  u: number;
  v: number;
}
interface Arrow {
  u: number;
  v: number;
  score: number;
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
  round: number;
  arrow: number;
  total: number;
  wind: number;
  drawing: boolean;
  pressT: number;
  aim: Pt;
  // flight
  from: Pt;
  to: Pt;
  flyT: number;
  flyDur: number;
  score: number;
  arrows: Arrow[];
  scoreT: number;
  roundT: number;
  banner: string;
  bannerT: number;
  flash: number;
  flashC: string;
  shake: number;
  parts: Part[];
  floats: Floater[];
  lastRoundScore: number;
  done: boolean;
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
      r: 1.6 + Math.random() * 2.4,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, c: string): void {
  g.floats.push({ x, y, text, life: 1, c });
}

/* ------------------------------ aiming ------------------------------ */

function swayUnits(g: Game): Sw {
  const dist = DISTANCES[g.round];
  const base = 0.7 + dist * 0.028;
  const hold = g.drawing ? Math.max(0, g.t - g.pressT) : 0;
  const amp = base * Math.min(5, 1 + hold * 1.1);
  const ph = g.arrow * 1.93 + g.round * 0.7;
  return {
    u:
      amp *
      (Math.sin(g.t * 1.7 + ph) + 0.55 * Math.sin(g.t * 3.3 + ph * 2.1)),
    v:
      amp *
      (0.72 * Math.sin(g.t * 2.4 + ph * 1.4) + 0.5 * Math.sin(g.t * 4.3 + ph * 0.6)),
  };
}

function crosshair(g: Game): Pt {
  const s = SCALE[g.round];
  const sw = swayUnits(g);
  return { x: g.aim.x + sw.u * s, y: g.aim.y + sw.v * s };
}

function drawPower(g: Game): number {
  if (!g.drawing) return 0;
  return Math.max(0.3, Math.min(1, (g.t - g.pressT) / 0.55));
}

function releaseArrow(g: Game): void {
  g.drawing = false;
  const s = SCALE[g.round];
  const dist = DISTANCES[g.round];
  const pow = drawPower(g);
  const sw = swayUnits(g);
  const windU = g.wind;
  const dropU = (1 - pow) * (2 + dist * 0.25);

  const u = (g.aim.x - CX) / s + sw.u + windU;
  const v = (g.aim.y - CY) / s + sw.v + dropU;
  const rad = Math.hypot(u, v);

  let score = 0;
  if (rad <= 100) score = 11 - Math.ceil(rad / 10);
  if (score < 0) score = 0;

  g.score = score;
  g.from = { x: CX, y: H + 26 };
  g.to = { x: CX + u * s, y: CY + v * s };
  g.flyT = 0;
  g.flyDur = 0.34;
  g.phase = "fly";
}

function landArrow(g: Game): void {
  const s = SCALE[g.round];
  const u = (g.to.x - CX) / s;
  const v = (g.to.y - CY) / s;
  g.arrows.push({ u, v, score: g.score });
  g.total += g.score;

  const x = g.to.x;
  const y = g.to.y;
  if (g.score >= 9) {
    g.flash = g.score === 10 ? 0.75 : 0.5;
    g.flashC = g.score === 10 ? "#fde68a" : "#fca5a5";
    g.shake = Math.max(g.shake, 6);
    burst(g, x, y, g.score === 10 ? "#fde68a" : "#fda4af", 26, 210);
    floater(g, x, y - 26, `${g.score}!`, g.score === 10 ? "#fde68a" : "#fda4af");
  } else if (g.score === 0) {
    burst(g, x, y, "#94a3b8", 10, 130);
    floater(g, x, y - 20, "MISS", "#94a3b8");
    g.shake = Math.max(g.shake, 3);
  } else {
    burst(g, x, y, "#bae6fd", 10, 140);
    floater(g, x, y - 22, `${g.score}`, "#bae6fd");
  }
  g.phase = "score";
  g.scoreT = 0.7;
}

function startRound(g: Game, round: number): void {
  g.round = round;
  g.arrow = 0;
  g.arrows = [];
  g.drawing = false;
  g.wind = (Math.random() * 2 - 1) * WIND_MAX[round];
  g.phase = "aim";
  const dir = g.wind > 0 ? "→" : "←";
  const strength = Math.abs(g.wind) < 1.5 ? "CALM" : `${dir.repeat(Math.min(3, 1 + Math.floor(Math.abs(g.wind) / 5)))} ${Math.round(Math.abs(g.wind))}`;
  g.banner = `ROUND ${round + 1} · ${DISTANCES[round]}m · WIND ${strength}`;
  g.bannerT = 2;
}

function createGame(): Game {
  const g: Game = {
    phase: "aim",
    t: 0,
    round: 0,
    arrow: 0,
    total: 0,
    wind: 0,
    drawing: false,
    pressT: 0,
    aim: { x: CX, y: CY },
    from: { x: CX, y: H },
    to: { x: CX, y: CY },
    flyT: 0,
    flyDur: 0.34,
    score: 0,
    arrows: [],
    scoreT: 0,
    roundT: 0,
    banner: "",
    bannerT: 0,
    flash: 0,
    flashC: "#ffffff",
    shake: 0,
    parts: [],
    floats: [],
    lastRoundScore: 0,
    done: false,
  };
  startRound(g, 0);
  return g;
}

function step(g: Game, dt: number): void {
  g.t += dt;
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt * 1.7);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-2.3 * dt);
    p.vy *= Math.exp(-2.3 * dt);
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.1;
    f.y -= 28 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (g.phase === "fly") {
    g.flyT += dt;
    if (g.flyT >= g.flyDur) landArrow(g);
    return;
  }

  if (g.phase === "score") {
    g.scoreT -= dt;
    if (g.scoreT <= 0) {
      if (g.arrow >= ARROWS_PER_ROUND - 1) {
        g.lastRoundScore = g.arrows.reduce((sum, a) => sum + a.score, 0);
        g.phase = "round";
        g.roundT = 1.8;
      } else {
        g.arrow += 1;
        g.phase = "aim";
      }
    }
    return;
  }

  if (g.phase === "round") {
    g.roundT -= dt;
    if (g.roundT <= 0) {
      if (g.round >= ROUNDS - 1) g.done = true;
      else startRound(g, g.round + 1);
    }
  }
}

/* ------------------------------ render ------------------------------ */

const RING_COLORS = ["#f8fafc", "#f8fafc", "#cbd5e1", "#cbd5e1", "#38bdf8", "#38bdf8", "#fb7185", "#fb7185", "#fde68a", "#fde68a"];

function drawTarget(ctx: CanvasRenderingContext2D, s: number): void {
  // straw outer disc
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#3f3a30";
  ctx.beginPath();
  ctx.arc(CX, CY, 104 * s, 0, TAU);
  ctx.fill();
  ctx.restore();

  // rings, outer → inner
  for (let ring = 10; ring >= 1; ring--) {
    const r = ring * 10 * s;
    ctx.fillStyle = RING_COLORS[10 - ring];
    ctx.beginPath();
    ctx.arc(CX, CY, r, 0, TAU);
    ctx.fill();
  }
  // ring separators
  ctx.strokeStyle = "rgba(2, 6, 23, 0.45)";
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 10; ring++) {
    ctx.beginPath();
    ctx.arc(CX, CY, ring * 10 * s, 0, TAU);
    ctx.stroke();
  }
  // X ring
  ctx.strokeStyle = "rgba(2, 6, 23, 0.6)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(CX, CY, 5 * s, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "rgba(254, 243, 199, 0.6)";
  ctx.beginPath();
  ctx.arc(CX, CY, Math.max(1.5, 1.6 * s), 0, TAU);
  ctx.fill();
}

function drawScene(ctx: CanvasRenderingContext2D, g: Game | null): void {
  const scoped = g ? SCOPED[g.round] : false;

  // sky
  const sky = ctx.createLinearGradient(0, -14, 0, H + 14);
  sky.addColorStop(0, scoped ? "#03060b" : "#071726");
  sky.addColorStop(0.6, scoped ? "#071019" : "#0b2c3f");
  sky.addColorStop(1, scoped ? "#050a10" : "#123b34");
  ctx.fillStyle = sky;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  if (!scoped) {
    // distant hills + ground
    ctx.fillStyle = "#0a2b2a";
    ctx.beginPath();
    ctx.moveTo(-14, 300);
    for (let x = -14; x <= W + 14; x += 40) {
      ctx.lineTo(x, 300 - Math.sin(x / 70) * 22 - 14);
    }
    ctx.lineTo(W + 14, 340);
    ctx.lineTo(-14, 340);
    ctx.closePath();
    ctx.fill();
    const grd = ctx.createLinearGradient(0, 300, 0, H + 14);
    grd.addColorStop(0, "#123b31");
    grd.addColorStop(1, "#0a241d");
    ctx.fillStyle = grd;
    ctx.fillRect(-14, 318, W + 28, H - 304);
    ctx.fillStyle = "rgba(163, 230, 53, 0.16)";
    ctx.fillRect(-14, 318, W + 28, 2);
    // stand legs
    ctx.strokeStyle = "#78716c";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(CX - 40, CY + 96 * SCALE[g ? g.round : 0]);
    ctx.lineTo(CX - 74, 330);
    ctx.moveTo(CX + 40, CY + 96 * SCALE[g ? g.round : 0]);
    ctx.lineTo(CX + 74, 330);
    ctx.stroke();
  } else {
    // range floor inside the scope
    const grd = ctx.createLinearGradient(0, CY + 130, 0, H);
    grd.addColorStop(0, "rgba(18, 59, 49, 0.9)");
    grd.addColorStop(1, "#08201a");
    ctx.fillStyle = grd;
    ctx.fillRect(-14, CY + 150, W + 28, H);
    ctx.strokeStyle = "rgba(163, 230, 53, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, CY + 150);
    ctx.lineTo(W + 14, CY + 150);
    ctx.stroke();
    // distance markers
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(134, 239, 172, 0.5)";
    for (let i = 1; i <= 4; i++) {
      const yy = CY + 150 + i * 44;
      ctx.fillRect(-14, yy, 16 + i * 8, 2);
      ctx.fillText(`${i * 20}m`, 8 + i * 8, yy - 5);
    }
  }

  const s = SCALE[g ? g.round : 0];
  drawTarget(ctx, s);
}

function drawArrowStick(ctx: CanvasRenderingContext2D, a: Arrow, s: number, fresh: boolean): void {
  const x = CX + a.u * s;
  const y = CY + a.v * s;
  const ang = Math.PI / 2 - 0.34;
  const len = 44;
  ctx.save();
  ctx.strokeStyle = fresh ? "#fef3c7" : "rgba(226, 232, 240, 0.5)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
  ctx.lineTo(x, y);
  ctx.stroke();
  // fletching
  ctx.fillStyle = fresh ? "#f87171" : "rgba(248, 113, 113, 0.5)";
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
  ctx.lineTo(x + Math.cos(ang) * (len - 9) + 5, y + Math.sin(ang) * (len - 9) + 3);
  ctx.lineTo(x + Math.cos(ang) * (len - 3), y + Math.sin(ang) * (len - 3));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.arc(x, y, 2.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function render(canvas: HTMLCanvasElement, g: Game | null): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  const scoped = g ? SCOPED[g.round] : false;

  if (scoped) {
    ctx.fillStyle = "#02040a";
    ctx.fillRect(-14, -14, W + 28, H + 28);
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, APERTURE, 0, TAU);
    ctx.clip();
    drawScene(ctx, g);
    ctx.restore();
    // glass edge
    ctx.save();
    ctx.strokeStyle = "rgba(103, 232, 249, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CX, CY, APERTURE, 0, TAU);
    ctx.stroke();
    const rim = ctx.createRadialGradient(CX, CY, APERTURE - 60, CX, CY, APERTURE);
    rim.addColorStop(0, "rgba(0,0,0,0)");
    rim.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(CX, CY, APERTURE, 0, TAU);
    ctx.fill();
    ctx.restore();
  } else {
    drawScene(ctx, g);
  }

  if (g) {
    // reticle lines (static reference)
    ctx.save();
    ctx.strokeStyle = "rgba(165, 243, 252, 0.32)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CX - APERTURE, CY);
    ctx.lineTo(CX + APERTURE, CY);
    ctx.moveTo(CX, CY - APERTURE);
    ctx.lineTo(CX, CY + APERTURE);
    ctx.stroke();
    ctx.fillStyle = "rgba(165, 243, 252, 0.6)";
    for (let i = -8; i <= 8; i++) {
      if (i === 0) continue;
      const len = i % 2 === 0 ? 8 : 4;
      ctx.fillRect(CX + i * 22, CY - len / 2, 1, len);
      ctx.fillRect(CX - len / 2, CY + i * 22, len, 1);
    }
    ctx.restore();

    // stuck arrows
    const s = SCALE[g.round];
    g.arrows.forEach((a, i) => drawArrowStick(ctx, a, s, i === g.arrows.length - 1));

    // flying arrow
    if (g.phase === "fly") {
      const k = Math.min(1, g.flyT / g.flyDur);
      const e = 1 - (1 - k) * (1 - k);
      const x = g.from.x + (g.to.x - g.from.x) * e;
      const y = g.from.y + (g.to.y - g.from.y) * e;
      const ang = Math.atan2(g.to.y - g.from.y, g.to.x - g.from.x);
      ctx.save();
      ctx.strokeStyle = "#fef3c7";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(ang) * 52, y - Math.sin(ang) * 52);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#f87171";
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(ang) * 52, y - Math.sin(ang) * 52);
      ctx.lineTo(x - Math.cos(ang) * 42 - 6, y - Math.sin(ang) * 42 + 4);
      ctx.lineTo(x - Math.cos(ang) * 40, y - Math.sin(ang) * 40);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // aim crosshair
    if (g.phase === "aim" || g.phase === "fly") {
      const ch = g.phase === "aim" ? crosshair(g) : g.to;
      const pow = drawPower(g);
      ctx.save();
      ctx.strokeStyle = pow >= 1 ? "#fde68a" : "rgba(236, 253, 245, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ch.x, ch.y, 15, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ch.x - 26, ch.y);
      ctx.lineTo(ch.x - 6, ch.y);
      ctx.moveTo(ch.x + 6, ch.y);
      ctx.lineTo(ch.x + 26, ch.y);
      ctx.moveTo(ch.x, ch.y - 26);
      ctx.lineTo(ch.x, ch.y - 6);
      ctx.moveTo(ch.x, ch.y + 6);
      ctx.lineTo(ch.x, ch.y + 26);
      ctx.stroke();
      ctx.restore();

      // draw power arc
      if (g.drawing) {
        ctx.strokeStyle = pow >= 1 ? "#fde68a" : "#a3e635";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(ch.x, ch.y, 24, -Math.PI / 2, -Math.PI / 2 + pow * TAU);
        ctx.stroke();
        ctx.font = "700 11px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
        ctx.fillText("RELEASE", ch.x, ch.y + 42);
      }
    }

    // wind gauge
    const wMag = Math.abs(g.wind);
    ctx.save();
    ctx.font = "700 13px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(186, 230, 252, 0.95)";
    ctx.fillText(`WIND`, 16, 26);
    ctx.translate(74, 22);
    if (wMag < 1.5) {
      ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
      ctx.fillText("CALM", 0, 4);
    } else {
      const dir = Math.sign(g.wind);
      const arrows = Math.min(3, 1 + Math.floor(wMag / 5));
      ctx.strokeStyle = "#7dd3fc";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      for (let i = 0; i < arrows; i++) {
        const ox = dir * (i * 15);
        ctx.beginPath();
        ctx.moveTo(ox - 6 * dir, -7);
        ctx.lineTo(ox + 6 * dir, 0);
        ctx.lineTo(ox - 6 * dir, 7);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(186, 230, 252, 0.95)";
      ctx.fillText(String(Math.round(wMag)), dir > 0 ? arrows * 15 + 4 : -arrows * 15 - 26, 5);
    }
    ctx.restore();

    // round / arrow readout
    ctx.font = "700 13px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
    ctx.fillText(`${DISTANCES[g.round]}m · ARROW ${g.arrow + 1}/${ARROWS_PER_ROUND}`, W - 16, 26);
    ctx.fillStyle = "#a3e635";
    ctx.fillText(`TOTAL ${g.total}`, W - 16, 46);

    // round arrow strip
    for (let i = 0; i < ARROWS_PER_ROUND; i++) {
      const bx = 16 + i * 34;
      const by = H - 26;
      const got = g.arrows[i];
      ctx.fillStyle = "rgba(2, 6, 23, 0.7)";
      ctx.beginPath();
      ctx.roundRect(bx, by - 16, 28, 20, 6);
      ctx.fill();
      ctx.font = "700 12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = got ? (got.score >= 9 ? "#fde68a" : "#e2e8f0") : "rgba(148,163,184,0.5)";
      ctx.fillText(got ? String(got.score) : "·", bx + 14, by - 2);
    }

    // particles + floaters
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.textAlign = "center";
    ctx.font = "800 16px ui-monospace, monospace";
    for (const f of g.floats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // round summary card
    if (g.phase === "round") {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.roundT);
      ctx.fillStyle = "rgba(2, 6, 23, 0.82)";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 160, H / 2 - 62, 320, 110, 16);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.font = "800 24px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#ecfccb";
      ctx.fillText(`ROUND ${g.round + 1} CLEAR`, W / 2, H / 2 - 26);
      ctx.font = "800 30px ui-monospace, monospace";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${g.lastRoundScore} / ${ARROWS_PER_ROUND * 10}`, W / 2, H / 2 + 10);
      ctx.font = "600 12px ui-monospace, monospace";
      ctx.fillStyle = "rgba(165, 243, 252, 0.9)";
      ctx.fillText(`RUNNING TOTAL ${g.total} / ${ROUNDS * ARROWS_PER_ROUND * 10}`, W / 2, H / 2 + 34);
      ctx.restore();
    }

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.4);
      ctx.font = "800 24px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(163,230,53,0.9)";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H - 58);
      ctx.restore();
    }

    if (g.flash > 0.01) {
      ctx.fillStyle = hexA(g.flashC, g.flash * 0.4);
      ctx.fillRect(-14, -14, W + 28, H + 28);
    }
  } else {
    ctx.font = "700 13px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(165, 243, 252, 0.7)";
    ctx.fillText("10m TARGET RANGE", W / 2, 30);
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function ArcheryWorld({ gameId = "archery-world" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) render(canvas, gameRef.current);
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
    draw();
  }, [draw]);

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setRound(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const finish = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setScore(g.total);
    setNewBest(submit(g.total));
    setStatus("over");
  }, [submit]);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastRound = -1;
    let finished = false;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      if (g.total !== lastScore) {
        lastScore = g.total;
        setScore(g.total);
      }
      if (g.round !== lastRound) {
        lastRound = g.round;
        setRound(g.round + 1);
      }

      draw();
      if (g.done && !finished) {
        finished = true;
        draw();
        finish();
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, finish]);

  useEffect(() => {
    if (status !== "playing") draw();
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

  const toCanvas = (clientX: number, clientY: number, el: HTMLCanvasElement): Pt => {
    const rect = el.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[580px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-lime-300">
          Round <b className="ml-1 text-sm text-ink">{round}/5</b>
        </span>
        <span className="text-emerald-300">
          Max <b className="ml-1 text-sm text-ink">300</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(134,239,172,0.75)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Archery World target range"
          onPointerMove={(e) => {
            const g = gameRef.current;
            if (!g || status !== "playing") return;
            g.aim = toCanvas(e.clientX, e.clientY, e.currentTarget);
          }}
          onPointerDown={(e) => {
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g || g.phase !== "aim") return;
            e.currentTarget.setPointerCapture(e.pointerId);
            g.aim = toCanvas(e.clientX, e.clientY, e.currentTarget);
            g.drawing = true;
            g.pressT = g.t;
          }}
          onPointerUp={() => {
            const g = gameRef.current;
            if (g?.drawing && g.phase === "aim") releaseArrow(g);
            else if (g) g.drawing = false;
          }}
          onPointerCancel={() => {
            const g = gameRef.current;
            if (g) g.drawing = false;
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">ARCHERY WORLD</p>
            <p className="mt-2 text-sm text-muted">
              Five rounds of six arrows, walking back from 10 to 90 metres. Hold to draw — the
              crosshair trembles harder the longer you hold — then loose while it sits over the
              gold. Wind shifts every round and drop steals rings at distance, so time the release.
              The last two rounds run through the scope.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Nock an arrow
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Mouse to aim · press and hold to draw, release to loose
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-emerald-300">RANGE CLOSED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Total / 300 · Best {best ?? "—"} · {round} rounds
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Aim into the wind · quick draw for close, steady draw for far
            </p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        10 rings worth 10→1 · gold flash on the 9 and 10 · 30 arrows total
      </p>
    </div>
  );
}
