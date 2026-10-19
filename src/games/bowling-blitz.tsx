"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 560;
const TAU = Math.PI * 2;
const LANE_L = 64;
const LANE_R = 396;
const LANE_TOP = 30;
const FOUL_Y = 436;
const BALL_START = { x: W / 2, y: 402 };
const BALL_R = 11;
const PIN_R = 7;
const DECK_Y = 150;
const MAX_SPEED = 540;
const TONE = "from-sky-400 via-blue-500 to-indigo-600";

type Status = "idle" | "playing" | "over";
type Phase = "aim" | "hook" | "roll" | "settle" | "result";

interface Pt {
  x: number;
  y: number;
}
interface Pin {
  x: number;
  y: number;
  sx: number;
  sy: number;
  vx: number;
  vy: number;
  down: boolean;
  rot: number;
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
  phaseT: number;
  frames: number[][];
  pins: Pin[];
  ball: { x: number; y: number; vx: number; vy: number; on: boolean; rot: number; gutter: boolean };
  angle: number;
  power: number;
  hook: number;
  standingAtRoll: number;
  settleT: number;
  stillT: number;
  result: string;
  resultSub: string;
  resultT: number;
  over: boolean;
  parts: Part[];
  floats: Floater[];
  shake: number;
  flash: number;
  flashC: string;
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

/* ------------------------------ rack ------------------------------ */

const PIN_SPOTS: Pt[] = [
  { x: W / 2, y: DECK_Y },
  { x: W / 2 - 13, y: DECK_Y - 26 },
  { x: W / 2 + 13, y: DECK_Y - 26 },
  { x: W / 2 - 26, y: DECK_Y - 52 },
  { x: W / 2, y: DECK_Y - 52 },
  { x: W / 2 + 26, y: DECK_Y - 52 },
  { x: W / 2 - 39, y: DECK_Y - 78 },
  { x: W / 2 - 13, y: DECK_Y - 78 },
  { x: W / 2 + 13, y: DECK_Y - 78 },
  { x: W / 2 + 39, y: DECK_Y - 78 },
];

function rackPins(): Pin[] {
  return PIN_SPOTS.map((s) => ({
    x: s.x,
    y: s.y,
    sx: s.x,
    sy: s.y,
    vx: 0,
    vy: 0,
    down: false,
    rot: 0,
  }));
}

function standing(pins: Pin[]): number {
  let n = 0;
  for (const p of pins) if (!p.down) n++;
  return n;
}

/* ------------------------------ scoring ------------------------------ */

function tenthComplete(f: number[]): boolean {
  if (f.length >= 3) return true;
  if (f.length === 2) return f[0] !== 10 && f[0] + f[1] !== 10;
  return false;
}

function frameComplete(frames: number[][], fi: number): boolean {
  const f = frames[fi];
  if (!f || f.length === 0) return false;
  if (fi < 9) return f[0] === 10 || f.length >= 2;
  return tenthComplete(f);
}

function gameDone(frames: number[][]): boolean {
  return frames.length === 10 && frameComplete(frames, 9);
}

function frameScores(frames: number[][]): Array<number | null> {
  const flat: number[] = [];
  const starts: number[] = [];
  for (const f of frames) {
    starts.push(flat.length);
    for (const r of f) flat.push(r);
  }
  const out: Array<number | null> = [];
  let cum = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const ri = starts[i];
    let s: number | null = null;
    if (i === 9) {
      if (tenthComplete(f)) s = f.reduce((a, b) => a + b, 0);
    } else if (f[0] === 10) {
      if (flat[ri + 1] !== undefined && flat[ri + 2] !== undefined) s = 10 + flat[ri + 1] + flat[ri + 2];
    } else if (f.length >= 2) {
      const sum = f[0] + f[1];
      if (sum === 10) {
        if (flat[ri + 2] !== undefined) s = 10 + flat[ri + 2];
      } else s = sum;
    }
    if (s !== null) {
      cum += s;
      out.push(cum);
    } else out.push(null);
  }
  return out;
}

function currentTotal(frames: number[][]): number {
  const scores = frameScores(frames);
  let total = 0;
  for (const s of scores) if (s !== null) total = s;
  return total;
}

function marksFor(f: number[]): string[] {
  if (f.length === 0) return [];
  if (f[0] !== 10) {
    const out: string[] = [
      f[0] === 0 ? "–" : String(f[0]),
      f[1] === undefined
        ? ""
        : f[0] + f[1] === 10
          ? "/"
          : f[1] === 0
            ? "–"
            : String(f[1]),
    ];
    if (f[2] !== undefined) out.push(f[2] === 10 ? "X" : f[2] === 0 ? "–" : String(f[2]));
    return out;
  }
  // strike-led rack (tenth frame)
  return f.map((r, i) => {
    if (r === 10) return "X";
    if (i === 2 && f[1] !== 10 && f[1] + r === 10) return "/";
    return r === 0 ? "–" : String(r);
  });
}

/* ------------------------------ flow ------------------------------ */

function createGame(): Game {
  return {
    phase: "aim",
    t: 0,
    phaseT: 0,
    frames: [],
    pins: rackPins(),
    ball: { x: BALL_START.x, y: BALL_START.y, vx: 0, vy: 0, on: false, rot: 0, gutter: false },
    angle: 0,
    power: 0.7,
    hook: 0,
    standingAtRoll: 10,
    settleT: 0,
    stillT: 0,
    result: "",
    resultSub: "",
    resultT: 0,
    over: false,
    parts: [],
    floats: [],
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
  };
}

function takeAim(g: Game): void {
  g.angle = 0.26 * Math.sin(g.t * 2.2);
  g.power = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(g.t * 3.1));
  g.phase = "hook";
}

function launch(g: Game): void {
  g.hook = Math.sin(g.t * 2.6);
  const v = g.power * MAX_SPEED;
  g.ball = {
    x: BALL_START.x,
    y: BALL_START.y,
    vx: Math.sin(g.angle) * v,
    vy: -Math.cos(g.angle) * v,
    on: true,
    rot: 0,
    gutter: false,
  };
  g.standingAtRoll = standing(g.pins);
  g.phase = "roll";
}

function applyRoll(g: Game, v: number, gutter: boolean): void {
  if (g.frames.length === 0 || frameComplete(g.frames, g.frames.length - 1)) g.frames.push([]);
  const fi = g.frames.length - 1;
  const f = g.frames[fi];
  f.push(v);

  const isStrike = v === 10;
  const isSpare = f.length >= 2 && f[f.length - 1] + f[f.length - 2] === 10 && f[f.length - 2] !== 10;

  if (gutter && v === 0) {
    g.result = "GUTTER";
    g.resultSub = "no pins";
    g.shake = Math.max(g.shake, 4);
  } else if (isStrike) {
    const flat = g.frames.flat();
    let run = 0;
    for (let i = flat.length - 1; i >= 0; i--) {
      if (flat[i] === 10) run++;
      else break;
    }
    g.result = run >= 5 ? `${run} IN A ROW!` : run === 4 ? "FOUR BAGGER!" : run === 3 ? "TURKEY!" : "STRIKE!";
    g.resultSub = run >= 3 ? "the crowd goes wild" : "dead centre";
    g.shake = Math.max(g.shake, 8);
    g.flash = 0.7;
    g.flashC = "#fbbf24";
    burst(g, W / 2, DECK_Y, "#fde68a", 30, 240);
  } else if (isSpare) {
    g.result = "SPARE!";
    g.resultSub = "cleaned up";
    g.shake = Math.max(g.shake, 6);
    g.flash = 0.5;
    g.flashC = "#7dd3fc";
    burst(g, W / 2, DECK_Y, "#bae6fd", 22, 200);
  } else {
    g.result = v === 0 ? "MISS!" : `${v} PIN${v === 1 ? "" : "S"}`;
    g.resultSub = v >= 8 ? "nice carry" : v === 0 ? "not even a graze" : "open frame";
  }

  // fresh rack after a strike, a completed frame, or a spare closing the pair
  const complete = frameComplete(g.frames, fi);
  const tenthSpare = fi === 9 && f.length === 2 && f[0] !== 10 && f[0] + f[1] === 10;
  if (v === 10 || complete || tenthSpare) g.pins = rackPins();

  g.phase = "result";
  g.resultT = 1.25;
}

function nextRoll(g: Game): void {
  if (gameDone(g.frames)) {
    if (currentTotal(g.frames) === 300) {
      g.flash = 1;
      g.flashC = "#ffffff";
      burst(g, W / 2, 240, "#fde68a", 70, 340);
      floater(g, W / 2, 260, "PERFECT 300!", "#fde68a");
    }
    g.over = true;
    return;
  }
  g.ball.on = false;
  g.ball.gutter = false;
  g.ball.x = BALL_START.x;
  g.ball.y = BALL_START.y;
  g.ball.vx = 0;
  g.ball.vy = 0;
  g.phase = "aim";
}

function resolveRoll(g: Game): void {
  const now = standing(g.pins);
  const v = Math.max(0, g.standingAtRoll - now);
  applyRoll(g, v, g.ball.gutter);
}

/* ------------------------------ physics ------------------------------ */

function collidePins(a: Pin, b: Pin, e: number): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = PIN_R * 2;
  if (d <= 0.0001 || d >= min) return;
  const nx = dx / d;
  const ny = dy / d;
  const push = (min - d) / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (rel <= 0) return;
  const j = (-(1 + e) * rel) / 2;
  a.vx += j * nx;
  a.vy += j * ny;
  b.vx -= j * nx;
  b.vy -= j * ny;
}

function collideBallPin(g: Game, pin: Pin): void {
  const dx = pin.x - g.ball.x;
  const dy = pin.y - g.ball.y;
  const d = Math.hypot(dx, dy);
  const min = BALL_R + PIN_R;
  if (d <= 0.0001 || d >= min) return;
  const nx = dx / d;
  const ny = dy / d;
  const push = min - d;
  g.ball.x -= nx * push * 0.4;
  g.ball.y -= ny * push * 0.4;
  pin.x += nx * push * 0.6;
  pin.y += ny * push * 0.6;

  const rel = (g.ball.vx - pin.vx) * nx + (g.ball.vy - pin.vy) * ny;
  if (rel <= 0) return;
  const mB = 4;
  const e = 0.72;
  const j = (-(1 + e) * rel) / (1 / mB + 1);
  g.ball.vx += (j / mB) * nx;
  g.ball.vy += (j / mB) * ny;
  pin.vx -= j * nx;
  pin.vy -= j * ny;

  if (rel > 42 && !pin.down) {
    pin.down = true;
    burst(g, pin.x, pin.y, "#f8fafc", 8, 140);
    g.shake = Math.max(g.shake, 4);
  }
}

function stepPins(g: Game, dt: number): void {
  const damp = Math.exp(-1.5 * dt);
  for (const p of g.pins) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= damp;
    p.vy *= damp;
    p.rot += Math.hypot(p.vx, p.vy) * dt * 0.12;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 9 && !p.down) p.down = true;
    // deck walls
    if (p.x < LANE_L + PIN_R) {
      p.x = LANE_L + PIN_R;
      p.vx = Math.abs(p.vx) * 0.4;
    }
    if (p.x > LANE_R - PIN_R) {
      p.x = LANE_R - PIN_R;
      p.vx = -Math.abs(p.vx) * 0.4;
    }
    if (p.y < LANE_TOP + PIN_R) {
      p.y = LANE_TOP + PIN_R;
      p.vy = Math.abs(p.vy) * 0.4;
    }
  }
  for (let i = 0; i < g.pins.length; i++) {
    for (let j = i + 1; j < g.pins.length; j++) collidePins(g.pins[i], g.pins[j], 0.78);
    if (g.ball.on) collideBallPin(g, g.pins[i]);
  }
}

function stepBall(g: Game, dt: number): void {
  const b = g.ball;
  if (!b.on) return;
  b.rot += Math.hypot(b.vx, b.vy) * dt * 0.16;

  if (!b.gutter) {
    const progress = Math.max(0, Math.min(1, (BALL_START.y - b.y) / (BALL_START.y - DECK_Y)));
    b.vx += g.hook * 400 * progress * progress * dt;
    const damp = Math.exp(-0.24 * dt);
    b.vx *= damp;
    b.vy *= damp;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < LANE_L) {
      b.x = LANE_L - 8;
      b.vx = 0;
      b.vy = Math.abs(b.vy);
      b.gutter = true;
      g.shake = Math.max(g.shake, 3);
      floater(g, b.x, b.y - 12, "GUTTER", "#94a3b8");
    } else if (b.x > LANE_R) {
      b.x = LANE_R + 8;
      b.vx = 0;
      b.vy = Math.abs(b.vy);
      b.gutter = true;
      g.shake = Math.max(g.shake, 3);
      floater(g, b.x, b.y - 12, "GUTTER", "#94a3b8");
    }
  } else {
    b.vy *= Math.exp(-0.5 * dt);
    b.y += b.vy * dt;
    b.x += (b.x < W / 2 ? -1 : 1) * 6 * dt;
  }
}

function step(g: Game, dt: number): void {
  g.t += dt;
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt * 1.4);
  if (g.resultT > 0) g.resultT = Math.max(0, g.resultT - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-2.2 * dt);
    p.vy *= Math.exp(-2.2 * dt);
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.15;
    f.y -= 28 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (g.phase === "aim" || g.phase === "hook") {
    stepPins(g, dt);
    return;
  }

  if (g.phase === "roll") {
    const sub = 3;
    for (let i = 0; i < sub; i++) {
      stepBall(g, dt / sub);
      stepPins(g, dt / sub);
    }
    const b = g.ball;
    const gone = b.gutter ? b.y > FOUL_Y + 30 : b.y < LANE_TOP - 6;
    const slow = Math.hypot(b.vx, b.vy) < 34;
    if (gone || (slow && b.y < FOUL_Y)) {
      b.on = false;
      g.phase = "settle";
      g.settleT = 0;
      g.stillT = 0;
    }
    return;
  }

  if (g.phase === "settle") {
    stepPins(g, dt);
    g.settleT += dt;
    let moving = false;
    for (const p of g.pins) {
      if (Math.hypot(p.vx, p.vy) > 12) {
        moving = true;
        break;
      }
    }
    g.stillT = moving ? 0 : g.stillT + dt;
    if ((g.stillT > 0.28 && g.settleT > 0.5) || g.settleT > 2.4) resolveRoll(g);
    return;
  }

  // result
  stepPins(g, dt);
  if (g.resultT <= 0) nextRoll(g);
}

/* ------------------------------ render ------------------------------ */

function drawPin(ctx: CanvasRenderingContext2D, p: Pin, time: number): void {
  const tilt = p.down ? Math.min(1, Math.hypot(p.x - p.sx, p.y - p.sy) / 14) : 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot * (p.down ? 1 : 0.02) + tilt * 1.3);
  ctx.scale(1 - tilt * 0.45, 1);
  if (p.down) ctx.globalAlpha = 0.75;
  ctx.shadowColor = "rgba(255,255,255,0.55)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#f1f5f9";
  ctx.beginPath();
  ctx.ellipse(0, 0, PIN_R, PIN_R * 1.25, 0, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, -1.5, PIN_R * 0.7, 0.15, Math.PI - 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 1.5, PIN_R * 0.75, 0.2, Math.PI - 0.2);
  ctx.stroke();
  if (!p.down) {
    ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.sin(time / 400 + p.sx) * 0.2})`;
    ctx.beginPath();
    ctx.arc(-2, -3, 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawScorecard(ctx: CanvasRenderingContext2D, g: Game | null): void {
  const frames = g ? g.frames : [];
  const scores = frameScores(frames);
  const y0 = 452;
  const bw = 44;
  const bh = 76;
  const x0 = 8;

  ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
  ctx.beginPath();
  ctx.roundRect(x0 - 4, y0 - 4, bw * 10 + 8, bh + 8, 10);
  ctx.fill();

  for (let i = 0; i < 10; i++) {
    const bx = x0 + i * bw;
    const f = frames[i] ?? [];
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, y0, bw, bh);
    ctx.font = "600 9px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
    ctx.fillText(String(i + 1), bx + 3, y0 + 10);

    // roll marks
    const marks = marksFor(f);
    ctx.font = "700 13px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = "#e2e8f0";
    if (f[0] === 10 && f.length === 1) {
      ctx.fillText("X", bx + bw - 4, y0 + 26);
    } else {
      for (let m = 0; m < marks.length && m < 3; m++) {
        const mx = bx + 14 + m * 14;
        const my = y0 + 40;
        ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
        ctx.strokeRect(mx - 12, my - 13, 13, 14);
        ctx.fillStyle = marks[m] === "X" ? "#fbbf24" : marks[m] === "/" ? "#7dd3fc" : "#e2e8f0";
        ctx.fillText(marks[m], mx, my);
      }
    }

    // running total
    ctx.textAlign = "center";
    ctx.font = "700 14px ui-monospace, monospace";
    ctx.fillStyle = scores[i] != null ? "#f8fafc" : "rgba(148,163,184,0.4)";
    ctx.fillText(scores[i] != null ? String(scores[i]) : "", bx + bw / 2, y0 + bh - 8);
  }
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  // surroundings
  ctx.fillStyle = "#070b18";
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // lane
  const lane = ctx.createLinearGradient(0, LANE_TOP, 0, FOUL_Y);
  lane.addColorStop(0, "#7c5a33");
  lane.addColorStop(0.5, "#96703f");
  lane.addColorStop(1, "#7a5731");
  ctx.fillStyle = lane;
  ctx.fillRect(LANE_L, LANE_TOP, LANE_R - LANE_L, FOUL_Y - LANE_TOP);

  // boards
  ctx.strokeStyle = "rgba(59, 35, 12, 0.35)";
  ctx.lineWidth = 1;
  for (let x = LANE_L; x <= LANE_R; x += 13.6) {
    ctx.beginPath();
    ctx.moveTo(x, LANE_TOP);
    ctx.lineTo(x, FOUL_Y);
    ctx.stroke();
  }
  // oil sheen
  ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
  ctx.fillRect(LANE_L, LANE_TOP, LANE_R - LANE_L, 150);

  // gutters
  ctx.fillStyle = "#0b1120";
  ctx.fillRect(LANE_L - 20, LANE_TOP, 20, FOUL_Y - LANE_TOP + 10);
  ctx.fillRect(LANE_R, LANE_TOP, 20, FOUL_Y - LANE_TOP + 10);
  ctx.strokeStyle = "rgba(125, 211, 252, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(LANE_L, LANE_TOP);
  ctx.lineTo(LANE_L, FOUL_Y);
  ctx.moveTo(LANE_R, LANE_TOP);
  ctx.lineTo(LANE_R, FOUL_Y);
  ctx.stroke();

  // targeting arrows
  ctx.fillStyle = "rgba(30, 20, 8, 0.55)";
  for (let i = 0; i < 7; i++) {
    const ax = W / 2 + (i - 3) * 40;
    const ay = 300 - Math.abs(i - 3) * 16;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 14);
    ctx.lineTo(ax + 6, ay);
    ctx.lineTo(ax - 6, ay);
    ctx.closePath();
    ctx.fill();
  }

  // foul line
  ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(LANE_L, FOUL_Y);
  ctx.lineTo(LANE_R, FOUL_Y);
  ctx.stroke();

  // pit
  ctx.fillStyle = "#04060f";
  ctx.fillRect(LANE_L, LANE_TOP - 26, LANE_R - LANE_L, 26);

  if (g) {
    // pins
    for (const p of g.pins) drawPin(ctx, p, time);

    // aim projection
    if (g.phase === "aim") {
      ctx.save();
      ctx.strokeStyle = "rgba(226, 232, 240, 0.55)";
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(BALL_START.x, BALL_START.y);
      ctx.lineTo(
        BALL_START.x + Math.sin(g.angle) * 320,
        BALL_START.y - Math.cos(g.angle) * 320,
      );
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if (g.phase === "hook") {
      // predicted hook arc
      ctx.save();
      ctx.strokeStyle = "rgba(125, 211, 252, 0.5)";
      ctx.setLineDash([4, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      let px = BALL_START.x;
      let py = BALL_START.y;
      let vx = Math.sin(g.angle) * g.power * MAX_SPEED;
      const vy = -Math.cos(g.angle) * g.power * MAX_SPEED;
      ctx.moveTo(px, py);
      for (let i = 0; i < 60; i++) {
        const pr = Math.max(0, Math.min(1, (BALL_START.y - py) / (BALL_START.y - DECK_Y)));
        vx += g.hook * 400 * pr * pr * (1 / 30);
        px += vx / 30;
        py += vy / 30;
        if (i % 3 === 0) ctx.lineTo(px, py);
        if (py < LANE_TOP) break;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ball
    if (g.ball.on || g.phase === "aim" || g.phase === "hook") {
      ctx.save();
      ctx.translate(g.ball.x, g.ball.y);
      ctx.rotate(g.ball.rot);
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 8;
      const grd = ctx.createRadialGradient(-3, -4, 2, 0, 0, BALL_R);
      grd.addColorStop(0, "#818cf8");
      grd.addColorStop(1, "#312e81");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, 0, BALL_R, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0f172a";
      for (const [ox, oy] of [
        [-3, -3],
        [3, -2],
        [0, 4],
      ]) {
        ctx.beginPath();
        ctx.arc(ox, oy, 1.8, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // meters
    const my = 414;
    const mx = LANE_L;
    const mw = LANE_R - LANE_L;
    if (g.phase === "aim") {
      ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
      ctx.beginPath();
      ctx.roundRect(mx, my, mw, 18, 9);
      ctx.fill();
      ctx.fillStyle = "rgba(125, 211, 252, 0.35)";
      ctx.fillRect(mx + mw * 0.44, my, mw * 0.12, 18);
      const ax = mx + ((g.angle + 0.26) / 0.52) * mw;
      ctx.save();
      ctx.shadowColor = "#bae6fd";
      ctx.shadowBlur = 10;
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ax, my - 4);
      ctx.lineTo(ax, my + 22);
      ctx.stroke();
      ctx.restore();

      // power gauge (right edge)
      const gy = 70;
      const gh = 330;
      ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
      ctx.beginPath();
      ctx.roundRect(LANE_R + 26, gy, 16, gh, 8);
      ctx.fill();
      const fill = Math.round(gh * g.power);
      const pgrad = ctx.createLinearGradient(0, gy + gh, 0, gy);
      pgrad.addColorStop(0, "#38bdf8");
      pgrad.addColorStop(0.7, "#4ade80");
      pgrad.addColorStop(1, "#fbbf24");
      ctx.fillStyle = pgrad;
      ctx.beginPath();
      ctx.roundRect(LANE_R + 28, gy + gh - fill, 12, fill, 6);
      ctx.fill();
      ctx.font = "700 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(226,232,240,0.85)";
      ctx.fillText("PWR", LANE_R + 34, gy - 8);
    } else if (g.phase === "hook") {
      ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
      ctx.beginPath();
      ctx.roundRect(mx, my, mw, 18, 9);
      ctx.fill();
      ctx.fillStyle = "rgba(74, 222, 128, 0.35)";
      ctx.fillRect(mx + mw * 0.46, my, mw * 0.08, 18);
      const hval = Math.sin(g.t * 2.6);
      const hx = mx + ((hval + 1) / 2) * mw;
      ctx.save();
      ctx.shadowColor = "#86efac";
      ctx.shadowBlur = 10;
      ctx.strokeStyle = "#bbf7d0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hx, my - 4);
      ctx.lineTo(hx, my + 22);
      ctx.stroke();
      ctx.restore();
      ctx.font = "700 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(226,232,240,0.9)";
      ctx.fillText("SET THE HOOK", W / 2, my - 8);
    }

    // particles + floaters
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
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

    // result banner
    if (g.resultT > 0 && g.result) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.resultT * 1.5);
      ctx.fillStyle = "rgba(2, 6, 23, 0.75)";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 150, 168, 300, 78, 16);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.font = "800 30px ui-sans-serif, system-ui, sans-serif";
      ctx.shadowColor = "rgba(125, 211, 252, 0.8)";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(g.result, W / 2, 208);
      ctx.shadowBlur = 0;
      ctx.font = "600 12px ui-monospace, monospace";
      ctx.fillStyle = "rgba(186, 230, 252, 0.9)";
      ctx.fillText(g.resultSub.toUpperCase(), W / 2, 230);
      ctx.restore();
    }

    drawScorecard(ctx, g);

    if (g.flash > 0.01) {
      ctx.fillStyle = hexA(g.flashC, g.flash * 0.45);
      ctx.fillRect(-14, -14, W + 28, H + 28);
    }
  } else {
    drawScorecard(ctx, null);
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function BowlingBlitz({ gameId = "bowling-blitz" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [frame, setFrame] = useState(1);
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
    setFrame(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastFrame = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      const sc = currentTotal(g.frames);
      let doneFrames = 0;
      for (let i = 0; i < g.frames.length; i++) {
        if (frameComplete(g.frames, i)) doneFrames++;
      }
      const fr = Math.min(10, doneFrames + 1);
      if (sc !== lastScore) {
        lastScore = sc;
        setScore(sc);
      }
      if (fr !== lastFrame) {
        lastFrame = fr;
        setFrame(fr);
      }

      draw(t);
      if (g.over) {
        const finalScore = currentTotal(g.frames);
        setScore(finalScore);
        setNewBest(submit(finalScore));
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

  const tap = () => {
    if (status !== "playing") return;
    const g = gameRef.current;
    if (!g) return;
    if (g.phase === "aim") takeAim(g);
    else if (g.phase === "hook") launch(g);
  };

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-sky-300">
          Frame <b className="ml-1 text-sm text-ink">{frame}/10</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(56,189,248,0.75)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none cursor-pointer"
          aria-label="Bowling Blitz lane"
          onPointerDown={(e) => {
            e.preventDefault();
            tap();
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">BOWLING BLITZ</p>
            <p className="mt-2 text-sm text-muted">
              Ten frames, two clicks a ball: lock the sweeping aim line with your power gauge, then
              set the hook that bends the ball into the pocket late. Pins deflect into each other,
              strikes stack bonuses the classic way, and a perfect 300 gets the full treatment.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Roll out
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Click 1 = aim + power · click 2 = hook · mouse or tap
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-sky-300">GAME OVER</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Final {score} · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Pocket hits carry · light hook on the first ball, heavy on the spare
            </p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Two clicks per ball · X strikes, / spares · strikes fill the bonus frames
      </p>
    </div>
  );
}
