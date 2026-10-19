"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 540;
const TAU = Math.PI * 2;
const R = 16;
const DIAM = R * 2;
const COLS = 14;
const ROW_H = 28;
const X_OFF = (W - COLS * DIAM) / 2;
const TOP = 8;
const LAUNCHER_X = W / 2;
const LAUNCHER_Y = H - 30;
const DANGER_Y = H - 126;
const SHOT_SPEED = 620;
const SHOTS_PER_DROP = 6;
const LEVELS = 5;
const START_LIVES = 2;
const MAX_LIVES = 3;

const COLORS = ["#f472b6", "#60a5fa", "#34d399", "#fbbf24", "#a78bfa", "#fb7185"];

type Status = "idle" | "playing" | "over";

interface Bubble {
  color: number;
  seed: number;
}
interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  trail: { x: number; y: number }[];
}
interface Faller {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}
interface Floater {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
}

interface Game {
  rows: (Bubble | null)[][];
  offset: number;
  shotsSinceDrop: number;
  shot: Shot | null;
  fallers: Faller[];
  particles: Particle[];
  floaters: Floater[];
  current: number;
  next: number;
  lives: number;
  score: number;
  level: number;
  clearT: number;
  breachT: number;
  banner: string;
  bannerT: number;
  shake: number;
  aim: { x: number; y: number };
  aiming: boolean;
  won: boolean;
  over: boolean;
}

/* ------------------------------ helpers ------------------------------ */

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
}

function colCount(r: number): number {
  return r % 2 === 0 ? COLS : COLS - 1;
}

function slotX(c: number, r: number): number {
  return X_OFF + R + c * DIAM + (r % 2 === 1 ? R : 0);
}

function slotY(r: number, offset: number): number {
  return TOP + offset + r * ROW_H;
}

function activeColors(level: number): number {
  return Math.min(COLORS.length, 3 + Math.ceil(level / 2));
}

function randomColor(g: Game): number {
  return Math.floor(Math.random() * activeColors(g.level));
}

function burst(
  g: Game,
  x: number,
  y: number,
  color: string,
  n: number,
  power: number,
): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = power * (0.35 + Math.random() * 0.65);
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.4,
      max: 0.75,
      color,
      size: 1.5 + Math.random() * 2.2,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, color: string): void {
  g.floaters.push({ x, y, text, t: 1, color });
}

/* ------------------------------ board ------------------------------ */

function buildLevel(g: Game, level: number): void {
  g.level = level;
  g.rows = [];
  g.offset = 0;
  g.shotsSinceDrop = 0;
  g.shot = null;
  g.fallers = [];
  g.clearT = 0;
  g.breachT = 0;
  g.banner = `LEVEL ${level}`;
  g.bannerT = 1.3;

  const nRows = Math.min(5, 3 + level);
  const colors = activeColors(level);
  for (let r = 0; r < nRows; r++) {
    const row: (Bubble | null)[] = [];
    for (let c = 0; c < colCount(r); c++) {
      let pick = Math.floor(Math.random() * colors);
      let tries = 0;
      // avoid trivially pre-matched triples along the row
      while (
        tries < 10 &&
        c >= 2 &&
        row[c - 1]?.color === pick &&
        row[c - 2]?.color === pick
      ) {
        pick = Math.floor(Math.random() * colors);
        tries++;
      }
      row.push({ color: pick, seed: Math.random() * TAU });
    }
    g.rows.push(row);
  }
  g.current = randomColor(g);
  g.next = randomColor(g);
}

function createGame(): Game {
  const g: Game = {
    rows: [],
    offset: 0,
    shotsSinceDrop: 0,
    shot: null,
    fallers: [],
    particles: [],
    floaters: [],
    current: 0,
    next: 0,
    lives: START_LIVES,
    score: 0,
    level: 1,
    clearT: 0,
    breachT: 0,
    banner: "LEVEL 1",
    bannerT: 1.3,
    shake: 0,
    aim: { x: W / 2, y: H / 2 },
    aiming: false,
    won: false,
    over: false,
  };
  buildLevel(g, 1);
  return g;
}

function ensureRow(g: Game, r: number): void {
  while (g.rows.length <= r) {
    const row: (Bubble | null)[] = [];
    for (let c = 0; c < colCount(g.rows.length); c++) row.push(null);
    g.rows.push(row);
  }
}

/** Neighbours of (r, c) accounting for the staggered layout. */
function neighbours(r: number, c: number): [number, number][] {
  const out: [number, number][] = [
    [r, c - 1],
    [r, c + 1],
  ];
  if (r > 0) {
    if (r % 2 === 0) {
      out.push([r - 1, c - 1], [r - 1, c]);
    } else {
      out.push([r - 1, c], [r - 1, c + 1]);
    }
  }
  out.push([r + 1, r % 2 === 0 ? c - 1 : c], [r + 1, r % 2 === 0 ? c : c + 1]);
  return out;
}

function floodMatch(g: Game, r: number, c: number): [number, number][] {
  const start = g.rows[r]?.[c];
  if (!start) return [];
  const seen = new Set<string>([`${r},${c}`]);
  const group: [number, number][] = [[r, c]];
  const queue: [number, number][] = [[r, c]];
  while (queue.length) {
    const [cr, cc] = queue.pop() as [number, number];
    for (const [nr, nc] of neighbours(cr, cc)) {
      if (nr < 0 || nc < 0 || nr >= g.rows.length || nc >= colCount(nr)) continue;
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      const b = g.rows[nr][nc];
      if (!b || b.color !== start.color) continue;
      seen.add(key);
      group.push([nr, nc]);
      queue.push([nr, nc]);
    }
  }
  return group;
}

/** Any occupied cell not connected (directly or via chain) to the ceiling row. */
function floatingCells(g: Game): [number, number][] {
  const anchored = new Set<string>();
  const queue: [number, number][] = [];
  for (let c = 0; c < colCount(0); c++) {
    if (g.rows[0]?.[c]) {
      anchored.add(`0,${c}`);
      queue.push([0, c]);
    }
  }
  while (queue.length) {
    const [cr, cc] = queue.pop() as [number, number];
    for (const [nr, nc] of neighbours(cr, cc)) {
      if (nr < 0 || nc < 0 || nr >= g.rows.length || nc >= colCount(nr)) continue;
      const key = `${nr},${nc}`;
      if (anchored.has(key)) continue;
      if (!g.rows[nr][nc]) continue;
      anchored.add(key);
      queue.push([nr, nc]);
    }
  }
  const out: [number, number][] = [];
  for (let r = 0; r < g.rows.length; r++) {
    for (let c = 0; c < colCount(r); c++) {
      if (g.rows[r][c] && !anchored.has(`${r},${c}`)) out.push([r, c]);
    }
  }
  return out;
}

function isEmptyBoard(g: Game): boolean {
  for (const row of g.rows) for (const b of row) if (b) return false;
  return true;
}

/* ------------------------------ firing ------------------------------ */

function aimAngle(g: Game): number {
  const dx = g.aim.x - LAUNCHER_X;
  const dy = g.aim.y - LAUNCHER_Y;
  let a = Math.atan2(dy, dx);
  const min = -Math.PI + 0.22;
  const max = -0.22;
  if (a < min) a = min + (min - a) * 0.25;
  if (a > max) a = max - (a - max) * 0.25;
  return a;
}

function fire(g: Game): void {
  if (g.shot || g.clearT > 0 || g.over) return;
  const a = aimAngle(g);
  g.shot = {
    x: LAUNCHER_X,
    y: LAUNCHER_Y - 6,
    vx: Math.cos(a) * SHOT_SPEED,
    vy: Math.sin(a) * SHOT_SPEED,
    color: g.current,
    trail: [],
  };
  g.current = g.next;
  g.next = randomColor(g);
}

/** Attach the flying bubble to the grid at the closest free slot. */
function attach(g: Game): void {
  const s = g.shot;
  if (!s) return;
  g.shot = null;

  let bestR = 0;
  let bestC = 0;
  let bestD = Infinity;
  const rowGuess = Math.round((s.y - TOP - g.offset) / ROW_H);
  for (let r = Math.max(0, rowGuess - 1); r <= rowGuess + 1; r++) {
    ensureRow(g, r);
    const base = r % 2 === 1 ? R : 0;
    const cGuess = Math.round((s.x - X_OFF - R - base) / DIAM);
    for (let c = cGuess - 1; c <= cGuess + 1; c++) {
      if (c < 0 || c >= colCount(r) || g.rows[r][c]) continue;
      const dx = slotX(c, r) - s.x;
      const dy = slotY(r, g.offset) - s.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestR = r;
        bestC = c;
      }
    }
  }

  if (!isFinite(bestD)) {
    // completely wedged: drop it into row 0 as a last resort
    ensureRow(g, 0);
    for (let c = 0; c < colCount(0); c++) {
      if (!g.rows[0][c]) {
        bestR = 0;
        bestC = c;
        break;
      }
    }
  }

  ensureRow(g, bestR);
  g.rows[bestR][bestC] = { color: s.color, seed: Math.random() * TAU };
  const px = slotX(bestC, bestR);
  const py = slotY(bestR, g.offset);
  burst(g, px, py, COLORS[s.color], 6, 90);

  const group = floodMatch(g, bestR, bestC);
  let gained = 0;
  if (group.length >= 3) {
    for (const [r, c] of group) {
      const b = g.rows[r][c];
      if (!b) continue;
      g.rows[r][c] = null;
      burst(g, slotX(c, r), slotY(r, g.offset), COLORS[b.color], 10, 150);
    }
    gained += group.length * 10;

    const loose = floatingCells(g);
    if (loose.length > 0) {
      for (const [r, c] of loose) {
        const b = g.rows[r][c];
        if (!b) continue;
        g.rows[r][c] = null;
        g.fallers.push({
          x: slotX(c, r),
          y: slotY(r, g.offset),
          vx: (Math.random() - 0.5) * 120,
          vy: -60 - Math.random() * 50,
          color: b.color,
        });
      }
      gained += loose.length * 15;
      floater(g, px, py - 26, `DROP ×${loose.length}`, "#67e8f9");
    }
    g.score += gained;
    floater(g, px, py - 10, `+${gained}`, COLORS[s.color]);
    g.shake = Math.max(g.shake, 4);
  }

  if (isEmptyBoard(g)) {
    g.score += 100 * g.level;
    g.lives = Math.min(MAX_LIVES, g.lives + 1);
    if (g.level >= LEVELS) {
      g.won = true;
      g.over = true;
      g.banner = "STORM CLEARED!";
      g.bannerT = 2;
    } else {
      g.clearT = 1.7;
      g.banner = `LEVEL ${g.level} CLEAR!`;
      g.bannerT = 1.7;
    }
    return;
  }

  g.shotsSinceDrop += 1;
  if (g.shotsSinceDrop >= SHOTS_PER_DROP) {
    g.shotsSinceDrop = 0;
    g.offset += ROW_H / 2;
  }
}

/* ------------------------------ step ------------------------------ */

function stepShot(g: Game, dt: number): void {
  const s = g.shot;
  if (!s) return;
  const travel = SHOT_SPEED * dt;
  const steps = Math.max(1, Math.ceil(travel / 3));
  const move = travel / steps;

  for (let i = 0; i < steps; i++) {
    if (!g.shot) return;
    s.x += (s.vx / SHOT_SPEED) * move;
    s.y += (s.vy / SHOT_SPEED) * move;

    if (s.x < X_OFF + R) {
      s.x = X_OFF + R;
      s.vx = Math.abs(s.vx);
    } else if (s.x > W - X_OFF - R) {
      s.x = W - X_OFF - R;
      s.vx = -Math.abs(s.vx);
    }

    if (s.y <= TOP + g.offset + R) {
      attach(g);
      return;
    }

    for (let r = 0; r < g.rows.length; r++) {
      const row = g.rows[r];
      const y = slotY(r, g.offset);
      if (Math.abs(y - s.y) > DIAM) continue;
      for (let c = 0; c < colCount(r); c++) {
        if (!row[c]) continue;
        const x = slotX(c, r);
        const dx = x - s.x;
        const dy = y - s.y;
        if (dx * dx + dy * dy < (DIAM - 3) * (DIAM - 3)) {
          attach(g);
          return;
        }
      }
    }

    s.trail.push({ x: s.x, y: s.y });
    if (s.trail.length > 10) s.trail.shift();

    if (s.y > H + 20) {
      g.shot = null;
      return;
    }
  }
}

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 24);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);

  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 200 * dt;
    if (p.life <= 0) g.particles.splice(i, 1);
  }
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.t -= dt * 1.3;
    f.y -= 32 * dt;
    if (f.t <= 0) g.floaters.splice(i, 1);
  }
  for (let i = g.fallers.length - 1; i >= 0; i--) {
    const f = g.fallers[i];
    f.vy += 760 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.y > H + 40) g.fallers.splice(i, 1);
  }

  if (g.clearT > 0) {
    g.clearT -= dt;
    if (g.clearT <= 0) buildLevel(g, g.level + 1);
    return;
  }

  stepShot(g, dt);

  // ceiling breach
  g.breachT = Math.max(0, g.breachT - dt);
  if (g.breachT <= 0) {
    let breached = false;
    for (let r = g.rows.length - 1; r >= 0 && !breached; r--) {
      for (let c = 0; c < colCount(r); c++) {
        if (!g.rows[r][c]) continue;
        if (slotY(r, g.offset) + R >= DANGER_Y) {
          breached = true;
          break;
        }
      }
    }
    if (breached) {
      g.lives -= 1;
      g.shake = Math.max(g.shake, 14);
      g.banner = "BREACH!";
      g.bannerT = 1.2;
      g.breachT = 1.4;
      for (let r = g.rows.length - 1; r >= 0; r--) {
        for (let c = 0; c < colCount(r); c++) {
          const b = g.rows[r][c];
          if (!b) continue;
          if (slotY(r, g.offset) + R >= DANGER_Y) {
            g.rows[r][c] = null;
            burst(g, slotX(c, r), slotY(r, g.offset), COLORS[b.color], 8, 130);
          }
        }
      }
      // anything orphaned by the loss sinks too
      for (const [r, c] of floatingCells(g)) {
        const b = g.rows[r][c];
        if (!b) continue;
        g.rows[r][c] = null;
        g.fallers.push({
          x: slotX(c, r),
          y: slotY(r, g.offset),
          vx: (Math.random() - 0.5) * 90,
          vy: -30,
          color: b.color,
        });
      }
      if (g.lives <= 0) {
        g.lives = 0;
        g.over = true;
      }
    }
  }
}

/** Dotted preview of the shot including one wall bounce. */
function previewPath(g: Game): { x: number; y: number }[] {
  const a = aimAngle(g);
  let x = LAUNCHER_X;
  let y = LAUNCHER_Y - 6;
  let vx = Math.cos(a);
  const vy = Math.sin(a);
  const pts: { x: number; y: number }[] = [{ x, y }];

  for (let i = 0; i < 620; i++) {
    x += vx * 4;
    y += vy * 4;
    if (x < X_OFF + R) {
      x = X_OFF + R;
      vx = Math.abs(vx);
      pts.push({ x, y });
    } else if (x > W - X_OFF - R) {
      x = W - X_OFF - R;
      vx = -Math.abs(vx);
      pts.push({ x, y });
    }
    if (y <= TOP + g.offset + R) {
      pts.push({ x, y });
      return pts;
    }
    for (let r = 0; r < g.rows.length; r++) {
      const ry = slotY(r, g.offset);
      if (Math.abs(ry - y) > DIAM) continue;
      for (let c = 0; c < colCount(r); c++) {
        if (!g.rows[r][c]) continue;
        const dx = slotX(c, r) - x;
        const dy = ry - y;
        if (dx * dx + dy * dy < (DIAM - 3) * (DIAM - 3)) {
          pts.push({ x, y });
          return pts;
        }
      }
    }
    if (i % 3 === 0) pts.push({ x, y });
  }
  return pts;
}

/* ------------------------------ render ------------------------------ */

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#07101e");
  bg.addColorStop(1, "#0d1b30");
  ctx.fillStyle = bg;
  ctx.fillRect(-12, -12, W + 24, H + 24);

  // caustic dots
  ctx.fillStyle = "rgba(103, 232, 249, 0.07)";
  for (let x = 22; x < W; x += 22) {
    for (let y = 22; y < H; y += 22) {
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, TAU);
      ctx.fill();
    }
  }

  if (g) {
    // danger line
    ctx.save();
    ctx.strokeStyle = "rgba(251, 113, 133, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, DANGER_Y);
    ctx.lineTo(W, DANGER_Y);
    ctx.stroke();
    ctx.restore();
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(251, 113, 133, 0.6)";
    ctx.fillText("DANGER LINE", W - 8, DANGER_Y - 5);

    // bubbles
    for (let r = 0; r < g.rows.length; r++) {
      for (let c = 0; c < colCount(r); c++) {
        const b = g.rows[r][c];
        if (!b) continue;
        const x = slotX(c, r);
        const y = slotY(r, g.offset);
        const color = COLORS[b.color];
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath();
        ctx.arc(x, y, R, Math.PI * 0.75, Math.PI * 1.35);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "rgba(0,0,0,0.22)";
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.ellipse(x - R * 0.32, y - R * 0.34, R * 0.2, R * 0.12, -0.6, 0, TAU);
        ctx.fill();
      }
    }

    // falling bubbles
    for (const f of g.fallers) {
      const color = COLORS[f.color];
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, R, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // aim preview + launcher
    const ready = !g.shot && g.clearT <= 0 && !g.over;
    if (ready && g.aiming) {
      const pts = previewPath(g);
      ctx.fillStyle = "rgba(226, 232, 240, 0.4)";
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, TAU);
        ctx.fill();
      }
    }

    // flying bubble
    if (g.shot) {
      const s = g.shot;
      for (let i = 0; i < s.trail.length; i++) {
        const p = s.trail[i];
        ctx.fillStyle = hexA(COLORS[s.color], ((i + 1) / (s.trail.length + 2)) * 0.35);
        ctx.beginPath();
        ctx.arc(p.x, p.y, R * 0.7, 0, TAU);
        ctx.fill();
      }
      ctx.save();
      ctx.shadowColor = COLORS[s.color];
      ctx.shadowBlur = 14;
      ctx.fillStyle = COLORS[s.color];
      ctx.beginPath();
      ctx.arc(s.x, s.y, R, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // launcher base
    ctx.fillStyle = "#101c30";
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(LAUNCHER_X - 26, LAUNCHER_Y + 2, 52, 16, 6);
    ctx.fill();
    ctx.stroke();
    const ang = aimAngle(g);
    ctx.save();
    ctx.translate(LAUNCHER_X, LAUNCHER_Y);
    ctx.rotate(ang);
    ctx.fillStyle = "#16233c";
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(4, -5, 20, 10, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.shadowColor = COLORS[g.current];
    ctx.shadowBlur = 12;
    ctx.fillStyle = COLORS[g.current];
    ctx.beginPath();
    ctx.arc(LAUNCHER_X, LAUNCHER_Y, 12 * (1 + Math.sin(time / 240) * 0.07), 0, TAU);
    ctx.fill();
    ctx.restore();
    // next bubble
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.fillText("NEXT", LAUNCHER_X + 34, LAUNCHER_Y + 8);
    ctx.fillStyle = COLORS[g.next];
    ctx.beginPath();
    ctx.arc(LAUNCHER_X + 66, LAUNCHER_Y + 4, 8, 0, TAU);
    ctx.fill();

    // particles
    for (const p of g.particles) {
      ctx.fillStyle = hexA(p.color, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }

    // floaters
    ctx.textAlign = "center";
    for (const f of g.floaters) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.t));
      ctx.font = "800 14px ui-monospace, monospace";
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // hud text
    ctx.font = "700 14px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fb7185";
    ctx.fillText("♥".repeat(Math.max(0, g.lives)), 14, 22);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
    ctx.fillText(`LEVEL ${g.level}/${LEVELS}`, W - 14, 22);

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.5);
      ctx.font = "800 30px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(34, 211, 238, 0.9)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 70);
      ctx.restore();
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function BubbleStorm() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(START_LIVES);
  const [won, setWon] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("bubble-storm", "high");

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (canvas) render(canvas, gameRef.current, time);
  }, []);

  // canvas setup + idle board
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
    setLevel(1);
    setLives(START_LIVES);
    setWon(false);
    setNewBest(false);
    setStatus("playing");
  }, []);

  // main loop
  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastLevel = -1;
    let lastLives = -1;

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
      if (g.level !== lastLevel) {
        lastLevel = g.level;
        setLevel(g.level);
      }
      if (g.lives !== lastLives) {
        lastLives = g.lives;
        setLives(g.lives);
      }

      draw(t);
      if (g.over) {
        setScore(g.score);
        setWon(g.won);
        setNewBest(submit(g.score));
        setStatus("over");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit]);

  // static frame after mount / on the end screen
  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  const toPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  /* ------------------------------ view ------------------------------ */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Level <b className="ml-1 text-sm text-ink">{level}</b>
        </span>
        <span className="text-rose-400">
          Lives{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${lives} lives`}>
            {"♥".repeat(Math.max(0, lives))}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(34,211,238,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full cursor-crosshair touch-none"
          aria-label="Bubble storm playfield"
          onPointerMove={(e) => {
            const g = gameRef.current;
            if (g && status === "playing") g.aim = toPos(e);
          }}
          onPointerDown={(e) => {
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            g.aim = toPos(e);
            g.aiming = true;
          }}
          onPointerUp={(e) => {
            const g = gameRef.current;
            if (!g || status !== "playing" || !g.aiming) return;
            g.aiming = false;
            g.aim = toPos(e);
            fire(g);
          }}
          onPointerCancel={() => {
            const g = gameRef.current;
            if (g) g.aiming = false;
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">BUBBLE STORM</p>
            <p className="mt-2 text-sm text-muted">
              Bank shots off the walls into the ceiling grid. Match three of a
              kind to pop them — cut a cluster loose and watch it drop. Clear all
              five levels before the grid crosses the danger line.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-cyan-400 via-sky-500 to-blue-600"
            >
              Start storm
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Drag to aim (the dotted line previews bounces) · release to shoot ·
              two lives, one restored per level
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {won ? "STORM CLEARED" : "GRID OVERWHELMED"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Score · Best {best ?? "—"} · {won ? "all 5 levels" : `reached level ${level}`}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-cyan-400 via-sky-500 to-blue-600"
            >
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Match 3+ to pop · floating clusters rain down for bonus points · the
        ceiling drops every six shots
      </p>
    </div>
  );
}
