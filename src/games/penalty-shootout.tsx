"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 520;
const H = 440;
const TAU = Math.PI * 2;

const GOAL_L = 76;
const GOAL_R = 444;
const GOAL_TOP = 64;
const GOAL_BOT = 190;
const GOAL_CX = (GOAL_L + GOAL_R) / 2;
const SPOT = { x: W / 2, y: 360 };
const TONE = "from-lime-400 via-green-500 to-emerald-600";

type Status = "idle" | "playing" | "over";
type Phase = "aim" | "flight" | "result" | "runup" | "kflight" | "kresult" | "break";

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
  round: number;
  kicksYou: number;
  kicksCpu: number;
  goalsYou: number;
  goalsCpu: number;
  streak: number;
  over: boolean;
  // your shot
  aiming: boolean;
  aim: Pt;
  power: number;
  powerDir: number;
  // shared flight
  ball: Pt;
  from: Pt;
  to: Pt;
  t: number;
  dur: number;
  keeperSide: number;
  keeperX: number;
  keeperTX: number;
  // outcome
  outcome: string;
  good: boolean;
  resultT: number;
  // keeper phase
  dive: number;
  picked: boolean;
  cpuSide: number;
  cpuPower: number;
  tellSide: number;
  // juice
  parts: Part[];
  floats: Floater[];
  shake: number;
  flash: number;
  flashC: string;
  banner: string;
  bannerT: number;
  hist: number[];
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

/* ------------------------------ kicking ------------------------------ */

/** The keeper reads your habits: exploit your favourite side as the streak grows. */
function keeperPick(g: Game): number {
  const total = g.hist[0] + g.hist[1] + g.hist[2];
  const exploit = Math.min(0.8, total < 2 ? 0 : 0.22 + g.streak * 0.14);
  const weights = [0, 1, 2].map((i) => (g.hist[i] + 1) / (total + 3));
  const roll = Math.random();
  if (roll < exploit) {
    let best = 0;
    if (weights[1] > weights[best]) best = 1;
    if (weights[2] > weights[best]) best = 2;
    return best;
  }
  const w = Math.random();
  return w < 1 / 3 ? 0 : w < 2 / 3 ? 1 : 2;
}

function fireShot(g: Game): void {
  g.aiming = false;
  const jitter = 7 + Math.max(0, g.power - 0.88) * 300;
  const tx = g.aim.x + (Math.random() - 0.5) * 2 * jitter;
  const ty = g.aim.y + (Math.random() - 0.5) * 2 * jitter * 0.55;
  g.hist[sideOf(g.aim.x)] += 1;

  g.from = { ...SPOT };
  g.to = { x: tx, y: ty };
  g.ball = { ...SPOT };
  g.t = 0;
  g.dur = 0.66 - g.power * 0.2;
  g.keeperSide = keeperPick(g);
  g.keeperTX = GOAL_CX + g.keeperSide * 126;

  const inside = tx > GOAL_L + 4 && tx < GOAL_R - 4 && ty > GOAL_TOP + 4 && ty < GOAL_BOT;
  if (!inside) {
    g.outcome = ty <= GOAL_TOP + 4 ? "OVER THE BAR!" : "WIDE!";
    g.good = false;
  } else {
    const side = sideOf(tx);
    const corner = Math.abs(tx - GOAL_CX) / (GOAL_R - GOAL_CX);
    if (side === g.keeperSide) {
      const saveChance = Math.max(
        0.1,
        Math.min(0.94, 0.88 - corner * 0.5 - (g.power - 0.5) * 0.26),
      );
      if (Math.random() < saveChance) {
        g.outcome = "SAVED!";
        g.good = false;
      } else {
        g.outcome = "GOAL!";
        g.good = true;
      }
    } else {
      g.outcome = "GOAL!";
      g.good = true;
    }
  }
  g.phase = "flight";
}

function resolveShot(g: Game): void {
  g.kicksYou += 1;
  g.phase = "result";
  g.resultT = 1.2;
  g.flash = 0;
  if (g.outcome === "GOAL!") {
    g.goalsYou += 1;
    g.shake = Math.max(g.shake, 7);
    g.flash = 0.7;
    g.flashC = "#4ade80";
    burst(g, g.to.x, g.to.y, "#a3e635", 26, 210);
    floater(g, g.to.x, g.to.y - 16, "GOAL!", "#a3e635");
  } else if (g.outcome === "SAVED!") {
    g.shake = Math.max(g.shake, 5);
    burst(g, g.keeperX, GOAL_BOT - 44, "#7dd3fc", 18, 170);
    floater(g, g.keeperX, GOAL_BOT - 66, "SAVED!", "#7dd3fc");
  } else {
    burst(g, g.to.x, g.to.y, "#f87171", 10, 130);
    floater(g, g.to.x, g.to.y - 14, g.outcome, "#f87171");
  }
}

function setupRunup(g: Game): void {
  g.phase = "runup";
  const aggression = Math.min(1, 0.35 + g.streak * 0.12);
  g.cpuPower = 0.62 + Math.random() * (0.3 + aggression * 0.08);
  const centreChance = Math.max(0.12, 0.3 - g.streak * 0.04);
  const roll = Math.random();
  g.cpuSide = roll < centreChance ? 1 : Math.random() < 0.5 ? 0 : 2;
  // the lean is a tell — but bigger streaks mean more fakes
  const honest = Math.random() < Math.max(0.4, 0.8 - g.streak * 0.09);
  g.tellSide = honest ? g.cpuSide : 2 - g.cpuSide;
  g.dive = 0;
  g.picked = false;
  // a stutter step late in the run-up buys the striker a beat
  g.phaseT = 1.15 + Math.random() * 0.5 + (Math.random() < Math.min(0.5, g.streak * 0.1) ? 0.45 : 0);
}

function releaseCpu(g: Game): void {
  const tx = g.cpuSide === 1 ? GOAL_CX + (Math.random() - 0.5) * 46 : g.cpuSide === 0 ? GOAL_L + 34 + Math.random() * 60 : GOAL_R - 34 - Math.random() * 60;
  const ty = GOAL_TOP + 18 + Math.random() * (GOAL_BOT - GOAL_TOP - 34);
  g.from = { ...SPOT };
  g.to = { x: tx, y: ty };
  g.ball = { ...SPOT };
  g.t = 0;
  g.dur = 0.64 - g.cpuPower * 0.2;
  g.phase = "kflight";
}

function resolveKeeper(g: Game): void {
  g.kicksCpu += 1;
  g.phase = "kresult";
  g.resultT = 1.2;
  const side = sideOf(g.to.x);
  const overBar = g.to.y < GOAL_TOP;
  const blazed = g.cpuPower > 0.95 && Math.random() < (g.cpuPower - 0.95) * 4;

  if (overBar || blazed) {
    g.outcome = "HE SKIED IT!";
    g.good = true;
    g.shake = Math.max(g.shake, 4);
    burst(g, g.to.x, Math.max(24, g.to.y), "#7dd3fc", 12, 150);
    floater(g, GOAL_CX, 120, "HE SKIED IT!", "#7dd3fc");
    return;
  }

  const corner = Math.abs(g.to.x - GOAL_CX) / (GOAL_R - GOAL_CX);
  if (g.dive === side) {
    const hold = Math.max(0.12, Math.min(0.95, 0.9 - corner * 0.42 - g.cpuPower * 0.1));
    if (Math.random() < hold) {
      g.outcome = "SAVED!";
      g.good = true;
      g.shake = Math.max(g.shake, 7);
      g.flash = 0.6;
      g.flashC = "#38bdf8";
      burst(g, g.keeperX, GOAL_BOT - 44, "#7dd3fc", 24, 210);
      floater(g, g.keeperX, GOAL_BOT - 70, "SAVE!", "#7dd3fc");
    } else {
      g.outcome = "BEATEN!";
      g.good = false;
    }
  } else {
    g.outcome = "BEATEN!";
    g.good = false;
  }

  if (!g.good) {
    g.goalsCpu += 1;
    g.shake = Math.max(g.shake, 8);
    g.flash = 0.7;
    g.flashC = "#f87171";
    burst(g, g.to.x, g.to.y, "#f87171", 24, 210);
    floater(g, g.to.x, g.to.y - 16, "GOAL — THEY SCORE", "#f87171");
  }
}

function roundDecided(g: Game): boolean {
  const total = g.kicksYou + g.kicksCpu;
  if (g.goalsYou >= 3 || g.goalsCpu >= 3) return true;
  return total >= 10 && total % 2 === 0 && g.goalsYou !== g.goalsCpu;
}

function startRound(g: Game, round: number): void {
  g.round = round;
  g.kicksYou = 0;
  g.kicksCpu = 0;
  g.goalsYou = 0;
  g.goalsCpu = 0;
  g.phase = "aim";
  g.aiming = false;
  g.aim = { x: GOAL_CX, y: 126 };
  g.power = 0.3;
  g.powerDir = 1;
  g.keeperX = GOAL_CX;
  g.keeperTX = GOAL_CX;
  g.banner = round === 1 ? "ROUND 1" : `ROUND ${round}`;
  g.bannerT = 1.5;
}

function advance(g: Game): void {
  if (roundDecided(g)) {
    if (g.goalsYou > g.goalsCpu) {
      g.streak += 1;
      g.banner = `ROUND WON · STREAK ${g.streak}`;
      g.bannerT = 1.7;
      g.phase = "break";
      g.phaseT = 1.7;
    } else {
      g.banner = "KNOCKED OUT";
      g.bannerT = 1.2;
      g.over = true;
    }
    return;
  }
  const total = g.kicksYou + g.kicksCpu;
  if (total % 2 === 0) {
    g.phase = "aim";
    g.aiming = false;
    g.aim = { x: GOAL_CX, y: 126 };
    g.power = 0.3;
    g.powerDir = 1;
  } else {
    setupRunup(g);
  }
}

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt * 1.7);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);

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
  g.keeperX += (g.keeperTX - g.keeperX) * Math.min(1, dt * 9);

  if (g.phase === "aim") {
    if (g.aiming) {
      g.power += g.powerDir * dt * 1.15;
      if (g.power >= 1) {
        g.power = 1;
        g.powerDir = -1;
      } else if (g.power <= 0.15) {
        g.power = 0.15;
        g.powerDir = 1;
      }
    }
    return;
  }

  if (g.phase === "flight" || g.phase === "kflight") {
    g.t += dt;
    const k = Math.min(1, g.t / g.dur);
    const e = 1 - (1 - k) * (1 - k);
    g.ball = { x: g.from.x + (g.to.x - g.from.x) * e, y: g.from.y + (g.to.y - g.from.y) * e };
    if (k >= 1) {
      if (g.phase === "flight") resolveShot(g);
      else resolveKeeper(g);
    }
    return;
  }

  if (g.phase === "result" || g.phase === "kresult") {
    g.resultT -= dt;
    if (g.resultT <= 0) advance(g);
    return;
  }

  if (g.phase === "runup") {
    g.phaseT -= dt;
    if (g.phaseT <= 0) releaseCpu(g);
    return;
  }

  if (g.phase === "break") {
    g.phaseT -= dt;
    if (g.phaseT <= 0) startRound(g, g.round + 1);
  }
}

/* ------------------------------ render ------------------------------ */

function drawKeeper(ctx: CanvasRenderingContext2D, g: Game, time: number): void {
  const reach = Math.abs(g.keeperX - GOAL_CX);
  const lean = ((g.keeperX - GOAL_CX) / 126) * 0.5;
  const x = g.keeperX;
  const y = GOAL_BOT - 2;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean * Math.min(1, reach / 90));

  // gloves / arms
  const spread = 20 + Math.min(30, reach * 0.4);
  ctx.strokeStyle = "#a3e635";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, -30);
  ctx.lineTo(-spread, -40 - Math.sin(time / 300) * 2);
  ctx.moveTo(6, -30);
  ctx.lineTo(spread, -40 - Math.cos(time / 300) * 2);
  ctx.stroke();

  // body
  ctx.shadowColor = "#4ade80";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#166534";
  ctx.beginPath();
  ctx.roundRect(-11, -44, 22, 34, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#86efac";
  ctx.beginPath();
  ctx.roundRect(-11, -44, 22, 10, 5);
  ctx.fill();

  // head
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(0, -52, 7.5, 0, TAU);
  ctx.fill();

  // gloves
  ctx.fillStyle = "#bef264";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * spread, -40, 6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // dive shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 3, 16, 5, 0, 0, TAU);
  ctx.fill();

  if (reach > 6) {
    // trail hint of the dive direction
    ctx.strokeStyle = "rgba(163, 230, 53, 0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - Math.sign(g.keeperX - GOAL_CX) * 24, y - 30);
    ctx.lineTo(x - Math.sign(g.keeperX - GOAL_CX) * 54, y - 30);
    ctx.stroke();
  }
}

function drawStriker(ctx: CanvasRenderingContext2D, g: Game, time: number): void {
  if (g.phase !== "runup" && g.phase !== "kflight" && g.phase !== "kresult") return;
  const run = g.phase === "runup" ? 1 - Math.max(0, g.phaseT - 0.4) / 0.9 : 1;
  const y = 416 - Math.max(0, Math.min(1, run)) * 44;
  const x = W / 2;
  ctx.save();
  ctx.translate(x, y);
  const lean = g.phase === "runup" ? (g.tellSide - 1) * 0.28 : 0;
  ctx.rotate(lean + Math.sin(time / 60) * 0.04);
  ctx.shadowColor = "#f8fafc";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.roundRect(-10, -36, 20, 30, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.roundRect(-10, -22, 20, 7, 3);
  ctx.fill();
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(0, -44, 7, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-4, -6);
  ctx.lineTo(-7, 8);
  ctx.moveTo(4, -6);
  ctx.lineTo(9, 8);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 15, 5, 0, 0, TAU);
  ctx.fill();
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  // pitch
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#07140c");
  bg.addColorStop(0.45, "#0a2013");
  bg.addColorStop(1, "#0d2a18");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // mown stripes
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(34,197,94,0.05)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(-14, GOAL_BOT + i * 40, W + 28, 40);
  }

  // stands above the goal
  ctx.fillStyle = "#050b0f";
  ctx.fillRect(-14, -14, W + 28, GOAL_TOP - 2);
  const crowd = ["#38bdf8", "#a3e635", "#fbbf24", "#f472b6", "#e2e8f0"];
  for (let i = 0; i < 96; i++) {
    const cx = ((i * 53) % (W + 20)) - 10;
    const cy = 4 + ((i * 31) % (GOAL_TOP - 16));
    ctx.fillStyle = crowd[i % crowd.length];
    ctx.globalAlpha = 0.16 + ((i * 7) % 10) * 0.03 + Math.sin(time / 500 + i) * 0.06;
    ctx.fillRect(cx, cy, 3, 3);
  }
  ctx.globalAlpha = 1;

  // floodlight glow
  ctx.fillStyle = "rgba(226, 232, 240, 0.05)";
  ctx.beginPath();
  ctx.ellipse(W / 2, 40, 240, 90, 0, 0, TAU);
  ctx.fill();

  // penalty box + arc + spot
  ctx.strokeStyle = "rgba(226, 232, 240, 0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(38, GOAL_BOT, W - 76, 158);
  ctx.beginPath();
  ctx.arc(SPOT.x, SPOT.y, 66, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.arc(SPOT.x, SPOT.y, 4, 0, TAU);
  ctx.fill();

  // goal net
  ctx.save();
  ctx.beginPath();
  ctx.rect(GOAL_L, GOAL_TOP, GOAL_R - GOAL_L, GOAL_BOT - GOAL_TOP);
  ctx.clip();
  ctx.fillStyle = "rgba(3, 10, 7, 0.72)";
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

  // posts + bar
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
  // ground line
  ctx.strokeStyle = "rgba(248, 250, 252, 0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GOAL_BOT);
  ctx.lineTo(W, GOAL_BOT);
  ctx.stroke();

  if (g) {
    // dive zones hint
    if (g.phase === "runup") {
      const third = (GOAL_R - GOAL_L) / 3;
      for (let i = 0; i < 3; i++) {
        const zx = GOAL_L + third * i;
        const active = g.picked && g.dive === i - 1;
        ctx.fillStyle = active ? "rgba(56, 189, 248, 0.3)" : "rgba(56, 189, 248, 0.07)";
        ctx.fillRect(zx + 3, GOAL_TOP + 3, third - 6, GOAL_BOT - GOAL_TOP - 6);
      }
      ctx.strokeStyle = "rgba(125, 211, 252, 0.5)";
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 1.5;
      const thirdW = (GOAL_R - GOAL_L) / 3;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(GOAL_L + thirdW * i, GOAL_TOP);
        ctx.lineTo(GOAL_L + thirdW * i, GOAL_BOT);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.font = "700 12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(186, 230, 253, 0.9)";
      ctx.fillText("PICK YOUR DIVE", W / 2, GOAL_TOP - 12);
    }

    drawKeeper(ctx, g, time);
    drawStriker(ctx, g, time);

    // ball
    const k = g.phase === "flight" || g.phase === "kflight" ? Math.min(1, g.t / g.dur) : 0;
    const r = 9 - k * 4.2;
    const bx = g.ball.x;
    const by = g.ball.y;
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.75)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(bx - r * 0.25, by - r * 0.2, r * 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.arc(bx + r * 0.4, by + r * 0.3, r * 0.28, 0, TAU);
    ctx.fill();
    ctx.restore();

    // aim reticle + power meter (your shot)
    if (g.phase === "aim") {
      const ax = g.aim.x;
      const ay = g.aim.y;
      ctx.strokeStyle = g.aiming ? "#bef264" : "rgba(190, 242, 100, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ax, ay, 16, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ax - 24, ay);
      ctx.lineTo(ax - 6, ay);
      ctx.moveTo(ax + 6, ay);
      ctx.lineTo(ax + 24, ay);
      ctx.moveTo(ax, ay - 24);
      ctx.lineTo(ax, ay - 6);
      ctx.moveTo(ax, ay + 6);
      ctx.lineTo(ax, ay + 24);
      ctx.stroke();

      const bw = 260;
      const bx0 = (W - bw) / 2;
      const by0 = H - 34;
      ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
      ctx.beginPath();
      ctx.roundRect(bx0 - 4, by0 - 4, bw + 8, 22, 11);
      ctx.fill();
      ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
      ctx.beginPath();
      ctx.roundRect(bx0, by0, bw, 14, 7);
      ctx.fill();
      // sweet spot
      ctx.fillStyle = "rgba(74, 222, 128, 0.45)";
      ctx.fillRect(bx0 + bw * 0.5, by0, bw * 0.38, 14);
      ctx.fillStyle = g.power > 0.5 && g.power < 0.9 ? "#a3e635" : "#fbbf24";
      ctx.beginPath();
      ctx.roundRect(bx0, by0, bw * g.power, 14, 7);
      ctx.fill();
      ctx.font = "700 11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
      ctx.fillText(g.aiming ? "RELEASE TO SHOOT" : "HOLD TO CHARGE", W / 2, by0 - 10);
    }

    // kick tracker
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#a3e635";
    ctx.fillText(`YOU ${g.goalsYou}`, 14, 26);
    ctx.textAlign = "right";
    ctx.fillStyle = "#7dd3fc";
    ctx.fillText(`CPU ${g.goalsCpu}`, W - 14, 26);

    const drawDots = (ox: number, yours: boolean) => {
      for (let i = 0; i < 5; i++) {
        const taken = yours ? i < g.kicksYou : i < g.kicksCpu;
        ctx.beginPath();
        ctx.arc(ox + i * 16, 40, 4.5, 0, TAU);
        ctx.fillStyle = taken ? (yours ? "#a3e635" : "#7dd3fc") : "rgba(148,163,184,0.35)";
        ctx.fill();
      }
    };
    drawDots(14, true);
    drawDots(W - 14 - 4 * 16 - 9, false);
    ctx.textAlign = "center";

    // particles
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // outcome word
    if ((g.phase === "result" || g.phase === "kresult") && g.outcome) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.resultT * 1.6);
      ctx.font = "800 30px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = g.good ? "rgba(163,230,53,0.9)" : "rgba(248,113,113,0.9)";
      ctx.shadowBlur = 20;
      ctx.fillStyle = g.good ? "#ecfccb" : "#fee2e2";
      ctx.fillText(g.outcome, W / 2, 250);
      ctx.restore();
    }

    // floaters
    ctx.font = "800 15px ui-monospace, monospace";
    ctx.textAlign = "center";
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
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(163,230,53,0.85)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 40);
      ctx.restore();
    }

    // flash
    if (g.flash > 0.01) {
      ctx.fillStyle = hexA(g.flashC, g.flash * 0.3);
      ctx.fillRect(-14, -14, W + 28, H + 28);
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function PenaltyShootout({ gameId = "penalty-shootout" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState(1);
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
    const g = createGame();
    gameRef.current = g;
    startRound(g, 1);
    setStreak(0);
    setRound(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastStreak = -1;
    let lastRound = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      if (g.streak !== lastStreak) {
        lastStreak = g.streak;
        setStreak(g.streak);
      }
      if (g.round !== lastRound) {
        lastRound = g.round;
        setRound(g.round);
      }

      draw(t);
      if (g.over) {
        setStreak(g.streak);
        setRound(g.round);
        setNewBest(submit(g.streak));
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
      const g = gameRef.current;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
        return;
      }
      if (status !== "playing" || !g) return;
      if (g.phase === "runup") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          g.dive = -1;
          g.picked = true;
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          g.dive = 1;
          g.picked = true;
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          g.dive = 0;
          g.picked = true;
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
      <GameHud score={streak} best={best ?? "—"}>
        <span className="text-lime-300">
          Round <b className="ml-1 text-sm text-ink">{round}</b>
        </span>
        <span className="text-sky-300">
          Streak <b className="ml-1 text-sm text-ink">{streak}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(134,197,24,0.75)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Penalty shootout arena"
          onPointerDown={(e) => {
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g) return;
            const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
            if (g.phase === "aim") {
              e.currentTarget.setPointerCapture(e.pointerId);
              g.aiming = true;
              g.aim = {
                x: Math.max(GOAL_L - 34, Math.min(GOAL_R + 34, p.x)),
                y: Math.max(GOAL_TOP - 34, Math.min(GOAL_BOT - 6, p.y)),
              };
              g.power = 0.15;
              g.powerDir = 1;
            } else if (g.phase === "runup") {
              const third = (GOAL_R - GOAL_L) / 3;
              g.dive = p.x < GOAL_L + third ? -1 : p.x < GOAL_L + third * 2 ? 0 : 1;
              g.picked = true;
            }
          }}
          onPointerMove={(e) => {
            const g = gameRef.current;
            if (!g || !g.aiming) return;
            const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
            g.aim = {
              x: Math.max(GOAL_L - 34, Math.min(GOAL_R + 34, p.x)),
              y: Math.max(GOAL_TOP - 34, Math.min(GOAL_BOT - 6, p.y)),
            };
          }}
          onPointerUp={() => {
            const g = gameRef.current;
            if (g?.aiming && g.phase === "aim") fireShot(g);
          }}
          onPointerCancel={() => {
            const g = gameRef.current;
            if (g?.aiming && g.phase === "aim") fireShot(g);
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">PENALTY SHOOTOUT</p>
            <p className="mt-2 text-sm text-muted">
              Take five kicks, then guard your own net — first to three goals takes the round.
              The keeper studies which corner you favour, and strikers start selling fakes as your
              streak climbs. Win rounds to keep the streak alive; one lost round ends the run.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Step up
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Hold to charge power, release to shoot · click a third (or ← ↓ →) to dive
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">KNOCKED OUT</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{streak}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Streak {streak} · Best {best ?? "—"} · reached round {round}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              The keeper reads habits — vary your corners to keep scoring
            </p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Green band = sweet power · beat the keeper, then keep yours
      </p>
    </div>
  );
}

function createGame(): Game {
  return {
    phase: "aim",
    phaseT: 0,
    round: 1,
    kicksYou: 0,
    kicksCpu: 0,
    goalsYou: 0,
    goalsCpu: 0,
    streak: 0,
    over: false,
    aiming: false,
    aim: { x: GOAL_CX, y: 126 },
    power: 0.3,
    powerDir: 1,
    ball: { ...SPOT },
    from: { ...SPOT },
    to: { x: GOAL_CX, y: 126 },
    t: 0,
    dur: 0.6,
    keeperSide: 0,
    keeperX: GOAL_CX,
    keeperTX: GOAL_CX,
    outcome: "",
    good: false,
    resultT: 0,
    dive: 0,
    picked: false,
    cpuSide: 0,
    cpuPower: 0.7,
    tellSide: 1,
    parts: [],
    floats: [],
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    banner: "",
    bannerT: 0,
    hist: [0, 0, 0],
  };
}
