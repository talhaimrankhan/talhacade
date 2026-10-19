"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 560;
const GROUND = 512;
const G = 520;
const FORT_X = 240;
const ORIGIN = { x: 240, y: 456 };
const FORT_HIT_Y = 458;
const HP_START = 5;
const HP_MAX = 9;
const COVER_MAX = 3;

const BARRICADE = { x: 152, y: 424, w: 176, h: 26 };

type Status = "idle" | "playing" | "over";

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

interface Enemy {
  kind: "elf" | "snowman" | "bot";
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  worth: number;
  heavy: boolean;
  throwY: number;
  throwT: number;
  tx: number;
  ty: number;
  wob: number;
  hitT: number;
  state: "walk" | "throw";
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  foe: boolean;
  heavy: boolean;
  trail: Pt[];
}

interface Coin {
  x: number;
  y: number;
  vy: number;
  t: number;
}

interface SiegesGame {
  enemies: Enemy[];
  balls: Ball[];
  coins: Coin[];
  parts: Part[];
  floaters: Floater[];
  wave: number;
  toSpawn: number;
  spawnT: number;
  intermission: boolean;
  waveGap: number;
  score: number;
  wallet: number;
  hp: number;
  cover: number;
  packT: number;
  packTime: number;
  pellets: number;
  splashR: number;
  shake: number;
  flash: number;
  banner: string;
  bannerT: number;
  over: boolean;
  dirty: boolean;
}

const PERKS = [
  { id: "repack", name: "REPACK WALL", cost: 4 },
  { id: "pack", name: "PACK FAST", cost: 6 },
  { id: "triple", name: "TRIPLE THROW", cost: 8 },
  { id: "heavy", name: "HEAVY BALL", cost: 7 },
  { id: "patch", name: "FORT PATCH", cost: 6 },
] as const;

function spawnGap(wave: number): number {
  return Math.max(0.32, 1.15 - wave * 0.045);
}

function startWave(g: SiegesGame, wave: number): void {
  g.wave = wave;
  g.toSpawn = Math.min(26, 4 + wave * 2);
  g.spawnT = 0.9;
  g.intermission = false;
  g.waveGap = 0;
  g.banner = `WAVE ${wave}`;
  g.bannerT = 1.4;
  g.dirty = true;
}

function createGame(): SiegesGame {
  const g: SiegesGame = {
    enemies: [],
    balls: [],
    coins: [],
    parts: [],
    floaters: [],
    wave: 0,
    toSpawn: 0,
    spawnT: 0,
    intermission: false,
    waveGap: 0,
    score: 0,
    wallet: 0,
    hp: HP_START,
    cover: COVER_MAX,
    packT: 0,
    packTime: 0.75,
    pellets: 1,
    splashR: 32,
    shake: 0,
    flash: 0,
    banner: "",
    bannerT: 0,
    over: false,
    dirty: true,
  };
  startWave(g, 1);
  return g;
}

function burst(parts: Part[], x: number, y: number, c: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 55 + Math.random() * 190;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.32 + Math.random() * 0.42,
      max: 0.74,
      r: 1.4 + Math.random() * 2.6,
      c,
    });
  }
}

function spawnEnemy(g: SiegesGame): void {
  const w = g.wave;
  const roll = Math.random();
  let kind: Enemy["kind"] = "snowman";
  if (w >= 4 && roll < Math.min(0.3, 0.08 + (w - 3) * 0.05)) kind = "bot";
  else if (roll < 0.62) kind = "elf";

  let r = 19;
  let hp = 2;
  let speed = 36;
  let worth = 12;
  if (kind === "elf") {
    r = 14;
    hp = 1;
    speed = 54;
    worth = 20;
  } else if (kind === "bot") {
    r = 17;
    hp = 3;
    speed = 30;
    worth = 35;
  }

  g.enemies.push({
    kind,
    x: 46 + Math.random() * (W - 92),
    y: -36 - Math.random() * 46,
    r,
    hp,
    maxHp: hp,
    speed: Math.min(190, speed * (1 + w * 0.05)),
    worth,
    heavy: kind === "bot",
    throwY: 258 + Math.random() * 124,
    throwT: 1.4 + Math.random() * 1.2,
    tx: FORT_X,
    ty: 470,
    wob: Math.random() * Math.PI * 2,
    hitT: 0,
    state: "walk",
  });
}

function killEnemy(g: SiegesGame, idx: number): void {
  const e = g.enemies[idx];
  if (!e) return;
  g.enemies.splice(idx, 1);
  g.score += e.worth;
  g.shake = Math.max(g.shake, 5);
  burst(g.parts, e.x, e.y, "#f8fafc", 16);
  burst(g.parts, e.x, e.y, e.kind === "elf" ? "#6ee7b7" : e.kind === "bot" ? "#7dd3fc" : "#e0f2fe", 8);
  g.floaters.push({ x: e.x, y: e.y - e.r - 8, text: `+${e.worth}`, life: 0.85, c: "#5eead4" });
  g.coins.push({ x: e.x, y: e.y, vy: -110 - Math.random() * 60, t: 0 });
  g.dirty = true;
}

function hurtEnemy(g: SiegesGame, idx: number, dmg: number): void {
  const e = g.enemies[idx];
  if (!e) return;
  e.hp -= dmg;
  e.hitT = 0.16;
  if (e.hp <= 0) killEnemy(g, idx);
}

function splashAt(g: SiegesGame, x: number, y: number, skip: number): void {
  burst(g.parts, x, y, "#e0f2fe", 14);
  burst(g.parts, x, y, "#ffffff", 7);
  g.shake = Math.max(g.shake, 4);
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    if (i === skip) continue;
    const e = g.enemies[i];
    if (Math.hypot(e.x - x, e.y - y) > g.splashR + e.r) continue;
    hurtEnemy(g, i, 1);
  }
}

function aimSolution(x0: number, y0: number, x1: number, y1: number, t: number): Pt {
  return { x: (x1 - x0) / t, y: (y1 - y0 - 0.5 * G * t * t) / t };
}

function throwAtFort(g: SiegesGame, e: Enemy): void {
  const v = aimSolution(e.x, e.y, e.tx, e.ty, 1.7);
  const shots = e.heavy ? [-20, 20] : [0];
  for (const off of shots) {
    g.balls.push({
      x: e.x,
      y: e.y,
      vx: v.x + off * 0.3,
      vy: v.y,
      r: e.heavy ? 7 : 6,
      foe: true,
      heavy: e.heavy,
      trail: [],
    });
  }
}

function rollTarget(g: SiegesGame, e: Enemy): void {
  e.tx = FORT_X + (Math.random() * 2 - 1) * 46;
  e.ty = 470;
  void g;
}

function circleRect(cx: number, cy: number, r: number, rect: { x: number; y: number; w: number; h: number }): boolean {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  return Math.hypot(cx - nx, cy - ny) < r;
}

/** Spends leftover coins on the next wave's perks, cheapest-first in a fixed order. */
function autoBuy(g: SiegesGame): string[] {
  const bought: string[] = [];
  for (let n = 0; n < 8; n++) {
    let spent = false;
    for (const p of PERKS) {
      if (g.wallet < p.cost) continue;
      if (p.id === "repack" && g.cover >= COVER_MAX) continue;
      if (p.id === "patch" && g.hp >= HP_MAX) continue;
      g.wallet -= p.cost;
      if (p.id === "repack") g.cover += 1;
      else if (p.id === "pack") g.packTime = Math.max(0.16, g.packTime * 0.62);
      else if (p.id === "triple") g.pellets = Math.min(5, g.pellets + 2);
      else if (p.id === "heavy") g.splashR = Math.min(74, g.splashR + 9);
      else g.hp = Math.min(HP_MAX, g.hp + 1);
      bought.push(p.name);
      spent = true;
      break;
    }
    if (!spent) break;
  }
  return bought;
}

function hitCover(g: SiegesGame, heavy: boolean, x: number, y: number): void {
  g.cover = Math.max(0, g.cover - (heavy ? 2 : 1));
  g.shake = Math.max(g.shake, 6);
  burst(g.parts, x, y, "#bae6fd", 14);
  g.floaters.push({ x, y, text: heavy ? "SMASH!" : "CRACK", life: 0.9, c: "#7dd3fc" });
  g.dirty = true;
}

function hitFort(g: SiegesGame, x: number, y: number): void {
  g.hp -= 1;
  g.flash = 0.55;
  g.shake = Math.max(g.shake, 10);
  burst(g.parts, x, y, "#fda4af", 16);
  g.floaters.push({ x: FORT_X, y: 452, text: "−1", life: 1, c: "#fb7185" });
  g.dirty = true;
}

/** One physics tick. Returns "over" when the fort falls, else null. */
function stepGame(g: SiegesGame, dt: number): "over" | null {
  if (g.over) return "over";

  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt);
  g.bannerT = Math.max(0, g.bannerT - dt);
  g.packT = Math.max(0, g.packT - dt);

  // spawning + wave flow
  if (g.intermission) {
    g.waveGap -= dt;
    if (g.waveGap <= 0) startWave(g, g.wave + 1);
  } else {
    if (g.toSpawn > 0) {
      g.spawnT -= dt;
      if (g.spawnT <= 0) {
        spawnEnemy(g);
        g.toSpawn -= 1;
        g.spawnT = spawnGap(g.wave);
      }
    }
    if (g.toSpawn === 0 && g.enemies.length === 0) {
      const bonus = 50 * g.wave;
      g.score += bonus;
      g.intermission = true;
      g.waveGap = 2.3;
      g.banner = `WAVE ${g.wave} CLEARED`;
      g.bannerT = 1.7;
      g.floaters.push({ x: FORT_X, y: 330, text: `+${bonus}`, life: 1.5, c: "#5eead4" });
      const bought = autoBuy(g);
      const shown = Math.min(4, bought.length);
      for (let i = 0; i < shown; i++) {
        g.floaters.push({
          x: FORT_X,
          y: 366 + i * 24,
          text: `BOUGHT ${bought[i]}`,
          life: 2.2,
          c: "#fde68a",
        });
      }
      if (bought.length > shown) {
        g.floaters.push({
          x: FORT_X,
          y: 366 + shown * 24,
          text: `+${bought.length - shown} MORE`,
          life: 2.2,
          c: "#fde68a",
        });
      }
      g.dirty = true;
    }
  }

  // enemies
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    e.hitT = Math.max(0, e.hitT - dt);
    if (e.state === "walk") {
      e.wob += dt * 6;
      e.y += e.speed * dt;
      e.x += Math.sin(e.wob) * 10 * dt;
      e.x = Math.max(e.r + 6, Math.min(W - e.r - 6, e.x));
      if (e.y >= e.throwY) {
        e.state = "throw";
        rollTarget(g, e);
      }
      continue;
    }
    e.throwT -= dt;
    if (e.throwT <= 0) {
      throwAtFort(g, e);
      rollTarget(g, e);
      e.throwT = Math.max(1.0, 2.5 - g.wave * 0.09) * (0.85 + Math.random() * 0.3);
    }
  }

  // balls
  for (let i = g.balls.length - 1; i >= 0; i--) {
    const b = g.balls[i];
    b.vy += G * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (!b.foe) {
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 9) b.trail.shift();
    }

    if (b.x < -34 || b.x > W + 34 || b.y > H + 34) {
      g.balls.splice(i, 1);
      continue;
    }

    if (b.foe) {
      if (g.cover > 0 && circleRect(b.x, b.y, b.r, BARRICADE)) {
        hitCover(g, b.heavy, b.x, Math.min(b.y, BARRICADE.y + BARRICADE.h));
        g.balls.splice(i, 1);
        continue;
      }
      if (b.y >= FORT_HIT_Y && Math.abs(b.x - FORT_X) < 50) {
        hitFort(g, b.x, b.y);
        g.balls.splice(i, 1);
        continue;
      }
      if (b.y >= GROUND - 4) {
        burst(g.parts, b.x, b.y, "#e0f2fe", 7);
        g.balls.splice(i, 1);
        continue;
      }
      continue;
    }

    // player snowball → enemy
    let hit = -1;
    for (let j = 0; j < g.enemies.length; j++) {
      const e = g.enemies[j];
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
        hit = j;
        break;
      }
    }
    if (hit >= 0) {
      hurtEnemy(g, hit, 1);
      splashAt(g, b.x, b.y, hit);
      g.balls.splice(i, 1);
      continue;
    }
    if (b.y >= GROUND - 4) {
      splashAt(g, b.x, b.y, -1);
      g.balls.splice(i, 1);
      continue;
    }
  }

  // mid-air blocks: your ball vs theirs
  for (let i = g.balls.length - 1; i >= 0; i--) {
    const b = g.balls[i];
    if (b.foe) continue;
    for (let j = g.balls.length - 1; j >= 0; j--) {
      const f = g.balls[j];
      if (!f.foe) continue;
      if (Math.hypot(b.x - f.x, b.y - f.y) > b.r + f.r) continue;
      burst(g.parts, b.x, b.y, "#ffffff", 12);
      g.floaters.push({ x: b.x, y: b.y - 10, text: "BLOCKED!", life: 0.8, c: "#e0f2fe" });
      g.score += 5;
      g.shake = Math.max(g.shake, 3);
      g.balls.splice(Math.max(i, j), 1);
      g.balls.splice(Math.min(i, j), 1);
      g.dirty = true;
      break;
    }
  }

  // coins roll home
  for (let i = g.coins.length - 1; i >= 0; i--) {
    const c = g.coins[i];
    c.t += dt;
    c.vy += 320 * dt;
    c.y += c.vy * dt;
    c.x += (FORT_X - c.x) * 1.4 * dt;
    if (c.y > 452) {
      g.coins.splice(i, 1);
      g.wallet += 1;
      g.floaters.push({ x: FORT_X, y: 444, text: "+1 🪙", life: 0.7, c: "#fde68a" });
      g.dirty = true;
    }
  }

  // particles + floaters
  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      g.parts.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
    p.vx *= 1 - 1.5 * dt;
  }
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.life -= dt;
    f.y -= 26 * dt;
    if (f.life <= 0) g.floaters.splice(i, 1);
  }

  if (g.hp <= 0) {
    g.hp = 0;
    g.over = true;
    return "over";
  }
  return null;
}

/* ---------------- drawing helpers ---------------- */

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number): void {
  const flash = e.hitT > 0.06;
  const windup = e.state === "throw" && e.throwT < 0.55;

  // ground puff
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + e.r * 1.35, e.r * 0.9, e.r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  const sway = Math.sin(e.wob * 2) * 0.06;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(sway);

  if (e.kind === "snowman") {
    ctx.shadowColor = "#e0f2fe";
    ctx.shadowBlur = 14;
    ctx.fillStyle = flash ? "#ffffff" : "#f8fafc";
    ctx.beginPath();
    ctx.arc(0, e.r * 0.6, e.r * 0.78, 0, Math.PI * 2);
    ctx.arc(0, -e.r * 0.22, e.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = flash ? "#ffffff" : "#e2e8f0";
    ctx.beginPath();
    ctx.arc(0, -e.r * 0.95, e.r * 0.48, 0, Math.PI * 2);
    ctx.fill();
    // face
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(-e.r * 0.16, -e.r * 1.05, 2, 0, Math.PI * 2);
    ctx.arc(e.r * 0.16, -e.r * 1.05, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.moveTo(-2, -e.r * 0.92);
    ctx.lineTo(e.r * 0.5, -e.r * 0.84);
    ctx.lineTo(-2, -e.r * 0.76);
    ctx.closePath();
    ctx.fill();
    // scarf
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-e.r * 0.4, -e.r * 0.55);
    ctx.lineTo(e.r * 0.4, -e.r * 0.55);
    ctx.stroke();
    // arms
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const raise = windup ? -0.9 : 0.2;
    ctx.beginPath();
    ctx.moveTo(-e.r * 0.6, -e.r * 0.2);
    ctx.lineTo(-e.r * 1.35, -e.r * 0.2 + e.r * 0.5);
    ctx.moveTo(e.r * 0.6, -e.r * 0.2);
    ctx.lineTo(e.r * 1.3, -e.r * (0.2 - raise));
    ctx.stroke();
  } else if (e.kind === "elf") {
    const raise = windup ? -1.1 : 0;
    // coat
    ctx.shadowColor = "#34d399";
    ctx.shadowBlur = 14;
    ctx.fillStyle = flash ? "#ffffff" : "#059669";
    ctx.beginPath();
    ctx.roundRect(-e.r * 0.7, -e.r * 0.4, e.r * 1.4, e.r * 1.5, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    // arms
    ctx.strokeStyle = "#6ee7b7";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-e.r * 0.6, e.r * 0.1);
    ctx.lineTo(-e.r * 1.2, e.r * 0.5);
    ctx.moveTo(e.r * 0.6, e.r * 0.1);
    ctx.lineTo(e.r * 1.15, e.r * raise);
    ctx.stroke();
    // head
    ctx.shadowColor = "#a7f3d0";
    ctx.shadowBlur = 10;
    ctx.fillStyle = flash ? "#ffffff" : "#d1fae5";
    ctx.beginPath();
    ctx.arc(0, -e.r * 0.75, e.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // hat
    ctx.fillStyle = flash ? "#ffffff" : "#10b981";
    ctx.beginPath();
    ctx.moveTo(-e.r * 0.6, -e.r * 1.05);
    ctx.lineTo(e.r * 0.6, -e.r * 1.05);
    ctx.lineTo(e.r * 0.05, -e.r * 2.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(e.r * 0.05, -e.r * 2.1, 3, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = "#064e3b";
    ctx.beginPath();
    ctx.arc(-e.r * 0.2, -e.r * 0.78, 2, 0, Math.PI * 2);
    ctx.arc(e.r * 0.2, -e.r * 0.78, 2, 0, Math.PI * 2);
    ctx.fill();
    // feet
    ctx.fillStyle = "#065f46";
    ctx.beginPath();
    ctx.ellipse(-e.r * 0.35, e.r * 1.12, e.r * 0.3, e.r * 0.16, 0, 0, Math.PI * 2);
    ctx.ellipse(e.r * 0.35, e.r * 1.12, e.r * 0.3, e.r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // frost bot
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 16;
    ctx.fillStyle = flash ? "#ffffff" : "#0ea5e9";
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * e.r;
      const py = Math.sin(a) * e.r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#e0f2fe";
    ctx.lineWidth = 2;
    ctx.stroke();
    // eye
    const blink = Math.sin(time / 240) > 0.9 ? 1 : 0;
    ctx.fillStyle = "#f0f9ff";
    ctx.beginPath();
    ctx.ellipse(0, -1, e.r * 0.4, e.r * (0.22 + blink * 0.1), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0369a1";
    ctx.beginPath();
    ctx.arc(2, -1, e.r * 0.13, 0, Math.PI * 2);
    ctx.fill();
    // antenna
    ctx.strokeStyle = "#bae6fd";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -e.r);
    ctx.lineTo(0, -e.r - 8);
    ctx.stroke();
    ctx.shadowColor = "#f43f5e";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#f43f5e";
    ctx.beginPath();
    ctx.arc(0, -e.r - 10, 2.6 + Math.sin(time / 150) * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // treads
    ctx.fillStyle = "#075985";
    ctx.beginPath();
    ctx.roundRect(-e.r * 0.8, e.r * 0.7, e.r * 1.6, e.r * 0.4, 3);
    ctx.fill();
  }

  ctx.restore();

  // hp pips
  const pips = e.maxHp;
  for (let k = 0; k < pips; k++) {
    ctx.fillStyle = k < e.hp ? "#5eead4" : "rgba(148,163,184,0.4)";
    ctx.beginPath();
    ctx.arc(e.x - ((pips - 1) / 2) * 9 + k * 9, e.y - e.r * 2.2 - 10, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // windup telegraph
  if (windup) {
    ctx.strokeStyle = `rgba(253, 224, 71, ${0.35 + Math.sin(time / 60) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    const v = aimSolution(e.x, e.y, e.tx, e.ty, 1.7);
    let px = e.x;
    let py = e.y;
    ctx.moveTo(px, py);
    for (let s = 0; s < 26; s++) {
      v.y += G * 0.07;
      px += v.x * 0.07;
      py += v.y * 0.07;
      ctx.lineTo(px, py);
      if (py >= 470) break;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 15px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("!", e.x, e.y - e.r * 2.3 - 24);
    ctx.textAlign = "start";
  }
}

/* ---------------- component ---------------- */

export default function SnowballSiege() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<SiegesGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();
  const dragRef = useRef({ active: false, x0: 0, y0: 0, x: 0, y: 0 });

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [hp, setHp] = useState(HP_START);
  const [wallet, setWallet] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("snowball-siege", "high");

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    // winter sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#04212e");
    sky.addColorStop(0.55, "#07364a");
    sky.addColorStop(1, "#0a4257");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // moon
    const moon = ctx.createRadialGradient(W - 76, 66, 6, W - 76, 66, 110);
    moon.addColorStop(0, "rgba(224, 242, 254, 0.5)");
    moon.addColorStop(1, "rgba(224, 242, 254, 0)");
    ctx.fillStyle = moon;
    ctx.fillRect(W - 190, 0, 190, 190);
    ctx.fillStyle = "#e0f2fe";
    ctx.beginPath();
    ctx.arc(W - 76, 66, 24, 0, Math.PI * 2);
    ctx.fill();

    // slope contours
    ctx.strokeStyle = "rgba(125, 211, 252, 0.08)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(0, 170 + k * 120);
      ctx.quadraticCurveTo(W / 2, 130 + k * 120, W, 170 + k * 120);
      ctx.stroke();
    }

    // pines
    const trees: Array<[number, number, number]> = [
      [28, 196, 0.85],
      [60, 318, 1.05],
      [18, 430, 1.2],
      [W - 32, 176, 0.8],
      [W - 64, 300, 1.0],
      [W - 22, 418, 1.25],
    ];
    for (const [tx, ty, ts] of trees) {
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(ts, ts);
      ctx.fillStyle = "#0a3543";
      ctx.beginPath();
      ctx.moveTo(0, -46);
      ctx.lineTo(17, 0);
      ctx.lineTo(-17, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(24, 22);
      ctx.lineTo(-24, 22);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(224, 242, 254, 0.5)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-9, -14);
      ctx.lineTo(9, -14);
      ctx.moveTo(-14, 6);
      ctx.lineTo(14, 6);
      ctx.stroke();
      ctx.restore();
    }

    // packed snow floor
    const floor = ctx.createLinearGradient(0, GROUND - 22, 0, H);
    floor.addColorStop(0, "#cfe7f5");
    floor.addColorStop(1, "#8fbcd6");
    ctx.fillStyle = floor;
    ctx.fillRect(0, GROUND - 22, W, H - GROUND + 22);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND - 22);
    ctx.lineTo(W, GROUND - 22);
    ctx.stroke();

    ctx.save();
    if (g.shake > 0.2) {
      ctx.translate(Math.sin(time / 20) * g.shake, Math.cos(time / 16) * g.shake);
    }

    // enemies
    for (const e of g.enemies) drawEnemy(ctx, e, time);

    // snowballs
    for (const b of g.balls) {
      if (!b.foe && b.trail.length > 1) {
        for (let k = 0; k < b.trail.length; k++) {
          const kk = k / b.trail.length;
          ctx.globalAlpha = kk * 0.5;
          ctx.fillStyle = "#e0f2fe";
          ctx.beginPath();
          ctx.arc(b.trail[k].x, b.trail[k].y, 1.4 + kk * (b.r - 2), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.shadowColor = b.foe ? "#38bdf8" : "#ffffff";
      ctx.shadowBlur = 12;
      ctx.fillStyle = b.foe ? (b.heavy ? "#f0abfc" : "#bae6fd") : "#f8fafc";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (b.foe) {
        ctx.strokeStyle = "rgba(56, 189, 248, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // coins
    for (const c of g.coins) {
      const spin = Math.abs(Math.sin(c.t * 9));
      ctx.shadowColor = "#fde68a";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 6 * Math.max(0.25, spin), 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // particles
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // barricade
    if (g.cover > 0) {
      ctx.save();
      ctx.shadowColor = "#67e8f9";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#eaf6fd";
      ctx.beginPath();
      ctx.roundRect(BARRICADE.x, BARRICADE.y, BARRICADE.w, BARRICADE.h, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#7dd3fc";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "rgba(14, 165, 233, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(BARRICADE.x, BARRICADE.y + 13);
      ctx.lineTo(BARRICADE.x + BARRICADE.w, BARRICADE.y + 13);
      ctx.moveTo(BARRICADE.x + 44, BARRICADE.y);
      ctx.lineTo(BARRICADE.x + 44, BARRICADE.y + 13);
      ctx.moveTo(BARRICADE.x + 88, BARRICADE.y + 13);
      ctx.lineTo(BARRICADE.x + 88, BARRICADE.y + BARRICADE.h);
      ctx.moveTo(BARRICADE.x + 132, BARRICADE.y);
      ctx.lineTo(BARRICADE.x + 132, BARRICADE.y + 13);
      // cracks
      ctx.strokeStyle = "rgba(3, 105, 161, 0.65)";
      ctx.lineWidth = 2;
      const cracks = COVER_MAX - g.cover;
      if (cracks >= 1) {
        ctx.beginPath();
        ctx.moveTo(BARRICADE.x + 56, BARRICADE.y);
        ctx.lineTo(BARRICADE.x + 66, BARRICADE.y + 14);
        ctx.lineTo(BARRICADE.x + 58, BARRICADE.y + BARRICADE.h);
        ctx.stroke();
      }
      if (cracks >= 2) {
        ctx.beginPath();
        ctx.moveTo(BARRICADE.x + 122, BARRICADE.y + BARRICADE.h);
        ctx.lineTo(BARRICADE.x + 134, BARRICADE.y + 12);
        ctx.lineTo(BARRICADE.x + 128, BARRICADE.y);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // crumbled stubs
      ctx.fillStyle = "#b8d8ea";
      ctx.beginPath();
      ctx.roundRect(BARRICADE.x, BARRICADE.y + BARRICADE.h - 10, 34, 10, 4);
      ctx.roundRect(BARRICADE.x + BARRICADE.w - 34, BARRICADE.y + BARRICADE.h - 10, 34, 10, 4);
      ctx.fill();
    }

    // fort
    ctx.save();
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 16;
    for (let row = 0; row < 2; row++) {
      const by = 462 + row * 26;
      const offset = row % 2 === 0 ? 0 : 21;
      for (let bx = 160 - offset; bx < 320; bx += 42) {
        const w = Math.min(40, 320 - bx);
        if (w <= 4) continue;
        ctx.fillStyle = row === 0 ? "#eaf6fd" : "#d7ebf7";
        ctx.beginPath();
        ctx.roundRect(bx + 2, by, w - 4, 24, 5);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(160, 462, 160, 52);
    // fort damage cracks
    if (g.hp <= HP_START - 1) {
      ctx.strokeStyle = "rgba(3, 105, 161, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(210, 462);
      ctx.lineTo(222, 480);
      ctx.lineTo(214, 496);
      ctx.stroke();
    }
    if (g.hp <= HP_START - 3) {
      ctx.beginPath();
      ctx.moveTo(282, 470);
      ctx.lineTo(272, 490);
      ctx.lineTo(284, 508);
      ctx.stroke();
    }

    // pack meter on the fort
    const frac = 1 - Math.max(0, g.packT) / Math.max(0.01, g.packTime);
    ctx.fillStyle = "rgba(2, 44, 64, 0.8)";
    ctx.beginPath();
    ctx.roundRect(FORT_X - 55, 468, 110, 8, 4);
    ctx.fill();
    ctx.shadowColor = frac >= 1 ? "#34d399" : "#38bdf8";
    ctx.shadowBlur = frac >= 1 ? 10 : 0;
    ctx.fillStyle = frac >= 1 ? "#34d399" : "#38bdf8";
    ctx.beginPath();
    ctx.roundRect(FORT_X - 54, 469, 108 * frac, 6, 3);
    ctx.fill();
    ctx.shadowBlur = 0;

    const dragging = dragRef.current.active;
    if (dragging) {
      const d = dragRef.current;
      const dx = d.x - d.x0;
      const dy = d.y - d.y0;
      const len = Math.hypot(dx, dy);
      const ready = g.packT <= 0 && len >= 18;
      const power = Math.min(1, len / 170);
      if (len >= 18) {
        const ang = Math.atan2(dy, dx);
        // aim line
        ctx.strokeStyle = "rgba(224, 242, 254, 0.7)";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 7]);
        ctx.beginPath();
        ctx.moveTo(ORIGIN.x, ORIGIN.y);
        ctx.lineTo(ORIGIN.x + Math.cos(ang) * (30 + power * 46), ORIGIN.y + Math.sin(ang) * (30 + power * 46));
        ctx.stroke();
        ctx.setLineDash([]);
        // trajectory dots
        if (ready) {
          const speed = 340 + 420 * power;
          let px = ORIGIN.x;
          let py = ORIGIN.y;
          const vx = Math.cos(ang) * speed;
          let vy = Math.sin(ang) * speed;
          for (let s = 0; s < 130; s++) {
            vy += G / 60;
            px += vx / 60;
            py += vy / 60;
            if (s % 6 === 0) {
              const k = s / 130;
              ctx.globalAlpha = 0.85 - k * 0.7;
              ctx.fillStyle = "#e0f2fe";
              ctx.beginPath();
              ctx.arc(px, py, Math.max(1.6, 4 - k * 2.4), 0, Math.PI * 2);
              ctx.fill();
            }
            if (py >= GROUND - 6 || px < 8 || px > W - 8) break;
          }
          ctx.globalAlpha = 1;
        }
        // power arc
        ctx.strokeStyle = ready ? "rgba(45, 212, 191, 0.9)" : "rgba(148, 163, 184, 0.5)";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(ORIGIN.x, ORIGIN.y, 26, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 1.5);
        ctx.stroke();
      }
      // gloved hands + packed ball peeking over the wall
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(ORIGIN.x - 13, ORIGIN.y + 5, 5, 0, Math.PI * 2);
      ctx.arc(ORIGIN.x + 13, ORIGIN.y + 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(ORIGIN.x, ORIGIN.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (g.packT <= 0) {
      // loaded and waiting
      const bob = Math.sin(time / 300) * 3;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(ORIGIN.x, ORIGIN.y - 4 + bob, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // floaters
    ctx.font = "bold 14px ui-monospace, monospace";
    ctx.textAlign = "center";
    for (const f of g.floaters) {
      ctx.globalAlpha = Math.min(1, f.life / 0.4);
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";

    ctx.restore();

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.globalAlpha = Math.min(1, g.bannerT);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 30px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(g.banner, W / 2, 60);
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
    }

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(225, 29, 72, ${g.flash * 0.42})`;
      ctx.fillRect(0, 0, W, H);
    }

    // falling snow (over everything, deterministic)
    ctx.fillStyle = "rgba(240, 249, 255, 0.75)";
    for (let i = 0; i < 30; i++) {
      const sx = (((i * 61 + Math.sin(time / 700 + i) * 14 + time * 0.006 * (1 + (i % 4))) % W) + W) % W;
      const sy = (((i * 89 + time * (0.035 + 0.02 * (i % 5))) % H) + H) % H;
      ctx.globalAlpha = 0.35 + (i % 4) * 0.12;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.2 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }, [draw]);

  /* ---------------- loop ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame();
    dragRef.current.active = false;
    setScore(0);
    setWave(1);
    setHp(HP_START);
    setWallet(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      const result = stepGame(g, dt);

      if (g.dirty) {
        g.dirty = false;
        setScore(g.score);
        setWave(g.wave);
        setHp(g.hp);
        setWallet(g.wallet);
      }

      if (result === "over") {
        setScore(g.score);
        setWave(g.wave);
        setHp(0);
        if (g.score > 0) setNewBest(submit(g.score));
        else setNewBest(false);
        setStatus("over");
        draw(t);
        return;
      }

      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, submit, draw]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (status === "idle" || status === "over") start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start]);

  const pointAt = (clientX: number, clientY: number, el: HTMLCanvasElement) => {
    const rect = el.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  const release = (el: HTMLCanvasElement) => {
    const g = gameRef.current;
    const d = dragRef.current;
    if (!g || !d.active) return;
    const p0 = { x: d.x0, y: d.y0 };
    const p1 = { x: d.x, y: d.y };
    d.active = false;
    if (status !== "playing" || g.packT > 0) return;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    if (len < 18) return;
    const power = Math.min(1, len / 170);
    const ang = Math.atan2(dy, dx);
    const speed = 340 + 420 * power;
    const n = g.pellets;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.14;
      g.balls.push({
        x: ORIGIN.x,
        y: ORIGIN.y,
        vx: Math.cos(ang + off) * speed,
        vy: Math.sin(ang + off) * speed,
        r: 8,
        foe: false,
        heavy: false,
        trail: [],
      });
    }
    g.packT = g.packTime;
    burst(g.parts, ORIGIN.x, ORIGIN.y, "#e0f2fe", 6);
    void el;
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-cyan-300">
          Wave <b className="ml-1 text-sm text-ink">{wave}</b>
        </span>
        <span className="text-rose-400">
          Fort{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${hp} fort health`}>
            {"❤️".repeat(Math.max(0, hp)) || "—"}
          </b>
        </span>
        <span className="text-amber-300">
          🪙 <b className="ml-1 text-sm text-ink">{wallet}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(103,232,249,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none cursor-crosshair select-none"
          aria-label="Snowball Siege playfield"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = pointAt(e.clientX, e.clientY, e.currentTarget);
            dragRef.current = { active: true, x0: p.x, y0: p.y, x: p.x, y: p.y };
          }}
          onPointerMove={(e) => {
            const d = dragRef.current;
            if (!d.active) return;
            const p = pointAt(e.clientX, e.clientY, e.currentTarget);
            d.x = p.x;
            d.y = p.y;
          }}
          onPointerUp={(e) => {
            release(e.currentTarget);
          }}
          onPointerCancel={() => {
            dragRef.current.active = false;
          }}
        />

        {status === "playing" && (
          <p className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            Drag to aim · release to lob
          </p>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">SNOWBALL SIEGE</p>
            <p className="mt-2 text-sm text-muted">
              Snowmen and elf-bots waddle down the hill in endless waves and volley back at your
              fort. Arc your throws with the trajectory dots, duck behind the barricade — it only
              shrugs off three hits — and let dropped coins auto-buy the next wave&apos;s perks.
            </p>
            <PrimaryButton onClick={start} tone="from-teal-400 via-cyan-500 to-sky-600">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Drag toward the foe, release to throw · fort has 5 HP · coins spend themselves
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">FORT DOWN</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Fell on wave {wave} · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-teal-400 via-cyan-500 to-sky-600">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Watch for the dashed lob line — that&apos;s where their snowball lands · coins auto-buy
        perks between waves
      </p>
    </div>
  );
}
