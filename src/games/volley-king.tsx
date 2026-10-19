"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 520;
const TAU = Math.PI * 2;
const TONE = "from-cyan-400 via-sky-500 to-blue-600";

const GROUND = 430;
const NET_X = 240;
const NET_TOP = 210;
const L_LINE = 64;
const R_LINE = 416;
const GRAV = 900;
const TO_WIN = 21;
const BALL_R = 10;

type Status = "idle" | "playing" | "over";
type Team = "p" | "a";
type Phase = "serve" | "play";

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
interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
}

interface Game {
  phase: Phase;
  server: Team;
  serveT: number;
  att: Team | null;
  stage: number; // 0 free ball · 1 bumped · 2 set
  stageTeam: Team;
  unreturnable: boolean;
  netHit: boolean;
  ball: Pt;
  vel: Pt;
  trail: Pt[];
  px: [number, number];
  ax: [number, number];
  actP: 0 | 1;
  actA: 0 | 1;
  pScore: number;
  aScore: number;
  streak: number;
  maxStreak: number;
  rally: number;
  aSetIn: number;
  aSpikeIn: number;
  aTarget: number;
  hitP: number;
  hitA: number;
  streakEvent: boolean;
  parts: Part[];
  floats: Floater[];
  banner: string;
  bannerT: number;
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
      life: 0.3 + Math.random() * 0.5,
      max: 0.8,
      r: 1.4 + Math.random() * 2.4,
      c,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, c: string): void {
  g.floats.push({ x, y, text, life: 1, c });
}

function home(team: Team, i: 0 | 1): number {
  if (team === "p") return i === 0 ? 112 : 186;
  return i === 0 ? 300 : 374;
}

function createGame(streakIn: number): Game {
  const g: Game = {
    phase: "serve",
    server: "p",
    serveT: 1.1,
    att: null,
    stage: 0,
    stageTeam: "p",
    unreturnable: false,
    netHit: false,
    ball: { x: 150, y: 330 },
    vel: { x: 0, y: 0 },
    trail: [],
    px: [112, 186],
    ax: [300, 374],
    actP: 1,
    actA: 0,
    pScore: 0,
    aScore: 0,
    streak: streakIn,
    maxStreak: streakIn,
    rally: 0,
    aSetIn: 0,
    aSpikeIn: 0,
    aTarget: 0,
    hitP: 0,
    hitA: 0,
    streakEvent: false,
    parts: [],
    floats: [],
    banner: "YOUR SERVE — TAP OR SPACE",
    bannerT: 2,
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    over: false,
  };
  return g;
}

function aiSpeed(g: Game): number {
  return Math.min(250, 168 + (g.pScore + g.aScore) * 2.4 + g.rally * 4);
}

function point(g: Game, team: Team, why: string): void {
  if (team === "p") {
    g.pScore += 1;
    g.streak += 1;
    if (g.streak > g.maxStreak) g.maxStreak = g.streak;
    g.banner = `POINT — YOU · ${why}`;
    g.flash = 0.45;
    g.flashC = "#67e8f9";
  } else {
    g.aScore += 1;
    g.streak = 0;
    g.banner = `POINT — RIVAL · ${why}`;
    g.flash = 0.4;
    g.flashC = "#f472b6";
  }
  g.streakEvent = true;
  g.bannerT = 1.5;
  g.shake = 7;
  burst(g, g.ball.x, GROUND - 10, team === "p" ? "#67e8f9" : "#f472b6", 20, 200);
  g.floats.push({ x: g.ball.x, y: GROUND - 46, text: why, life: 1, c: "#ffffff" });

  if (g.pScore >= TO_WIN || g.aScore >= TO_WIN) {
    g.over = true;
    return;
  }
  // winner serves
  g.phase = "serve";
  g.server = team;
  g.serveT = 1.1;
  g.att = null;
  g.stage = 0;
  g.unreturnable = false;
  g.netHit = false;
  g.rally = 0;
  g.px = [112, 186];
  g.ax = [300, 374];
  g.ball = team === "p" ? { x: g.px[1] + 26, y: 320 } : { x: g.ax[0] - 26, y: 320 };
  g.vel = { x: 0, y: 0 };
  g.trail = [];
}

function serve(g: Game): void {
  if (g.phase !== "serve") return;
  const from = g.server === "p" ? { x: g.px[1] + 26, y: 320 } : { x: g.ax[0] - 26, y: 320 };
  g.ball = { ...from };
  g.vel = g.server === "p" ? { x: 275, y: -250 } : { x: -275, y: -250 };
  g.att = g.server;
  g.stage = 0;
  g.phase = "play";
  g.netHit = false;
  g.unreturnable = false;
  if (g.server === "p") g.hitP = 0.3;
  else g.hitA = 0.3;
}

function bump(g: Game, team: Team): void {
  const tx = team === "p" ? 176 : 312;
  g.vel = { x: (tx - g.ball.x) * 0.5, y: -(285 + Math.random() * 45) };
  g.att = team;
  g.stage = 1;
  g.stageTeam = team;
  g.rally += 1;
  if (team === "p") {
    g.hitP = 0.3;
    floater(g, g.ball.x, g.ball.y - 26, "BUMP", "#a5f3fc");
  } else {
    g.hitA = 0.3;
    floater(g, g.ball.x, g.ball.y - 26, "DIG", "#f9a8d4");
  }
  burst(g, g.ball.x, g.ball.y, team === "p" ? "#a5f3fc" : "#f9a8d4", 6, 110);
}

function setBall(g: Game, team: Team): void {
  const tx = team === "p" ? 198 : 292;
  g.vel = { x: (tx - g.ball.x) * 0.55, y: -300 };
  g.stage = 2;
  g.stageTeam = team;
  g.rally += 1;
  if (team === "p") g.hitP = 0.3;
  else g.hitA = 0.3;
  floater(g, g.ball.x, g.ball.y - 26, "SET", team === "p" ? "#67e8f9" : "#f9a8d4");
}

function spikeFrom(g: Game, team: Team, perfect: boolean): void {
  // aim away from the defender
  const target =
    team === "p"
      ? g.actA === 0 && g.ax[0] < 340
        ? 398
        : 286
      : g.px[g.actP] < 140
        ? 200
        : 82;
  const vy = perfect ? 470 : 400;
  const y0 = g.ball.y;
  // time until it reaches the sand
  const t = (-vy + Math.sqrt(vy * vy + 2 * GRAV * (GROUND - BALL_R - y0))) / GRAV;
  const vx = (target - g.ball.x) / Math.max(0.18, t);
  g.vel = { x: vx, y: vy };
  g.att = team;
  g.stage = 0;
  g.unreturnable = perfect;
  g.rally += 1;
  if (team === "p") {
    g.hitP = 0.4;
    floater(g, g.ball.x, g.ball.y - 30, perfect ? "UNRETURNABLE!" : "SPIKE!", perfect ? "#fde68a" : "#a5f3fc");
  } else {
    g.hitA = 0.4;
    floater(g, g.ball.x, g.ball.y - 30, perfect ? "BURNER!" : "SPIKE!", perfect ? "#fde68a" : "#f9a8d4");
  }
  g.shake = Math.max(g.shake, 5);
  burst(g, g.ball.x, g.ball.y, perfect ? "#fde68a" : "#e2e8f0", 12, 170);
}

/** Contextual action — serve, set or spike. */
function action(g: Game): void {
  if (g.over) return;
  if (g.phase === "serve") {
    if (g.server === "p") serve(g);
    return;
  }
  const onP = g.ball.x < NET_X;
  if (!onP) return;
  if (g.stage === 1 && g.stageTeam === "p") {
    if (g.ball.y > 320) {
      floater(g, g.ball.x, g.ball.y - 24, "NOT HIGH ENOUGH", "#94a3b8");
      return;
    }
    setBall(g, "p");
  } else if (g.stage === 2 && g.stageTeam === "p") {
    const v = g.vel.y;
    if (Math.abs(v) <= 90) spikeFrom(g, "p", true);
    else if (Math.abs(v) <= 230) spikeFrom(g, "p", false);
    else if (v < 0) floater(g, g.ball.x, g.ball.y - 24, "TOO EARLY!", "#fbbf24");
    else floater(g, g.ball.x, g.ball.y - 24, "TOO LATE!", "#fbbf24");
  } else if (g.stage === 0) {
    floater(g, g.ball.x, g.ball.y - 24, "LET IT BUMP FIRST", "#94a3b8");
  }
}

function step(g: Game, dt: number, dir: number): void {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt * 1.7);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);
  if (g.hitP > 0) g.hitP = Math.max(0, g.hitP - dt);
  if (g.hitA > 0) g.hitA = Math.max(0, g.hitA - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.05;
    f.y -= 30 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  /* players: active = nearest to the ball */
  g.actP = Math.abs(g.px[0] - g.ball.x) <= Math.abs(g.px[1] - g.ball.x) ? 0 : 1;
  g.actA = Math.abs(g.ax[0] - g.ball.x) <= Math.abs(g.ax[1] - g.ball.x) ? 0 : 1;

  // player control
  if (g.phase === "play" && dir !== 0) {
    const i = g.actP;
    const lo = L_LINE + 14;
    const hi = NET_X - 30;
    g.px[i] = Math.max(lo, Math.min(hi, g.px[i] + dir * 205 * dt));
  }
  // drift inactive players home
  for (let i = 0 as 0 | 1; i < 2; i = (i + 1) as 0 | 1) {
    if (i !== g.actP) g.px[i] += (home("p", i) - g.px[i]) * Math.min(1, 3.5 * dt);
    if (i !== g.actA) g.ax[i] += (home("a", i) - g.ax[i]) * Math.min(1, 3.5 * dt);
  }

  if (g.phase === "serve") {
    if (g.server === "p") {
      g.ball = { x: g.px[g.actP] + 26, y: 320 };
    } else {
      const sp = aiSpeed(g);
      g.ball = { x: g.ax[g.actA] - 26, y: 320 };
      g.ax[g.actA] += (196 - g.ax[g.actA]) * Math.min(1, sp * 0.004);
      g.serveT -= dt;
      if (g.serveT <= 0) serve(g);
    }
    return;
  }

  /* ------------------------------ play ------------------------------ */

  const prevSide = g.ball.x < NET_X ? "p" : "a";
  g.vel.y += GRAV * dt;
  g.ball.x += g.vel.x * dt;
  g.ball.y += g.vel.y * dt;
  g.trail.push({ x: g.ball.x, y: g.ball.y });
  if (g.trail.length > 10) g.trail.shift();

  const side = g.ball.x < NET_X ? "p" : "a";
  if (side !== prevSide) g.stage = 0; // possession changes over the net

  // net
  if (
    !g.netHit &&
    Math.abs(g.ball.x - NET_X) < 9 &&
    g.ball.y + BALL_R > NET_TOP &&
    g.ball.y < GROUND
  ) {
    g.netHit = true;
    g.ball.x = g.att === "p" ? NET_X + 14 : NET_X - 14;
    g.vel = { x: 0, y: -70 };
    g.shake = Math.max(g.shake, 5);
    floater(g, g.ball.x, NET_TOP + 20, "NET!", "#fbbf24");
  }

  // landing → who scored
  if (g.ball.y + BALL_R >= GROUND) {
    g.ball.y = GROUND - BALL_R;
    const inBounds = g.ball.x >= L_LINE && g.ball.x <= R_LINE;
    const winner: Team = g.att === "p" ? "a" : "p";
    if (!inBounds && g.att) {
      point(g, winner, g.att === "p" ? "OUT!" : "LONG!");
    } else if (g.netHit && g.att) {
      point(g, winner, "NETTED");
    } else if (g.att) {
      point(g, winner, "FLOOR");
    } else {
      point(g, "a", "ACE");
    }
    return;
  }

  /* contacts */
  const contact = (x: number, y: number) =>
    Math.hypot(g.ball.x - x, g.ball.y - y) < BALL_R + 30 && g.vel.y > 0;

  if (side === "p") {
    const i = g.actP;
    if (g.stage === 0 && contact(g.px[i], 400)) bump(g, "p");
  } else {
    const i = g.actA;
    // AI defends: chase the spike landing, otherwise track the ball
    const sp = aiSpeed(g);
    const goal =
      g.att === "p" && g.stage === 0 && g.vel.y > 0 && g.ball.y > 300
        ? Math.max(L_LINE + 40, Math.min(R_LINE - 40, g.ball.x))
        : g.ball.x;
    g.ax[i] += Math.sign(goal - g.ax[i]) * Math.min(Math.abs(goal - g.ax[i]), sp * dt);
    if (g.stage === 0 && contact(g.ax[i], 400)) {
      if (g.unreturnable) {
        // whiff — it burns past
      } else {
        bump(g, "a");
      }
    } else if (g.stage === 1 && g.stageTeam === "a") {
      g.aSetIn -= dt;
      if (g.aSetIn <= 0 && g.ball.y < 330) setBall(g, "a");
    } else if (g.stage === 2 && g.stageTeam === "a") {
      g.aSpikeIn -= dt;
      if (g.aSpikeIn <= 0 && g.vel.y > -120) {
        const perfect = Math.random() < Math.min(0.55, 0.12 + g.rally * 0.05);
        spikeFrom(g, "a", perfect);
      }
    }
  }

  // AI setup timers after its own bump
  if (g.stage === 1 && g.stageTeam === "a" && g.aSetIn <= 0) g.aSetIn = 0.38;
  if (g.stage === 2 && g.stageTeam === "a" && g.aSpikeIn <= 0) g.aSpikeIn = 0.82;
}

/* ------------------------------ render ------------------------------ */

function drawCourt(ctx: CanvasRenderingContext2D, time: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#07253d");
  sky.addColorStop(0.55, "#0a1d33");
  sky.addColorStop(1, "#071426");
  ctx.fillStyle = sky;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // sun glow
  const sun = ctx.createRadialGradient(W / 2, 96, 8, W / 2, 96, 170);
  sun.addColorStop(0, "rgba(56, 189, 248, 0.3)");
  sun.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, -60, W, 320);

  // water shimmer band
  ctx.strokeStyle = "rgba(34, 211, 238, 0.12)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const y = 150 + i * 14;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const yy = y + Math.sin(x / 40 + time / 700 + i) * 3;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // sand
  const sand = ctx.createLinearGradient(0, GROUND - 24, 0, H);
  sand.addColorStop(0, "#2c2416");
  sand.addColorStop(1, "#1a150d");
  ctx.fillStyle = sand;
  ctx.fillRect(-14, GROUND, W + 28, H - GROUND + 14);

  // court lines
  ctx.strokeStyle = "rgba(125, 211, 252, 0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(L_LINE, GROUND);
  ctx.lineTo(R_LINE, GROUND);
  ctx.stroke();
  for (const x of [L_LINE, R_LINE]) {
    ctx.strokeStyle = "rgba(34, 211, 238, 0.8)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x, GROUND - 16);
    ctx.stroke();
  }

  // net
  ctx.save();
  ctx.shadowColor = "rgba(125, 211, 252, 0.8)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(NET_X - 3, NET_TOP - 8, 6, GROUND - NET_TOP + 8);
  ctx.restore();
  ctx.strokeStyle = "rgba(226, 232, 240, 0.55)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 6; i++) {
    const x = NET_X - 40 + i * 13;
    ctx.beginPath();
    ctx.moveTo(x, NET_TOP);
    ctx.lineTo(x, GROUND - 6);
    ctx.stroke();
  }
  for (let j = 0; j < 8; j++) {
    const y = NET_TOP + 6 + j * ((GROUND - NET_TOP - 12) / 7);
    ctx.beginPath();
    ctx.moveTo(NET_X - 40, y);
    ctx.lineTo(NET_X + 40, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(NET_X - 42, NET_TOP);
  ctx.lineTo(NET_X + 42, NET_TOP);
  ctx.stroke();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  color: string,
  trim: string,
  active: boolean,
  hitT: number,
  time: number,
): void {
  const hop = hitT > 0 ? Math.sin((0.4 - hitT) / 0.4 * Math.PI) * 14 : 0;
  const idle = Math.sin(time / 320 + x) * 2;
  const feet = GROUND - 2 - hop;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, GROUND + 2, 17, 5, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(x, feet + idle);
  if (active) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 6, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = active ? 1 : 0.55;
  // legs
  ctx.strokeStyle = trim;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-4, -24);
  ctx.lineTo(-8, 0);
  ctx.moveTo(5, -24);
  ctx.lineTo(9, 0);
  ctx.stroke();
  // torso
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(1, -48);
  ctx.stroke();
  // arms up (ready)
  ctx.strokeStyle = trim;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(1, -44);
  ctx.lineTo(-10, -56);
  ctx.moveTo(1, -44);
  ctx.lineTo(11, -56);
  ctx.stroke();
  // head
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = active ? 12 : 4;
  ctx.beginPath();
  ctx.arc(2, -60, 8, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  drawCourt(ctx, time);

  if (g) {
    drawPlayer(ctx, g.px[0], "#22d3ee", "#0e7490", g.actP === 0, g.hitP, time);
    drawPlayer(ctx, g.px[1], "#22d3ee", "#0e7490", g.actP === 1, g.hitP, time);
    drawPlayer(ctx, g.ax[0], "#f472b6", "#9f1239", g.actA === 0, g.hitA, time);
    drawPlayer(ctx, g.ax[1], "#f472b6", "#9f1239", g.actA === 1, g.hitA, time);

    // trail
    for (let i = 0; i < g.trail.length; i++) {
      const p = g.trail[i];
      ctx.fillStyle = `rgba(254, 251, 235, ${0.05 + (i / g.trail.length) * 0.3})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, BALL_R * (0.35 + (i / g.trail.length) * 0.5), 0, TAU);
      ctx.fill();
    }

    // ball
    ctx.save();
    ctx.shadowColor = g.unreturnable ? "#fde68a" : "#fef3c7";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#fffbeb";
    ctx.beginPath();
    ctx.arc(g.ball.x, g.ball.y, BALL_R, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(g.ball.x, g.ball.y, BALL_R * 0.55, time / 180, time / 180 + Math.PI);
    ctx.stroke();
    ctx.restore();

    // scoreboard
    ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
    ctx.beginPath();
    ctx.roundRect(W / 2 - 120, 12, 240, 66, 14);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillStyle = "#67e8f9";
    ctx.fillText("YOU", W / 2 - 66, 32);
    ctx.fillStyle = "#f9a8d4";
    ctx.fillText("RIVAL", W / 2 + 66, 32);
    ctx.font = "800 30px ui-monospace, monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${g.pScore}`, W / 2 - 66, 64);
    ctx.fillText(`${g.aScore}`, W / 2 + 66, 64);
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.font = "700 16px ui-monospace, monospace";
    ctx.fillText("·", W / 2, 60);
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.fillText(`FIRST TO ${TO_WIN}`, W / 2, 48);

    // streak flame
    if (g.streak > 0) {
      ctx.font = "800 13px ui-monospace, monospace";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`🔥 STREAK ×${g.streak}`, W / 2, 96);
    }

    // possession hint
    if (g.phase === "play" && g.stage > 0 && g.stageTeam === "p") {
      ctx.font = "800 13px ui-monospace, monospace";
      ctx.fillStyle = "#a5f3fc";
      ctx.fillText(g.stage === 1 ? "TAP — SET" : "TAP AT APEX — SPIKE", NET_X - 80, 132);
    }

    // particles
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // floaters
    ctx.font = "800 15px ui-monospace, monospace";
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
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.5);
      ctx.font = "800 20px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(56, 189, 248, 0.9)";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, 176);
      ctx.restore();
    }

    if (g.flash > 0.01) {
      ctx.fillStyle = hexA(g.flashC, g.flash * 0.28);
      ctx.fillRect(-14, -14, W + 28, H + 28);
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function VolleyKing({ gameId = "volley-king" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const keys = useRef({ l: false, r: false });
  const [status, setStatus] = useState<Status>("idle");
  const [pScore, setPScore] = useState(0);
  const [aScore, setAScore] = useState(0);
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
    if (!gameRef.current) gameRef.current = createGame(streak);
    draw(performance.now());
    return () => {
      keys.current = { l: false, r: false };
    };
  }, [draw, streak]);

  const start = useCallback(() => {
    gameRef.current = createGame(streak);
    keys.current = { l: false, r: false };
    setPScore(0);
    setAScore(0);
    setNewBest(false);
    setStatus("playing");
  }, [streak]);

  const act = useCallback(() => {
    const g = gameRef.current;
    if (g) action(g);
  }, []);

  const holdKey = useCallback((k: "l" | "r", on: boolean) => {
    keys.current[k] = on;
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastP = -1;
    let lastA = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      const dir = (keys.current.r ? 1 : 0) - (keys.current.l ? 1 : 0);
      step(g, dt, dir);

      if (g.streakEvent) {
        g.streakEvent = false;
        setStreak(g.streak);
      }
      if (g.pScore !== lastP) {
        lastP = g.pScore;
        setPScore(g.pScore);
      }
      if (g.aScore !== lastA) {
        lastA = g.aScore;
        setAScore(g.aScore);
      }

      draw(t);
      if (g.over) {
        setPScore(g.pScore);
        setAScore(g.aScore);
        setStreak(g.streak);
        setNewBest(submit(g.maxStreak));
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
        if (status === "playing") act();
        else start();
        return;
      }
      if (status !== "playing") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        keys.current.l = true;
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        keys.current.r = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") keys.current.l = false;
      else if (e.key === "ArrowRight") keys.current.r = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start, act]);

  const moveBtn =
    "touch-none rounded-xl border border-sky-400/50 bg-surface py-4 font-mono text-lg font-bold text-sky-300 transition active:scale-95";

  const won = pScore >= TO_WIN;

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={streak} best={best ?? "—"} accent="text-sky-300">
        <span className="text-cyan-300">
          You <b className="ml-1 text-sm text-ink">{pScore}</b>
        </span>
        <span className="text-pink-300">
          Rival <b className="ml-1 text-sm text-ink">{aScore}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(56,189,248,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Volley Kings court"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") return;
            act();
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">VOLLEY KINGS</p>
            <p className="mt-2 text-sm text-muted">
              Beach doubles to twenty-one against a rival that sharpens every point. You control
              whichever of your players is nearest the ball — get under the dig and it bumps
              automatically, tap once to set it high near the net, then tap again right at the
              apex to spike. Nail the apex and the spike burns past; mistime it and it&apos;s a
              free ball. Every rally you win feeds the streak, and the streak is what the ledger
              remembers.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Serve up
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ←/→ move · Space / tap = set, then spike at the apex
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-cyan-300">
              {won ? "MATCH WON" : "MATCH LOST"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best streak!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {pScore}–{aScore}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best streak {best ?? "—"} · this run {streak}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Rematch
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Bump · set · spike at the apex · repeat</p>
          </Overlay>
        )}
      </div>

      <div className="mt-2 flex touch-none select-none gap-2">
        <button
          type="button"
          onPointerDown={() => holdKey("l", true)}
          onPointerUp={() => holdKey("l", false)}
          onPointerLeave={() => holdKey("l", false)}
          onPointerCancel={() => holdKey("l", false)}
          aria-label="Move left"
          className={moveBtn}
        >
          ◀
        </button>
        <button
          type="button"
          onPointerDown={() => act()}
          aria-label="Set or spike the ball"
          className="touch-none flex-[2] rounded-xl border border-cyan-400/60 bg-surface py-4 font-mono text-sm font-bold uppercase tracking-widest text-cyan-200 transition active:scale-95"
        >
          Set / Spike
        </button>
        <button
          type="button"
          onPointerDown={() => holdKey("r", true)}
          onPointerUp={() => holdKey("r", false)}
          onPointerLeave={() => holdKey("r", false)}
          onPointerCancel={() => holdKey("r", false)}
          aria-label="Move right"
          className={moveBtn}
        >
          ▶
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Nearest player is highlighted · tap once to set, again at the apex to spike
      </p>
    </div>
  );
}
