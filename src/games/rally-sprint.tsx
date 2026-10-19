"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { Overlay, PrimaryButton } from "./parts";

const W = 560;
const H = 420;
const STEP = 1000 / 60;
const STAGES = 4;
const FINISH_S = 26;
const MISS_PENALTY = 5; // seconds per gate you skip

const ACCEL = 360;
const BRAKE = 560;
const TURN = 2.5;
const MAX_ON = 330;
const MAX_OFF = 165;

type Status = "idle" | "playing" | "clear" | "over";

interface Pt {
  x: number;
  y: number;
}

interface Track {
  pts: Pt[];
  cum: number[];
  len: number;
  half: number;
}

interface Gate {
  s: number;
  half: number;
}

interface Prop {
  x: number;
  y: number;
  r: number;
  kind: "tree" | "water";
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

interface World {
  tr: Track;
  gates: Gate[];
  props: Prop[];
  specks: Array<[number, number, number]>;
  par: number;
  worldW: number;
  worldH: number;
}

interface RallyGame {
  stage: number;
  stageStart: number;
  time: number;
  world: World;
  x: number;
  y: number;
  ang: number;
  vx: number;
  vy: number;
  camX: number;
  camY: number;
  hint: number;
  prevS: number;
  gateIdx: number;
  parts: Particle[];
  marks: Array<{ x: number; y: number; life: number }>;
  shake: number;
  flash: number;
  toast: string;
  toastT: number;
  done: boolean;
}

/* ---------------- stage layouts ---------------- */

const STAGE_CTRL: Pt[][] = [
  [
    { x: 200, y: 700 },
    { x: 420, y: 790 },
    { x: 700, y: 760 },
    { x: 960, y: 700 },
    { x: 1150, y: 540 },
    { x: 1180, y: 340 },
    { x: 1000, y: 220 },
    { x: 760, y: 260 },
    { x: 540, y: 220 },
    { x: 320, y: 300 },
    { x: 200, y: 480 },
  ],
  [
    { x: 180, y: 720 },
    { x: 400, y: 800 },
    { x: 640, y: 740 },
    { x: 820, y: 820 },
    { x: 1060, y: 760 },
    { x: 1200, y: 600 },
    { x: 1160, y: 400 },
    { x: 1250, y: 250 },
    { x: 1040, y: 170 },
    { x: 820, y: 240 },
    { x: 640, y: 170 },
    { x: 440, y: 240 },
    { x: 280, y: 170 },
    { x: 170, y: 380 },
  ],
  [
    { x: 170, y: 760 },
    { x: 360, y: 850 },
    { x: 600, y: 790 },
    { x: 730, y: 650 },
    { x: 640, y: 510 },
    { x: 780, y: 400 },
    { x: 990, y: 450 },
    { x: 1130, y: 340 },
    { x: 1180, y: 160 },
    { x: 960, y: 110 },
    { x: 760, y: 180 },
    { x: 560, y: 110 },
    { x: 340, y: 180 },
    { x: 200, y: 330 },
    { x: 245, y: 550 },
  ],
  [
    { x: 160, y: 810 },
    { x: 380, y: 890 },
    { x: 620, y: 830 },
    { x: 760, y: 700 },
    { x: 660, y: 560 },
    { x: 830, y: 470 },
    { x: 1010, y: 545 },
    { x: 1170, y: 470 },
    { x: 1250, y: 300 },
    { x: 1100, y: 175 },
    { x: 900, y: 250 },
    { x: 740, y: 150 },
    { x: 545, y: 225 },
    { x: 375, y: 140 },
    { x: 200, y: 235 },
    { x: 150, y: 480 },
    { x: 235, y: 650 },
  ],
];

const STAGE_HALF = [48, 42, 36, 31];
const STAGE_GATES = [4, 5, 6, 7];
const STAGE_CLEARANCE = [5, 11, 17, 23];

/* ---------------- geometry ---------------- */

function cr(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function buildTrack(ctrl: Pt[], half: number): Track {
  const pts: Pt[] = [];
  const n = ctrl.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(n - 1, i + 2)];
    for (let k = 0; k < 18; k++) pts.push(cr(p0, p1, p2, p3, k / 18));
  }
  pts.push(ctrl[n - 1]);
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return { pts, cum, len: cum[cum.length - 1], half };
}

interface OnTrack {
  i: number;
  s: number;
  lat: number;
  ang: number;
}

function nearest(tr: Track, x: number, y: number, hint: number): OnTrack {
  const n = tr.pts.length;
  let best: OnTrack = { i: 0, s: 0, lat: 0, ang: 0 };
  let bestD = Infinity;
  for (let k = -8; k < 42; k++) {
    const i = Math.max(0, Math.min(n - 2, hint + k));
    const a = tr.pts[i];
    const b = tr.pts[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const l2 = vx * vx + vy * vy || 1;
    let t = ((x - a.x) * vx + (y - a.y) * vy) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + vx * t;
    const py = a.y + vy * t;
    const dx = x - px;
    const dy = y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      const segLen = Math.sqrt(l2);
      bestD = d2;
      best = {
        i,
        s: tr.cum[i] + t * segLen,
        lat: (vx * dy - vy * dx) / segLen,
        ang: Math.atan2(vy, vx),
      };
    }
  }
  return best;
}

function pointAt(tr: Track, s: number): { x: number; y: number; ang: number } {
  const n = tr.pts.length;
  const sv = Math.max(0, Math.min(tr.len, s));
  let i = 0;
  while (i < n - 2 && tr.cum[i + 1] < sv) i += 1;
  const a = tr.pts[i];
  const b = tr.pts[i + 1];
  const segLen = tr.cum[i + 1] - tr.cum[i] || 1;
  const t = (sv - tr.cum[i]) / segLen;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    ang: Math.atan2(b.y - a.y, b.x - a.x),
  };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildWorld(stage: number): World {
  const idx = stage - 1;
  const half = STAGE_HALF[idx] ?? 44;
  const ctrl = STAGE_CTRL[idx] ?? STAGE_CTRL[0];
  const tr = buildTrack(ctrl, half);
  const rand = mulberry32(0x51ed27 ^ (stage * 6151));

  const clearance = STAGE_CLEARANCE[idx] ?? 8;
  const gateCount = STAGE_GATES[idx] ?? 4;
  const gates: Gate[] = [];
  for (let k = 0; k < gateCount; k++) {
    const f = 0.16 + (0.74 * (k + 0.5)) / gateCount;
    gates.push({ s: tr.len * f, half: Math.max(12, half - clearance) });
  }

  const props: Prop[] = [];
  for (let s = 140; s < tr.len - 140; s += 150) {
    if (rand() < 0.55) {
      const side = rand() < 0.5 ? -1 : 1;
      const off = half + 34 + rand() * 76;
      const p = pointAt(tr, s + (rand() - 0.5) * 90);
      props.push({
        x: p.x - Math.sin(p.ang) * side * off,
        y: p.y + Math.cos(p.ang) * side * off,
        r: 13 + rand() * 9,
        kind: "tree",
      });
    }
  }
  const ponds = 2 + (idx > 1 ? 1 : 0);
  for (let k = 0; k < ponds; k++) {
    const p = pointAt(tr, tr.len * (0.22 + 0.6 * (k + rand()) / ponds));
    const side = rand() < 0.5 ? -1 : 1;
    const off = half + 96 + rand() * 50;
    props.push({
      x: p.x - Math.sin(p.ang) * side * off,
      y: p.y + Math.cos(p.ang) * side * off,
      r: 44 + rand() * 30,
      kind: "water",
    });
  }

  const specks: Array<[number, number, number]> = [];
  for (let k = 0; k < 240; k++) {
    const s = rand() * tr.len;
    const lat = (rand() * 2 - 1) * (half - 5);
    const p = pointAt(tr, s);
    specks.push([
      p.x - Math.sin(p.ang) * lat,
      p.y + Math.cos(p.ang) * lat,
      1 + rand() * 2.2,
    ]);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of ctrl) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  const pad = half + 180;
  const worldW = Math.max(W, maxX + pad - (minX - pad));
  const worldH = Math.max(H, maxY + pad - (minY - pad));
  // shift the whole world so nothing sits at negative coordinates
  const offsetX = pad - minX;
  const offsetY = pad - minY;
  for (const p of tr.pts) {
    p.x += offsetX;
    p.y += offsetY;
  }
  for (const pr of props) {
    pr.x += offsetX;
    pr.y += offsetY;
  }
  for (const sp of specks) {
    sp[0] += offsetX;
    sp[1] += offsetY;
  }

  return {
    tr,
    gates,
    props,
    specks,
    par: Math.round((tr.len / 155) * 10) / 10,
    worldW,
    worldH,
  };
}

function createGame(): RallyGame {
  const stage = 1;
  const world = buildWorld(stage);
  const start = pointAt(world.tr, 0);
  return {
    stage,
    stageStart: 0,
    time: 0,
    world,
    x: start.x,
    y: start.y,
    ang: start.ang,
    vx: 0,
    vy: 0,
    camX: 0,
    camY: 0,
    hint: 0,
    prevS: 0,
    gateIdx: 0,
    parts: [],
    marks: [],
    shake: 0,
    flash: 0,
    toast: "",
    toastT: 0,
    done: false,
  };
}

function placeCar(g: RallyGame) {
  const start = pointAt(g.world.tr, 6);
  g.x = start.x;
  g.y = start.y;
  g.ang = start.ang;
  g.vx = 0;
  g.vy = 0;
  g.hint = 0;
  g.prevS = 0;
  g.gateIdx = 0;
  g.camX = Math.max(0, Math.min(g.world.worldW - W, g.x - W / 2));
  g.camY = Math.max(0, Math.min(g.world.worldH - H, g.y - H / 2));
}

function loadStage(g: RallyGame, stage: number) {
  g.stage = stage;
  g.world = buildWorld(stage);
  g.stageStart = g.time;
  g.parts = [];
  g.marks = [];
  g.shake = 0;
  g.flash = 0;
  g.done = false;
  placeCar(g);
}

function burst(g: RallyGame, x: number, y: number, n: number, color: string, spread: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = spread * (0.35 + Math.random() * 0.9);
    g.parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.45 + Math.random() * 0.55,
      max: 1,
      r: 1.5 + Math.random() * 3,
      c: color,
    });
  }
}

const TONE = "from-teal-400 via-cyan-500 to-sky-600";

export default function RallySprint({ gameId = "rally-sprint" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<RallyGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [hudT, setHudT] = useState(0);
  const [stageNo, setStageNo] = useState(1);
  const [gatesPassed, setGatesPassed] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [outcome, setOutcome] = useState<{
    kind: "clear" | "done" | "over-par";
    stage: number;
    stageTime: number;
    total: number;
    par: number;
  }>({ kind: "clear", stage: 1, stageTime: 0, total: 0, par: 0 });
  const { best, submit } = useBestScore(gameId, "low");
  const inputRef = useRef({ up: false, down: false, left: false, right: false });
  const tenthRef = useRef(0);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    const w = g.world;
    const tr = w.tr;
    const camX = Math.max(0, Math.min(w.worldW - W, g.camX));
    const camY = Math.max(0, Math.min(w.worldH - H, g.camY));
    const sx = (Math.random() - 0.5) * g.shake;
    const sy = (Math.random() - 0.5) * g.shake;

    ctx.fillStyle = "#06171a";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-camX + sx, -camY + sy);

    // grass dot grid
    ctx.fillStyle = "rgba(45,212,191,0.10)";
    const gx0 = Math.floor(camX / 72) * 72;
    const gy0 = Math.floor(camY / 72) * 72;
    for (let x = gx0; x < camX + W + 72; x += 72) {
      for (let y = gy0; y < camY + H + 72; y += 72) {
        ctx.fillRect(x, y, 3, 3);
      }
    }

    // ponds
    for (const p of w.props) {
      if (p.kind !== "water") continue;
      if (p.x < camX - p.r - 20 || p.x > camX + W + p.r + 20) continue;
      if (p.y < camY - p.r - 20 || p.y > camY + H + p.r + 20) continue;
      ctx.fillStyle = "rgba(14,116,144,0.75)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(103,232,249,0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = `rgba(165,243,252,${0.25 + Math.sin(time / 500 + p.x) * 0.15})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }

    // dirt road: shoulder → surface → speckles → centre dashes
    const path = new Path2D();
    tr.pts.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#8b7355";
    ctx.lineWidth = tr.half * 2 + 14;
    ctx.stroke(path);
    ctx.strokeStyle = "#2b3038";
    ctx.lineWidth = tr.half * 2;
    ctx.stroke(path);
    ctx.strokeStyle = "rgba(226,232,240,0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 14]);
    ctx.stroke(path);
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,255,255,0.07)";
    for (const [x, y, r] of w.specks) {
      if (x < camX - 10 || x > camX + W + 10 || y < camY - 10 || y > camY + H + 10) continue;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // tyre marks
    for (const m of g.marks) {
      ctx.globalAlpha = Math.max(0, Math.min(0.4, m.life));
      ctx.fillStyle = "#0d1116";
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // start + finish bands
    for (const [s, label] of [
      [0, "START"],
      [tr.len - FINISH_S, "FINISH"],
    ] as Array<[number, string]>) {
      const p = pointAt(tr, s);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.ang);
      for (let r = 0; r < 3; r++) {
        for (let c = -4; c < 4; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? "#f8fafc" : "#0f172a";
          ctx.fillRect(-9 + r * 9, c * (tr.half / 4), 9, tr.half / 4);
        }
      }
      ctx.restore();
      ctx.font = "bold 11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(248,250,252,0.75)";
      ctx.fillText(label, p.x, p.y - tr.half - 12);
    }

    // checkpoint gates
    w.gates.forEach((gate, i) => {
      const p = pointAt(tr, gate.s);
      const nx = -Math.sin(p.ang);
      const ny = Math.cos(p.ang);
      const ax = p.x + nx * gate.half;
      const ay = p.y + ny * gate.half;
      const bx = p.x - nx * gate.half;
      const by = p.y - ny * gate.half;
      const state = i < g.gateIdx ? "done" : i === g.gateIdx ? "next" : "far";
      const color = state === "done" ? "#34d399" : state === "next" ? "#22d3ee" : "#475569";
      ctx.strokeStyle = color;
      ctx.lineWidth = state === "next" ? 5 : 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = state === "next" ? 18 : 6;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ax, ay, 6, 0, Math.PI * 2);
      ctx.arc(bx, by, 6, 0, Math.PI * 2);
      ctx.fill();
      if (state === "next") {
        const pulse = 1 + Math.sin(time / 160) * 0.16;
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - tr.half - 26 * pulse);
        ctx.lineTo(p.x - 9, p.y - tr.half - 44 * pulse);
        ctx.lineTo(p.x + 9, p.y - tr.half - 44 * pulse);
        ctx.closePath();
        ctx.fill();
      }
    });

    // trees
    for (const p of w.props) {
      if (p.kind !== "tree") continue;
      if (p.x < camX - 40 || p.x > camX + W + 40) continue;
      if (p.y < camY - 40 || p.y > camY + H + 40) continue;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(p.x + 4, p.y + 6, p.r, p.r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f5132";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#198754";
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.25, p.y - p.r * 0.3, p.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(187,247,208,0.55)";
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.4, p.r * 0.22, 0, Math.PI * 2);
      ctx.fill();
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

    // car
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(3, 4, 22, 14, g.ang, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(g.ang);
    ctx.fillStyle = "#0b0b12";
    for (const [ox, oy] of [
      [10, -11],
      [10, 11],
      [-11, -11],
      [-11, 11],
    ] as Array<[number, number]>) {
      ctx.beginPath();
      ctx.roundRect(ox - 6, oy - 3, 12, 6, 2);
      ctx.fill();
    }
    const body = ctx.createLinearGradient(0, -12, 0, 12);
    body.addColorStop(0, "#a5f3fc");
    body.addColorStop(0.5, "#22d3ee");
    body.addColorStop(1, "#0e7490");
    ctx.fillStyle = body;
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(-20, -12, 40, 24, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(11,17,32,0.8)";
    ctx.beginPath();
    ctx.roundRect(-6, -8, 13, 16, 4);
    ctx.fill();
    ctx.fillStyle = "#fde68a";
    ctx.fillRect(15, -9, 5, 5);
    ctx.fillRect(15, 4, 5, 5);
    ctx.restore();

    // toast
    if (g.toastT > 0) {
      const a = Math.min(1, g.toastT * 2);
      ctx.font = "bold 20px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.shadowColor = g.toast.includes("MISSED") ? "#ef4444" : "#22d3ee";
      ctx.shadowBlur = 14;
      ctx.fillText(g.toast, g.x, g.y - 46 - (1 - a) * 16);
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    /* ---- minimap ---- */
    const mw = 106;
    const mh = 78;
    const mx = W - mw - 10;
    const my = 10;
    const ms = Math.min(mw / w.worldW, mh / w.worldH);
    const ox = mx + (mw - w.worldW * ms) / 2;
    const oy = my + (mh - w.worldH * ms) / 2;
    ctx.fillStyle = "rgba(8,11,20,0.75)";
    ctx.beginPath();
    ctx.roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    tr.pts.forEach((p, i) => {
      const px = ox + p.x * ms;
      const py = oy + p.y * ms;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    const next = w.gates[g.gateIdx];
    if (next) {
      const gp = pointAt(tr, next.s);
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(ox + gp.x * ms, oy + gp.y * ms, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(ox + g.x * ms, oy + g.y * ms, 3.6, 0, Math.PI * 2);
    ctx.fill();

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(244,63,94,${Math.min(0.5, g.flash)})`;
      ctx.fillRect(0, 0, W, H);
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

  const finishStage = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.done) return;
    g.done = true;
    g.vx = 0;
    g.vy = 0;
    burst(g, g.x, g.y, 30, "#fde68a", 260);
    const stageTime = Math.round((g.time - g.stageStart) * 10) / 10;
    const total = Math.round(g.time * 10) / 10;
    if (g.stage >= STAGES) {
      setOutcome({ kind: "done", stage: g.stage, stageTime, total, par: g.world.par });
      setNewBest(submit(total));
      setStatus("over");
    } else if (stageTime > g.world.par) {
      setOutcome({ kind: "over-par", stage: g.stage, stageTime, total, par: g.world.par });
      setStatus("over");
    } else {
      setOutcome({ kind: "clear", stage: g.stage, stageTime, total, par: g.world.par });
      setStatus("clear");
    }
    setHudT(Math.floor(total * 10));
    tenthRef.current = Math.floor(total * 10);
    draw(performance.now());
  }, [draw, submit]);

  const step = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.done) return;
    const dt = STEP / 1000;
    const tr = g.world.tr;
    const inp = inputRef.current;

    const pre = nearest(tr, g.x, g.y, g.hint);
    const onRoad = Math.abs(pre.lat) <= tr.half;
    g.hint = pre.i;

    const cos = Math.cos(g.ang);
    const sin = Math.sin(g.ang);
    let fwd = g.vx * cos + g.vy * sin;
    let side = -g.vx * sin + g.vy * cos;

    if (inp.up) fwd += ACCEL * dt;
    if (inp.down) fwd -= BRAKE * dt;
    fwd -= fwd * (onRoad ? 0.55 : 1.75) * dt;
    const cap = onRoad ? MAX_ON : MAX_OFF;
    if (fwd > cap) fwd = Math.max(cap, fwd - 460 * dt);
    fwd = Math.max(-80, Math.min(cap, fwd));

    const grip = onRoad ? 9 : 3.4;
    side -= side * Math.min(1, grip * dt);

    const steer = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (steer !== 0 && Math.abs(fwd) > 6) {
      g.ang += steer * TURN * Math.min(1, Math.abs(fwd) / 95) * dt * Math.sign(fwd);
    }

    g.vx = cos * fwd - sin * side;
    g.vy = sin * fwd + cos * side;
    g.x += g.vx * dt;
    g.y += g.vy * dt;

    // props
    for (const p of g.world.props) {
      const dx = g.x - p.x;
      const dy = g.y - p.y;
      const d = Math.hypot(dx, dy);
      if (p.kind === "tree") {
        const rr = p.r + 13;
        if (d < rr && d > 0.01) {
          const push = (rr - d) / d;
          g.x += dx * push;
          g.y += dy * push;
          g.vx *= 0.32;
          g.vy *= 0.32;
          g.shake = Math.max(g.shake, 8);
          burst(g, p.x + dx * 0.4, p.y + dy * 0.4, 8, "#86efac", 150);
        }
      } else if (d < p.r) {
        g.vx *= 1 - 2.6 * dt;
        g.vy *= 1 - 2.6 * dt;
        if (Math.random() < 0.25) {
          burst(g, g.x, g.y, 2, "#7dd3fc", 120);
        }
      }
    }

    const near = nearest(tr, g.x, g.y, g.hint);
    const s = near.s;
    const lat = near.lat;

    // gate checkpoints (sequential — s only ever advances past them once)
    while (g.gateIdx < g.world.gates.length && s >= g.world.gates[g.gateIdx].s) {
      const gate = g.world.gates[g.gateIdx];
      if (Math.abs(lat) <= gate.half) {
        g.toast = `GATE ${g.gateIdx + 1} CLEAR`;
        g.toastT = 1;
        burst(g, g.x, g.y, 12, "#34d399", 170);
      } else {
        g.time += MISS_PENALTY;
        g.toast = `GATE ${g.gateIdx + 1} MISSED +${MISS_PENALTY}s`;
        g.toastT = 1.4;
        g.shake = Math.max(g.shake, 9);
        g.flash = 0.4;
        burst(g, g.x, g.y, 16, "#f87171", 200);
      }
      g.gateIdx += 1;
      setGatesPassed(g.gateIdx);
    }
    g.prevS = s;

    // finish line
    if (s >= tr.len - FINISH_S) {
      finishStage();
      return;
    }

    // dust + skids
    const slip = Math.abs(side);
    if (!onRoad && Math.abs(fwd) > 40 && Math.random() < 0.6) {
      g.parts.push({
        x: g.x - cos * 14,
        y: g.y - sin * 14,
        vx: -g.vx * 0.2 + (Math.random() - 0.5) * 50,
        vy: -g.vy * 0.2 + (Math.random() - 0.5) * 50,
        life: 0.6,
        max: 0.6,
        r: 2 + Math.random() * 3,
        c: "#c7b28a",
      });
    } else if (slip > 60 && Math.random() < 0.45) {
      g.marks.push({ x: g.x, y: g.y, life: 3.4 });
      if (g.marks.length > 300) g.marks.shift();
    }
    for (let i = 0; i < g.parts.length; i++) {
      const p = g.parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.life -= dt;
    }
    if (g.parts.length > 150) g.parts.splice(0, g.parts.length - 150);
    g.parts = g.parts.filter((p) => p.life > 0);
    for (let i = 0; i < g.marks.length; i++) g.marks[i].life -= dt;
    g.marks = g.marks.filter((m) => m.life > 0);

    g.shake = Math.max(0, g.shake - 0.6);
    g.flash = Math.max(0, g.flash - 0.025);
    g.toastT = Math.max(0, g.toastT - dt);

    g.time += dt;
    const targetX = Math.max(0, Math.min(g.world.worldW - W, g.x - W / 2));
    const targetY = Math.max(0, Math.min(g.world.worldH - H, g.y - H / 2));
    g.camX += (targetX - g.camX) * 0.15;
    g.camY += (targetY - g.camY) * 0.15;

    const tenth = Math.floor(g.time * 10);
    if (tenth !== tenthRef.current) {
      tenthRef.current = tenth;
      setHudT(tenth);
    }
  }, [finishStage]);

  const start = useCallback(() => {
    const g = createGame();
    gameRef.current = g;
    inputRef.current.up = false;
    inputRef.current.down = false;
    inputRef.current.left = false;
    inputRef.current.right = false;
    tenthRef.current = 0;
    setHudT(0);
    setStageNo(1);
    setGatesPassed(0);
    setNewBest(false);
    setStatus("playing");
    draw(performance.now());
  }, [draw]);

  const advance = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    loadStage(g, g.stage + 1);
    inputRef.current.up = false;
    inputRef.current.down = false;
    inputRef.current.left = false;
    inputRef.current.right = false;
    setStageNo(g.stage);
    setGatesPassed(0);
    setStatus("playing");
    draw(performance.now());
  }, [draw]);

  const retryStage = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.time = g.stageStart; // rewind — the failed attempt never happened
    loadStage(g, g.stage);
    inputRef.current.up = false;
    inputRef.current.down = false;
    inputRef.current.left = false;
    inputRef.current.right = false;
    setGatesPassed(0);
    setHudT(Math.floor(g.time * 10));
    tenthRef.current = Math.floor(g.time * 10);
    setStatus("playing");
    draw(performance.now());
  }, [draw]);

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
        if (!g || g.done) break;
        step();
      }
      draw(t);
      const g = gameRef.current;
      if (g && g.done) return;
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
    const MAP: Record<string, keyof typeof inputRef.current> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const dir = MAP[k];
      if (dir) {
        e.preventDefault();
        inputRef.current[dir] = true;
        return;
      }
      if (k === " " || k === "Enter") {
        e.preventDefault();
        if (status === "playing") return;
        if (status === "clear") advance();
        else if (status === "over" && outcome.kind === "over-par") retryStage();
        else start();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const dir = MAP[k];
      if (dir) inputRef.current[dir] = false;
    };
    const blur = () => {
      inputRef.current.up = false;
      inputRef.current.down = false;
      inputRef.current.left = false;
      inputRef.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [status, start, advance, retryStage, outcome]);

  const hold = (dir: keyof typeof inputRef.current, value: boolean) => {
    inputRef.current[dir] = value;
  };

  const touchBtn =
    "pointer-events-auto flex h-14 w-14 select-none items-center justify-center rounded-2xl border border-line bg-surface/75 text-xl font-bold text-ink backdrop-blur active:scale-95 active:bg-surface";


  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[600px]">
      <div className="mb-3 flex items-center justify-between gap-2 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Time <b className="ml-1 text-sm text-ink">{(hudT / 10).toFixed(1)}s</b>
        </span>
        <span>
          Stage <b className="ml-1 text-sm text-ink">{stageNo}/{STAGES}</b>
        </span>
        <span>
          Gates <b className="ml-1 text-sm text-ink">{gatesPassed}</b>
        </span>
        <span className="text-warn">
          Best <b className="ml-1 text-sm text-ink">{best === null ? "—" : `${best.toFixed(1)}s`}</b>
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(34,211,238,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full [touch-action:none]"
          aria-label="Rally Sprint top-down time trial"
        />

        {status === "playing" && (
          <>
            <button
              type="button"
              aria-label="Steer left"
              className={`absolute bottom-4 left-4 ${touchBtn}`}
              onPointerDown={(e) => { e.preventDefault(); hold("left", true); }}
              onPointerUp={() => hold("left", false)}
              onPointerCancel={() => hold("left", false)}
              onPointerLeave={() => hold("left", false)}
              onContextMenu={(e) => e.preventDefault()}
            
            >
              ◀
            </button>
            <button
              type="button"
              aria-label="Steer right"
              className={`absolute bottom-4 left-20 ${touchBtn}`}
              onPointerDown={(e) => { e.preventDefault(); hold("right", true); }}
              onPointerUp={() => hold("right", false)}
              onPointerCancel={() => hold("right", false)}
              onPointerLeave={() => hold("right", false)}
              onContextMenu={(e) => e.preventDefault()}
            
            >
              ▶
            </button>
            <button
              type="button"
              aria-label="Throttle"
              className={`absolute bottom-4 right-4 ${touchBtn}`}
              onPointerDown={(e) => { e.preventDefault(); hold("up", true); }}
              onPointerUp={() => hold("up", false)}
              onPointerCancel={() => hold("up", false)}
              onPointerLeave={() => hold("up", false)}
              onContextMenu={(e) => e.preventDefault()}
            
            >
              ▲
            </button>
          </>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">RALLY SPRINT</p>
            <p className="mt-2 text-sm text-muted">
              Four dirt stages, glowing gate after glowing gate. Clip every gate, stay off
              the grass and out of the water, and beat the par clock.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Lights on
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ↑ throttle · ↓ brake · ←→ steer · hold a screen half on touch
            </p>
          </Overlay>
        )}

        {status === "clear" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              STAGE {outcome.stage} CLEARED
            </p>
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {outcome.stageTime.toFixed(1)}s
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Par {outcome.par.toFixed(1)}s · run total {outcome.total.toFixed(1)}s
            </p>
            <PrimaryButton onClick={advance} tone={TONE}>
              Next stage
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Missed gates add {MISS_PENALTY}s — the next stage is tighter
            </p>
          </Overlay>
        )}

        {status === "over" && outcome.kind === "over-par" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">OVER PAR</p>
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {outcome.stageTime.toFixed(1)}s
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Stage {outcome.stage} par is {outcome.par.toFixed(1)}s
            </p>
            <PrimaryButton onClick={retryStage} tone={TONE}>
              Retry stage
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              The clock rewinds — no penalty for the attempt
            </p>
          </Overlay>
        )}

        {status === "over" && outcome.kind === "done" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">ALL {STAGES} STAGES</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best time!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {outcome.total.toFixed(1)}s
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Every stage under par · Best{" "}
              {best === null ? "—" : `${best.toFixed(1)}s`}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Rally again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        ↑↓←→ / WASD to drive · every gate must be clipped · grass and water bleed time
        away from your run
      </p>
    </div>
  );
}
