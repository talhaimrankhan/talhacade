"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 640;
const H = 480;
const STEP = 1000 / 60;
const TAU = Math.PI * 2;

const R = 17; // car collision radius
const X0 = 46; // arena bounds
const Y0 = 52;
const X1 = 594;
const Y1 = 430;

type Status = "idle" | "playing" | "over";

interface Car {
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  av: number; // angular velocity (collision spin)
  hp: number;
  maxHp: number;
  color: string;
  isPlayer: boolean;
  wreck: boolean;
  boosting: boolean;
  boost: number;
  lastHit: number; // index of the car that landed the last blow
  hitT: number;
  phase: number; // ai steering jitter phase
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
  cars: Car[];
  parts: Part[];
  round: number;
  roundT: number;
  wrecks: number;
  shake: number;
  flash: number;
  toast: string;
  toastT: number;
  banner: number;
  bannerText: string;
  time: number;
  hudAcc: number;
  lastScore: number;
  lastRound: number;
  lastHp: number;
  alive: boolean;
}

const AI_COLORS = ["#f472b6", "#a78bfa", "#fbbf24", "#fb7185", "#34d399", "#f97316"];
const SLOTS: [number, number][] = [
  [88, 100],
  [552, 100],
  [88, 384],
  [552, 384],
  [320, 96],
  [320, 388],
];

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

/* static scenery ---------------------------------------------------- */

const STANDS = (() => {
  const rnd = mulberry32(414243);
  const cols = ["#d4d4d8", "#a1a1aa", "#f472b6", "#38bdf8", "#fbbf24", "#86efac"];
  const out: { x: number; y: number; c: string }[] = [];
  for (let i = 0; i < 460; i++) {
    const x = 6 + rnd() * (W - 12);
    const side = rnd();
    const y = side < 0.5 ? 5 + rnd() * 34 : H - 39 + rnd() * 33;
    out.push({ x, y, c: cols[Math.floor(rnd() * cols.length)] });
  }
  return out;
})();

const SCUFFS = (() => {
  const rnd = mulberry32(90210);
  const out: { x: number; y: number; r: number; a0: number; a1: number; w: number }[] = [];
  for (let i = 0; i < 34; i++) {
    const x = X0 + 46 + rnd() * (X1 - X0 - 92);
    const y = Y0 + 46 + rnd() * (Y1 - Y0 - 92);
    const r = 26 + rnd() * 96;
    const a0 = rnd() * TAU;
    out.push({ x, y, r, a0, a1: a0 + 0.5 + rnd() * 1.7, w: 2 + rnd() * 6 });
  }
  return out;
})();

function createGame(): G {
  const g: G = {
    cars: [],
    parts: [],
    round: 1,
    roundT: 0,
    wrecks: 0,
    shake: 0,
    flash: 0,
    toast: "",
    toastT: 0,
    banner: 1.5,
    bannerText: "ROUND 1",
    time: 0,
    hudAcc: 0,
    lastScore: 0,
    lastRound: 1,
    lastHp: 100,
    alive: true,
  };
  g.cars.push({
    x: W / 2,
    y: Y1 - 74,
    a: -Math.PI / 2,
    vx: 0,
    vy: 0,
    av: 0,
    hp: 100,
    maxHp: 100,
    color: "#38bdf8",
    isPlayer: true,
    wreck: false,
    boosting: false,
    boost: 100,
    lastHit: -1,
    hitT: 0,
    phase: 0,
  });
  // opening wave
  for (let i = 0; i < 3; i++) {
    const slot = SLOTS[i % SLOTS.length];
    const hp = 48 + 1 * 12;
    g.cars.push({
      x: slot[0],
      y: slot[1],
      a: Math.atan2(H / 2 - slot[1], W / 2 - slot[0]),
      vx: 0,
      vy: 0,
      av: 0,
      hp,
      maxHp: hp,
      color: AI_COLORS[i % AI_COLORS.length],
      isPlayer: false,
      wreck: false,
      boosting: false,
      boost: 100,
      lastHit: -1,
      hitT: 0,
      phase: i * 2.1,
    });
  }
  return g;
}

/* ---------------- drawing helpers ---------------- */

function drawCarShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: number,
  color: string,
  wreck: boolean,
  hitT: number,
  boosting: boolean,
  t: number,
) {
  const bw = 34;
  const bh = 20;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);

  // ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.beginPath();
  ctx.ellipse(2, 3, R + 3, R - 4, 0, 0, TAU);
  ctx.fill();

  // boost flames (car nose points +x)
  if (boosting) {
    const fl = 10 + Math.sin(t * 0.05) * 4;
    const grd = ctx.createLinearGradient(-bw / 2, 0, -bw / 2 - fl - 8, 0);
    grd.addColorStop(0, "rgba(251,191,36,0.95)");
    grd.addColorStop(1, "rgba(244,63,94,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(-bw / 2, -6);
    ctx.lineTo(-bw / 2 - fl - 8, 0);
    ctx.lineTo(-bw / 2, 6);
    ctx.closePath();
    ctx.fill();
  }

  // body
  ctx.fillStyle = wreck ? "#26262b" : color;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 5);
  ctx.fill();

  if (wreck) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(-bw / 2 + 3, -bh / 2 + 3, 11, 5);
    ctx.fillRect(1, bh / 2 - 8, 12, 4);
    ctx.fillStyle = "rgba(120,113,108,0.5)";
    ctx.fillRect(-4, -3, 9, 3);
  } else {
    // cabin
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(-6, -bh / 2 + 3.5, 15, bh - 7, 3);
    ctx.fill();
    // racing stripe
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(-bw / 2 + 2, -2, bw - 4, 4);
    // headlights
    ctx.fillStyle = "#fde68a";
    ctx.fillRect(bw / 2 - 4, -7.5, 4, 4);
    ctx.fillRect(bw / 2 - 4, 3.5, 4, 4);
    // taillights
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(-bw / 2, -7.5, 3, 4);
    ctx.fillRect(-bw / 2, 3.5, 3, 4);
    // damage flash
    if (hitT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, hitT * 3)})`;
      ctx.beginPath();
      ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 5);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ---------------- component ---------------- */

export default function DerbyArena() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<G | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [hp, setHp] = useState(100);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("derby-arena", "high");
  const inputRef = useRef({ up: false, down: false, left: false, right: false, boost: false });

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    const p = g.cars[0];

    ctx.fillStyle = "#07070b";
    ctx.fillRect(0, 0, W, H);

    // crowd stands
    for (const s of STANDS) {
      ctx.fillStyle = s.c;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(s.x, s.y, 3, 3);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(Math.sin(time * 0.011) * g.shake, Math.cos(time * 0.013) * g.shake);

    // arena floor
    ctx.fillStyle = "#141216";
    ctx.fillRect(X0 - 30, Y0 - 30, X1 - X0 + 60, Y1 - Y0 + 60);
    const floor = ctx.createRadialGradient(W / 2, (Y0 + Y1) / 2, 40, W / 2, (Y0 + Y1) / 2, 330);
    floor.addColorStop(0, "#4b4335");
    floor.addColorStop(1, "#2b2620");
    ctx.fillStyle = floor;
    ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);

    // dirt scuffs
    ctx.save();
    ctx.beginPath();
    ctx.rect(X0, Y0, X1 - X0, Y1 - Y0);
    ctx.clip();
    ctx.strokeStyle = "rgba(0,0,0,0.24)";
    for (const s of SCUFFS) {
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, s.a0, s.a1);
      ctx.stroke();
    }
    ctx.restore();

    // centre paint
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W / 2, (Y0 + Y1) / 2, 74, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([11, 13]);
    ctx.beginPath();
    ctx.moveTo(W / 2, Y0);
    ctx.lineTo(W / 2, Y1);
    ctx.stroke();
    ctx.setLineDash([]);

    // concrete wall + hazard paint
    ctx.strokeStyle = "#3f3f46";
    ctx.lineWidth = 16;
    ctx.strokeRect(X0 - 8, Y0 - 8, X1 - X0 + 16, Y1 - Y0 + 16);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 5;
    ctx.setLineDash([18, 18]);
    ctx.strokeRect(X0 - 8, Y0 - 8, X1 - X0 + 16, Y1 - Y0 + 16);
    ctx.setLineDash([]);
    ctx.strokeStyle = "#78716c";
    ctx.lineWidth = 2;
    ctx.strokeRect(X0 - 1, Y0 - 1, X1 - X0 + 2, Y1 - Y0 + 2);

    // wrecks first, live cars on top
    for (const c of g.cars) {
      if (c.wreck) drawCarShape(ctx, c.x, c.y, c.a, c.color, true, 0, false, time);
    }
    for (const c of g.cars) {
      if (!c.wreck) drawCarShape(ctx, c.x, c.y, c.a, c.color, false, c.hitT, c.boosting, time);
    }

    // rival health bars
    for (const c of g.cars) {
      if (c.isPlayer || c.wreck) continue;
      const frac = Math.max(0, c.hp / c.maxHp);
      const bw = 30;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(c.x - bw / 2 - 1, c.y - R - 11, bw + 2, 6);
      ctx.fillStyle = frac > 0.5 ? "#34d399" : frac > 0.25 ? "#fbbf24" : "#f43f5e";
      ctx.fillRect(c.x - bw / 2, c.y - R - 10, bw * frac, 4);
    }

    // player marker
    if (!p.wreck) {
      const bob = Math.sin(time * 0.006) * 3;
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - R - 8 + bob);
      ctx.lineTo(p.x - 6, p.y - R - 17 + bob);
      ctx.lineTo(p.x + 6, p.y - R - 17 + bob);
      ctx.closePath();
      ctx.fill();
    }

    // particles
    for (const pt of g.parts) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.c;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    /* ---- canvas HUD ---- */

    // boost meter
    const bx = 20;
    const by = H - 30;
    const bwid = 132;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(bx - 5, by - 15, bwid + 10, 25, 7);
    ctx.fill();
    ctx.font = "bold 9px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#9aa4bd";
    ctx.fillText("BOOST · SPACE", bx, by - 5);
    const bf = Math.max(0, Math.min(1, p.boost / 100));
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(bx, by, bwid, 9);
    ctx.fillStyle = bf > 0.25 ? "#22d3ee" : "#f43f5e";
    ctx.fillRect(bx, by, bwid * bf, 9);

    // hull meter
    const hx = W - 152;
    const hf = Math.max(0, Math.min(1, p.hp / p.maxHp));
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(hx - 5, by - 15, 137, 25, 7);
    ctx.fill();
    ctx.fillStyle = "#9aa4bd";
    ctx.fillText("HULL", hx, by - 5);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(hx, by, 127, 9);
    ctx.fillStyle = hf > 0.4 ? "#34d399" : hf > 0.18 ? "#fbbf24" : "#f43f5e";
    ctx.fillRect(hx, by, 127 * hf, 9);

    // toast
    if (g.toastT > 0) {
      const a = Math.min(1, g.toastT * 2);
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.font = "bold 19px ui-monospace, monospace";
      ctx.fillStyle = "#fde68a";
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 14;
      ctx.fillText(g.toast, W / 2, 96 - (1 - a) * 10);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // round banner
    if (g.banner > 0) {
      const a = Math.min(1, g.banner * 2);
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.font = "bold 44px ui-monospace, monospace";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 24;
      ctx.fillText(g.bannerText, W / 2, H / 2);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // damage flash
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(244,63,94,${Math.min(0.5, g.flash * 0.5)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.textAlign = "left";
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

  /* ---------------- transitions ---------------- */

  const gameOver = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;
    g.alive = false;
    g.shake = 18;
    g.flash = 1;
    setScore(g.wrecks);
    setNewBest(submit(g.wrecks));
    setStatus("over");
    draw(performance.now());
  }, [draw, submit]);

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setRound(1);
    setHp(100);
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
        g.time += dt;
        const p = g.cars[0];

        /* ---- drive each car ---- */
        for (const c of g.cars) {
          c.hitT = Math.max(0, c.hitT - dt);
          let thr = 0;
          let steer = 0;

          if (c.isPlayer && !c.wreck) {
            thr = (k.up ? 1 : 0) - (k.down ? 0.75 : 0);
            steer = (k.right ? 1 : 0) - (k.left ? 1 : 0);
            c.boosting = k.boost && c.boost > 0 && thr > 0;
            if (c.boosting) c.boost = Math.max(0, c.boost - 46 * dt);
            else c.boost = Math.min(100, c.boost + 13 * dt);
          } else if (!c.isPlayer && !c.wreck) {
            // pick the nearest live opponent
            let tx = p.x;
            let ty = p.y;
            let bd = Infinity;
            for (const o of g.cars) {
              if (o === c || o.wreck) continue;
              const d = Math.hypot(o.x - c.x, o.y - c.y);
              if (d < bd) {
                bd = d;
                tx = o.x;
                ty = o.y;
              }
            }
            const want =
              Math.atan2(ty + (ty - c.y) * 0.14 - c.y, tx + (tx - c.x) * 0.14 - c.x) +
              Math.sin(g.time * 0.8 + c.phase) * 0.3;
            let diff = want - c.a;
            while (diff > Math.PI) diff -= TAU;
            while (diff < -Math.PI) diff += TAU;
            steer = Math.max(-1, Math.min(1, diff * 2.4));
            thr = Math.abs(diff) > 2.1 ? 0.35 : 1;
            c.boosting = Math.abs(diff) < 0.35 && c.boost > 60 && bd < 300;
            if (c.boosting) c.boost = Math.max(0, c.boost - 44 * dt);
            else c.boost = Math.min(100, c.boost + 9 * dt);
          } else {
            c.boosting = false;
          }

          if (c.wreck) {
            thr = 0;
            steer = 0;
            c.boosting = false;
          }

          const fx = Math.cos(c.a);
          const fy = Math.sin(c.a);
          let vf = c.vx * fx + c.vy * fy;
          let vl = -c.vx * fy + c.vy * fx;

          const acc = c.isPlayer
            ? thr * (c.boosting ? 780 : 440)
            : thr * ((c.boosting ? 720 : 415) + g.round * 10);
          vf += acc * dt;
          vf -= vf * 1.15 * dt;
          if (thr < 0) vf -= vf * 2.4 * dt;
          const vmax = c.isPlayer
            ? c.boosting
              ? 338
              : 246
            : Math.min(306, (c.boosting ? 330 : 242) + g.round * 8);
          if (vf > vmax) vf = vmax;
          if (vf < -118) vf = -118;

          const dir = vf < -8 ? -1 : 1;
          const gripK = Math.min(1, Math.abs(vf) / 105);
          c.a += steer * 3.2 * dir * gripK * dt;
          vl -= vl * Math.min(1, 5.4 * dt);
          if (c.wreck) vl -= vl * Math.min(1, 3 * dt);

          c.vx = fx * vf - fy * vl;
          c.vy = fy * vf + fx * vl;
          c.a += c.av * dt;
          c.av -= c.av * Math.min(1, 2.6 * dt);
          c.x += c.vx * dt;
          c.y += c.vy * dt;

          /* walls */
          if (c.x < X0 + R) {
            const im = Math.max(0, -c.vx);
            c.x = X0 + R;
            c.vx = Math.abs(c.vx) * 0.45;
            c.av += (im / 140 - 0.5) * 1.4;
            if (im > 150 && !c.wreck) {
              c.hp -= (im - 150) * 0.05;
              c.hitT = 0.2;
            }
            if (im > 120) {
              for (let s = 0; s < 5; s++) {
                g.parts.push({
                  x: X0 + 4,
                  y: c.y + (Math.random() - 0.5) * 14,
                  vx: 40 + Math.random() * 130,
                  vy: (Math.random() - 0.5) * 160,
                  life: 0.3,
                  max: 0.3,
                  c: "#fde68a",
                  r: 1 + Math.random() * 2,
                });
              }
            }
          }
          if (c.x > X1 - R) {
            const im = Math.max(0, c.vx);
            c.x = X1 - R;
            c.vx = -Math.abs(c.vx) * 0.45;
            c.av += (0.5 - im / 140) * 1.4;
            if (im > 150 && !c.wreck) {
              c.hp -= (im - 150) * 0.05;
              c.hitT = 0.2;
            }
            if (im > 120) {
              for (let s = 0; s < 5; s++) {
                g.parts.push({
                  x: X1 - 4,
                  y: c.y + (Math.random() - 0.5) * 14,
                  vx: -40 - Math.random() * 130,
                  vy: (Math.random() - 0.5) * 160,
                  life: 0.3,
                  max: 0.3,
                  c: "#fde68a",
                  r: 1 + Math.random() * 2,
                });
              }
            }
          }
          if (c.y < Y0 + R) {
            const im = Math.max(0, -c.vy);
            c.y = Y0 + R;
            c.vy = Math.abs(c.vy) * 0.45;
            if (im > 150 && !c.wreck) {
              c.hp -= (im - 150) * 0.05;
              c.hitT = 0.2;
            }
          }
          if (c.y > Y1 - R) {
            const im = Math.max(0, c.vy);
            c.y = Y1 - R;
            c.vy = -Math.abs(c.vy) * 0.45;
            if (im > 150 && !c.wreck) {
              c.hp -= (im - 150) * 0.05;
              c.hitT = 0.2;
            }
          }
        }

        /* ---- car-to-car ramming ---- */
        for (let i = 0; i < g.cars.length; i++) {
          for (let j = i + 1; j < g.cars.length; j++) {
            const A = g.cars[i];
            const B = g.cars[j];
            const dx = B.x - A.x;
            const dy = B.y - A.y;
            const d = Math.hypot(dx, dy);
            if (d >= R * 2 || d < 0.001) continue;
            const nx = dx / d;
            const ny = dy / d;
            const push = (R * 2 - d) / 2;
            A.x -= nx * push;
            A.y -= ny * push;
            B.x += nx * push;
            B.y += ny * push;
            const vn = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
            if (vn >= 0) continue;
            const jm = (-1.55 * vn) / 2;
            A.vx -= jm * nx;
            A.vy -= jm * ny;
            B.vx += jm * nx;
            B.vy += jm * ny;
            const impact = -vn;
            if (impact > 70) {
              const base = (impact - 70) * 0.085;
              const dmgA = base * (B.boosting ? 2.2 : 1) * (A.boosting ? 0.6 : 1);
              const dmgB = base * (A.boosting ? 2.2 : 1) * (B.boosting ? 0.6 : 1);
              A.hp -= dmgA;
              B.hp -= dmgB;
              A.hitT = 0.28;
              B.hitT = 0.28;
              A.lastHit = j;
              B.lastHit = i;
              A.av += (Math.random() - 0.5) * 3;
              B.av += (Math.random() - 0.5) * 3;
              g.shake = Math.max(g.shake, Math.min(12, impact * 0.03));
              g.flash = Math.max(g.flash, Math.min(0.5, impact * 0.0016));
              const mx = A.x + nx * R;
              const my = A.y + ny * R;
              for (let s = 0; s < 9; s++) {
                const ang = Math.random() * TAU;
                const sp = 60 + Math.random() * 200;
                g.parts.push({
                  x: mx,
                  y: my,
                  vx: Math.cos(ang) * sp,
                  vy: Math.sin(ang) * sp,
                  life: 0.35 + Math.random() * 0.3,
                  max: 0.65,
                  c: s % 3 === 0 ? "#fde68a" : "#fb923c",
                  r: 1 + Math.random() * 2.2,
                });
              }
            }
          }
        }

        /* ---- wrecks ---- */
        for (let i = 0; i < g.cars.length; i++) {
          const c = g.cars[i];
          if (c.wreck || c.hp > 0) continue;
          c.hp = 0;
          c.wreck = true;
          c.boosting = false;
          g.shake = Math.max(g.shake, 13);
          g.flash = Math.max(g.flash, 0.85);
          for (let s = 0; s < 26; s++) {
            const ang = Math.random() * TAU;
            const sp = 50 + Math.random() * 250;
            const hot = s % 3;
            g.parts.push({
              x: c.x,
              y: c.y,
              vx: Math.cos(ang) * sp,
              vy: Math.sin(ang) * sp - 40,
              life: 0.5 + Math.random() * 0.7,
              max: 1.2,
              c: hot === 0 ? "#fbbf24" : hot === 1 ? "#f97316" : "#78716c",
              r: 1.5 + Math.random() * 3.5,
            });
          }
          if (c.isPlayer) {
            gameOver();
            break;
          }
          if (c.lastHit === 0) {
            g.wrecks += 1;
            g.toast = "RIVAL WRECKED  +1";
            g.toastT = 1.2;
          } else {
            g.toast = "RIVAL WRECKED";
            g.toastT = 0.9;
          }
        }
        if (!g.alive) break;

        /* ---- round flow ---- */
        let live = 0;
        for (const c of g.cars) {
          if (!c.isPlayer && !c.wreck) live += 1;
        }
        if (live === 0) {
          if (g.roundT <= 0) {
            g.roundT = 1.4;
            g.toast = `ROUND ${g.round} CLEAR`;
            g.toastT = 1.4;
          } else {
            g.roundT -= dt;
            if (g.roundT <= 0) {
              g.round += 1;
              g.cars = g.cars.filter((c) => c.isPlayer || !c.wreck);
              p.hp = Math.min(p.maxHp, p.hp + 34);
              p.boost = 100;
              const n = Math.min(3 + (g.round - 1), 6);
              const hpN = 48 + g.round * 12;
              for (let i = 0; i < n; i++) {
                const slot = SLOTS[(i + g.round) % SLOTS.length];
                g.cars.push({
                  x: slot[0],
                  y: slot[1],
                  a: Math.atan2(H / 2 - slot[1], W / 2 - slot[0]),
                  vx: 0,
                  vy: 0,
                  av: 0,
                  hp: hpN,
                  maxHp: hpN,
                  color: AI_COLORS[(i + g.round) % AI_COLORS.length],
                  isPlayer: false,
                  wreck: false,
                  boosting: false,
                  boost: 100,
                  lastHit: -1,
                  hitT: 0,
                  phase: i * 2.1 + g.round,
                });
              }
              g.banner = 1.6;
              g.bannerText = `ROUND ${g.round}`;
              g.toast = "";
              g.toastT = 0;
            }
          }
        }

        /* ---- particles + decay ---- */
        for (const pt of g.parts) {
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.vy += 70 * dt;
          pt.life -= dt;
        }
        if (g.parts.length > 220) g.parts.splice(0, g.parts.length - 220);
        g.parts = g.parts.filter((pt) => pt.life > 0);
        for (const c of g.cars) {
          if (c.wreck && Math.random() < 0.2) {
            g.parts.push({
              x: c.x + (Math.random() - 0.5) * 14,
              y: c.y + (Math.random() - 0.5) * 14,
              vx: (Math.random() - 0.5) * 24,
              vy: -18 - Math.random() * 26,
              life: 0.9,
              max: 0.9,
              c: "rgba(120,113,108,0.75)",
              r: 3 + Math.random() * 4,
            });
          }
        }
        g.shake = Math.max(0, g.shake - 0.45);
        g.flash = Math.max(0, g.flash - dt * 1.9);
        g.toastT = Math.max(0, g.toastT - dt);
        g.banner = Math.max(0, g.banner - dt);

        /* throttled HUD sync */
        g.hudAcc += STEP;
        if (g.hudAcc >= 100) {
          g.hudAcc = 0;
          if (g.wrecks !== g.lastScore) {
            g.lastScore = g.wrecks;
            setScore(g.wrecks);
          }
          if (g.round !== g.lastRound) {
            g.lastRound = g.round;
            setRound(g.round);
          }
          const hpv = Math.max(0, Math.ceil(p.hp));
          if (hpv !== g.lastHp) {
            g.lastHp = hpv;
            setHp(hpv);
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
      if (code === "ArrowUp" || code === "KeyW") k.up = v;
      if (code === "ArrowDown" || code === "KeyS") k.down = v;
      if (code === "ArrowLeft" || code === "KeyA") k.left = v;
      if (code === "ArrowRight" || code === "KeyD") k.right = v;
      if (code === "Space") k.boost = v;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if ((e.code === "Space" || e.code === "Enter") && status !== "playing") {
        start();
        return;
      }
      set(e.code, true);
    };
    const onKeyUp = (e: KeyboardEvent) => set(e.code, false);
    const onBlur = () => {
      inputRef.current.up = false;
      inputRef.current.down = false;
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.boost = false;
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

  const hold = useCallback((dir: "up" | "down" | "left" | "right" | "boost", v: boolean) => {
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
    <div className="w-full max-w-[680px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-sky-400">
          Round{" "}
          <b className="ml-1 text-sm text-ink">{round}</b>
        </span>
        <span className={hp > 40 ? "text-emerald-400" : "text-rose-400"}>
          Hull <b className="ml-1 text-sm text-ink">{hp}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(161,161,170,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none"
          aria-label="Derby Arena demolition derby"
        />

        {status === "playing" && (
          <>
            <div className="pointer-events-none absolute bottom-3 left-3 grid grid-cols-3 gap-1.5">
              <span />
              {pad("up", "↑", "Throttle")}
              <span />
              {pad("left", "←", "Steer left")}
              {pad("down", "↓", "Reverse")}
              {pad("right", "→", "Steer right")}
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3">
              <button
                type="button"
                aria-label="Boost ram"
                className="pointer-events-auto select-none rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 py-4 text-xs font-bold uppercase tracking-widest text-cyan-100 backdrop-blur active:scale-95"
                onPointerDown={(e) => {
                  e.preventDefault();
                  hold("boost", true);
                }}
                onPointerUp={() => hold("boost", false)}
                onPointerCancel={() => hold("boost", false)}
                onPointerLeave={() => hold("boost", false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                Boost
              </button>
            </div>
          </>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">DERBY ARENA</p>
            <p className="mt-2 text-sm text-muted">
              Four rounds of demolition, one hull. Line up the ram, burn the boost meter
              into a rival&apos;s flank, and keep your engine running while the arena
              empties around you.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-stone-400 via-neutral-500 to-zinc-700"
            >
              Enter the arena
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ↑ throttle · ↓ reverse · ← → steer · Space boost-ram · D-pad + boost on touch
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">CAR TOTALLED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {score} wrecks · Round {round} · Best {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-stone-400 via-neutral-500 to-zinc-700"
            >
              Fresh chassis
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Space / Enter to drop back in</p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Boost rams deal 2× damage and take 40% less · clearing a round repairs 34 hull
      </p>
    </div>
  );
}
