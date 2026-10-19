"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 500;
const H = 320;
const STEP = 10; // terrain sample spacing
const SLED_X = 150; // sled's fixed screen x
const START_X = 60;
const TONE = "from-rose-400 via-pink-500 to-fuchsia-600";

type Status = "idle" | "playing" | "over";

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

interface Pop {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
}

interface Pickup {
  x: number;
  y: number;
}

interface SledGame {
  x: number; // world distance travelled (px)
  y: number; // screen y of the skid contact point
  vx: number;
  vy: number;
  angle: number; // nose-up radians (0 = flat)
  airborne: boolean;
  airT: number;
  fuel: number; // 0..100
  boosting: boolean;
  heights: number[]; // ground screen y, sampled every STEP px
  genX: number; // world x the terrain is generated up to
  seed: number;
  pickups: Pickup[];
  nextPickup: number;
  parts: Particle[];
  pops: Pop[];
  shake: number;
  flash: number;
  flashC: string;
  landT: number;
  landText: string;
  emitT: number;
  over: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Stable pseudo-random in [0,1) — keeps the sky decoration frame-consistent. */
function hash01(i: number): number {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function groundAt(g: SledGame, x: number): number {
  const i = clamp(Math.floor(x / STEP), 0, g.heights.length - 2);
  const f = clamp(x / STEP - i, 0, 1);
  const a = g.heights[i];
  const b = g.heights[i + 1];
  return a + (b - a) * f;
}

/** Positive when the ground rises ahead (an uphill the nose would have to climb). */
function slopeUpAt(g: SledGame, x: number): number {
  const a = groundAt(g, x - 6);
  const b = groundAt(g, x + 6);
  return clamp(-(b - a) / 12, -1.1, 1.1);
}

function push(g: SledGame, h: number): void {
  g.heights.push(clamp(h, 80, 265));
  g.genX += STEP;
}

/** Generates track ahead of the sled: ice ripples, bump fields, ramps, gullies. */
function ensureTerrain(g: SledGame): void {
  const target = g.x + W * 2.4;
  while (g.genX < target) {
    const hard = clamp(g.genX / 16000, 0, 1);
    const roll = Math.random();
    const last = g.heights[g.heights.length - 1];

    if (g.genX < 700 || roll < 0.3) {
      // open cruise — gentle ripples
      const base = clamp(last, 150, 205);
      const end = g.genX + 150 + Math.random() * 120;
      while (g.genX < end) {
        push(g, base + Math.sin(g.genX * 0.05 + g.seed) * (3 + hard * 5));
      }
    } else if (roll < 0.56) {
      // bump field — gets chewier with distance
      const base = clamp(last, 148, 205);
      const amp = 7 + hard * 12;
      const end = g.genX + 150 + Math.random() * 130;
      while (g.genX < end) {
        push(
          g,
          base +
            Math.sin(g.genX * 0.11 + g.seed * 1.7) * amp +
            Math.sin(g.genX * 0.045 + g.seed) * amp * 0.6,
        );
      }
    } else if (roll < 0.8) {
      // RAMP then cliff — the sled's big-air maker
      const base = clamp(last, 150, 224);
      const len = 78 + Math.random() * 44;
      const rise = 38 + hard * 26;
      const startG = g.genX;
      const end = startG + len;
      while (g.genX < end) {
        const t = (g.genX - startG) / len;
        push(g, base - rise * t);
      }
      push(g, base - rise); // the lip
      const floorH = base - rise + 56 + hard * 40;
      push(g, floorH); // one near-vertical sample = cliff
      const end2 = g.genX + 130 + Math.random() * 110;
      while (g.genX < end2) {
        push(g, floorH + Math.sin(g.genX * 0.05 + g.seed) * 3);
      }
    } else {
      // gully — dip and climb out, a nasty place to land
      const base = clamp(last, 140, 205);
      const len = 210 + Math.random() * 150;
      const depth = 30 + hard * 26;
      const startG = g.genX;
      const end = startG + len;
      while (g.genX < end) {
        const t = (g.genX - startG) / len;
        push(g, base + Math.sin(t * Math.PI) * depth);
      }
    }
    g.seed += 7.3;
  }
}

function createGame(): SledGame {
  const g: SledGame = {
    x: START_X,
    y: 210,
    vx: 210,
    vy: 0,
    angle: 0,
    airborne: false,
    airT: 0,
    fuel: 100,
    boosting: false,
    heights: [],
    genX: 0,
    seed: Math.random() * 40,
    pickups: [],
    nextPickup: 520,
    parts: [],
    pops: [],
    shake: 0,
    flash: 0,
    flashC: "#f43f5e",
    landT: 0,
    landText: "",
    emitT: 0,
    over: false,
  };
  while (g.heights.length < 10) push(g, 210);
  g.y = 210;
  return g;
}

function burst(
  g: SledGame,
  x: number,
  y: number,
  n: number,
  c: string,
  power = 150,
): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * power;
    g.parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      life: 0.45 + Math.random() * 0.45,
      max: 0.9,
      r: 2 + Math.random() * 3,
      c,
    });
  }
}

function pop(g: SledGame, x: number, y: number, text: string, c: string): void {
  g.pops.push({ x, y, text, life: 1.2, c });
}

export default function RocketSled() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [boot] = useState(createGame);
  const gameRef = useRef<SledGame>(boot);

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0); // metres travelled
  const [newBest, setNewBest] = useState(false);
  const [reason, setReason] = useState("");
  const { best, submit } = useBestScore("rocket-sled", "high");

  const keysRef = useRef<Set<string>>(new Set());
  const touchRef = useRef(false);
  const dispRef = useRef(0);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const sx = (Math.random() - 0.5) * g.shake;
    const camX = g.x - SLED_X;
    const wx = (v: number) => v - camX + sx;

    // night sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#070b1d");
    sky.addColorStop(1, "#123044");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // stars
    ctx.fillStyle = "#e2e8f0";
    for (let i = 0; i < 44; i++) {
      const span = W + 240;
      const raw = (hash01(i) * span - camX * 0.1) % span;
      const px = (raw < 0 ? raw + span : raw) - 60;
      const py = 42 + hash01(i + 90) * 110;
      ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(time / 460 + i));
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.globalAlpha = 1;

    // aurora bands
    for (let band = 0; band < 2; band++) {
      ctx.strokeStyle = band
        ? "rgba(45, 212, 191, 0.15)"
        : "rgba(244, 114, 182, 0.12)";
      ctx.lineWidth = 14;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) {
        const yy =
          74 +
          band * 28 +
          Math.sin(x * 0.016 + camX * 0.004 + band * 2 + time / 900) * 16;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // far ice ridges
    ctx.fillStyle = "rgba(125, 211, 252, 0.13)";
    for (let i = 0; i < 7; i++) {
      const span = W + 320;
      const raw = (i * 150 - camX * 0.3) % span;
      const hx = (raw < 0 ? raw + span : raw) - 160;
      ctx.beginPath();
      ctx.arc(hx, 214, 86, Math.PI, 0);
      ctx.fill();
    }

    // track polygon
    const i0 = clamp(Math.floor(camX / STEP) - 1, 0, g.heights.length - 2);
    const i1 = clamp(Math.ceil((camX + W) / STEP) + 1, 0, g.heights.length - 1);
    ctx.beginPath();
    ctx.moveTo(wx(i0 * STEP), H);
    for (let i = i0; i <= i1; i++) ctx.lineTo(wx(i * STEP), g.heights[i]);
    ctx.lineTo(wx(i1 * STEP), H);
    ctx.closePath();
    const ice = ctx.createLinearGradient(0, 90, 0, H);
    ice.addColorStop(0, "#e0f2fe");
    ice.addColorStop(1, "#0284c7");
    ctx.fillStyle = ice;
    ctx.fill();

    // frost cracks
    ctx.strokeStyle = "rgba(12, 116, 144, 0.4)";
    ctx.lineWidth = 1.5;
    const k0 = Math.floor(camX / 74);
    for (let k = k0; k < k0 + 9; k++) {
      const idx = clamp(Math.floor((k * 74) / STEP), 0, g.heights.length - 1);
      const cy = g.heights[idx] + 16 + hash01(k + 7) * 34;
      if (cy > H - 10) continue;
      const cx = wx(k * 74 + hash01(k) * 52);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 9, cy + 11);
      ctx.lineTo(cx - 5, cy + 22);
      ctx.stroke();
    }

    // glowing lip highlight on the surface
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const px = wx(i * STEP);
      if (i === i0) ctx.moveTo(px, g.heights[i]);
      else ctx.lineTo(px, g.heights[i]);
    }
    ctx.stroke();

    // fuel cans
    for (let i = 0; i < g.pickups.length; i++) {
      const p = g.pickups[i];
      const px = wx(p.x);
      if (px < -50 || px > W + 50) continue;
      const pulse = 1 + Math.sin(time / 190 + p.x * 0.02) * 0.1;
      ctx.save();
      ctx.translate(px, p.y);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.roundRect(-11, -13, 22, 26, 5);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.roundRect(-5, -18, 10, 6, 2);
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.fillRect(-6, -5, 12, 9);
      ctx.fillStyle = "#78350f";
      ctx.font = "bold 8px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("+30", 0, 3);
      ctx.restore();
    }

    // particles
    for (let i = 0; i < g.parts.length; i++) {
      const p = g.parts[i];
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(wx(p.x), p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // sled
    ctx.save();
    ctx.translate(wx(g.x), g.y);
    ctx.rotate(-g.angle);
    // skid
    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.roundRect(-30, -4, 62, 5, 3);
    ctx.fill();
    // body
    ctx.shadowColor = "#fb7185";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.roundRect(-26, -25, 50, 18, 9);
    ctx.fill();
    ctx.shadowBlur = 0;
    // nose cone
    ctx.fillStyle = "#f43f5e";
    ctx.beginPath();
    ctx.moveTo(22, -23);
    ctx.lineTo(42, -16);
    ctx.lineTo(22, -9);
    ctx.closePath();
    ctx.fill();
    // cockpit
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.ellipse(4, -23, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // tail fin
    ctx.fillStyle = "#e11d48";
    ctx.beginPath();
    ctx.moveTo(-24, -23);
    ctx.lineTo(-36, -37);
    ctx.lineTo(-24, -14);
    ctx.closePath();
    ctx.fill();
    // nozzle
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.roundRect(-33, -22, 9, 13, 2);
    ctx.fill();
    // flame
    if (g.boosting) {
      const flick = 26 + Math.sin(time / 36) * 9 + Math.random() * 12;
      ctx.fillStyle = "rgba(251, 146, 60, 0.9)";
      ctx.beginPath();
      ctx.moveTo(-32, -22);
      ctx.lineTo(-32 - flick, -16);
      ctx.lineTo(-32, -9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.moveTo(-32, -20);
      ctx.lineTo(-32 - flick * 0.6, -16);
      ctx.lineTo(-32, -11);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // pops
    ctx.textAlign = "center";
    ctx.font = "bold 15px ui-monospace, monospace";
    for (let i = 0; i < g.pops.length; i++) {
      const p = g.pops[i];
      ctx.globalAlpha = Math.min(1, p.life / 0.6);
      ctx.fillStyle = p.c;
      ctx.fillText(p.text, wx(p.x), p.y - (1.2 - p.life) * 34);
    }
    ctx.globalAlpha = 1;

    // top bar
    ctx.fillStyle = "rgba(2, 6, 23, 0.62)";
    ctx.fillRect(0, 0, W, 36);
    ctx.font = "bold 15px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`${Math.max(0, Math.floor((g.x - START_X) / 10))} m`, 12, 24);
    ctx.textAlign = "center";
    ctx.fillStyle = "#7dd3fc";
    ctx.fillText(`${Math.round(g.vx * 0.36)} km/h`, W / 2, 24);
    const bw = 150;
    const bx = W - bw - 16;
    ctx.textAlign = "right";
    ctx.fillStyle = g.fuel > 30 ? "#94a3b8" : "#f87171";
    ctx.fillText("FUEL", bx - 8, 24);
    ctx.fillStyle = "rgba(148, 163, 184, 0.28)";
    ctx.beginPath();
    ctx.roundRect(bx, 11, bw, 14, 7);
    ctx.fill();
    const f = clamp(g.fuel / 100, 0, 1);
    if (f > 0.03) {
      ctx.fillStyle = f > 0.35 ? "#34d399" : f > 0.16 ? "#fbbf24" : "#f43f5e";
      ctx.beginPath();
      ctx.roundRect(bx, 11, Math.max(4, bw * f), 14, 7);
      ctx.fill();
    }

    // landing banner
    if (g.landT > 0) {
      ctx.globalAlpha = Math.min(1, g.landT * 1.6);
      ctx.font = "bold 26px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = "#5eead4";
      ctx.fillText(g.landText, W / 2, H * 0.34);
      ctx.globalAlpha = 1;
    }

    // impact wash
    if (g.flash > 0) {
      ctx.globalAlpha = Math.min(0.5, g.flash);
      ctx.fillStyle = g.flashC;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
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

  /* ---------------- logic ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setNewBest(false);
    setReason("");
    dispRef.current = 0;
    touchRef.current = false;
    setStatus("playing");
  }, []);

  const crash = useCallback(
    (why: string) => {
      const g = gameRef.current;
      if (g.over) return;
      g.over = true;
      g.shake = 18;
      g.flash = 0.9;
      g.flashC = "#f43f5e";
      burst(g, g.x + 14, g.y - 18, 32, "#f43f5e", 230);
      burst(g, g.x, g.y - 8, 16, "#e2e8f0", 150);
      const final = Math.max(0, Math.floor((g.x - START_X) / 10));
      setScore(final);
      setReason(why);
      setNewBest(submit(final));
      setStatus("over");
      draw(performance.now());
    },
    [draw, submit],
  );

  const step = useCallback(
    (dt: number): boolean => {
      const g = gameRef.current;
      if (g.over) return true;

      if (g.shake > 0) g.shake = Math.max(0, g.shake - 26 * dt);
      if (g.flash > 0) g.flash = Math.max(0, g.flash - 2.2 * dt);
      if (g.landT > 0) g.landT -= dt;

      const keys = keysRef.current;
      const wants = keys.has(" ") || touchRef.current;
      const boosting = wants && g.fuel > 0.5;
      g.boosting = boosting;

      if (boosting) {
        g.fuel = Math.max(0, g.fuel - 30 * dt);
        const T = 340;
        g.vx += Math.cos(g.angle) * T * dt;
        g.vy -= Math.sin(g.angle) * T * dt;
        g.emitT -= dt;
        if (g.emitT <= 0) {
          g.emitT = 0.02;
          const rx = g.x - Math.cos(g.angle) * 30;
          const ry = g.y - 16 - Math.sin(g.angle) * 30;
          for (let i = 0; i < 2; i++) {
            g.parts.push({
              x: rx,
              y: ry,
              vx: -110 - Math.random() * 150 - g.vx * 0.2,
              vy: -30 + Math.random() * 60,
              life: 0.26 + Math.random() * 0.24,
              max: 0.5,
              r: 3 + Math.random() * 3,
              c:
                Math.random() < 0.5
                  ? "#fde047"
                  : Math.random() < 0.6
                    ? "#fb7185"
                    : "#f97316",
            });
          }
        }
      } else {
        g.fuel = Math.min(100, g.fuel + 13 * dt);
        if (wants) g.shake = Math.max(g.shake, 2.5); // dry tank sputter
      }

      // drag + skid friction
      g.vx -= g.vx * 0.17 * dt;
      g.vx -= 9 * dt;
      if (g.vx < 0) g.vx = 0;
      if (g.vx > 690) g.vx = 690;

      ensureTerrain(g);
      g.x += g.vx * dt;
      const h = groundAt(g, g.x);

      if (g.airborne) {
        g.vy += 1250 * dt;
        g.y += g.vy * dt;
        g.angle += (boosting ? 0.45 : -0.34) * dt;
        g.angle = clamp(g.angle, -1.2, 1.2);
        g.airT += dt;

        if (g.y >= h) {
          // touchdown
          const slopeUp = slopeUpAt(g, g.x);
          const delta = g.angle - slopeUp;
          const impact = g.vy;
          g.airborne = false;
          g.y = h;
          g.angle = slopeUp;
          g.vy = -slopeUp * g.vx;
          g.shake = Math.max(g.shake, clamp(impact * 0.012, 2, 10));

          if (impact < 300) {
            // little hop — ride it out
            burst(g, g.x, h, 4, "rgba(226,232,240,0.8)", 70);
          } else if (delta < -0.45 && impact > 420) {
            crash("nose-dive landing");
            return true;
          } else if (delta < -0.2) {
            g.vx *= 0.62;
            g.shake = 11;
            g.flash = 0.4;
            g.flashC = "#f43f5e";
            pop(g, g.x, h - 46, "NOSE SCRAPE", "#f87171");
            burst(g, g.x + 24, h - 4, 12, "#e2e8f0", 140);
          } else if (delta > 0.55) {
            g.vx *= 0.55;
            g.shake = 12;
            g.flash = 0.4;
            g.flashC = "#f43f5e";
            pop(g, g.x, h - 46, "TAIL STRIKE", "#f87171");
            burst(g, g.x - 20, h - 4, 12, "#e2e8f0", 140);
          } else {
            const big = g.airT >= 0.35;
            const refuel = big ? 16 + Math.min(26, g.airT * 30) : 4;
            g.fuel = Math.min(100, g.fuel + refuel);
            if (big) {
              g.vx = Math.min(690, g.vx + 100);
              g.flash = 0.32;
              g.flashC = "#5eead4";
              g.landT = 1.2;
              g.landText =
                g.airT > 0.5 ? "STICK LANDING +BOOST" : "CLEAN LANDING";
              pop(g, g.x, h - 50, `+${Math.round(refuel)} FUEL`, "#34d399");
            }
            burst(g, g.x, h, big ? 14 : 6, "#a5f3fc", 160);
          }
          g.airT = 0;
        }
      } else {
        const gap = h - g.y;
        if (gap > 8) {
          // ground fell away — big air begins (vy already carries the ramp's lift)
          g.airborne = true;
          g.airT = 0;
        } else {
          g.y = h;
          const slopeUp = slopeUpAt(g, g.x);
          g.angle += (slopeUp - g.angle) * Math.min(1, 15 * dt);
          g.vy = -slopeUp * g.vx;
          if (g.vx > 210 && Math.random() < 0.5) {
            g.parts.push({
              x: g.x - 18,
              y: h - 2,
              vx: -60 - Math.random() * 90,
              vy: -20 - Math.random() * 60,
              life: 0.4,
              max: 0.4,
              r: 2.5,
              c: "rgba(226, 232, 240, 0.85)",
            });
          }
        }
      }

      // fuel cans
      while (g.x > g.nextPickup) {
        const px = g.nextPickup + W + 220;
        const gy = groundAt(g, px);
        g.pickups.push({ x: px, y: gy - 34 });
        const hard = clamp(g.x / 16000, 0, 1);
        g.nextPickup = px + 760 + Math.random() * 560 + hard * 240;
      }
      for (let i = g.pickups.length - 1; i >= 0; i--) {
        const p = g.pickups[i];
        if (p.x < g.x - 150) {
          g.pickups.splice(i, 1);
          continue;
        }
        const dx = p.x - g.x;
        const dy = p.y - (g.y - 16);
        if (dx * dx + dy * dy < 38 * 38) {
          g.fuel = Math.min(100, g.fuel + 30);
          g.pickups.splice(i, 1);
          pop(g, p.x, p.y - 28, "+30 FUEL", "#fbbf24");
          burst(g, p.x, p.y, 14, "#fbbf24", 150);
          g.flash = 0.25;
          g.flashC = "#f59e0b";
        }
      }

      // particles
      for (let i = g.parts.length - 1; i >= 0; i--) {
        const p = g.parts[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 430 * dt;
        p.vx -= p.vx * 1.7 * dt;
        if (p.life <= 0) g.parts.splice(i, 1);
      }
      for (let i = g.pops.length - 1; i >= 0; i--) {
        g.pops[i].life -= dt;
        if (g.pops[i].life <= 0) g.pops.splice(i, 1);
      }

      const shown = Math.max(0, Math.floor((g.x - START_X) / 10));
      if (shown !== dispRef.current) {
        dispRef.current = shown;
        setScore(shown);
      }
      return false;
    },
    [crash],
  );

  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const done = step(dt);
      draw(t);
      if (!done) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, step, draw]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const keys = keysRef.current;
    const normalize = (k: string) => (k.length === 1 ? k.toLowerCase() : k);
    const onDown = (e: KeyboardEvent) => {
      const k = normalize(e.key);
      if (
        status === "playing" &&
        (k === " " ||
          k === "ArrowUp" ||
          k === "ArrowDown" ||
          k === "ArrowLeft" ||
          k === "ArrowRight")
      ) {
        e.preventDefault();
      }
      keys.add(k);
      if ((k === " " || k === "Enter") && status !== "playing") {
        e.preventDefault();
        start();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      keys.delete(normalize(e.key));
    };
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [status, start]);

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={`${score} m`} best={best !== null ? `${best} m` : "—"} />

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(244,63,94,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none"
          aria-label="Rocket Sled ice run"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") start();
            touchRef.current = true;
          }}
          onPointerUp={() => {
            touchRef.current = false;
          }}
          onPointerLeave={() => {
            touchRef.current = false;
          }}
          onPointerCancel={() => {
            touchRef.current = false;
          }}
        />

        {status === "playing" && (
          <button
            type="button"
            aria-label="Hold to fire the booster"
            className="pointer-events-auto absolute bottom-4 right-4 h-16 w-32 rounded-2xl bg-rose-500/70 text-sm font-bold uppercase tracking-widest text-white backdrop-blur active:scale-95"
            onPointerDown={(e) => {
              e.preventDefault();
              touchRef.current = true;
            }}
            onPointerUp={() => {
              touchRef.current = false;
            }}
            onPointerLeave={() => {
              touchRef.current = false;
            }}
            onPointerCancel={() => {
              touchRef.current = false;
            }}
          >
            Boost
          </button>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">ROCKET SLED</p>
            <p className="mt-2 text-sm text-muted">
              Hold to fire the booster — fuel drains fast and only trickles back
              when you coast. Ramps throw the sled sky-high: stick the landing flat
              for a free boost, nose-dive into the ice and the run is over.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Hold Space / hold the screen to boost · grab the fuel cans · land flat
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">WRECKED</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-muted">{reason}</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score} m</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best !== null ? `${best} m` : "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Run it back
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Coasting refills the tank · flat landings pay fuel and speed · gravity wins
        every nose-down landing
      </p>
    </div>
  );
}
