"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 540;
const TAU = Math.PI * 2;
const BR = 7; // ball radius
const TR = 11; // target radius
const MAX_BOUNCES = 3;
const LEVELS = 25;
const SHOT_LIFE = 9;
const MIN_AIM = 16;
const POWER_DIST = 170;

type Status = "idle" | "playing" | "over";
type Pt = { x: number; y: number };

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Portal {
  x: number;
  y: number;
  r: number;
  pair: number;
}
interface Target {
  x: number;
  y: number;
  alive: boolean;
}
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  bounces: number;
  life: number;
  trail: Pt[];
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
interface Glow {
  x: number;
  y: number;
  t: number;
  color: string;
}

interface Game {
  level: number;
  total: number; // shots fired across the run
  shots: number; // shots on the current level
  launcher: Pt;
  aim: Pt;
  aiming: boolean;
  targets: Target[];
  blocks: Rect[];
  portals: Portal[];
  ball: Ball | null;
  particles: Particle[];
  glows: Glow[];
  clearT: number;
  banner: string;
  bannerT: number;
  shake: number;
  portalCd: number;
  over: boolean;
}

/* ------------------------------ helpers ------------------------------ */

/** Deterministic level layout — no Math.random, so levels are always identical. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
}

function rectCenter(r: Rect): Pt {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function rectsOverlap(a: Rect, b: Rect, pad: number): boolean {
  return (
    a.x - pad < b.x + b.w &&
    a.x + a.w + pad > b.x &&
    a.y - pad < b.y + b.h &&
    a.y + a.h + pad > b.y
  );
}

function ptInRect(p: Pt, r: Rect, pad: number): boolean {
  return (
    p.x > r.x - pad &&
    p.x < r.x + r.w + pad &&
    p.y > r.y - pad &&
    p.y < r.y + r.h + pad
  );
}

function dist2(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function burst(g: Game, x: number, y: number, color: string, n: number, power: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = power * (0.35 + Math.random() * 0.65);
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.45 + Math.random() * 0.4,
      max: 0.85,
      color,
      size: 1.6 + Math.random() * 2.6,
    });
  }
}

/* ------------------------------ levels ------------------------------ */

function buildLevel(g: Game, level: number): void {
  const rnd = rng(level * 7919 + 104729);
  g.level = level;
  g.shots = 0;
  g.ball = null;
  g.aiming = false;
  g.clearT = 0;
  g.portalCd = 0;
  g.banner = `LEVEL ${level}`;
  g.bannerT = 1.3;
  g.launcher = { x: 90 + rnd() * (W - 180), y: H - 44 };
  g.aim = { x: W / 2, y: H / 2 };
  g.targets = [];
  g.blocks = [];
  g.portals = [];

  const nBlocks = Math.min(1 + Math.floor(level / 4), 4);
  const nPortals = level < 4 ? 0 : level < 13 ? 1 : 2;
  const nTargets = Math.min(3 + Math.floor((level - 1) / 4), 6);

  for (let i = 0; i < nBlocks; i++) {
    for (let tries = 0; tries < 90; tries++) {
      const vertical = rnd() < 0.4;
      const w = vertical ? 20 : 66 + rnd() * 74;
      const h = vertical ? 66 + rnd() * 74 : 20;
      const rect: Rect = {
        x: 30 + rnd() * (W - 60 - w),
        y: 40 + rnd() * (H - 210 - h),
        w,
        h,
      };
      if (dist2(rectCenter(rect), g.launcher) < 120 * 120) continue;
      if (g.blocks.some((b) => rectsOverlap(rect, b, 34))) continue;
      g.blocks.push(rect);
      break;
    }
  }

  for (let i = 0; i < nPortals; i++) {
    for (let tries = 0; tries < 90; tries++) {
      const p: Pt = { x: 50 + rnd() * (W - 100), y: 52 + rnd() * (H - 250) };
      if (dist2(p, g.launcher) < 110 * 110) continue;
      if (g.blocks.some((b) => ptInRect(p, b, 30))) continue;
      if (g.portals.some((q) => dist2(p, q) < 130 * 130)) continue;
      const idx = g.portals.length;
      g.portals.push({ x: p.x, y: p.y, r: 15, pair: idx + 1 });
      g.portals.push({ x: p.x, y: p.y, r: 15, pair: idx }); // real position below
      // place the partner somewhere else
      for (let t2 = 0; t2 < 90; t2++) {
        const q: Pt = { x: 50 + rnd() * (W - 100), y: 52 + rnd() * (H - 250) };
        if (dist2(q, g.launcher) < 110 * 110) continue;
        if (g.blocks.some((b) => ptInRect(q, b, 30))) continue;
        if (dist2(p, q) < 130 * 130) continue;
        g.portals[idx + 1].x = q.x;
        g.portals[idx + 1].y = q.y;
        break;
      }
      break;
    }
  }

  for (let i = 0; i < nTargets; i++) {
    for (let tries = 0; tries < 120; tries++) {
      const p: Pt = { x: 28 + rnd() * (W - 56), y: 28 + rnd() * (H - 190) };
      if (dist2(p, g.launcher) < 115 * 115) continue;
      if (g.blocks.some((b) => ptInRect(p, b, TR + 10))) continue;
      if (g.portals.some((q) => dist2(p, q) < (q.r + TR + 14) * (q.r + TR + 14))) continue;
      if (g.targets.some((t) => dist2(p, t) < 62 * 62)) continue;
      g.targets.push({ x: p.x, y: p.y, alive: true });
      break;
    }
  }
}

function createRun(): Game {
  const g: Game = {
    level: 1,
    total: 0,
    shots: 0,
    launcher: { x: W / 2, y: H - 44 },
    aim: { x: W / 2, y: H / 2 },
    aiming: false,
    targets: [],
    blocks: [],
    portals: [],
    ball: null,
    particles: [],
    glows: [],
    clearT: 0,
    banner: "",
    bannerT: 0,
    shake: 0,
    portalCd: 0,
    over: false,
  };
  buildLevel(g, 1);
  return g;
}

/* ------------------------------ physics ------------------------------ */

function fizzle(g: Game): void {
  if (!g.ball) return;
  burst(g, g.ball.x, g.ball.y, "#67e8f9", 12, 150);
  g.shake = Math.max(g.shake, 4);
  g.ball = null;
}

function stepBall(g: Game, dt: number): void {
  const b = g.ball;
  if (!b) return;

  g.portalCd = Math.max(0, g.portalCd - dt);
  b.life -= dt;
  if (b.life <= 0) {
    fizzle(g);
    return;
  }

  const travel = b.speed * dt;
  const steps = Math.max(1, Math.ceil(travel / 3));
  const s = travel / steps;

  for (let i = 0; i < steps; i++) {
    if (!g.ball) return;
    b.x += b.vx * s;
    b.y += b.vy * s;

    // outer walls — three bounces allowed, the next touch fizzles the shot
    let hit: Pt | null = null;
    if (b.x < BR) {
      b.x = BR;
      b.vx = Math.abs(b.vx);
      hit = { x: 0, y: b.y };
    } else if (b.x > W - BR) {
      b.x = W - BR;
      b.vx = -Math.abs(b.vx);
      hit = { x: W, y: b.y };
    }
    if (b.y < BR) {
      b.y = BR;
      b.vy = Math.abs(b.vy);
      hit = { x: b.x, y: 0 };
    } else if (b.y > H - BR) {
      b.y = H - BR;
      b.vy = -Math.abs(b.vy);
      hit = { x: b.x, y: H };
    }
    if (hit) {
      b.bounces += 1;
      g.glows.push({ x: hit.x, y: hit.y, t: 1, color: "#22d3ee" });
      burst(g, hit.x, hit.y, "#22d3ee", 5, 90);
      if (b.bounces > MAX_BOUNCES) {
        fizzle(g);
        return;
      }
      continue;
    }

    // obstacle blocks
    for (const r of g.blocks) {
      const nx = Math.max(r.x, Math.min(b.x, r.x + r.w));
      const ny = Math.max(r.y, Math.min(b.y, r.y + r.h));
      const dx = b.x - nx;
      const dy = b.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= BR * BR) continue;
      let ux: number;
      let uy: number;
      if (d2 < 1e-4) {
        const left = b.x - r.x;
        const right = r.x + r.w - b.x;
        const top = b.y - r.y;
        const bottom = r.y + r.h - b.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) {
          b.x = r.x - BR;
          ux = -1;
          uy = 0;
        } else if (m === right) {
          b.x = r.x + r.w + BR;
          ux = 1;
          uy = 0;
        } else if (m === top) {
          b.y = r.y - BR;
          ux = 0;
          uy = -1;
        } else {
          b.y = r.y + r.h + BR;
          ux = 0;
          uy = 1;
        }
      } else {
        const n = Math.sqrt(d2);
        ux = dx / n;
        uy = dy / n;
        b.x = nx + ux * BR;
        b.y = ny + uy * BR;
      }
      const dot = b.vx * ux + b.vy * uy;
      if (dot < 0) {
        b.vx -= 2 * dot * ux;
        b.vy -= 2 * dot * uy;
      }
      g.glows.push({ x: nx, y: ny, t: 0.8, color: "#a78bfa" });
      burst(g, nx, ny, "#a78bfa", 4, 80);
      break;
    }

    // portals teleport the shot to its partner
    if (g.portalCd <= 0) {
      for (let pi = 0; pi < g.portals.length; pi++) {
        const p = g.portals[pi];
        const rr = p.r - 3;
        if (dist2(b, p) < rr * rr) {
          const q = g.portals[p.pair];
          burst(g, p.x, p.y, "#c084fc", 10, 130);
          b.x = q.x + (b.vx / b.speed) * (q.r + BR + 4);
          b.y = q.y + (b.vy / b.speed) * (q.r + BR + 4);
          burst(g, q.x, q.y, "#c084fc", 10, 130);
          g.portalCd = 0.35;
          break;
        }
      }
    }

    // targets
    for (const t of g.targets) {
      if (!t.alive) continue;
      const rr = TR + BR;
      if (dist2(b, t) < rr * rr) {
        t.alive = false;
        burst(g, t.x, t.y, "#f472b6", 24, 190);
        g.glows.push({ x: t.x, y: t.y, t: 1, color: "#f472b6" });
        g.shake = Math.max(g.shake, 3);
        g.ball = null;
        if (g.targets.every((tt) => !tt.alive)) {
          g.clearT = 1.25;
          g.banner = `LEVEL ${g.level} CLEAR`;
          g.bannerT = 1.25;
        }
        return;
      }
    }
  }

  if (!g.ball) return;
  b.trail.push({ x: b.x, y: b.y });
  if (b.trail.length > 16) b.trail.shift();
}

/** Dotted preview of the current aim: walls, blocks, portals, first target. */
function previewPath(g: Game): Pt[] {
  const dx0 = g.aim.x - g.launcher.x;
  const dy0 = g.aim.y - g.launcher.y;
  const d = Math.hypot(dx0, dy0);
  if (d < MIN_AIM) return [];
  const pts: Pt[] = [{ x: g.launcher.x, y: g.launcher.y }];
  let x = g.launcher.x;
  let y = g.launcher.y;
  let vx = dx0 / d;
  let vy = dy0 / d;
  let bounces = 0;

  for (let i = 0; i < 560; i++) {
    x += vx * 4;
    y += vy * 4;

    let bounced = false;
    if (x < BR) {
      x = BR;
      vx = Math.abs(vx);
      bounced = true;
    } else if (x > W - BR) {
      x = W - BR;
      vx = -Math.abs(vx);
      bounced = true;
    }
    if (y < BR) {
      y = BR;
      vy = Math.abs(vy);
      bounced = true;
    } else if (y > H - BR) {
      y = H - BR;
      vy = -Math.abs(vy);
      bounced = true;
    }
    if (bounced) {
      bounces += 1;
      pts.push({ x, y });
      if (bounces > MAX_BOUNCES) {
        pts.push({ x, y });
        return pts;
      }
    }

    for (const r of g.blocks) {
      const nx = Math.max(r.x, Math.min(x, r.x + r.w));
      const ny = Math.max(r.y, Math.min(y, r.y + r.h));
      const dx = x - nx;
      const dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= BR * BR || d2 < 1e-4) continue;
      const n = Math.sqrt(d2);
      x = nx + (dx / n) * BR;
      y = ny + (dy / n) * BR;
      const dot = vx * (dx / n) + vy * (dy / n);
      if (dot < 0) {
        vx -= 2 * dot * (dx / n);
        vy -= 2 * dot * (dy / n);
      }
      pts.push({ x, y });
      break;
    }

    if (g.portalCd <= 0) {
      for (let pi = 0; pi < g.portals.length; pi++) {
        const p = g.portals[pi];
        const rr = p.r - 3;
        if (dist2({ x, y }, p) < rr * rr) {
          const q = g.portals[p.pair];
          x = q.x + vx * (q.r + BR + 4);
          y = q.y + vy * (q.r + BR + 4);
          pts.push({ x, y });
          break;
        }
      }
    }

    for (const t of g.targets) {
      if (!t.alive) continue;
      const rr = TR + BR;
      if (dist2({ x, y }, t) < rr * rr) {
        pts.push({ x, y });
        return pts;
      }
    }

    if (i % 2 === 0) pts.push({ x, y });
  }
  return pts;
}

function step(g: Game, dt: number): void {
  for (let i = g.glows.length - 1; i >= 0; i--) {
    g.glows[i].t -= dt * 1.9;
    if (g.glows[i].t <= 0) g.glows.splice(i, 1);
  }
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 220 * dt;
    if (p.life <= 0) g.particles.splice(i, 1);
  }
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);
  g.shake = Math.max(0, g.shake - dt * 22);

  if (g.clearT > 0) {
    g.clearT -= dt;
    if (g.clearT <= 0) {
      if (g.level >= LEVELS) {
        g.over = true;
      } else {
        buildLevel(g, g.level + 1);
      }
    }
    return;
  }

  stepBall(g, dt);
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
  bg.addColorStop(0, "#0a0a17");
  bg.addColorStop(1, "#131329");
  ctx.fillStyle = bg;
  ctx.fillRect(-12, -12, W + 24, H + 24);

  ctx.fillStyle = "rgba(139, 92, 246, 0.12)";
  for (let x = 24; x < W; x += 24) {
    for (let y = 24; y < H; y += 24) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, TAU);
      ctx.fill();
    }
  }

  if (g) {
    // room walls
    ctx.save();
    ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 12;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.restore();

    // bounce / impact glows
    for (const gl of g.glows) {
      const rad = 16 + (1 - Math.max(0, gl.t)) * 46;
      const grd = ctx.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, rad);
      grd.addColorStop(0, hexA(gl.color, gl.t * 0.8));
      grd.addColorStop(1, hexA(gl.color, 0));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(gl.x, gl.y, rad, 0, TAU);
      ctx.fill();
    }

    // obstacle blocks
    for (const r of g.blocks) {
      ctx.save();
      ctx.shadowColor = "#8b5cf6";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#171733";
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(167, 139, 250, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // portals (linked rings)
    for (const p of g.portals) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(time / 700);
      ctx.strokeStyle = "#c084fc";
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 7]);
      ctx.shadowColor = "#c084fc";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      const core = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r - 3);
      core.addColorStop(0, "rgba(232, 121, 249, 0.85)");
      core.addColorStop(1, "rgba(88, 28, 135, 0.05)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r - 3, 0, TAU);
      ctx.fill();
    }

    // glowing targets
    const pulse = 1 + Math.sin(time / 200) * 0.1;
    for (const t of g.targets) {
      if (!t.alive) continue;
      ctx.save();
      ctx.shadowColor = "#f472b6";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.arc(t.x, t.y, TR * pulse, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#0a0a17";
      ctx.beginPath();
      ctx.arc(t.x, t.y, TR * 0.44, 0, TAU);
      ctx.fill();
    }

    // aim preview
    const adx = g.aim.x - g.launcher.x;
    const ady = g.aim.y - g.launcher.y;
    const ad = Math.hypot(adx, ady);
    const aimAngle = ad > 1 ? Math.atan2(ady, adx) : -Math.PI / 2;
    const power = Math.min(1, Math.max(0.12, ad / POWER_DIST));

    if (g.aiming && !g.ball && g.clearT <= 0) {
      const pts = previewPath(g);
      if (pts.length > 1) {
        ctx.save();
        ctx.strokeStyle = "rgba(103, 232, 249, 0.6)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 9]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(
        g.launcher.x,
        g.launcher.y,
        20,
        -Math.PI / 2,
        -Math.PI / 2 + power * TAU,
      );
      ctx.stroke();
      ctx.restore();
    }

    // launcher turret
    ctx.save();
    ctx.translate(g.launcher.x, g.launcher.y);
    ctx.rotate(aimAngle);
    ctx.fillStyle = "#1b1b38";
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(6, -4, 18, 8, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#12122a";
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(g.launcher.x, g.launcher.y, 12, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // ball + trail
    if (g.ball) {
      const b = g.ball;
      for (let i = 0; i < b.trail.length; i++) {
        const p = b.trail[i];
        const a = (i + 1) / (b.trail.length + 1);
        ctx.fillStyle = hexA("#67e8f9", a * 0.4);
        ctx.beginPath();
        ctx.arc(p.x, p.y, BR * a * 0.9, 0, TAU);
        ctx.fill();
      }
      ctx.save();
      ctx.shadowColor = "#67e8f9";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(b.x, b.y, BR, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // particles
    for (const p of g.particles) {
      ctx.fillStyle = hexA(p.color, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }

    // level tag
    ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
    ctx.font = "bold 12px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`LEVEL ${g.level} / ${LEVELS}`, 14, 24);
    ctx.fillText(`${g.total} SHOTS`, 14, 42);

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 2.2);
      ctx.font = "800 32px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(244, 114, 182, 0.9)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 40);
      ctx.restore();
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function Ricochet() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [shots, setShots] = useState(0);
  const [level, setLevel] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("ricochet", "low");

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
    if (!gameRef.current) gameRef.current = createRun();
    draw(performance.now());
  }, [draw]);

  const start = useCallback(() => {
    gameRef.current = createRun();
    setShots(0);
    setLevel(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  // main loop
  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastTotal = -1;
    let lastLevel = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      if (g.total !== lastTotal) {
        lastTotal = g.total;
        setShots(g.total);
      }
      if (g.level !== lastLevel) {
        lastLevel = g.level;
        setLevel(g.level);
      }

      draw(t);
      if (g.over) {
        setNewBest(submit(g.total));
        setStatus("over");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit]);

  // static frame after mount / on the game-over screen
  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ------------------------------ input ------------------------------ */

  const toPt = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const fire = (pt: Pt) => {
    const g = gameRef.current;
    if (!g || g.ball || g.clearT > 0) return;
    const dx = pt.x - g.launcher.x;
    const dy = pt.y - g.launcher.y;
    const d = Math.hypot(dx, dy);
    if (d < MIN_AIM) return;
    const power = Math.min(1, Math.max(0.15, d / POWER_DIST));
    const speed = 300 + power * 300;
    g.ball = {
      x: g.launcher.x,
      y: g.launcher.y,
      vx: (dx / d) * speed,
      vy: (dy / d) * speed,
      speed,
      bounces: 0,
      life: SHOT_LIFE,
      trail: [],
    };
    g.total += 1;
    g.shots += 1;
    setShots(g.total);
  };

  /* ------------------------------ view ------------------------------ */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={shots} best={best ?? "—"}>
        <span>
          Level <b className="ml-1 text-sm text-ink">{level}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(192,132,252,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full cursor-crosshair touch-none"
          aria-label="Ricochet puzzle room"
          onPointerDown={(e) => {
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g || g.ball) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            g.aiming = true;
            g.aim = toPt(e);
          }}
          onPointerMove={(e) => {
            const g = gameRef.current;
            if (!g || status !== "playing") return;
            g.aim = toPt(e);
          }}
          onPointerUp={(e) => {
            const g = gameRef.current;
            if (!g || !g.aiming) return;
            g.aiming = false;
            fire(toPt(e));
          }}
          onPointerCancel={() => {
            const g = gameRef.current;
            if (g) g.aiming = false;
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">RICOCHET</p>
            <p className="mt-2 text-sm text-muted">
              Bank the shot off the walls — three bounces max, then it fizzles.
              Hit every glowing target to clear the room.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-violet-500 via-purple-500 to-fuchsia-500"
            >
              Start campaign
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Drag from the cannon to aim &amp; charge · release to fire · portals
              teleport the shot
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              CAMPAIGN CLEARED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ Fewest shots yet!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{shots}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Shots · Best {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-violet-500 via-purple-500 to-fuchsia-500"
            >
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        25 rooms · fewest total shots wins · blocks bounce free, walls burn a
        bounce
      </p>
    </div>
  );
}
