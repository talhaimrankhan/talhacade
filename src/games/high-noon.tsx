"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 440;
const GROUND = 366;
const P_X = 132;
const AI_X = 348;
const WINS = 5;

type Status = "idle" | "playing" | "over";
type Phase = "intro" | "standoff" | "draw" | "resolve";

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

interface Shot {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
}

interface Nooner {
  phase: Phase;
  /** intro/resolve: counts down. standoff/draw: counts up. */
  t: number;
  drawAt: number;
  fakes: number[];
  fakeIdx: number;
  twitch: number;
  fakeGlow: number;
  shake: number;
  flash: number;
  gold: number;
  banner: string;
  bannerT: number;
  you: number;
  rival: number;
  duel: number;
  streak: number;
  reactBase: number;
  react: number;
  winner: "you" | "rival" | null;
  reason: string;
  shot: Shot | null;
  parts: Part[];
  floaters: Floater[];
  over: boolean;
  dirty: boolean;
}

/** AI trigger speed for a given duel win streak (seconds). */
function reactFor(streak: number): number {
  return Math.max(0.21, 0.47 - streak * 0.05);
}

function startDuel(g: Nooner): void {
  g.reactBase = reactFor(g.streak);
  g.react = g.reactBase;
  g.you = 0;
  g.rival = 0;
  g.duel = g.streak + 1;
  g.phase = "intro";
  g.t = 1.7;
  g.banner = `DUEL ${g.duel}`;
  g.bannerT = 1.7;
  g.shot = null;
  g.winner = null;
  g.reason = "";
  g.dirty = true;
}

function startRound(g: Nooner): void {
  g.phase = "intro";
  g.t = 0.85;
  g.banner = `ROUND ${g.you + g.rival + 1}`;
  g.bannerT = 0.85;
  g.shot = null;
  g.winner = null;
  g.reason = "";
}

function beginStandoff(g: Nooner): void {
  g.phase = "standoff";
  g.t = 0;
  g.drawAt = 1.35 + Math.random() * 2.1;
  const count = Math.min(3, Math.floor(Math.random() * 2) + Math.floor(g.streak / 2));
  const fakes: number[] = [];
  for (let i = 0; i < count; i++) {
    fakes.push(0.45 + Math.random() * Math.max(0.25, g.drawAt - 1.05));
  }
  fakes.sort((a, b) => a - b);
  g.fakes = fakes;
  g.fakeIdx = 0;
  g.react = g.reactBase * (0.9 + Math.random() * 0.2);
  g.twitch = 0;
  g.fakeGlow = 0;
  g.shot = null;
  g.winner = null;
}

function burst(parts: Part[], x: number, y: number, c: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 55 + Math.random() * 180;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.32 + Math.random() * 0.4,
      max: 0.72,
      r: 1.4 + Math.random() * 2.4,
      c,
    });
  }
}

/** Resolves the current round. Safe from the RAF loop or a pointer handler. */
function endRound(g: Nooner, winner: "you" | "rival", reason: string): void {
  if (g.phase !== "standoff" && g.phase !== "draw") return;
  g.winner = winner;
  g.reason = reason;
  if (winner === "you") g.you += 1;
  else g.rival += 1;
  g.phase = "resolve";
  g.t = 1.7;
  g.shake = Math.max(g.shake, 7);

  const loserX = winner === "you" ? AI_X : P_X;
  const cx = loserX + (winner === "you" ? -4 : 4);
  const cy = GROUND - 82;
  burst(g.parts, cx, cy, winner === "you" ? "#fde68a" : "#fb7185", 18);
  burst(g.parts, cx, cy, "#ffffff", 8);
  g.floaters.push({
    x: cx,
    y: cy - 18,
    text: reason,
    life: 1.1,
    c: winner === "you" ? "#fde68a" : "#fb7185",
  });
  g.flash = winner === "you" ? 0 : 0.55;
  g.gold = winner === "you" ? 0.55 : 0;
  g.banner = reason.startsWith("FOUL") ? "FOUL!" : winner === "you" ? "ROUND WON" : "ROUND LOST";
  g.bannerT = 1.2;

  const gy = GROUND - 84;
  g.shot =
    winner === "you"
      ? { x1: P_X + 30, y1: gy, x2: AI_X - 8, y2: gy + 5, t: 0 }
      : { x1: AI_X - 30, y1: gy, x2: P_X + 8, y2: gy + 5, t: 0 };
  g.dirty = true;
}

/** One physics tick. Returns "over" or "duel" (duel won), else null. */
function stepGame(g: Nooner, dt: number): "over" | "duel" | null {
  if (g.over) return "over";

  g.shake = Math.max(0, g.shake - dt * 24);
  g.flash = Math.max(0, g.flash - dt);
  g.gold = Math.max(0, g.gold - dt);
  g.bannerT = Math.max(0, g.bannerT - dt);
  g.twitch = Math.max(0, g.twitch - dt);
  g.fakeGlow = Math.max(0, g.fakeGlow - dt);

  if (g.shot) {
    g.shot.t += dt * 1.7;
    if (g.shot.t >= 1) g.shot = null;
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
    p.vy += 300 * dt;
    p.vx *= 1 - 1.6 * dt;
  }
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.life -= dt;
    f.y -= 30 * dt;
    if (f.life <= 0) g.floaters.splice(i, 1);
  }

  if (g.phase === "intro") {
    g.t -= dt;
    if (g.t <= 0) beginStandoff(g);
    return null;
  }

  if (g.phase === "standoff") {
    g.t += dt;
    while (g.fakeIdx < g.fakes.length && g.t >= g.fakes[g.fakeIdx]) {
      g.fakeIdx += 1;
      g.twitch = 0.38;
      g.fakeGlow = 0.32;
      burst(g.parts, AI_X - 18, GROUND - 130, "#fda4af", 3);
    }
    if (g.t >= g.drawAt) {
      g.phase = "draw";
      g.t = 0;
      g.gold = 0.4;
      g.shake = Math.max(g.shake, 4);
      g.banner = "DRAW!";
      g.bannerT = 0.75;
    }
    return null;
  }

  if (g.phase === "draw") {
    g.t += dt;
    if (g.t >= g.react) endRound(g, "rival", "TOO SLOW");
    return null;
  }

  // resolve
  g.t -= dt;
  if (g.t <= 0) {
    if (g.you >= WINS) {
      g.streak += 1;
      startDuel(g);
      return "duel";
    }
    if (g.rival >= WINS) {
      g.over = true;
      return "over";
    }
    startRound(g);
  }
  return null;
}

function createGame(): Nooner {
  const g: Nooner = {
    phase: "intro",
    t: 0,
    drawAt: 2,
    fakes: [],
    fakeIdx: 0,
    twitch: 0,
    fakeGlow: 0,
    shake: 0,
    flash: 0,
    gold: 0,
    banner: "",
    bannerT: 0,
    you: 0,
    rival: 0,
    duel: 1,
    streak: 0,
    reactBase: reactFor(0),
    react: reactFor(0),
    winner: null,
    reason: "",
    shot: null,
    parts: [],
    floaters: [],
    over: false,
    dirty: true,
  };
  startDuel(g);
  return g;
}

/* ---------------- drawing helpers ---------------- */

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

interface CowboyLook {
  main: string;
  dark: string;
  /** 1 = faces right, -1 = faces left */
  face: number;
  bob: number;
  /** 0 = hand on holster, 1 = gun leveled */
  arm: number;
  tremble: number;
  badge: "off" | "dim" | "hot";
  /** lean when losing the round */
  tilt: number;
  time: number;
}

function drawCowboy(ctx: CanvasRenderingContext2D, x: number, look: CowboyLook): void {
  const { main, dark } = look;
  ctx.save();
  ctx.translate(x, GROUND);

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(0, 5, 34, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  if (look.tilt !== 0) ctx.rotate(look.tilt);
  ctx.scale(look.face, 1);
  ctx.translate(
    Math.sin(look.time / 41) * look.tremble,
    look.bob + Math.sin(look.time / 57) * look.tremble * 0.6,
  );

  // legs + boots
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.roundRect(-13, -46, 11, 46, 5);
  ctx.roundRect(3, -46, 11, 46, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.beginPath();
  ctx.roundRect(-15, -11, 15, 11, 3);
  ctx.roundRect(2, -11, 15, 11, 3);
  ctx.fill();

  // torso
  ctx.shadowColor = main;
  ctx.shadowBlur = 16;
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.roundRect(-17, -96, 34, 54, 11);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -94);
  ctx.lineTo(0, -46);
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(-17, -53, 34, 7);

  // back arm
  ctx.strokeStyle = main;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-8, -88);
  ctx.lineTo(-21, -62);
  ctx.stroke();

  // front arm
  const handX = 14 + look.arm * 20;
  const handY = -58 - look.arm * 28;
  ctx.beginPath();
  ctx.moveTo(9, -88);
  ctx.lineTo(handX, handY);
  ctx.stroke();

  // gun in hand when leveled
  if (look.arm > 0.05) {
    ctx.save();
    ctx.translate(handX, handY);
    ctx.fillStyle = "#0b0b12";
    ctx.strokeStyle = main;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(0, -4, 19, 8, 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowColor = "#fde68a";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.arc(19, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // head + visor
  ctx.shadowColor = main;
  ctx.shadowBlur = 14;
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(0, -106, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowColor = main;
  ctx.shadowBlur = 10;
  ctx.fillStyle = main;
  ctx.beginPath();
  ctx.roundRect(-3, -111, 13, 6, 3);
  ctx.fill();
  ctx.shadowBlur = 0;

  // hat
  ctx.save();
  ctx.translate(0, -114);
  ctx.rotate(Math.sin(look.time / 300) * 0.02);
  ctx.shadowColor = main;
  ctx.shadowBlur = 12;
  ctx.fillStyle = dark;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 27, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-11, -21, 22, 22, 6);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-11, -5);
  ctx.lineTo(11, -5);
  ctx.stroke();
  ctx.restore();

  // chest badge
  const bx = 8;
  const by = -78;
  if (look.badge === "hot") {
    const pulse = Math.sin(look.time / 60);
    ctx.save();
    ctx.shadowColor = "#fde68a";
    ctx.shadowBlur = 26 + pulse * 8;
    ctx.fillStyle = "#fde68a";
    star(ctx, bx, by, 9, 4.2);
    ctx.fill();
    ctx.shadowBlur = 0;
    for (let k = 0; k < 2; k++) {
      const ph = ((look.time / 550) + k * 0.5) % 1;
      ctx.globalAlpha = (1 - ph) * 0.7;
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, 9 + ph * 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  } else if (look.badge === "dim") {
    ctx.save();
    ctx.shadowColor = "#fb923c";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#fb923c";
    star(ctx, bx, by, 7.5, 3.6);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(251,146,60,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx, by, 12, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(148,163,184,0.85)";
    star(ctx, bx, by, 6, 3);
    ctx.fill();
  }

  ctx.restore();
}

/* ---------------- component ---------------- */

export default function HighNoon() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Nooner | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [you, setYou] = useState(0);
  const [rival, setRival] = useState(0);
  const [duel, setDuel] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("high-noon", "high");

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    // dusk sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#181310");
    sky.addColorStop(0.6, "#241a11");
    sky.addColorStop(1, "#0d0a08");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // low sun
    const sun = ctx.createRadialGradient(W / 2, GROUND - 6, 10, W / 2, GROUND - 6, 250);
    sun.addColorStop(0, "rgba(254, 243, 199, 0.34)");
    sun.addColorStop(0.4, "rgba(253, 224, 71, 0.1)");
    sun.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = "#fde68a";
    ctx.shadowBlur = 40;
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.arc(W / 2, GROUND + 4, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // street-front silhouettes
    ctx.fillStyle = "#0b0908";
    ctx.fillRect(0, 178, 72, GROUND - 178);
    ctx.fillRect(W - 76, 158, 76, GROUND - 158);
    ctx.fillStyle = "#120e0c";
    ctx.fillRect(6, 168, 60, 12);
    ctx.fillRect(W - 70, 148, 64, 12);
    const windows = [
      [14, 200],
      [44, 200],
      [14, 240],
      [44, 240],
      [W - 60, 184],
      [W - 30, 184],
      [W - 60, 226],
      [W - 30, 226],
    ];
    for (const [wx, wy] of windows) {
      ctx.fillStyle = "rgba(253, 224, 71, 0.35)";
      ctx.fillRect(wx, wy, 14, 18);
    }
    // neon frames
    ctx.strokeStyle = "rgba(244, 114, 182, 0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 156, 52, 8);
    ctx.strokeStyle = "rgba(45, 212, 191, 0.35)";
    ctx.strokeRect(W - 66, 136, 56, 8);

    // ground
    ctx.fillStyle = "#100d0b";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "rgba(253, 224, 71, 0.4)";
    ctx.fillRect(0, GROUND, W, 2);
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let y = GROUND + 22; y < H; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // drifting dust motes (deterministic)
    ctx.fillStyle = "rgba(254, 243, 199, 0.16)";
    for (let i = 0; i < 18; i++) {
      const mx = ((i * 113 + Math.sin(time / 900 + i) * 16) % W + W) % W;
      const my = ((i * 67 + time * 0.014 * (1 + (i % 3))) % GROUND + GROUND) % GROUND;
      ctx.beginPath();
      ctx.arc(mx, my, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    if (g.shake > 0.2) {
      ctx.translate(Math.sin(time / 19) * g.shake, Math.cos(time / 15) * g.shake);
    }

    // bullet streak
    if (g.shot) {
      const s = g.shot;
      const a = Math.max(0, 1 - s.t);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = "#fff7ed";
      ctx.shadowColor = "#fde68a";
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(s.x1, s.y1, 4 + a * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // the duelists
    const resolveArm = g.phase === "resolve" ? Math.min(1, (1.7 - g.t) * 4) : 0;
    const standTremble = g.phase === "standoff" ? Math.min(1, g.t / 2.4) * 2.4 : 0;
    drawCowboy(ctx, P_X, {
      main: "#5eead4",
      dark: "#134e4a",
      face: 1,
      bob: Math.sin(time / 620) * 1.6,
      arm: g.winner === "you" ? resolveArm : 0,
      tremble: g.winner === "rival" ? 3.4 : standTremble,
      badge: "off",
      tilt: g.winner === "rival" ? -0.3 : 0,
      time,
    });
    const aiTwitch = g.twitch > 0 ? g.twitch * 14 : 0;
    drawCowboy(ctx, AI_X, {
      main: "#fb7185",
      dark: "#4c0519",
      face: -1,
      bob: Math.sin(time / 540 + 2) * 1.6,
      arm:
        g.winner === "rival"
          ? resolveArm
          : g.phase === "draw"
            ? Math.min(1, g.t / 0.16)
            : 0,
      tremble: aiTwitch,
      badge: g.phase === "draw" ? "hot" : g.fakeGlow > 0 ? "dim" : "off",
      tilt: g.winner === "you" ? 0.3 : 0,
      time,
    });

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
    ctx.font = "bold 15px ui-monospace, monospace";
    ctx.textAlign = "center";
    for (const f of g.floaters) {
      ctx.globalAlpha = Math.min(1, f.life / 0.4);
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";

    ctx.restore();

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.globalAlpha = Math.min(1, g.bannerT);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 34px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(g.banner, W / 2, 76);
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
    }

    // tension edges during the standoff, gold on the draw
    if (g.phase === "standoff") {
      const a = Math.min(0.16, (g.t / Math.max(0.001, g.drawAt)) * 0.16);
      ctx.strokeStyle = `rgba(244, 63, 94, ${a + Math.sin(time / 160) * 0.03})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, H - 6);
    } else if (g.phase === "draw") {
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.4 + Math.sin(time / 70) * 0.25})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, H - 6);
    }

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(225, 29, 72, ${g.flash * 0.42})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (g.gold > 0) {
      ctx.fillStyle = `rgba(253, 224, 71, ${g.gold * 0.3})`;
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

  /* ---------------- loop ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setYou(0);
    setRival(0);
    setDuel(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

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
        setScore(g.streak);
        setYou(g.you);
        setRival(g.rival);
        setDuel(g.duel);
      }

      if (result === "over") {
        setScore(g.streak);
        setYou(g.you);
        setRival(g.rival);
        setDuel(g.duel);
        if (g.streak > 0) setNewBest(submit(g.streak));
        else setNewBest(false);
        setStatus("over");
        draw(t);
        return;
      }

      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, submit, draw]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (status === "idle" || status === "over") start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start]);

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-teal-300">
          You{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${you} rounds won`}>
            {"◆".repeat(you)}
            {"◇".repeat(Math.max(0, WINS - you))}
          </b>
        </span>
        <span className="text-rose-400">
          Rival{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${rival} rival rounds`}>
            {"◆".repeat(rival)}
            {"◇".repeat(Math.max(0, WINS - rival))}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(161,161,170,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none cursor-crosshair select-none"
          aria-label="High Noon duel street"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g) return;
            if (g.phase === "standoff") {
              endRound(g, "rival", "FOUL — SHOT EARLY");
            } else if (g.phase === "draw") {
              if (g.t < g.react) {
                const ms = Math.max(1, Math.round(g.t * 1000));
                endRound(g, "you", `${ms}ms`);
              } else {
                endRound(g, "rival", "TOO SLOW");
              }
            }
          }}
        />

        {status === "playing" && (
          <p className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            Fire only when the badge blazes gold
          </p>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">HIGH NOON</p>
            <p className="mt-2 text-sm text-muted">
              A twitchy robo-outlaw heels in the street. His badge flares dim on every fake —
              click before the blazing gold glow and it&apos;s a foul; hesitate and his bullet
              lands first. First to five rounds takes the duel.
            </p>
            <PrimaryButton onClick={start} tone="from-stone-400 via-neutral-500 to-zinc-700">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Click / tap to draw · win duels back-to-back — the streak is your score
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">DUEL LOST</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Duels won · reached duel {duel} · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-stone-400 via-neutral-500 to-zinc-700">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Flinches cost a round — only the blazing gold glow starts the draw
      </p>
    </div>
  );
}
