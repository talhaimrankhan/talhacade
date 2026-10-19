"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 520;
const H = 520;
const TAU = Math.PI * 2;
const SUB_SPEED = 150;
const TORP_SPEED = 118;
const TORP_LIFE = 5;
const TORP_MAX = 6;
const SENSOR = 112;
const PING_CD = 4;
const PING_RING = 0.9;
const MAX_HULL = 3;
const ZONE_R = 44;
const BLAST_R = 46;

type Status = "idle" | "playing" | "over";

const MERCHANT_VALUE = [200, 500, 850];
const MERCHANT_LEN = [34, 46, 60];

interface Ship {
  kind: "merchant" | "destroyer";
  size: number; // merchants: 0..2
  x: number;
  y: number;
  vx: number;
  baseY: number;
  wob: number;
  chargeT: number;
  seed: number;
}
interface Torpedo {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  trail: { x: number; y: number }[];
}
interface Charge {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}
interface Blast {
  x: number;
  y: number;
  t: number;
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
  sub: { x: number; y: number; angle: number; vx: number; vy: number };
  ships: Ship[];
  torpedoes: Torpedo[];
  charges: Charge[];
  blasts: Blast[];
  particles: Particle[];
  floaters: Floater[];
  zones: { x: number; y: number }[];
  aim: { x: number; y: number };
  input: { up: boolean; down: boolean; left: boolean; right: boolean };
  move: { active: boolean; ox: number; oy: number; x: number; y: number };
  hull: number;
  tons: number;
  ammo: number;
  wave: number;
  elapsed: number;
  spawnT: number;
  pingT: number;
  pingFade: number;
  pingCd: number;
  resupT: number;
  resupIdx: number;
  banner: string;
  bannerT: number;
  shake: number;
  hurt: number;
  over: boolean;
}

/* ------------------------------ helpers ------------------------------ */

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
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
      life: 0.4 + Math.random() * 0.45,
      max: 0.85,
      color,
      size: 1.5 + Math.random() * 2.4,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, color: string): void {
  g.floaters.push({ x, y, text, t: 1, color });
}

function shipRadius(s: Ship): number {
  return s.kind === "destroyer" ? 20 : MERCHANT_LEN[s.size] * 0.5;
}

/* ------------------------------ game setup ------------------------------ */

function createGame(): Game {
  return {
    sub: { x: W / 2, y: H / 2, angle: -Math.PI / 2, vx: 0, vy: 0 },
    ships: [],
    torpedoes: [],
    charges: [],
    blasts: [],
    particles: [],
    floaters: [],
    zones: [
      { x: 120 + Math.random() * 60, y: 120 + Math.random() * 60 },
      { x: W - 180 + Math.random() * 60, y: H - 180 + Math.random() * 60 },
    ],
    aim: { x: W / 2, y: H / 2 - 120 },
    input: { up: false, down: false, left: false, right: false },
    move: { active: false, ox: 0, oy: 0, x: 0, y: 0 },
    hull: MAX_HULL,
    tons: 0,
    ammo: TORP_MAX,
    wave: 1,
    elapsed: 0,
    spawnT: 1.4,
    pingT: 0,
    pingFade: 0,
    pingCd: 0,
    resupT: 0,
    resupIdx: -1,
    banner: "DEPLOYED",
    bannerT: 1.4,
    shake: 0,
    hurt: 0,
    over: false,
  };
}

function spawnShip(g: Game): void {
  const fromLeft = Math.random() < 0.5;
  const dir = fromLeft ? 1 : -1;
  const y = 70 + Math.random() * (H - 140);
  const destroyChance = Math.min(0.55, 0.16 + g.wave * 0.04);
  const speedScale = Math.min(1.7, 1 + (g.wave - 1) * 0.05);

  if (Math.random() < destroyChance) {
    g.ships.push({
      kind: "destroyer",
      size: 0,
      x: fromLeft ? -30 : W + 30,
      y,
      vx: dir * (82 + Math.random() * 18) * speedScale,
      baseY: y,
      wob: Math.random() * TAU,
      chargeT: 1.2 + Math.random(),
      seed: Math.random() * TAU,
    });
  } else {
    const size = Math.floor(Math.random() * 3);
    g.ships.push({
      kind: "merchant",
      size,
      x: fromLeft ? -40 : W + 40,
      y,
      vx: dir * (28 + Math.random() * 14) * speedScale,
      baseY: y,
      wob: Math.random() * TAU,
      chargeT: 0,
      seed: Math.random() * TAU,
    });
  }
}

/* ------------------------------ actions ------------------------------ */

function fireTorpedo(g: Game, tx: number, ty: number): void {
  if (g.over) return;
  if (g.ammo <= 0) {
    floater(g, g.sub.x, g.sub.y - 24, "DRY — RESURFACE", "#94a3b8");
    return;
  }
  let dx = tx - g.sub.x;
  let dy = ty - g.sub.y;
  const d = Math.hypot(dx, dy);
  if (d < 8) {
    dx = Math.cos(g.sub.angle);
    dy = Math.sin(g.sub.angle);
  } else {
    dx /= d;
    dy /= d;
  }
  g.ammo -= 1;
  const nose = 20;
  g.torpedoes.push({
    x: g.sub.x + dx * nose,
    y: g.sub.y + dy * nose,
    vx: dx * TORP_SPEED,
    vy: dy * TORP_SPEED,
    life: TORP_LIFE,
    trail: [],
  });
  burst(g, g.sub.x + dx * nose, g.sub.y + dy * nose, "#a5f3fc", 5, 70);
  g.shake = Math.max(g.shake, 2);
}

function ping(g: Game): void {
  if (g.pingCd > 0 || g.over) return;
  g.pingT = PING_RING;
  g.pingFade = 1.3;
  g.pingCd = PING_CD;
  burst(g, g.sub.x, g.sub.y, "#67e8f9", 10, 90);
}

function damageSub(g: Game, x: number, y: number): void {
  g.hull -= 1;
  g.hurt = 1;
  g.shake = Math.max(g.shake, 16);
  burst(g, x, y, "#f87171", 22, 190);
  floater(g, g.sub.x, g.sub.y - 26, "HIT! −1 HULL", "#f87171");
  if (g.hull <= 0) {
    g.hull = 0;
    g.over = true;
    burst(g, g.sub.x, g.sub.y, "#f87171", 40, 240);
  }
}

/* ------------------------------ step ------------------------------ */

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.hurt = Math.max(0, g.hurt - dt * 1.6);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);

  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-2 * dt);
    p.vy *= Math.exp(-2 * dt);
    if (p.life <= 0) g.particles.splice(i, 1);
  }
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.t -= dt * 1.25;
    f.y -= 30 * dt;
    if (f.t <= 0) g.floaters.splice(i, 1);
  }
  for (let i = g.blasts.length - 1; i >= 0; i--) {
    g.blasts[i].t -= dt * 2;
    if (g.blasts[i].t <= 0) g.blasts.splice(i, 1);
  }

  g.elapsed += dt;
  g.pingT = Math.max(0, g.pingT - dt);
  g.pingFade = Math.max(0, g.pingFade - dt);
  g.pingCd = Math.max(0, g.pingCd - dt);

  const wave = 1 + Math.floor(g.elapsed / 22);
  if (wave !== g.wave) {
    g.wave = wave;
    g.banner = `WAVE ${wave}`;
    g.bannerT = 1.2;
  }

  // -------- sub movement --------
  let ax = 0;
  let ay = 0;
  if (g.input.left) ax -= 1;
  if (g.input.right) ax += 1;
  if (g.input.up) ay -= 1;
  if (g.input.down) ay += 1;
  if (ax === 0 && ay === 0 && g.move.active) {
    const dx = g.move.x - g.move.ox;
    const dy = g.move.y - g.move.oy;
    const m = Math.hypot(dx, dy);
    if (m > 10) {
      ax = dx / Math.max(m, 48);
      ay = dy / Math.max(m, 48);
    }
  }
  const n = Math.hypot(ax, ay);
  if (n > 1) {
    ax /= n;
    ay /= n;
  }
  const targetVx = ax * SUB_SPEED;
  const targetVy = ay * SUB_SPEED;
  const ease = 1 - Math.exp(-8 * dt);
  g.sub.vx += (targetVx - g.sub.vx) * ease;
  g.sub.vy += (targetVy - g.sub.vy) * ease;
  g.sub.x += g.sub.vx * dt;
  g.sub.y += g.sub.vy * dt;
  g.sub.x = Math.max(18, Math.min(W - 18, g.sub.x));
  g.sub.y = Math.max(18, Math.min(H - 18, g.sub.y));
  if (Math.hypot(g.sub.vx, g.sub.vy) > 12) {
    g.sub.angle = Math.atan2(g.sub.vy, g.sub.vx);
    if (Math.random() < 0.25) {
      g.particles.push({
        x: g.sub.x - Math.cos(g.sub.angle) * 18,
        y: g.sub.y - Math.sin(g.sub.angle) * 18,
        vx: -g.sub.vx * 0.15,
        vy: -g.sub.vy * 0.15,
        life: 0.5,
        max: 0.5,
        color: "#67e8f9",
        size: 1.4,
      });
    }
  }

  // -------- resupply zones --------
  let inZone = -1;
  for (let i = 0; i < g.zones.length; i++) {
    const z = g.zones[i];
    if (Math.hypot(g.sub.x - z.x, g.sub.y - z.y) < ZONE_R) {
      inZone = i;
      break;
    }
  }
  if (inZone >= 0 && g.ammo < TORP_MAX) {
    if (g.resupIdx !== inZone) {
      g.resupIdx = inZone;
      g.resupT = 0;
    }
    g.resupT += dt;
    if (g.resupT >= 0.5) {
      g.resupT = 0;
      g.ammo += 1;
      const z = g.zones[inZone];
      floater(g, z.x, z.y - ZONE_R - 4, "+1 TORPEDO", "#6ee7b7");
      burst(g, g.sub.x, g.sub.y, "#6ee7b7", 8, 90);
    }
  } else {
    g.resupIdx = -1;
    g.resupT = 0;
  }

  // -------- traffic --------
  g.spawnT -= dt;
  if (g.spawnT <= 0) {
    spawnShip(g);
    g.spawnT = Math.max(1.0, 3.2 - (g.wave - 1) * 0.18) * (0.8 + Math.random() * 0.4);
  }

  for (let i = g.ships.length - 1; i >= 0; i--) {
    const s = g.ships[i];
    s.wob += dt;
    s.x += s.vx * dt;
    s.y = s.baseY + Math.sin(s.wob * 0.8 + s.seed) * 10;
    if (s.x < -70 || s.x > W + 70) {
      g.ships.splice(i, 1);
      continue;
    }

    if (s.kind === "destroyer") {
      const d = Math.hypot(s.x - g.sub.x, s.y - g.sub.y);
      s.chargeT -= dt;
      if (d < 215 && s.chargeT <= 0) {
        s.chargeT = Math.max(1.2, 2.6 - g.wave * 0.1) * (0.8 + Math.random() * 0.4);
        const cdx = g.sub.x - s.x;
        const cdy = g.sub.y - s.y;
        const cd = Math.hypot(cdx, cdy) || 1;
        g.charges.push({
          x: s.x,
          y: s.y,
          vx: (cdx / cd) * 42,
          vy: (cdy / cd) * 42,
          t: 0,
        });
        burst(g, s.x, s.y, "#94a3b8", 6, 60);
      }
    }
  }

  // -------- depth charges --------
  for (let i = g.charges.length - 1; i >= 0; i--) {
    const c = g.charges[i];
    c.t += dt;
    const cdx = g.sub.x - c.x;
    const cdy = g.sub.y - c.y;
    const cd = Math.hypot(cdx, cdy) || 1;
    c.vx += ((cdx / cd) * 46 - c.vx) * (1 - Math.exp(-1.4 * dt));
    c.vy += ((cdy / cd) * 46 - c.vy) * (1 - Math.exp(-1.4 * dt));
    c.x += c.vx * dt;
    c.y += c.vy * dt;

    if (Math.random() < 0.4) {
      g.particles.push({
        x: c.x,
        y: c.y,
        vx: 0,
        vy: -14,
        life: 0.6,
        max: 0.6,
        color: "#94a3b8",
        size: 1.2,
      });
    }

    if (c.t > 2.6 || cd < 22) {
      g.charges.splice(i, 1);
      g.blasts.push({ x: c.x, y: c.y, t: 1 });
      burst(g, c.x, c.y, "#fbbf24", 18, 170);
      g.shake = Math.max(g.shake, 8);
      if (Math.hypot(g.sub.x - c.x, g.sub.y - c.y) < BLAST_R) {
        damageSub(g, c.x, c.y);
        if (g.over) return;
      }
    }
  }

  // -------- torpedoes --------
  for (let i = g.torpedoes.length - 1; i >= 0; i--) {
    const t = g.torpedoes[i];
    t.life -= dt;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.trail.push({ x: t.x, y: t.y });
    if (t.trail.length > 12) t.trail.shift();

    if (Math.random() < 0.5) {
      g.particles.push({
        x: t.x,
        y: t.y,
        vx: (Math.random() - 0.5) * 12,
        vy: -10,
        life: 0.5,
        max: 0.5,
        color: "#a5f3fc",
        size: 1.1,
      });
    }

    let hit = false;
    for (let j = g.ships.length - 1; j >= 0; j--) {
      const s = g.ships[j];
      const rr = shipRadius(s) + 4;
      if (Math.hypot(s.x - t.x, s.y - t.y) < rr) {
        hit = true;
        const tons =
          s.kind === "destroyer" ? 300 : MERCHANT_VALUE[s.size];
        g.tons += tons;
        g.ships.splice(j, 1);
        g.blasts.push({ x: s.x, y: s.y, t: 1 });
        burst(g, s.x, s.y, "#fbbf24", 26, 210);
        floater(g, s.x, s.y - 18, `+${tons}t`, "#fde047");
        g.shake = Math.max(g.shake, 6);
        break;
      }
    }
    if (hit || t.life <= 0 || t.x < -10 || t.x > W + 10 || t.y < -10 || t.y > H + 10) {
      if (!hit) burst(g, t.x, t.y, "#67e8f9", 4, 60);
      g.torpedoes.splice(i, 1);
    }
  }
}

/* ------------------------------ render ------------------------------ */

function leadPoint(g: Game, s: Ship): { x: number; y: number; t: number } {
  let t = Math.hypot(s.x - g.sub.x, s.y - g.sub.y) / TORP_SPEED;
  for (let i = 0; i < 2; i++) {
    t = Math.hypot(s.x + s.vx * t - g.sub.x, s.y - g.sub.y) / TORP_SPEED;
  }
  return { x: s.x + s.vx * t, y: s.y, t };
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  // deep ocean
  const bg = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.75);
  bg.addColorStop(0, "#0b1524");
  bg.addColorStop(1, "#050a12");
  ctx.fillStyle = bg;
  ctx.fillRect(-12, -12, W + 24, H + 24);

  // drifting current flecks
  ctx.fillStyle = "rgba(148, 163, 184, 0.08)";
  for (let i = 0; i < 26; i++) {
    const x = (i * 97 + time / 40) % (W + 40) - 20;
    const y = (i * 61) % H;
    ctx.fillRect(x, y, 2, 1);
  }

  if (g) {
    // resupply zones
    for (let i = 0; i < g.zones.length; i++) {
      const z = g.zones[i];
      const pulse = 1 + Math.sin(time / 400 + i * 2) * 0.06;
      ctx.save();
      ctx.strokeStyle = "rgba(110, 231, 183, 0.7)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.shadowColor = "#34d399";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(z.x, z.y, ZONE_R * pulse, 0, TAU);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "rgba(110, 231, 183, 0.08)";
      ctx.beginPath();
      ctx.arc(z.x, z.y, ZONE_R * pulse, 0, TAU);
      ctx.fill();
      // anchor glyph
      ctx.strokeStyle = "rgba(110, 231, 183, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(z.x, z.y - 10);
      ctx.lineTo(z.x, z.y + 8);
      ctx.moveTo(z.x - 7, z.y - 4);
      ctx.lineTo(z.x + 7, z.y - 4);
      ctx.moveTo(z.x - 8, z.y + 4);
      ctx.quadraticCurveTo(z.x, z.y + 14, z.x + 8, z.y + 4);
      ctx.stroke();
      ctx.font = "700 9px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(110, 231, 183, 0.75)";
      ctx.fillText("RESURFACE", z.x, z.y + ZONE_R + 14);
    }

    // ships (fog of war)
    for (const s of g.ships) {
      const d = Math.hypot(s.x - g.sub.x, s.y - g.sub.y);
      let alpha = 0;
      if (d < SENSOR) alpha = 1;
      else if (g.pingFade > 0) alpha = Math.min(0.55, g.pingFade * 0.5);
      if (alpha <= 0.02) continue;

      const heading = s.vx > 0 ? 0 : Math.PI;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(s.x, s.y);
      ctx.rotate(heading);

      if (s.kind === "merchant") {
        const len = MERCHANT_LEN[s.size];
        ctx.shadowColor = "#e2e8f0";
        ctx.shadowBlur = alpha > 0.9 ? 10 : 0;
        ctx.fillStyle = "#cbd5e1";
        ctx.beginPath();
        ctx.roundRect(-len / 2, -7, len, 14, 5);
        ctx.fill();
        ctx.fillStyle = "#94a3b8";
        ctx.beginPath();
        ctx.roundRect(-len * 0.15, -4.5, len * 0.3, 9, 3);
        ctx.fill();
        ctx.fillStyle = "#64748b";
        ctx.fillRect(len * 0.28, -2.5, 3, 5);
        ctx.fillRect(-len * 0.34, -2.5, 3, 5);
      } else {
        ctx.shadowColor = "#f87171";
        ctx.shadowBlur = alpha > 0.9 ? 12 : 0;
        ctx.fillStyle = "#94a3b8";
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(12, -6);
        ctx.lineTo(-18, -6);
        ctx.lineTo(-22, 0);
        ctx.lineTo(-18, 6);
        ctx.lineTo(12, 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.roundRect(-4, -3.5, 9, 7, 2);
        ctx.fill();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(2, -3.5);
        ctx.lineTo(2, -9);
        ctx.stroke();
      }
      ctx.restore();
    }

    // lead lines while the ping fades
    if (g.pingFade > 0.55) {
      const la = Math.min(1, (g.pingFade - 0.55) * 3);
      ctx.save();
      ctx.globalAlpha = la;
      ctx.strokeStyle = "rgba(103, 232, 249, 0.65)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 6]);
      for (const s of g.ships) {
        const lp = leadPoint(g, s);
        ctx.beginPath();
        ctx.moveTo(g.sub.x, g.sub.y);
        ctx.lineTo(lp.x, lp.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(lp.x, lp.y, 6, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    // depth charges
    for (const c of g.charges) {
      const blink = Math.floor(c.t * 6) % 2 === 0;
      ctx.save();
      ctx.shadowColor = blink ? "#f87171" : "#64748b";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = blink ? "#f87171" : "#94a3b8";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // blasts
    for (const b of g.blasts) {
      const p = 1 - Math.max(0, b.t);
      const rad = 8 + p * BLAST_R;
      ctx.save();
      ctx.globalAlpha = Math.max(0, b.t);
      const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rad);
      grd.addColorStop(0, "rgba(255, 255, 255, 0.85)");
      grd.addColorStop(0.6, "rgba(251, 191, 36, 0.4)");
      grd.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(b.x, b.y, rad, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // torpedoes
    for (const t of g.torpedoes) {
      for (let i = 0; i < t.trail.length; i++) {
        const p = t.trail[i];
        ctx.fillStyle = hexA("#a5f3fc", ((i + 1) / (t.trail.length + 2)) * 0.35);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.6, 0, TAU);
        ctx.fill();
      }
      const a = Math.atan2(t.vy, t.vx);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(a);
      ctx.shadowColor = "#67e8f9";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 2.6, 0, 0, TAU);
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

    // sub
    ctx.save();
    ctx.translate(g.sub.x, g.sub.y);
    ctx.rotate(g.sub.angle);
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#0e7490";
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 8, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = "#67e8f9";
    ctx.beginPath();
    ctx.roundRect(-2, -10, 8, 6, 2);
    ctx.fill();
    // prop shimmer
    const spin = Math.sin(time / 50) * 3;
    ctx.fillStyle = "rgba(165, 243, 252, 0.9)";
    ctx.fillRect(-21, -1 - spin / 2, 3, 2 + Math.abs(spin));
    ctx.restore();

    // sensor halo
    ctx.strokeStyle = "rgba(34, 211, 238, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(g.sub.x, g.sub.y, SENSOR, 0, TAU);
    ctx.stroke();

    // ping ring
    if (g.pingT > 0) {
      const p = 1 - g.pingT / PING_RING;
      const rad = 20 + p * 560;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p);
      ctx.strokeStyle = "#67e8f9";
      ctx.lineWidth = 3 - p * 2;
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(g.sub.x, g.sub.y, rad, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // resupply progress
    if (g.resupIdx >= 0) {
      ctx.strokeStyle = "#6ee7b7";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        g.sub.x,
        g.sub.y,
        26,
        -Math.PI / 2,
        -Math.PI / 2 + Math.min(1, g.resupT / 0.5) * TAU,
      );
      ctx.stroke();
    }

    // floaters
    ctx.textAlign = "center";
    for (const f of g.floaters) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.t));
      ctx.font = "800 15px ui-monospace, monospace";
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // hud strip
    ctx.font = "700 14px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fb7185";
    ctx.fillText("♥".repeat(Math.max(0, g.hull)), 16, 26);
    ctx.fillStyle = "#67e8f9";
    ctx.fillText("TORP " + "●".repeat(g.ammo) + "○".repeat(TORP_MAX - g.ammo), 16, 44);
    ctx.fillStyle = g.pingCd > 0 ? "rgba(148, 163, 184, 0.7)" : "#6ee7b7";
    ctx.fillText(
      g.pingCd > 0 ? `PING ${g.pingCd.toFixed(1)}s` : "PING READY",
      16,
      62,
    );
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    ctx.fillText(`${g.tons}t`, W - 16, 26);
    ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
    ctx.fillText(`WAVE ${g.wave}`, W - 16, 44);

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.5);
      ctx.font = "800 28px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(34, 211, 238, 0.85)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 30);
      ctx.restore();
    }

    // hurt vignette
    if (g.hurt > 0.01) {
      const grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      grd.addColorStop(0, "rgba(248, 113, 113, 0)");
      grd.addColorStop(1, `rgba(248, 113, 113, ${(g.hurt * 0.45).toFixed(3)})`);
      ctx.fillStyle = grd;
      ctx.fillRect(-12, -12, W + 24, H + 24);
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function SubHunt() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [hull, setHull] = useState(MAX_HULL);
  const [ammo, setAmmo] = useState(TORP_MAX);
  const [wave, setWave] = useState(1);
  const [pingReady, setPingReady] = useState(true);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("sub-hunt", "high");

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (canvas) render(canvas, gameRef.current, time);
  }, []);

  // canvas setup + idle frame
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
    keysRef.current = { up: false, down: false, left: false, right: false };
    setScore(0);
    setHull(MAX_HULL);
    setAmmo(TORP_MAX);
    setWave(1);
    setPingReady(true);
    setNewBest(false);
    setStatus("playing");
  }, []);

  // main loop
  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastAmmo = -1;
    let lastHull = -1;
    let lastWave = -1;
    let lastPing = true;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      g.input.up = keysRef.current.up;
      g.input.down = keysRef.current.down;
      g.input.left = keysRef.current.left;
      g.input.right = keysRef.current.right;

      step(g, dt);

      if (g.tons !== lastScore) {
        lastScore = g.tons;
        setScore(g.tons);
      }
      if (g.ammo !== lastAmmo) {
        lastAmmo = g.ammo;
        setAmmo(g.ammo);
      }
      if (g.hull !== lastHull) {
        lastHull = g.hull;
        setHull(g.hull);
      }
      if (g.wave !== lastWave) {
        lastWave = g.wave;
        setWave(g.wave);
      }
      const ready = g.pingCd <= 0;
      if (ready !== lastPing) {
        lastPing = ready;
        setPingReady(ready);
      }

      draw(t);
      if (g.over) {
        setScore(g.tons);
        setHull(0);
        setNewBest(submit(g.tons));
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

  // keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === "ArrowUp" || k === "w") {
        e.preventDefault();
        keysRef.current.up = true;
      } else if (k === "ArrowDown" || k === "s") {
        e.preventDefault();
        keysRef.current.down = true;
      } else if (k === "ArrowLeft" || k === "a") {
        e.preventDefault();
        keysRef.current.left = true;
      } else if (k === "ArrowRight" || k === "d") {
        e.preventDefault();
        keysRef.current.right = true;
      } else if (k === " ") {
        e.preventDefault();
        if (status !== "playing") {
          start();
        } else {
          const g = gameRef.current;
          if (g) ping(g);
        }
      } else if (k === "Enter") {
        e.preventDefault();
        if (status !== "playing") {
          start();
        } else {
          const g = gameRef.current;
          if (g) fireTorpedo(g, g.aim.x, g.aim.y);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === "ArrowUp" || k === "w") keysRef.current.up = false;
      if (k === "ArrowDown" || k === "s") keysRef.current.down = false;
      if (k === "ArrowLeft" || k === "a") keysRef.current.left = false;
      if (k === "ArrowRight" || k === "d") keysRef.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start]);

  const toPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  /* ------------------------------ view ------------------------------ */

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Hull{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${hull} hull`}>
            {"♥".repeat(Math.max(0, hull))}
          </b>
        </span>
        <span>
          Torps <b className="ml-1 text-sm text-ink">{ammo}/{TORP_MAX}</b>
        </span>
        <span className={pingReady ? "text-emerald-400" : ""}>
          Ping{" "}
          <b className="ml-1 text-sm text-ink">{pingReady ? "READY" : "…"}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(103,232,249,0.75)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full cursor-crosshair touch-none"
          aria-label="Sub hunt ocean"
          onPointerMove={(e) => {
            const g = gameRef.current;
            if (g && status === "playing") g.aim = toPos(e);
          }}
          onPointerDown={(e) => {
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g) return;
            const pt = toPos(e);
            g.aim = pt;
            if (e.pointerType === "mouse") {
              e.currentTarget.setPointerCapture(e.pointerId);
              fireTorpedo(g, pt.x, pt.y);
            } else {
              e.currentTarget.setPointerCapture(e.pointerId);
              g.move = { active: true, ox: pt.x, oy: pt.y, x: pt.x, y: pt.y };
            }
            setAmmo(g.ammo);
          }}
          onPointerMoveCapture={(e) => {
            const g = gameRef.current;
            if (!g || !g.move.active) return;
            const pt = toPos(e);
            g.move.x = pt.x;
            g.move.y = pt.y;
          }}
          onPointerUp={() => {
            const g = gameRef.current;
            if (g) g.move.active = false;
          }}
          onPointerCancel={() => {
            const g = gameRef.current;
            if (g) g.move.active = false;
          }}
        />

        {status === "playing" && (
          <>
            <button
              type="button"
              aria-label="Sonar ping"
              className="absolute right-3 bottom-3 h-14 w-14 rounded-full border border-cyan-400/50 bg-cyan-500/15 font-mono text-[10px] font-bold tracking-wider text-cyan-300 backdrop-blur-sm active:scale-95"
              onPointerDown={(e) => {
                e.stopPropagation();
                const g = gameRef.current;
                if (g) ping(g);
              }}
            >
              PING
            </button>
            <button
              type="button"
              aria-label="Fire torpedo"
              className="absolute right-20 bottom-3 h-14 w-14 rounded-full border border-rose-400/50 bg-rose-500/15 font-mono text-[10px] font-bold tracking-wider text-rose-300 backdrop-blur-sm active:scale-95"
              onPointerDown={(e) => {
                e.stopPropagation();
                const g = gameRef.current;
                if (g) {
                  fireTorpedo(g, g.aim.x, g.aim.y);
                  setAmmo(g.ammo);
                }
              }}
            >
              FIRE
            </button>
          </>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">SUB HUNT</p>
            <p className="mt-2 text-sm text-muted">
              You hunt by sound in the dark. Ping the sonar to reveal the
              convoys and their lead lines — then send a slow torpedo where they
              are going, not where they are. Destroyers answer with depth
              charges.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-slate-400 via-zinc-500 to-neutral-700"
            >
              Dive
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              WASD / arrows to move · Space to ping · click or Enter to fire ·
              touch: drag to move, use the buttons
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              HULL BREACHED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best tonnage!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {score}t
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Tonnage · Best {best ?? "—"}t · reached wave {wave}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-slate-400 via-zinc-500 to-neutral-700"
            >
              New sortie
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Torpedoes are slow — lead your targets · green rings are resurface
        zones · dodge the blinking depth charges
      </p>
    </div>
  );
}
