"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 520;
const H = 460;
const TAU = Math.PI * 2;

const GOAL_L = 76;
const GOAL_R = 444;
const GOAL_TOP = 70;
const GOAL_BOT = 206;
const GOAL_CX = (GOAL_L + GOAL_R) / 2;
const TONE = "from-emerald-400 via-teal-500 to-cyan-600";

type Status = "idle" | "playing" | "over";
type Phase = "ready" | "runup" | "flight" | "result";

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
  phaseT: number;
  time: number;
  saves: number;
  goals: number;
  tier: number;
  over: boolean;
  // shooter
  sx: number;
  sy: number;
  face: number;
  runK: number;
  // shot
  from: Pt;
  to: Pt;
  ball: Pt;
  t: number;
  dur: number;
  releaseAt: number;
  trail: Pt[];
  // keeper
  dive: number;
  diveAt: number;
  keeperX: number;
  keeperTX: number;
  window: number;
  // outcome
  outcome: string;
  good: boolean;
  fail: boolean;
  resultT: number;
  // juice
  parts: Part[];
  floats: Floater[];
  shake: number;
  flash: number;
  flashC: string;
  banner: string;
  bannerT: number;
}

function toCanvas(clientX: number, clientY: number, el: HTMLCanvasElement): Pt {
  const rect = el.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * W,
    y: ((clientY - rect.top) / rect.height) * H,
  };
}

function sideOf(x: number): number {
  const third = (GOAL_R - GOAL_L) / 3;
  if (x < GOAL_L + third) return 0;
  if (x < GOAL_L + third * 2) return 1;
  return 2;
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

/* ------------------------------ flow ------------------------------ */

function nextShooter(g: Game): void {
  const flank = Math.random();
  g.sx = flank < 0.34 ? 132 + Math.random() * 60 : flank < 0.67 ? W - 132 - Math.random() * 60 : GOAL_CX + (Math.random() - 0.5) * 90;
  g.sy = 352 + Math.random() * 66;
  g.face = Math.random() < 0.5 ? -1 : 1;
  g.runK = 0;
  g.dive = 0;
  g.diveAt = -999;
  g.keeperX = GOAL_CX;
  g.keeperTX = GOAL_CX;
  g.trail = [];
  g.phase = "ready";
  g.phaseT = Math.max(0.4, 0.95 - g.tier * 0.04) + Math.random() * 0.35;
}

function release(g: Game): void {
  const tier = g.tier;
  const dist = Math.hypot(g.sx - GOAL_CX, g.sy - GOAL_BOT);
  const distK = Math.max(0.8, Math.min(1.3, dist / 250));
  g.dur = Math.max(0.26, (0.58 - tier * 0.028)) * distK;
  g.window = Math.max(0.09, 0.3 - tier * 0.022);

  // corners get more common as the tiers climb
  const centreP = Math.max(0.1, 0.32 - tier * 0.03);
  const roll = Math.random();
  const side = roll < centreP ? 1 : Math.random() < 0.5 ? 0 : 2;
  const power = 0.65 + Math.random() * Math.min(0.35, 0.15 + tier * 0.03);
  const spread = 34 - Math.min(16, tier * 1.6);
  const tx = side === 1 ? GOAL_CX + (Math.random() - 0.5) * spread : side === 0 ? GOAL_L + 22 + Math.random() * (GOAL_R - GOAL_L) / 3 - 30 : GOAL_R - 22 - Math.random() * ((GOAL_R - GOAL_L) / 3 - 30);
  const ty = GOAL_TOP + 16 + Math.random() * (GOAL_BOT - GOAL_TOP - 30) - (side !== 1 ? power * 14 : 0);

  g.from = { x: g.sx, y: g.sy - 18 };
  g.to = { x: Math.max(GOAL_L + 8, Math.min(GOAL_R - 8, tx)), y: Math.max(GOAL_TOP + 6, ty) };
  g.ball = { ...g.from };
  g.t = 0;
  g.releaseAt = g.time;
  g.phase = "flight";

  // disguise: a look-away lean that may or may not be honest
  const honest = Math.random() < Math.max(0.35, 0.85 - tier * 0.07);
  const bin = sideOf(g.to.x);
  g.face = honest ? (bin === 0 ? -1 : bin === 2 ? 1 : Math.random() < 0.5 ? -1 : 1) : bin === 0 ? 1 : bin === 2 ? -1 : g.face;
}

function resolve(g: Game): void {
  const arrival = g.time;
  const dx = g.to.x - GOAL_CX;
  const corner = Math.abs(dx) / (GOAL_R - GOAL_CX);
  const bin = sideOf(g.to.x);
  const diveBin = g.dive < 0 ? 0 : g.dive > 0 ? 2 : 1;
  let saved = false;
  let why = "";

  if (g.dive === 0) {
    if (Math.abs(dx) < 52) {
      saved = Math.random() < 0.95 - (Math.abs(dx) / 52) * 0.2;
      why = "HELD HIS GROUND";
    } else {
      why = "WRONG-FOOTED";
    }
  } else if (diveBin !== bin) {
    why = "WRONG SIDE";
  } else {
    const elapsed = arrival - g.diveAt;
    if (elapsed > g.dur + g.window) {
      why = "DIVED TOO EARLY";
    } else if (elapsed < 0.16) {
      why = "TOO LATE";
    } else {
      saved = Math.random() < 0.97 - corner * 0.3;
      why = saved ? "TIPPED OVER" : "BEATEN";
    }
  }

  g.phase = "result";
  g.resultT = 1.05;

  if (saved) {
    g.saves += 1;
    g.good = true;
    g.outcome = "SAVE!";
    g.shake = Math.max(g.shake, 6);
    g.flash = 0.55;
    g.flashC = "#38bdf8";
    burst(g, g.keeperX + (g.dive || (dx > 0 ? 1 : -1)) * 30, GOAL_BOT - 52, "#7dd3fc", 24, 220);
    floater(g, g.keeperX, GOAL_BOT - 76, "SAVE!", "#7dd3fc");
    if (g.saves % 5 === 0) {
      g.tier += 1;
      g.banner = `TIER ${g.tier} · QUICKER RELEASE`;
      g.bannerT = 1.8;
      burst(g, GOAL_CX, 120, "#fbbf24", 26, 190);
    }
  } else {
    g.goals += 1;
    g.good = false;
    g.outcome = why;
    g.shake = Math.max(g.shake, 10);
    g.flash = 0.8;
    g.flashC = "#f87171";
    burst(g, g.to.x, g.to.y, "#f87171", 26, 230);
    floater(g, g.to.x, g.to.y - 18, "GOAL", "#f87171");
    g.fail = true;
  }
}

function step(g: Game, dt: number): void {
  g.time += dt;
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt * 1.8);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);
  g.keeperX += (g.keeperTX - g.keeperX) * Math.min(1, dt * 13);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-2.4 * dt);
    p.vy *= Math.exp(-2.4 * dt);
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.2;
    f.y -= 30 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (g.phase === "ready") {
    g.phaseT -= dt;
    if (g.phaseT <= 0) {
      g.phase = "runup";
      g.phaseT = Math.max(0.5, 1.3 - g.tier * 0.07) + Math.random() * 0.4;
      // a stutter step fakes the release
      if (Math.random() < Math.min(0.55, 0.12 + g.tier * 0.07)) g.phaseT += 0.32;
    }
    return;
  }

  if (g.phase === "runup") {
    g.phaseT -= dt;
    g.runK = Math.min(1, g.runK + dt * 1.6);
    if (g.phaseT <= 0) release(g);
    return;
  }

  if (g.phase === "flight") {
    g.t += dt;
    const k = Math.min(1, g.t / g.dur);
    const e = 1 - (1 - k) * (1 - k);
    g.ball = { x: g.from.x + (g.to.x - g.from.x) * e, y: g.from.y + (g.to.y - g.from.y) * e };
    g.trail.push({ ...g.ball });
    if (g.trail.length > 14) g.trail.shift();
    if (g.dive !== 0) g.keeperTX = GOAL_CX + g.dive * 128;
    if (k >= 1) resolve(g);
    return;
  }

  if (g.phase === "result") {
    g.resultT -= dt;
    if (g.resultT <= 0) {
      if (g.fail) g.over = true;
      else nextShooter(g);
    }
  }
}

/* ------------------------------ render ------------------------------ */

function drawKeeper(ctx: CanvasRenderingContext2D, g: Game, time: number): void {
  const x = g.keeperX;
  const y = GOAL_BOT - 2;
  const reach = Math.abs(x - GOAL_CX);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((x - GOAL_CX) / 128) * 0.55 * Math.min(1, reach / 80));

  const spread = 20 + Math.min(34, reach * 0.45);
  ctx.strokeStyle = "#67e8f9";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, -32);
  ctx.lineTo(-spread, -42 - Math.sin(time / 260) * 2);
  ctx.moveTo(6, -32);
  ctx.lineTo(spread, -42 - Math.cos(time / 260) * 2);
  ctx.stroke();

  ctx.shadowColor = "#2dd4bf";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#134e4a";
  ctx.beginPath();
  ctx.roundRect(-11, -46, 22, 36, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#5eead4";
  ctx.beginPath();
  ctx.roundRect(-11, -46, 22, 10, 5);
  ctx.fill();
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(0, -54, 7.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#a5f3fc";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * spread, -42, 6.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 3, 16, 5, 0, 0, TAU);
  ctx.fill();
}

function drawShooter(ctx: CanvasRenderingContext2D, g: Game, time: number): void {
  const kicking = g.phase === "flight" || g.phase === "result";
  const k = g.phase === "runup" ? g.runK : kicking ? 1 : 0.15;
  const x = g.sx;
  const y = g.sy - k * 34;
  ctx.save();
  ctx.translate(x, y);
  const lean = (g.face * 0.3 + Math.sin(time / 70) * 0.05) * (g.phase === "runup" || kicking ? 1 : 0.4);
  ctx.rotate(lean);
  ctx.shadowColor = "#f8fafc";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.roundRect(-10, -38, 20, 32, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.roundRect(-10, -24, 20, 7, 3);
  ctx.fill();
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(0, -46, 7, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  const kick = kicking ? 12 : 0;
  ctx.moveTo(-4, -6);
  ctx.lineTo(-6 - kick * 0.4, 8);
  ctx.moveTo(4, -6);
  ctx.lineTo(7 + kick, 4 - kick * 0.3);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(x, y + 13, 15, 5, 0, 0, TAU);
  ctx.fill();

  // disguise cue: which way he is leaning
  if (g.phase === "runup") {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = "rgba(253, 230, 138, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const dir = g.face;
    ctx.moveTo(x + dir * 16, y - 54);
    ctx.lineTo(x + dir * 30, y - 54);
    ctx.moveTo(x + dir * 30, y - 54);
    ctx.lineTo(x + dir * 24, y - 59);
    ctx.moveTo(x + dir * 30, y - 54);
    ctx.lineTo(x + dir * 24, y - 49);
    ctx.stroke();
    ctx.restore();
  }
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#04120f");
  bg.addColorStop(0.45, "#07201a");
  bg.addColorStop(1, "#0a2a22");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(45, 212, 191, 0.045)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(-14, GOAL_BOT + i * 42, W + 28, 42);
  }

  // stands
  ctx.fillStyle = "#04090b";
  ctx.fillRect(-14, -14, W + 28, GOAL_TOP - 2);
  const crowd = ["#2dd4bf", "#a3e635", "#38bdf8", "#fbbf24", "#e2e8f0"];
  for (let i = 0; i < 90; i++) {
    const cx = ((i * 53) % (W + 20)) - 10;
    const cy = 4 + ((i * 31) % (GOAL_TOP - 18));
    ctx.fillStyle = crowd[i % crowd.length];
    ctx.globalAlpha = 0.15 + ((i * 7) % 10) * 0.03 + Math.sin(time / 520 + i) * 0.06;
    ctx.fillRect(cx, cy, 3, 3);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(226, 232, 240, 0.05)";
  ctx.beginPath();
  ctx.ellipse(W / 2, 44, 240, 96, 0, 0, TAU);
  ctx.fill();

  // six-yard box + spot
  ctx.strokeStyle = "rgba(226, 232, 240, 0.2)";
  ctx.lineWidth = 2;
  ctx.strokeRect(96, GOAL_BOT, W - 192, 132);
  ctx.strokeRect(28, GOAL_BOT, W - 56, 210);

  // goal
  ctx.save();
  ctx.beginPath();
  ctx.rect(GOAL_L, GOAL_TOP, GOAL_R - GOAL_L, GOAL_BOT - GOAL_TOP);
  ctx.clip();
  ctx.fillStyle = "rgba(2, 8, 10, 0.74)";
  ctx.fillRect(GOAL_L, GOAL_TOP, GOAL_R - GOAL_L, GOAL_BOT - GOAL_TOP);
  ctx.strokeStyle = "rgba(226, 232, 240, 0.2)";
  ctx.lineWidth = 1;
  for (let x = GOAL_L; x <= GOAL_R; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, GOAL_TOP);
    ctx.lineTo(x, GOAL_BOT);
    ctx.stroke();
  }
  for (let y = GOAL_TOP; y <= GOAL_BOT; y += 16) {
    ctx.beginPath();
    ctx.moveTo(GOAL_L, y);
    ctx.lineTo(GOAL_R, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.8)";
  ctx.shadowBlur = 16;
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(GOAL_L, GOAL_BOT);
  ctx.lineTo(GOAL_L, GOAL_TOP);
  ctx.lineTo(GOAL_R, GOAL_TOP);
  ctx.lineTo(GOAL_R, GOAL_BOT);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(248, 250, 252, 0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GOAL_BOT);
  ctx.lineTo(W, GOAL_BOT);
  ctx.stroke();

  if (g) {
    // dive zone guides while a shot is live
    if (g.phase === "runup" || g.phase === "flight") {
      const third = (GOAL_R - GOAL_L) / 3;
      for (let i = 0; i < 2; i++) {
        const zx = i === 0 ? GOAL_L : GOAL_L + third * 2;
        const mine = g.dive !== 0 && ((g.dive < 0 && i === 0) || (g.dive > 0 && i === 1));
        ctx.fillStyle = mine ? "rgba(103, 232, 249, 0.26)" : "rgba(103, 232, 249, 0.06)";
        ctx.fillRect(zx + 3, GOAL_TOP + 3, third - 6, GOAL_BOT - GOAL_TOP - 6);
      }
      if (g.dive === 0 && g.phase === "runup") {
        ctx.font = "700 12px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(165, 243, 252, 0.85)";
        ctx.fillText("← DIVE LEFT    DIVE RIGHT →", W / 2, GOAL_TOP - 12);
      }
    }

    drawKeeper(ctx, g, time);
    drawShooter(ctx, g, time);

    // ball + trail
    if (g.trail.length > 1) {
      for (let i = 0; i < g.trail.length; i++) {
        const k = i / g.trail.length;
        ctx.globalAlpha = k * 0.45;
        ctx.fillStyle = "#bae6fd";
        ctx.beginPath();
        ctx.arc(g.trail[i].x, g.trail[i].y, 1.5 + k * 3.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const flying = g.phase === "flight";
    const r = flying ? 9 - Math.min(1, g.t / g.dur) * 4 : 9;
    const bx = flying ? g.ball.x : g.phase === "ready" || g.phase === "runup" ? g.sx : g.ball.x;
    const by = flying ? g.ball.y : g.phase === "ready" || g.phase === "runup" ? g.sy - 8 : g.ball.y;
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.7)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(bx - r * 0.25, by - r * 0.2, r * 0.4, 0, TAU);
    ctx.fill();
    ctx.restore();

    // release timing ring — shrinks as the shot arrives
    if (g.phase === "flight") {
      const left = Math.max(0, 1 - g.t / g.dur);
      ctx.strokeStyle = `rgba(165, 243, 252, ${0.25 + left * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.ball.x, g.ball.y, 12 + left * 46, 0, TAU);
      ctx.stroke();
    }

    // particles
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    if (g.phase === "result" && g.outcome) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.resultT * 1.6);
      ctx.font = "800 30px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = g.good ? "rgba(125,211,252,0.9)" : "rgba(248,113,113,0.9)";
      ctx.shadowBlur = 20;
      ctx.fillStyle = g.good ? "#e0f2fe" : "#fee2e2";
      ctx.fillText(g.outcome, W / 2, 300);
      if (!g.good && g.resultT > 0.4) {
        ctx.font = "700 13px ui-monospace, monospace";
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(254, 207, 213, 0.9)";
        ctx.fillText(`${g.saves} SAVES · TIER ${g.tier}`, W / 2, 324);
      }
      ctx.restore();
    }

    ctx.textAlign = "center";
    for (const f of g.floats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.font = "800 15px ui-monospace, monospace";
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.4);
      ctx.font = "800 26px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(45, 212, 191, 0.9)";
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
  const g: Game = {
    phase: "ready",
    phaseT: 1,
    time: 0,
    saves: 0,
    goals: 0,
    tier: 1,
    over: false,
    sx: GOAL_CX,
    sy: 380,
    face: 1,
    runK: 0,
    from: { x: GOAL_CX, y: 372 },
    to: { x: GOAL_CX, y: 130 },
    ball: { x: GOAL_CX, y: 372 },
    t: 0,
    dur: 0.5,
    releaseAt: 0,
    trail: [],
    dive: 0,
    diveAt: -999,
    keeperX: GOAL_CX,
    keeperTX: GOAL_CX,
    window: 0.3,
    outcome: "",
    good: false,
    fail: false,
    resultT: 0,
    parts: [],
    floats: [],
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    banner: "TIER 1",
    bannerT: 1.4,
  };
  nextShooter(g);
  return g;
}

export default function KeeperWars({ gameId = "keeper-wars" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [saves, setSaves] = useState(0);
  const [tier, setTier] = useState(1);
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
    setSaves(0);
    setTier(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastSaves = -1;
    let lastTier = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      if (g.saves !== lastSaves) {
        lastSaves = g.saves;
        setSaves(g.saves);
      }
      if (g.tier !== lastTier) {
        lastTier = g.tier;
        setTier(g.tier);
      }

      draw(t);
      if (g.over) {
        setSaves(g.saves);
        setNewBest(submit(g.saves));
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
        return;
      }
      if (status !== "playing") return;
      const g = gameRef.current;
      if (!g) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        if ((g.phase === "runup" || g.phase === "flight") && g.dive === 0) {
          g.dive = e.key === "ArrowLeft" ? -1 : 1;
          g.diveAt = g.time;
        }
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start]);

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[540px]">
      <GameHud score={saves} best={best ?? "—"}>
        <span className="text-teal-300">
          Tier <b className="ml-1 text-sm text-ink">{tier}</b>
        </span>
        <span className="text-cyan-300">
          Saves <b className="ml-1 text-sm text-ink">{saves}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(45,212,191,0.75)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Keeper wars goal mouth"
          onPointerDown={(e) => {
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g) return;
            if (g.phase !== "runup" && g.phase !== "flight") return;
            if (g.dive !== 0) return;
            const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
            g.dive = p.x < GOAL_CX ? -1 : 1;
            g.diveAt = g.time;
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">KEEPER WARS</p>
            <p className="mt-2 text-sm text-muted">
              Endless penalties come raining in from all angles and distances. Dive the instant the
              striker plants his foot — hang early and he sells the fake, arrive late and it flies
              past your gloves. Every five saves puts a faster shooter on the spot.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Take the gloves
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ← / → to dive · tap or hold the left / right side of the goal
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">BEATEN</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{saves}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Saves {saves} · Best {best ?? "—"} · reached tier {tier}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Read the lean — but watch for the stutter step
            </p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Dive on the release, not the run-up · corners beat a keeper standing still
      </p>
    </div>
  );
}
