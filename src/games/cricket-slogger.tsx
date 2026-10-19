"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 600;
const TAU = Math.PI * 2;
const TONE = "from-blue-400 via-indigo-500 to-violet-600";

const CX = 240;
const FIELD_RX = 205;
const FIELD_RY = 180;
const FCY = 360; // field centre y
const BAT_Y = 452; // batsman crease
const BOWL_Y = 150; // bowler end
const SWEET = 0.86;
const TARGET = 71;
const BALLS = 30;
const WICKETS = 3;

type Status = "idle" | "playing" | "over";
type Phase = "tel" | "ball" | "res";
type Delivery = "yorker" | "bouncer" | "length";
type Outcome = "six" | "four" | "gap" | "edge" | "bowled" | "dot" | "caught";

const D_COL: Record<Delivery, string> = {
  yorker: "#fb7185",
  bouncer: "#a78bfa",
  length: "#60a5fa",
};
const D_NAME: Record<Delivery, string> = {
  yorker: "YORKER",
  bouncer: "BOUNCER",
  length: "LENGTH",
};

interface Fielder {
  side: 1 | -1;
  f: number;
  oa: number; // angle jitter
  of: number; // radius jitter
}

interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
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

interface Game {
  phase: Phase;
  phaseT: number;
  ballNo: number; // balls bowled
  runs: number;
  wkts: number;
  type: Delivery;
  side: 1 | -1;
  k: number; // ball flight progress
  dur: number;
  swung: boolean;
  resT: number;
  resDur: number;
  outcome: Outcome;
  runsNow: number;
  text: string;
  land: { x: number; y: number } | null;
  field: Fielder[];
  overIdx: number;
  banner: string;
  bannerT: number;
  parts: Part[];
  floats: Floater[];
  shake: number;
  flash: number;
  flashC: string;
  result: "" | "chased" | "allout" | "short";
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
      life: 0.35 + Math.random() * 0.5,
      max: 0.85,
      r: 1.4 + Math.random() * 2.6,
      c,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, c: string): void {
  g.floats.push({ x, y, text, life: 1, c });
}

function pickDelivery(ballNo: number): Delivery {
  const r = Math.random() + Math.min(0.18, ballNo * 0.006);
  if (r > 0.86) return "bouncer";
  if (r > 0.55) return "yorker";
  return "length";
}

function newField(): Fielder[] {
  const fs = [0.32, 0.44, 0.56, 0.68, 0.8, 0.92];
  for (let i = fs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fs[i], fs[j]] = [fs[j], fs[i]];
  }
  const out: Fielder[] = [];
  for (let i = 0; i < 6; i++) {
    out.push({
      side: i % 2 === 0 ? -1 : 1,
      f: fs[i],
      oa: (Math.random() - 0.5) * 0.4,
      of: (Math.random() - 0.5) * 0.06,
    });
  }
  return out;
}

function fieldPos(fl: Fielder): { x: number; y: number } {
  const a = (fl.side === 1 ? -0.9 : -2.24) + fl.oa;
  const f = Math.max(0.1, Math.min(0.97, fl.f + fl.of));
  return {
    x: CX + Math.cos(a) * FIELD_RX * f,
    y: FCY + Math.sin(a) * FIELD_RY * f,
  };
}

function shotPos(side: 1 | -1, f: number): { x: number; y: number } {
  const a = (side === 1 ? -0.9 : -2.24) + (Math.random() - 0.5) * 0.5;
  return {
    x: CX + Math.cos(a) * FIELD_RX * f,
    y: FCY + Math.sin(a) * FIELD_RY * f,
  };
}

function createGame(): Game {
  return {
    phase: "tel",
    phaseT: 0.95,
    ballNo: 0,
    runs: 0,
    wkts: 0,
    type: pickDelivery(0),
    side: 1,
    k: 0,
    dur: 1.3,
    swung: false,
    resT: 0,
    resDur: 0.9,
    outcome: "dot",
    runsNow: 0,
    text: "",
    land: null,
    field: newField(),
    overIdx: 0,
    banner: `CHASE ${TARGET} OFF ${BALLS}`,
    bannerT: 1.8,
    parts: [],
    floats: [],
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    result: "",
    over: false,
  };
}

function judge(g: Game, k: number): Outcome {
  const wm = Math.max(0.7, 1 - g.ballNo * 0.01);
  const d = Math.abs(k - SWEET);
  if (d <= 0.042 * wm) return "six";
  if (d <= 0.095 * wm) return "four";
  if (d <= 0.165 * wm) return "gap";
  if (d <= 0.25 * wm) return "edge";
  return "dot";
}

function fieldCovers(g: Game, side: 1 | -1, f: number, tol: number): boolean {
  return g.field.some((fl) => fl.side === side && Math.abs(fl.f - fl.of - f) <= tol);
}

function resolve(g: Game, k: number | null): void {
  if (g.phase !== "ball") return;
  g.swung = k !== null;
  let out: Outcome;
  if (k === null) {
    out = g.type === "bouncer" ? "dot" : "bowled";
  } else {
    out = judge(g, k);
    if (out === "dot") {
      // swung and missed — only the yorker finds the timber
      out = g.type === "yorker" ? "bowled" : "dot";
    } else if (out === "edge" && fieldCovers(g, g.side, 0.4, 0.13)) {
      out = "caught";
    }
  }

  g.outcome = out;
  g.resT = 0;
  g.phase = "res";

  if (out === "six") {
    g.runs += 6;
    g.runsNow = 6;
    g.text = "SIX!";
    g.land = shotPos(g.side, 1.35);
    g.flash = 0.6;
    g.flashC = "#67e8f9";
    g.shake = 7;
    burst(g, g.land?.x ?? CX, g.land?.y ?? FCY, "#67e8f9", 24, 230);
    floater(g, g.land?.x ?? CX, (g.land?.y ?? FCY) - 24, "+6", "#67e8f9");
  } else if (out === "four") {
    g.runs += 4;
    g.runsNow = 4;
    g.text = "FOUR!";
    g.land = shotPos(g.side, 0.94);
    g.flash = 0.45;
    g.flashC = "#a5f3fc";
    burst(g, g.land?.x ?? CX, g.land?.y ?? FCY, "#a5f3fc", 16, 190);
    floater(g, g.land?.x ?? CX, (g.land?.y ?? FCY) - 24, "+4", "#a5f3fc");
  } else if (out === "gap") {
    const f = 0.62 + (Math.random() - 0.5) * 0.08;
    const two = !fieldCovers(g, g.side, f, 0.15);
    const r = two ? 2 : 1;
    g.runs += r;
    g.runsNow = r;
    g.text = `${r} RUN${two ? "S" : ""}`;
    g.land = shotPos(g.side, f);
  } else if (out === "edge") {
    g.runs += 1;
    g.runsNow = 1;
    g.text = "SNEAKED THROUGH";
    g.land = shotPos(g.side, 0.44);
  } else if (out === "caught") {
    g.wkts += 1;
    g.runsNow = 0;
    g.text = "CAUGHT!";
    g.land = shotPos(g.side, 0.42);
    g.flash = 0.55;
    g.flashC = "#fb7185";
    g.shake = 9;
    burst(g, g.land?.x ?? CX, g.land?.y ?? FCY, "#fb7185", 18, 200);
    floater(g, g.land?.x ?? CX, (g.land?.y ?? FCY) - 26, "OUT", "#fb7185");
  } else if (out === "bowled") {
    g.wkts += 1;
    g.runsNow = 0;
    g.text = "BOWLED!";
    g.land = { x: CX, y: BAT_Y + 34 };
    g.flash = 0.6;
    g.flashC = "#f43f5e";
    g.shake = 11;
    burst(g, CX, BAT_Y, "#fde68a", 22, 240);
  } else {
    g.runsNow = 0;
    g.text = g.swung ? "BEATEN" : "DOT BALL";
    g.land = { x: CX + 18, y: BAT_Y + 60 };
  }
}

function nextBall(g: Game): void {
  if (g.runs >= TARGET) {
    g.runs += 30;
    g.text = "CHASED! +30";
    g.result = "chased";
    g.over = true;
    return;
  }
  if (g.wkts >= WICKETS) {
    g.result = "allout";
    g.over = true;
    return;
  }
  if (g.ballNo >= BALLS) {
    g.result = "short";
    g.over = true;
    return;
  }
  const over = Math.floor(g.ballNo / 6);
  if (over !== g.overIdx) {
    g.overIdx = over;
    g.field = newField();
    g.banner = `OVER ${over} · FIELD MOVED`;
    g.bannerT = 1.7;
  }
  g.type = pickDelivery(g.ballNo);
  g.k = 0;
  g.dur = Math.max(0.85, 1.3 - g.ballNo * 0.014);
  g.swung = false;
  g.land = null;
  g.runsNow = 0;
  g.phase = "tel";
  g.phaseT = 0.95;
}

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt * 1.8);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.05;
    f.y -= 34 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (g.phase === "tel") {
    g.phaseT -= dt;
    if (g.phaseT <= 0) {
      g.phase = "ball";
      g.k = 0;
    }
    return;
  }
  if (g.phase === "ball") {
    g.k += dt / g.dur;
    if (g.k >= 1) {
      g.k = 1;
      resolve(g, null); // left it — no swing
    }
    return;
  }
  // res
  g.resT += dt;
  if (g.resT >= g.resDur) {
    g.ballNo += 1;
    nextBall(g);
    if (g.over) {
      g.banner = g.result === "chased" ? "TARGET CLEARED!" : g.result === "allout" ? "ALL OUT" : `${BALLS} BALLS UP`;
      g.bannerT = 2;
    }
  }
}

/* ------------------------------ render ------------------------------ */

function drawField(ctx: CanvasRenderingContext2D, time: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0a23");
  bg.addColorStop(0.5, "#0b0a1e");
  bg.addColorStop(1, "#08061a");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // floodlights
  for (const lx of [54, W - 54]) {
    const gl = ctx.createRadialGradient(lx, 40, 6, lx, 40, 150);
    gl.addColorStop(0, "rgba(165, 243, 252, 0.28)");
    gl.addColorStop(1, "rgba(165, 243, 252, 0)");
    ctx.fillStyle = gl;
    ctx.fillRect(lx - 150, -60, 300, 240);
  }

  // grass
  const grass = ctx.createRadialGradient(CX, FCY, 60, CX, FCY, 300);
  grass.addColorStop(0, "#0b2e1c");
  grass.addColorStop(1, "#06170f");
  ctx.fillStyle = grass;
  ctx.beginPath();
  ctx.ellipse(CX, FCY, FIELD_RX + 14, FIELD_RY + 14, 0, 0, TAU);
  ctx.fill();

  // boundary rope
  ctx.strokeStyle = "rgba(103, 232, 249, 0.55)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([12, 9]);
  ctx.lineDashOffset = -(time / 60) % 21;
  ctx.beginPath();
  ctx.ellipse(CX, FCY, FIELD_RX, FIELD_RY, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  // pitch
  ctx.fillStyle = "rgba(180, 130, 70, 0.35)";
  ctx.beginPath();
  ctx.roundRect(CX - 17, BOWL_Y - 6, 34, BAT_Y - BOWL_Y + 44, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(254, 243, 199, 0.55)";
  ctx.lineWidth = 1.5;
  for (const cy of [BOWL_Y + 8, BAT_Y + 6]) {
    ctx.beginPath();
    ctx.moveTo(CX - 30, cy);
    ctx.lineTo(CX + 30, cy);
    ctx.stroke();
  }
}

function drawStumps(ctx: CanvasRenderingContext2D, x: number, y: number, broken: boolean): void {
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    if (broken) {
      ctx.moveTo(x + i * 6 + i * 7, y - 26);
      ctx.lineTo(x + i * 6 + i * 11, y + 6);
    } else {
      ctx.moveTo(x + i * 6, y - 26);
      ctx.lineTo(x + i * 6, y + 6);
    }
    ctx.stroke();
  }
  if (!broken) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 27);
    ctx.lineTo(x + 9, y - 27);
    ctx.stroke();
  }
}

function drawFigures(ctx: CanvasRenderingContext2D, g: Game | null): void {
  // bowler
  const bp = g && g.phase === "tel" ? Math.sin((0.95 - g.phaseT) * 14) * 6 : 0;
  ctx.save();
  ctx.translate(CX, BOWL_Y - 24);
  ctx.fillStyle = "#818cf8";
  ctx.shadowColor = "#818cf8";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.roundRect(-9, -34, 18, 34, 7);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#c7d2fe";
  ctx.beginPath();
  ctx.arc(0, -44, 8, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#c7d2fe";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(7, -30);
  ctx.lineTo(14 + bp, -48 - Math.abs(bp));
  ctx.stroke();
  ctx.restore();

  // batsman
  const swinging =
    g !== null &&
    g.phase === "res" &&
    (g.outcome === "six" ||
      g.outcome === "four" ||
      g.outcome === "gap" ||
      g.outcome === "edge");
  ctx.save();
  ctx.translate(CX, BAT_Y);
  // legs
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-4, -26);
  ctx.lineTo(-7, 0);
  ctx.moveTo(5, -26);
  ctx.lineTo(8, 0);
  ctx.stroke();
  // body
  ctx.save();
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.roundRect(-10, -60, 20, 36, 8);
  ctx.fill();
  ctx.restore();
  // helmet
  ctx.fillStyle = "#0ea5e9";
  ctx.beginPath();
  ctx.arc(1, -70, 10, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#e0f2fe";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, -74);
  ctx.lineTo(11, -66);
  ctx.stroke();
  // bat
  const swing = swinging ? Math.sin(Math.min(1, g.resT / 0.3) * Math.PI) * 2.4 : 0;
  ctx.save();
  ctx.translate(12, -46);
  ctx.rotate(-0.7 - swing);
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.roundRect(-3, -4, 6, 34, 3);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function ballXY(g: Game): { x: number; y: number; r: number } {
  if (g.phase === "tel") {
    return { x: CX + 16, y: BOWL_Y - 46, r: 6 };
  }
  if (g.phase === "ball") {
    const k = Math.max(0, Math.min(1, g.k));
    let y = BOWL_Y + 6 + (BAT_Y - 14 - BOWL_Y - 6) * k;
    if (g.type === "bouncer") y -= Math.sin(k * Math.PI) * 74;
    else if (g.type === "length") y -= Math.sin(k * Math.PI) * 26;
    else if (g.type === "yorker") y -= Math.sin(k * Math.PI) * 8;
    const x = CX + Math.sin(k * 4.4) * (g.type === "length" ? 5 : 2.5);
    return { x, y, r: 5 + 6 * k };
  }
  // resolve flight
  const k = Math.min(1, g.resT / 0.55);
  const land = g.land ?? { x: CX, y: BAT_Y };
  const sx = CX;
  const sy = BAT_Y - 40;
  const lift = g.outcome === "six" ? 150 : g.outcome === "four" ? 80 : 60;
  return {
    x: sx + (land.x - sx) * k,
    y: sy + (land.y - sy) * k - Math.sin(k * Math.PI) * lift,
    r: 9 - 3 * k,
  };
}

function drawMeter(ctx: CanvasRenderingContext2D, g: Game): void {
  const mx = 44;
  const my = H - 62;
  const mw = W - 88;
  const mh = 20;
  ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
  ctx.beginPath();
  ctx.roundRect(mx - 7, my - 7, mw + 14, mh + 30, 14);
  ctx.fill();
  ctx.font = "700 9px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(154, 154, 182, 0.9)";
  ctx.fillText(g.phase === "ball" ? "SWING ON THE GREEN" : "WATCH THE COLOURED ARC", W / 2, my - 12);

  const sx = mx + SWEET * mw;
  const band = (d: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(sx - d * mw, my, d * 2 * mw, mh);
  };
  ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, 8);
  ctx.fill();
  const wm = Math.max(0.7, 1 - g.ballNo * 0.01);
  band(0.25 * wm, "rgba(244, 63, 94, 0.45)");
  band(0.165 * wm, "rgba(251, 191, 36, 0.5)");
  band(0.095 * wm, "rgba(52, 211, 153, 0.6)");
  band(0.042 * wm, "rgba(240, 255, 255, 0.9)");

  if (g.phase === "ball") {
    const cx = mx + Math.max(0, Math.min(1, g.k)) * mw;
    ctx.save();
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - 2, my - 5, 4, mh + 10);
    ctx.restore();
  }
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  drawField(ctx, time);

  if (g) {
    // delivery arc telegraph
    if (g.phase === "tel") {
      const c = D_COL[g.type];
      const pulse = 0.5 + Math.sin(time / 90) * 0.3;
      ctx.save();
      ctx.strokeStyle = hexA(c, pulse);
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -(time / 40) % 16;
      ctx.beginPath();
      const lift = g.type === "bouncer" ? 90 : g.type === "length" ? 34 : 6;
      ctx.moveTo(CX + 16, BOWL_Y - 40);
      ctx.quadraticCurveTo(CX + 40, (BOWL_Y + BAT_Y) / 2 - lift, CX, BAT_Y - 18);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "800 15px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = c;
      ctx.shadowColor = c;
      ctx.shadowBlur = 14;
      ctx.fillText(D_NAME[g.type], CX, 118);
      ctx.restore();
    }

    drawStumps(ctx, CX, BOWL_Y + 4, false);
    drawStumps(ctx, CX, BAT_Y + 40, g.outcome === "bowled" && g.phase === "res");
    drawFigures(ctx, g);

    // fielders
    for (const fl of g.field) {
      const p = fieldPos(fl);
      const hot = g.phase === "res" && g.land && Math.hypot(p.x - g.land.x, p.y - g.land.y) < 30;
      ctx.save();
      ctx.shadowColor = hot ? "#f472b6" : "#4ade80";
      ctx.shadowBlur = hot ? 18 : 8;
      ctx.fillStyle = hot ? "#f472b6" : "#4ade80";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 6, 5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 7, 8, 3, 0, 0, TAU);
      ctx.fill();
    }

    // ball
    const b = ballXY(g);
    ctx.save();
    ctx.shadowColor = "#f8fafc";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fecaca";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.55, time / 200, time / 200 + Math.PI);
    ctx.stroke();
    ctx.restore();

    // shot side arrows
    const arrow = (side: 1 | -1) => {
      const active = g.side === side;
      const x = CX + side * 58;
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.3;
      ctx.fillStyle = active ? "#67e8f9" : "#94a3b8";
      if (active) {
        ctx.shadowColor = "#22d3ee";
        ctx.shadowBlur = 14;
      }
      ctx.beginPath();
      if (side === 1) {
        ctx.moveTo(x + 14, BAT_Y - 88);
        ctx.lineTo(x - 4, BAT_Y - 97);
        ctx.lineTo(x - 4, BAT_Y - 79);
      } else {
        ctx.moveTo(x - 14, BAT_Y - 88);
        ctx.lineTo(x + 4, BAT_Y - 97);
        ctx.lineTo(x + 4, BAT_Y - 79);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    arrow(-1);
    arrow(1);

    // scoreboard
    ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
    ctx.beginPath();
    ctx.roundRect(14, 14, 216, 62, 12);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.font = "800 26px ui-monospace, monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${g.runs}/${g.wkts}`, 28, 48);
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.fillStyle = "#93c5fd";
    ctx.fillText(`(${g.ballNo}b) · TARGET ${TARGET}`, 28, 68);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
    ctx.beginPath();
    ctx.roundRect(W - 174, 14, 160, 62, 12);
    ctx.fill();
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.fillStyle = "#fda4af";
    ctx.fillText("WICKETS LEFT", W - 28, 36);
    for (let i = 0; i < WICKETS; i++) {
      ctx.fillStyle = i < WICKETS - g.wkts ? "#4ade80" : "rgba(148, 163, 184, 0.3)";
      ctx.beginPath();
      ctx.arc(W - 40 - i * 24, 56, 8, 0, TAU);
      ctx.fill();
    }
    ctx.textAlign = "left";
    const need = Math.max(0, TARGET - g.runs);
    const left = Math.max(0, BALLS - g.ballNo);
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.fillStyle = need <= left * 6 ? "#4ade80" : "#fbbf24";
    ctx.fillText(`NEED ${need} OFF ${left}`, 24, 96);

    drawMeter(ctx, g);

    // particles
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // result text
    if (g.phase === "res" && g.resT > 0.18) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - g.resT / 0.9);
      ctx.font = "800 24px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(56, 189, 248, 0.9)";
      ctx.shadowBlur = 16;
      ctx.fillStyle = g.runsNow > 0 || g.outcome === "six" || g.outcome === "four" ? "#ffffff" : "#fda4af";
      ctx.fillText(g.text, CX, 250);
      if (g.runsNow > 0) {
        ctx.font = "800 16px ui-monospace, monospace";
        ctx.fillStyle = "#a5f3fc";
        ctx.fillText(`+${g.runsNow}`, CX, 274);
      }
      ctx.restore();
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
      ctx.font = "800 22px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(99, 102, 241, 0.9)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, CX, 210);
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

export default function CricketSlogger({ gameId = "cricket-slogger" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [balls, setBalls] = useState(0);
  const [wkts, setWkts] = useState(0);
  const [result, setResult] = useState("");
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
    setBalls(0);
    setWkts(0);
    setResult("");
    setNewBest(false);
    setStatus("playing");
  }, []);

  const setSide = useCallback((side: 1 | -1) => {
    const g = gameRef.current;
    if (g) g.side = side;
  }, []);

  const swing = useCallback(() => {
    const g = gameRef.current;
    if (g && g.phase === "ball") resolve(g, g.k);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastBalls = -1;
    let lastWkts = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      if (g.runs !== lastScore) {
        lastScore = g.runs;
        setScore(g.runs);
      }
      if (g.ballNo !== lastBalls) {
        lastBalls = g.ballNo;
        setBalls(g.ballNo);
      }
      if (g.wkts !== lastWkts) {
        lastWkts = g.wkts;
        setWkts(g.wkts);
      }

      draw(t);
      if (g.over) {
        setScore(g.runs);
        setBalls(g.ballNo);
        setWkts(g.wkts);
        setResult(g.result);
        setNewBest(submit(g.runs));
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
        if (status === "playing") swing();
        else start();
        return;
      }
      if (status !== "playing") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSide(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSide(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start, swing, setSide]);

  const padBtn =
    "touch-none rounded-xl border bg-surface py-3 text-sm font-bold uppercase tracking-wider transition active:scale-95";

  const resultTitle =
    result === "chased" ? "TARGET CLEARED" : result === "allout" ? "ALL OUT" : "INNINGS OVER";

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-blue-300">
          Balls <b className="ml-1 text-sm text-ink">{balls}/30</b>
        </span>
        <span className="text-rose-300">
          Out <b className="ml-1 text-sm text-ink">{wkts}/3</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(99,102,241,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Cricket Slogger ground"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") return;
            swing();
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">CRICKET SLOGGER</p>
            <p className="mt-2 text-sm text-muted">
              Thirty balls to chase {TARGET}, three wickets in hand. The bowler shows his hand
              first — rose arc is a yorker, violet is the bouncer, blue is a length ball — and the
              timing meter at your feet tells you when to swing. Nail the white band for six, the
              green for four, mistime it into a fielder and you&apos;re gone. The field moves
              every over.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Open the innings
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ←/→ pick the side · Space / click to swing when the cursor hits the white
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-violet-300">{resultTitle}</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Runs · {balls} balls · {wkts} down · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Target {TARGET} · white band = six</p>
          </Overlay>
        )}
      </div>

      <div className="mt-2 grid touch-none select-none grid-cols-3 gap-2">
        <button
          type="button"
          onPointerDown={() => setSide(-1)}
          aria-label="Play to the left"
          className={`${padBtn} border-sky-400/50 text-sky-300`}
        >
          ◀ Left
        </button>
        <button
          type="button"
          onPointerDown={() => swing()}
          aria-label="Swing the bat"
          className={`${padBtn} border-indigo-400/50 text-indigo-300`}
        >
          Swing
        </button>
        <button
          type="button"
          onPointerDown={() => setSide(1)}
          aria-label="Play to the right"
          className={`${padBtn} border-sky-400/50 text-sky-300`}
        >
          Right ▶
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Rose = yorker · violet = bouncer · blue = length · white band on the meter = six
      </p>
    </div>
  );
}
