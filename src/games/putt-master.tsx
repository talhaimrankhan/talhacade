"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 600;
const H = 420;
const M = 24;
const TAU = Math.PI * 2;
const BALL_R = 7;
const CUP_R = 11;
const PULL_SCALE = 4.4;
const MAX_PULL = 115;
const TONE = "from-teal-400 via-emerald-500 to-green-600";

type Status = "idle" | "playing" | "over";
type Phase = "aim" | "roll" | "clear";

interface Pt {
  x: number;
  y: number;
}
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Sand {
  x: number;
  y: number;
  r: number;
}
interface Well {
  x: number;
  y: number;
  r: number;
  s: number;
}
interface Mover {
  ox: number;
  oy: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
  sp: number;
  ph: number;
}
interface HoleDef {
  par: number;
  tee: Pt;
  cup: Pt;
  walls: Rect[];
  water: Rect[];
  sand: Sand[];
  wells: Well[];
  movers: Mover[];
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
  hole: number;
  phase: Phase;
  t: number;
  rollT: number;
  stopT: number;
  total: number;
  strokes: number;
  ball: Ball;
  rest: Pt;
  aiming: boolean;
  pull: Pt;
  clearT: number;
  clearText: string;
  banner: string;
  bannerT: number;
  parts: Part[];
  floats: Floater[];
  shake: number;
  over: boolean;
}

/* ------------------------------ course ------------------------------ */

function borders(): Rect[] {
  return [
    { x: 0, y: 0, w: W, h: M },
    { x: 0, y: H - M, w: W, h: M },
    { x: 0, y: 0, w: M, h: H },
    { x: W - M, y: 0, w: M, h: H },
  ];
}

const HOLES: HoleDef[] = [
  {
    // 1 — straight opener through the sand
    par: 2,
    tee: { x: 92, y: 210 },
    cup: { x: 522, y: 210 },
    walls: [
      { x: 300, y: M, w: 16, h: 96 },
      { x: 300, y: H - M - 96, w: 16, h: 96 },
    ],
    water: [],
    sand: [{ x: 300, y: 210, r: 52 }],
    wells: [],
    movers: [],
  },
  {
    // 2 — dogleg right
    par: 3,
    tee: { x: 86, y: 344 },
    cup: { x: 522, y: 92 },
    walls: [{ x: 300, y: M, w: 16, h: 300 }],
    water: [],
    sand: [{ x: 470, y: 190, r: 46 }],
    wells: [],
    movers: [],
  },
  {
    // 3 — split the water
    par: 3,
    tee: { x: 84, y: 210 },
    cup: { x: 532, y: 210 },
    walls: [],
    water: [{ x: 252, y: 110, w: 96, h: 200 }],
    sand: [{ x: 474, y: 322, r: 44 }],
    wells: [],
    movers: [],
  },
  {
    // 4 — gravity well in the middle
    par: 3,
    tee: { x: 90, y: 88 },
    cup: { x: 522, y: 340 },
    walls: [{ x: 240, y: M, w: 16, h: 150 }],
    water: [],
    sand: [],
    wells: [{ x: 330, y: 240, r: 132, s: 300 }],
    movers: [],
  },
  {
    // 5 — S zigzag
    par: 4,
    tee: { x: 78, y: 352 },
    cup: { x: 532, y: 78 },
    walls: [
      { x: 190, y: M, w: 16, h: 250 },
      { x: 380, y: 146, w: 16, h: H - M - 146 },
    ],
    water: [],
    sand: [{ x: 508, y: 214, r: 40 }],
    wells: [],
    movers: [],
  },
  {
    // 6 — push and pull
    par: 3,
    tee: { x: 84, y: 210 },
    cup: { x: 532, y: 210 },
    walls: [
      { x: 300, y: M, w: 16, h: 130 },
      { x: 300, y: 266, w: 16, h: H - M - 266 },
    ],
    water: [],
    sand: [],
    wells: [
      { x: 210, y: 336, r: 122, s: 250 },
      { x: 424, y: 96, r: 122, s: -230 },
    ],
    movers: [],
  },
  {
    // 7 — sliding doors
    par: 4,
    tee: { x: 84, y: 210 },
    cup: { x: 532, y: 210 },
    walls: [],
    water: [],
    sand: [{ x: 300, y: 348, r: 42 }],
    wells: [],
    movers: [
      { ox: 300, oy: 30, w: 18, h: 130, ax: 0, ay: 20, sp: 1.5, ph: 0 },
      { ox: 300, oy: 250, w: 18, h: 130, ax: 0, ay: -20, sp: 1.5, ph: 0 },
    ],
  },
  {
    // 8 — the gauntlet
    par: 4,
    tee: { x: 82, y: 344 },
    cup: { x: 532, y: 84 },
    walls: [
      { x: 250, y: M, w: 16, h: 240 },
      { x: 400, y: 156, w: 16, h: H - M - 156 },
    ],
    water: [{ x: 266, y: 300, w: 134, h: 60 }],
    sand: [{ x: 132, y: 122, r: 44 }],
    wells: [{ x: 500, y: 306, r: 110, s: 240 }],
    movers: [],
  },
  {
    // 9 — the finish
    par: 5,
    tee: { x: 300, y: 366 },
    cup: { x: 300, y: 74 },
    walls: [
      { x: 140, y: 150, w: 130, h: 16 },
      { x: 330, y: 250, w: 130, h: 16 },
    ],
    water: [
      { x: 58, y: 58, w: 132, h: 92 },
      { x: 410, y: 58, w: 132, h: 92 },
    ],
    sand: [{ x: 300, y: 300, r: 46 }],
    wells: [{ x: 300, y: 150, r: 120, s: 260 }],
    movers: [{ ox: 300, oy: 172, w: 18, h: 88, ax: 92, ay: 0, sp: 1.25, ph: 0 }],
  },
];

function moverRects(h: HoleDef, t: number): Rect[] {
  return h.movers.map((m) => ({
    x: m.ox + m.ax * Math.sin(t * m.sp + m.ph),
    y: m.oy + m.ay * Math.sin(t * m.sp + m.ph),
    w: m.w,
    h: m.h,
  }));
}

/* ------------------------------ physics ------------------------------ */

function collideRect(b: { x: number; y: number; vx: number; vy: number }, r: Rect): void {
  const cx = Math.max(r.x, Math.min(b.x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(b.y, r.y + r.h));
  const dx = b.x - cx;
  const dy = b.y - cy;
  const d = Math.hypot(dx, dy);
  let nx: number;
  let ny: number;
  let push: number;

  if (d > 0.0001) {
    if (d >= BALL_R) return;
    nx = dx / d;
    ny = dy / d;
    push = BALL_R - d;
  } else {
    // centre swallowed by the rect — eject through the nearest face
    const pens: Array<{ nx: number; ny: number; p: number }> = [
      { nx: -1, ny: 0, p: b.x - r.x + BALL_R },
      { nx: 1, ny: 0, p: r.x + r.w - b.x + BALL_R },
      { nx: 0, ny: -1, p: b.y - r.y + BALL_R },
      { nx: 0, ny: 1, p: r.y + r.h - b.y + BALL_R },
    ];
    pens.sort((a, z) => a.p - z.p);
    nx = pens[0].nx;
    ny = pens[0].ny;
    push = -pens[0].p;
  }

  b.x += nx * push;
  b.y += ny * push;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= 1.72 * vn * nx;
    b.vy -= 1.72 * vn * ny;
    b.vx *= 0.9;
    b.vy *= 0.9;
  }
}

function physics(
  b: { x: number; y: number; vx: number; vy: number },
  h: HoleDef,
  walls: Rect[],
  dt: number,
): void {
  for (const w of h.wells) {
    const dx = w.x - b.x;
    const dy = w.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < w.r) {
      const f = w.s * (1 - d / w.r);
      b.vx += (dx / d) * f * dt;
      b.vy += (dy / d) * f * dt;
    }
  }

  let k = 1.35;
  for (const s of h.sand) {
    if (Math.hypot(s.x - b.x, s.y - b.y) < s.r) {
      k = 4.4;
      break;
    }
  }
  const damp = Math.exp(-k * dt);
  b.vx *= damp;
  b.vy *= damp;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  for (const r of walls) collideRect(b, r);
}

function predict(g: Game, h: HoleDef, walls: Rect[], v0: Pt): Pt[] {
  const b = { x: g.ball.x, y: g.ball.y, vx: v0.x, vy: v0.y };
  const pts: Pt[] = [];
  for (let i = 0; i < 130; i++) {
    physics(b, h, walls, 1 / 60);
    if (i % 3 === 0) pts.push({ x: b.x, y: b.y });
    if (Math.hypot(b.vx, b.vy) < 26) break;
  }
  return pts;
}

/* ------------------------------ helpers ------------------------------ */

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

function scoreWord(strokes: number, par: number): string {
  const d = strokes - par;
  if (strokes === 1) return "HOLE IN ONE!";
  if (d <= -2) return "EAGLE!";
  if (d === -1) return "BIRDIE!";
  if (d === 0) return "PAR";
  if (d === 1) return "BOGEY";
  if (d === 2) return "DOUBLE BOGEY";
  return `+${d}`;
}

function loadHole(g: Game, idx: number): void {
  const h = HOLES[idx];
  g.hole = idx;
  g.phase = "aim";
  g.strokes = 0;
  g.ball = { ...h.tee, vx: 0, vy: 0 };
  g.rest = { ...h.tee };
  g.aiming = false;
  g.pull = { ...h.tee };
  g.banner = `HOLE ${idx + 1} · PAR ${h.par}`;
  g.bannerT = 1.6;
  g.clearT = 0;
}

function createGame(): Game {
  const g: Game = {
    hole: 0,
    phase: "aim",
    t: 0,
    rollT: 0,
    stopT: 0,
    total: 0,
    strokes: 0,
    ball: { ...HOLES[0].tee, vx: 0, vy: 0 },
    rest: { ...HOLES[0].tee },
    aiming: false,
    pull: { ...HOLES[0].tee },
    clearT: 0,
    clearText: "",
    banner: "",
    bannerT: 0,
    parts: [],
    floats: [],
    shake: 0,
    over: false,
  };
  loadHole(g, 0);
  return g;
}

function shoot(g: Game): void {
  const dx = g.ball.x - g.pull.x;
  const dy = g.ball.y - g.pull.y;
  g.aiming = false;
  const pull = Math.hypot(dx, dy);
  if (pull < 14) return;
  g.ball.vx = dx * PULL_SCALE;
  g.ball.vy = dy * PULL_SCALE;
  g.strokes += 1;
  g.total += 1;
  g.phase = "roll";
  g.rollT = 0;
  g.stopT = 0;
}

function splash(g: Game): void {
  const px = g.ball.x;
  const py = g.ball.y;
  g.total += 1;
  g.strokes += 1;
  g.ball = { ...g.rest, vx: 0, vy: 0 };
  g.phase = "aim";
  g.shake = Math.max(g.shake, 8);
  burst(g, px, py, "#38bdf8", 18, 190);
  floater(g, px, py - 18, "+1 WATER", "#7dd3fc");
}

function sink(g: Game, idx: number): void {
  const h = HOLES[idx];
  g.phase = "clear";
  g.clearT = 1.9;
  g.clearText = `${g.strokes} STROKE${g.strokes === 1 ? "" : "S"} · ${scoreWord(g.strokes, h.par)}`;
  g.ball.vx = 0;
  g.ball.vy = 0;
  g.shake = Math.max(g.shake, 5);
  burst(g, h.cup.x, h.cup.y, "#a7f3d0", 24, 190);
  floater(g, h.cup.x, h.cup.y - 18, scoreWord(g.strokes, h.par), "#ecfdf5");
}

function step(g: Game, dt: number): void {
  g.t += dt;
  g.shake = Math.max(0, g.shake - dt * 26);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 220 * dt;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.15;
    f.y -= 28 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  const h = HOLES[g.hole];
  const walls = [...borders(), ...h.walls, ...moverRects(h, g.t)];

  if (g.phase === "clear") {
    g.clearT -= dt;
    if (g.clearT <= 0) {
      if (g.hole >= HOLES.length - 1) g.over = true;
      else loadHole(g, g.hole + 1);
    }
    return;
  }

  if (g.phase !== "roll") return;

  g.rollT += dt;
  const sub = 3;
  for (let i = 0; i < sub; i++) physics(g.ball, h, walls, dt / sub);

  // hazards
  for (const w of h.water) {
    if (g.ball.x > w.x && g.ball.x < w.x + w.w && g.ball.y > w.y && g.ball.y < w.y + w.h) {
      splash(g);
      return;
    }
  }

  // cup
  const dc = Math.hypot(g.ball.x - h.cup.x, g.ball.y - h.cup.y);
  const speed = Math.hypot(g.ball.vx, g.ball.vy);
  if (dc < CUP_R && speed < 175) {
    sink(g, g.hole);
    return;
  }

  if (speed < 9) g.stopT += dt;
  else g.stopT = 0;
  if ((g.stopT > 0.14 && g.rollT > 0.25) || g.rollT > 11) {
    g.ball.vx = 0;
    g.ball.vy = 0;
    g.rest = { ...g.ball };
    g.phase = "aim";
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

  // felt
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#073323");
  bg.addColorStop(1, "#05261b");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  const h = HOLES[g ? g.hole : 0];
  const t = g ? g.t : 0;

  ctx.save();
  ctx.beginPath();
  ctx.rect(M, M, W - M * 2, H - M * 2);
  ctx.clip();

  // mow stripes
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(16, 185, 129, 0.05)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(M + i * 48, M, 48, H - M * 2);
  }
  // speckle
  ctx.fillStyle = "rgba(110, 231, 183, 0.16)";
  for (let i = 0; i < 90; i++) {
    const px = M + ((i * 71) % (W - M * 2));
    const py = M + ((i * 47) % (H - M * 2));
    ctx.fillRect(px, py, 1.6, 1.6);
  }

  // water
  for (const w of h.water) {
    ctx.fillStyle = "rgba(14, 116, 144, 0.75)";
    ctx.beginPath();
    ctx.roundRect(w.x, w.y, w.w, w.h, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(125, 211, 252, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(186, 230, 252, 0.35)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const yy = w.y + 14 + i * 22 + Math.sin(time / 500 + i) * 4;
      ctx.beginPath();
      for (let x = w.x; x <= w.x + w.w; x += 12) {
        const y = yy + Math.sin(x / 22 + time / 300 + i) * 3;
        if (x === w.x) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // sand
  for (const s of h.sand) {
    ctx.fillStyle = "rgba(202, 176, 118, 0.85)";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(146, 118, 62, 0.5)";
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(a * 3) * s.r * 0.55, s.y + Math.sin(a * 2) * s.r * 0.5, 2, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(254, 243, 199, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.stroke();
  }

  // slope wells
  for (const wl of h.wells) {
    const inward = wl.s > 0;
    ctx.save();
    ctx.translate(wl.x, wl.y);
    const grd = ctx.createRadialGradient(0, 0, 4, 0, 0, wl.r);
    grd.addColorStop(0, inward ? "rgba(52, 211, 153, 0.4)" : "rgba(244, 114, 182, 0.32)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, wl.r, 0, TAU);
    ctx.fill();
    ctx.rotate(t * (inward ? 1 : -1));
    ctx.setLineDash([10, 12]);
    ctx.strokeStyle = inward ? "rgba(52, 211, 153, 0.6)" : "rgba(244, 114, 182, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, wl.r * 0.6, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, wl.r * 0.3, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.fillStyle = inward ? "rgba(167, 243, 208, 0.85)" : "rgba(251, 207, 232, 0.85)";
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(inward ? "SLOPE" : "KICK", wl.x, wl.y + 4);
  }

  // banks / walls
  for (const r of [...borders(), ...h.walls]) {
    ctx.save();
    ctx.shadowColor = "rgba(52, 211, 153, 0.75)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#065f46";
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(110, 231, 183, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // movers
  for (const m of h.movers) {
    const mr = { x: m.ox + m.ax * Math.sin(t * m.sp + m.ph), y: m.oy + m.ay * Math.sin(t * m.sp + m.ph), w: m.w, h: m.h };
    ctx.strokeStyle = "rgba(244, 114, 182, 0.3)";
    ctx.setLineDash([5, 7]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (m.ax !== 0) {
      ctx.moveTo(m.ox - Math.abs(m.ax) - m.w, m.oy + m.h / 2);
      ctx.lineTo(m.ox + Math.abs(m.ax) + m.w, m.oy + m.h / 2);
    } else {
      ctx.moveTo(m.ox + m.w / 2, m.oy - Math.abs(m.ay) - m.h);
      ctx.lineTo(m.ox + m.w / 2, m.oy + Math.abs(m.ay) + m.h);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.shadowColor = "#f472b6";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#db2777";
    ctx.beginPath();
    ctx.roundRect(mr.x, mr.y, mr.w, mr.h, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fbcfe8";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // cup + flag
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#020c09";
  ctx.beginPath();
  ctx.arc(h.cup.x, h.cup.y, CUP_R, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(226, 232, 240, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(h.cup.x, h.cup.y);
  ctx.lineTo(h.cup.x, h.cup.y - 44);
  ctx.stroke();
  ctx.fillStyle = "#f43f5e";
  ctx.beginPath();
  ctx.moveTo(h.cup.x, h.cup.y - 44);
  ctx.lineTo(h.cup.x + 26, h.cup.y - 36 + Math.sin(time / 400) * 2);
  ctx.lineTo(h.cup.x, h.cup.y - 28);
  ctx.closePath();
  ctx.fill();

  // tee
  ctx.strokeStyle = "rgba(167, 243, 208, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(h.tee.x, h.tee.y, 12, 0, TAU);
  ctx.stroke();

  if (g) {
    // aim preview
    if (g.phase === "aim" && g.aiming) {
      const dx = g.ball.x - g.pull.x;
      const dy = g.ball.y - g.pull.y;
      const pull = Math.hypot(dx, dy);
      if (pull > 6) {
        const pts = predict(g, h, [...borders(), ...h.walls, ...moverRects(h, g.t)], {
          x: dx * PULL_SCALE,
          y: dy * PULL_SCALE,
        });
        for (let i = 0; i < pts.length; i++) {
          const k = i / pts.length;
          ctx.globalAlpha = 0.18 + (1 - k) * 0.75;
          ctx.fillStyle = "#ecfdf5";
          ctx.beginPath();
          ctx.arc(pts[i].x, pts[i].y, Math.max(1.6, 4 - k * 2.4), 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(236, 253, 245, 0.7)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(g.ball.x, g.ball.y);
        ctx.lineTo(g.pull.x, g.pull.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // power ring
        const frac = Math.min(1, pull / MAX_PULL);
        ctx.strokeStyle = frac > 0.92 ? "#fbbf24" : "#a7f3d0";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(g.ball.x, g.ball.y, 18, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
        ctx.stroke();
      }
    }

    // ball
    if (g.phase !== "clear") {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(g.ball.x, g.ball.y, BALL_R, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
      ctx.beginPath();
      ctx.arc(g.ball.x + 2, g.ball.y - 2, 1.6, 0, TAU);
      ctx.fill();
      if (g.phase === "aim" && !g.aiming) {
        ctx.strokeStyle = `rgba(167, 243, 208, ${0.4 + Math.sin(time / 240) * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.ball.x, g.ball.y, 13, 0, TAU);
        ctx.stroke();
      }
    }

    // particles
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // floaters
    ctx.textAlign = "center";
    ctx.font = "800 15px ui-monospace, monospace";
    for (const f of g.floats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // hole / stroke readout
    ctx.textAlign = "left";
    ctx.font = "700 13px ui-monospace, monospace";
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.fillText(`HOLE ${g.hole + 1}/${HOLES.length} · PAR ${h.par}`, M + 12, M + 22);
    ctx.fillStyle = "#a7f3d0";
    ctx.fillText(`${g.strokes} STROKE${g.strokes === 1 ? "" : "S"} · TOTAL ${g.total}`, M + 12, M + 42);

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.4);
      ctx.font = "800 26px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(52, 211, 153, 0.9)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 40);
      ctx.restore();
    }

    // clear card
    if (g.phase === "clear") {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.clearT);
      ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 170, H / 2 - 54, 340, 92, 16);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.font = "800 22px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#ecfdf5";
      ctx.fillText(`HOLE ${g.hole + 1} CLEARED`, W / 2, H / 2 - 22);
      ctx.font = "700 15px ui-monospace, monospace";
      ctx.fillStyle = "#a7f3d0";
      ctx.fillText(g.clearText, W / 2, H / 2 + 10);
      ctx.font = "600 12px ui-monospace, monospace";
      ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
      ctx.fillText(`TOTAL ${g.total} STROKES`, W / 2, H / 2 + 28);
      ctx.restore();
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function PuttMaster({ gameId = "putt-master" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [total, setTotal] = useState(0);
  const [hole, setHole] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "low");

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
    setTotal(0);
    setHole(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastTotal = -1;
    let lastHole = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      if (g.total !== lastTotal) {
        lastTotal = g.total;
        setTotal(g.total);
      }
      if (g.hole !== lastHole) {
        lastHole = g.hole;
        setHole(g.hole + 1);
      }

      draw(t);
      if (g.over) {
        setTotal(g.total);
        setHole(g.hole + 1);
        setNewBest(submit(g.total));
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

  const toCanvas = (clientX: number, clientY: number, el: HTMLCanvasElement): Pt => {
    const rect = el.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[620px]">
      <GameHud score={total} best={best ?? "—"} accent="text-teal-300">
        <span className="text-emerald-300">
          Hole <b className="ml-1 text-sm text-ink">{hole}/9</b>
        </span>
        <span className="text-green-300">
          Par <b className="ml-1 text-sm text-ink">{HOLES[Math.min(8, hole - 1)].par}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(16,185,129,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Putt Master golf green"
          onPointerDown={(e) => {
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g || g.phase !== "aim") return;
            const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
            if (Math.hypot(p.x - g.ball.x, p.y - g.ball.y) > 54) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            g.aiming = true;
            g.pull = p;
          }}
          onPointerMove={(e) => {
            const g = gameRef.current;
            if (!g?.aiming) return;
            const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
            const dx = p.x - g.ball.x;
            const dy = p.y - g.ball.y;
            const d = Math.hypot(dx, dy);
            const c = d > MAX_PULL ? MAX_PULL : d;
            g.pull =
              d > 0.001
                ? { x: g.ball.x + (dx / d) * c, y: g.ball.y + (dy / d) * c }
                : { x: g.ball.x, y: g.ball.y };
          }}
          onPointerUp={() => {
            const g = gameRef.current;
            if (g?.aiming && g.phase === "aim") shoot(g);
          }}
          onPointerCancel={() => {
            const g = gameRef.current;
            if (g?.aiming && g.phase === "aim") {
              g.aiming = false;
            }
          }}
        />

        {status === "playing" && (
          <p className="pointer-events-none absolute right-3 top-12 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            Drag back from the ball · release to putt
          </p>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">PUTT MASTER</p>
            <p className="mt-2 text-sm text-muted">
              Nine holes of neon green: pull back from the ball to set line and power, then trust
              the read. Slopes bend the putt mid-roll, sand drags it short, water eats a stroke,
              and the last holes swing moving gates across your path. Par or better and the score
              stays low.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Tee off
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Mouse or finger: drag back, release · 9 holes · lowest total wins
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-emerald-300">COURSE CLEARED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{total}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Total strokes · Best {best ?? "—"} · 9 holes
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Bank off the neon rails — the wall is your friend
            </p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Green slope pulls · pink kicker shoves · sand is glue, water is a stroke
      </p>
    </div>
  );
}
