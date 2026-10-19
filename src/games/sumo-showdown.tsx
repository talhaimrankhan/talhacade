"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 560;
const H = 470;
const TAU = Math.PI * 2;
const TONE = "from-amber-400 via-orange-500 to-red-500";
const CX = W / 2;
const CY = 250;
const RING = 150;
const WR = 27; // wrestler radius
const OUT = RING - WR;
const MAX_STAM = 100;

type Status = "idle" | "playing" | "over";
type Phase = "ready" | "fight" | "pause";
type Man = "p" | "a";

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
interface Wrestler {
  x: number;
  vx: number;
  charge: number;
  charging: boolean;
  aim: 1 | -1;
  dashT: number;
  dashSpeed: number;
  power: number;
  stam: number;
  flash: number;
}

interface Ai extends Wrestler {
  state: "idle" | "charge" | "dash" | "recover";
  timer: number;
  target: number;
  lvl: number;
  pullCd: number;
  feint: boolean;
}

interface Game {
  p: Wrestler;
  a: Ai;
  phase: Phase;
  pauseT: number;
  round: number;
  pWin: number;
  aWin: number;
  match: number;
  lvl: number;
  score: number;
  counters: number;
  coolT: number;
  pending: "next" | "over" | "bout";
  boutResult: "win" | "loss" | null;
  banner: string;
  bannerSub: string;
  bannerT: number;
  parts: Particle[];
  floats: Floater[];
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
    const ang = Math.random() * TAU;
    const sp = power * (0.35 + Math.random() * 0.65);
    g.parts.push({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: 0.3 + Math.random() * 0.4,
      max: 0.7,
      r: 1.6 + Math.random() * 2.6,
      c,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, c: string): void {
  g.floats.push({ x, y, text, life: 1, c });
}

function freshMan(): Wrestler {
  return {
    x: CX,
    vx: 0,
    charge: 0,
    charging: false,
    aim: 1,
    dashT: 0,
    dashSpeed: 0,
    power: 0,
    stam: MAX_STAM,
    flash: 0,
  };
}

function freshAi(lvl: number): Ai {
  return {
    ...freshMan(),
    x: CX,
    aim: -1,
    state: "idle",
    timer: 0.8,
    target: 60,
    lvl,
    pullCd: 0,
    feint: false,
  };
}

function startRound(g: Game, banner: string, sub: string): void {
  g.p = freshMan();
  g.p.x = CX - 62;
  g.a = freshAi(g.lvl);
  g.a.x = CX + 62;
  g.coolT = 0;
  g.phase = "ready";
  g.pauseT = 1.35;
  g.banner = banner;
  g.bannerSub = sub;
  g.bannerT = 1.35;
}

function createGame(): Game {
  const g: Game = {
    p: freshMan(),
    a: freshAi(0),
    phase: "ready",
    pauseT: 0,
    round: 1,
    pWin: 0,
    aWin: 0,
    match: 1,
    lvl: 0,
    score: 0,
    counters: 0,
    coolT: 0,
    pending: "next",
    boutResult: null,
    banner: "",
    bannerSub: "",
    bannerT: 0,
    parts: [],
    floats: [],
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    over: false,
  };
  startRound(g, "MATCH 1 — HAJIME!", "Best of five · hold to charge, release to push");
  return g;
}

/* ------------------------------ actions ------------------------------ */

function startCharge(g: Game): void {
  if (g.phase !== "fight") return;
  const p = g.p;
  if (p.charging || p.dashT > 0) return;
  if (p.stam < 12) {
    floater(g, p.x, CY - 60, "GASSED — BREATHE", "#f87171");
    return;
  }
  p.charging = true;
}

function push(g: Game): void {
  if (g.phase !== "fight") return;
  const p = g.p;
  if (!p.charging) return;
  p.charging = false;
  const toward = Math.sign(g.a.x - p.x) || 1;
  if (p.charge < 8) {
    // half-hearted shove — stumbles toward him
    p.dashT = 0.2;
    p.dashSpeed = 110 * p.aim * toward;
    p.power = 5;
    floater(g, p.x, CY - 58, "STUMBLE", "#94a3b8");
  } else {
    p.dashT = 0.34;
    p.dashSpeed = (150 + p.charge * 2.3) * p.aim * toward;
    p.power = p.charge;
    burst(g, p.x, CY + WR, "#fde68a", 12, 150);
  }
  p.charge = 0;
}

function setAim(g: Game, aim: 1 | -1): void {
  g.p.aim = aim;
}

function playerPull(g: Game): void {
  const a = g.a;
  const p = g.p;
  if (g.phase !== "fight" || a.dashT <= 0) return;
  if (Math.abs(a.x - p.x) > 210) return;
  // he committed — sidestep and let his own weight finish the job
  a.dashT = 0;
  a.charging = false;
  a.charge = 0;
  a.vx = -Math.abs(a.dashSpeed || 260) * 1.5 - 60;
  p.vx = 30 * Math.sign(a.x - p.x);
  g.counters += 1;
  g.coolT = 0.55;
  g.shake = Math.max(g.shake, 11);
  g.flash = 0.55;
  g.flashC = "#fbbf24";
  burst(g, a.x - 20, CY, "#fbbf24", 22, 240);
  floater(g, a.x, CY - 74, "COUNTER PULL!", "#fde68a");
}

function aiPull(g: Game): void {
  const p = g.p;
  const a = g.a;
  p.dashT = 0;
  p.charging = false;
  p.charge = 0;
  p.vx = Math.abs(p.dashSpeed || 240) * 1.45 + 50;
  a.vx = -30;
  g.coolT = 0.55;
  g.shake = Math.max(g.shake, 10);
  g.flash = 0.45;
  g.flashC = "#fb7185";
  burst(g, p.x + 20, CY, "#fb7185", 20, 220);
  floater(g, p.x, CY - 74, "HE PULLED YOU", "#fda4af");
}

function startAiCharge(a: Ai, lvl: number): void {
  a.charging = true;
  a.state = "charge";
  a.target = 42 + Math.random() * 52 + lvl * 3;
  a.timer = 0;
}

function aiDash(g: Game): void {
  const a = g.a;
  a.charging = false;
  a.state = "dash";
  a.dashT = 0.32;
  a.dashSpeed = Math.abs(140 + a.charge * (2.1 + a.lvl * 0.08)) * (Math.sign(g.p.x - a.x) || -1);
  a.power = a.charge;
  a.charge = 0;
  burst(g, a.x, CY + WR, "#fca5a5", 10, 140);
}

function endRound(g: Game, winner: Man): void {
  if (g.phase !== "fight") return;
  g.phase = "pause";
  g.p.charging = false;
  g.a.charging = false;
  g.a.state = "recover";
  g.shake = Math.max(g.shake, 12);
  g.flash = 0.5;
  g.flashC = winner === "p" ? "#fbbf24" : "#fb7185";
  burst(g, winner === "p" ? g.a.x : g.p.x, CY, "#fde68a", 30, 300);
  if (winner === "p") {
    g.pWin += 1;
    g.score += 1;
    g.banner = "RING OUT — YOUR ROUND";
  } else {
    g.aWin += 1;
    g.banner = "RING OUT — HIS ROUND";
  }

  if (g.pWin >= 3) {
    g.score += 3;
    g.pending = "bout";
    g.boutResult = "win";
    g.banner = `MATCH ${g.match} WON · +3`;
    g.bannerSub = `Wins ${g.score} · next rival steps in`;
  } else if (g.aWin >= 3) {
    g.pending = "over";
    g.boutResult = "loss";
    g.banner = "MATCH LOST";
    g.bannerSub = "He read your rhythm";
  } else {
    g.pending = "next";
    g.bannerSub = `Round ${g.round + 1} coming up`;
  }
  g.bannerT = 2.1;
  g.pauseT = 2.5;
}

/* ------------------------------ step ------------------------------ */

function collide(g: Game): void {
  if (g.coolT > 0) return;
  const p = g.p;
  const a = g.a;
  const gap = a.x - p.x;
  if (gap > WR * 2 || gap < -WR * 2) return;

  const pDash = p.dashT > 0;
  const aDash = a.dashT > 0;
  const mid = (p.x + a.x) / 2;

  if (pDash && !aDash) {
    a.vx = p.vx * 0.95 - 20;
    p.dashT = 0;
    g.coolT = 0.32;
    g.shake = Math.max(g.shake, 8);
    burst(g, mid, CY, "#fde68a", 16, 200);
    floater(g, a.x, CY - 66, `PUSH +${Math.round(p.power)}`, "#fde68a");
  } else if (aDash && !pDash) {
    p.vx = a.vx * 0.95 + 20;
    a.dashT = 0;
    g.coolT = 0.32;
    g.shake = Math.max(g.shake, 8);
    burst(g, mid, CY, "#fca5a5", 16, 200);
    floater(g, p.x, CY - 66, "TAKEN BACK", "#fda4af");
  } else if (pDash && aDash) {
    // clash — power decides who holds the line
    if (p.power >= a.power) {
      a.vx = p.vx * 1.05 - 40;
      p.vx = Math.abs(p.vx) * 0.25;
      g.flashC = "#fbbf24";
      floater(g, a.x, CY - 66, "CLASH! HE FOLDS", "#fde68a");
    } else {
      p.vx = a.vx * 1.05 + 40;
      a.vx = Math.abs(a.vx) * 0.25;
      g.flashC = "#fb7185";
      floater(g, p.x, CY - 66, "CLASH! YOU FOLD", "#fda4af");
    }
    p.dashT = 0;
    a.dashT = 0;
    g.coolT = 0.38;
    g.shake = Math.max(g.shake, 13);
    g.flash = 0.5;
    burst(g, mid, CY, "#ffffff", 24, 260);
  } else {
    // gentle shoving match while both grip
    const shove = (p.charge - a.charge) * 0.9;
    p.vx -= shove * 0.5;
    a.vx += shove * 0.5;
    g.coolT = 0.2;
    burst(g, mid, CY, "#e7d3b3", 6, 90);
  }
  // separate
  const overlap = WR * 2 - Math.abs(gap);
  const dir = gap >= 0 ? 1 : -1;
  p.x -= dir * overlap * 0.5;
  a.x += dir * overlap * 0.5;
}

function aiThink(g: Game, dt: number): void {
  const a = g.a;
  const p = g.p;
  const lvl = a.lvl;

  if (a.pullCd > 0) a.pullCd = Math.max(0, a.pullCd - dt);

  // counter throw — punishes a telegraphed player dash
  if (
    p.dashT > 0 &&
    a.dashT <= 0 &&
    a.pullCd <= 0 &&
    Math.abs(a.x - p.x) < 210 &&
    Math.random() < (0.006 + lvl * 0.005) * dt * 60
  ) {
    aiPull(g);
    a.pullCd = 3;
    return;
  }

  if (a.state === "idle") {
    a.timer -= dt;
    if (a.timer <= 0) {
      const roll = Math.random();
      const nearEdge = Math.abs(a.x - CX) > OUT * 0.55;
      if (nearEdge) {
        // shove back toward the centre first
        a.charging = true;
        a.state = "charge";
        a.target = 55 + lvl * 4;
        a.aim = -1;
      } else if (roll < 0.18) {
        // feint: short charge then bail
        a.charging = true;
        a.state = "charge";
        a.target = 24;
        a.feint = true;
      } else {
        startAiCharge(a, lvl);
        a.aim = -1;
      }
    }
  } else if (a.state === "charge") {
    if (a.stam <= 0) {
      aiDash(g);
      return;
    }
    a.charge = Math.min(100, a.charge + (66 + lvl * 6) * dt);
    if (a.charge >= a.target) {
      if (a.feint) {
        a.feint = false;
        a.charging = false;
        a.charge = 0;
        a.state = "recover";
        a.timer = 0.35 + Math.random() * 0.4;
        floater(g, a.x, CY - 62, "FEINT", "#fed7aa");
      } else {
        aiDash(g);
      }
    }
  } else if (a.state === "dash") {
    if (a.dashT <= 0) {
      a.state = "recover";
      a.timer = 0.5 - Math.min(0.2, lvl * 0.04) + Math.random() * 0.3;
    }
  } else {
    a.timer -= dt;
    if (a.timer <= 0) {
      a.state = "idle";
      a.timer = Math.max(0.25, 1.05 - lvl * 0.1) + Math.random() * 0.5;
    }
  }
}

function stepMan(m: Wrestler, dt: number): void {
  if (m.dashT > 0) m.dashT = Math.max(0, m.dashT - dt);
  if (m.charging) {
    m.stam = Math.max(0, m.stam - 50 * dt);
  } else {
    m.stam = Math.min(MAX_STAM, m.stam + (m.dashT > 0 ? 6 : 19) * dt);
  }
  m.vx *= Math.exp(-6.2 * dt);
  m.x += m.vx * dt;
  m.flash = Math.max(0, m.flash - dt * 3);
}

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt * 1.6);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);
  if (g.coolT > 0) g.coolT = Math.max(0, g.coolT - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 60 * dt;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.15;
    f.y -= 28 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (g.phase === "ready" || g.phase === "pause") {
    g.pauseT -= dt;
    if (g.phase === "ready") {
      stepMan(g.p, dt);
      stepMan(g.a, dt);
      if (g.pauseT <= 0) {
        g.phase = "fight";
        g.bannerT = Math.max(0, g.bannerT - dt);
      }
      return;
    }
    if (g.pauseT <= 0) {
      if (g.pending === "over") {
        g.over = true;
      } else if (g.pending === "bout") {
        g.match += 1;
        g.round = 1;
        g.pWin = 0;
        g.aWin = 0;
        g.lvl += 1;
        startRound(g, `MATCH ${g.match} — HAJIME!`, "New rival · he pushes harder");
      } else {
        g.round += 1;
        startRound(g, `ROUND ${g.round}`, "Best of five continues");
      }
    }
    return;
  }

  /* fight */
  const p = g.p;
  const a = g.a;

  // player auto-releases when he runs out of breath
  if (p.charging && p.stam <= 0) push(g);

  if (p.charging) p.charge = Math.min(100, p.charge + 92 * dt);

  aiThink(g, dt);
  if (a.charging && a.stam <= 0) aiDash(g);

  // dust kicks while dashing
  if (p.dashT > 0) burst(g, p.x - p.aim * 10, CY + WR - 4, "#d6b98c", 2, 90);
  if (a.dashT > 0) burst(g, a.x + 10, CY + WR - 4, "#d6b98c", 2, 90);

  stepMan(p, dt);
  stepMan(a, dt);
  collide(g);

  if (CX - p.x >= OUT) endRound(g, "a");
  else if (a.x - CX >= OUT) endRound(g, "p");
}

/* ------------------------------ render ------------------------------ */

function drawRing(ctx: CanvasRenderingContext2D, time: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a0f04");
  bg.addColorStop(0.55, "#140b04");
  bg.addColorStop(1, "#0c0703");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // spotlight
  const spot = ctx.createRadialGradient(CX, CY, 30, CX, CY, 330);
  spot.addColorStop(0, "rgba(251, 191, 36, 0.14)");
  spot.addColorStop(1, "rgba(251, 191, 36, 0)");
  ctx.fillStyle = spot;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // sand
  ctx.fillStyle = "#c8a06a";
  ctx.beginPath();
  ctx.arc(CX, CY, RING, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(90, 60, 25, 0.35)";
  for (let i = 0; i < 90; i++) {
    const a = (i * 2.399) % TAU;
    const r = ((i * 37) % 100) * (RING / 100);
    ctx.beginPath();
    ctx.arc(CX + Math.cos(a) * r, CY + Math.sin(a) * r, 1.6, 0, TAU);
    ctx.fill();
  }

  // tawara (straw bale ring)
  ctx.strokeStyle = "#7c4a1e";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(CX, CY, RING + 2, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = "rgba(253, 230, 138, 0.85)";
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 12]);
  ctx.lineDashOffset = -time / 60;
  ctx.beginPath();
  ctx.arc(CX, CY, RING + 2, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  // centre line
  ctx.strokeStyle = "rgba(124, 74, 30, 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CX - 26, CY - RING + 16);
  ctx.lineTo(CX + 26, CY - RING + 16);
  ctx.moveTo(CX - 26, CY + RING - 16);
  ctx.lineTo(CX + 26, CY + RING - 16);
  ctx.stroke();
}

function drawRikishi(
  ctx: CanvasRenderingContext2D,
  g: Game,
  side: Man,
  time: number,
): void {
  const isP = side === "p";
  const m = isP ? g.p : g.a;
  const main = isP ? "#fbbf24" : "#f43f5e";
  const trim = isP ? "#92400e" : "#881337";

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(m.x, CY + WR - 2, WR - 2, 8, 0, 0, TAU);
  ctx.fill();

  // charge aura
  if (m.charging) {
    const frac = m.charge / 100;
    const pulse = 0.6 + Math.sin(time / 90) * 0.4;
    ctx.save();
    ctx.globalAlpha = 0.35 + frac * 0.5;
    ctx.shadowColor = main;
    ctx.shadowBlur = 18 + pulse * 14;
    ctx.strokeStyle = main;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(m.x, CY, WR + 9, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
    ctx.stroke();
    ctx.restore();
  }

  // body
  ctx.save();
  ctx.shadowColor = hexA(main, 0.7);
  ctx.shadowBlur = m.dashT > 0 ? 22 : 10;
  ctx.fillStyle = m.flash > 0 ? "#ffffff" : main;
  ctx.beginPath();
  ctx.arc(m.x, CY, WR, 0, TAU);
  ctx.fill();
  ctx.restore();

  // mawashi belt
  ctx.strokeStyle = trim;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(m.x, CY, WR - 7, -0.9, 0.9);
  ctx.stroke();
  ctx.fillStyle = trim;
  ctx.beginPath();
  ctx.arc(m.x + (isP ? 6 : -6), CY, 5, 0, TAU);
  ctx.fill();

  // head
  ctx.fillStyle = "#fde9c8";
  ctx.beginPath();
  ctx.arc(m.x + (isP ? 12 : -12), CY - 6, 10, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#3f2a12";
  ctx.beginPath();
  ctx.arc(m.x + (isP ? 15 : -15), CY - 11, 3.5, 0, TAU);
  ctx.fill();

  // arms reaching toward the opponent
  ctx.strokeStyle = "#fde9c8";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(m.x + (isP ? 14 : -14), CY + 4);
  ctx.lineTo(m.x + (isP ? 30 : -30), CY + (m.charging ? -14 : 6));
  ctx.stroke();

  // aim arrow while charging
  if (m.charging) {
    ctx.fillStyle = hexA(main, 0.85);
    const ax = m.x + m.aim * (WR + 22);
    ctx.beginPath();
    ctx.moveTo(ax + m.aim * 10, CY);
    ctx.lineTo(ax, CY - 6);
    ctx.lineTo(ax, CY + 6);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  frac: number,
  color: string,
  alignRight: boolean,
): void {
  ctx.fillStyle = "rgba(2, 6, 23, 0.75)";
  ctx.beginPath();
  ctx.roundRect(x - 2, y - 2, w + 4, 12, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(148, 163, 184, 0.18)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, 8, 4);
  ctx.fill();
  const fw = Math.max(0, w * Math.min(1, frac));
  if (fw > 0.5) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(alignRight ? x + w - fw : x, y, fw, 8, 4);
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

  drawRing(ctx, time);

  if (g) {
    drawRikishi(ctx, g, "a", time);
    drawRikishi(ctx, g, "p", time);

    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // stamina + charge
    drawBar(ctx, 18, 20, 180, g.p.stam / MAX_STAM, g.p.stam > 30 ? "#fbbf24" : "#f43f5e", false);
    drawBar(ctx, W - 198, 20, 180, g.a.stam / MAX_STAM, g.a.stam > 30 ? "#fb7185" : "#f43f5e", true);
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fde68a";
    ctx.fillText("YOU", 18, 46);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fda4af";
    ctx.fillText(`RIVAL${g.a.lvl > 0 ? ` ×${g.a.lvl + 1}` : ""}`, W - 18, 46);

    // round pips (best of five)
    const pip = (x: number, won: number, color: string, right: boolean) => {
      for (let i = 0; i < 3; i++) {
        const px = right ? x - i * 16 : x + i * 16;
        ctx.fillStyle = i < won ? color : "rgba(148, 163, 184, 0.25)";
        ctx.beginPath();
        ctx.arc(px, 62, 5, 0, TAU);
        ctx.fill();
      }
    };
    pip(24, g.pWin, "#fbbf24", false);
    pip(W - 24, g.aWin, "#fb7185", true);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillText(`MATCH ${g.match} · ROUND ${g.round} · BEST OF FIVE`, W / 2, 66);

    // score
    ctx.font = "800 26px ui-monospace, monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(g.score), W / 2, 108);
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.fillStyle = "rgba(253, 230, 138, 0.9)";
    ctx.fillText("WINS", W / 2, 122);

    // AI state tell
    if (g.phase === "fight" && g.a.state === "charge") {
      ctx.font = "800 11px ui-monospace, monospace";
      ctx.fillStyle = "#fca5a5";
      ctx.fillText("HE'S LOADING…", g.a.x, CY - WR - 26);
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
      ctx.shadowColor = "rgba(251, 146, 60, 0.9)";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, CY - 96);
      ctx.shadowBlur = 0;
      ctx.font = "700 12px ui-monospace, monospace";
      ctx.fillStyle = "rgba(254, 243, 199, 0.9)";
      ctx.fillText(g.bannerSub, W / 2, CY - 76);
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

export default function SumoShowdown({ gameId = "sumo-showdown" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState("0–0");
  const [counters, setCounters] = useState(0);
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
    setRounds("0–0");
    setCounters(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const chargeDown = useCallback(() => {
    const g = gameRef.current;
    if (g) startCharge(g);
  }, []);

  const chargeUp = useCallback(() => {
    const g = gameRef.current;
    if (g) push(g);
  }, []);

  const stepDir = useCallback((dir: 1 | -1) => {
    const g = gameRef.current;
    if (!g) return;
    if (dir === -1) playerPull(g);
    setAim(g, dir);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastRounds = "";
    let lastCounters = -1;
    let lastStreak = -1;

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
      const rs = `${g.pWin}–${g.aWin}`;
      if (rs !== lastRounds) {
        lastRounds = rs;
        setRounds(rs);
      }
      if (g.counters !== lastCounters) {
        lastCounters = g.counters;
        setCounters(g.counters);
      }
      if (g.boutResult && lastStreak !== g.match) {
        lastStreak = g.match;
        setStreak(g.boutResult === "win" ? (s: number) => s + 1 : 0);
      }

      draw(t);
      if (g.over) {
        setScore(g.score);
        setNewBest(submit(g.score));
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
        if (status !== "playing") {
          start();
          return;
        }
        if (e.key === " " && !e.repeat) chargeDown();
        return;
      }
      if (status !== "playing") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (!e.repeat) stepDir(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (!e.repeat) stepDir(1);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") chargeUp();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start, chargeDown, chargeUp, stepDir]);

  const padBtn =
    "touch-none rounded-xl border bg-surface py-3 font-mono text-xs font-bold uppercase tracking-wider transition active:scale-95";

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={score} best={best ?? "—"} accent="text-amber-300">
        <span className="text-orange-300">
          Rounds <b className="ml-1 text-sm text-ink">{rounds}</b>
        </span>
        <span className="text-yellow-200">
          Pulls <b className="ml-1 text-sm text-ink">{counters}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(249,115,22,0.85)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Sumo Showdown dohyo"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">SUMO SHOWDOWN</p>
            <p className="mt-2 text-sm text-muted">
              Best of five in the sand ring. Hold to charge — power builds but stamina drains —
              then release to launch. Aim forward to drive him out, back to bait him. When he
              commits to a push, tap back at the last moment for a counter throw that finishes the
              job for you. First to three rounds takes the match.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Step into the ring
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Hold Space / hold button to charge · ← → aim · tap ← as he pushes to pull
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">TILTED OUT</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Wins · streak {streak} · best {best ?? "—"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {counters} counter pull{counters === 1 ? "" : "s"} landed
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Bait the push, then tap back to send him flying</p>
          </Overlay>
        )}
      </div>

      <div className="mt-2 grid touch-none select-none grid-cols-3 gap-2">
        <button
          type="button"
          onPointerDown={() => stepDir(-1)}
          aria-label="Aim back and pull — key Left"
          className={`${padBtn} border-amber-400/50 text-amber-300`}
        >
          ← Back
        </button>
        <button
          type="button"
          onPointerDown={chargeDown}
          onPointerUp={chargeUp}
          onPointerLeave={chargeUp}
          onPointerCancel={chargeUp}
          aria-label="Charge and push — hold Space"
          className={`${padBtn} border-orange-400/60 text-orange-300`}
        >
          Charge
        </button>
        <button
          type="button"
          onPointerDown={() => stepDir(1)}
          aria-label="Aim forward — key Right"
          className={`${padBtn} border-red-400/50 text-red-300`}
        >
          Forward →
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Hold to load the hips · release to drive · pull beats his commit
      </p>
    </div>
  );
}
