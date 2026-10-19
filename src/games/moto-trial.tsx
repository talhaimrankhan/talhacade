"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { Overlay, PrimaryButton } from "./parts";

const W = 640;
const H = 360;
const TS = 6; // terrain sample spacing (px)
const BASE = 248; // flat ground line
const R = 12; // wheel radius
const WB = 26; // half wheelbase
const WHEEL_Y = 8;
const HEAD_UP = 30; // rider head, above the chassis centre
const GRAVITY = 900;
const SPRING = 240;
const SPRING_DAMP = 7;
const INERTIA = 2300;
const DRIVE = 580;
const REVERSE = 250;
const START_X = 96;
const STAGES = 5;
const STEP = 1000 / 60;
const PENALTY = 3; // seconds added per crash
const CLEAN = 0.5; // seconds shaved for a stuck landing
const TAIL = 480; // world padding past the flag

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

interface Log {
  x: number;
  y: number;
  r: number;
}

interface Stage {
  heights: number[];
  holes: boolean[];
  logs: Log[];
  checkpoints: number[];
  finish: number;
}

interface TrialGame {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ang: number;
  angVel: number;
  spin: number;
  grounded: boolean;
  airTime: number;
  stage: number;
  stageStart: number;
  st: Stage;
  cpIdx: number;
  cpX: number;
  time: number;
  camX: number;
  toast: string;
  toastT: number;
  shake: number;
  flash: number;
  parts: Particle[];
  done: boolean;
}

/* ---------------- stage building ---------------- */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function buildStage(idx: number): Stage {
  const rand = mulberry32(0x9e3779b9 ^ (idx * 7919));
  const length = 1980 + idx * 540;
  const n = Math.ceil((length + TAIL) / TS) + 4;
  const heights = new Array<number>(n).fill(BASE);
  const holes = new Array<boolean>(n).fill(false);

  // plan the gaps first so the walk knows where to carve them
  const holeCount = idx + 1;
  const spanStart = 760;
  const spanEnd = length - 640;
  const gap = (spanEnd - spanStart) / holeCount;
  const gaps: { x: number; w: number }[] = [];
  for (let k = 0; k < holeCount; k++) {
    const x = spanStart + gap * (k + 0.5) + (rand() - 0.5) * gap * 0.4;
    gaps.push({ x: Math.round(x), w: 60 + rand() * 24 + idx * 5 });
  }

  let i = 0;
  let h = BASE;
  let slope = 0;

  const walk = () => {
    const gnarly = 1 + idx * 0.3;
    slope += (rand() - 0.5) * 1.2 * gnarly;
    slope += (BASE - h) * 0.004;
    slope = clamp(slope, -7.5, 7.5);
    h += slope;
    if (h < 128) {
      h = 128;
      slope = Math.max(0, slope);
    }
    if (h > 318) {
      h = 318;
      slope = Math.min(0, slope);
    }
    heights[i] = h;
    holes[i] = false;
    i += 1;
  };

  // flat launch pad
  const padEnd = Math.round(260 / TS);
  for (; i < padEnd; i++) {
    heights[i] = BASE;
    holes[i] = false;
  }
  h = BASE;
  slope = 0;

  for (const gp of gaps) {
    const rampStart = Math.round((gp.x - 88) / TS);
    while (i < rampStart && i < n) walk();
    if (i >= n) break;

    // launch ramp: force a clean upslope into the lip
    const h0 = heights[i - 1] ?? BASE;
    const rise = 26 + idx * 3;
    const rampEnd = Math.round(gp.x / TS);
    const rampLen = Math.max(2, rampEnd - i);
    const rStart = i;
    for (; i <= rampEnd && i < n; i++) {
      const t = (i - rStart) / rampLen;
      heights[i] = h0 - rise * t;
      holes[i] = false;
    }

    // the gap
    const holeEnd = Math.round((gp.x + gp.w) / TS);
    for (; i < holeEnd && i < n; i++) {
      holes[i] = true;
      heights[i] = BASE;
    }

    // flat landing shelf back at pre-ramp height
    for (let k = 0; k < 12 && i < n; k++, i++) {
      heights[i] = h0;
      holes[i] = false;
    }
    h = h0;
    slope = 0;
  }

  while (i < n) walk();

  // flat run-out + finish straight
  const finStart = Math.round((length - 170) / TS);
  for (let k = Math.max(0, finStart); k < n; k++) {
    if (k > Math.round((length + 380) / TS)) break;
    heights[k] = BASE;
    holes[k] = false;
  }

  const stage: Stage = { heights, holes, logs: [], checkpoints: [], finish: length };

  const solid = (x: number) => heightAt(stage, x) !== null;
  const farFromGaps = (x: number) =>
    gaps.every((gp) => x < gp.x - 70 || x > gp.x + gp.w + 90);

  // logs rolled onto the trail
  const logCount = idx;
  for (let k = 0; k < logCount; k++) {
    let x = 540 + (k * (length - 1150)) / Math.max(1, logCount) + (rand() - 0.5) * 90;
    for (let tries = 0; tries < 40; tries++) {
      if (solid(x) && farFromGaps(x) && stage.logs.every((l) => Math.abs(l.x - x) > 220)) {
        break;
      }
      x += 36;
    }
    const gy = heightAt(stage, x);
    if (gy !== null) stage.logs.push({ x, y: gy, r: 15 + rand() * 6 });
  }

  // checkpoints sit on safe, solid ground between the gaps
  for (const f of [0.3, 0.55, 0.8]) {
    let x = length * f;
    for (let tries = 0; tries < 60; tries++) {
      if (
        solid(x) &&
        farFromGaps(x) &&
        stage.logs.every((l) => Math.abs(l.x - x) > 70) &&
        x > 300
      ) {
        break;
      }
      x += 14;
    }
    if (solid(x)) stage.checkpoints.push(x);
  }

  return stage;
}

function heightAt(st: Stage, x: number): number | null {
  if (x < 0) return null;
  const f = x / TS;
  const i = Math.floor(f);
  const a = st.heights[i];
  const b = st.heights[i + 1];
  if (a === undefined || b === undefined) return null;
  if (st.holes[i] || st.holes[i + 1]) return null;
  const t = 0.5 - 0.5 * Math.cos(Math.PI * (f - i));
  return a + (b - a) * t;
}

/** Terrain plus any log rolling over it. `null` = open air above a gap. */
function groundAt(st: Stage, x: number): number | null {
  const base = heightAt(st, x);
  if (base === null) return null;
  let top = base;
  for (const lg of st.logs) {
    const dx = x - lg.x;
    if (Math.abs(dx) < lg.r) {
      const t = lg.y - Math.sqrt(lg.r * lg.r - dx * dx);
      if (t < top) top = t;
    }
  }
  return top;
}

function slopeAngle(st: Stage, x: number): number {
  const a = groundAt(st, x - WB);
  const b = groundAt(st, x + WB);
  if (a === null || b === null) return 0;
  return Math.atan2(b - a, WB * 2);
}

function spawnBike(g: TrialGame, x: number) {
  const gy = groundAt(g.st, x) ?? BASE;
  g.x = x;
  g.y = gy - (WHEEL_Y + R + 14);
  g.vx = 0;
  g.vy = 0;
  g.ang = slopeAngle(g.st, x);
  g.angVel = 0;
  g.spin = 0;
  g.grounded = false;
  g.airTime = 0;
}

function loadStage(g: TrialGame, idx: number) {
  g.stage = idx;
  g.st = buildStage(idx);
  g.cpIdx = 0;
  g.cpX = START_X;
  g.stageStart = g.time;
  g.done = false;
  spawnBike(g, START_X);
}

function createGame(): TrialGame {
  const st = buildStage(1);
  const g: TrialGame = {
    x: START_X,
    y: BASE - 40,
    vx: 0,
    vy: 0,
    ang: 0,
    angVel: 0,
    spin: 0,
    grounded: false,
    airTime: 0,
    stage: 1,
    stageStart: 0,
    st,
    cpIdx: 0,
    cpX: START_X,
    time: 0,
    camX: 0,
    toast: "",
    toastT: 0,
    shake: 0,
    flash: 0,
    parts: [],
    done: false,
  };
  spawnBike(g, START_X);
  return g;
}

function burst(g: TrialGame, x: number, y: number, n: number, color: string, spread: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = spread * (0.35 + Math.random() * 0.9);
    g.parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.45 + Math.random() * 0.5,
      max: 1,
      r: 1.5 + Math.random() * 2.5,
      c: color,
    });
  }
}

const TONE = "from-rose-400 via-pink-500 to-fuchsia-600";

export default function MotoTrial({ gameId = "moto-trial" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<TrialGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [hudT, setHudT] = useState(0);
  const [stageNo, setStageNo] = useState(1);
  const [cleared, setCleared] = useState({ stage: 1, lap: 0, total: 0 });
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "low");
  const inputRef = useRef({ gas: false, brake: false });
  const pointersRef = useRef(new Map<number, "gas" | "brake">());
  const tenthRef = useRef(-1);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    const st = g.st;
    const camX = g.camX;
    const sx = (Math.random() - 0.5) * g.shake;
    const sy = (Math.random() - 0.5) * g.shake;

    // dusk sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#1b0424");
    sky.addColorStop(0.55, "#5c0f3a");
    sky.addColorStop(1, "#c2415e");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // low sun
    ctx.save();
    ctx.shadowColor = "#fb7185";
    ctx.shadowBlur = 44;
    ctx.fillStyle = "rgba(251,113,133,0.9)";
    ctx.beginPath();
    ctx.arc(W - 150 - camX * 0.02, 104, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // parallax ridges
    const ridge = (factor: number, baseY: number, amp: number, color: string, phase: number) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let px = 0; px <= W; px += 14) {
        const wx = (px + camX * factor) * 0.0055 + phase;
        ctx.lineTo(px, baseY + Math.sin(wx) * amp + Math.sin(wx * 2.7) * amp * 0.45);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    };
    ridge(0.1, 168, 30, "rgba(190,24,93,0.55)", 0);
    ridge(0.26, 206, 36, "rgba(76,7,40,0.9)", 2.1);

    ctx.save();
    ctx.translate(-camX + sx, sy);

    // logs (drawn before the ground so the dirt half-buries them)
    for (const lg of st.logs) {
      if (lg.x < camX - 60 || lg.x > camX + W + 60) continue;
      ctx.fillStyle = "#6b3f1d";
      ctx.beginPath();
      ctx.arc(lg.x, lg.y, lg.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(251,191,36,0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lg.x, lg.y, lg.r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(lg.x, lg.y, lg.r * 0.22, 0, Math.PI * 2);
      ctx.stroke();
    }

    // terrain — one filled segment per solid stretch so gaps stay open
    const x0 = camX - 30;
    const x1 = camX + W + 30;
    const fill = new Path2D();
    const line = new Path2D();
    let seg: number[] = [];
    const flush = (lastX: number) => {
      if (seg.length > 1) {
        const firstX = seg[0];
        fill.moveTo(firstX, H + 260);
        for (let k = 0; k < seg.length; k += 2) fill.lineTo(seg[k], seg[k + 1]);
        fill.lineTo(lastX, H + 260);
        fill.closePath();
        line.moveTo(seg[0], seg[1]);
        for (let k = 2; k < seg.length; k += 2) line.lineTo(seg[k], seg[k + 1]);
      }
      seg = [];
    };
    let prevX = x0;
    for (let px = x0; px <= x1; px += 4) {
      const gy = heightAt(st, px);
      if (gy === null) {
        flush(prevX);
      } else {
        seg.push(px, gy);
      }
      prevX = px;
    }
    flush(prevX);

    ctx.fillStyle = "#200d1c";
    ctx.fill(fill);
    ctx.save();
    ctx.strokeStyle = "#fb7185";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#f43f5e";
    ctx.shadowBlur = 12;
    ctx.stroke(line);
    ctx.restore();

    // gap walls glow red
    ctx.save();
    ctx.strokeStyle = "rgba(244,63,94,0.65)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    let gapRun = false;
    for (let px = x0; px <= x1; px += 4) {
      const isGap = heightAt(st, px) === null;
      if (isGap && !gapRun) {
        gapRun = true;
        ctx.beginPath();
        ctx.moveTo(px, BASE + 30);
        ctx.lineTo(px, H - 4);
      } else if (!isGap && gapRun) {
        gapRun = false;
        ctx.stroke();
      }
    }
    if (gapRun) ctx.stroke();
    ctx.restore();

    // checkpoints
    st.checkpoints.forEach((cx, k) => {
      if (cx < camX - 60 || cx > camX + W + 60) return;
      const gy = groundAt(st, cx) ?? BASE;
      const passed = k < g.cpIdx;
      ctx.strokeStyle = passed ? "#34d399" : "rgba(34,211,238,0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, gy);
      ctx.lineTo(cx, gy - 44);
      ctx.stroke();
      const wave = Math.sin(time / 240 + k) * 3;
      ctx.fillStyle = passed ? "#34d399" : "#22d3ee";
      ctx.shadowColor = passed ? "#34d399" : "#22d3ee";
      ctx.shadowBlur = passed ? 6 : 14;
      ctx.beginPath();
      ctx.moveTo(cx, gy - 44);
      ctx.lineTo(cx + 24, gy - 37 + wave);
      ctx.lineTo(cx, gy - 30);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // finish flag
    if (st.finish > camX - 80 && st.finish < camX + W + 80) {
      const fy = groundAt(st, st.finish) ?? BASE;
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(st.finish, fy + 2);
      ctx.lineTo(st.finish, fy - 66);
      ctx.stroke();
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? "#0b0b16" : "#f8fafc";
          ctx.fillRect(st.finish + c * 8, fy - 66 + r * 8, 8, 8);
        }
      }
      ctx.font = "bold 12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(248,250,252,0.85)";
      ctx.fillText("FINISH", st.finish + 16, fy - 74);
    }

    // dust + crash sparks
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // bike
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.ang);
    // frame
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-WB, -2);
    ctx.lineTo(2, -8);
    ctx.lineTo(WB, -4);
    ctx.stroke();
    // seat + tank
    ctx.fillStyle = "#e11d48";
    ctx.shadowColor = "#f43f5e";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(-WB - 4, -14, 30, 9, 4);
    ctx.fill();
    ctx.fillStyle = "#f43f5e";
    ctx.beginPath();
    ctx.roundRect(-4, -16, 24, 11, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    // bars
    ctx.strokeStyle = "#0b0b16";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(WB - 4, -6);
    ctx.lineTo(WB - 2, -20);
    ctx.stroke();
    // rider
    ctx.strokeStyle = "#0b0b16";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-6, -14);
    ctx.lineTo(4, -26);
    ctx.stroke();
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.arc(7, -30, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0b16";
    ctx.beginPath();
    ctx.arc(9, -30, 6, -Math.PI * 0.6, Math.PI * 0.65);
    ctx.fill();
    // wheels
    for (const ox of [-WB, WB]) {
      ctx.save();
      ctx.translate(ox, WHEEL_Y);
      ctx.rotate(g.spin);
      ctx.fillStyle = "#0b0b16";
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      for (let s = 0; s < 3; s++) {
        const a = (s * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (R - 3), Math.sin(a) * (R - 3));
        ctx.lineTo(-Math.cos(a) * (R - 3), -Math.sin(a) * (R - 3));
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();

    // floating toast
    if (g.toastT > 0) {
      const a = Math.min(1, g.toastT * 2);
      ctx.font = "bold 18px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.shadowColor = "#f43f5e";
      ctx.shadowBlur = 14;
      ctx.fillText(g.toast, g.x, g.y - 70 - (1 - a) * 18);
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(244,63,94,${Math.min(0.6, g.flash)})`;
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
    burst(g, g.x, g.y - 20, 26, "#fde68a", 240);
    const total = Math.round(g.time * 10) / 10;
    setHudT(Math.floor(total * 10));
    tenthRef.current = Math.floor(total * 10);
    if (g.stage >= STAGES) {
      setNewBest(submit(total));
      setStatus("over");
    } else {
      setCleared({
        stage: g.stage,
        lap: Math.round((g.time - g.stageStart) * 10) / 10,
        total,
      });
      setStatus("clear");
    }
    draw(performance.now());
  }, [draw, submit]);

  const crash = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.done) return;
    burst(g, g.x, g.y - 10, 26, "#fb7185", 260);
    g.shake = 18;
    g.flash = 0.7;
    g.time += PENALTY;
    g.toast = `WIPEOUT +${PENALTY}s`;
    g.toastT = 1.6;
    spawnBike(g, g.cpX);
    g.camX = clamp(g.x - W * 0.34, 0, g.st.finish + TAIL - W);
  }, []);

  const step = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.done) return;
    const dt = STEP / 1000;
    const st = g.st;

    const gas = inputRef.current.gas;
    const brake = inputRef.current.brake;
    const throttle = gas ? 1 : brake ? -1 : 0;

    const cosA = Math.cos(g.ang);
    const sinA = Math.sin(g.ang);
    let fx = 0;
    let fy = 0;
    let tq = 0;
    let grounded = false;

    const wheels: Array<[number, boolean]> = [
      [-WB, true],
      [WB, false],
    ];
    for (const [ox, isRear] of wheels) {
      const oy = WHEEL_Y;
      const rx = ox * cosA - oy * sinA;
      const ry = ox * sinA + oy * cosA;
      const wx = g.x + rx;
      const wy = g.y + ry;
      const ground = groundAt(st, wx);
      if (ground === null) continue;
      const pen = wy + R - ground;
      if (pen <= 0) continue;
      grounded = true;
      const vpy = g.vy + g.angVel * rx;
      let aN = SPRING * pen - SPRING_DAMP * vpy;
      if (aN < 0) aN = 0;
      fy -= aN;
      tq += rx * -aN;
      if (throttle !== 0 && isRear) {
        const mag = throttle > 0 ? DRIVE : REVERSE;
        const dir = throttle > 0 ? 1 : -1;
        const fwx = dir * mag * cosA;
        const fwy = dir * mag * sinA;
        fx += fwx;
        fy += fwy;
        tq += rx * fwy - ry * fwx;
      }
      fx -= g.vx * 0.35;
    }

    if (!grounded) {
      // → leans the nose down, ← leans it back (spec control scheme)
      g.angVel += throttle * 2.2 * dt;
    }

    g.vy += GRAVITY * dt;
    g.vx += fx * dt;
    g.vy += fy * dt;
    g.angVel += (tq / INERTIA) * dt;
    g.angVel *= 1 - (grounded ? 4.5 : 0.9) * dt;
    g.vx = clamp(g.vx, -250, 470);

    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.ang += g.angVel * dt;
    if (g.ang > Math.PI * 2 || g.ang < -Math.PI * 2) g.ang %= Math.PI * 2;
    g.spin += (g.vx / R) * dt;

    if (g.x < 30) {
      g.x = 30;
      g.vx = Math.max(0, g.vx);
    }

    // landing bookkeeping (before the crash test so a slam never pays out)
    let stuckLanding = false;
    if (grounded) {
      if (g.airTime > 0.5) {
        const tilt = Math.abs(g.ang - slopeAngle(st, g.x));
        stuckLanding = tilt < 0.32;
      }
      g.airTime = 0;
    } else {
      g.airTime += dt;
    }

    // rider head into the dirt (or into a hill) = wipeout
    const hx = g.x + 2 * cosA + HEAD_UP * sinA;
    const hy = g.y + 2 * sinA - HEAD_UP * cosA;
    const headGround = groundAt(st, hx);
    if ((headGround !== null && hy + 4 > headGround) || g.y > BASE + 340) {
      crash();
      return;
    }

    if (stuckLanding) {
      g.time = Math.max(0, g.time - CLEAN);
      g.toast = `STUCK LANDING -${CLEAN}s`;
      g.toastT = 1.3;
      g.shake = Math.max(g.shake, 5);
      burst(g, g.x, g.y + 16, 12, "#fde68a", 150);
    }

    // checkpoints
    while (g.cpIdx < st.checkpoints.length && g.x >= st.checkpoints[g.cpIdx]) {
      g.cpX = st.checkpoints[g.cpIdx] + 26;
      g.cpIdx += 1;
      g.toast = `CHECKPOINT ${g.cpIdx}/${st.checkpoints.length}`;
      g.toastT = 1.2;
      burst(g, g.x, g.y - 24, 14, "#22d3ee", 170);
    }

    // finish line
    if (g.x >= st.finish) {
      finishStage();
      return;
    }

    // dust kicking up behind the rear wheel
    if (grounded && Math.abs(g.vx) > 110 && Math.random() < 0.45) {
      const rx2 = -WB * cosA - WHEEL_Y * sinA;
      const gy = groundAt(st, g.x + rx2) ?? BASE;
      g.parts.push({
        x: g.x + rx2,
        y: gy - 2,
        vx: -g.vx * 0.22 + (Math.random() - 0.5) * 40,
        vy: -30 - Math.random() * 45,
        life: 0.55,
        max: 0.55,
        r: 2 + Math.random() * 2.5,
        c: "#fbcfe8",
      });
    }
    for (let i = 0; i < g.parts.length; i++) {
      const p = g.parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.life -= dt;
    }
    if (g.parts.length > 140) g.parts.splice(0, g.parts.length - 140);
    g.parts = g.parts.filter((p) => p.life > 0);

    g.toastT = Math.max(0, g.toastT - dt);
    g.shake = Math.max(0, g.shake - 0.7);
    g.flash = Math.max(0, g.flash - 0.035);
    g.time += dt;

    const targetCam = clamp(g.x - W * 0.34, 0, st.finish + TAIL - W);
    g.camX += (targetCam - g.camX) * 0.12;

    const tenth = Math.floor(g.time * 10);
    if (tenth !== tenthRef.current) {
      tenthRef.current = tenth;
      setHudT(tenth);
    }
  }, [crash, finishStage]);

  const start = useCallback(() => {
    const g = createGame();
    gameRef.current = g;
    inputRef.current.gas = false;
    inputRef.current.brake = false;
    pointersRef.current.clear();
    tenthRef.current = 0;
    setHudT(0);
    setStageNo(1);
    setNewBest(false);
    setStatus("playing");
    draw(performance.now());
  }, [draw]);

  const advance = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    loadStage(g, g.stage + 1);
    inputRef.current.gas = false;
    inputRef.current.brake = false;
    pointersRef.current.clear();
    setStageNo(g.stage);
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
    const MAP: Record<string, "gas" | "brake"> = {
      ArrowRight: "gas",
      d: "gas",
      ArrowLeft: "brake",
      a: "brake",
    };
    const sync = () => {
      const p = pointersRef.current;
      let gas = false;
      let brake = false;
      p.forEach((side) => {
        if (side === "gas") gas = true;
        else brake = true;
      });
      inputRef.current.gas = gas || keyRef.gas;
      inputRef.current.brake = brake || keyRef.brake;
    };
    const keyRef = { gas: false, brake: false };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const side = MAP[k];
      if (side) {
        e.preventDefault();
        keyRef[side] = true;
        sync();
        return;
      }
      if (k === " " || k === "Enter") {
        e.preventDefault();
        if (status === "playing") return;
        if (status === "clear") advance();
        else start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const side = MAP[k];
      if (side) {
        keyRef[side] = false;
        sync();
      }
    };
    const onBlur = () => {
      keyRef.gas = false;
      keyRef.brake = false;
      sync();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [status, start, advance]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (status === "clear") {
      advance();
      return;
    }
    if (status !== "playing") {
      start();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const side = e.clientX - rect.left < rect.width / 2 ? "brake" : "gas";
    pointersRef.current.set(e.pointerId, side);
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointersRef.current;
    let gas = false;
    let brake = false;
    p.forEach((s) => (s === "gas" ? (gas = true) : (brake = true)));
    inputRef.current.gas = gas;
    inputRef.current.brake = brake;
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    const p = pointersRef.current;
    let gas = false;
    let brake = false;
    p.forEach((s) => (s === "gas" ? (gas = true) : (brake = true)));
    inputRef.current.gas = gas;
    inputRef.current.brake = brake;
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[680px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Time <b className="ml-1 text-sm text-ink">{(hudT / 10).toFixed(1)}s</b>
        </span>
        <span>
          Stage <b className="ml-1 text-sm text-ink">{stageNo}/{STAGES}</b>
        </span>
        <span className="text-warn">
          Best{" "}
          <b className="ml-1 text-sm text-ink">
            {best === null ? "—" : `${best.toFixed(1)}s`}
          </b>
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(244,63,94,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full [touch-action:none]"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          aria-label="Moto Trial side-view motorcycle trials"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">MOTO TRIAL</p>
            <p className="mt-2 text-sm text-muted">
              Five stages of ramps, gaps and logs. Balance the bike in the air, land
              both wheels clean, and reach the flag with the clock still on your side.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start engine
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              → gas · ← brake / lean back · hold a screen half on touch
            </p>
          </Overlay>
        )}

        {status === "clear" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              STAGE {cleared.stage} CLEAR
            </p>
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {cleared.lap.toFixed(1)}s
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Total {cleared.total.toFixed(1)}s · wipeouts cost 3s each
            </p>
            <PrimaryButton onClick={advance} tone={TONE}>
              Next stage
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Stage {cleared.stage + 1} rolls out longer and meaner
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              ALL {STAGES} STAGES CLEARED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best time!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {(hudT / 10).toFixed(1)}s
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Clean runs only cost the crashes · Best{" "}
              {best === null ? "—" : `${best.toFixed(1)}s`}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Ride again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        → gas · ← brake — in the air → noses the bike down and ← lifts it · each wipeout
        costs 3s from the last checkpoint
      </p>
    </div>
  );
}
