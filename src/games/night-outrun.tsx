"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 640;
const H = 440;
const STEP = 1000 / 60;
const TAU = Math.PI * 2;

const SEG_LEN = 200; // world length of one road segment
const N_SEGS = 900; // looping track size
const TRACK_LEN = N_SEGS * SEG_LEN;
const DRAW = 120; // segments drawn ahead
const ROAD_W = 2000; // road half-width in world units
const CAM_H = 1000; // camera height
const CAM_DEPTH = 1.25; // ~fov
const PLAYER_Z = CAM_H * CAM_DEPTH; // camera → player car distance
const MAX_V = 12500; // top speed (world units / s)
const BASE_V = 4200; // starting speed
const CAR_W = 460; // traffic car width in world units

type Status = "idle" | "playing" | "over";

interface Proj {
  x1: number;
  y1: number;
  w1: number;
  x2: number;
  y2: number;
  w2: number;
  s1: number;
  ok: boolean;
}
interface Car {
  z: number;
  offset: number; // -1..1 across the road
  speed: number;
  hue: number;
  scored: boolean;
  minLat: number;
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
interface G {
  pos: number;
  speed: number;
  playerX: number;
  cars: Car[];
  parts: Part[];
  proj: Proj[];
  near: Car[];
  bonus: number;
  shake: number;
  flash: number;
  toast: string;
  toastT: number;
  hudAcc: number;
  lastScore: number;
  nextKm: number;
  nextCarM: number;
  alive: boolean;
}

/* ---------------- procedural night track ---------------- */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

interface RoadSeg {
  curve: number;
  y1: number;
  y2: number;
}

function buildTrack(): RoadSeg[] {
  const rnd = mulberry32(987654321);
  const out: RoadSeg[] = [];
  let i = 0;
  let y = 0;
  while (i < N_SEGS) {
    const roll = rnd();
    if (roll < 0.3) {
      // straight
      const len = 16 + Math.floor(rnd() * 26);
      for (let s = 0; s < len && i < N_SEGS; s++, i++) {
        out.push({ curve: 0, y1: y, y2: y });
      }
    } else if (roll < 0.72) {
      // sweeping curve
      const len = 14 + Math.floor(rnd() * 22);
      const str = (0.7 + rnd() * 2.1) * (rnd() < 0.5 ? 1 : -1);
      for (let s = 0; s < len && i < N_SEGS; s++, i++) {
        out.push({ curve: str, y1: y, y2: y });
      }
    } else {
      // rolling hill
      const len = 12 + Math.floor(rnd() * 18);
      const y0 = y;
      const target = Math.max(-130, Math.min(170, y + (rnd() * 2 - 1) * 160));
      for (let s = 0; s < len && i < N_SEGS; s++, i++) {
        const t0 = smooth(s / len);
        const t1 = smooth((s + 1) / len);
        out.push({
          curve: 0,
          y1: y0 + (target - y0) * t0,
          y2: y0 + (target - y0) * t1,
        });
      }
      y = target;
    }
  }
  return out;
}

const TRACK = buildTrack();

const STARS = (() => {
  const rnd = mulberry32(1234);
  const out: { x: number; y: number; rr: number; ph: number; sp: number }[] = [];
  for (let i = 0; i < 110; i++) {
    out.push({
      x: rnd() * W,
      y: rnd() * (H / 2 - 20),
      rr: 0.5 + rnd() * 1.3,
      ph: rnd() * TAU,
      sp: 0.6 + rnd() * 2.2,
    });
  }
  return out;
})();

const CITY = (() => {
  const rnd = mulberry32(555);
  const out: { x: number; w: number; h: number; lit: number }[] = [];
  let x = -12;
  while (x < W + 12) {
    const w = 13 + rnd() * 33;
    out.push({
      x,
      w,
      h: 14 + rnd() * 78,
      lit: Math.floor(rnd() * 6),
    });
    x += w + 2 + rnd() * 9;
  }
  return out;
})();

const TRAFFIC_COLORS = ["#38bdf8", "#f472b6", "#a78bfa", "#34d399", "#fbbf24", "#fb7185"];
const LANES = [-0.64, 0, 0.64];

function createGame(): G {
  const g: G = {
    pos: 0,
    speed: BASE_V,
    playerX: 0,
    cars: [],
    parts: [],
    proj: [],
    near: [],
    bonus: 0,
    shake: 0,
    flash: 0,
    toast: "",
    toastT: 0,
    hudAcc: 0,
    lastScore: -1,
    nextKm: 1000,
    nextCarM: 750,
    alive: true,
  };
  for (let i = 0; i < 14; i++) {
    g.cars.push({
      z: 1200 + i * 640 + (i % 3) * 150,
      offset: LANES[i % 3] + (((i * 37) % 7) - 3) * 0.012,
      speed: BASE_V * (0.42 + ((i * 53) % 9) * 0.03),
      hue: (i * 7) % TRAFFIC_COLORS.length,
      scored: false,
      minLat: 9,
    });
  }
  for (let i = 0; i < DRAW; i++) {
    g.proj.push({ x1: 0, y1: 0, w1: 0, x2: 0, y2: 0, w2: 0, s1: 0, ok: false });
  }
  return g;
}

/* ---------------- canvas drawing helpers ---------------- */

function poly(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}

function projectInto(
  p: Proj,
  slot: 1 | 2,
  worldY: number,
  worldZ: number,
  camX: number,
  camZ: number,
) {
  const z = Math.max(worldZ - camZ, 120);
  const scale = CAM_DEPTH / z;
  const sx = W / 2 + (scale * -camX * W) / 2;
  const sy = H / 2 - (scale * (worldY - CAM_H) * H) / 2;
  const sw = (scale * ROAD_W * W) / 2;
  if (slot === 1) {
    p.x1 = sx;
    p.y1 = sy;
    p.w1 = sw;
    p.s1 = scale;
  } else {
    p.x2 = sx;
    p.y2 = sy;
    p.w2 = sw;
  }
}

function laneMarker(ctx: CanvasRenderingContext2D, p: Proj, f: number) {
  const lx1 = p.x1 + p.w1 * f;
  const lx2 = p.x2 + p.w2 * f;
  const m1 = Math.max(0.6, p.w1 / 46);
  const m2 = Math.max(0.4, p.w2 / 46);
  poly(ctx, lx1 - m1, p.y1, lx1 + m1, p.y1, lx2 + m2, p.y2, lx2 - m2, p.y2);
}

function renderBand(ctx: CanvasRenderingContext2D, p: Proj, bright: boolean) {
  const y1 = p.y1;
  const y2 = p.y2;
  const h = y2 - y1 + 1;
  // shoulder ground
  ctx.fillStyle = bright ? "#0a0418" : "#0c0520";
  ctx.fillRect(0, y1, W, h);
  // neon rumble strips
  ctx.fillStyle = bright ? "#e879f9" : "#22d3ee";
  poly(
    ctx,
    p.x1 - p.w1 * 1.14,
    y1,
    p.x1 + p.w1 * 1.14,
    y1,
    p.x2 + p.w2 * 1.14,
    y2,
    p.x2 - p.w2 * 1.14,
    y2,
  );
  // asphalt
  ctx.fillStyle = bright ? "#1a1338" : "#161030";
  poly(ctx, p.x1 - p.w1, y1, p.x1 + p.w1, y1, p.x2 + p.w2, y2, p.x2 - p.w2, y2);
  // dashed lane dividers
  if (bright) {
    ctx.fillStyle = "rgba(165,243,252,0.85)";
    laneMarker(ctx, p, -1 / 3);
    laneMarker(ctx, p, 1 / 3);
  }
}

function drawTrafficCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  yBase: number,
  w: number,
  color: string,
) {
  const h = w * 0.5;
  ctx.save();
  ctx.translate(x, yBase);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(w / 2, 0, w * 0.52, Math.max(1, h * 0.14), 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(0, -h, w, h, Math.max(1.5, w * 0.08));
  ctx.fill();
  ctx.fillStyle = "rgba(10,6,26,0.85)";
  ctx.beginPath();
  ctx.roundRect(w * 0.2, -h * 1.3, w * 0.54, h * 0.42, Math.max(1, w * 0.05));
  ctx.fill();
  const lightW = Math.max(1, w * 0.1);
  const lightH = Math.max(1, h * 0.2);
  ctx.fillStyle = "#fb7185";
  ctx.shadowColor = "#f43f5e";
  ctx.shadowBlur = Math.min(14, w * 0.25);
  ctx.fillRect(w * 0.04, -h * 0.74, lightW, lightH);
  ctx.fillRect(w * 0.04, -h * 0.32, lightW, lightH);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawPlayerCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lean: number,
  t: number,
) {
  const w = 152;
  const h = 50;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 0.008) * 1.3);
  ctx.rotate(lean * 0.05);
  // neon underglow
  ctx.globalAlpha = 0.55 + Math.sin(t * 0.012) * 0.15;
  const ug = ctx.createLinearGradient(0, -4, 0, 18);
  ug.addColorStop(0, "rgba(232,121,249,0.55)");
  ug.addColorStop(1, "rgba(232,121,249,0)");
  ctx.fillStyle = ug;
  ctx.fillRect(-w * 0.62, 0, w * 1.24, 20);
  ctx.globalAlpha = 1;
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.ellipse(0, 6, w * 0.55, 9, 0, 0, TAU);
  ctx.fill();
  // wheels
  ctx.fillStyle = "#0a0616";
  ctx.fillRect(-w * 0.5, -14, 18, 20);
  ctx.fillRect(w * 0.5 - 18, -14, 18, 20);
  // body
  ctx.fillStyle = "#31215e";
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h, w, h, 11);
  ctx.fill();
  ctx.fillStyle = "#4c1d95";
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 5, -h + 5, w - 10, h * 0.42, 8);
  ctx.fill();
  // neon trim
  ctx.strokeStyle = "rgba(34,211,238,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h, w, h, 11);
  ctx.stroke();
  // canopy
  ctx.fillStyle = "rgba(8,4,20,0.9)";
  ctx.beginPath();
  ctx.roundRect(-30, -h - 16, 60, 20, 7);
  ctx.fill();
  // spoiler
  ctx.fillStyle = "#22d3ee";
  ctx.fillRect(-w * 0.48, -h - 8, 10, 8);
  ctx.fillRect(w * 0.48 - 10, -h - 8, 10, 8);
  // full-width tail bar
  ctx.fillStyle = "#f43f5e";
  ctx.shadowColor = "#f43f5e";
  ctx.shadowBlur = 16;
  ctx.fillRect(-w * 0.42, -13, w * 0.84, 6);
  ctx.shadowBlur = 0;
  ctx.restore();
}

/* ---------------- component ---------------- */

export default function NightOutrun() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<G | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("night-outrun", "high");
  const inputRef = useRef({ left: false, right: false });

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const horizon = H / 2;

    /* sky */
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#04010d");
    sky.addColorStop(0.62, "#140a2e");
    sky.addColorStop(1, "#3a1058");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon + 2);

    /* stars */
    for (const s of STARS) {
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(time * 0.001 * s.sp + s.ph));
      ctx.fillStyle = "#e9d5ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.rr, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* moon */
    ctx.save();
    ctx.shadowColor = "#c4b5fd";
    ctx.shadowBlur = 26;
    ctx.fillStyle = "#f5f3ff";
    ctx.beginPath();
    ctx.arc(W * 0.79, 56, 14, 0, TAU);
    ctx.fill();
    ctx.restore();

    /* city glow + skyline */
    const glow = ctx.createLinearGradient(0, horizon - 96, 0, horizon);
    glow.addColorStop(0, "rgba(244,114,182,0)");
    glow.addColorStop(1, "rgba(217,70,239,0.32)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizon - 96, W, 96);
    for (let i = 0; i < CITY.length; i++) {
      const b = CITY[i];
      ctx.fillStyle = "#0d0620";
      ctx.fillRect(b.x, horizon - b.h, b.w, b.h);
      for (let wi = 0; wi < b.lit; wi++) {
        const wx = b.x + 3 + ((wi * 37 + i * 13) % Math.max(4, Math.floor(b.w) - 6));
        const wy = horizon - b.h + 4 + ((wi * 53 + i * 7) % Math.max(6, Math.floor(b.h) - 8));
        ctx.fillStyle = wi % 2 ? "rgba(250,204,21,0.65)" : "rgba(56,189,248,0.55)";
        ctx.fillRect(wx, wy, 2.4, 3);
      }
    }

    /* world (with crash shake) */
    const sx = Math.sin(time * 0.0092) * g.shake;
    const sy = Math.cos(time * 0.0113) * g.shake;
    ctx.save();
    ctx.translate(sx, sy);

    /* road segments */
    const baseIdx = Math.floor(g.pos / SEG_LEN) % N_SEGS;
    const basePct = (g.pos % SEG_LEN) / SEG_LEN;
    let xOff = 0;
    let dx = -TRACK[baseIdx].curve * basePct;
    let maxY = H;
    for (const q of g.proj) q.ok = false;
    const edgeL: { x: number; y: number }[] = [];
    const edgeR: { x: number; y: number }[] = [];

    for (let n = 0; n < DRAW; n++) {
      const idx = baseIdx + n;
      const seg = TRACK[idx % N_SEGS];
      const looped = idx >= N_SEGS;
      const camZ = g.pos - (looped ? TRACK_LEN : 0);
      const p = g.proj[n];
      const camX = g.playerX * ROAD_W - xOff;
      projectInto(p, 1, seg.y1, idx * SEG_LEN, camX, camZ);
      projectInto(p, 2, seg.y2, (idx + 1) * SEG_LEN, camX - dx, camZ);
      xOff += dx;
      dx += seg.curve;
      if (p.y2 >= maxY) continue;
      p.ok = true;
      maxY = p.y2;
      renderBand(ctx, p, Math.floor(idx / 3) % 2 === 0);
      edgeL.push({ x: p.x1 - p.w1, y: p.y1 }, { x: p.x2 - p.w2, y: p.y2 });
      edgeR.push({ x: p.x1 + p.w1, y: p.y1 }, { x: p.x2 + p.w2, y: p.y2 });
    }

    /* neon edge glow */
    if (edgeL.length > 3) {
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = "rgba(244,114,182,0.55)";
      ctx.shadowColor = "#e879f9";
      ctx.beginPath();
      ctx.moveTo(edgeL[0].x, edgeL[0].y);
      for (const pt of edgeL) ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.strokeStyle = "rgba(103,232,249,0.5)";
      ctx.shadowColor = "#22d3ee";
      ctx.beginPath();
      ctx.moveTo(edgeR[0].x, edgeR[0].y);
      for (const pt of edgeR) ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.restore();
    }

    /* distance haze over the far road */
    const fog = ctx.createLinearGradient(0, horizon - 4, 0, horizon + 120);
    fog.addColorStop(0, "rgba(20,8,44,0.96)");
    fog.addColorStop(1, "rgba(20,8,44,0)");
    ctx.fillStyle = fog;
    ctx.fillRect(-20, horizon - 4, W + 40, 126);

    /* traffic (far → near) */
    g.near.length = 0;
    for (const car of g.cars) {
      const n = Math.floor(car.z / SEG_LEN);
      const slot = ((n % N_SEGS) - baseIdx + N_SEGS) % N_SEGS;
      if (slot >= DRAW) continue;
      const p = g.proj[slot];
      if (!p.ok) continue;
      g.near.push(car);
    }
    g.near.sort((a, b) => b.z - a.z);
    for (const car of g.near) {
      const n = Math.floor(car.z / SEG_LEN);
      const slot = ((n % N_SEGS) - baseIdx + N_SEGS) % N_SEGS;
      const p = g.proj[slot];
      const destW = p.s1 * CAR_W * W * 0.5;
      if (destW < 2.5) continue;
      const destX = p.x1 + p.w1 * car.offset - destW / 2;
      drawTrafficCar(ctx, destX, p.y1, destW, TRAFFIC_COLORS[car.hue]);
    }

    /* speed streaks */
    const sp = g.speed / MAX_V;
    if (sp > 0.55 && status === "playing") {
      ctx.globalAlpha = Math.min(0.4, (sp - 0.55) * 0.9);
      ctx.strokeStyle = "#e9d5ff";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        const yy = horizon + 24 + ((i * 53 + g.pos * 0.3) % (H - horizon - 24));
        const left = i % 2 === 0;
        const x0 = left ? 16 : W - 16;
        const len = 50 + ((i * 29) % 46);
        ctx.beginPath();
        ctx.moveTo(x0, yy);
        ctx.lineTo(x0 + (left ? len : -len), yy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    /* particles */
    for (const pt of g.parts) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.c;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* player */
    drawPlayerCar(ctx, W / 2 + g.playerX * -14, H - 58, inputRef.current.left ? -1 : inputRef.current.right ? 1 : 0, time);

    ctx.restore();

    /* speedometer */
    const kmh = Math.round(sp * 312);
    const gear = g.speed < BASE_V * 1.7 ? 1 : g.speed < BASE_V * 2.9 ? 2 : g.speed < MAX_V * 0.86 ? 3 : 4;
    ctx.textAlign = "right";
    ctx.font = "bold 26px ui-monospace, monospace";
    ctx.fillStyle = "#f0abfc";
    ctx.shadowColor = "#d946ef";
    ctx.shadowBlur = 10;
    ctx.fillText(String(kmh), W - 16, H - 26);
    ctx.shadowBlur = 0;
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillStyle = "#9aa4bd";
    ctx.fillText(`KM/H · G${gear}`, W - 16, H - 14);
    ctx.textAlign = "left";

    /* toast */
    if (g.toastT > 0) {
      const a = Math.min(1, g.toastT * 2);
      ctx.globalAlpha = a;
      ctx.font = "bold 20px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fde68a";
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 16;
      ctx.fillText(g.toast, W / 2, 78 - (1 - a) * 12);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    }

    /* crash flash */
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(244,63,94,${Math.min(0.55, g.flash * 0.55)})`;
      ctx.fillRect(0, 0, W, H);
      if (!g.alive) {
        ctx.font = "52px serif";
        ctx.textAlign = "center";
        ctx.fillText("💥", W / 2, H / 2);
        ctx.textAlign = "left";
      }
    }
  }, [status]);

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

  const gameOver = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;
    g.alive = false;
    g.shake = 20;
    g.flash = 1;
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * TAU;
      const s = 60 + Math.random() * 270;
      g.parts.push({
        x: W / 2 + g.playerX * -14,
        y: H - 66,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 60,
        life: 0.7 + Math.random() * 0.6,
        max: 1.3,
        c: i % 3 === 0 ? "#fbbf24" : "#f472b6",
        r: 2 + Math.random() * 3.5,
      });
    }
    const final = Math.floor(g.pos / 20) + g.bonus;
    setScore(final);
    setNewBest(submit(final));
    setStatus("over");
    draw(performance.now());
  }, [draw, submit]);

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  // main loop — all mutable game logic runs inline here (react-compiler safe)
  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      const frame = Math.min(t - last, 250);
      last = t;
      acc += frame;
      while (acc >= STEP) {
        acc -= STEP;
        const g = gameRef.current;
        if (!g || !g.alive) break;
        const dt = STEP / 1000;
        const k = inputRef.current;

        /* speed creep toward a cap that grows with distance */
        const cap = MAX_V * (1 + Math.min(0.35, ((g.pos / 20) / 34000) * 0.35));
        g.speed += 24 * dt;
        if (g.speed > cap) g.speed = cap;

        /* steering */
        const steer = (k.right ? 1 : 0) - (k.left ? 1 : 0);
        const sp = g.speed / MAX_V;
        g.playerX += steer * (0.95 + 0.7 * sp) * dt;

        /* centrifugal drift on curves */
        const baseIdx = Math.floor(g.pos / SEG_LEN) % N_SEGS;
        g.playerX -= TRACK[baseIdx].curve * sp * sp * 0.5 * dt;

        /* rumble drag off the road */
        if (Math.abs(g.playerX) > 1) {
          g.speed -= g.speed * 1.1 * dt;
          if (g.speed < BASE_V * 0.4) g.speed = BASE_V * 0.4;
          g.shake = Math.max(g.shake, 3.5);
          if (Math.random() < 0.5) {
            g.parts.push({
              x: W / 2 + g.playerX * -22 + (Math.random() - 0.5) * 30,
              y: H - 44,
              vx: (Math.random() - 0.5) * 60,
              vy: -30 - Math.random() * 40,
              life: 0.4,
              max: 0.4,
              c: "rgba(232,121,249,0.7)",
              r: 1.5 + Math.random() * 2,
            });
          }
        }
        if (Math.abs(g.playerX) > 1.5) g.playerX = Math.sign(g.playerX) * 1.5;

        g.pos += g.speed * dt;

        /* traffic: move, recycle, score, collide */
        const pz = g.pos + PLAYER_Z;
        for (const car of g.cars) {
          car.z += car.speed * dt;
          if (car.z < g.pos - 900) {
            car.z = g.pos + (DRAW - 10) * SEG_LEN * (0.5 + Math.random() * 0.55);
            car.offset =
              LANES[Math.floor(Math.random() * 3)] + (Math.random() - 0.5) * 0.05;
            car.speed = BASE_V * (0.4 + Math.random() * 0.55);
            car.hue = Math.floor(Math.random() * TRAFFIC_COLORS.length);
            car.scored = false;
            car.minLat = 9;
          }
          const dz = car.z - pz;
          const lat = Math.abs(g.playerX - car.offset);
          if (!car.scored && dz < -350) {
            car.scored = true;
            if (car.minLat < 0.42) {
              g.bonus += 30;
              g.toast = "NEAR MISS +30";
              g.toastT = 1.1;
            } else {
              g.bonus += 8;
            }
          }
          if (Math.abs(dz) < 1100 && lat < car.minLat) car.minLat = lat;
          if (Math.abs(dz) < 340 && lat < 0.2) {
            gameOver();
            break;
          }
        }
        if (!g.alive) break;

        /* density + milestones */
        const meters = g.pos / 20;
        if (meters > g.nextCarM && g.cars.length < 28) {
          g.nextCarM += 750;
          g.cars.push({
            z: g.pos + (DRAW - 12) * SEG_LEN,
            offset: LANES[Math.floor(Math.random() * 3)] + (Math.random() - 0.5) * 0.05,
            speed: BASE_V * (0.4 + Math.random() * 0.55),
            hue: Math.floor(Math.random() * TRAFFIC_COLORS.length),
            scored: false,
            minLat: 9,
          });
        }
        if (meters > g.nextKm) {
          g.bonus += 50;
          g.nextKm += 1000;
          g.toast = "1 KM  +50";
          g.toastT = 1.4;
          g.shake = Math.max(g.shake, 4);
        }

        /* particles + decay */
        for (const p of g.parts) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 120 * dt;
          p.life -= dt;
        }
        if (g.parts.length > 160) g.parts.splice(0, g.parts.length - 160);
        g.parts = g.parts.filter((p) => p.life > 0);
        g.shake = Math.max(0, g.shake - 0.5);
        g.flash = Math.max(0, g.flash - dt * 1.8);
        g.toastT = Math.max(0, g.toastT - dt);

        /* throttled HUD sync */
        g.hudAcc += STEP;
        if (g.hudAcc >= 90) {
          g.hudAcc = 0;
          const s = Math.floor(meters) + g.bonus;
          if (s !== g.lastScore) {
            g.lastScore = s;
            setScore(s);
          }
        }
      }
      draw(t);
      const g = gameRef.current;
      if (g && !g.alive) return;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, gameOver]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const set = (code: string, v: boolean) => {
      const k = inputRef.current;
      if (code === "ArrowLeft" || code === "KeyA") k.left = v;
      if (code === "ArrowRight" || code === "KeyD") k.right = v;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === "Space" || e.code === "Enter") {
        if (status !== "playing") start();
        return;
      }
      set(e.code, true);
    };
    const onKeyUp = (e: KeyboardEvent) => set(e.code, false);
    const onBlur = () => {
      inputRef.current.left = false;
      inputRef.current.right = false;
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

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const left = e.clientX - rect.left < rect.width / 2;
    inputRef.current.left = left;
    inputRef.current.right = !left;
  };
  const clearPointer = () => {
    inputRef.current.left = false;
    inputRef.current.right = false;
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[680px]">
      <GameHud score={score} best={best ?? "—"} />

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(217,70,239,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerUp={clearPointer}
          onPointerCancel={clearPointer}
          onPointerLeave={clearPointer}
          aria-label="Night Outrun neon highway"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">NIGHT OUTRUN</p>
            <p className="mt-2 text-sm text-muted">
              No headlights, no mercy — just neon lanes and traffic you can&apos;t see
              coming. Thread the gaps, graze bumpers for near-miss bonus, and see how far
              the horizon lets you run.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-fuchsia-500 via-purple-500 to-indigo-600"
            >
              Start engine
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ← → / A D steer · touch left / right half · speed climbs on its own
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">WRECKED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {score} m · Best {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-fuchsia-500 via-purple-500 to-indigo-600"
            >
              Run it back
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Near overtakes pay +30 · every kilometre banks +50 · the rumble strip bleeds speed
      </p>
    </div>
  );
}
