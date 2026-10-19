"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 540;
const TAU = Math.PI * 2;
const TONE = "from-violet-500 via-purple-500 to-fuchsia-500";

const X0 = 40;
const X1 = 440;
const RUN_TIME = 90;

type Status = "idle" | "playing" | "over";
type Phase = "ground" | "air" | "stun";
type Trick = "j" | "k" | "l";

const TRICK_VAL: Record<Trick, number> = { j: 10, k: 20, l: 30 };
const TRICK_NAME: Record<Trick, string> = { j: "KICKFLIP", k: "GRAB", l: "360 SPIN" };
const TRICK_COL: Record<Trick, string> = { j: "#c4b5fd", k: "#f0abfc", l: "#fda4af" };

function pipeY(x: number): number {
  const u = (x - 240) / 200;
  return 425 - 165 * u * u;
}
function pipeSlope(x: number): number {
  return -1.65 * ((x - 240) / 200);
}

const G = 620;
const MAX_T = 560;

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

interface Game {
  phase: Phase;
  clock: number;
  score: number;
  combo: number;
  maxCombo: number;
  hasK: boolean;
  hasL: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  T: number; // signed speed along the transition
  pump: boolean;
  balance: number;
  bDir: number;
  comboUsed: boolean[]; // [J, K, L] used this air
  trickCd: number;
  stunT: number;
  flipT: number;
  spinT: number;
  grabT: number;
  airs: number;
  clean: number;
  timeUp: boolean;
  parts: Part[];
  floats: Floater[];
  banner: string;
  bannerT: number;
  shake: number;
  flash: number;
  flashC: string;
  over: boolean;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
}

function burst(g: Game, x: number, y: number, c: string, n: number, power: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = power * (0.4 + Math.random() * 0.6);
    g.parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.3 + Math.random() * 0.5,
      max: 0.8,
      r: 1.4 + Math.random() * 2.4,
      c,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, c: string): void {
  g.floats.push({ x, y, text, life: 1, c });
}

function createGame(): Game {
  return {
    phase: "ground",
    clock: RUN_TIME,
    score: 0,
    combo: 0,
    maxCombo: 0,
    hasK: false,
    hasL: false,
    x: 240,
    y: pipeY(240),
    vx: 150,
    vy: 0,
    T: 150,
    pump: false,
    balance: 0.5,
    bDir: 1,
    comboUsed: [false, false, false],
    trickCd: 0,
    stunT: 0,
    flipT: 0,
    spinT: 0,
    grabT: 0,
    airs: 0,
    clean: 0,
    timeUp: false,
    parts: [],
    floats: [],
    banner: "90 SECONDS — SEND IT",
    bannerT: 1.8,
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    over: false,
  };
}

function launch(g: Game): void {
  const lipT = Math.abs(g.T);
  g.phase = "air";
  g.x = g.vx < 0 ? X0 : X1;
  g.y = pipeY(g.x);
  g.vx = -g.vx * 0.4; // rebound back over the pipe
  g.vy = -(120 + lipT * 1.15);
  g.combo = 0;
  g.comboUsed = [false, false, false];
  g.balance = 0.5;
  g.bDir = 1;
  g.airs += 1;
  burst(g, g.x, g.y, "#e9d5ff", 10, 140);
}

function bail(g: Game): void {
  g.combo = 0;
  g.phase = "stun";
  g.stunT = 1.25;
  g.x = Math.max(X0, Math.min(X1, g.x));
  g.y = pipeY(g.x);
  g.vx = 0;
  g.vy = 0;
  g.T = 0;
  g.shake = 13;
  g.flash = 0.55;
  g.flashC = "#fb7185";
  floater(g, g.x, g.y - 70, "BAIL! COMBO LOST", "#fda4af");
  burst(g, g.x, g.y, "#fb7185", 22, 230);
}

function cleanLand(g: Game, perfect: boolean): void {
  const mixed = g.comboUsed.filter(Boolean).length >= 2;
  const mult = (perfect ? 2 : 1) * (mixed ? 1.3 : 1);
  const pts = Math.round(g.combo * mult);
  g.score += pts;
  g.clean += 1;
  g.phase = "ground";
  g.y = pipeY(g.x);
  g.vy = 0;
  g.shake = 6;
  g.flash = 0.4;
  g.flashC = perfect ? "#67e8f9" : "#34d399";
  floater(
    g,
    g.x,
    g.y - 76,
    `${perfect ? "PERFECT" : "CLEAN"} +${pts}${mixed ? " MIX!" : ""}`,
    perfect ? "#67e8f9" : "#6ee7b7",
  );
  burst(g, g.x, g.y, perfect ? "#67e8f9" : "#6ee7b7", 18, 190);
  g.T *= 1.05;
}

function trick(g: Game, t: Trick): void {
  if (g.phase !== "air" || g.trickCd > 0) return;
  const unlocked = t === "j" || (t === "k" && g.hasK) || (t === "l" && g.hasL);
  if (!unlocked) {
    floater(g, g.x, g.y - 60, `${TRICK_NAME[t]} LOCKED`, "#94a3b8");
    return;
  }
  g.combo += TRICK_VAL[t];
  g.comboUsed[t === "j" ? 0 : t === "k" ? 1 : 2] = true;
  g.trickCd = 0.17;
  if (t === "j") g.flipT = 0.42;
  else if (t === "k") g.grabT = 0.34;
  else g.spinT = 0.5;
  floater(g, g.x, g.y - 62, `${TRICK_NAME[t]} +${TRICK_VAL[t]}`, TRICK_COL[t]);
  burst(g, g.x, g.y + 8, TRICK_COL[t], 7, 120);

  if (g.maxCombo < g.combo) g.maxCombo = g.combo;
  if (!g.hasK && g.maxCombo >= 45) {
    g.hasK = true;
    g.banner = "K UNLOCKED — GRAB!";
    g.bannerT = 1.8;
  } else if (!g.hasL && g.maxCombo >= 110) {
    g.hasL = true;
    g.banner = "L UNLOCKED — SPIN!";
    g.bannerT = 1.8;
  }
}

function tryLand(g: Game): void {
  if (g.phase !== "air") return;
  const close = g.vy > 0 && g.y >= pipeY(g.x) - 120;
  if (!close) {
    floater(g, g.x, g.y - 40, "NOT YET", "#94a3b8");
    return;
  }
  const d = Math.abs(g.balance - 0.5);
  const zw = Math.max(0.16, 0.3 - g.combo * 0.0009);
  if (d <= zw / 2) cleanLand(g, d <= 0.05);
  else bail(g);
}

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 30);
  g.flash = Math.max(0, g.flash - dt * 1.7);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);
  if (g.trickCd > 0) g.trickCd = Math.max(0, g.trickCd - dt);
  if (g.flipT > 0) g.flipT = Math.max(0, g.flipT - dt);
  if (g.spinT > 0) g.spinT = Math.max(0, g.spinT - dt);
  if (g.grabT > 0) g.grabT = Math.max(0, g.grabT - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 340 * dt;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.1;
    f.y -= 32 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (!g.timeUp) {
    g.clock = Math.max(0, g.clock - dt);
    if (g.clock <= 0) {
      g.timeUp = true;
      g.banner = "TIME — LAND IT!";
      g.bannerT = 2.2;
    }
  }

  if (g.phase === "stun") {
    g.stunT -= dt;
    if (g.stunT <= 0) {
      g.phase = "ground";
      g.T = (g.x < 240 ? 1 : -1) * 140;
      g.y = pipeY(g.x);
      const m = pipeSlope(g.x);
      g.vx = g.T / Math.sqrt(1 + m * m);
    }
    return;
  }

  if (g.phase === "ground") {
    const m = pipeSlope(g.x);
    const denom = Math.sqrt(1 + m * m);
    let T = g.T;
    T += ((G * m) / denom) * dt; // gravity along the transition
    if (g.pump) T += Math.sign(T || 1) * 700 * (1 - Math.abs((g.x - 240) / 200) * 0.5) * dt;
    T *= 1 - 0.3 * dt;
    T = Math.max(-MAX_T, Math.min(MAX_T, T));
    g.T = T;
    const vx = T / denom;
    g.vx = vx;
    g.x += vx * dt;
    g.y = pipeY(g.x);
    if (g.x <= X0 || g.x >= X1) launch(g);
    if (g.timeUp && g.phase === "ground") g.over = true;
    return;
  }

  // air
  const rate = 1.05 + (RUN_TIME - g.clock) * 0.011;
  g.balance += g.bDir * rate * dt;
  if (g.balance >= 1) {
    g.balance = 1;
    g.bDir = -1;
  } else if (g.balance <= 0) {
    g.balance = 0;
    g.bDir = 1;
  }

  g.vy += 780 * dt;
  g.x += g.vx * dt;
  g.y += g.vy * dt;
  g.x = Math.max(X0 - 10, Math.min(X1 + 10, g.x));

  if (g.vy > 0 && g.y >= pipeY(g.x) && g.x >= X0 - 10 && g.x <= X1 + 10) {
    // touched down without pressing F
    bail(g);
    if (g.timeUp) g.over = true;
  }
}

/* ------------------------------ render ------------------------------ */

function drawPipe(ctx: CanvasRenderingContext2D, time: number): void {
  // fill
  ctx.beginPath();
  ctx.moveTo(X0, pipeY(X0));
  for (let x = X0; x <= X1; x += 8) ctx.lineTo(x, pipeY(x));
  ctx.lineTo(X1, pipeY(X1));
  ctx.lineTo(X1, H + 14);
  ctx.lineTo(X0, H + 14);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, 240, 0, H);
  fill.addColorStop(0, "#1b1035");
  fill.addColorStop(1, "#120a24");
  ctx.fillStyle = fill;
  ctx.fill();

  // transition lines
  ctx.strokeStyle = "rgba(167, 139, 250, 0.16)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 7; i++) {
    const y = 260 + i * 40;
    ctx.beginPath();
    for (let x = X0; x <= X1; x += 8) {
      if (pipeY(x) > y) ctx.lineTo(x, y);
      else if (x === X0) ctx.moveTo(X0, y);
    }
    ctx.stroke();
  }

  // coping
  ctx.save();
  ctx.shadowColor = "#a78bfa";
  ctx.shadowBlur = 16;
  ctx.strokeStyle = "#c4b5fd";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(X0, pipeY(X0));
  for (let x = X0; x <= X1; x += 6) ctx.lineTo(x, pipeY(x));
  ctx.stroke();
  ctx.restore();
  for (const cx of [X0, X1]) {
    ctx.fillStyle = "#f0abfc";
    ctx.beginPath();
    ctx.arc(cx, pipeY(cx), 6, 0, TAU);
    ctx.fill();
  }

  // deck lip labels
  ctx.font = "700 9px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(196, 181, 253, 0.8)";
  ctx.fillText("DECK", X0 + 8, pipeY(X0) - 14);
  ctx.fillText("DECK", X1 - 8, pipeY(X1) - 14);

  // stars
  for (let i = 0; i < 26; i++) {
    const sx = (i * 83) % W;
    const sy = 12 + ((i * 47) % 150);
    ctx.fillStyle = "rgba(226, 232, 240, 0.4)";
    ctx.globalAlpha = 0.3 + Math.sin(time / 600 + i) * 0.25;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function drawSkater(ctx: CanvasRenderingContext2D, g: Game, time: number): void {
  const onGround = g.phase !== "air";
  const angle = onGround ? Math.atan(pipeSlope(g.x)) : Math.atan2(g.vy, g.vx) * 0.25;
  const spinPhase = g.spinT > 0 ? (1 - g.spinT / 0.5) * TAU : 0;
  const grabbing = g.grabT > 0;
  const lying = g.phase === "stun";

  ctx.save();
  ctx.translate(g.x, g.y);
  if (lying) {
    ctx.rotate(-0.4);
    ctx.translate(0, 6);
  } else {
    ctx.rotate(angle + spinPhase);
  }

  // shadow on deck
  if (onGround && !lying) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 20, 5, 0, 0, TAU);
    ctx.fill();
  }

  // board (flips around its long axis on a kickflip)
  const flip = g.flipT > 0 ? Math.cos((1 - g.flipT / 0.42) * TAU) : 1;
  ctx.save();
  ctx.translate(0, -4);
  ctx.scale(1, Math.max(0.18, Math.abs(flip)));
  ctx.shadowColor = "#f0abfc";
  ctx.shadowBlur = 10;
  ctx.fillStyle = flip < 0 ? "#7c3aed" : "#e879f9";
  ctx.beginPath();
  ctx.roundRect(-19, -3, 38, 6, 3);
  ctx.fill();
  ctx.restore();
  ctx.shadowBlur = 0;

  if (!lying) {
    // body
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    const crouch = grabbing ? 9 : 0;
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(grabbing ? 2 : 0, -30 + crouch);
    ctx.stroke();
    // grab arm
    if (grabbing) {
      ctx.strokeStyle = "#c4b5fd";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(-10, -8);
      ctx.stroke();
    }
    // head
    ctx.fillStyle = "#fde68a";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(grabbing ? 4 : 1, -38 + crouch, 7, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // wiped out — board and rider on the deck
    ctx.fillStyle = "#a78bfa";
    ctx.beginPath();
    ctx.roundRect(-14, -16, 26, 10, 5);
    ctx.fill();
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.arc(18, -12, 7, 0, TAU);
    ctx.fill();
  }

  ctx.restore();

  // sparks under wheels while pumping
  if (onGround && g.pump && Math.floor(time / 70) % 2 === 0) {
    ctx.fillStyle = "#f0abfc";
    ctx.beginPath();
    ctx.arc(g.x - Math.sign(g.vx || 1) * 16, g.y - 2, 2.2, 0, TAU);
    ctx.fill();
  }
}

function drawMeter(ctx: CanvasRenderingContext2D, g: Game): void {
  const mx = 56;
  const my = H - 52;
  const mw = W - 112;
  const mh = 20;

  if (g.phase === "air") {
    const zw = Math.max(0.16, 0.3 - g.combo * 0.0009);
    ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
    ctx.beginPath();
    ctx.roundRect(mx - 7, my - 7, mw + 14, mh + 30, 14);
    ctx.fill();
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    ctx.fillText("F WHEN THE CURSOR IS GREEN", W / 2, my - 12);
    ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
    ctx.beginPath();
    ctx.roundRect(mx, my, mw, mh, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(52, 211, 153, 0.75)";
    ctx.fillRect(mx + (0.5 - zw / 2) * mw, my, zw * mw, mh);
    ctx.fillStyle = "rgba(240, 255, 255, 0.95)";
    ctx.fillRect(mx + 0.45 * mw, my, 0.1 * mw, mh);
    const cx = mx + g.balance * mw;
    ctx.save();
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - 2, my - 5, 4, mh + 10);
    ctx.restore();
  } else {
    // speed gauge
    const frac = Math.min(1, Math.abs(g.T) / MAX_T);
    ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
    ctx.beginPath();
    ctx.roundRect(mx - 7, my - 7, mw + 14, mh + 20, 12);
    ctx.fill();
    ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
    ctx.beginPath();
    ctx.roundRect(mx, my, mw, mh, 8);
    ctx.fill();
    const grad = ctx.createLinearGradient(mx, 0, mx + mw, 0);
    grad.addColorStop(0, "#34d399");
    grad.addColorStop(0.6, "#a78bfa");
    grad.addColorStop(1, "#f0abfc");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(mx, my, Math.max(5, frac * mw), mh, 8);
    ctx.fill();
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
    ctx.fillText(g.phase === "stun" ? "RECOVERING…" : "HOLD S TO PUMP — FASTER = BIGGER AIR", W / 2, my - 12);
  }
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a0b2e");
  bg.addColorStop(0.5, "#150a26");
  bg.addColorStop(1, "#0c0618");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  drawPipe(ctx, time);

  if (g) {
    drawSkater(ctx, g, time);

    // combo bubble
    if (g.phase === "air" && g.combo > 0) {
      ctx.font = "800 22px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#f0abfc";
      ctx.shadowColor = "#e879f9";
      ctx.shadowBlur = 14;
      ctx.fillText(`${g.combo} COMBO`, g.x, Math.max(60, g.y - 96));
      ctx.shadowBlur = 0;
      const kinds = g.comboUsed.filter(Boolean).length;
      if (kinds >= 2) {
        ctx.font = "700 11px ui-monospace, monospace";
        ctx.fillStyle = "#67e8f9";
        ctx.fillText("MIX ×1.3", g.x, Math.max(78, g.y - 78));
      }
    }

    // HUD
    ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
    ctx.beginPath();
    ctx.roundRect(14, 14, 140, 54, 12);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillStyle = "#c4b5fd";
    ctx.fillText("SCORE", 28, 34);
    ctx.font = "800 20px ui-monospace, monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${g.score}`, 28, 58);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
    ctx.beginPath();
    ctx.roundRect(W - 154, 14, 140, 54, 12);
    ctx.fill();
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillStyle = "#f0abfc";
    ctx.fillText("TIME", W - 28, 34);
    const secs = Math.ceil(g.clock);
    const urgent = secs <= 10 && Math.floor(time / 300) % 2 === 0;
    ctx.font = "800 20px ui-monospace, monospace";
    ctx.fillStyle = urgent ? "#fb7185" : "#ffffff";
    ctx.fillText(`${secs}s`, W - 28, 58);

    // trick keys hint
    ctx.textAlign = "center";
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillStyle = "rgba(196, 181, 253, 0.8)";
    ctx.fillText(
      `J KICKFLIP${g.hasK ? " · K GRAB" : " (LOCKED)"}${g.hasL ? " · L SPIN" : " (LOCKED)"}`,
      W / 2,
      34,
    );

    drawMeter(ctx, g);

    // particles
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // floaters
    ctx.font = "800 14px ui-monospace, monospace";
    for (const f of g.floats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.4);
      ctx.font = "800 24px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(232, 121, 249, 0.9)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, 120);
      ctx.restore();
    }

    if (g.flash > 0.01) {
      ctx.fillStyle = hexA(g.flashC, g.flash * 0.3);
      ctx.fillRect(-14, -14, W + 28, H + 28);
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function SkateTrick({ gameId = "skate-trick" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [clock, setClock] = useState(RUN_TIME);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (canvas) render(canvas, gameRef.current, time);
  }, []);

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
    setScore(0);
    setCombo(0);
    setClock(RUN_TIME);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const setPump = useCallback((on: boolean) => {
    const g = gameRef.current;
    if (g) g.pump = on;
  }, []);

  const doTrick = useCallback((t: Trick) => {
    const g = gameRef.current;
    if (g) trick(g, t);
  }, []);

  const doLand = useCallback(() => {
    const g = gameRef.current;
    if (g) tryLand(g);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastCombo = -1;
    let lastClock = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      if (g.score !== lastScore) {
        lastScore = g.score;
        setScore(g.score);
      }
      if (g.combo !== lastCombo) {
        lastCombo = g.combo;
        setCombo(g.combo);
      }
      const secs = Math.ceil(g.clock);
      if (secs !== lastClock) {
        lastClock = secs;
        setClock(secs);
      }

      draw(t);
      if (g.over) {
        setScore(g.score);
        setCombo(0);
        setNewBest(submit(g.score));
        setStatus("over");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
        return;
      }
      if (status !== "playing") return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "s") {
        setPump(true);
      } else if (key === "j" || key === "k" || key === "l") {
        if (e.repeat) return;
        doTrick(key as Trick);
      } else if (key === "f") {
        if (e.repeat) return;
        doLand();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "s") setPump(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start, setPump, doTrick, doLand]);

  const padBtn =
    "touch-none rounded-xl border bg-surface py-3 font-mono text-xs font-bold uppercase transition active:scale-95";

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-fuchsia-300">
          Combo <b className="ml-1 text-sm text-ink">{combo}</b>
        </span>
        <span className="text-violet-300">
          Time <b className="ml-1 text-sm text-ink">{clock}s</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(232,121,249,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Skate Trick halfpipe"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">SKATE TRICK</p>
            <p className="mt-2 text-sm text-muted">
              Ninety seconds on the pipe. Hold S to pump for speed — the faster you hit the lip,
              the bigger the air. Up there, chain J kickflips, K grabs and L spins to grow the
              combo (the grab unlocks at 45, the spin at 110), then press F while the cursor sits
              in the green to bank it. Miss the window and you eat the concrete: combo gone.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Drop in
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              S pump · J K L tricks · F to land — or tap the pads
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-fuchsia-300">SESSION OVER</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">Score · Best {best ?? "—"}</p>
            <PrimaryButton onClick={start} tone={TONE}>
              Session two
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Pump for speed · mix your tricks · land in the green
            </p>
          </Overlay>
        )}
      </div>

      <div className="mt-2 grid touch-none select-none grid-cols-5 gap-2">
        <button
          type="button"
          onPointerDown={() => setPump(true)}
          onPointerUp={() => setPump(false)}
          onPointerLeave={() => setPump(false)}
          onPointerCancel={() => setPump(false)}
          aria-label="Pump — hold key S"
          className={`${padBtn} border-violet-400/50 text-violet-300`}
        >
          Pump
        </button>
        <button
          type="button"
          onPointerDown={() => doTrick("j")}
          aria-label="Kickflip — key J"
          className={`${padBtn} border-purple-400/50 text-purple-300`}
        >
          J Kick
        </button>
        <button
          type="button"
          onPointerDown={() => doTrick("k")}
          aria-label="Grab — key K"
          className={`${padBtn} border-fuchsia-400/50 text-fuchsia-300`}
        >
          K Grab
        </button>
        <button
          type="button"
          onPointerDown={() => doTrick("l")}
          aria-label="Spin — key L"
          className={`${padBtn} border-pink-400/50 text-pink-300`}
        >
          L Spin
        </button>
        <button
          type="button"
          onPointerDown={() => doLand()}
          aria-label="Land — key F"
          className={`${padBtn} border-emerald-400/50 text-emerald-300`}
        >
          F Land
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Pump at the bottom of the pipe · F in the green banks the combo · a bail wipes it
      </p>
    </div>
  );
}
