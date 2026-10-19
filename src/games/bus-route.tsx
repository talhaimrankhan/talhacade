"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 640;
const H = 480;
const STEP = 1000 / 60;
const HW = 26; // road half-width
const R = 16; // bus radius
const TAU = Math.PI * 2;

const V_ROADS = [70, 190, 320, 450, 570];
const H_ROADS = [60, 170, 290, 400];

type Status = "idle" | "playing" | "over";
type Axis = "h" | "v";
type Pt = { x: number; y: number };
interface Stop {
  x: number;
  y: number;
  axis: Axis;
}
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Car {
  x: number;
  y: number;
  a: number;
  v: number;
  axis: Axis;
  dir: number;
  color: string;
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
  x: number;
  y: number;
  a: number;
  v: number;
  score: number;
  combo: number;
  schedule: number;
  hearts: number;
  stopsDone: number;
  lastIdx: number;
  nextIdx: number;
  route: Pt[];
  dockT: number;
  cars: Car[];
  parts: Part[];
  shake: number;
  flash: number;
  toast: string;
  toastT: number;
  hitCd: number;
  alive: boolean;
}

/* ---------------- city ---------------- */

const STOPS: Stop[] = [
  { x: 130, y: 60, axis: "h" },
  { x: 385, y: 60, axis: "h" },
  { x: 510, y: 60, axis: "h" },
  { x: 115, y: 170, axis: "h" },
  { x: 255, y: 170, axis: "h" },
  { x: 505, y: 170, axis: "h" },
  { x: 135, y: 290, axis: "h" },
  { x: 385, y: 290, axis: "h" },
  { x: 515, y: 290, axis: "h" },
  { x: 110, y: 400, axis: "h" },
  { x: 255, y: 400, axis: "h" },
  { x: 400, y: 400, axis: "h" },
  { x: 70, y: 120, axis: "v" },
  { x: 70, y: 345, axis: "v" },
  { x: 190, y: 115, axis: "v" },
  { x: 190, y: 345, axis: "v" },
  { x: 320, y: 115, axis: "v" },
  { x: 320, y: 235, axis: "v" },
  { x: 320, y: 345, axis: "v" },
  { x: 450, y: 115, axis: "v" },
  { x: 450, y: 345, axis: "v" },
  { x: 570, y: 120, axis: "v" },
  { x: 570, y: 235, axis: "v" },
  { x: 570, y: 345, axis: "v" },
];

function buildBlocks(): Rect[] {
  const xs: [number, number][] = [];
  let prev = 0;
  for (const r of V_ROADS) {
    xs.push([prev, r - HW]);
    prev = r + HW;
  }
  xs.push([prev, W]);
  const ys: [number, number][] = [];
  prev = 0;
  for (const r of H_ROADS) {
    ys.push([prev, r - HW]);
    prev = r + HW;
  }
  ys.push([prev, H]);
  const out: Rect[] = [];
  for (const [x0, x1] of xs) {
    for (const [y0, y1] of ys) {
      const x = x0 + 7;
      const y = y0 + 7;
      const w = x1 - x0 - 14;
      const h = y1 - y0 - 14;
      if (w > 16 && h > 16) out.push({ x, y, w, h });
    }
  }
  return out;
}

const BLOCKS = buildBlocks();

function nearestV(x: number): number {
  return V_ROADS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
}
function nearestH(y: number): number {
  return H_ROADS.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
}

/** Manhattan path that always stays on the road grid. */
function routePath(a: Stop, b: Stop): Pt[] {
  if (a.axis === "h" && b.axis === "h") {
    const vx = nearestV((a.x + b.x) / 2);
    return [
      { x: a.x, y: a.y },
      { x: vx, y: a.y },
      { x: vx, y: b.y },
      { x: b.x, y: b.y },
    ];
  }
  if (a.axis === "v" && b.axis === "v") {
    const hy = nearestH((a.y + b.y) / 2);
    return [
      { x: a.x, y: a.y },
      { x: a.x, y: hy },
      { x: b.x, y: hy },
      { x: b.x, y: b.y },
    ];
  }
  if (a.axis === "h") {
    return [
      { x: a.x, y: a.y },
      { x: b.x, y: a.y },
      { x: b.x, y: b.y },
    ];
  }
  return [
    { x: a.x, y: a.y },
    { x: a.x, y: b.y },
    { x: b.x, y: b.y },
  ];
}

function pickNext(last: number): number {
  const far = STOPS.map((_, i) => i).filter(
    (i) =>
      i !== last &&
      Math.hypot(STOPS[i].x - STOPS[last].x, STOPS[i].y - STOPS[last].y) > 170,
  );
  const pool = far.length ? far : STOPS.map((_, i) => i).filter((i) => i !== last);
  return pool[Math.floor(Math.random() * pool.length)] ?? last;
}

const TRAFFIC_COLORS = ["#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#fb7185", "#facc15"];

function spawnCar(g: G): void {
  const vertical = Math.random() < 0.5;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const color = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)] ?? "#38bdf8";
  const v = 42 + Math.random() * 46;
  if (vertical) {
    const road = V_ROADS[Math.floor(Math.random() * V_ROADS.length)] ?? V_ROADS[0];
    g.cars.push({
      x: road - dir * 9,
      y: dir > 0 ? -50 : H + 50,
      a: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      v,
      axis: "v",
      dir,
      color,
    });
  } else {
    const road = H_ROADS[Math.floor(Math.random() * H_ROADS.length)] ?? H_ROADS[0];
    g.cars.push({
      x: dir > 0 ? -50 : W + 50,
      y: road + dir * 9,
      a: dir > 0 ? 0 : Math.PI,
      v,
      axis: "h",
      dir,
      color,
    });
  }
}

function createGame(): G {
  const lastIdx = 11;
  const nextIdx = 4;
  return {
    x: 434,
    y: 400,
    a: Math.PI,
    v: 0,
    score: 0,
    combo: 1,
    schedule: 100,
    hearts: 3,
    stopsDone: 0,
    lastIdx,
    nextIdx,
    route: routePath(STOPS[lastIdx], STOPS[nextIdx]),
    dockT: 0,
    cars: [],
    parts: [],
    shake: 0,
    flash: 0,
    toast: "",
    toastT: 0,
    hitCd: 0,
    alive: true,
  };
}

function burst(g: G, x: number, y: number, n: number, c: string, spread: number): void {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * TAU;
    const s = spread * (0.3 + Math.random() * 0.8);
    g.parts.push({
      x,
      y,
      vx: Math.cos(ang) * s,
      vy: Math.sin(ang) * s,
      life: 0.5 + Math.random() * 0.5,
      max: 1,
      c,
      r: 1.5 + Math.random() * 3,
    });
  }
}

/** Circle vs building rect → pushes the bus out. Returns true on contact. */
function bumpBlocks(g: G): boolean {
  for (const b of BLOCKS) {
    const cx = Math.max(b.x, Math.min(g.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(g.y, b.y + b.h));
    let dx = g.x - cx;
    let dy = g.y - cy;
    let d = Math.hypot(dx, dy);
    if (d >= R) continue;
    if (d < 0.001) {
      dx = g.x - (b.x + b.w / 2);
      dy = g.y - (b.y + b.h / 2);
      d = Math.hypot(dx, dy) || 1;
    }
    g.x += (dx / d) * (R - d);
    g.y += (dy / d) * (R - d);
    g.v *= 0.25;
    return true;
  }
  return false;
}

export default function BusRoute() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<G | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [hearts, setHearts] = useState(3);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("bus-route", "high");
  const inputRef = useRef({ up: false, down: false, left: false, right: false });
  const lastScore = useRef(0);
  const lastCombo = useRef(1);
  const lastHearts = useRef(3);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const sx = (Math.random() - 0.5) * g.shake;
    const sy = (Math.random() - 0.5) * g.shake;

    // sidewalk base
    ctx.fillStyle = "#12121c";
    ctx.fillRect(-20, -20, W + 40, H + 40);

    ctx.save();
    ctx.translate(sx, sy);

    // roads
    ctx.fillStyle = "#242433";
    for (const x of V_ROADS) ctx.fillRect(x - HW, -20, HW * 2, H + 40);
    for (const y of H_ROADS) ctx.fillRect(-20, y - HW, W + 40, HW * 2);

    // centre dashes
    ctx.strokeStyle = "rgba(250,204,21,0.32)";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 16]);
    ctx.beginPath();
    for (const x of V_ROADS) {
      ctx.moveTo(x, -20);
      ctx.lineTo(x, H + 20);
    }
    for (const y of H_ROADS) {
      ctx.moveTo(-20, y);
      ctx.lineTo(W + 20, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // crosswalks
    ctx.fillStyle = "rgba(226,232,240,0.22)";
    for (const x of V_ROADS) {
      for (const y of H_ROADS) {
        for (let i = -2; i <= 2; i++) {
          ctx.fillRect(x + i * 7 - 2, y - HW - 8, 4, 6);
          ctx.fillRect(x + i * 7 - 2, y + HW + 2, 4, 6);
        }
      }
    }

    // buildings
    for (let i = 0; i < BLOCKS.length; i++) {
      const b = BLOCKS[i];
      ctx.fillStyle = "#0b0b13";
      ctx.beginPath();
      ctx.roundRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6, 7);
      ctx.fill();
      ctx.fillStyle = i % 3 === 0 ? "#1c1c2e" : i % 3 === 1 ? "#18182a" : "#201c2c";
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 5);
      ctx.fill();
      ctx.strokeStyle = "rgba(148,163,184,0.14)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const cols = Math.max(1, Math.floor(b.w / 15));
      const rows = Math.max(1, Math.floor(b.h / 15));
      const cw = b.w / cols;
      const ch = b.h / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const h = (i * 37 + r * 17 + c * 53) % 11;
          if (h > 5) continue;
          ctx.fillStyle = h % 2 === 0 ? "rgba(251,191,36,0.55)" : "rgba(56,189,248,0.45)";
          ctx.fillRect(b.x + c * cw + 3, b.y + r * ch + 3, cw - 6, ch - 6);
        }
      }
    }

    // highlighted route line
    if (g.route.length > 1) {
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(g.route[0].x, g.route[0].y);
      for (let i = 1; i < g.route.length; i++) ctx.lineTo(g.route[i].x, g.route[i].y);
      ctx.strokeStyle = "rgba(251,191,36,0.16)";
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 12;
      ctx.setLineDash([15, 12]);
      ctx.lineDashOffset = -(time / 26) % 27;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // stops
    for (let i = 0; i < STOPS.length; i++) {
      const s = STOPS[i];
      const next = i === g.nextIdx;
      const pulse = next ? Math.sin(time / 230) * 3 : 0;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 24 + pulse, 0, TAU);
      ctx.fillStyle = next ? "rgba(52,211,153,0.16)" : "rgba(148,163,184,0.06)";
      ctx.fill();
      ctx.setLineDash([6, 7]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = next ? "#34d399" : "rgba(148,163,184,0.35)";
      ctx.stroke();
      ctx.setLineDash([]);
      if (next) {
        ctx.font = "bold 9px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#6ee7b7";
        ctx.fillText("NEXT STOP", s.x, s.y - 33);
      }
    }

    // boarding passengers
    if (g.dockT > 0) {
      const stop = STOPS[g.nextIdx];
      const p = 1 - g.dockT / 1.5;
      for (let i = 0; i < 5; i++) {
        const t = Math.max(0, Math.min(1, (p - i * 0.16) * 3));
        if (t <= 0) continue;
        const ang = -Math.PI / 2 + i * 1.1;
        const ox = stop.x + Math.cos(ang) * 30;
        const oy = stop.y + Math.sin(ang) * 30;
        ctx.fillStyle = `rgba(226,232,240,${0.35 + t * 0.65})`;
        ctx.beginPath();
        ctx.arc(ox + (g.x - ox) * t, oy + (g.y - oy) * t, 3.4, 0, TAU);
        ctx.fill();
      }
    }

    // traffic
    for (const c of g.cars) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.a);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(2, 3, 17, 11, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.roundRect(-15, -9, 30, 18, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(11,11,22,0.6)";
      ctx.beginPath();
      ctx.roundRect(4, -7, 7, 14, 3);
      ctx.fill();
      ctx.fillStyle = "#fef9c3";
      ctx.fillRect(13, -7, 2, 4);
      ctx.fillRect(13, 3, 2, 4);
      ctx.fillStyle = "#f87171";
      ctx.fillRect(-15, -7, 2, 4);
      ctx.fillRect(-15, 3, 2, 4);
      ctx.restore();
    }

    // particles
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // bus
    ctx.save();
    ctx.translate(g.x + 3, g.y + 4);
    ctx.rotate(g.a);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.roundRect(-22, -13, 44, 26, 8);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.a);
    // wheels
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(-15, -15, 11, 5);
    ctx.fillRect(-15, 10, 11, 5);
    ctx.fillRect(7, -15, 11, 5);
    ctx.fillRect(7, 10, 11, 5);
    // body
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.roundRect(-22, -13, 44, 26, 8);
    ctx.fill();
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.roundRect(-20, -11, 36, 22, 6);
    ctx.fill();
    // windows
    ctx.fillStyle = "rgba(15,23,42,0.82)";
    ctx.beginPath();
    ctx.roundRect(-17, -11, 22, 5, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-17, 6, 22, 5, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(6, -9, 6, 18, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-21, -8, 4, 16, 2);
    ctx.fill();
    // headlights
    ctx.fillStyle = "#fef3c7";
    ctx.fillRect(20, -10, 3, 5);
    ctx.fillRect(20, 5, 3, 5);
    // doors
    ctx.fillStyle = g.dockT > 0 ? "#34d399" : "rgba(15,23,42,0.55)";
    ctx.beginPath();
    ctx.roundRect(-2, -14, 12, 4, 2);
    ctx.fill();
    ctx.restore();

    // docking progress ring
    if (g.dockT > 0) {
      const p = 1 - g.dockT / 1.5;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 32, -Math.PI / 2, -Math.PI / 2 + TAU * p);
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.shadowColor = "#34d399";
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = "bold 11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#6ee7b7";
      ctx.fillText("BOARDING", g.x, g.y - 40);
    }

    ctx.restore();

    // schedule bar
    const bw = 200;
    const bx = 16;
    const by = 26;
    ctx.fillStyle = "rgba(6,6,12,0.75)";
    ctx.beginPath();
    ctx.roundRect(bx - 8, by - 20, bw + 16, 38, 9);
    ctx.fill();
    ctx.font = "bold 9px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#9aa4bd";
    ctx.fillText("SCHEDULE", bx, by - 7);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, 11, 5);
    ctx.fill();
    const pct = Math.max(0, Math.min(1, g.schedule / 100));
    if (pct > 0) {
      const col = pct > 0.5 ? "#34d399" : pct > 0.25 ? "#fbbf24" : "#fb7185";
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw * pct, 11, 5);
      ctx.fill();
      if (pct <= 0.25) {
        ctx.fillStyle = `rgba(244,63,94,${0.25 + Math.sin(time / 120) * 0.2})`;
        ctx.fillRect(0, 0, W, 4);
        ctx.fillRect(0, H - 4, W, 4);
      }
    }
    ctx.font = "bold 10px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = "#9aa4bd";
    ctx.fillText(`STOP ${g.stopsDone}`, bx + bw + 52, by + 9);
    ctx.textAlign = "left";

    // toast
    if (g.toastT > 0) {
      const a = Math.min(1, g.toastT * 2);
      ctx.globalAlpha = a;
      ctx.font = "bold 20px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fde68a";
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 16;
      ctx.fillText(g.toast, W / 2, 76 - (1 - a) * 14);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    }

    // crash flash
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(244,63,94,${Math.min(0.6, g.flash)})`;
      ctx.fillRect(0, 0, W, H);
      if (!g.alive) {
        ctx.font = "52px serif";
        ctx.textAlign = "center";
        ctx.fillText("💥", W / 2, H / 2);
        ctx.textAlign = "left";
      }
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

  const gameOver = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.alive = false;
    g.shake = 14;
    g.flash = 0.9;
    burst(g, g.x, g.y, 26, "#fb7185", 240);
    setScore(g.score);
    setNewBest(submit(g.score));
    setStatus("over");
    draw(performance.now());
  }, [draw, submit]);

  const step = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;
    const dt = STEP / 1000;
    const k = inputRef.current;

    // driving
    if (k.up) g.v += 300 * dt;
    else if (k.down) g.v -= 340 * dt;
    else if (g.v !== 0) g.v -= Math.sign(g.v) * Math.min(Math.abs(g.v), 120 * dt);
    g.v = Math.max(-70, Math.min(180, g.v));
    const turn = 2.7 * Math.min(1, Math.abs(g.v) / 70) * (g.v < 0 ? -1 : 1);
    if (k.left) g.a -= turn * dt;
    if (k.right) g.a += turn * dt;

    g.x += Math.cos(g.a) * g.v * dt;
    g.y += Math.sin(g.a) * g.v * dt;

    // city bounds + buildings
    const bx = Math.max(R + 3, Math.min(W - R - 3, g.x));
    const by = Math.max(R + 3, Math.min(H - R - 3, g.y));
    if (bx !== g.x || by !== g.y) {
      g.x = bx;
      g.y = by;
      g.v *= 0.4;
    }
    if (bumpBlocks(g) && Math.abs(g.v) > 60) {
      g.shake = Math.max(g.shake, 7);
      burst(g, g.x, g.y, 5, "#fbbf24", 90);
    }

    // traffic
    for (let i = 0; i < g.cars.length; i++) {
      const c = g.cars[i];
      if (c.axis === "v") {
        c.y += c.v * c.dir * dt;
        if (c.dir > 0 && c.y > H + 70) c.y = -70;
        if (c.dir < 0 && c.y < -70) c.y = H + 70;
      } else {
        c.x += c.v * c.dir * dt;
        if (c.dir > 0 && c.x > W + 70) c.x = -70;
        if (c.dir < 0 && c.x < -70) c.x = W + 70;
      }
      const d = Math.hypot(c.x - g.x, c.y - g.y);
      if (d < R + 15) {
        const nx = (g.x - c.x) / (d || 1);
        const ny = (g.y - c.y) / (d || 1);
        g.x += nx * (R + 15 - d);
        g.y += ny * (R + 15 - d);
        g.v *= 0.35;
        if (g.hitCd <= 0) {
          g.hitCd = 1;
          g.schedule = Math.max(0, g.schedule - 6);
          g.shake = Math.max(g.shake, 9);
          g.toast = "WATCH IT!";
          g.toastT = 1;
          burst(g, g.x, g.y, 10, "#fb7185", 150);
        }
      }
    }

    // boarding
    const stop = STOPS[g.nextIdx];
    const dist = Math.hypot(stop.x - g.x, stop.y - g.y);
    if (g.dockT > 0) {
      g.v *= 1 - 6 * dt;
      if (dist > 40) {
        g.dockT = 0;
        g.toast = "DOORS SHUT — MOVE!";
        g.toastT = 1.2;
      } else {
        g.dockT -= dt;
        if (Math.random() < 0.4) {
          g.parts.push({
            x: g.x + (Math.random() - 0.5) * 30,
            y: g.y + (Math.random() - 0.5) * 30,
            vx: (Math.random() - 0.5) * 30,
            vy: -20 - Math.random() * 30,
            life: 0.6,
            max: 0.6,
            c: "#6ee7b7",
            r: 2 + Math.random() * 2,
          });
        }
        if (g.dockT <= 0) {
          g.stopsDone += 1;
          g.combo = Math.min(12, g.combo + 1);
          const pts = 100 + g.combo * 30;
          g.score += pts;
          g.schedule = Math.min(100, g.schedule + 18 + g.combo * 1.6);
          g.lastIdx = g.nextIdx;
          g.nextIdx = pickNext(g.lastIdx);
          g.route = routePath(STOPS[g.lastIdx], STOPS[g.nextIdx]);
          g.dockT = 0;
          g.toast = `STOP +${pts}  ×${g.combo}`;
          g.toastT = 1.6;
          g.shake = Math.max(g.shake, 5);
          burst(g, stop.x, stop.y, 18, "#fbbf24", 200);
          burst(g, stop.x, stop.y, 10, "#34d399", 140);
          if (g.stopsDone % 3 === 0 && g.cars.length < 9) spawnCar(g);
        }
      }
    } else if (dist < 30 && Math.abs(g.v) < 55) {
      g.dockT = 1.5;
      g.v = 0;
      g.toast = "DOORS OPEN";
      g.toastT = 1;
      burst(g, stop.x, stop.y, 8, "#34d399", 120);
    }

    // schedule drain
    g.schedule -= (5 + g.stopsDone * 0.45) * dt;
    if (g.schedule <= 0) {
      g.hearts -= 1;
      g.combo = 1;
      g.schedule = 55;
      g.shake = 12;
      g.flash = 0.6;
      g.toast = g.hearts > 0 ? "MISSED SLOT — ♥ LOST" : "ROUTE ABANDONED";
      g.toastT = 1.8;
      burst(g, g.x, g.y, 16, "#fb7185", 220);
      if (g.hearts <= 0) {
        gameOver();
        return;
      }
    }

    // particles + decay
    for (let i = 0; i < g.parts.length; i++) {
      const p = g.parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt;
      p.life -= dt;
    }
    if (g.parts.length > 140) g.parts.splice(0, g.parts.length - 140);
    g.parts = g.parts.filter((p) => p.life > 0);
    g.shake = Math.max(0, g.shake - 0.7);
    g.flash = Math.max(0, g.flash - 0.03);
    g.toastT = Math.max(0, g.toastT - dt);
    g.hitCd = Math.max(0, g.hitCd - dt);

    // exhaust
    if (Math.abs(g.v) > 40 && Math.random() < 0.35) {
      g.parts.push({
        x: g.x - Math.cos(g.a) * 24,
        y: g.y - Math.sin(g.a) * 24,
        vx: -Math.cos(g.a) * 20 + (Math.random() - 0.5) * 20,
        vy: -Math.sin(g.a) * 20 + (Math.random() - 0.5) * 20,
        life: 0.4,
        max: 0.4,
        c: "rgba(148,163,184,0.7)",
        r: 1.5 + Math.random() * 2,
      });
    }

    if (g.score !== lastScore.current) {
      lastScore.current = g.score;
      setScore(g.score);
    }
    if (g.combo !== lastCombo.current) {
      lastCombo.current = g.combo;
      setCombo(g.combo);
    }
    if (g.hearts !== lastHearts.current) {
      lastHearts.current = g.hearts;
      setHearts(g.hearts);
    }
  }, [gameOver]);

  const start = useCallback(() => {
    const g = createGame();
    for (let i = 0; i < 4; i++) spawnCar(g);
    gameRef.current = g;
    inputRef.current = { up: false, down: false, left: false, right: false };
    lastScore.current = 0;
    lastCombo.current = 1;
    lastHearts.current = 3;
    setScore(0);
    setCombo(1);
    setHearts(3);
    setNewBest(false);
    setStatus("playing");
  }, []);

  // main loop
  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      const dt = Math.min(t - last, 250);
      last = t;
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        const g = gameRef.current;
        if (!g || !g.alive) break;
        step();
      }
      draw(t);
      const g = gameRef.current;
      if (g && !g.alive) return;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, step, draw]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const set = (code: string, v: boolean) => {
      const k = inputRef.current;
      if (code === "ArrowUp" || code === "KeyW") k.up = v;
      if (code === "ArrowDown" || code === "KeyS") k.down = v;
      if (code === "ArrowLeft" || code === "KeyA") k.left = v;
      if (code === "ArrowRight" || code === "KeyD") k.right = v;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)
      ) {
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
      inputRef.current = { up: false, down: false, left: false, right: false };
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

  const hold = useCallback((dir: "up" | "down" | "left" | "right", v: boolean) => {
    inputRef.current[dir] = v;
  }, []);

  const dpadBtn =
    "pointer-events-auto flex h-12 w-12 select-none items-center justify-center rounded-xl border border-line bg-surface/75 text-xl font-bold text-ink backdrop-blur active:scale-95 active:bg-surface";

  const pad = (dir: "up" | "down" | "left" | "right", glyph: string, label: string) => (
    <button
      key={dir}
      type="button"
      aria-label={label}
      className={dpadBtn}
      onPointerDown={(e) => {
        e.preventDefault();
        hold(dir, true);
      }}
      onPointerUp={() => hold(dir, false)}
      onPointerCancel={() => hold(dir, false)}
      onPointerLeave={() => hold(dir, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {glyph}
    </button>
  );

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[660px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-rose-400">
          Rides{" "}
          <b className="ml-1 text-sm text-ink">
            {hearts > 0 ? "♥".repeat(hearts) : "—"}
          </b>
        </span>
        <span className="text-warn">
          Combo <b className="ml-1 text-sm text-ink">×{combo}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(245,158,11,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none"
          aria-label="Bus Route city driving game"
        />

        {status === "playing" && (
          <div className="pointer-events-none absolute bottom-3 left-3 grid grid-cols-3 gap-1.5">
            <span />
            {pad("up", "↑", "Accelerate")}
            <span />
            {pad("left", "←", "Steer left")}
            {pad("down", "↓", "Brake")}
            {pad("right", "→", "Steer right")}
          </div>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">BUS ROUTE</p>
            <p className="mt-2 text-sm text-muted">
              Follow the glowing route line, pull into each green stop and hold still
              while the doors are open. Chain on-time stops before the schedule bar
              drains away your last rides.
            </p>
            <PrimaryButton onClick={start} tone="from-amber-400 via-orange-500 to-red-500">
              Start route
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ↑ throttle · ↓ brake · ← → steer · on-screen D-pad on touch
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              ROUTE ABANDONED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {score} pts · {combo > 1 ? `stopped on ×${combo} combo · ` : ""}Best{" "}
              {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-amber-400 via-orange-500 to-red-500">
              Next route
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Doors open for 1.5s — stay inside the green ring · every stop grows the combo ·
        traffic costs schedule
      </p>
    </div>
  );
}
