"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 540;
const TAU = Math.PI * 2;
const TONE = "from-rose-400 via-pink-500 to-fuchsia-600";
const CLOCK0 = 180; // three-minute round (runs fast)
const PX = 186; // player x
const AX = 294; // AI x
const GY = 430; // ground line
const PUNCH_DUR = 0.34;

type Status = "idle" | "playing" | "over";
type Kind = "jab" | "hook" | "upper";
type Phase = "fight" | "pause";
type Pending = "next" | "bout" | "over";

const COST: Record<Kind, number> = { jab: 5, hook: 8, upper: 11 };
const DMG: Record<Kind, number> = { jab: 7, hook: 10, upper: 13 };
const NAME: Record<Kind, string> = { jab: "JAB · J", hook: "HOOK · K", upper: "UPPER · L" };
const COL: Record<Kind, string> = { jab: "#a5f3fc", hook: "#fbbf24", upper: "#f472b6" };

interface Guy {
  hp: number;
  stamina: number;
  duck: boolean;
  punchT: number;
  punchK: Kind;
  stunT: number;
  flashT: number;
}

interface Ai extends Guy {
  state: "idle" | "wind" | "strike" | "recover";
  timer: number;
  dur: number;
  kind: Kind;
  queue: Kind[];
  decide: number;
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

interface Game {
  p: Guy;
  a: Ai;
  round: number;
  bout: number;
  pWin: number;
  aWin: number;
  clock: number;
  score: number;
  counters: number;
  whiffs: number;
  lvl: number;
  phase: Phase;
  pauseT: number;
  pending: Pending;
  banner: string;
  bannerT: number;
  boutEvent: "won" | "lost" | null;
  fallen: "p" | "a" | null;
  over: boolean;
  parts: Part[];
  floats: Floater[];
  shake: number;
  flash: number;
  flashC: string;
  hitStop: number;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
}

function burst(g: Game, x: number, y: number, c: string, n: number, power: number): void {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * TAU;
    const sp = power * (0.4 + Math.random() * 0.6);
    g.parts.push({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: 0.35 + Math.random() * 0.4,
      max: 0.75,
      r: 1.5 + Math.random() * 2.4,
      c,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, c: string): void {
  g.floats.push({ x, y, text, life: 1, c });
}

function freshGuy(): Guy {
  return { hp: 100, stamina: 100, duck: false, punchT: 0, punchK: "jab", stunT: 0, flashT: 0 };
}

function freshAi(lvl: number): Ai {
  return {
    ...freshGuy(),
    state: "idle",
    timer: 0,
    dur: windDur(lvl),
    kind: "jab",
    queue: [],
    decide: 1.1,
  };
}

function windDur(lvl: number): number {
  return Math.max(0.34, 0.92 - lvl * 0.07);
}

function startRound(g: Game, banner: string): void {
  g.p = freshGuy();
  g.a = freshAi(g.lvl);
  g.clock = CLOCK0;
  g.phase = "fight";
  g.fallen = null;
  g.banner = banner;
  g.bannerT = 1.8;
}

function createGame(): Game {
  const g: Game = {
    p: freshGuy(),
    a: freshAi(0),
    round: 1,
    bout: 1,
    pWin: 0,
    aWin: 0,
    clock: CLOCK0,
    score: 0,
    counters: 0,
    whiffs: 0,
    lvl: 0,
    phase: "fight",
    pauseT: 0,
    pending: "next",
    banner: "",
    bannerT: 0,
    boutEvent: null,
    fallen: null,
    over: false,
    parts: [],
    floats: [],
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    hitStop: 0,
  };
  startRound(g, "ROUND 1 — FIGHT!");
  return g;
}

function endRound(g: Game, winner: "p" | "a", ko: boolean): void {
  if (g.phase !== "fight") return;
  g.phase = "pause";
  g.a.queue = [];
  g.a.state = "idle";
  g.p.duck = false;
  if (winner === "p") {
    g.pWin += 1;
    g.score += 1;
    g.fallen = "a";
  } else {
    g.aWin += 1;
    g.fallen = "p";
  }
  if (ko) {
    g.shake = 14;
    g.flash = 0.6;
    g.flashC = winner === "p" ? "#fde68a" : "#fb7185";
    g.hitStop = 0.12;
    burst(g, winner === "p" ? AX : PX, GY - 70, winner === "p" ? "#fde68a" : "#fb7185", 26, 240);
  }
  if (g.pWin >= 3) {
    g.score += 3;
    g.boutEvent = "won";
    g.pending = "bout";
    g.banner = `BOUT ${g.bout} WON · +3`;
    g.bannerT = 2.6;
  } else if (g.aWin >= 3) {
    g.boutEvent = "lost";
    g.pending = "over";
    g.banner = "BOUT LOST";
    g.bannerT = 2.6;
  } else {
    g.pending = "next";
    g.banner = ko
      ? winner === "p"
        ? "KNOCKDOWN! · YOU TAKE IT"
        : "YOU'RE DOWN"
      : winner === "p"
        ? "BELL · YOU TAKE IT"
        : "BELL · ROUND LOST";
    g.bannerT = 2.4;
  }
  g.pauseT = g.bannerT + 0.5;
}

function startCombo(a: Ai, lvl: number): void {
  const kinds: Kind[] = ["jab", "hook", "upper"];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const n = 1 + (Math.random() < 0.5 ? 1 : 0) + (lvl >= 2 && Math.random() < 0.45 ? 1 : 0);
  a.queue = kinds.slice(0, Math.min(3, n));
  a.kind = a.queue.shift() ?? "jab";
  a.dur = windDur(lvl);
  a.timer = a.dur;
  a.state = "wind";
}

function aiStrike(g: Game): void {
  const a = g.a;
  const k = a.kind;
  const ducked = g.p.duck && g.p.stunT <= 0;
  if (ducked && k !== "upper") {
    floater(g, PX, GY - 140, "WHIFF", "#a5f3fc");
    g.p.stamina = Math.min(100, g.p.stamina + 7); // ducking a punch pays you back
    g.whiffs += 1;
    burst(g, PX + 26, GY - 86, "#67e8f9", 8, 120);
    return;
  }
  let d = DMG[k];
  if (ducked && k === "upper") d = Math.round(d * 1.3); // uppercut punishes the duck
  if (g.p.punchT > 0) d = Math.round(d * 1.35); // caught mid-punch
  g.p.hp = Math.max(0, g.p.hp - d);
  g.p.flashT = 0.28;
  g.p.duck = false;
  g.shake = Math.max(g.shake, k === "upper" ? 9 : 6);
  g.flash = 0.32;
  g.flashC = "#fb7185";
  g.hitStop = k === "upper" ? 0.06 : 0.04;
  burst(g, PX + 26, GY - 90, "#fb7185", 12, 170);
  floater(g, PX, GY - 134, `-${d}`, "#fda4af");
}

function punch(g: Game, k: Kind): void {
  if (g.over || g.phase !== "fight") return;
  const p = g.p;
  if (p.stunT > 0 || p.punchT > 0 || p.duck) return;
  if (p.stamina < COST[k]) {
    floater(g, PX, GY - 148, "GASSED", "#f87171");
    return;
  }
  p.stamina -= COST[k];
  p.punchT = PUNCH_DUR;
  p.punchK = k;

  const a = g.a;
  if (a.state !== "wind" && a.stunT <= 0 && g.lvl >= 2 && Math.random() < 0.13) {
    floater(g, AX, GY - 150, "SLIP", "#e2e8f0");
    return;
  }

  const weak = p.stamina < 25 ? 0.6 : 1;
  let d: number;
  if (a.state === "wind" && a.kind === k) {
    // read the shoulder → clean counter
    d = Math.round(DMG[k] * 2.2 * weak);
    a.hp = Math.max(0, a.hp - d);
    a.stunT = 1.15;
    a.state = "idle";
    a.queue = [];
    a.decide = 0.95;
    g.counters += 1;
    g.shake = 11;
    g.flash = 0.5;
    g.flashC = "#ffffff";
    g.hitStop = 0.08;
    burst(g, AX - 26, GY - 92, "#fde68a", 20, 220);
    floater(g, AX, GY - 152, "COUNTER!", "#fde68a");
    floater(g, AX, GY - 130, `-${d}`, "#fffbeb");
  } else {
    d = Math.round(DMG[k] * weak * (a.state === "wind" ? 0.7 : 0.95));
    a.hp = Math.max(0, a.hp - d);
    g.shake = Math.max(g.shake, 3.5);
    burst(g, AX - 24, GY - 92, k === "upper" ? "#f472b6" : "#e2e8f0", 8, 150);
    floater(g, AX, GY - 138, `-${d}`, "#fda4af");
  }
  a.flashT = 0.22;
}

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 30);
  g.flash = Math.max(0, g.flash - dt * 1.7);
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

  if (g.hitStop > 0) {
    g.hitStop -= dt;
    return;
  }

  if (g.phase === "pause") {
    g.pauseT -= dt;
    if (g.pauseT <= 0) {
      if (g.pending === "over") {
        g.over = true;
      } else if (g.pending === "bout") {
        g.bout += 1;
        g.lvl += 1;
        g.round = 1;
        g.pWin = 0;
        g.aWin = 0;
        startRound(g, `BOUT ${g.bout} — FIGHT!`);
      } else {
        g.round += 1;
        startRound(g, `ROUND ${g.round}`);
      }
      g.pending = "next";
    }
    return;
  }

  /* ------------------------------ fight ------------------------------ */

  g.clock = Math.max(0, g.clock - dt * 3);

  const p = g.p;
  const a = g.a;
  if (p.punchT > 0) p.punchT = Math.max(0, p.punchT - dt);
  if (p.stunT > 0) {
    p.stunT = Math.max(0, p.stunT - dt);
    if (p.stunT === 0) p.duck = false;
  }
  if (p.flashT > 0) p.flashT = Math.max(0, p.flashT - dt);
  if (p.duck && p.stunT <= 0) p.stamina = Math.max(0, p.stamina - 7 * dt);
  else if (p.punchT <= 0) p.stamina = Math.min(100, p.stamina + 9 * dt);

  if (a.punchT > 0) a.punchT = Math.max(0, a.punchT - dt);
  if (a.flashT > 0) a.flashT = Math.max(0, a.flashT - dt);

  if (a.stunT > 0) {
    a.stunT = Math.max(0, a.stunT - dt);
  } else if (a.state === "idle") {
    a.decide -= dt;
    if (a.decide <= 0) startCombo(a, g.lvl + (g.round - 1) * 0.4);
  } else if (a.state === "wind") {
    a.timer -= dt;
    if (a.timer <= 0) {
      a.state = "strike";
      a.timer = 0.2;
      a.punchT = PUNCH_DUR;
      a.punchK = a.kind;
      aiStrike(g);
    }
  } else if (a.state === "strike") {
    a.timer -= dt;
    if (a.timer <= 0) {
      a.state = a.queue.length > 0 ? "wind" : "recover";
      if (a.state === "wind") {
        a.kind = a.queue.shift() ?? "jab";
        a.dur = windDur(g.lvl) * 0.85;
        a.timer = a.dur;
      } else {
        a.timer = Math.max(0.4, 1.25 - g.lvl * 0.09) + Math.random() * 0.5;
      }
    }
  } else {
    a.timer -= dt;
    if (a.timer <= 0) {
      a.state = "idle";
      a.decide = 0;
    }
  }

  if (p.hp <= 0) {
    endRound(g, "a", true);
  } else if (a.hp <= 0) {
    endRound(g, "p", true);
  } else if (g.clock <= 0) {
    endRound(g, p.hp >= a.hp ? "p" : "a", false);
  }
}

/* ------------------------------ render ------------------------------ */

function drawArena(ctx: CanvasRenderingContext2D, time: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1e0812");
  bg.addColorStop(0.5, "#15060d");
  bg.addColorStop(1, "#0a0409");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // crowd
  const crowd = ["#fb7185", "#f472b6", "#fbbf24", "#fde68a", "#e2e8f0"];
  for (let i = 0; i < 74; i++) {
    const cx = ((i * 67) % (W + 20)) - 10;
    const cy = 2 + ((i * 41) % 64);
    ctx.fillStyle = crowd[i % crowd.length];
    ctx.globalAlpha = 0.1 + ((i * 7) % 10) * 0.03 + Math.sin(time / 520 + i) * 0.04;
    ctx.fillRect(cx, cy, 3, 3);
  }
  ctx.globalAlpha = 1;

  // spotlight
  const spot = ctx.createRadialGradient(W / 2, GY - 40, 30, W / 2, GY - 40, 260);
  spot.addColorStop(0, "rgba(244, 114, 182, 0.16)");
  spot.addColorStop(1, "rgba(244, 114, 182, 0)");
  ctx.fillStyle = spot;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // mat
  ctx.fillStyle = "rgba(244, 63, 94, 0.06)";
  ctx.beginPath();
  ctx.ellipse(W / 2, GY + 46, 216, 62, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(251, 113, 133, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // ropes
  const ropes = [
    { y: GY - 168, c: "#fb7185" },
    { y: GY - 122, c: "#f472b6" },
    { y: GY - 76, c: "#fda4af" },
  ];
  for (const r of ropes) {
    ctx.strokeStyle = hexA(r.c, 0.5);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, r.y);
    ctx.quadraticCurveTo(W / 2, r.y + 7, W - 14, r.y);
    ctx.stroke();
  }
  // posts
  ctx.strokeStyle = "rgba(190, 18, 60, 0.9)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(16, GY + 20);
  ctx.lineTo(16, GY - 178);
  ctx.moveTo(W - 16, GY + 20);
  ctx.lineTo(W - 16, GY - 178);
  ctx.stroke();

  // canvas floor
  ctx.fillStyle = "rgba(127, 29, 29, 0.25)";
  ctx.fillRect(-14, GY + 6, W + 28, H - GY + 8);
}

function drawGuy(ctx: CanvasRenderingContext2D, g: Game, side: "p" | "a", time: number): void {
  const isP = side === "p";
  const guy = isP ? g.p : g.a;
  const x = isP ? PX : AX;
  const face = isP ? 1 : -1;
  const main = isP ? "#22d3ee" : "#fb7185";
  const trim = isP ? "#0e7490" : "#9f1239";
  const down = g.fallen === side;
  const duck = isP && guy.duck && guy.stunT <= 0;
  const bob = Math.sin(time / 300 + (isP ? 0 : 1.7)) * 2;

  // shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(x, GY + 4, 24, 7, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(x, GY + bob);
  if (down) ctx.rotate(-face * 1.5);
  if (duck) ctx.translate(face * 4, 14);

  const bodyFill = guy.flashT > 0 ? "#ffffff" : main;
  const blink = guy.stunT > 0 && Math.floor(time / 90) % 2 === 0;
  const skin = blink ? "#ffffff" : bodyFill;

  // legs
  ctx.strokeStyle = trim;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, -34);
  ctx.lineTo(-10, -2);
  ctx.moveTo(6, -34);
  ctx.lineTo(11, -2);
  ctx.stroke();

  // shorts
  ctx.fillStyle = guy.flashT > 0 ? "#ffffff" : trim;
  ctx.beginPath();
  ctx.roundRect(-12, -44, 24, 18, 5);
  ctx.fill();

  // torso
  ctx.save();
  ctx.shadowColor = hexA(main, 0.7);
  ctx.shadowBlur = 14;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.roundRect(-13, -78, 26, 40, 9);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = hexA(trim, 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-13, -78, 26, 40, 9);
  ctx.stroke();

  // head + guard
  ctx.save();
  ctx.shadowColor = hexA(main, 0.8);
  ctx.shadowBlur = 12;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(face * 2, -92, 12, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = hexA(trim, 0.95);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(face * 2, -92, 12, Math.PI * 0.15, Math.PI * 1.15);
  ctx.stroke();
  // eye
  ctx.fillStyle = "#0b0410";
  ctx.beginPath();
  ctx.arc(face * 7, -93, 2, 0, TAU);
  ctx.fill();

  // arms + gloves
  const punching = guy.punchT > 0;
  const prog = punching ? 1 - guy.punchT / PUNCH_DUR : 0;
  const ext = punching ? Math.sin(prog * Math.PI) * 86 : 0;
  const sx = face * 10;
  const sy = -72;
  const guardY = duck ? -84 : -74;
  const gloveX = punching ? sx + face * ext : sx + face * 16;
  const gloveY = punching ? -78 : guardY;

  ctx.strokeStyle = skin;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo((sx + gloveX) / 2, sy + 6, gloveX, gloveY);
  ctx.stroke();

  const gloveCol = punching ? "#ffffff" : main;
  ctx.save();
  ctx.shadowColor = hexA(main, 0.9);
  ctx.shadowBlur = punching ? 18 : 8;
  ctx.fillStyle = guy.flashT > 0 ? "#ffffff" : gloveCol;
  ctx.beginPath();
  ctx.arc(gloveX, gloveY + 4, 9, 0, TAU);
  ctx.fill();
  ctx.restore();
  // rear guard glove
  ctx.fillStyle = guy.flashT > 0 ? "#ffffff" : trim;
  ctx.beginPath();
  ctx.arc(sx - face * 6, guardY + 8, 8, 0, TAU);
  ctx.fill();

  // stun stars
  if (guy.stunT > 0) {
    ctx.fillStyle = "#fde68a";
    for (let i = 0; i < 3; i++) {
      const a2 = time / 140 + (i * TAU) / 3;
      ctx.beginPath();
      ctx.arc(Math.cos(a2) * 16, -112 + Math.sin(a2) * 5, 2.6, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();

  // AI shoulder telegraph
  if (!isP && g.a.state === "wind") {
    const a = g.a;
    const c = COL[a.kind];
    const k = 1 - a.timer / a.dur; // 0 → 1 toward impact
    const pulse = Math.abs(Math.sin(time / (150 - k * 90)));
    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = 16 + pulse * 10;
    ctx.strokeStyle = hexA(c, 0.55 + pulse * 0.45);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(AX - 10, GY - 74 + bob, 8 + pulse * 4, 0, TAU);
    ctx.stroke();
    ctx.restore();
    // label
    ctx.save();
    ctx.globalAlpha = 0.55 + pulse * 0.45;
    ctx.font = "800 12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = c;
    ctx.fillText(NAME[a.kind], AX, GY - 138 + bob);
    // shrinking timing ring
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(AX, GY - 120 + bob, 9, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k));
    ctx.stroke();
    ctx.restore();
  }
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  color: string,
  alignRight: boolean,
): void {
  ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
  ctx.beginPath();
  ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 7);
  ctx.fill();
  ctx.fillStyle = "rgba(148, 163, 184, 0.18)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  const fw = Math.max(0, w * Math.min(1, frac));
  if (fw > 0.5) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(alignRight ? x + w - fw : x, y, fw, h, 4);
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

  drawArena(ctx, time);

  if (g) {
    drawGuy(ctx, g, "p", time);
    drawGuy(ctx, g, "a", time);

    // HUD bars
    const pFrac = g.p.hp / 100;
    const aFrac = g.a.hp / 100;
    drawBar(ctx, 18, 18, 180, 15, pFrac, pFrac > 0.5 ? "#22d3ee" : pFrac > 0.25 ? "#fbbf24" : "#f43f5e", false);
    drawBar(ctx, W - 198, 18, 180, 15, aFrac, aFrac > 0.5 ? "#fb7185" : aFrac > 0.25 ? "#fbbf24" : "#f43f5e", true);
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#a5f3fc";
    ctx.fillText("YOU", 18, 48);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fda4af";
    ctx.fillText("RIVAL", W - 18, 48);

    // round pips
    const pip = (x: number, won: number, color: string, align: CanvasTextAlign) => {
      ctx.textAlign = align;
      for (let i = 0; i < 3; i++) {
        const px = align === "left" ? x + i * 16 : x - i * 16;
        ctx.fillStyle = i < won ? color : "rgba(148, 163, 184, 0.28)";
        ctx.beginPath();
        ctx.arc(px, 64, 5, 0, TAU);
        ctx.fill();
      }
    };
    pip(24, g.pWin, "#22d3ee", "left");
    pip(W - 24, g.aWin, "#fb7185", "right");
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(226, 232, 240, 0.55)";
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillText(`BOUT ${g.bout} · FIRST TO 3`, W / 2, 66);

    // clock
    const secs = Math.max(0, Math.ceil(g.clock));
    const mm = Math.floor(secs / 60);
    const ss = String(secs % 60).padStart(2, "0");
    const urgent = secs <= 20;
    ctx.font = "800 30px ui-monospace, monospace";
    ctx.fillStyle = urgent && Math.floor(time / 300) % 2 === 0 ? "#f43f5e" : "#ffffff";
    ctx.fillText(`${mm}:${ss}`, W / 2, 44);

    // stamina
    const st = g.p.stamina / 100;
    drawBar(
      ctx,
      W / 2 - 130,
      H - 34,
      260,
      11,
      st,
      st > 0.45 ? "#34d399" : st > 0.22 ? "#fbbf24" : "#f43f5e",
      false,
    );
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(154, 154, 182, 0.9)";
    ctx.fillText("STAMINA", W / 2, H - 40);

    // particles
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // floaters
    ctx.font = "800 14px ui-monospace, monospace";
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
      ctx.shadowColor = "rgba(244, 63, 94, 0.9)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 40);
      ctx.restore();
    }

    if (g.flash > 0.01) {
      ctx.fillStyle = hexA(g.flashC, g.flash * 0.32);
      ctx.fillRect(-14, -14, W + 28, H + 28);
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function ChinCheck({ gameId = "chin-check" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
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
    setCounters(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const hit = useCallback((k: Kind) => {
    const g = gameRef.current;
    if (g) punch(g, k);
  }, []);

  const setDuck = useCallback((on: boolean) => {
    const g = gameRef.current;
    if (g && g.phase === "fight" && g.p.stunT <= 0) g.p.duck = on;
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      if (g.boutEvent) {
        if (g.boutEvent === "won") setStreak((s) => s + 1);
        else setStreak(0);
        g.boutEvent = null;
      }
      if (g.score !== lastScore) {
        lastScore = g.score;
        setScore(g.score);
      }

      draw(t);
      if (g.over) {
        setScore(g.score);
        setCounters(g.counters);
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
        if (status !== "playing") start();
        return;
      }
      if (status !== "playing") return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "j" || key === "k" || key === "l") {
        if (e.repeat) return;
        hit(key === "j" ? "jab" : key === "k" ? "hook" : "upper");
      } else if (key === "s") {
        e.preventDefault();
        setDuck(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "s") setDuck(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start, hit, setDuck]);

  const padBtn =
    "touch-none rounded-xl border bg-surface py-3 font-mono text-xs font-bold uppercase tracking-wider transition active:scale-95";

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-pink-300">
          Streak <b className="ml-1 text-sm text-ink">{streak}</b>
        </span>
        <span className="text-rose-300">
          Counters <b className="ml-1 text-sm text-ink">{counters}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(244,63,94,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Chin Check boxing ring"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">CHIN CHECK</p>
            <p className="mt-2 text-sm text-muted">
              Three-minute rounds, best of five. Every rival combo telegraphs itself — his
              shoulder flashes the punch that&apos;s coming. Catch the matching punch during the
              wind-up for a counter that stuns him. Punches burn stamina, ducks burn slower,
              and whoever&apos;s still standing at the bell takes the round.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Step in
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              J jab · K hook · L uppercut · S duck — or tap the pads below
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">COUNTED OUT</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Wins · Best {best ?? "—"} · streak {streak}
            </p>
            <p className="mt-1 text-xs text-muted">
              {counters} counter{counters === 1 ? "" : "s"} landed this run
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Read the shoulder — matching punch on the flash = stun
            </p>
          </Overlay>
        )}
      </div>

      <div className="mt-2 grid touch-none select-none grid-cols-4 gap-2">
        <button
          type="button"
          onPointerDown={() => hit("jab")}
          aria-label="Jab — key J"
          className={`${padBtn} border-cyan-400/50 text-cyan-300`}
        >
          Jab
        </button>
        <button
          type="button"
          onPointerDown={() => hit("hook")}
          aria-label="Hook — key K"
          className={`${padBtn} border-amber-400/50 text-amber-300`}
        >
          Hook
        </button>
        <button
          type="button"
          onPointerDown={() => hit("upper")}
          aria-label="Uppercut — key L"
          className={`${padBtn} border-pink-400/50 text-pink-300`}
        >
          Upper
        </button>
        <button
          type="button"
          onPointerDown={() => setDuck(true)}
          onPointerUp={() => setDuck(false)}
          onPointerLeave={() => setDuck(false)}
          onPointerCancel={() => setDuck(false)}
          aria-label="Duck — hold key S"
          className={`${padBtn} border-rose-400/50 text-rose-300`}
        >
          Duck
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Shoulder flash = incoming punch · matching key mid wind-up = counter
      </p>
    </div>
  );
}
