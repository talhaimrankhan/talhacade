"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 660;
const TAU = Math.PI * 2;
const TONE = "from-stone-400 via-neutral-500 to-zinc-700";
const CX = W / 2;
const HY = 156; // house centre (tee)
const R_OUT = 74; // 12-foot
const R_8 = 52;
const R_4 = 32;
const R_BTN = 15;
const HOG_Y = 336; // stones must cross this line
const HACK_Y = 596; // delivery point
const EDGE = 22; // side / back boards
const SR = 14; // stone radius
const FRIC = 110; // px/s² — unswept drag
const FRIC_SW = 76; // swept drag
const MAX_PULL = 140;
const PULL_SCALE = 3.3; // v0 = pull × 3.3 (max 462)
const CURL_A = 0.06; // curl rate at speed
const CURL_B = 0.34; // extra curl rate as the stone slows
const V_REF = 420;

type Status = "idle" | "playing" | "over";
type Side = "p" | "a";
type Phase = "aim" | "ai" | "travel" | "pause" | "done";

interface Pt {
  x: number;
  y: number;
}
interface Stone {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  side: Side;
  crossed: boolean;
  dead: boolean;
  rot: number;
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
interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
}
interface Plan {
  x: number;
  y: number;
  v0: number;
  sweep: boolean;
  kind: "draw" | "takeout" | "guard";
}

interface Game {
  stones: Stone[];
  nextId: number;
  phase: Phase;
  turn: number; // 0..3 within the end (P A P A)
  end: number;
  totalP: number;
  totalA: number;
  endP: number;
  endA: number;
  aiming: boolean;
  pull: Pt;
  sweep: boolean; // player is sweeping (held)
  aiTimer: number;
  plan: Plan | null;
  autoSweep: boolean;
  thrownId: number;
  pauseT: number;
  pending: "next" | "over";
  banner: string;
  bannerSub: string;
  bannerT: number;
  parts: Part[];
  floats: Floater[];
  shake: number;
  flash: number;
  flashC: string;
  result: "win" | "loss" | "draw";
}

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
      life: 0.4 + Math.random() * 0.45,
      max: 0.85,
      r: 1.5 + Math.random() * 2.4,
      c,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, c: string): void {
  g.floats.push({ x, y, text, life: 1, c });
}

function distToButton(s: Stone): number {
  return Math.hypot(s.x - CX, s.y - HY);
}

function sideOfTurn(turn: number): Side {
  return turn % 2 === 0 ? "p" : "a";
}

function liveStones(g: Game): Stone[] {
  return g.stones.filter((s) => !s.dead);
}

/* ------------------------------ physics ------------------------------ */

function stoneSpeed(s: Stone): number {
  return Math.hypot(s.vx, s.vy);
}

function simulateStone(g: Game, s: Stone, sweep: boolean, dt: number): void {
  const v = stoneSpeed(s);
  if (v <= 0.01) {
    s.vx = 0;
    s.vy = 0;
    return;
  }
  // friction — sweeping keeps speed longer
  const fric = sweep ? FRIC_SW : FRIC;
  const nv = Math.max(0, v - fric * dt);
  const k = nv / v;
  s.vx *= k;
  s.vy *= k;

  // curl: stones drift right of their line, more so as they slow down
  const t = Math.min(1, nv / V_REF);
  const rate = (CURL_A + CURL_B * (1 - t)) * (sweep ? 0.25 : 1);
  const ang = rate * dt;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const nvx = s.vx * cos - s.vy * sin;
  const nvy = s.vx * sin + s.vy * cos;
  s.vx = nvx;
  s.vy = nvy;

  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.rot += dt * (2 + nv / 90);
  if (s.y <= HOG_Y) s.crossed = true;

  if (s.x < EDGE || s.x > W - EDGE || s.y < EDGE || s.y > H - 10) {
    s.dead = true;
    burst(g, s.x, s.y, s.side === "p" ? "#67e8f9" : "#fb7185", 16, 170);
    floater(g, Math.max(60, Math.min(W - 60, s.x)), Math.max(50, s.y - 10), "OUT!", "#fda4af");
    g.shake = Math.max(g.shake, 5);
  }
}

/** Predicted rest path for the aim guide (ignores other stones). */
function predict(sx: number, sy: number, v0: number, dirX: number, dirY: number, sweep: boolean): Pt[] {
  const s: Stone = {
    id: -1,
    x: sx,
    y: sy,
    vx: dirX * v0,
    vy: dirY * v0,
    side: "p",
    crossed: false,
    dead: false,
    rot: 0,
  };
  const pts: Pt[] = [];
  for (let i = 0; i < 420; i++) {
    const v = stoneSpeed(s);
    if (v <= 0.01) break;
    if (s.x < EDGE || s.x > W - EDGE || s.y < EDGE) break;
    const fric = sweep ? FRIC_SW : FRIC;
    const nv = Math.max(0, v - fric / 60);
    const k = nv / v;
    s.vx *= k;
    s.vy *= k;
    const t = Math.min(1, nv / V_REF);
    const rate = (CURL_A + CURL_B * (1 - t)) * (sweep ? 0.25 : 1);
    const ang = rate / 60;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const nvx = s.vx * cos - s.vy * sin;
    const nvy = s.vx * sin + s.vy * cos;
    s.vx = nvx;
    s.vy = nvy;
    s.x += s.vx / 60;
    s.y += s.vy / 60;
    if (i % 4 === 0) pts.push({ x: s.x, y: s.y });
  }
  pts.push({ x: s.x, y: s.y });
  return pts;
}

function resolveCollisions(g: Game): void {
  const list = liveStones(g);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= SR * 2 || d < 0.001) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = SR * 2 - d;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
      const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (vn <= 0) continue;
      const jimp = (1.94 * vn) / 2;
      a.vx -= jimp * nx;
      a.vy -= jimp * ny;
      b.vx += jimp * nx;
      b.vy += jimp * ny;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      g.shake = Math.max(g.shake, 8);
      g.flash = Math.max(g.flash, 0.3);
      g.flashC = "#ffffff";
      burst(g, mx, my, "#e2e8f0", 14, 190);
      floater(g, mx, my - 20, "CLACK!", "#f8fafc");
    }
  }
}

/* ------------------------------ flow ------------------------------ */

function createGame(): Game {
  return {
    stones: [],
    nextId: 1,
    phase: "aim",
    turn: 0,
    end: 1,
    totalP: 0,
    totalA: 0,
    endP: 0,
    endA: 0,
    aiming: false,
    pull: { x: CX, y: HACK_Y },
    sweep: false,
    aiTimer: 0,
    plan: null,
    autoSweep: false,
    thrownId: -1,
    pauseT: 0,
    pending: "next",
    banner: "END 1 — YOUR STONE",
    bannerSub: "Drag back from the hack, release to throw",
    bannerT: 2.2,
    parts: [],
    floats: [],
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    result: "draw",
  };
}

function launch(g: Game, side: Side, target: Pt, v0: number, sweep: boolean): void {
  const dx = target.x - CX;
  const dy = target.y - HACK_Y;
  const d = Math.hypot(dx, dy) || 1;
  const s: Stone = {
    id: g.nextId++,
    x: CX,
    y: HACK_Y,
    vx: (dx / d) * v0,
    vy: (dy / d) * v0,
    side,
    crossed: false,
    dead: false,
    rot: 0,
  };
  g.stones.push(s);
  g.thrownId = s.id;
  g.phase = "travel";
  g.aiming = false;
  g.plan = null;
  g.autoSweep = sweep;
  burst(g, CX, HACK_Y, side === "p" ? "#67e8f9" : "#fb7185", 10, 120);
}

function planAi(g: Game): void {
  const live = liveStones(g);
  let bestA = Infinity;
  let bestP = Infinity;
  let pStone: Stone | null = null;
  for (const s of live) {
    if (distToButton(s) > R_OUT) continue;
    if (s.side === "a") bestA = Math.min(bestA, distToButton(s));
    else {
      if (distToButton(s) < bestP) pStone = s;
      bestP = Math.min(bestP, distToButton(s));
    }
  }

  const sigma = Math.max(5, 42 - (g.end - 1) * 8);
  const jitter = () => (Math.random() + Math.random() - 1) * sigma;

  let kind: Plan["kind"] = "draw";
  let target: Pt = { x: CX + jitter(), y: HY + jitter() };
  if (bestP < bestA) {
    // the rival is behind — chase our closest stone
    kind = "takeout";
    target = { x: pStone!.x + jitter() * 0.7, y: pStone!.y + jitter() * 0.7 };
  } else if (bestA < Infinity && bestP < Infinity * 0.5 && Math.random() < 0.4) {
    kind = "guard";
  }
  if (kind === "guard") {
    target = { x: CX + jitter() * 0.6, y: HY + 108 + Math.abs(jitter()) * 0.4 };
  }

  const d = Math.hypot(target.x - CX, target.y - HACK_Y);
  const extra = kind === "takeout" ? 130 : 0;
  let v0 = Math.sqrt(2 * FRIC * (d + extra)) * (0.97 + Math.random() * 0.06);
  v0 = Math.max(150, Math.min(462, v0));

  // sweep if the natural line comes up short of the target
  const rest = predict(CX, HACK_Y, v0, (target.x - CX) / d, (target.y - HACK_Y) / d, false);
  const stop = rest[rest.length - 1];
  const sweep = Math.hypot(stop.x - target.x, stop.y - target.y) > 34;

  g.plan = { x: target.x, y: target.y, v0, sweep, kind };
  g.aiTimer = 1.25;
}

function aiThrow(g: Game): void {
  const p = g.plan;
  if (!p) {
    planAi(g);
    return;
  }
  launch(g, "a", { x: p.x, y: p.y }, p.v0, p.sweep);
}

function scoreEnd(g: Game): void {
  const inHouse = liveStones(g).filter((s) => distToButton(s) <= R_OUT);
  let bestP = Infinity;
  let bestA = Infinity;
  for (const s of inHouse) {
    const d = distToButton(s);
    if (s.side === "p") bestP = Math.min(bestP, d);
    else bestA = Math.min(bestA, d);
  }
  let p = 0;
  let a = 0;
  if (bestP < bestA) {
    p = inHouse.filter((s) => s.side === "p" && distToButton(s) < bestA).length;
  } else if (bestA < bestP) {
    a = inHouse.filter((s) => s.side === "a" && distToButton(s) < bestP).length;
  }
  g.endP = p;
  g.endA = a;
  g.totalP += p;
  g.totalA += a;
  g.phase = "pause";
  g.shake = Math.max(g.shake, 6);
  if (p > 0) {
    g.flash = 0.55;
    g.flashC = "#67e8f9";
    floater(g, CX, HY - 60, `+${p} END ${g.end}`, "#67e8f9");
  } else if (a > 0) {
    g.flash = 0.4;
    g.flashC = "#fb7185";
    floater(g, CX, HY - 60, `RIVAL +${a}`, "#fda4af");
  } else {
    floater(g, CX, HY - 60, "BLANK END", "#e2e8f0");
  }
  const tied = g.totalP === g.totalA;
  const doneEnough = g.end >= 4 && !tied;
  g.banner = `END ${g.end} — YOU ${p} · RIVAL ${a}`;
  g.bannerSub = `TOTAL  YOU ${g.totalP} — ${g.totalA} RIVAL`;
  g.bannerT = doneEnough ? 1.4 : 2.4;
  g.pauseT = g.bannerT + 0.6;
  g.pending = doneEnough ? "over" : "next";
}

function beginThrow(g: Game): void {
  g.aiming = false;
  g.pull = { x: CX, y: HACK_Y };
  if (sideOfTurn(g.turn) === "p") {
    g.phase = "aim";
    g.banner = g.end > 4 ? `EXTRA END ${g.end} — YOUR STONE` : `END ${g.end} — YOUR STONE`;
    g.bannerSub = "Drag back from the hack · hold S to sweep";
    g.bannerT = 2;
  } else {
    g.phase = "ai";
    g.banner = "RIVAL READIES…";
    g.bannerSub = "Watch the weight gauge";
    g.bannerT = 1.3;
    planAi(g);
  }
}

function resume(g: Game): void {
  if (g.pending === "over") {
    g.phase = "done";
    g.result = g.totalP > g.totalA ? "win" : g.totalP < g.totalA ? "loss" : "draw";
    return;
  }
  g.end += 1;
  g.turn = 0;
  g.stones = [];
  beginThrow(g);
}

function settle(g: Game): void {
  const thrown = g.stones.find((s) => s.id === g.thrownId);
  if (thrown && !thrown.dead && !thrown.crossed) {
    thrown.dead = true;
    g.shake = Math.max(g.shake, 5);
    burst(g, thrown.x, thrown.y, "#fbbf24", 14, 150);
    floater(g, thrown.x, thrown.y - 18, "HOG LINE — DEAD", "#fbbf24");
  }
  g.turn += 1;
  if (g.turn >= 4) {
    scoreEnd(g);
    return;
  }
  if (sideOfTurn(g.turn) === "p") {
    g.phase = "aim";
    g.banner = "YOUR STONE";
    g.bannerSub = `${4 - g.turn} stone${4 - g.turn === 1 ? "" : "s"} left this end`;
    g.bannerT = 1.4;
  } else {
    g.phase = "ai";
    g.banner = "RIVAL READIES…";
    g.bannerSub = "Watch the weight gauge";
    g.bannerT = 1.2;
    planAi(g);
  }
}

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 28);
  g.flash = Math.max(0, g.flash - dt * 1.6);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 150 * dt;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.05;
    f.y -= 26 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (g.phase === "pause") {
    g.pauseT -= dt;
    if (g.pauseT <= 0) resume(g);
    return;
  }

  if (g.phase === "ai") {
    g.aiTimer -= dt;
    if (g.aiTimer <= 0) aiThrow(g);
    return;
  }

  if (g.phase !== "travel") return;

  for (const s of liveStones(g)) {
    if (s.id === g.thrownId) simulateStone(g, s, g.autoSweep || g.sweep, dt);
    else if (stoneSpeed(s) > 0.01) simulateStone(g, s, false, dt);
  }
  resolveCollisions(g);

  const moving = liveStones(g).some((s) => stoneSpeed(s) > 0.01);
  if (!moving) settle(g);
}

/* ------------------------------ render ------------------------------ */

function drawSheet(ctx: CanvasRenderingContext2D, time: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0d1420");
  bg.addColorStop(0.45, "#0a101a");
  bg.addColorStop(1, "#070c14");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // ice sheet
  ctx.fillStyle = "#0f1a28";
  ctx.beginPath();
  ctx.roundRect(EDGE - 8, 14, W - (EDGE - 8) * 2, H - 24, 14);
  ctx.fill();

  // pebble texture
  ctx.fillStyle = "rgba(125, 211, 252, 0.10)";
  for (let i = 0; i < 130; i++) {
    const px = EDGE + ((i * 71) % (W - EDGE * 2));
    const py = 22 + ((i * 113) % (H - 46));
    ctx.fillRect(px, py, 1.6, 1.6);
  }

  // running centre line
  ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CX, 40);
  ctx.lineTo(CX, H - 24);
  ctx.stroke();

  // hog lines
  for (const y of [HOG_Y, H - 132]) {
    ctx.strokeStyle = "rgba(251, 191, 36, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(EDGE - 6, y);
    ctx.lineTo(W - EDGE + 6, y);
    ctx.stroke();
  }
  ctx.font = "700 9px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(251, 191, 36, 0.6)";
  ctx.fillText("HOG", EDGE + 2, HOG_Y - 6);

  // hack
  ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
  ctx.beginPath();
  ctx.roundRect(CX - 26, HACK_Y + 10, 18, 8, 3);
  ctx.roundRect(CX + 8, HACK_Y + 10, 18, 8, 3);
  ctx.fill();

  // back line
  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(EDGE - 6, 42);
  ctx.lineTo(W - EDGE + 6, 42);
  ctx.stroke();

  // house
  ctx.save();
  ctx.shadowColor = "rgba(56, 189, 248, 0.5)";
  ctx.shadowBlur = 26;
  ctx.fillStyle = "#0b3b5e";
  ctx.beginPath();
  ctx.arc(CX, HY, R_OUT, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#dce7f2";
  ctx.beginPath();
  ctx.arc(CX, HY, R_8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#e04b5f";
  ctx.beginPath();
  ctx.arc(CX, HY, R_4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(CX, HY, R_BTN, 0, TAU);
  ctx.fill();
  // rings
  ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CX, HY, R_OUT, 0, TAU);
  ctx.stroke();
  // tee dot pulse
  ctx.strokeStyle = `rgba(253, 230, 138, ${0.5 + Math.sin(time / 380) * 0.3})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(CX, HY, R_BTN + 5, 0, TAU);
  ctx.stroke();
}

function drawStone(ctx: CanvasRenderingContext2D, s: Stone, time: number): void {
  const main = s.side === "p" ? "#22d3ee" : "#fb7185";
  const trim = s.side === "p" ? "#155e75" : "#9f1239";
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(s.x + 2, s.y + 5, SR - 1, SR - 4, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = hexA(main, 0.8);
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(s.x, s.y, SR, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = hexA(main, 0.9);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(s.x, s.y, SR - 1.5, 0, TAU);
  ctx.stroke();

  // handle
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.rot);
  ctx.strokeStyle = hexA(main, 0.95);
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(6, 0);
  ctx.stroke();
  ctx.strokeStyle = trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, SR - 6, 0, TAU);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = `rgba(255,255,255,${0.35 + Math.sin(time / 300) * 0.15})`;
  ctx.beginPath();
  ctx.arc(s.x - 4, s.y - 5, 2, 0, TAU);
  ctx.fill();
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  drawSheet(ctx, time);

  if (g) {
    // rival plan line
    if (g.phase === "ai" && g.plan) {
      const p = g.plan;
      ctx.save();
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = "rgba(251, 113, 133, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(CX, HACK_Y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(251, 113, 133, 0.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, TAU);
      ctx.stroke();
      ctx.restore();

      const w = Math.round(p.v0 / 46);
      ctx.fillStyle = "rgba(2, 6, 23, 0.75)";
      ctx.beginPath();
      ctx.roundRect(W - 150, H - 92, 132, 46, 10);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.font = "800 12px ui-monospace, monospace";
      ctx.fillStyle = "#fda4af";
      ctx.fillText("RIVAL WEIGHT", W - 140, H - 74);
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = i < w ? "#fb7185" : "rgba(148, 163, 184, 0.25)";
        ctx.beginPath();
        ctx.roundRect(W - 140 + i * 12, H - 66, 9, 8, 2);
        ctx.fill();
      }
      ctx.textAlign = "right";
      ctx.font = "700 10px ui-monospace, monospace";
      ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
      ctx.fillText(p.kind.toUpperCase(), W - 18, H - 74);
    }

    // player aim guide
    if (g.phase === "aim" && g.aiming) {
      const dx = CX - g.pull.x;
      const dy = HACK_Y - g.pull.y;
      const pull = Math.min(MAX_PULL, Math.hypot(dx, dy));
      if (pull > 8) {
        const v0 = pull * PULL_SCALE;
        const d = Math.hypot(dx, dy) || 1;
        const pts = predict(CX, HACK_Y, v0, dx / d, dy / d, g.sweep);
        for (let i = 0; i < pts.length; i++) {
          const k = i / pts.length;
          ctx.globalAlpha = 0.2 + (1 - k) * 0.8;
          ctx.fillStyle = g.sweep ? "#a7f3d0" : "#e2e8f0";
          ctx.beginPath();
          ctx.arc(pts[i].x, pts[i].y, Math.max(1.5, 3.6 - k * 2), 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        const stop = pts[pts.length - 1];
        ctx.strokeStyle = g.sweep ? "rgba(167, 243, 208, 0.9)" : "rgba(226, 232, 240, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(stop.x, stop.y, 8, 0, TAU);
        ctx.stroke();

        // pull line + weight ring
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(CX, HACK_Y);
        ctx.lineTo(g.pull.x, g.pull.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const frac = pull / MAX_PULL;
        ctx.strokeStyle = frac > 0.9 ? "#fbbf24" : "#67e8f9";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(CX, HACK_Y, 22, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
        ctx.stroke();
      }
    }

    // stones
    for (const s of g.stones) {
      if (!s.dead) drawStone(ctx, s, time);
    }

    // sweeping dust
    if (g.phase === "travel" && (g.autoSweep || g.sweep)) {
      const s = g.stones.find((x) => x.id === g.thrownId);
      if (s && !s.dead && stoneSpeed(s) > 1) {
        burst(g, s.x, s.y + 6, "#bae6fd", 2, 70);
      }
    }

    // particles
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // canvas HUD
    ctx.textAlign = "left";
    ctx.font = "800 13px ui-monospace, monospace";
    ctx.fillStyle = "#67e8f9";
    ctx.fillText(`YOU ${g.totalP}`, 16, 30);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fda4af";
    ctx.fillText(`RIVAL ${g.totalA}`, W - 16, 30);
    ctx.textAlign = "center";
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.fillStyle = "rgba(226, 232, 240, 0.75)";
    ctx.fillText(
      `${g.end > 4 ? "EXTRA END" : `END ${g.end} OF 4`} · STONE ${Math.min(4, g.turn + 1)}/4`,
      W / 2,
      30,
    );

    // floaters
    ctx.font = "800 15px ui-monospace, monospace";
    for (const f of g.floats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.textAlign = "center";
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.4);
      ctx.textAlign = "center";
      ctx.font = "800 24px ui-sans-serif, system-ui, sans-serif";
      ctx.shadowColor = "rgba(56, 189, 248, 0.85)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 40);
      ctx.shadowBlur = 0;
      ctx.font = "700 12px ui-monospace, monospace";
      ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
      ctx.fillText(g.bannerSub, W / 2, H / 2 - 16);
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

function toCanvas(clientX: number, clientY: number, el: HTMLCanvasElement): Pt {
  const rect = el.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * W,
    y: ((clientY - rect.top) / rect.height) * H,
  };
}

export default function StoneCurl({ gameId = "stone-curl" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [rival, setRival] = useState(0);
  const [end, setEnd] = useState(1);
  const [result, setResult] = useState<"win" | "loss">("loss");
  const [newBest, setNewBest] = useState(false);
  const [streak, setStreak] = useStored<number>(`${gameId}:streak`, 0);
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
    setRival(0);
    setEnd(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastRival = -1;
    let lastEnd = -1;
    let lastStreak = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      if (g.totalP !== lastScore) {
        lastScore = g.totalP;
        setScore(g.totalP);
      }
      if (g.totalA !== lastRival) {
        lastRival = g.totalA;
        setRival(g.totalA);
      }
      if (g.end !== lastEnd) {
        lastEnd = g.end;
        setEnd(g.end);
      }
      if (g.phase === "done" && lastStreak !== g.totalP) {
        lastStreak = g.totalP;
        setStreak(g.result === "win" ? (s: number) => s + 1 : 0);
      }

      draw(t);
      if (g.phase === "done") {
        setScore(g.totalP);
        setRival(g.totalA);
        setResult(g.result === "win" ? "win" : "loss");
        setNewBest(submit(g.totalP));
        setStatus("over");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit, setStreak]);

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
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "s") {
        e.preventDefault();
        const g = gameRef.current;
        if (g) g.sweep = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "s") {
        const g = gameRef.current;
        if (g) g.sweep = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start]);

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"} accent="text-slate-300">
        <span className="text-neutral-300">
          End <b className="ml-1 text-sm text-ink">{Math.min(end, 4)}/4</b>
        </span>
        <span className="text-amber-300">
          Rival <b className="ml-1 text-sm text-ink">{rival}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(148,163,184,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Stone Curl ice sheet"
          onPointerDown={(e) => {
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g) return;
            if (g.phase === "aim") {
              const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
              if (Math.hypot(p.x - CX, p.y - HACK_Y) > 70) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              g.aiming = true;
              g.pull = p;
            } else if (g.phase === "travel") {
              e.currentTarget.setPointerCapture(e.pointerId);
              g.sweep = true;
            }
          }}
          onPointerMove={(e) => {
            const g = gameRef.current;
            if (!g?.aiming) return;
            const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
            const dx = p.x - CX;
            const dy = p.y - HACK_Y;
            const d = Math.hypot(dx, dy);
            const c = Math.min(MAX_PULL, d);
            g.pull = d > 0.001 ? { x: CX + (dx / d) * c, y: HACK_Y + (dy / d) * c } : { x: CX, y: HACK_Y };
          }}
          onPointerUp={() => {
            const g = gameRef.current;
            if (!g) return;
            g.sweep = false;
            if (!g.aiming || g.phase !== "aim") return;
            const dx = CX - g.pull.x;
            const dy = HACK_Y - g.pull.y;
            const pull = Math.hypot(dx, dy);
            g.aiming = false;
            if (pull < 16) return;
            const v0 = Math.min(462, pull * PULL_SCALE);
            const d = Math.hypot(dx, dy) || 1;
            launch(g, "p", { x: CX + (dx / d) * 100, y: HACK_Y + (dy / d) * 100 }, v0, false);
            g.autoSweep = false;
          }}
          onPointerCancel={() => {
            const g = gameRef.current;
            if (g) {
              g.aiming = false;
              g.sweep = false;
            }
          }}
        />

        {status === "playing" && (
          <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            Drag back · release · hold S or hold screen to sweep
          </p>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">STONE CURL</p>
            <p className="mt-2 text-sm text-muted">
              Four ends against the house. Drag back from the hack to set line and weight, then hold
              S — or hold the screen — while the stone travels: sweeping straightens the curl and
              keeps speed alive. Stones that stop short of the hog line are dead. Closest to the
              button scores.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Slide out
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Drag-aim + release · hold S / hold screen to sweep · 4 ends
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {result === "win" ? "MATCH WON" : "RIVAL TAKES IT"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {score} <span className="text-lg text-muted">— {rival}</span>
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              You · rival · streak {streak} · best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Curl drifts right late — start your line left of the button
            </p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Sweep for speed and a straighter line · light weight dies at the hog line
      </p>
    </div>
  );
}
