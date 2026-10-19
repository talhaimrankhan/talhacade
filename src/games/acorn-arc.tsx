"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 560;
const GROUND_Y = 505;
const NEST = { x: 70, y: 470 };
const G = 620;
const MAX_PULL = 145;
const LAUNCH_SCALE = 5.2;
const ACORN_R = 9;
const ACORNS_PER_LEVEL = 3;
const LEVELS = 20;
const STARS_MAX = LEVELS * 3;

type Status = "idle" | "playing" | "cleared" | "failed";

interface Pt {
  x: number;
  y: number;
}

interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Node {
  x: number;
  y: number;
  r: number;
  hit: number;
}

interface Acorn {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
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

interface ArcGame {
  level: number;
  nodes: Node[];
  walls: Wall[];
  wind: number;
  acorn: Acorn | null;
  trail: Pt[];
  used: number;
  parts: Part[];
  floaters: Floater[];
  aiming: boolean;
  pull: Pt;
  shake: number;
  banner: string;
  bannerT: number;
  dirty: boolean;
}

const EMPTY_STARS = Array.from({ length: LEVELS }, () => 0);

/** Deterministic little PRNG so every level always builds the same layout. */
function lcg(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function overlapsWall(x: number, y: number, r: number, walls: Wall[]): boolean {
  return walls.some(
    (wl) => x + r > wl.x - 14 && x - r < wl.x + wl.w + 14 && y + r > wl.y - 14 && y - r < wl.y + wl.h + 14,
  );
}

function makeLevel(level: number) {
  const rand = lcg(level * 7919 + 104729);
  const wind =
    (level % 2 === 0 ? 1 : -1) *
    Math.min(130, 20 + level * 6) *
    (0.65 + rand() * 0.7);
  const nodeCount = Math.min(5, 2 + Math.floor((level - 1) / 4));
  const wallCount = Math.min(4, 1 + Math.floor(level / 5));

  const walls: Wall[] = [];
  for (let i = 0; i < wallCount; i++) {
    for (let tries = 0; tries < 70; tries++) {
      const horiz = rand() < 0.55;
      const w = horiz ? 90 + rand() * 62 : 16;
      const h = horiz ? 16 : 84 + rand() * 56;
      const x = 155 + rand() * (W - 200 - w);
      const y = 92 + rand() * (330 - h);
      const clash =
        walls.some(
          (o) => x < o.x + o.w + 26 && x + w > o.x - 26 && y < o.y + o.h + 26 && y + h > o.y - 26,
        ) || x + w > W - 34;
      if (!clash) {
        walls.push({ x, y, w, h });
        break;
      }
    }
  }

  const nodes: Node[] = [];
  for (let i = 0; i < nodeCount; i++) {
    for (let tries = 0; tries < 90; tries++) {
      const r = 15 + rand() * 4;
      const x = 205 + rand() * (W - 250 - r);
      const y = 74 + rand() * (390 - r);
      if (Math.hypot(x - NEST.x, y - NEST.y) < 170) continue;
      if (overlapsWall(x, y, r, walls)) continue;
      if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < n.r + r + 62)) continue;
      nodes.push({ x, y, r, hit: 0 });
      break;
    }
  }
  // Fallback so a level can never spawn empty.
  while (nodes.length < 2) {
    nodes.push({ x: 260 + nodes.length * 90, y: 180 + nodes.length * 70, r: 16, hit: 0 });
  }

  return { nodes, walls, wind };
}

function createGame(level: number): ArcGame {
  const lvl = makeLevel(level);
  return {
    level,
    nodes: lvl.nodes,
    walls: lvl.walls,
    wind: lvl.wind,
    acorn: null,
    trail: [],
    used: 0,
    parts: [],
    floaters: [],
    aiming: false,
    pull: { x: NEST.x, y: NEST.y },
    shake: 0,
    banner: `LEVEL ${level}`,
    bannerT: 1.6,
    dirty: true,
  };
}

function drawAcorn(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, time: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#d97706";
  ctx.beginPath();
  ctx.arc(0, 0, ACORN_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#78350f";
  ctx.beginPath();
  ctx.ellipse(0, -ACORN_R * 0.7, ACORN_R * 0.8, ACORN_R * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fef3c7";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-3, -ACORN_R - 3);
  ctx.lineTo(1, -ACORN_R - 3);
  ctx.stroke();
  ctx.fillStyle = "rgba(254, 243, 199, 0.75)";
  ctx.beginPath();
  ctx.arc(-2.5, 2, 2.4 + Math.sin(time / 400) * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function burst(parts: Part[], x: number, y: number, c: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 50 + Math.random() * 170;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.3 + Math.random() * 0.35,
      max: 0.65,
      r: 1.4 + Math.random() * 2.3,
      c,
    });
  }
}

/** One physics tick. Returns 1 when it smacked a wall, 0 otherwise. */
function advance(sp: Acorn, g: ArcGame, dt: number): number {
  sp.t += dt;
  sp.vx += g.wind * dt;
  sp.vy += G * dt;
  const drag = 1 - 0.25 * dt;
  sp.vx *= drag;
  sp.vy *= drag;
  sp.x += sp.vx * dt;
  sp.y += sp.vy * dt;

  if (sp.x < ACORN_R) {
    sp.x = ACORN_R;
    sp.vx = Math.abs(sp.vx) * 0.6;
  } else if (sp.x > W - ACORN_R) {
    sp.x = W - ACORN_R;
    sp.vx = -Math.abs(sp.vx) * 0.6;
  }
  if (sp.y < ACORN_R) {
    sp.y = ACORN_R;
    sp.vy = Math.abs(sp.vy) * 0.6;
  }

  if (sp.y > GROUND_Y - ACORN_R) {
    sp.y = GROUND_Y - ACORN_R;
    sp.vy = -Math.abs(sp.vy) * 0.34;
    sp.vx *= 0.78;
  }

  let hitWall = 0;
  for (const wl of g.walls) {
    const cx = Math.max(wl.x, Math.min(sp.x, wl.x + wl.w));
    const cy = Math.max(wl.y, Math.min(sp.y, wl.y + wl.h));
    const dx = sp.x - cx;
    const dy = sp.y - cy;
    let d = Math.hypot(dx, dy);
    let nx: number;
    let ny: number;
    if (d > 0.001) {
      nx = dx / d;
      ny = dy / d;
    } else {
      // centre swallowed by the wall — push out the nearest face
      const pens: Array<{ nx: number; ny: number; p: number }> = [
        { nx: -1, ny: 0, p: sp.x - wl.x + ACORN_R },
        { nx: 1, ny: 0, p: wl.x + wl.w - sp.x + ACORN_R },
        { nx: 0, ny: -1, p: sp.y - wl.y + ACORN_R },
        { nx: 0, ny: 1, p: wl.y + wl.h - sp.y + ACORN_R },
      ];
      pens.sort((a, b) => a.p - b.p);
      nx = pens[0].nx;
      ny = pens[0].ny;
      d = -pens[0].p;
    }
    if (d > ACORN_R) continue;
    sp.x += nx * (ACORN_R - d);
    sp.y += ny * (ACORN_R - d);
    const dot = sp.vx * nx + sp.vy * ny;
    if (dot < 0) {
      sp.vx -= 1.72 * dot * nx;
      sp.vy -= 1.72 * dot * ny;
      hitWall = 1;
    }
  }
  return hitWall;
}

/** Preview dots — same physics, stops at the first solid contact. */
function predict(g: ArcGame, v0: Pt): Pt[] {
  const sp: Acorn = { x: NEST.x, y: NEST.y, vx: v0.x, vy: v0.y, t: 0 };
  const pts: Pt[] = [];
  for (let i = 0; i < 130; i++) {
    const hitWall = advance(sp, g, 1 / 60);
    if (i % 4 === 0) pts.push({ x: sp.x, y: sp.y });
    if (hitWall) break;
    if (sp.y >= GROUND_Y - ACORN_R - 1) break;
    if (g.nodes.some((n) => Math.hypot(n.x - sp.x, n.y - sp.y) < n.r + ACORN_R)) break;
  }
  return pts;
}

/** Returns "cleared" or "spent" (out of acorns), else null. */
function stepGame(g: ArcGame, dt: number): "cleared" | "spent" | null {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.bannerT = Math.max(0, g.bannerT - dt);

  for (let i = g.nodes.length - 1; i >= 0; i--) {
    g.nodes[i].hit = Math.max(0, g.nodes[i].hit - dt);
  }

  const sp = g.acorn;
  if (sp) {
    const hitWall = advance(sp, g, dt);
    if (hitWall) {
      g.shake = Math.max(g.shake, 3);
      burst(g.parts, sp.x, sp.y, "#bef264", 5);
    }
    g.trail.push({ x: sp.x, y: sp.y });
    if (g.trail.length > 18) g.trail.shift();

    // node impacts
    for (let i = g.nodes.length - 1; i >= 0; i--) {
      const n = g.nodes[i];
      if (Math.hypot(n.x - sp.x, n.y - sp.y) > n.r + ACORN_R) continue;
      g.nodes.splice(i, 1);
      sp.vx *= 0.74;
      sp.vy *= 0.74;
      g.shake = Math.max(g.shake, 6);
      burst(g.parts, n.x, n.y, "#fb7185", 16);
      burst(g.parts, n.x, n.y, "#fde68a", 8);
      g.floaters.push({ x: n.x, y: n.y - 14, text: "CRACKED!", life: 0.8, c: "#fda4af" });
    }

    if (g.nodes.length === 0) return "cleared";

    const speed = Math.hypot(sp.vx, sp.vy);
    const grounded = sp.y >= GROUND_Y - ACORN_R - 1.5;
    if ((sp.t > 0.35 && grounded && speed < 78) || speed < 26 || sp.t > 9) {
      g.acorn = null;
      g.trail = [];
      if (g.used >= ACORNS_PER_LEVEL) return "spent";
    }
  }

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      g.parts.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    p.vx *= 1 - 1.5 * dt;
  }
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.life -= dt;
    f.y -= 28 * dt;
    if (f.life <= 0) g.floaters.splice(i, 1);
  }
  return null;
}

export default function AcornArc() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<ArcGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame(1);

  const [status, setStatus] = useState<Status>("idle");
  const [picker, setPicker] = useState(1);
  const [used, setUsed] = useState(0);
  const [earned, setEarned] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [starsArr, setStarsArr] = useStored<number[]>("acorn-arc:stars", EMPTY_STARS);
  const [unlocked, setUnlocked] = useStored<number>("acorn-arc:unlocked", 1);
  const { best, submit } = useBestScore("acorn-arc", "high");
  const starsRef = useRef(starsArr);

  useEffect(() => {
    starsRef.current = starsArr;
  }, [starsArr]);

  const statusRef = useRef<Status>("idle");
  const [level, setLevel] = useState(1);
  const [nodesLeft, setNodesLeft] = useState(0);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const totalStars = starsArr.reduce((sum, n) => sum + (n || 0), 0);
  const maxLevel = Math.min(LEVELS, Math.max(1, unlocked || 1));
  const pick = Math.min(picker, maxLevel);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0c1f12");
    bg.addColorStop(1, "#07130c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // canopy dots
    ctx.fillStyle = "rgba(190, 242, 100, 0.28)";
    for (let i = 0; i < 34; i++) {
      const x = (i * 97) % W;
      const y = (i * 53) % (GROUND_Y - 20);
      ctx.fillRect(x, y, 1.6, 1.6);
    }

    // wind streaks
    const dir = Math.sign(g.wind);
    const strength = Math.min(4, Math.max(1, Math.round(Math.abs(g.wind) / 34)));
    ctx.strokeStyle = "rgba(134, 239, 172, 0.22)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const base = (i * 127) % (W + 160);
      const x = dir > 0 ? ((base + time * 0.09 * strength) % (W + 80)) - 40 : W + 40 - ((base + time * 0.09 * strength) % (W + 80));
      const y = 26 + ((i * 71) % (GROUND_Y - 60));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dir * 26, y);
      ctx.stroke();
    }

    ctx.save();
    if (g.shake > 0.2) {
      ctx.translate(Math.sin(time / 20) * g.shake, Math.cos(time / 16) * g.shake);
    }

    // ground
    ctx.fillStyle = "#0a2416";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "rgba(134, 239, 172, 0.4)";
    ctx.fillRect(0, GROUND_Y, W, 2);

    // walls (glow banks)
    for (const wl of g.walls) {
      ctx.save();
      ctx.shadowColor = "#4ade80";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#14532d";
      ctx.beginPath();
      ctx.roundRect(wl.x, wl.y, wl.w, wl.h, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#86efac";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // hive nodes
    for (const n of g.nodes) {
      const pulse = 1 + Math.sin(time / 160 + n.x) * 0.06;
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(time / 900);
      ctx.shadowColor = "#fb7185";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#e11d48";
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const px = Math.cos(a) * n.r * pulse;
        const py = Math.sin(a) * n.r * pulse;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#4c0519";
      ctx.beginPath();
      ctx.arc(0, 0, n.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe4e6";
      ctx.beginPath();
      ctx.arc(0, 0, n.r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // trajectory preview
    if (g.aiming) {
      const v0 = { x: (NEST.x - g.pull.x) * LAUNCH_SCALE, y: (NEST.y - g.pull.y) * LAUNCH_SCALE };
      const pts = predict(g, v0);
      for (let i = 0; i < pts.length; i++) {
        const k = i / Math.max(1, pts.length);
        ctx.globalAlpha = 0.16 + (1 - k) * 0.7;
        ctx.fillStyle = "#fde68a";
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, Math.max(1.6, 4 - k * 2.4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // slingshot band + prongs
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(NEST.x - 4, NEST.y + 6);
    ctx.lineTo(NEST.x - 14, NEST.y - 34);
    ctx.moveTo(NEST.x + 4, NEST.y + 6);
    ctx.lineTo(NEST.x + 16, NEST.y - 36);
    ctx.stroke();

    const held = g.aiming ? g.pull : { x: NEST.x, y: NEST.y - 34 };
    if (g.aiming) {
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(NEST.x - 14, NEST.y - 34);
      ctx.lineTo(held.x, held.y);
      ctx.lineTo(NEST.x + 16, NEST.y - 36);
      ctx.stroke();
    }

    // nest bowl
    ctx.save();
    ctx.shadowColor = "#a3e635";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.ellipse(NEST.x, NEST.y + 8, 34, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#b45309";
    ctx.beginPath();
    ctx.ellipse(NEST.x, NEST.y + 5, 28, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // acorn in flight / ready
    if (g.acorn) {
      for (let i = 0; i < g.trail.length; i++) {
        const k = i / g.trail.length;
        ctx.globalAlpha = k * 0.5;
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(g.trail[i].x, g.trail[i].y, 1 + k * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawAcorn(ctx, g.acorn.x, g.acorn.y, Math.atan2(g.acorn.vy, g.acorn.vx), time);
    } else if (g.aiming) {
      drawAcorn(ctx, held.x, held.y, 0, time);
    } else if (g.used < ACORNS_PER_LEVEL && statusRef.current === "playing") {
      const bob = Math.sin(time / 320) * 3;
      drawAcorn(ctx, NEST.x, NEST.y - 34 + bob, 0, time);
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.35 + Math.sin(time / 240) * 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(NEST.x, NEST.y - 34 + bob, 17, 0, Math.PI * 2);
      ctx.stroke();
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

    // wind gauge
    ctx.fillStyle = "rgba(134, 239, 172, 0.9)";
    ctx.font = "bold 13px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(`WIND ${dir > 0 ? "→" : "←"} ${strength}`, W - 14, 30);
    ctx.textAlign = "start";

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.globalAlpha = Math.min(1, g.bannerT);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 30px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(g.banner, W / 2, 84);
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
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

  /* ---------------- loop ---------------- */

  const startLevel = useCallback((lv: number) => {
    const g = createGame(lv);
    gameRef.current = g;
    setLevel(lv);
    setNodesLeft(0);
    setUsed(0);
    setEarned(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const finish = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const stars = Math.max(1, ACORNS_PER_LEVEL + 1 - g.used);
    const prev = starsRef.current;
    const next = Array.from({ length: LEVELS }, (_, i) => prev[i] || 0);
    const idx = Math.min(LEVELS - 1, g.level - 1);
    next[idx] = Math.max(next[idx], stars);
    const total = next.reduce((sum, n) => sum + n, 0);
    starsRef.current = next;
    setStarsArr(next);
    setUnlocked((u) => Math.min(LEVELS, Math.max(u || 1, g.level + 1)));
    setEarned(stars);
    setUsed(g.used);
    setNewBest(submit(total));
    setStatus("cleared");
  }, [setStarsArr, setUnlocked, submit]);

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
        setUsed(g.used);
      }

      if (result === "cleared") {
        draw(t);
        finish();
        return;
      }
      if (result === "spent") {
        setUsed(g.used);
        setNodesLeft(g.nodes.length);
        draw(t);
        setStatus("failed");
        return;
      }

      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, finish]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (status === "idle") startLevel(pick);
        else if (status === "failed") startLevel(gameRef.current?.level ?? 1);
        else if (status === "cleared") {
          const lv = gameRef.current?.level ?? 1;
          startLevel(lv < LEVELS ? lv + 1 : lv);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, startLevel, pick]);

  const toCanvas = (clientX: number, clientY: number, el: HTMLCanvasElement) => {
    const rect = el.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "playing") return;
    const g = gameRef.current;
    if (!g || g.acorn || g.used >= ACORNS_PER_LEVEL) return;
    const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
    if (Math.hypot(p.x - NEST.x, p.y - NEST.y) > 95) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    g.aiming = true;
    g.pull = p;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    if (!g?.aiming) return;
    const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
    const dx = p.x - NEST.x;
    const dy = p.y - NEST.y;
    const d = Math.hypot(dx, dy);
    const clamped = d > MAX_PULL ? MAX_PULL : d;
    g.pull = d > 0 ? { x: NEST.x + (dx / d) * clamped, y: NEST.y + (dy / d) * clamped } : p;
  };

  const onPointerUp = () => {
    const g = gameRef.current;
    if (!g?.aiming) return;
    g.aiming = false;
    const dx = NEST.x - g.pull.x;
    const dy = NEST.y - g.pull.y;
    const pull = Math.hypot(dx, dy);
    if (pull < 16) return; // nothing to fling
    g.acorn = {
      x: NEST.x,
      y: NEST.y,
      vx: dx * LAUNCH_SCALE,
      vy: dy * LAUNCH_SCALE,
      t: 0,
    };
    g.trail = [];
    g.used += 1;
    setUsed(g.used);
    burst(g.parts, NEST.x, NEST.y - 30, "#fde68a", 8);
  };

  /* ---------------- view ---------------- */

  const left = Math.max(0, ACORNS_PER_LEVEL - used);

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={totalStars} best={best ?? "—"}>
        <span className="text-lime-300">
          Level <b className="ml-1 text-sm text-ink">{status === "idle" ? pick : level}</b>
        </span>
        <span className="text-amber-300">
          Acorns{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${left} acorns left`}>
            {"●".repeat(left) || "—"}{"○".repeat(ACORNS_PER_LEVEL - left)}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(134,239,172,0.85)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-grab select-none active:cursor-grabbing"
          aria-label="Acorn Arc level"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {status === "playing" && (
          <p className="pointer-events-none absolute right-3 top-10 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            Drag from the nest · release to fling
          </p>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">ACORN ARC</p>
            <p className="mt-2 text-sm text-muted">
              Pull an acorn back on the slingshot, read the bounce, and smash every hive node in
              three shots. Wind shifts each level — bank it off the glowing walls.
            </p>
            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setPicker((p) => Math.max(1, Math.min(p, maxLevel) - 1))}
                disabled={pick <= 1}
                className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink transition hover:brightness-125 disabled:opacity-30"
                aria-label="Previous level"
              >
                ‹
              </button>
              <span className="font-mono text-sm uppercase tracking-widest text-ink">
                Level {pick} / {LEVELS}
              </span>
              <button
                type="button"
                onClick={() => setPicker((p) => Math.min(maxLevel, Math.max(1, p) + 1))}
                disabled={pick >= maxLevel}
                className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink transition hover:brightness-125 disabled:opacity-30"
                aria-label="Next level"
              >
                ›
              </button>
            </div>
            <PrimaryButton onClick={() => startLevel(pick)} tone="from-lime-400 via-green-500 to-emerald-600">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Mouse or finger: drag from the nest, release to shoot · clear with fewer acorns for
              more stars
            </p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-warn">
              ⭐ {totalStars} / {STARS_MAX} stars banked
            </p>
          </Overlay>
        )}

        {status === "cleared" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-lime-300">
              LEVEL {level} CLEARED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 text-4xl">
              {"⭐".repeat(earned)}
              <span className="opacity-25">{"⭐".repeat(ACORNS_PER_LEVEL - earned)}</span>
            </p>
            <p className="mt-2 font-mono text-3xl font-bold text-white">{totalStars}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Total stars · Best {best ?? "—"}
            </p>
            {level < LEVELS ? (
              <PrimaryButton
                onClick={() => startLevel(level + 1)}
                tone="from-lime-400 via-green-500 to-emerald-600"
              >
                Next level
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={() => startLevel(LEVELS)} tone="from-lime-400 via-green-500 to-emerald-600">
                Replay level {LEVELS}
              </PrimaryButton>
            )}
            <p className="mt-3 text-xs text-muted">
              Level {Math.min(LEVELS, level + 1)} unlocked
            </p>
          </Overlay>
        )}

        {status === "failed" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">OUT OF ACORNS</p>
            <p className="mt-2 text-sm text-muted">
              {nodesLeft} hive node
              {nodesLeft === 1 ? "" : "s"} still standing.
            </p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-warn">
              ⭐ {totalStars} / {STARS_MAX} stars banked
            </p>
            <PrimaryButton
              onClick={() => startLevel(level)}
              tone="from-lime-400 via-green-500 to-emerald-600"
            >
              Retry level
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Bank shots off the green walls to line them up</p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        One clean hit cracks a node · 1 acorn = ⭐⭐⭐, 2 = ⭐⭐, 3 = ⭐
      </p>
    </div>
  );
}
