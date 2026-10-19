"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 720;
const H = 420;
const STEP = 1000 / 60;
const TAU = Math.PI * 2;

const QUARTER = 1320; // feet
const REDLINE = 9000; // rpm
const ACCEL = 30; // base ft/s²
const GEAR_TOP = [88, 146, 222, 295]; // ft/s at redline per gear (0-based)
const BAND_LO = 7000; // green shift band
const BAND_HI = 8900;
const PPU = 0.5; // px per foot

type Status = "idle" | "racing" | "passover" | "summary";
type Phase = "stage" | "tree" | "green" | "run" | "foul" | "done";

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
  phase: Phase;
  phaseT: number;
  stageHold: number;
  rpm: number;
  speed: number;
  dist: number;
  gear: number;
  shiftT: number;
  powerMul: number;
  powerT: number;
  runT: number;
  rt: number;
  launchQ: string;
  pass: number;
  ets: number[];
  parts: Part[];
  shake: number;
  flash: number;
  toast: string;
  toastT: number;
  hudAcc: number;
  lastHud: number;
  limiter: boolean;
}

function createGame(): G {
  return {
    phase: "stage",
    phaseT: 0,
    stageHold: 0,
    rpm: 900,
    speed: 0,
    dist: 0,
    gear: 0,
    shiftT: 0,
    powerMul: 1,
    powerT: 0,
    runT: 0,
    rt: 0,
    launchQ: "—",
    pass: 1,
    ets: [],
    parts: [],
    shake: 0,
    flash: 0,
    toast: "",
    toastT: 0,
    hudAcc: 0,
    lastHud: -1,
    limiter: false,
  };
}

/* parallax mesa silhouettes */
const MESAS: { x: number; w: number; h: number }[] = [
  { x: -40, w: 260, h: 78 },
  { x: 180, w: 150, h: 46 },
  { x: 330, w: 300, h: 104 },
  { x: 600, w: 170, h: 58 },
  { x: 720, w: 260, h: 88 },
  { x: 940, w: 140, h: 44 },
  { x: 1060, w: 320, h: 96 },
];
const MESAS2: { x: number; w: number; h: number }[] = [
  { x: 60, w: 210, h: 40 },
  { x: 300, w: 260, h: 56 },
  { x: 620, w: 190, h: 36 },
  { x: 880, w: 240, h: 52 },
  { x: 1180, w: 200, h: 42 },
];

function fmtEt(s: number) {
  return `${s.toFixed(3)}s`;
}

function powerCurve(rpmNorm: number): number {
  const x = Math.min(1, Math.max(0, (rpmNorm - 0.55) / 0.6));
  return 0.35 + 0.65 * Math.sin(Math.PI * x);
}

function drawDragCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  wheelPhase: number,
  squat: number,
  flame: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 4, 62, 8, 0, 0, TAU);
  ctx.fill();
  ctx.translate(0, squat);

  // exhaust flame
  if (flame) {
    ctx.fillStyle = "rgba(251,146,60,0.85)";
    ctx.beginPath();
    ctx.moveTo(-56, -6);
    ctx.lineTo(-56 - 18 - Math.sin(t * 0.05) * 6, -10);
    ctx.lineTo(-56 - 14 - Math.cos(t * 0.043) * 5, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(253,224,71,0.9)";
    ctx.beginPath();
    ctx.moveTo(-56, -7);
    ctx.lineTo(-56 - 10, -9);
    ctx.lineTo(-56 - 8, -4);
    ctx.closePath();
    ctx.fill();
  }

  const wheel = (wx: number, r: number) => {
    ctx.save();
    ctx.translate(wx, -r);
    ctx.rotate(wheelPhase);
    ctx.fillStyle = "#0c0a14";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#3f3f56";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(226,232,240,0.6)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
      ctx.stroke();
    }
    ctx.restore();
  };
  wheel(-30, 17); // skinny front
  wheel(30, 23); // big slick rear

  // body
  const bodyGrad = ctx.createLinearGradient(0, -44, 0, -6);
  bodyGrad.addColorStop(0, "#fb7185");
  bodyGrad.addColorStop(1, "#be123c");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-58, -8);
  ctx.lineTo(-60, -24);
  ctx.lineTo(-30, -28);
  ctx.lineTo(-16, -44);
  ctx.lineTo(18, -46);
  ctx.lineTo(34, -28);
  ctx.lineTo(60, -24);
  ctx.lineTo(58, -8);
  ctx.closePath();
  ctx.fill();
  // canopy
  ctx.fillStyle = "rgba(15,10,26,0.9)";
  ctx.beginPath();
  ctx.moveTo(-12, -42);
  ctx.lineTo(15, -43);
  ctx.lineTo(27, -28);
  ctx.lineTo(-18, -27);
  ctx.closePath();
  ctx.fill();
  // side stripe + number
  ctx.fillStyle = "#fff1f2";
  ctx.fillRect(-52, -18, 100, 3);
  ctx.font = "bold 13px ui-monospace, monospace";
  ctx.fillStyle = "#fff1f2";
  ctx.textAlign = "center";
  ctx.fillText("7", 0, -12);
  ctx.textAlign = "left";
  // rear wing
  ctx.fillStyle = "#0c0a14";
  ctx.fillRect(-64, -36, 8, 14);
  // bumper glow
  ctx.fillStyle = "#fde68a";
  ctx.fillRect(54, -20, 5, 4);
  ctx.restore();
}

export default function DragSprint() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<G | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [passEts, setPassEts] = useState<number[]>([]);
  const [lastEt, setLastEt] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [liveMs, setLiveMs] = useState(0);
  const { best, submit } = useBestScore("drag-sprint", "low");
  const inputRef = useRef({ rev: false, shift: false });

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const sxShake = Math.sin(time * 0.011) * g.shake;
    const syShake = Math.cos(time * 0.013) * g.shake;

    /* dusk sky */
    const sky = ctx.createLinearGradient(0, 0, 0, 300);
    sky.addColorStop(0, "#1b0725");
    sky.addColorStop(0.55, "#7c1d4f");
    sky.addColorStop(1, "#f97316");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 302);

    /* sun */
    ctx.save();
    ctx.shadowColor = "#fb923c";
    ctx.shadowBlur = 40;
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.arc(520, 236, 30, 0, TAU);
    ctx.fill();
    ctx.restore();

    /* mesas (two parallax layers) */
    const drawMesas = (list: { x: number; w: number; h: number }[], off: number, color: string) => {
      const span = 1400;
      const o = ((off % span) + span) % span;
      for (const m of list) {
        for (const k of [0, span]) {
          const x = m.x - o + k;
          if (x > W || x + m.w < 0) continue;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(x, 268);
          ctx.lineTo(x + m.w * 0.18, 268 - m.h);
          ctx.lineTo(x + m.w * 0.82, 268 - m.h * 0.92);
          ctx.lineTo(x + m.w, 268);
          ctx.closePath();
          ctx.fill();
        }
      }
    };
    drawMesas(MESAS, g.dist * 0.03, "rgba(30,10,45,0.85)");
    drawMesas(MESAS2, g.dist * 0.07, "rgba(18,6,32,0.95)");

    ctx.save();
    ctx.translate(sxShake, syShake);

    /* track surface */
    const ground = ctx.createLinearGradient(0, 268, 0, H);
    ground.addColorStop(0, "#241426");
    ground.addColorStop(1, "#12080f");
    ctx.fillStyle = ground;
    ctx.fillRect(-20, 268, W + 40, H - 268);
    // centre stripe
    ctx.fillStyle = "rgba(226,232,240,0.1)";
    ctx.fillRect(-20, 318, W + 40, 3);

    /* distance markers */
    const first = Math.floor(Math.max(0, g.dist - 320) / 330) * 330;
    ctx.font = "bold 9px ui-monospace, monospace";
    for (let ft = first; ft < g.dist + 1500; ft += 330) {
      const mx = 168 + (ft - g.dist) * PPU;
      if (mx < -40 || mx > W + 40) continue;
      if (ft === 0) continue;
      ctx.fillStyle = "rgba(226,232,240,0.28)";
      ctx.fillRect(mx - 1, 252, 2, 20);
      ctx.fillStyle = "rgba(226,232,240,0.55)";
      const label = ft === 660 ? "1/8 MI" : ft === 1000 ? "1000 FT" : `${ft}`;
      ctx.textAlign = "center";
      ctx.fillText(label, mx, 246);
    }
    // start line
    const startX = 168 + (0 - g.dist) * PPU;
    if (startX > -30 && startX < W + 30) {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? "#e2e8f0" : "#1e1226";
        ctx.fillRect(startX - 10 + (i % 2) * 10, 296 + Math.floor(i / 2) * 5, 10, 5);
      }
    }
    // finish banner at 1320
    const finX = 168 + (QUARTER - g.dist) * PPU;
    if (finX > -80 && finX < W + 80) {
      ctx.fillStyle = "#0c0a14";
      ctx.fillRect(finX - 3, 196, 6, 104);
      ctx.fillRect(finX + 96, 196, 6, 104);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 10; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? "#e2e8f0" : "#141020";
          ctx.fillRect(finX - 3 + c * 10.5, 196 + r * 10, 10.5, 10);
        }
      }
    }

    /* particles */
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* the car */
    const squat = g.phase === "run" && g.powerT > 0 ? -3 : 0;
    const wheelPhase = (g.dist * PPU) / 14;
    const flame = g.phase === "run" && !g.limiter && g.shiftT <= 0;
    drawDragCar(ctx, 168, 300, time, wheelPhase, squat, flame);

    /* Christmas tree */
    const treeOn = (i: number) => {
      if (g.phase === "stage") return false;
      if (g.phase === "tree") return g.phaseT >= 0.5 * (i + 1);
      return g.phase === "green" || g.phase === "run";
    };
    ctx.fillStyle = "#0c0a14";
    ctx.beginPath();
    ctx.roundRect(36, 52, 44, 196, 9);
    ctx.fill();
    ctx.strokeStyle = "rgba(226,232,240,0.2)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const lamps = ["#f59e0b", "#f59e0b", "#f59e0b", "#22c55e"];
    for (let i = 0; i < 4; i++) {
      const ly = 76 + i * 42;
      const on = i < 3 ? treeOn(i) : g.phase === "green" || g.phase === "run";
      ctx.beginPath();
      ctx.arc(58, ly, 13, 0, TAU);
      ctx.fillStyle = on ? lamps[i] : "rgba(148,163,184,0.16)";
      if (on) {
        ctx.shadowColor = lamps[i];
        ctx.shadowBlur = 18;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.font = "bold 8px ui-monospace, monospace";
    ctx.fillStyle = "#9aa4bd";
    ctx.textAlign = "center";
    ctx.fillText("STAGE", 58, 240);
    ctx.textAlign = "left";

    /* tachometer */
    const tcx = 620;
    const tcy = 344;
    const tr = 56;
    ctx.save();
    ctx.fillStyle = "rgba(8,4,14,0.82)";
    ctx.beginPath();
    ctx.arc(tcx, tcy, tr + 12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(226,232,240,0.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const a0 = Math.PI * 0.75;
    const a1 = Math.PI * 2.25;
    const rpmA = a0 + (a1 - a0) * Math.min(1, g.rpm / REDLINE);
    // green band
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(tcx, tcy, tr, a0 + (a1 - a0) * (BAND_LO / REDLINE), a0 + (a1 - a0) * (BAND_HI / REDLINE));
    ctx.stroke();
    // red zone
    ctx.strokeStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(tcx, tcy, tr, a0 + (a1 - a0) * (BAND_HI / REDLINE), a1);
    ctx.stroke();
    // face arc
    ctx.strokeStyle = "rgba(226,232,240,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tcx, tcy, tr - 7, a0, a1);
    ctx.stroke();
    // needle
    ctx.strokeStyle = "#f0abfc";
    ctx.shadowColor = "#d946ef";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tcx, tcy);
    ctx.lineTo(tcx + Math.cos(rpmA) * (tr - 10), tcy + Math.sin(rpmA) * (tr - 10));
    ctx.stroke();
    ctx.shadowBlur = 0;
    // gear + rpm digits
    ctx.textAlign = "center";
    ctx.font = "bold 22px ui-monospace, monospace";
    ctx.fillStyle = g.limiter ? "#ef4444" : "#f8fafc";
    ctx.fillText(g.phase === "run" ? `G${g.gear + 1}` : "N", tcx, tcy + 4);
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillStyle = "#9aa4bd";
    ctx.fillText(`${Math.round(g.rpm)} RPM`, tcx, tcy + 20);
    ctx.textAlign = "left";

    /* shift prompt */
    if (g.phase === "run" && (g.rpm >= BAND_LO || g.limiter)) {
      const blink = Math.sin(time * 0.02) > 0;
      if (blink) {
        ctx.font = "bold 13px ui-monospace, monospace";
        ctx.fillStyle = g.limiter ? "#ef4444" : "#4ade80";
        ctx.textAlign = "center";
        ctx.fillText(g.limiter ? "SHIFT!" : "SHIFT NOW", tcx, tcy - tr - 18);
        ctx.textAlign = "left";
      }
    }

    /* top strip: live ET + speed */
    ctx.fillStyle = "rgba(8,4,14,0.7)";
    ctx.beginPath();
    ctx.roundRect(150, 12, 250, 40, 9);
    ctx.fill();
    ctx.font = "bold 24px ui-monospace, monospace";
    ctx.fillStyle = "#f8fafc";
    const etShown = g.phase === "run" ? g.runT : g.ets.length > 0 ? g.ets[g.ets.length - 1] : 0;
    ctx.fillText(fmtEt(etShown), 162, 41);
    ctx.font = "bold 26px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = "#fda4af";
    const mph = Math.round(g.speed * 0.6818);
    ctx.fillText(String(mph), W - 110, 40);
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillStyle = "#9aa4bd";
    ctx.fillText("MPH", W - 110, 50);
    ctx.textAlign = "left";

    /* pass pips */
    ctx.font = "bold 10px ui-monospace, monospace";
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < g.ets.length ? "#4ade80" : "rgba(148,163,184,0.3)";
      ctx.beginPath();
      ctx.arc(424 + i * 16, 26, 5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#9aa4bd";
    ctx.fillText(`PASS ${g.pass}/3`, 424, 46);

    /* toast */
    if (g.toastT > 0) {
      const a = Math.min(1, g.toastT * 2);
      ctx.globalAlpha = a;
      ctx.font = "bold 22px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fde68a";
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 16;
      ctx.fillText(g.toast, W / 2, 100 - (1 - a) * 10);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    }

    /* foul overlay */
    if (g.phase === "foul") {
      ctx.fillStyle = "rgba(220,38,38,0.22)";
      ctx.fillRect(0, 0, W, H);
      ctx.font = "bold 44px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fca5a5";
      ctx.shadowColor = "#dc2626";
      ctx.shadowBlur = 22;
      ctx.fillText("REDLIGHT", W / 2, H / 2 - 8);
      ctx.font = "bold 13px ui-monospace, monospace";
      ctx.fillStyle = "#fecaca";
      ctx.fillText("FALSE START — RESET", W / 2, H / 2 + 20);
      ctx.shadowBlur = 0;
      ctx.textAlign = "left";
    }

    ctx.restore();

    /* launch flash */
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, g.flash * 0.5)})`;
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

  /* ---------------- flow handlers ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame();
    setPassEts([]);
    setLastEt(0);
    setNewBest(false);
    setLiveMs(0);
    setStatus("racing");
  }, []);

  const nextPass = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.phase = "stage";
    g.phaseT = 0;
    g.stageHold = 0;
    g.rpm = 900;
    g.speed = 0;
    g.dist = 0;
    g.gear = 0;
    g.shiftT = 0;
    g.powerMul = 1;
    g.powerT = 0;
    g.runT = 0;
    g.rt = 0;
    g.launchQ = "—";
    g.limiter = false;
    g.toast = "";
    g.toastT = 0;
    g.pass = g.ets.length + 1;
    inputRef.current.rev = false;
    inputRef.current.shift = false;
    setLiveMs(0);
    setStatus("racing");
  }, []);

  // main loop — all mutable game logic runs inline here (react-compiler safe)
  useEffect(() => {
    if (status !== "racing") return;
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
        if (!g) break;
        const dt = STEP / 1000;
        const k = inputRef.current;

        if (g.phase === "stage") {
          g.rpm += (k.rev ? 5600 : -7000) * dt;
          g.rpm = Math.max(900, Math.min(9150, g.rpm));
          if (k.rev) {
            g.stageHold += dt;
            if (g.stageHold >= 0.45) {
              g.phase = "tree";
              g.phaseT = 0;
            }
          } else {
            g.stageHold = 0;
          }
        } else if (g.phase === "tree") {
          g.phaseT += dt;
          g.rpm += (k.rev ? 5600 : -7000) * dt;
          g.rpm = Math.max(900, Math.min(9150, g.rpm));
          if (!k.rev) {
            g.phase = "foul";
            g.phaseT = 0;
            g.shake = 10;
            g.flash = 0.9;
            g.toast = "";
            g.toastT = 0;
          } else if (g.phaseT >= 2.0) {
            g.phase = "green";
            g.phaseT = 0;
          }
        } else if (g.phase === "green") {
          g.phaseT += dt;
          g.rpm += (k.rev ? 4200 : -2400) * dt;
          g.rpm = Math.max(900, Math.min(9150, g.rpm));
          if (!k.rev) {
            const r = g.rpm;
            g.rt = Math.round(g.phaseT * 1000);
            if (r >= 8700) {
              g.launchQ = "SPIN";
              g.powerMul = 0.5;
              g.powerT = 0.9;
              g.toast = "WHEELSPIN!";
            } else if (r >= 4800 && r <= 8000) {
              g.launchQ = "PERFECT";
              g.powerMul = 1.18;
              g.powerT = 1.2;
              g.toast = "PERFECT LAUNCH!";
            } else if (r >= 3400) {
              g.launchQ = "OK";
              g.powerMul = 1;
              g.powerT = 0;
              g.toast = "LAUNCH";
            } else {
              g.launchQ = "BOG";
              g.powerMul = 0.55;
              g.powerT = 1;
              g.toast = "BOGGED";
            }
            g.toastT = 1;
            g.phase = "run";
            g.runT = 0;
            g.shake = 7;
            g.flash = 0.5;
            for (let i = 0; i < 16; i++) {
              g.parts.push({
                x: 112,
                y: 292,
                vx: -60 - Math.random() * 160,
                vy: -10 - Math.random() * 70,
                life: 0.5 + Math.random() * 0.5,
                max: 1,
                c: i % 3 === 0 ? "rgba(253,224,71,0.9)" : "rgba(148,163,184,0.7)",
                r: 2 + Math.random() * 3.5,
              });
            }
          } else if (g.phaseT >= 1.2) {
            g.rt = 1200;
            g.launchQ = "LATE";
            g.powerMul = 0.7;
            g.powerT = 0.8;
            g.toastT = 0.8;
            g.toast = "LAUNCH LATE";
            g.phase = "run";
            g.runT = 0;
            g.shake = 5;
          }
        } else if (g.phase === "run") {
          g.runT += dt;
          if (k.shift) {
            k.shift = false;
            if (g.gear < 3) {
              const r = g.rpm;
              g.gear += 1;
              if (r >= BAND_LO && r <= BAND_HI) {
                g.shiftT = 0.16;
                g.toast = `G${g.gear + 1} CLEAN`;
                g.toastT = 0.6;
              } else if (r < BAND_LO) {
                g.shiftT = 0.3;
                g.powerMul = 0.78;
                g.powerT = 1.2;
                g.toast = "EARLY SHIFT";
                g.toastT = 0.9;
              } else {
                g.shiftT = 0.3;
                g.powerMul = 0.88;
                g.powerT = 1;
                g.toast = "LATE SHIFT";
                g.toastT = 0.9;
              }
              g.shake = Math.max(g.shake, 3);
              for (let i = 0; i < 7; i++) {
                g.parts.push({
                  x: 114,
                  y: 290,
                  vx: -40 - Math.random() * 90,
                  vy: -6 - Math.random() * 36,
                  life: 0.24 + Math.random() * 0.2,
                  max: 0.45,
                  c: "rgba(251,146,60,0.9)",
                  r: 1.5 + Math.random() * 2.4,
                });
              }
            } else {
              g.toast = "TOP GEAR";
              g.toastT = 0.5;
            }
          }
          if (g.shiftT > 0) {
            g.shiftT -= dt;
          } else {
            const top = GEAR_TOP[g.gear];
            const rpm = Math.max(2400, Math.min(REDLINE, REDLINE * (g.speed / top)));
            const limiter = rpm >= REDLINE - 120;
            g.limiter = limiter;
            let a = ACCEL * powerCurve(rpm / REDLINE) * (g.powerT > 0 ? g.powerMul : 1);
            if (limiter) a *= 0.14;
            g.speed += a * dt;
            if (g.powerT > 0) g.powerT -= dt;
          }
          // display rpm follows speed in gear
          const topNow = GEAR_TOP[g.gear];
          g.rpm = Math.max(
            2400,
            Math.min(REDLINE, REDLINE * (g.speed / topNow) * (g.shiftT > 0 ? 0.72 : 1)),
          );
          g.dist += g.speed * dt;
          if (Math.random() < 0.35) {
            g.parts.push({
              x: 112,
              y: 294,
              vx: -30 - Math.random() * 60,
              vy: -4 - Math.random() * 20,
              life: 0.3,
              max: 0.3,
              c: "rgba(148,163,184,0.5)",
              r: 1.4 + Math.random() * 2,
            });
          }
          if (g.dist >= QUARTER) {
            const et = Math.round(g.runT * 1000) / 1000;
            g.ets.push(et);
            setLastEt(et);
            setPassEts([...g.ets]);
            setNewBest(submit(et));
            g.phaseT = 0;
            g.phase = "done";
            setStatus(g.ets.length >= 3 ? "summary" : "passover");
            break;
          }
        } else if (g.phase === "foul") {
          g.phaseT += dt;
          if (g.phaseT >= 1.5) {
            g.phase = "stage";
            g.phaseT = 0;
            g.stageHold = 0;
            g.rpm = 900;
            g.toast = "";
            g.toastT = 0;
            g.flash = 0;
          }
        }

        /* particles + decay */
        for (const p of g.parts) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 40 * dt;
          p.life -= dt;
        }
        if (g.parts.length > 120) g.parts.splice(0, g.parts.length - 120);
        g.parts = g.parts.filter((p) => p.life > 0);
        g.shake = Math.max(0, g.shake - 0.6);
        g.flash = Math.max(0, g.flash - dt * 1.8);
        g.toastT = Math.max(0, g.toastT - dt);

        /* throttled HUD sync */
        g.hudAcc += STEP;
        if (g.hudAcc >= 60) {
          g.hudAcc = 0;
          const ms = Math.round(g.runT * 1000);
          if (ms !== g.lastHud) {
            g.lastHud = ms;
            setLiveMs(ms);
          }
        }
      }
      draw(t);
      const g = gameRef.current;
      if (!g || g.phase === "run" || g.phase === "foul") {
        if (status === "racing") raf = requestAnimationFrame(loop);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit]);

  useEffect(() => {
    if (status !== "racing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === "Space" || e.code === "Enter") {
        if (status === "idle") start();
        else if (status === "passover") nextPass();
        else if (status === "summary") start();
        else if (!e.repeat) inputRef.current.rev = true;
        return;
      }
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        inputRef.current.shift = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") inputRef.current.rev = false;
    };
    const onBlur = () => {
      inputRef.current.rev = false;
      inputRef.current.shift = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [status, start, nextPass]);

  const revDown = () => {
    inputRef.current.rev = true;
  };
  const revUp = () => {
    inputRef.current.rev = false;
  };
  const shiftTap = () => {
    inputRef.current.shift = true;
  };

  /* ---------------- view ---------------- */

  const fmt = (s: number) => `${s.toFixed(3)}s`;

  return (
    <div className="w-full max-w-[740px]">
      <GameHud
        score={liveMs > 0 ? `${(liveMs / 1000).toFixed(3)}s` : "—"}
        best={best === null ? "—" : fmt(best)}
      >
        <span className="text-rose-400">
          Pass <b className="ml-1 text-sm text-ink">{Math.min(3, passEts.length + (status === "racing" ? 1 : 0))}/3</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(244,63,94,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none"
          aria-label="Drag Sprint quarter-mile drag race"
        />

        {status === "racing" && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <button
              type="button"
              aria-label="Hold to rev"
              className="pointer-events-auto h-16 w-32 select-none rounded-xl border border-line bg-surface/75 text-sm font-bold text-ink backdrop-blur active:scale-95 active:bg-surface"
              onPointerDown={(e) => {
                e.preventDefault();
                revDown();
              }}
              onPointerUp={revUp}
              onPointerCancel={revUp}
              onPointerLeave={revUp}
              onContextMenu={(e) => e.preventDefault()}
            >
              HOLD REV
            </button>
            <button
              type="button"
              aria-label="Shift up"
              className="pointer-events-auto h-16 w-28 select-none rounded-xl border border-line bg-surface/75 text-sm font-bold text-warn backdrop-blur active:scale-95 active:bg-surface"
              onPointerDown={(e) => {
                e.preventDefault();
                shiftTap();
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              SHIFT
            </button>
          </div>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">DRAG SPRINT</p>
            <p className="mt-2 text-sm text-muted">
              Three passes of pure quarter-mile. Hold to rev at the tree, release on green —
              launch inside the tach&apos;s green band, then bang each shift in the band to
              keep the power down. Best ET persists.
            </p>
            <PrimaryButton onClick={start} tone="from-pink-400 via-rose-500 to-red-400">
              Stage car
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Hold Space / REV to rev · release on green · ↑ / SHIFT in the band · 3 passes
            </p>
          </Overlay>
        )}

        {status === "passover" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-300">
              PASS {passEts.length} COMPLETE
            </p>
            {newBest && lastEt === passEts[passEts.length - 1] && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best ET!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{fmt(lastEt)}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : fmt(best)} · {passEts.length} of 3 passes run
            </p>
            <PrimaryButton onClick={nextPass} tone="from-pink-400 via-rose-500 to-red-400">
              Next pass
            </PrimaryButton>
          </Overlay>
        )}

        {status === "summary" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">RACE COMPLETE</p>
            <p className="mt-2 font-mono text-lg text-rose-300">
              {passEts.map((e) => fmt(e)).join("  ·  ")}
            </p>
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {fmt(Math.min(...passEts))}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Session best · All-time best {best === null ? "—" : fmt(best)}
            </p>
            <PrimaryButton onClick={start} tone="from-pink-400 via-rose-500 to-red-400">
              Race again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Launch in the tach green band · shift 7000–8900 RPM · redlight = pass reset
      </p>
    </div>
  );
}
