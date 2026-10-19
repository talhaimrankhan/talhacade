"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { Overlay, PrimaryButton } from "./parts";

const CELL = 44;
const COLS = 12;
const ROWS = 12;
const W = COLS * CELL; // 528
const H = ROWS * CELL;
const CAR_L = 34;
const CAR_W = 18;
const MAX_F = 132;
const MAX_R = -74;
const ACCEL = 250;
const BRAKE = 430;
const FRICTION = 2.7;
const STEER_MAX = 0.55;
const STEER_RATE = 4.4;
const WHEELBASE = 30;
const STEP = 1000 / 60;
const MOVE_HOLD = 0.15; // a burst shorter than this is a freebie
const LEVELS = 12;

type Status = "idle" | "playing" | "clear" | "over";

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

interface Skid {
  x: number;
  y: number;
  ang: number;
  life: number;
}

interface Parsed {
  walls: boolean[]; // ROWS * COLS
  cones: { x: number; y: number; r: number }[];
  start: { x: number; y: number; ang: number };
  bay: { x: number; y: number; w: number; h: number };
}

interface ParkGame {
  level: number;
  pd: Parsed;
  x: number;
  y: number;
  ang: number;
  steer: number;
  v: number;
  moves: number;
  total: number;
  parts: Particle[];
  skids: Skid[];
  shake: number;
  flash: number;
  toast: string;
  toastT: number;
  done: boolean;
}

/* ---------------- level layouts ----------------
   '#' wall · '.' floor · 'o' cone · 'P' parking bay · '^v<>' start + facing */

const LEVEL_MAPS: string[][] = [
  [
    "..........",
    "..........",
    ".PP.......",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    ".....^....",
  ],
  [
    "..........",
    "....oo....",
    "..........",
    "...####...",
    "...#..#...",
    "...#..#...",
    "...####...",
    "..........",
    "..PP......",
    ".....^....",
  ],
  [
    "....oo....",
    "..######..",
    "..#....#..",
    "..#....#..",
    "..#.PP.#..",
    "..#....#..",
    "..#....#..",
    "..####.#..",
    "..........",
    ".....^....",
  ],
  [
    ".#PP#.....",
    ".#..#.....",
    "..........",
    "...####...",
    "..........",
    ".o......o.",
    "..........",
    "...####...",
    "..........",
    ".....^....",
  ],
  [
    "..........",
    "..o....o..",
    "..........",
    "..........",
    "..........",
    "####......",
    "PP........",
    "####......",
    "..........",
    ".....^....",
  ],
  [
    "..PP......",
    "..####....",
    "..........",
    ".o......o.",
    "...####...",
    "..........",
    ".####.....",
    "..........",
    "..o....o..",
    ".....^....",
  ],
  [
    ".......PP#",
    ".....####.",
    "..........",
    "###.......",
    ".......###",
    "..........",
    "###.......",
    ".....o.o..",
    "..........",
    ".....^....",
  ],
  [
    "..........",
    "..o....o..",
    "..........",
    "...####...",
    "..........",
    "..######..",
    "..........",
    "####......",
    "PP........",
    "####...^..",
  ],
  [
    "..........",
    "...o..o...",
    "..........",
    "..#..#....",
    "..#PP#....",
    "..####....",
    "..........",
    ".o......o.",
    "..........",
    ".....^....",
  ],
  [
    "..........",
    "..######..",
    "..#....#..",
    "..#.PP.#..",
    "..#....#..",
    "..#.......",
    "..........",
    ".o......o.",
    "..........",
    ".....^....",
  ],
  [
    "..........",
    ".o......o.",
    "..........",
    "...####...",
    "..........",
    "##......##",
    ".....^....",
    "......####",
    "......PP..",
    "......####",
  ],
  [
    ".......PP.",
    ".......###",
    "..........",
    ".####.....",
    "......####",
    "..........",
    "..o....o..",
    ".....####.",
    "..........",
    "....^.....",
  ],
];

function parseLevel(index: number): Parsed {
  const map = LEVEL_MAPS[index] ?? LEVEL_MAPS[0];
  const walls = new Array<boolean>(ROWS * COLS).fill(false);
  const cones: Parsed["cones"] = [];
  let start: Parsed["start"] = { x: W / 2, y: H - CELL * 1.5, ang: -Math.PI / 2 };
  const cells: Array<[number, number]> = [];

  map.forEach((row, r) => {
    for (let c = 0; c < COLS; c++) {
      const ch = row[c];
      if (ch === "#") walls[r * COLS + c] = true;
      else if (ch === "o") {
        cones.push({ x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, r: 13 });
      } else if (ch === "P") cells.push([r, c]);
      else if (ch === "^") start = { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, ang: -Math.PI / 2 };
      else if (ch === "v") start = { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, ang: Math.PI / 2 };
      else if (ch === "<") start = { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, ang: Math.PI };
      else if (ch === ">") start = { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, ang: 0 };
    }
  });

  let minR = 0;
  let maxR = 0;
  let minC = 0;
  let maxC = 0;
  cells.forEach(([r, c], i) => {
    if (i === 0) {
      minR = maxR = r;
      minC = maxC = c;
      return;
    }
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
  });

  return {
    walls,
    cones,
    start,
    bay: {
      x: minC * CELL,
      y: minR * CELL,
      w: (maxC - minC + 1) * CELL,
      h: (maxR - minR + 1) * CELL,
    },
  };
}

/** Sample points around the hull — collision is point-in-cell, so keep it dense. */
function buildPerimeter(halfL: number, halfW: number, per: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < per; i++) {
    const t = (i / per) * 4;
    const s = t % 1;
    if (t < 1) pts.push([-halfL + 2 * halfL * s, -halfW]);
    else if (t < 2) pts.push([halfL, -halfW + 2 * halfW * s]);
    else if (t < 3) pts.push([halfL - 2 * halfL * s, halfW]);
    else pts.push([-halfL, halfW - 2 * halfW * s]);
  }
  return pts;
}

const PERIM = buildPerimeter(CAR_L / 2, CAR_W / 2, 28);
const HALF_L = CAR_L / 2;
const HALF_W = CAR_W / 2;

function hits(pd: Parsed, x: number, y: number, ang: number): boolean {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  for (const [lx, ly] of PERIM) {
    const px = x + lx * cos - ly * sin;
    const py = y + lx * sin + ly * cos;
    const c = Math.floor(px / CELL);
    const r = Math.floor(py / CELL);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
    if (pd.walls[r * COLS + c]) return true;
    for (const cn of pd.cones) {
      const dx = px - cn.x;
      const dy = py - cn.y;
      const rr = cn.r + 2;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
  }
  return false;
}

function corners(x: number, y: number, ang: number): Array<[number, number]> {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const out: Array<[number, number]> = [];
  for (const [lx, ly] of [
    [HALF_L, HALF_W],
    [HALF_L, -HALF_W],
    [-HALF_L, HALF_W],
    [-HALF_L, -HALF_W],
  ] as Array<[number, number]>) {
    out.push([x + lx * cos - ly * sin, y + lx * sin + ly * cos]);
  }
  return out;
}

function parked(pd: Parsed, x: number, y: number, ang: number, v: number): boolean {
  if (Math.abs(v) > 8) return false;
  const b = pd.bay;
  return corners(x, y, ang).every(
    (p) => p[0] > b.x + 2 && p[0] < b.x + b.w - 2 && p[1] > b.y + 2 && p[1] < b.y + b.h - 2,
  );
}

function burst(g: ParkGame, x: number, y: number, n: number, color: string, spread: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = spread * (0.35 + Math.random() * 0.9);
    g.parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.5,
      max: 1,
      r: 1.5 + Math.random() * 3,
      c: color,
    });
  }
}

function loadLevel(g: ParkGame, level: number) {
  g.level = level;
  g.pd = parseLevel(level - 1);
  g.x = g.pd.start.x;
  g.y = g.pd.start.y;
  g.ang = g.pd.start.ang;
  g.steer = 0;
  g.v = 0;
  g.moves = 0;
  g.parts = [];
  g.skids = [];
  g.shake = 0;
  g.flash = 0;
  g.toast = `LEVEL ${level}`;
  g.toastT = 1.4;
  g.done = false;
}

function createGame(): ParkGame {
  const g: ParkGame = {
    level: 1,
    pd: parseLevel(0),
    x: 0,
    y: 0,
    ang: 0,
    steer: 0,
    v: 0,
    moves: 0,
    total: 0,
    parts: [],
    skids: [],
    shake: 0,
    flash: 0,
    toast: "",
    toastT: 0,
    done: false,
  };
  loadLevel(g, 1);
  return g;
}

const TONE = "from-slate-400 via-zinc-500 to-neutral-700";

export default function ParkingMaster({ gameId = "parking-master" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<ParkGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [levelNo, setLevelNo] = useState(1);
  const [moves, setMoves] = useState(0);
  const [total, setTotal] = useState(0);
  const [lastLevel, setLastLevel] = useState({ level: 1, moves: 0, total: 0 });
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "low");
  const inputRef = useRef({ up: false, down: false, left: false, right: false });
  const holdRef = useRef({ up: 0, down: 0, left: 0, right: 0 });
  const countedRef = useRef({ up: false, down: false, left: false, right: false });

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    const pd = g.pd;
    const sx = (Math.random() - 0.5) * g.shake;
    const sy = (Math.random() - 0.5) * g.shake;

    ctx.save();
    ctx.translate(sx, sy);

    // asphalt tiles
    ctx.fillStyle = "#12141c";
    ctx.fillRect(-12, -12, W + 24, H + 24);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = "rgba(148,163,184,0.035)";
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        }
      }
    }
    ctx.strokeStyle = "rgba(148,163,184,0.07)";
    ctx.lineWidth = 1;
    for (let i = 1; i < COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, H);
      ctx.stroke();
    }
    for (let i = 1; i < ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(W, i * CELL);
      ctx.stroke();
    }

    // skid marks
    for (const s of g.skids) {
      ctx.globalAlpha = Math.max(0, Math.min(0.45, s.life));
      ctx.strokeStyle = "#0b0b12";
      ctx.lineWidth = CAR_W - 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.ang) * 6, s.y - Math.sin(s.ang) * 6);
      ctx.lineTo(s.x + Math.cos(s.ang) * 6, s.y + Math.sin(s.ang) * 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // glowing bay
    const b = pd.bay;
    const pulse = 0.55 + Math.sin(time / 320) * 0.2;
    ctx.save();
    ctx.shadowColor = "#34d399";
    ctx.shadowBlur = 22;
    ctx.fillStyle = `rgba(52,211,153,${0.1 * pulse})`;
    ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    ctx.restore();
    ctx.setLineDash([9, 7]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(52,211,153,${pulse})`;
    ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.setLineDash([]);
    // car outline guide inside the bay
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.rotate(b.w >= b.h ? 0 : Math.PI / 2);
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(165,243,252,${0.45 * pulse + 0.2})`;
    ctx.beginPath();
    ctx.roundRect(-CAR_L / 2, -CAR_W / 2, CAR_L, CAR_W, 5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // walls
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!pd.walls[r * COLS + c]) continue;
        const x = c * CELL;
        const y = r * CELL;
        ctx.fillStyle = "#2b2f3c";
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 7);
        ctx.fill();
        ctx.fillStyle = "rgba(226,232,240,0.10)";
        ctx.beginPath();
        ctx.roundRect(x + 4, y + 4, CELL - 8, 9, 4);
        ctx.fill();
        ctx.strokeStyle = "rgba(148,163,184,0.22)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x + 2.5, y + 2.5, CELL - 5, CELL - 5, 7);
        ctx.stroke();
      }
    }

    // cones
    for (const cn of pd.cones) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(cn.x, cn.y + 9, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fb923c";
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(cn.x, cn.y - 12);
      ctx.lineTo(cn.x + 11, cn.y + 9);
      ctx.lineTo(cn.x - 11, cn.y + 9);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#fff7ed";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cn.x - 7, cn.y + 1);
      ctx.lineTo(cn.x + 7, cn.y + 1);
      ctx.stroke();
    }

    // car
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(2, 5, CAR_L * 0.62, CAR_W * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(g.ang);
    // wheels
    ctx.fillStyle = "#0b0b12";
    for (const [ox, oy, turned] of [
      [HALF_L - 7, -HALF_W - 1, true],
      [HALF_L - 7, HALF_W + 1, true],
      [-HALF_L + 7, -HALF_W - 1, false],
      [-HALF_L + 7, HALF_W + 1, false],
    ] as Array<[number, number, boolean]>) {
      ctx.save();
      ctx.translate(ox, oy);
      if (turned) ctx.rotate(g.steer);
      ctx.beginPath();
      ctx.roundRect(-6, -3.5, 12, 7, 2.5);
      ctx.fill();
      ctx.restore();
    }
    // body
    const body = ctx.createLinearGradient(0, -HALF_W, 0, HALF_W);
    body.addColorStop(0, "#67e8f9");
    body.addColorStop(0.5, "#22d3ee");
    body.addColorStop(1, "#0369a1");
    ctx.fillStyle = body;
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(-HALF_L, -HALF_W, CAR_L, CAR_W, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
    // windscreen + roof
    ctx.fillStyle = "rgba(11,17,32,0.75)";
    ctx.beginPath();
    ctx.roundRect(HALF_L - 13, -HALF_W + 3, 8, CAR_W - 6, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.roundRect(-HALF_L + 5, -HALF_W + 3, 12, CAR_W - 6, 4);
    ctx.fill();
    // lights
    const fwd = g.v > 1;
    ctx.fillStyle = fwd ? "#fef9c3" : "#334155";
    ctx.fillRect(HALF_L - 2, -HALF_W + 2, 3, 5);
    ctx.fillRect(HALF_L - 2, HALF_W - 7, 3, 5);
    ctx.fillStyle = g.v < -1 ? "#fca5a5" : "#7f1d1d";
    ctx.fillRect(-HALF_L - 1, -HALF_W + 2, 3, 5);
    ctx.fillRect(-HALF_L - 1, HALF_W - 7, 3, 5);
    ctx.restore();

    // particles
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // level watermark
    ctx.font = "bold 40px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(226,232,240,0.07)";
    ctx.fillText(`LEVEL ${g.level}`, 14, 46);

    if (g.toastT > 0) {
      const a = Math.min(1, g.toastT * 2);
      ctx.font = "bold 18px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 12;
      ctx.fillText(g.toast, W / 2, 40 - (1 - a) * 12);
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(56,189,248,${Math.min(0.5, g.flash)})`;
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

  const clearLevel = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.done) return;
    g.done = true;
    g.total += g.moves;
    burst(g, g.x, g.y, 34, "#34d399", 260);
    burst(g, g.x, g.y, 16, "#fde68a", 200);
    g.flash = 0.45;
    setMoves(g.moves);
    setTotal(g.total);
    setLastLevel({ level: g.level, moves: g.moves, total: g.total });
    if (g.level >= LEVELS) {
      setNewBest(submit(g.total));
      setStatus("over");
    } else {
      setStatus("clear");
    }
    draw(performance.now());
  }, [draw, submit]);

  const step = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.done) return;
    const dt = STEP / 1000;
    const inp = inputRef.current;
    const hold = holdRef.current;
    const counted = countedRef.current;

    // count a deliberate burst of any one direction as a single move
    for (const dir of ["up", "down", "left", "right"] as const) {
      if (inp[dir]) {
        hold[dir] += dt;
        if (!counted[dir] && hold[dir] >= MOVE_HOLD) {
          counted[dir] = true;
          g.moves += 1;
          g.toast = `+1 MOVE · ${g.moves}`;
          g.toastT = 0.8;
        }
      } else {
        hold[dir] = 0;
        counted[dir] = false;
      }
    }

    // steering arc
    const target = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const rate = target === 0 ? 6.5 : STEER_RATE;
    g.steer += (target * STEER_MAX - g.steer) * Math.min(1, rate * dt);

    // throttle / reverse
    if (inp.up) g.v += (g.v < 0 ? BRAKE : ACCEL) * dt;
    else if (inp.down) g.v -= (g.v > 0 ? BRAKE : ACCEL * 0.8) * dt;
    else g.v -= Math.sign(g.v) * Math.min(Math.abs(g.v), FRICTION * 60 * dt);
    if (!inp.up && !inp.down && Math.abs(g.v) < 2.5) g.v = 0;
    g.v = Math.max(MAX_R, Math.min(MAX_F, g.v));

    const px = g.x;
    const py = g.y;
    const pa = g.ang;

    g.ang += ((g.v / WHEELBASE) * Math.tan(g.steer)) * dt;
    g.x += Math.cos(g.ang) * g.v * dt;
    g.y += Math.sin(g.ang) * g.v * dt;

    if (hits(g.pd, g.x, g.y, g.ang)) {
      g.x = px;
      g.y = py;
      g.ang = pa;
      g.v = -g.v * 0.22;
      g.shake = Math.max(g.shake, 7);
      burst(g, px + Math.cos(pa) * HALF_L, py + Math.sin(pa) * HALF_L, 10, "#fbbf24", 150);
      g.toast = "BUMP";
      g.toastT = 0.6;
    }

    // tyre marks when hustling
    if (Math.abs(g.v) > 55 && Math.abs(g.steer) > 0.22) {
      g.skids.push({ x: g.x, y: g.y, ang: g.ang, life: 5 });
      if (g.skids.length > 360) g.skids.shift();
    }
    for (let i = 0; i < g.skids.length; i++) g.skids[i].life -= dt;
    g.skids = g.skids.filter((s) => s.life > 0);

    for (let i = 0; i < g.parts.length; i++) {
      const p = g.parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
      p.life -= dt;
    }
    if (g.parts.length > 160) g.parts.splice(0, g.parts.length - 160);
    g.parts = g.parts.filter((p) => p.life > 0);

    g.shake = Math.max(0, g.shake - 0.6);
    g.flash = Math.max(0, g.flash - 0.03);
    g.toastT = Math.max(0, g.toastT - dt);

    setMoves((prev) => (prev === g.moves ? prev : g.moves));

    if (parked(g.pd, g.x, g.y, g.ang, g.v)) clearLevel();
  }, [clearLevel]);

  const start = useCallback(() => {
    const g = createGame();
    gameRef.current = g;
    inputRef.current.up = false;
    inputRef.current.down = false;
    inputRef.current.left = false;
    inputRef.current.right = false;
    holdRef.current = { up: 0, down: 0, left: 0, right: 0 };
    countedRef.current = { up: false, down: false, left: false, right: false };
    setLevelNo(1);
    setMoves(0);
    setTotal(0);
    setNewBest(false);
    setStatus("playing");
    draw(performance.now());
  }, [draw]);

  const advance = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    loadLevel(g, g.level + 1);
    inputRef.current.up = false;
    inputRef.current.down = false;
    inputRef.current.left = false;
    inputRef.current.right = false;
    holdRef.current = { up: 0, down: 0, left: 0, right: 0 };
    countedRef.current = { up: false, down: false, left: false, right: false };
    setLevelNo(g.level);
    setMoves(0);
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
  }, [status, start, advance]);

  const setDir = (dir: keyof typeof inputRef.current, value: boolean) => {
    inputRef.current[dir] = value;
    if (!value) {
      holdRef.current[dir] = 0;
      countedRef.current[dir] = false;
    }
  };

  const padBtn =
    "pointer-events-auto flex h-12 w-12 select-none items-center justify-center rounded-xl border border-line bg-surface/75 text-lg font-bold text-ink backdrop-blur active:scale-95 active:bg-surface";


  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[560px]">
      <div className="mb-3 flex items-center justify-between gap-2 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Level <b className="ml-1 text-sm text-ink">{levelNo}/{LEVELS}</b>
        </span>
        <span>
          Moves <b className="ml-1 text-sm text-ink">{moves}</b>
        </span>
        <span>
          Total <b className="ml-1 text-sm text-ink">{total}</b>
        </span>
        <span className="text-warn">
          Best <b className="ml-1 text-sm text-ink">{best ?? "—"}</b>
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(148,163,184,0.55)]">
        <canvas
          ref={canvasRef}
          className="block w-full [touch-action:none]"
          aria-label="Parking Master top-down parking puzzle"
        />

        {status === "playing" && (
          <div className="pointer-events-none absolute bottom-4 left-4 grid grid-cols-3 grid-rows-3 gap-1">
            <span />
            <button
              type="button"
              aria-label="Accelerate"
              className={padBtn}
              onPointerDown={(e) => { e.preventDefault(); setDir("up", true); }}
              onPointerUp={() => setDir("up", false)}
              onPointerCancel={() => setDir("up", false)}
              onPointerLeave={() => setDir("up", false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              ▲
            </button>
            <span />
            <button
              type="button"
              aria-label="Steer left"
              className={padBtn}
              onPointerDown={(e) => { e.preventDefault(); setDir("left", true); }}
              onPointerUp={() => setDir("left", false)}
              onPointerCancel={() => setDir("left", false)}
              onPointerLeave={() => setDir("left", false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              ◀
            </button>
            <span />
            <button
              type="button"
              aria-label="Steer right"
              className={padBtn}
              onPointerDown={(e) => { e.preventDefault(); setDir("right", true); }}
              onPointerUp={() => setDir("right", false)}
              onPointerCancel={() => setDir("right", false)}
              onPointerLeave={() => setDir("right", false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              ▶
            </button>
            <span />
            <button
              type="button"
              aria-label="Reverse"
              className={padBtn}
              onPointerDown={(e) => { e.preventDefault(); setDir("down", true); }}
              onPointerUp={() => setDir("down", false)}
              onPointerCancel={() => setDir("down", false)}
              onPointerLeave={() => setDir("down", false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              ▼
            </button>
            <span />
          </div>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">PARKING MASTER</p>
            <p className="mt-2 text-sm text-muted">
              Twelve tight lots, one glowing bay each. Steer with a real arc — every
              deliberate push of a key counts as a move, so smooth beats busy.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Pull in
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ↑ drive · ↓ reverse · ←→ steer · on-screen pad on touch
            </p>
          </Overlay>
        )}

        {status === "clear" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              LEVEL {lastLevel.level} PARKED
            </p>
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {lastLevel.moves}
              <span className="ml-2 text-lg text-muted">moves</span>
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Total {lastLevel.total} · {LEVELS - lastLevel.level} lots to go
            </p>
            <PrimaryButton onClick={advance} tone={TONE}>
              Next lot
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Tap a direction and hold it past a beat to log a move
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">LOT MASTERED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best run!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {lastLevel.total}
              <span className="ml-2 text-lg text-muted">moves</span>
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              All {LEVELS} lots · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Run it again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        ↑↓←→ / WASD to drive · hold a direction past a beat to count one move · settle the
        car fully inside the glowing bay
      </p>
    </div>
  );
}
