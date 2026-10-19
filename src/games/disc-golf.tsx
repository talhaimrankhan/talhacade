"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 620;
const H = 440;
const TAU = Math.PI * 2;
const TONE = "from-teal-400 via-emerald-500 to-green-600";
const DR = 8; // disc radius
const MAX_PULL = 125;
const PULL_SCALE = 2.9;
const BASE_FADE = 0.45; // natural late fade (left) for a flat release
const TURN_K = 1.2; // spin shifts the fade — hyzer left, anhyzer right
const AIR_K = 0.5; // air drag
const ROUGH_K = 1.7; // rough drag
const REST_V = 26;

type Status = "idle" | "playing" | "over";
type Phase = "aim" | "flight" | "clear";

interface Pt {
  x: number;
  y: number;
}
interface Disc {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
}
interface Tree {
  x: number;
  y: number;
  r: number;
}
interface Rough {
  x: number;
  y: number;
  r: number;
}
interface Hole {
  par: number;
  tee: Pt;
  basket: Pt;
  trees: Tree[];
  rough: Rough[];
  wind: Pt;
}
interface Particle {
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
  hole: number;
  phase: Phase;
  t: number;
  flightT: number;
  stopT: number;
  spin: number;
  disc: Disc;
  rest: Pt;
  aiming: boolean;
  pull: Pt;
  strokes: number;
  total: number;
  clearT: number;
  clearText: string;
  banner: string;
  bannerT: number;
  parts: Particle[];
  floats: Floater[];
  shake: number;
  over: boolean;
}

/* ------------------------------ course ------------------------------ */

const HOLES: Hole[] = [
  {
    // 1 — straight opener framed by two trunks
    par: 3,
    tee: { x: 82, y: 220 },
    basket: { x: 540, y: 220 },
    trees: [
      { x: 300, y: 148, r: 17 },
      { x: 300, y: 292, r: 17 },
    ],
    rough: [],
    wind: { x: 0, y: 0 },
  },
  {
    // 2 — dogleg up the right
    par: 3,
    tee: { x: 92, y: 352 },
    basket: { x: 522, y: 92 },
    trees: [
      { x: 300, y: 268, r: 20 },
      { x: 392, y: 158, r: 17 },
    ],
    rough: [],
    wind: { x: -14, y: 10 },
  },
  {
    // 3 — guarded green with a rough belt
    par: 3,
    tee: { x: 82, y: 220 },
    basket: { x: 536, y: 220 },
    trees: [
      { x: 300, y: 220, r: 22 },
      { x: 462, y: 172, r: 18 },
      { x: 462, y: 268, r: 18 },
    ],
    rough: [{ x: 392, y: 220, r: 52 }],
    wind: { x: 0, y: -16 },
  },
  {
    // 4 — long diagonal through a headwind
    par: 4,
    tee: { x: 84, y: 84 },
    basket: { x: 540, y: 358 },
    trees: [
      { x: 244, y: 182, r: 18 },
      { x: 386, y: 262, r: 18 },
    ],
    rough: [{ x: 196, y: 322, r: 58 }],
    wind: { x: 22, y: 26 },
  },
  {
    // 5 — tunnel shot, no wind
    par: 3,
    tee: { x: 82, y: 220 },
    basket: { x: 548, y: 220 },
    trees: [
      { x: 224, y: 116, r: 16 },
      { x: 224, y: 324, r: 16 },
      { x: 334, y: 142, r: 16 },
      { x: 334, y: 298, r: 16 },
      { x: 444, y: 118, r: 16 },
      { x: 444, y: 322, r: 16 },
    ],
    rough: [],
    wind: { x: 0, y: 0 },
  },
  {
    // 6 — crosswind climb
    par: 4,
    tee: { x: 84, y: 358 },
    basket: { x: 548, y: 92 },
    trees: [
      { x: 262, y: 240, r: 18 },
      { x: 424, y: 176, r: 16 },
    ],
    rough: [{ x: 340, y: 330, r: 54 }],
    wind: { x: 26, y: -18 },
  },
  {
    // 7 — island green ringed in timber
    par: 3,
    tee: { x: 82, y: 220 },
    basket: { x: 498, y: 220 },
    trees: [
      { x: 432, y: 158, r: 16 },
      { x: 432, y: 282, r: 16 },
      { x: 566, y: 160, r: 15 },
      { x: 566, y: 280, r: 15 },
    ],
    rough: [{ x: 498, y: 220, r: 46 }],
    wind: { x: -18, y: 0 },
  },
  {
    // 8 — S-bend through the woods
    par: 4,
    tee: { x: 84, y: 356 },
    basket: { x: 542, y: 84 },
    trees: [
      { x: 204, y: 238, r: 20 },
      { x: 356, y: 118, r: 18 },
      { x: 356, y: 342, r: 18 },
    ],
    rough: [{ x: 434, y: 222, r: 50 }],
    wind: { x: 10, y: -22 },
  },
  {
    // 9 — bomber finish into a headwind
    par: 5,
    tee: { x: 74, y: 382 },
    basket: { x: 556, y: 74 },
    trees: [
      { x: 198, y: 262, r: 18 },
      { x: 306, y: 152, r: 18 },
      { x: 424, y: 258, r: 18 },
      { x: 486, y: 148, r: 16 },
    ],
    rough: [{ x: 260, y: 356, r: 50 }],
    wind: { x: -16, y: 14 },
  },
];

const PAR_TOTAL = HOLES.reduce((s, h) => s + h.par, 0);

/* ------------------------------ helpers ------------------------------ */

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
}

function burst(g: Game, x: number, y: number, c: string, n: number, power: number): void {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * TAU;
    const sp = power * (0.35 + Math.random() * 0.65);
    g.parts.push({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: 0.35 + Math.random() * 0.4,
      max: 0.75,
      r: 1.4 + Math.random() * 2.2,
      c,
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

/* ------------------------------ flight ------------------------------ */

/** One flight substep. Returns "tree" when a trunk is clipped. */
function advance(disc: Disc, h: Hole, dt: number): "tree" | "" {
  const inRough = h.rough.some((r) => Math.hypot(disc.x - r.x, disc.y - r.y) < r.r);
  const k = inRough ? ROUGH_K : AIR_K;

  disc.vx += h.wind.x * (inRough ? 0.4 : 1) * dt;
  disc.vy += h.wind.y * (inRough ? 0.4 : 1) * dt;

  // fade — the slower the disc turns, and spin shifts which way
  const v = Math.hypot(disc.vx, disc.vy);
  const f = Math.max(0, Math.min(1, 1 - v / 220));
  const turn = (BASE_FADE - disc.spin * TURN_K) * f;
  const ang = -turn * dt;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const nvx = disc.vx * cos - disc.vy * sin;
  const nvy = disc.vx * sin + disc.vy * cos;
  disc.vx = nvx;
  disc.vy = nvy;

  const damp = Math.exp(-k * dt);
  disc.vx *= damp;
  disc.vy *= damp;
  disc.x += disc.vx * dt;
  disc.y += disc.vy * dt;

  let hitTree: "" | "tree" = "";
  for (const tr of h.trees) {
    const dx = disc.x - tr.x;
    const dy = disc.y - tr.y;
    const d = Math.hypot(dx, dy);
    if (d < tr.r + DR && d > 0.001) {
      const nx = dx / d;
      const ny = dy / d;
      disc.x = tr.x + nx * (tr.r + DR);
      disc.y = tr.y + ny * (tr.r + DR);
      const vn = disc.vx * nx + disc.vy * ny;
      if (vn < 0) {
        disc.vx -= 1.55 * vn * nx;
        disc.vy -= 1.55 * vn * ny;
        disc.vx *= 0.45;
        disc.vy *= 0.45;
      }
      hitTree = "tree";
    }
  }

  if (disc.x < 14) {
    disc.x = 14;
    disc.vx = Math.abs(disc.vx) * 0.4;
    disc.vy *= 0.7;
  } else if (disc.x > W - 14) {
    disc.x = W - 14;
    disc.vx = -Math.abs(disc.vx) * 0.4;
    disc.vy *= 0.7;
  }
  if (disc.y < 14) {
    disc.y = 14;
    disc.vy = Math.abs(disc.vy) * 0.4;
    disc.vx *= 0.7;
  } else if (disc.y > H - 14) {
    disc.y = H - 14;
    disc.vy = -Math.abs(disc.vy) * 0.4;
    disc.vx *= 0.7;
  }

  return hitTree;
}

function predict(disc: Disc, h: Hole): Pt[] {
  const d: Disc = { ...disc };
  const pts: Pt[] = [];
  for (let i = 0; i < 600; i++) {
    if (Math.hypot(d.vx, d.vy) < REST_V) break;
    advance(d, h, 1 / 60);
    if (i % 6 === 0) pts.push({ x: d.x, y: d.y });
  }
  pts.push({ x: d.x, y: d.y });
  return pts;
}

/* ------------------------------ flow ------------------------------ */

function loadHole(g: Game, idx: number): void {
  const h = HOLES[idx];
  g.hole = idx;
  g.phase = "aim";
  g.strokes = 0;
  g.disc = { x: h.tee.x, y: h.tee.y, vx: 0, vy: 0, spin: g.spin };
  g.rest = { ...h.tee };
  g.aiming = false;
  g.pull = { ...h.tee };
  g.flightT = 0;
  g.stopT = 0;
  g.banner = `HOLE ${idx + 1} · PAR ${h.par}${h.wind.x || h.wind.y ? " · WIND" : ""}`;
  g.bannerT = 1.8;
  g.clearT = 0;
}

function createGame(): Game {
  const g: Game = {
    hole: 0,
    phase: "aim",
    t: 0,
    flightT: 0,
    stopT: 0,
    spin: 0,
    disc: { ...HOLES[0].tee, vx: 0, vy: 0, spin: 0 },
    rest: { ...HOLES[0].tee },
    aiming: false,
    pull: { ...HOLES[0].tee },
    strokes: 0,
    total: 0,
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

function throwDisc(g: Game): void {
  const dx = g.disc.x - g.pull.x;
  const dy = g.disc.y - g.pull.y;
  const pull = Math.hypot(dx, dy);
  g.aiming = false;
  if (pull < 14) return;
  g.disc.vx = dx * PULL_SCALE;
  g.disc.vy = dy * PULL_SCALE;
  g.disc.spin = g.spin;
  g.strokes += 1;
  g.total += 1;
  g.phase = "flight";
  g.flightT = 0;
  g.stopT = 0;
  burst(g, g.disc.x, g.disc.y, "#a7f3d0", 8, 110);
}

function holeOut(g: Game): void {
  const h = HOLES[g.hole];
  g.phase = "clear";
  g.clearT = 1.9;
  g.clearText = `${g.strokes} THROW${g.strokes === 1 ? "" : "S"} · ${scoreWord(g.strokes, h.par)}`;
  g.disc.vx = 0;
  g.disc.vy = 0;
  g.disc.x = h.basket.x;
  g.disc.y = h.basket.y;
  g.shake = Math.max(g.shake, 6);
  burst(g, h.basket.x, h.basket.y, "#6ee7b7", 26, 200);
  floater(g, h.basket.x, h.basket.y - 20, scoreWord(g.strokes, h.par), "#ecfdf5");
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

  if (g.phase === "clear") {
    g.clearT -= dt;
    if (g.clearT <= 0) {
      if (g.hole >= HOLES.length - 1) g.over = true;
      else loadHole(g, g.hole + 1);
    }
    return;
  }

  if (g.phase !== "flight") return;

  const h = HOLES[g.hole];
  g.flightT += dt;

  // gentle grab inside circle range so slow bids don't lips-out cruelly
  const dbx = h.basket.x - g.disc.x;
  const dby = h.basket.y - g.disc.y;
  const db = Math.hypot(dbx, dby) || 1;
  const dv = Math.hypot(g.disc.vx, g.disc.vy);
  if (db < 46 && dv < 90) {
    g.disc.vx += (dbx / db) * 150 * dt;
    g.disc.vy += (dby / db) * 150 * dt;
  }

  const sub = 3;
  for (let i = 0; i < sub; i++) {
    const ev = advance(g.disc, h, dt / sub);
    if (ev === "tree") {
      g.shake = Math.max(g.shake, 6);
      burst(g, g.disc.x, g.disc.y, "#86efac", 12, 150);
      floater(g, g.disc.x, g.disc.y - 16, "TREE!", "#bbf7d0");
    }
  }

  if (db < 16 && Math.hypot(g.disc.vx, g.disc.vy) < 175) {
    holeOut(g);
    return;
  }

  const v = Math.hypot(g.disc.vx, g.disc.vy);
  if (v < REST_V) g.stopT += dt;
  else g.stopT = 0;
  if ((g.stopT > 0.2 && g.flightT > 0.35) || g.flightT > 12) {
    g.disc.vx = 0;
    g.disc.vy = 0;
    g.rest = { x: g.disc.x, y: g.disc.y };
    g.phase = "aim";
  }
}

/* ------------------------------ render ------------------------------ */

function drawHole(ctx: CanvasRenderingContext2D, h: Hole, time: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#04231a");
  bg.addColorStop(0.55, "#062b1f");
  bg.addColorStop(1, "#031a13");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // fairway mow stripes
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(16, 185, 129, 0.05)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(14 + i * 50, 14, 50, H - 28);
  }
  ctx.fillStyle = "rgba(110, 231, 183, 0.12)";
  for (let i = 0; i < 100; i++) {
    const px = 16 + ((i * 67) % (W - 32));
    const py = 16 + ((i * 41) % (H - 32));
    ctx.fillRect(px, py, 1.5, 1.5);
  }

  // rough patches
  for (const r of h.rough) {
    ctx.fillStyle = "rgba(101, 76, 32, 0.5)";
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 140, 80, 0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // wind arrows
  if (h.wind.x || h.wind.y) {
    const wm = Math.hypot(h.wind.x, h.wind.y);
    ctx.save();
    ctx.strokeStyle = "rgba(165, 243, 252, 0.35)";
    ctx.fillStyle = "rgba(165, 243, 252, 0.5)";
    ctx.lineWidth = 2;
    const ang = Math.atan2(h.wind.y, h.wind.x);
    for (let i = 0; i < 5; i++) {
      const px = 80 + i * 118 + ((time / 26) % 118);
      const py = 40 + ((i * 79) % (H - 90));
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-10 - wm * 0.1, 0);
      ctx.lineTo(10 + wm * 0.1, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(12 + wm * 0.1, 0);
      ctx.lineTo(6 + wm * 0.1, -4);
      ctx.lineTo(6 + wm * 0.1, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // basket
  const bx = h.basket.x;
  const by = h.basket.y;
  const pulse = 0.6 + Math.sin(time / 380) * 0.35;
  ctx.save();
  ctx.shadowColor = `rgba(52, 211, 196, ${pulse})`;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = "#5eead4";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(bx, by, 13, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx, by - 46);
  ctx.stroke();
  // chain cage
  ctx.strokeStyle = "rgba(165, 243, 252, 0.8)";
  ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(bx + i * 5, by - 44 + Math.abs(i) * 3);
    ctx.lineTo(bx + i * 4, by - 10);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#022c22";
  ctx.beginPath();
  ctx.arc(bx, by, 12, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(94, 234, 212, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(bx, by, 12, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "#f0fdfa";
  ctx.font = "800 10px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`PAR ${h.par}`, bx, by + 26);

  // tee pad
  ctx.fillStyle = "rgba(45, 212, 191, 0.25)";
  ctx.beginPath();
  ctx.roundRect(h.tee.x - 16, h.tee.y - 10, 32, 20, 5);
  ctx.fill();
  ctx.strokeStyle = "rgba(94, 234, 212, 0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // trees
  for (const t of h.trees) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(t.x + 3, t.y + 6, t.r, t.r * 0.7, 0, 0, TAU);
    ctx.fill();
    const grd = ctx.createRadialGradient(t.x - 4, t.y - 5, 2, t.x, t.y, t.r);
    grd.addColorStop(0, "#34d399");
    grd.addColorStop(1, "#065f46");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(167, 243, 208, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  drawHole(ctx, HOLES[g ? g.hole : 0], time);

  if (g) {
    const h = HOLES[g.hole];

    // aim preview
    if (g.phase === "aim" && g.aiming) {
      const dx = g.disc.x - g.pull.x;
      const dy = g.disc.y - g.pull.y;
      const pull = Math.min(MAX_PULL, Math.hypot(dx, dy));
      if (pull > 8) {
        const pts = predict(
          {
            x: g.disc.x,
            y: g.disc.y,
            vx: dx * PULL_SCALE,
            vy: dy * PULL_SCALE,
            spin: g.spin,
          },
          h,
        );
        for (let i = 0; i < pts.length; i++) {
          const k = i / pts.length;
          ctx.globalAlpha = 0.2 + (1 - k) * 0.8;
          ctx.fillStyle = "#ecfdf5";
          ctx.beginPath();
          ctx.arc(pts[i].x, pts[i].y, Math.max(1.4, 3.6 - k * 2.2), 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        const stop = pts[pts.length - 1];
        ctx.strokeStyle = "rgba(236, 253, 245, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(stop.x, stop.y, 8, 0, TAU);
        ctx.stroke();

        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = "rgba(148, 163, 184, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(g.disc.x, g.disc.y);
        ctx.lineTo(g.pull.x, g.pull.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const frac = pull / MAX_PULL;
        ctx.strokeStyle = frac > 0.92 ? "#fbbf24" : "#5eead4";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(g.disc.x, g.disc.y, 16, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
        ctx.stroke();
      }
    }

    // disc
    ctx.save();
    ctx.shadowColor = "rgba(94, 234, 212, 0.9)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.ellipse(g.disc.x, g.disc.y, DR, DR * 0.55, g.disc.spin * 0.7, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(13, 148, 136, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(g.disc.x, g.disc.y, DR - 2, DR * 0.4, g.disc.spin * 0.7, 0, TAU);
    ctx.stroke();

    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // top HUD
    ctx.fillStyle = "rgba(2, 6, 23, 0.6)";
    ctx.beginPath();
    ctx.roundRect(14, 14, 224, 42, 10);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.font = "800 13px ui-monospace, monospace";
    ctx.fillStyle = "#a7f3d0";
    ctx.fillText(`HOLE ${g.hole + 1}/9`, 26, 33);
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    const vsPar = g.total - PAR_TOTAL + (PAR_TOTAL - HOLES.slice(0, g.hole).reduce((s, x) => s + x.par, 0));
    ctx.fillText(
      `${g.strokes} throw${g.strokes === 1 ? "" : "s"} · round ${g.total} · par ${HOLES[g.hole].par}`,
      92,
      33,
    );
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`round vs par ${vsPar > 0 ? `+${vsPar}` : String(vsPar)}`, 26, 49);

    // wind chip
    if (h.wind.x || h.wind.y) {
      const wm = Math.round(Math.hypot(h.wind.x, h.wind.y) / 6);
      ctx.fillStyle = "rgba(2, 6, 23, 0.6)";
      ctx.beginPath();
      ctx.roundRect(W - 138, 14, 124, 30, 10);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.font = "700 11px ui-monospace, monospace";
      ctx.fillStyle = "#a5f3fc";
      ctx.fillText(`WIND ${wm} ${h.wind.x > 2 ? "→" : h.wind.x < -2 ? "←" : h.wind.y < 0 ? "↑" : "↓"}`, W - 76, 33);
    }

    ctx.textAlign = "center";
    ctx.font = "800 15px ui-monospace, monospace";
    for (const f of g.floats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.4);
      ctx.font = "800 26px ui-sans-serif, system-ui, sans-serif";
      ctx.shadowColor = "rgba(45, 212, 191, 0.9)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 30);
      ctx.restore();
    }

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
      ctx.fillStyle = "#6ee7b7";
      ctx.fillText(g.clearText, W / 2, H / 2 + 10);
      ctx.font = "600 12px ui-monospace, monospace";
      ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
      ctx.fillText(`ROUND ${g.total} THROWS`, W / 2, H / 2 + 28);
      ctx.restore();
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

function toCanvas(clientX: number, clientY: number, el: HTMLCanvasElement): Pt {
  const rect = el.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * W,
    y: ((clientY - rect.top) / rect.height) * H,
  };
}

export default function DiscGolf({ gameId = "disc-golf" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const dialRef = useRef<HTMLDivElement | null>(null);
  const dialing = useRef(false);
  const [status, setStatus] = useState<Status>("idle");
  const [total, setTotal] = useState(0);
  const [hole, setHole] = useState(1);
  const [spin, setSpin] = useState(0);
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

  const applySpin = (v: number) => {
    const c = Math.max(-1, Math.min(1, v));
    const snapped = Math.round(c * 4) / 4;
    setSpin(snapped);
    const g = gameRef.current;
    if (g) g.spin = snapped;
  };

  const dialFrom = (clientX: number, clientY: number, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, Math.atan2(dx, -dy)));
    applySpin(ang / (Math.PI / 2));
  };

  const spinLabel = spin <= -0.25 ? "HYZER" : spin >= 0.25 ? "ANHYZER" : "FLAT";

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
          aria-label="Disc Golf fairway"
          onPointerDown={(e) => {
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g || g.phase !== "aim") return;
            const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
            if (Math.hypot(p.x - g.disc.x, p.y - g.disc.y) > 52) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            g.aiming = true;
            g.pull = p;
          }}
          onPointerMove={(e) => {
            const g = gameRef.current;
            if (!g?.aiming) return;
            const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
            const dx = p.x - g.disc.x;
            const dy = p.y - g.disc.y;
            const d = Math.hypot(dx, dy);
            const c = Math.min(MAX_PULL, d);
            g.pull =
              d > 0.001
                ? { x: g.disc.x + (dx / d) * c, y: g.disc.y + (dy / d) * c }
                : { x: g.disc.x, y: g.disc.y };
          }}
          onPointerUp={() => {
            const g = gameRef.current;
            if (g?.aiming && g.phase === "aim") throwDisc(g);
          }}
          onPointerCancel={() => {
            const g = gameRef.current;
            if (g) g.aiming = false;
          }}
        />

        {status === "playing" && (
          <p className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            Drag back from the disc · release to throw
          </p>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">DISC GOLF</p>
            <p className="mt-2 text-sm text-muted">
              Nine holes through neon pines. Drag back from the disc to set line and power, spin the
              dial for hyzer or anhyzer, and watch the flight preview — every disc fades as it
              slows. Trunks kick your line, rough eats your glide, and the wind moves each hole.
              Finish the round under par.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Tee off
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Drag-aim + release · spin dial shapes the fade · 9 holes</p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-emerald-300">ROUND COMPLETE</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best round!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{total}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Throws · par {PAR_TOTAL} · best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              {total <= PAR_TOTAL ? "Under par — the woods behaved" : "Trust the fade, miss the trunks"}
            </p>
          </Overlay>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div
          ref={dialRef}
          role="slider"
          tabIndex={0}
          aria-label="Disc spin dial — hyzer to anhyzer"
          aria-valuemin={-1}
          aria-valuemax={1}
          aria-valuenow={spin}
          aria-valuetext={spinLabel}
          className="relative h-[76px] w-[76px] shrink-0 cursor-grab touch-none rounded-full border border-line bg-surface shadow-inner active:cursor-grabbing"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dialing.current = true;
            dialFrom(e.clientX, e.clientY, e.currentTarget);
          }}
          onPointerMove={(e) => {
            if (!dialing.current) return;
            dialFrom(e.clientX, e.clientY, e.currentTarget);
          }}
          onPointerUp={() => {
            dialing.current = false;
          }}
          onPointerCancel={() => {
            dialing.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              applySpin(spin - 0.25);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              applySpin(spin + 0.25);
            }
          }}
        >
          <span className="absolute inset-2 rounded-full border border-dashed border-muted/40" />
          <span className="absolute inset-0 grid place-items-center">
            <span
              className="block h-[30px] w-[3px] origin-bottom rounded-full bg-teal-300 shadow-[0_0_8px_rgba(45,212,191,0.9)]"
              style={{ transform: `translateY(-13px) rotate(${spin * 60}deg)` }}
            />
          </span>
          <span className="absolute left-1/2 top-1.5 -translate-x-1/2 text-[8px] font-bold text-muted">
            H
          </span>
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-muted">
            A
          </span>
        </div>
        <div className="flex-1">
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            Spin dial <b className="text-sm text-ink">{spinLabel}</b>
          </p>
          <p className="mt-1 text-xs text-muted">
            Hyzer fades left late, anhyzer turns right. Drag the dial or use ← → — the preview line
            already accounts for it.
          </p>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Trees kick · rough grabs · wind pushes every flight
      </p>
    </div>
  );
}
