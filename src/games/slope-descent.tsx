"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 440;
const H = 620;
const HORIZON = H * 0.3; // 186
const K = 100; // px per world unit at z = 1
const C = H + 60 - HORIZON; // depth → screen y
const Z_BALL = 1.35; // where the rider sits
const Z_FAR = 44;
const Z_NEAR = 1;
const ROAD_HALF = 1.9;
const BARRIER = 2.5;
const BALL_R = 22;
const STEP = 1000 / 60;
const ORB_VALUE = 50;

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

type Entity =
  | { kind: "gate"; z0: number; segs: Array<[number, number]>; hit: boolean; dead: boolean }
  | { kind: "orb"; z0: number; lat: number; hit: boolean; dead: boolean };

interface SlopeGame {
  lat: number;
  lv: number;
  travel: number;
  speed: number;
  curve: number;
  curveT: number;
  nextAt: number;
  orbs: number;
  ents: Entity[];
  parts: Particle[];
  shake: number;
  flash: number;
  toast: string;
  toastT: number;
  alive: boolean;
}

const projY = (z: number) => HORIZON + C / z;
const scaleAt = (z: number) => Z_BALL / z;
const offW = (curve: number, z: number) => {
  const d = z - Z_BALL;
  return curve * d * d * 0.012;
};
const projX = (lat: number, z: number, curve: number) =>
  W / 2 + (offW(curve, z) + lat) * (K / z);

function scoreOf(g: SlopeGame): number {
  return Math.floor(g.travel * 4) + g.orbs * ORB_VALUE;
}

function spawnGap(travel: number): number {
  return Math.max(3.4, 8.6 - travel * 0.0042);
}

function gatePattern(travel: number): Array<[number, number]> {
  const easy: Array<Array<[number, number]>> = [
    [[-2.6, -0.35]],
    [[0.35, 2.6]],
    [[-2.6, -1.05], [1.05, 2.6]],
    [[-1.0, 1.0]],
  ];
  const hard: Array<Array<[number, number]>> = [
    [[-2.6, 0.35]],
    [[-0.35, 2.6]],
    [[-2.6, -1.25], [0.45, 2.6]],
    [[-1.35, 1.35]],
  ];
  const pool = travel < 520 ? easy : travel < 1100 ? (Math.random() < 0.6 ? easy : hard) : hard;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick.map(([a, b]) => [a, b] as [number, number]);
}

function spawn(g: SlopeGame) {
  if (Math.random() < 0.55) {
    const n = 2 + Math.floor(Math.random() * 3);
    const lat = (Math.random() * 3.4 - 1.7) * 0.95;
    for (let i = 0; i < n; i++) {
      g.ents.push({ kind: "orb", z0: g.travel + Z_FAR * 0.94 + i * 1.25, lat, hit: false, dead: false });
    }
    return (n - 1) * 1.25;
  }
  g.ents.push({
    kind: "gate",
    z0: g.travel + Z_FAR * 0.94,
    segs: gatePattern(g.travel),
    hit: false,
    dead: false,
  });
  return 0;
}

function burst(g: SlopeGame, x: number, y: number, n: number, color: string, spread: number) {
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
      r: 1.5 + Math.random() * 3,
      c: color,
    });
  }
}

function createGame(): SlopeGame {
  return {
    lat: 0,
    lv: 0,
    travel: 0,
    speed: 6,
    curve: 0,
    curveT: 0,
    nextAt: 0,
    orbs: 0,
    ents: [],
    parts: [],
    shake: 0,
    flash: 0,
    toast: "",
    toastT: 0,
    alive: true,
  };
}

const TONE = "from-lime-400 via-green-500 to-emerald-600";

export default function SlopeDescent({ gameId = "slope-descent" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<SlopeGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [hudSpeed, setHudSpeed] = useState(78);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const inputRef = useRef({ left: false, right: false });
  const pointersRef = useRef(new Map<number, "left" | "right">());
  const lastScoreRef = useRef(0);
  const lastSpeedRef = useRef(78);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const shakeX = (Math.random() - 0.5) * g.shake;
    const shakeY = (Math.random() - 0.5) * g.shake;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 40);
    sky.addColorStop(0, "#04110d");
    sky.addColorStop(0.6, "#0a2418");
    sky.addColorStop(1, "#14532d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HORIZON + 40);

    // aurora bands
    for (let i = 0; i < 3; i++) {
      const a = 0.05 + Math.sin(time / 1400 + i) * 0.03;
      ctx.strokeStyle = `rgba(134,239,172,${a})`;
      ctx.lineWidth = 10 + i * 6;
      ctx.beginPath();
      const y = 46 + i * 34;
      ctx.moveTo(-20, y);
      ctx.bezierCurveTo(W * 0.3, y - 26, W * 0.7, y + 24, W + 20, y - 8);
      ctx.stroke();
    }

    // horizon glow
    const glow = ctx.createLinearGradient(0, HORIZON - 46, 0, HORIZON + 12);
    glow.addColorStop(0, "rgba(74,222,128,0)");
    glow.addColorStop(1, "rgba(74,222,128,0.35)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, HORIZON - 46, W, 58);

    // ridges, drifting with the road's curve
    const ridge = (factor: number, amp: number, color: string, phase: number) => {
      const shift = offW(g.curve, Z_FAR) * 0.7 * factor;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-30, HORIZON + 6);
      for (let px = -30; px <= W + 30; px += 12) {
        const t = (px + shift) * 0.02 + phase;
        ctx.lineTo(px, HORIZON - amp * (0.55 + Math.sin(t) * 0.45 + Math.sin(t * 2.3) * 0.2));
      }
      ctx.lineTo(W + 30, HORIZON + 6);
      ctx.closePath();
      ctx.fill();
    };
    ridge(1.6, 40, "#06281c", 0);
    ridge(2.6, 24, "#04150f", 1.7);

    // ground
    const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
    ground.addColorStop(0, "#06110d");
    ground.addColorStop(1, "#0a0f1d");
    ctx.fillStyle = ground;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // speed rays out of the vanishing point
    const vpX = W / 2 + offW(g.curve, Z_FAR) * (K / Z_FAR);
    ctx.strokeStyle = `rgba(167,243,208,${0.05 + Math.min(0.1, g.speed * 0.006)})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + time * 0.00012;
      const len = 120 + ((i * 97 + g.travel * 12) % 160);
      ctx.beginPath();
      ctx.moveTo(vpX + Math.cos(a) * 26, HORIZON + Math.sin(a) * 10);
      ctx.lineTo(vpX + Math.cos(a) * len, HORIZON + Math.abs(Math.sin(a)) * len * 0.9 + 8);
      ctx.stroke();
    }

    // road surface
    const N = 34;
    const left: Array<[number, number]> = [];
    const right: Array<[number, number]> = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const z = Math.exp(Math.log(Z_FAR) + (Math.log(Z_NEAR) - Math.log(Z_FAR)) * t);
      left.push([projX(-ROAD_HALF, z, g.curve), projY(z)]);
      right.push([projX(ROAD_HALF, z, g.curve), projY(z)]);
    }
    ctx.beginPath();
    left.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    const road = ctx.createLinearGradient(0, HORIZON, 0, H);
    road.addColorStop(0, "#121a2b");
    road.addColorStop(1, "#1b2440");
    ctx.fillStyle = road;
    ctx.fill();

    // neon edges
    ctx.save();
    ctx.strokeStyle = "#a3e635";
    ctx.shadowColor = "#84cc16";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    for (const line of [left, right]) {
      ctx.beginPath();
      line.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
      ctx.stroke();
    }
    ctx.restore();

    // centre dashes + marker posts
    const spacing = 2.4;
    const m0 = Math.ceil(g.travel / spacing);
    for (let m = m0; m * spacing - g.travel < Z_FAR; m++) {
      const z = m * spacing - g.travel;
      if (z < Z_NEAR) continue;
      const sc = scaleAt(z);
      const cx = projX(0, z, g.curve);
      const cy = projY(z);
      const fade = Math.min(1, (Z_FAR - z) / 12);
      ctx.globalAlpha = 0.55 * fade;
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(cx - 2 * sc, cy - 1, 4 * sc, Math.max(1, 4 * sc));
      const col = m % 2 === 0 ? "#22d3ee" : "#f472b6";
      for (const side of [-1, 1]) {
        const px = projX(side * (ROAD_HALF + 0.32), z, g.curve);
        ctx.fillStyle = col;
        ctx.fillRect(px - 1.5 * sc, cy - 14 * sc, 3 * sc, 14 * sc);
      }
      ctx.globalAlpha = 1;
    }

    // entities, far → near
    const sorted = [...g.ents].sort((a, b) => b.z0 - a.z0);
    for (const e of sorted) {
      const z = e.z0 - g.travel;
      if (z < 0.75 || z > Z_FAR + 1 || e.dead) continue;
      const sc = scaleAt(z);
      const cy = projY(z);

      if (e.kind === "gate") {
        for (const [a, b] of e.segs) {
          const xa = projX(a, z, g.curve);
          const xb = projX(b, z, g.curve);
          const hgt = 46 * sc;
          const grad = ctx.createLinearGradient(0, cy - hgt, 0, cy);
          grad.addColorStop(0, "rgba(248,113,113,0.95)");
          grad.addColorStop(1, "rgba(190,18,60,0.75)");
          ctx.save();
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = 16 * Math.min(1, sc);
          ctx.fillStyle = grad;
          ctx.fillRect(xa, cy - hgt, xb - xa, hgt);
          ctx.restore();
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          ctx.fillRect(xa, cy - hgt, xb - xa, Math.max(1, 3 * sc));
          // posts
          ctx.fillStyle = "#fca5a5";
          ctx.fillRect(xa - 2 * sc, cy - hgt, Math.max(1, 4 * sc), hgt);
          ctx.fillRect(xb - 2 * sc, cy - hgt, Math.max(1, 4 * sc), hgt);
        }
      } else {
        const bob = Math.sin(time / 220 + e.z0) * 4 * sc;
        const ox = projX(e.lat, z, g.curve);
        const oy = cy - 26 * sc + bob;
        const r = 13 * sc;
        ctx.save();
        ctx.shadowColor = "#fde047";
        ctx.shadowBlur = 18 * Math.min(1, sc + 0.3);
        const orb = ctx.createRadialGradient(ox - r * 0.3, oy - r * 0.3, r * 0.15, ox, oy, r);
        orb.addColorStop(0, "#fef9c3");
        orb.addColorStop(0.5, "#fde047");
        orb.addColorStop(1, "#f59e0b");
        ctx.fillStyle = orb;
        ctx.beginPath();
        ctx.arc(ox, oy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // trail streaks behind the ball
    const bx = projX(g.lat, Z_BALL, g.curve);
    const by = projY(Z_BALL);
    const lean = Math.max(-1, Math.min(1, g.lv / 6));
    for (let i = 1; i <= 5; i++) {
      const f = i / 5;
      ctx.globalAlpha = 0.22 * (1 - f);
      ctx.fillStyle = "#6ee7b7";
      ctx.beginPath();
      ctx.ellipse(
        bx - lean * i * 13,
        by + i * 5,
        BALL_R * (1 - f * 0.4),
        BALL_R * (1 - f * 0.55),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // shadow + ball
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(bx, by + BALL_R * 0.85, BALL_R * 0.95, BALL_R * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = "#34d399";
    ctx.shadowBlur = 26;
    const ball = ctx.createRadialGradient(
      bx - BALL_R * 0.35,
      by - BALL_R * 0.4,
      BALL_R * 0.15,
      bx,
      by,
      BALL_R,
    );
    ball.addColorStop(0, "#ecfdf5");
    ball.addColorStop(0.45, "#4ade80");
    ball.addColorStop(1, "#047857");
    ctx.fillStyle = ball;
    ctx.beginPath();
    ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(bx - BALL_R * 0.32, by - BALL_R * 0.38, BALL_R * 0.22, 0, Math.PI * 2);
    ctx.fill();

    // particles
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (g.toastT > 0) {
      const a = Math.min(1, g.toastT * 2);
      ctx.font = "bold 26px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(253,224,71,${a})`;
      ctx.shadowColor = "#fde047";
      ctx.shadowBlur = 16;
      ctx.fillText(g.toast, W / 2, by - 74 - (1 - a) * 22);
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(239,68,68,${Math.min(0.65, g.flash)})`;
      ctx.fillRect(0, 0, W, H);
      if (!g.alive) {
        ctx.font = "56px serif";
        ctx.textAlign = "center";
        ctx.fillText("💥", W / 2, H / 2);
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

  const wipeout = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;
    g.alive = false;
    g.shake = 18;
    g.flash = 0.9;
    const bx = projX(g.lat, Z_BALL, g.curve);
    const by = projY(Z_BALL);
    burst(g, bx, by, 34, "#f87171", 300);
    burst(g, bx, by, 16, "#fde047", 220);
    const final = scoreOf(g);
    setScore(final);
    setNewBest(submit(final));
    setStatus("over");
    draw(performance.now());
  }, [draw, submit]);

  const step = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;
    const dt = STEP / 1000;

    g.travel += g.speed * dt;
    g.speed = Math.min(19.5, g.speed + (0.5 + g.travel * 0.0011) * dt);

    // the slope leans harder the further you fall
    g.curveT -= dt;
    if (g.curveT <= 0) {
      g.curveT = 3.5 + Math.random() * 3;
      g.curve = (Math.random() * 2 - 1) * Math.min(1, 0.35 + g.travel * 0.0011);
    }

    // steering with a little momentum
    const steer = (inputRef.current.right ? 1 : 0) - (inputRef.current.left ? 1 : 0);
    g.lv += steer * 7.6 * dt;
    g.lv -= g.lv * 2.4 * dt;
    g.lv -= Math.sign(g.lv) * Math.min(Math.abs(g.lv), 1.6 * dt);
    g.lat += g.lv * dt;

    if (g.lat > BARRIER) {
      g.lat = BARRIER;
      g.lv = -Math.abs(g.lv) * 0.35;
      g.shake = Math.max(g.shake, 5);
      burst(g, projX(BARRIER, Z_BALL, g.curve), projY(Z_BALL) + 10, 6, "#f472b6", 130);
    } else if (g.lat < -BARRIER) {
      g.lat = -BARRIER;
      g.lv = Math.abs(g.lv) * 0.35;
      g.shake = Math.max(g.shake, 5);
      burst(g, projX(-BARRIER, Z_BALL, g.curve), projY(Z_BALL) + 10, 6, "#f472b6", 130);
    }

    // scraping the verge scrubs speed
    if (Math.abs(g.lat) > ROAD_HALF) {
      g.speed = Math.max(4.5, g.speed - 4.2 * dt);
    }

    // spawn stream
    while (g.travel >= g.nextAt) {
      const extra = spawn(g);
      g.nextAt += spawnGap(g.travel) + extra;
    }

    // collisions at the rider's plane
    for (let ei = 0; ei < g.ents.length; ei++) {
      const e = g.ents[ei];
      if (e.dead || e.hit) continue;
      const z = e.z0 - g.travel;
      if (z > Z_BALL) continue;
      e.hit = true;
      if (e.kind === "orb") {
        if (Math.abs(e.lat - g.lat) < 0.5) {
          e.dead = true;
          g.orbs += 1;
          g.toast = `+${ORB_VALUE}`;
          g.toastT = 0.9;
          const px = projX(e.lat, Z_BALL, g.curve);
          burst(g, px, projY(Z_BALL) - 24, 14, "#fde047", 200);
        }
      } else {
        const grazed = e.segs.some(
          ([a, b]) => g.lat > a - 0.29 && g.lat < b + 0.29,
        );
        if (grazed) {
          wipeout();
          return;
        }
      }
    }
    g.ents = g.ents.filter((e) => e.z0 - g.travel > 0.75 && !e.dead);

    for (let i = 0; i < g.parts.length; i++) {
      const p = g.parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      p.life -= dt;
    }
    if (g.parts.length > 160) g.parts.splice(0, g.parts.length - 160);
    g.parts = g.parts.filter((p) => p.life > 0);

    g.shake = Math.max(0, g.shake - 0.7);
    g.flash = Math.max(0, g.flash - 0.035);
    g.toastT = Math.max(0, g.toastT - dt);

    const s = scoreOf(g);
    if (s !== lastScoreRef.current) {
      lastScoreRef.current = s;
      setScore(s);
    }
    const kmh = Math.round(g.speed * 13);
    if (kmh !== lastSpeedRef.current) {
      lastSpeedRef.current = kmh;
      setHudSpeed(kmh);
    }
  }, [wipeout]);

  const start = useCallback(() => {
    gameRef.current = createGame();
    inputRef.current.left = false;
    inputRef.current.right = false;
    pointersRef.current.clear();
    lastScoreRef.current = 0;
    lastSpeedRef.current = 78;
    setScore(0);
    setHudSpeed(78);
    setNewBest(false);
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
    const MAP: Record<string, "left" | "right"> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      a: "left",
      d: "right",
    };
    const sync = () => {
      const p = pointersRef.current;
      let left = false;
      let right = false;
      p.forEach((side) => {
        if (side === "left") left = true;
        else right = true;
      });
      inputRef.current.left = left || keyRef.left;
      inputRef.current.right = right || keyRef.right;
    };
    const keyRef = { left: false, right: false };

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
        if (status !== "playing") start();
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
      keyRef.left = false;
      keyRef.right = false;
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
  }, [status, start]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (status !== "playing") {
      start();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const side = e.clientX - rect.left < rect.width / 2 ? "left" : "right";
    pointersRef.current.set(e.pointerId, side);
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointersRef.current;
    let left = false;
    let right = false;
    p.forEach((s) => (s === "left" ? (left = true) : (right = true)));
    inputRef.current.left = left;
    inputRef.current.right = right;
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    const p = pointersRef.current;
    let left = false;
    let right = false;
    p.forEach((s) => (s === "left" ? (left = true) : (right = true)));
    inputRef.current.left = left;
    inputRef.current.right = right;
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-warn">
          Speed{" "}
          <b className="ml-1 text-sm text-ink">{hudSpeed}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(74,222,128,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full [touch-action:none]"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          aria-label="Slope Descent neon pseudo-3D slope"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">SLOPE DESCENT</p>
            <p className="mt-2 text-sm text-muted">
              A ball, a neon grade that only gets steeper, and no brake. Thread the red
              gates, scoop the glowing orbs, and let the speed do the scoring.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Drop in
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ← / A · → / D to steer · hold a screen half on touch
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">GATE CRASHED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {Math.floor(score / ORB_VALUE)} orbs banked · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Ride again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Red gates end the run · orbs pay 50 · the verge scrubs your speed and the grade
        never eases
      </p>
    </div>
  );
}
