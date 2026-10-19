"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 560;
const H = 400;
const TAU = Math.PI * 2;
const TONE = "from-rose-400 via-pink-500 to-fuchsia-600";
const FLOOR = 336;
const GRAV = 700;
const BR = 7;
const P_MIN = 70;
const P_MAX = 240;
const A_MIN = 320;
const A_MAX = 490;
const MAX_BALLS = 3;

type Status = "idle" | "playing" | "over";

interface Pt {
  x: number;
  y: number;
}
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: "p" | "a";
  trail: Pt[];
  reacted: boolean;
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

interface Guy {
  x: number;
  vx: number;
  duck: boolean;
  lean: number;
  flash: number;
}

interface Game {
  p: Guy;
  a: Guy;
  balls: number;
  aBalls: number;
  regenT: number;
  throwCd: number;
  pPts: number;
  aPts: number;
  pSets: number;
  aSets: number;
  match: number;
  lvl: number;
  streak: number;
  maxStreak: number;
  dir: -1 | 0 | 1;
  projectiles: Ball[];
  telegraphT: number; // > 0 while the rival winds up
  telegraphDur: number;
  aim: Pt; // where the rival is aiming
  reactT: number;
  reacted: boolean;
  aDodgeT: number;
  aDodgeDir: -1 | 1;
  aState: "strafe" | "wind";
  aTargetX: number;
  aRetargetT: number;
  banner: string;
  bannerSub: string;
  bannerT: number;
  phase: "round" | "pause";
  pauseT: number;
  pendingLose: boolean;
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
      r: 1.4 + Math.random() * 2.2,
      c,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, c: string): void {
  g.floats.push({ x, y, text, life: 1, c });
}

function solveShot(sx: number, sy: number, tx: number, ty: number, speed: number) {
  const dx = tx - sx;
  const tf = Math.max(0.26, Math.abs(dx) / speed);
  return {
    vx: dx / tf,
    vy: (ty - sy - 0.5 * GRAV * tf * tf) / tf,
  };
}

function freshGuy(x: number): Guy {
  return { x, vx: 0, duck: false, lean: 0, flash: 0 };
}

function startRound(g: Game): void {
  g.p = freshGuy(150);
  g.a = freshGuy(410);
  g.projectiles = [];
  g.throwCd = 0;
  g.regenT = Math.min(g.regenT, 1.2);
  g.telegraphT = 0;
  g.aState = "strafe";
  g.aRetargetT = 0.4;
  g.aTargetX = 410;
  g.aDodgeT = 0;
  g.phase = "round";
}

function createGame(): Game {
  const g: Game = {
    p: freshGuy(150),
    a: freshGuy(410),
    balls: 2,
    aBalls: 3,
    regenT: 0,
    throwCd: 0,
    pPts: 0,
    aPts: 0,
    pSets: 0,
    aSets: 0,
    match: 1,
    lvl: 0,
    streak: 0,
    maxStreak: 0,
    dir: 0,
    projectiles: [],
    telegraphT: 0,
    telegraphDur: 0.55,
    aim: { x: 150, y: FLOOR - 106 },
    reactT: 0,
    reacted: false,
    aDodgeT: 0,
    aDodgeDir: 1,
    aState: "strafe",
    aTargetX: 410,
    aRetargetT: 0.4,
    banner: "MATCH 1 — DODGE!",
    bannerSub: "Tap to throw · Space to duck",
    bannerT: 2,
    phase: "round",
    pauseT: 0,
    pendingLose: false,
    parts: [],
    floats: [],
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    over: false,
  };
  startRound(g);
  return g;
}

/* ------------------------------ actions ------------------------------ */

function throwBall(g: Game): void {
  if (g.phase !== "round" || g.throwCd > 0) return;
  if (g.p.duck) {
    floater(g, g.p.x, FLOOR - 140, "DUCKING", "#94a3b8");
    return;
  }
  if (g.balls <= 0) {
    floater(g, g.p.x, FLOOR - 140, "NO BALL — CATCH ONE", "#fbbf24");
    return;
  }
  g.balls -= 1;
  g.throwCd = 0.42;
  const sx = g.p.x + 20;
  const sy = FLOOR - 78;
  const tx = g.a.x + g.a.vx * 0.18;
  const v = solveShot(sx, sy, tx, FLOOR - 106, 540);
  g.projectiles.push({ x: sx, y: sy, vx: v.vx, vy: v.vy, owner: "p", trail: [], reacted: false });
  burst(g, sx, sy, "#f472b6", 6, 110);
}

function rivalThrow(g: Game): void {
  g.aBalls -= 1;
  const sx = g.a.x - 20;
  const sy = FLOOR - 78;
  const err = (Math.random() - 0.5) * Math.max(0, 60 - g.lvl * 8);
  const v = solveShot(sx, sy, g.p.x + err, FLOOR - 100, 500 + g.lvl * 12);
  g.projectiles.push({ x: sx, y: sy, vx: v.vx, vy: v.vy, owner: "a", trail: [], reacted: false });
  g.telegraphT = 0;
  g.aState = "strafe";
  burst(g, sx, sy, "#fb7185", 6, 110);
}

function scorePoint(g: Game, who: "p" | "a"): void {
  g.phase = "pause";
  g.projectiles = [];
  g.p.duck = false;
  g.a.duck = false;
  if (who === "p") {
    g.pPts += 1;
    g.streak += 1;
    g.maxStreak = Math.max(g.maxStreak, g.streak);
    g.banner = "HIT!";
    g.bannerSub = g.streak > 1 ? `Streak ${g.streak}` : "Clean throw";
  } else {
    g.aPts += 1;
    g.streak = 0;
    g.banner = "TAGGED";
    g.bannerSub = "Shake it off";
  }
  g.pauseT = 1.5;

  if (g.pPts >= 5) {
    g.pSets += 1;
    g.pPts = 0;
    g.aPts = 0;
    if (g.pSets >= 2) {
      g.pSets = 0;
      g.aSets = 0;
      g.match += 1;
      g.lvl += 1;
      g.banner = `MATCH ${g.match} WON`;
      g.bannerSub = "Faster rival incoming";
      g.pauseT = 2.1;
      return;
    }
    g.banner = "SET YOURS!";
    g.bannerSub = "First to two sets";
    g.pauseT = 1.9;
  } else if (g.aPts >= 5) {
    g.aSets += 1;
    g.aPts = 0;
    g.pPts = 0;
    if (g.aSets >= 2) {
      g.banner = "MATCH LOST";
      g.bannerSub = "He read your step";
      g.pauseT = 1.7;
      g.pendingLose = true;
      return;
    }
    g.banner = "HIS SET";
    g.bannerSub = "Reset — first to two";
    g.pauseT = 1.9;
  }
}

/* ------------------------------ hits ------------------------------ */

function inBody(x: number, y: number, gx: number, duck: boolean): boolean {
  const top = duck ? FLOOR - 66 : FLOOR - 118;
  return x > gx - 17 && x < gx + 17 && y > top && y < FLOOR;
}

function inHead(x: number, y: number, gx: number, duck: boolean): boolean {
  if (duck) return false;
  return Math.hypot(x - (gx + 4), y - (FLOOR - 106)) < 12 + BR;
}

function resolveHits(g: Game): boolean {
  for (let i = g.projectiles.length - 1; i >= 0; i--) {
    const b = g.projectiles[i];
    if (b.owner === "p") {
      if (inHead(b.x, b.y, g.a.x, false)) {
        g.projectiles.splice(i, 1);
        g.shake = 11;
        g.flash = 0.55;
        g.flashC = "#f43f5e";
        g.a.flash = 0.4;
        g.streak += 1; // headshots double the streak
        burst(g, g.a.x, FLOOR - 106, "#fde68a", 22, 240);
        floater(g, g.a.x, FLOOR - 150, "HEADSHOT! ×2", "#fde68a");
        scorePoint(g, "p");
        return true;
      }
      if (inBody(b.x, b.y, g.a.x, false)) {
        g.projectiles.splice(i, 1);
        g.shake = 8;
        g.flash = 0.4;
        g.flashC = "#fb7185";
        g.a.flash = 0.35;
        burst(g, b.x, b.y, "#f472b6", 14, 190);
        floater(g, g.a.x, FLOOR - 150, "HIT!", "#f9a8d4");
        scorePoint(g, "p");
        return true;
      }
    } else {
      const ducking = g.p.duck;
      if (inBody(b.x, b.y, g.p.x, false)) {
        g.projectiles.splice(i, 1);
        if (ducking) {
          // clean grab — he tucked the catch
          g.balls = Math.min(MAX_BALLS, g.balls + 1);
          g.shake = 5;
          burst(g, g.p.x, FLOOR - 60, "#a5f3fc", 16, 180);
          floater(g, g.p.x, FLOOR - 150, "CATCH! +1 BALL", "#67e8f9");
          continue;
        }
        g.shake = 10;
        g.flash = 0.5;
        g.flashC = "#fb7185";
        g.p.flash = 0.4;
        g.streak = 0;
        burst(g, b.x, b.y, "#fb7185", 16, 200);
        if (inHead(b.x, b.y, g.p.x, false)) {
          floater(g, g.p.x, FLOOR - 150, "HEADSHOT — OUCH", "#fda4af");
        } else {
          floater(g, g.p.x, FLOOR - 150, "TAGGED", "#fda4af");
        }
        scorePoint(g, "a");
        return true;
      }
    }
  }
  return false;
}

/* ------------------------------ step ------------------------------ */

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt * 1.7);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);
  if (g.throwCd > 0) g.throwCd = Math.max(0, g.throwCd - dt);
  if (g.p.flash > 0) g.p.flash = Math.max(0, g.p.flash - dt);
  if (g.a.flash > 0) g.a.flash = Math.max(0, g.a.flash - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 240 * dt;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.15;
    f.y -= 28 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (g.phase === "pause") {
    g.pauseT -= dt;
    if (g.pauseT <= 0) {
      if (g.pendingLose) {
        g.over = true;
      } else {
        g.balls = Math.min(MAX_BALLS, g.balls + 1);
        g.aBalls = Math.min(MAX_BALLS, g.aBalls + 1);
        startRound(g);
      }
    }
    return;
  }

  // player movement
  const p = g.p;
  if (g.dir !== 0) {
    p.vx = g.dir * 235;
    p.lean = g.dir;
  } else {
    p.vx *= Math.exp(-9 * dt);
    p.lean = 0;
  }
  p.x = Math.max(P_MIN, Math.min(P_MAX, p.x + p.vx * dt));

  // ball regen
  g.regenT += dt;
  if (g.regenT >= 2.4 && g.balls < MAX_BALLS) {
    g.regenT = 0;
    g.balls += 1;
  }

  // rival brain
  const a = g.a;
  const lvl = g.lvl;
  if (g.aDodgeT > 0) {
    g.aDodgeT = Math.max(0, g.aDodgeT - dt);
    a.vx = g.aDodgeDir * (250 + lvl * 16);
  } else if (g.aState === "wind") {
    a.vx *= Math.exp(-12 * dt);
  } else {
    g.aRetargetT -= dt;
    if (g.aRetargetT <= 0) {
      g.aTargetX = A_MIN + Math.random() * (A_MAX - A_MIN);
      g.aRetargetT = 0.5 + Math.random() * 0.8;
    }
    a.vx = Math.sign(g.aTargetX - a.x) * 140;
  }
  a.x = Math.max(A_MIN, Math.min(A_MAX, a.x + a.vx * dt));

  // rival throw cycle
  if (g.aState === "strafe") {
    if (g.aBalls <= 0) g.aBalls += 1; // he always finds another ball
    g.telegraphT -= dt;
    if (g.telegraphT <= -Math.max(0.55, 1.15 - lvl * 0.07)) {
      g.aState = "wind";
      g.telegraphDur = Math.max(0.3, 0.55 - lvl * 0.03);
      g.telegraphT = g.telegraphDur;
      g.aim = { x: g.p.x, y: FLOOR - 100 };
    }
  } else {
    g.telegraphT -= dt;
    g.aim.x = g.p.x; // tracks you while he loads
    if (g.telegraphT <= 0) rivalThrow(g);
  }

  // your throws: dodge reaction
  for (const b of g.projectiles) {
    if (b.owner !== "p" || b.reacted) continue;
    b.reacted = true;
    g.reactT = Math.max(0.13, 0.32 - lvl * 0.022);
  }
  if (g.reactT > 0) {
    g.reactT -= dt;
    if (g.reactT <= 0 && g.aDodgeT <= 0) {
      const incoming = g.projectiles.find((b) => b.owner === "p");
      if (incoming) {
        const away = a.x >= incoming.x ? 1 : -1;
        g.aDodgeDir = away < 0 && a.x - 17 <= A_MIN ? 1 : away > 0 && a.x + 17 >= A_MAX ? -1 : away;
        g.aDodgeT = 0.36;
      }
    }
  }

  // physics + bounds
  for (let i = g.projectiles.length - 1; i >= 0; i--) {
    const b = g.projectiles[i];
    b.vy += GRAV * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 10) b.trail.shift();
    if (b.y + BR >= FLOOR) {
      // bounce once, then it's dead
      b.y = FLOOR - BR;
      if (Math.abs(b.vy) > 60) {
        b.vy = -Math.abs(b.vy) * 0.45;
        b.vx *= 0.7;
        burst(g, b.x, FLOOR - 2, "#e2e8f0", 4, 70);
      } else {
        g.projectiles.splice(i, 1);
        continue;
      }
    }
    if (b.x < 20 || b.x > W - 20 || b.y < 10) {
      g.projectiles.splice(i, 1);
    }
  }

  resolveHits(g);
}

/* ------------------------------ render ------------------------------ */

function drawGuy(
  ctx: CanvasRenderingContext2D,
  g: Game,
  side: "p" | "a",
  time: number,
): void {
  const isP = side === "p";
  const m = isP ? g.p : g.a;
  const main = isP ? "#f472b6" : "#fb7185";
  const trim = isP ? "#831843" : "#881337";
  const duck = isP && m.duck;
  const bob = duck ? 0 : Math.sin(time / 300 + (isP ? 0 : 1.5)) * 2;
  const crouch = duck ? 26 : 0;

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(m.x, FLOOR + 3, 22, 6, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(m.x, FLOOR + bob + crouch);
  if (m.flash > 0 && Math.floor(time / 60) % 2 === 0) ctx.globalAlpha = 0.5;

  // legs
  ctx.strokeStyle = trim;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-4, -36);
  ctx.lineTo(-9, 0);
  ctx.moveTo(5, -36);
  ctx.lineTo(10, 0);
  ctx.stroke();

  // torso
  ctx.save();
  ctx.shadowColor = hexA(main, 0.6);
  ctx.shadowBlur = 12;
  ctx.fillStyle = m.flash > 0 ? "#ffffff" : main;
  ctx.beginPath();
  ctx.roundRect(-11, -76 + crouch, 22, 42, 8);
  ctx.fill();
  ctx.restore();

  // arms
  ctx.strokeStyle = main;
  ctx.lineWidth = 6;
  const armUp = isP && g.balls > 0 && !duck ? -8 : 0;
  ctx.beginPath();
  ctx.moveTo(-9, -66 + crouch);
  ctx.lineTo(-19, -44 + crouch + armUp);
  ctx.moveTo(9, -66 + crouch);
  ctx.lineTo(19, -46 + crouch + armUp);
  ctx.stroke();

  // head
  ctx.fillStyle = "#ffe4e6";
  ctx.beginPath();
  ctx.arc(2, -88 + crouch, 11, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#3f0d1f";
  ctx.beginPath();
  ctx.arc(6, -89 + crouch, 1.8, 0, TAU);
  ctx.fill();

  // held ball glow
  if (isP && g.balls > 0 && !duck) {
    ctx.save();
    ctx.shadowColor = "rgba(244, 114, 182, 0.95)";
    ctx.shadowBlur = 14 + Math.sin(time / 200) * 5;
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.arc(22, -52, 6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  // court
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a0713");
  bg.addColorStop(0.6, "#140510");
  bg.addColorStop(1, "#0d040a");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  const spot = ctx.createRadialGradient(W / 2, 140, 40, W / 2, 140, 340);
  spot.addColorStop(0, "rgba(244, 63, 94, 0.12)");
  spot.addColorStop(1, "rgba(244, 63, 94, 0)");
  ctx.fillStyle = spot;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // court halves + centre line
  ctx.fillStyle = "rgba(190, 18, 60, 0.10)";
  ctx.fillRect(40, 90, W / 2 - 40, FLOOR - 90);
  ctx.fillStyle = "rgba(131, 24, 97, 0.10)";
  ctx.fillRect(W / 2, 90, W / 2 - 40, FLOOR - 90);
  ctx.strokeStyle = "rgba(251, 113, 133, 0.45)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 86);
  ctx.lineTo(W / 2, FLOOR);
  ctx.stroke();
  ctx.setLineDash([]);

  // floor
  ctx.fillStyle = "rgba(76, 25, 45, 0.6)";
  ctx.fillRect(28, FLOOR, W - 56, H - FLOOR);
  ctx.strokeStyle = "rgba(251, 113, 133, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(28, FLOOR);
  ctx.lineTo(W - 28, FLOOR);
  ctx.stroke();

  if (g) {
    // rival telegraph arc
    if (g.aState === "wind") {
      const t = Math.max(0, g.telegraphT) / Math.max(0.01, g.telegraphDur);
      const sx = g.a.x - 20;
      const sy = FLOOR - 78;
      const v = solveShot(sx, sy, g.aim.x, g.aim.y, 500 + g.lvl * 12);
      ctx.save();
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -time / 30;
      ctx.strokeStyle = `rgba(251, 63, 110, ${0.35 + (1 - t) * 0.5})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let px = sx;
      let py = sy;
      const vx = v.vx;
      let vy = v.vy;
      ctx.moveTo(px, py);
      for (let i = 0; i < 44; i++) {
        vy += GRAV / 44;
        px += vx / 44;
        py += vy / 44;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.fillStyle = "rgba(2, 6, 23, 0.75)";
      ctx.beginPath();
      ctx.roundRect(g.a.x - 30, FLOOR - 172, 60, 22, 11);
      ctx.fill();
      ctx.font = "800 12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fb7185";
      ctx.fillText(`${Math.max(0, Math.ceil(g.telegraphT * 10) / 10)}s`, g.a.x, FLOOR - 157);
    }

    drawGuy(ctx, g, "a", time);
    drawGuy(ctx, g, "p", time);

    // projectiles
    for (const b of g.projectiles) {
      for (let i = 0; i < b.trail.length; i++) {
        const k = i / b.trail.length;
        ctx.fillStyle = `rgba(254, 243, 199, ${0.05 + k * 0.25})`;
        ctx.beginPath();
        ctx.arc(b.trail[i].x, b.trail[i].y, BR * (0.4 + k * 0.6), 0, TAU);
        ctx.fill();
      }
      ctx.save();
      ctx.shadowColor = "rgba(253, 230, 138, 0.9)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#fef3c7";
      ctx.beginPath();
      ctx.arc(b.x, b.y, BR, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = b.owner === "p" ? "rgba(244, 114, 182, 0.9)" : "rgba(251, 113, 133, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BR, 0.4, 2.2);
      ctx.stroke();
    }

    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // score pips
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#f9a8d4";
    ctx.fillText("YOU", 40, 40);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fda4af";
    ctx.fillText(`RIVAL${g.lvl > 0 ? ` ×${g.lvl + 1}` : ""}`, W - 40, 40);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < g.pPts ? "#f472b6" : "rgba(244, 114, 182, 0.2)";
      ctx.beginPath();
      ctx.arc(40 + i * 15, 54, 5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = i < g.aPts ? "#fb7185" : "rgba(251, 113, 133, 0.2)";
      ctx.beginPath();
      ctx.arc(W - 40 - i * 15, 54, 5, 0, TAU);
      ctx.fill();
    }
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = i < g.pSets ? "#fde68a" : "rgba(253, 230, 138, 0.2)";
      ctx.beginPath();
      ctx.arc(44 + i * 14, 74, 5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = i < g.aSets ? "#fde68a" : "rgba(253, 230, 138, 0.2)";
      ctx.beginPath();
      ctx.arc(W - 44 - i * 14, 74, 5, 0, TAU);
      ctx.fill();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
    ctx.fillText(`MATCH ${g.match} · SET TO 5 · FIRST TO 2 SETS`, W / 2, 40);

    // streak + ammo
    ctx.textAlign = "left";
    ctx.font = "800 13px ui-monospace, monospace";
    ctx.fillStyle = g.streak > 0 ? "#fde68a" : "rgba(148, 163, 184, 0.7)";
    ctx.fillText(`STREAK ${g.streak}`, 40, H - 24);
    for (let i = 0; i < MAX_BALLS; i++) {
      ctx.fillStyle = i < g.balls ? "#fde68a" : "rgba(148, 163, 184, 0.18)";
      ctx.beginPath();
      ctx.arc(160 + i * 16, H - 28, 5.5, 0, TAU);
      ctx.fill();
    }
    ctx.font = "600 9px ui-monospace, monospace";
    ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
    ctx.textAlign = "right";
    ctx.fillText("BALLS", W - 40, H - 24);

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
      ctx.shadowColor = "rgba(244, 63, 94, 0.9)";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, 150);
      ctx.shadowBlur = 0;
      ctx.font = "700 12px ui-monospace, monospace";
      ctx.fillStyle = "rgba(251, 207, 232, 0.9)";
      ctx.fillText(g.bannerSub, W / 2, 170);
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

export default function Dodgeball({ gameId = "dodgeball" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [streak, setStreak] = useState(0);
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
    setStreak(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const doThrow = useCallback(() => {
    const g = gameRef.current;
    if (g) throwBall(g);
  }, []);

  const setDuck = useCallback((on: boolean) => {
    const g = gameRef.current;
    if (g && g.phase === "round") g.p.duck = on;
  }, []);

  const setDir = useCallback((dir: -1 | 0 | 1) => {
    const g = gameRef.current;
    if (g) g.dir = dir;
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastStreak = -1;

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

      draw(t);
      if (g.over) {
        setStreak(g.maxStreak);
        setNewBest(submit(g.maxStreak));
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
        if (status !== "playing") {
          start();
          return;
        }
        if (e.key === " " && !e.repeat) setDuck(true);
        return;
      }
      if (status !== "playing") return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "ArrowLeft" || key === "a") {
        e.preventDefault();
        setDir(-1);
      } else if (key === "ArrowRight" || key === "d") {
        e.preventDefault();
        setDir(1);
      } else if ((key === "f" || key === "Enter") && !e.repeat) {
        doThrow();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === " ") setDuck(false);
      if (key === "ArrowLeft" || key === "a" || key === "ArrowRight" || key === "d") setDir(0);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start, setDuck, setDir, doThrow]);

  const padBtn =
    "touch-none rounded-xl border bg-surface py-3 font-mono text-xs font-bold uppercase tracking-wider transition active:scale-95";

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={streak} best={best ?? "—"} accent="text-rose-300" />

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(244,63,94,0.85)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Dodgeball court"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") start();
            else doThrow();
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">DODGEBALL</p>
            <p className="mt-2 text-sm text-muted">
              Two sets of five against a rival who never stops moving. Click or tap to hurl your
              ball — headshots double your streak. His throws are telegraphed with a red arc: step
              aside, or hold Space to duck and snatch the ball out of the air for ammo. Dodge first,
              throw second.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Hit the court
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ← → step · Space duck · click / tap / F throw
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">MATCH LOST</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best streak!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{streak}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Longest streak · best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Duck his red arc — a clean catch reloads you instantly
            </p>
          </Overlay>
        )}
      </div>

      <div className="mt-2 grid touch-none select-none grid-cols-4 gap-2">
        <button
          type="button"
          onPointerDown={() => setDir(-1)}
          onPointerUp={() => setDir(0)}
          onPointerLeave={() => setDir(0)}
          onPointerCancel={() => setDir(0)}
          aria-label="Step left — key Left"
          className={`${padBtn} border-rose-400/50 text-rose-300`}
        >
          ← Step
        </button>
        <button
          type="button"
          onPointerDown={() => setDuck(true)}
          onPointerUp={() => setDuck(false)}
          onPointerLeave={() => setDuck(false)}
          onPointerCancel={() => setDuck(false)}
          aria-label="Duck and catch — hold Space"
          className={`${padBtn} border-pink-400/50 text-pink-300`}
        >
          Duck
        </button>
        <button
          type="button"
          onPointerDown={() => setDir(1)}
          onPointerUp={() => setDir(0)}
          onPointerLeave={() => setDir(0)}
          onPointerCancel={() => setDir(0)}
          aria-label="Step right — key Right"
          className={`${padBtn} border-fuchsia-400/50 text-fuchsia-300`}
        >
          Step →
        </button>
        <button
          type="button"
          onPointerDown={doThrow}
          aria-label="Throw ball — key F or click the court"
          className={`${padBtn} border-amber-300/60 text-amber-200`}
        >
          Throw
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Red arc incoming = duck or step · headshots double the streak
      </p>
    </div>
  );
}
