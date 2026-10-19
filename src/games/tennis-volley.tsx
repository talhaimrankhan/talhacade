"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 580;
const TAU = Math.PI * 2;

const CL = 46;
const CR = 414;
const CT = 54;
const CB = 526;
const NET_Y = Math.round((CT + CB) / 2);
const NET_BLOCK = 36;
const NET_HALF = 11;
const ZS = 0.55;
const GRAV = 900;
const PR = 14;
const BR = 6.5;
const REACH = 38;
const SPEED = 250;
const TONE = "from-yellow-400 via-amber-500 to-orange-600";

type Status = "idle" | "playing" | "over";
type Side = "player" | "ai";
type Phase = "drop" | "live" | "point";
type Shot = "lob" | "drive";

interface Pt {
  x: number;
  y: number;
}
interface Mark {
  x: number;
  y: number;
  z: number;
}
interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
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
  keys: Record<string, boolean>;
  ptrDown: boolean;
  spaceDown: boolean;
  ptr: Pt;
  holding: boolean;
  holdT: number;
  dirX: number;
  dirY: number;
  px: number;
  py: number;
  ax: number;
  ay: number;
  aiTarget: Pt;
  aiReact: number;
  aiLvl: number;
  ball: Ball;
  owner: Side;
  serve: Side;
  bounces: number;
  cooldown: number;
  rally: number;
  rallyBest: number;
  streak: number;
  pointT: number;
  pointWinner: Side;
  banner: string;
  bannerT: number;
  shake: number;
  flash: number;
  flashC: string;
  parts: Part[];
  floats: Floater[];
  trail: Mark[];
  over: boolean;
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
}

function other(s: Side): Side {
  return s === "player" ? "ai" : "player";
}

function sideOfY(y: number): Side {
  return y < NET_Y ? "ai" : "player";
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

/* ------------------------------ shots ------------------------------ */

function launch(g: Game, who: Side, kind: Shot, tx: number, ty: number): void {
  const b = g.ball;
  const z0 = Math.max(3, b.z);
  const dist = Math.hypot(tx - b.x, ty - b.y);
  const dur = kind === "drive" ? clamp(dist / 620, 0.3, 0.78) : clamp(dist / 300, 0.7, 1.4);
  b.vx = (tx - b.x) / dur;
  b.vy = (ty - b.y) / dur;
  b.vz = ((0.5 * GRAV * dur * dur - z0) / dur) * (0.95 + Math.random() * 0.1);
  g.owner = who;
  g.bounces = 0;
  g.cooldown = 0.2;
  g.rally += 1;
  g.rallyBest = Math.max(g.rallyBest, g.rally);
  g.shake = Math.max(g.shake, kind === "drive" ? 5 : 2.4);
  burst(g, b.x, b.y, who === "player" ? "#fde047" : "#fb7185", 12, 150);
  floater(g, b.x, b.y - 20, kind === "drive" ? "DRIVE" : "LOB", who === "player" ? "#fde047" : "#fb7185");
}

function playerHit(g: Game): void {
  const kind: Shot = g.holdT > 0.16 ? "drive" : "lob";
  const dx = g.dirX;
  let dy = g.dirY;
  if (dx === 0 && dy === 0) dy = -1;
  const deep = kind === "drive" ? CT + 96 : CT + 54;
  const openX = g.ax < W / 2 ? CR - 56 : CL + 56;
  let tx = clamp(g.px + dx * 300, CL + 30, CR - 30);
  tx = tx * 0.66 + openX * 0.34;
  const err = (kind === "drive" ? 8 : 4) + (dy > 0.25 ? 16 : 0) + (Math.abs(dx) > 0.7 ? 5 : 0);
  tx += (Math.random() * 2 - 1) * err;
  const ty = clamp(deep + (Math.random() * 2 - 1) * 18, CT + 28, NET_Y - 40);
  launch(g, "player", kind, clamp(tx, CL + 14, CR - 14), ty);
}

function aiHit(g: Game): void {
  const kind: Shot = g.ball.z > 24 && Math.random() < 0.4 + 0.1 * g.aiLvl ? "drive" : "lob";
  const err = 44 - 6.5 * g.aiLvl;
  const away = clamp(g.px < W / 2 ? CR - 56 : CL + 56, CL + 44, CR - 44);
  const tx = away + (Math.random() * 2 - 1) * err;
  const ty = (kind === "drive" ? CB - 96 : CB - 56) + (Math.random() * 2 - 1) * err * 0.6;
  launch(g, "ai", kind, tx, clamp(ty, NET_Y + 40, CB - 28));
}

/* ------------------------------ points ------------------------------ */

function award(g: Game, winner: Side, text: string, c: string): void {
  if (g.phase === "point") return;
  g.phase = "point";
  g.pointT = 1.15;
  g.pointWinner = winner;
  g.banner = text;
  g.bannerT = 1.15;
  g.flash = 1;
  g.flashC = c;
  g.shake = 7;
  if (winner === "player") {
    g.streak += 1;
    burst(g, g.ball.x, g.ball.y, "#fde047", 30, 240);
    floater(g, W / 2, NET_Y - 40, "POINT!", "#fde047");
  } else {
    burst(g, g.ball.x, g.ball.y, "#fb7185", 24, 190);
    floater(g, W / 2, NET_Y + 40, "LOST", "#fb7185");
  }
}

function startDrop(g: Game, server: Side): void {
  const receiver = other(server);
  g.serve = server;
  g.owner = server;
  g.phase = "drop";
  g.bounces = 0;
  g.rally = 0;
  g.cooldown = 0.2;
  const rx = receiver === "player" ? g.px : g.ax;
  const x = rx < W / 2 ? CR - 64 : CL + 64;
  const y = receiver === "player" ? CB - 96 : CT + 96;
  g.ball = { x: clamp(x, CL + 44, CR - 44), y, z: 155, vx: 0, vy: 0, vz: 0 };
  g.trail = [];
  g.banner = receiver === "player" ? "RECEIVE!" : "THEY RECEIVE";
  g.bannerT = 0.95;
}

/* ------------------------------ movement ------------------------------ */

function movePlayer(g: Game, dt: number): void {
  let dx = 0;
  let dy = 0;
  if (g.keys["arrowleft"] || g.keys["a"]) dx -= 1;
  if (g.keys["arrowright"] || g.keys["d"]) dx += 1;
  if (g.keys["arrowup"] || g.keys["w"]) dy -= 1;
  if (g.keys["arrowdown"] || g.keys["s"]) dy += 1;
  if (dx !== 0 && dy !== 0) {
    dx *= 0.7071;
    dy *= 0.7071;
  }
  if (dx === 0 && dy === 0 && g.ptrDown) {
    const vx = g.ptr.x - g.px;
    const vy = g.ptr.y - g.py;
    const d = Math.hypot(vx, vy);
    if (d > 7) {
      dx = vx / d;
      dy = vy / d;
    }
  }
  if (dx !== 0 || dy !== 0) {
    g.dirX = dx;
    g.dirY = dy;
  }
  g.px = clamp(g.px + dx * SPEED * dt, CL, CR);
  g.py = clamp(g.py + dy * SPEED * dt, NET_Y + 20, CB - 10);
}

function moveAi(g: Game, dt: number): void {
  const lvl = g.aiLvl;
  const speed = 150 + 17 * lvl;
  const receiver = other(g.serve);
  const chase =
    g.phase === "live" ? g.owner === "player" && g.bounces < 2 : receiver === "ai";
  let tx: number;
  let ty: number;
  if (chase) {
    g.aiReact -= dt;
    if (g.aiReact <= 0) {
      g.aiReact = Math.max(0.08, 0.3 - 0.04 * lvl);
      const err = 46 - 7 * lvl;
      g.aiTarget = {
        x: g.ball.x + (Math.random() * 2 - 1) * err,
        y: g.ball.y + (Math.random() * 2 - 1) * err * 0.7,
      };
    }
    tx = g.aiTarget.x;
    ty = g.aiTarget.y;
  } else {
    g.aiReact = 0;
    tx = W / 2 + (g.ball.x - W / 2) * 0.35;
    ty = CT + 76;
  }
  const vx = tx - g.ax;
  const vy = ty - g.ay;
  const d = Math.hypot(vx, vy);
  if (d > 2) {
    const s = Math.min(speed * dt, d);
    g.ax += (vx / d) * s;
    g.ay += (vy / d) * s;
  }
  g.ax = clamp(g.ax, CL, CR);
  g.ay = clamp(g.ay, CT + 10, NET_Y - 20);
}

/* ------------------------------ ball ------------------------------ */

function dropBall(g: Game, dt: number): void {
  const b = g.ball;
  b.vz -= GRAV * dt;
  b.z += b.vz * dt;
  if (b.z <= 0) {
    b.z = 0;
    if (b.vz < -40) {
      b.vz = -b.vz * 0.5;
      g.phase = "live";
      g.bounces = 0;
      g.cooldown = 0.1;
      burst(g, b.x, b.y, "#a3e635", 8, 90);
      floater(g, b.x, b.y - 18, "SERVE", "#a3e635");
    } else {
      b.vz = 0;
    }
  }
}

function updateBall(g: Game, dt: number): void {
  const b = g.ball;
  const py = b.y;
  const pz = b.z;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  b.vz -= GRAV * dt;
  g.trail.push({ x: b.x, y: b.y, z: b.z });
  if (g.trail.length > 8) g.trail.shift();

  // net
  if ((py - NET_Y) * (b.y - NET_Y) < 0) {
    const f = (NET_Y - py) / (b.y - py);
    const zAt = pz + f * (b.z - pz);
    if (zAt < NET_BLOCK) {
      award(g, other(g.owner), "INTO THE NET!", "#fb7185");
      return;
    }
  }

  // landing
  if (b.z <= 0 && b.vz < 0) {
    b.z = 0;
    const inCourt = b.x >= CL && b.x <= CR && b.y >= CT && b.y <= CB;
    const target = other(g.owner);
    if (!inCourt || sideOfY(b.y) !== target) {
      award(g, target, "OUT!", "#fb7185");
      return;
    }
    g.bounces += 1;
    if (g.bounces >= 2) {
      award(g, g.owner, "WINNER!", "#fde047");
      return;
    }
    b.vz = -b.vz * 0.62;
    b.vx *= 0.86;
    b.vy *= 0.86;
    burst(g, b.x, b.y, "#a3e635", 6, 80);
  }

  if (g.phase !== "live" || g.cooldown > 0) return;
  const bd = Math.hypot(b.x - g.px, b.y - g.py);
  const ad = Math.hypot(b.x - g.ax, b.y - g.ay);
  if (g.owner === "ai" && bd <= REACH) {
    playerHit(g);
  } else if (g.owner === "player" && ad <= REACH) {
    aiHit(g);
  }
}

/* ------------------------------ loop ------------------------------ */

function step(g: Game, dt: number): void {
  g.t += dt;
  g.aiLvl = Math.min(5, Math.floor(g.streak / 5));
  if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 3);
  if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 2.4);
  if (g.bannerT > 0) g.bannerT -= dt;
  if (g.cooldown > 0) g.cooldown -= dt;
  g.holding = g.ptrDown || g.spaceDown;
  if (g.holding) g.holdT += dt;
  else g.holdT = 0;

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
    f.y -= 26 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (g.phase === "point") {
    g.pointT -= dt;
    if (g.pointT <= 0) {
      if (g.pointWinner === "ai") g.over = true;
      else startDrop(g, g.pointWinner);
    }
    return;
  }

  movePlayer(g, dt);
  moveAi(g, dt);

  if (g.phase === "drop") {
    dropBall(g, dt);
    return;
  }
  updateBall(g, dt);
}

function createGame(): Game {
  const g: Game = {
    phase: "drop",
    t: 0,
    keys: {},
    ptrDown: false,
    spaceDown: false,
    ptr: { x: W / 2, y: CB - 60 },
    holding: false,
    holdT: 0,
    dirX: 0,
    dirY: -1,
    px: W / 2,
    py: CB - 70,
    ax: W / 2,
    ay: CT + 76,
    aiTarget: { x: W / 2, y: CT + 76 },
    aiReact: 0,
    aiLvl: 0,
    ball: { x: W / 2, y: CB - 96, z: 155, vx: 0, vy: 0, vz: 0 },
    owner: "player",
    serve: "player",
    bounces: 0,
    cooldown: 0.2,
    rally: 0,
    rallyBest: 0,
    streak: 0,
    pointT: 0,
    pointWinner: "player",
    banner: "",
    bannerT: 0,
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    parts: [],
    floats: [],
    trail: [],
    over: false,
  };
  startDrop(g, "player");
  g.banner = "YOUR BALL";
  return g;
}

/* ------------------------------ render ------------------------------ */

function drawCourt(ctx: CanvasRenderingContext2D): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#05070f");
  bg.addColorStop(0.5, "#081119");
  bg.addColorStop(1, "#05070f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  const ag = ctx.createRadialGradient(W / 2, NET_Y, 30, W / 2, NET_Y, 330);
  ag.addColorStop(0, "rgba(253,224,71,0.16)");
  ag.addColorStop(1, "rgba(253,224,71,0)");
  ctx.fillStyle = ag;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const cg = ctx.createLinearGradient(0, CT, 0, CB);
  cg.addColorStop(0, "#0d2b30");
  cg.addColorStop(1, "#0a2127");
  ctx.fillStyle = cg;
  ctx.fillRect(CL, CT, CR - CL, CB - CT);

  ctx.save();
  ctx.shadowColor = "rgba(253,224,71,0.55)";
  ctx.shadowBlur = 10;
  ctx.strokeStyle = "rgba(226,232,240,0.9)";
  ctx.lineWidth = 3;
  ctx.strokeRect(CL, CT, CR - CL, CB - CT);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CL + 16, CT);
  ctx.lineTo(CL + 16, CB);
  ctx.moveTo(CR - 16, CT);
  ctx.lineTo(CR - 16, CB);
  const sl = CT + (CB - CT) * 0.26;
  const sl2 = CB - (CB - CT) * 0.26;
  ctx.moveTo(CL, sl);
  ctx.lineTo(CR, sl);
  ctx.moveTo(CL, sl2);
  ctx.lineTo(CR, sl2);
  ctx.moveTo(W / 2, sl);
  ctx.lineTo(W / 2, sl2);
  ctx.stroke();
  ctx.restore();

  // court-side labels
  ctx.font = "700 10px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(253,224,71,0.55)";
  ctx.fillText("OPPONENT", CL, CT - 12);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(165,243,252,0.55)";
  ctx.fillText("YOUR BASELINE", CR, CB + 20);
}

function drawNet(ctx: CanvasRenderingContext2D): void {
  const y1 = NET_Y - NET_HALF;
  const y2 = NET_Y + NET_HALF;
  ctx.save();
  ctx.fillStyle = "rgba(15,23,42,0.94)";
  ctx.fillRect(CL - 14, y1, CR - CL + 28, y2 - y1);
  ctx.strokeStyle = "rgba(226,232,240,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = CL - 14; x <= CR + 14; x += 9) {
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }
  ctx.stroke();
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "rgba(253,224,71,0.75)";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(CL - 14, y1);
  ctx.lineTo(CR + 14, y1);
  ctx.moveTo(CL - 14, y2);
  ctx.lineTo(CR + 14, y2);
  ctx.stroke();
  ctx.restore();
  // posts
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(CL - 18, y1 - 3, 6, y2 - y1 + 6);
  ctx.fillRect(CR + 12, y1 - 3, 6, y2 - y1 + 6);
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fill: string,
  glow: string,
  charge: number,
  ready: boolean,
): void {
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 20;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, PR, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(2,6,23,0.5)";
  ctx.beginPath();
  ctx.arc(x, y, PR * 0.5, 0, TAU);
  ctx.fill();
  if (charge > 0) {
    ctx.save();
    ctx.strokeStyle = ready ? "#fde047" : "rgba(253,224,71,0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, PR + 7, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, charge));
    ctx.stroke();
    ctx.restore();
  }
}

function drawBall(ctx: CanvasRenderingContext2D, g: Game): void {
  const b = g.ball;
  // trail
  for (let i = 0; i < g.trail.length; i++) {
    const m = g.trail[i];
    const a = (i / g.trail.length) * 0.3;
    ctx.fillStyle = `rgba(217,249,157,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y - m.z * ZS, BR * 0.8, BR * 0.8, 0, 0, TAU);
    ctx.fill();
  }
  // shadow
  const sh = clamp(0.42 - b.z * 0.002, 0.06, 0.42);
  ctx.fillStyle = `rgba(0,0,0,${sh.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(b.x, b.y, BR * (1 + b.z * 0.006), BR * 0.7 * (1 + b.z * 0.006), 0, 0, TAU);
  ctx.fill();
  // ball
  const by = b.y - b.z * ZS;
  const r = BR + b.z * 0.02;
  ctx.save();
  ctx.shadowColor = "rgba(217,249,157,0.9)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#d9f99d";
  ctx.beginPath();
  ctx.arc(b.x, by, r, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(101,163,13,0.85)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(b.x, by, r * 0.62, -0.9, 0.9);
  ctx.stroke();
}

function render(canvas: HTMLCanvasElement, g: Game | null): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }
  drawCourt(ctx);
  drawNet(ctx);
  if (g) {
    drawPlayer(ctx, g.ax, g.ay, "#fb7185", "rgba(251,113,133,0.9)", 0, false);
    drawPlayer(
      ctx,
      g.px,
      g.py,
      "#facc15",
      "rgba(253,224,71,0.95)",
      g.holdT / 0.16,
      g.holdT > 0.16,
    );
    drawBall(ctx, g);
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    for (const f of g.floats) {
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.font = "800 15px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();

  if (!g) return;

  if (g.holding) {
    ctx.font = "800 11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = g.holdT > 0.16 ? "#fde047" : "rgba(253,224,71,0.5)";
    ctx.fillText(g.holdT > 0.16 ? "DRIVE READY" : "CHARGING…", g.px, g.py + 34);
  }

  if (g.t < 7 && g.phase !== "point") {
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(226,232,240,0.6)";
    ctx.fillText("WASD / ARROWS TO MOVE · HOLD = DRIVE · TAP = LOB", W / 2, H - 14);
  }

  if (g.bannerT > 0) {
    const a = clamp(g.bannerT * 2.2, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = "center";
    ctx.font = "800 32px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(253,224,71,0.9)";
    ctx.shadowBlur = 20;
    ctx.fillText(g.banner, W / 2, NET_Y - 60);
    ctx.restore();
  }

  if (g.flash > 0) {
    ctx.fillStyle = hexA(g.flashC, 0.26 * g.flash);
    ctx.fillRect(0, 0, W, H);
  }
}

/* ------------------------------ component ------------------------------ */

export default function TennisVolley({ gameId = "tennis-volley" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [streak, setStreak] = useState(0);
  const [rally, setRally] = useState(0);
  const [level, setLevel] = useState(1);
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
    setStreak(0);
    setRally(0);
    setLevel(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastStreak = -1;
    let lastRally = -1;
    let lastLevel = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      const lv = 1 + Math.min(5, Math.floor(g.streak / 5));
      if (g.streak !== lastStreak) {
        lastStreak = g.streak;
        setStreak(g.streak);
      }
      if (g.rally !== lastRally) {
        lastRally = g.rally;
        setRally(g.rally);
      }
      if (lv !== lastLevel) {
        lastLevel = lv;
        setLevel(lv);
      }

      draw();
      if (g.over) {
        setStreak(g.streak);
        setRally(g.rallyBest);
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
    if (status !== "playing") draw();
  }, [status, draw]);

  useEffect(() => {
    const isMove = (k: string) =>
      k === "ArrowUp" ||
      k === "ArrowDown" ||
      k === "ArrowLeft" ||
      k === "ArrowRight" ||
      (k.length === 1 && "wasd".includes(k.toLowerCase()));

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key;
      if (status === "playing" && (isMove(k) || k === " ")) e.preventDefault();
      if (k === " " || k === "Enter") {
        if (status !== "playing") {
          e.preventDefault();
          start();
          return;
        }
      }
      if (status !== "playing") return;
      const g = gameRef.current;
      if (!g) return;
      if (isMove(k)) g.keys[k.toLowerCase()] = true;
      if (k === " ") g.spaceDown = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (isMove(e.key)) g.keys[e.key.toLowerCase()] = false;
      if (e.key === " ") g.spaceDown = false;
    };

    const onBlur = () => {
      const g = gameRef.current;
      if (!g) return;
      g.keys = {};
      g.spaceDown = false;
      g.ptrDown = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
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
    <div className="w-full max-w-[500px]">
      <GameHud score={streak} best={best ?? "—"}>
        <span className="text-yellow-300">
          Rally <b className="ml-1 text-sm text-ink">{rally}</b>
        </span>
        <span className="text-orange-300">
          Level <b className="ml-1 text-sm text-ink">{level}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(250,204,21,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Tennis Volley court"
          onPointerDown={(e) => {
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            g.ptr = toCanvas(e.clientX, e.clientY, e.currentTarget);
            g.ptrDown = true;
          }}
          onPointerMove={(e) => {
            const g = gameRef.current;
            if (!g || !g.ptrDown) return;
            g.ptr = toCanvas(e.clientX, e.clientY, e.currentTarget);
          }}
          onPointerUp={() => {
            const g = gameRef.current;
            if (g) g.ptrDown = false;
          }}
          onPointerCancel={() => {
            const g = gameRef.current;
            if (g) g.ptrDown = false;
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">TENNIS VOLLEY</p>
            <p className="mt-2 text-sm text-muted">
              Top-down singles, one court, no second chances. Move with WASD, the arrow keys or a
              held mouse and the swing happens on contact — your movement steers the shot. Release
              for a floating lob, hold to flatten a drive (low contacts can clip the tape). Win a
              point and the streak climbs; every five points the opponent sharpens. Drop one point
              and the match is over.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Serve up
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              WASD / arrows to move · hold to drive · tap to lob
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">POINT LOST</p>
            <p className="mt-2 text-sm text-muted">
              You took <b className="text-ink">{streak}</b> {streak === 1 ? "point" : "points"} in
              a row and stretched one rally to <b className="text-ink">{rally}</b>{" "}
              {rally === 1 ? "shot" : "shots"}.
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              The next point starts with a drop — get under it
            </p>
          </Overlay>
        )}
      </div>
    </div>
  );
}
