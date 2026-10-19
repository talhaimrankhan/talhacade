"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 430;
const TAU = Math.PI * 2;
const TONE = "from-yellow-400 via-amber-500 to-orange-600";

const RACE_M = 100;
const PX_PER_M = 26;
const PLAYER_X = 132; // where the runner sits on screen
const GHOST_MS = 9.58; // world-record pace
const P_LANE = 274; // player lane feet line
const G_LANE = 168; // ghost lane feet line

type Status = "idle" | "playing" | "over";
type Phase = "ready" | "run" | "finish";
type Side = "l" | "r";

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
  elapsed: number;
  dist: number;
  speed: number;
  stamina: number;
  lastSide: Side | null;
  lastTap: number;
  anim: number;
  stumbleT: number;
  flash: number;
  flashC: string;
  slowT: number;
  finishT: number;
  dips: number;
  tapes: number;
  finalMs: number;
  steps: number;
  goodSteps: number;
  parts: Part[];
  floats: Floater[];
  banner: string;
  bannerT: number;
  shake: number;
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
      life: 0.3 + Math.random() * 0.45,
      max: 0.75,
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
    phase: "ready",
    elapsed: 0,
    dist: 0,
    speed: 0,
    stamina: 100,
    lastSide: null,
    lastTap: -1,
    anim: 0,
    stumbleT: 0,
    flash: 0,
    flashC: "#ffffff",
    slowT: 0,
    finishT: 0,
    dips: 0,
    tapes: 1,
    finalMs: 0,
    steps: 0,
    goodSteps: 0,
    parts: [],
    floats: [],
    banner: "",
    bannerT: 0,
    shake: 0,
    over: false,
  };
}

function stumble(g: Game, label: string, cost: number, drop: number): void {
  g.speed = Math.max(0, g.speed - drop);
  g.stamina = Math.max(0, g.stamina - cost);
  g.stumbleT = 0.32;
  g.shake = Math.max(g.shake, 5);
  g.flash = 0.4;
  g.flashC = "#fb7185";
  floater(g, PLAYER_X, P_LANE - 96, label, "#fda4af");
}

function tap(g: Game, side: Side): void {
  if (g.phase === "ready") {
    g.phase = "run";
    g.lastSide = side;
    g.lastTap = -1;
    g.banner = "GO!";
    g.bannerT = 0.9;
    return;
  }
  if (g.phase !== "run") return;

  g.steps += 1;
  if (g.lastSide === side) {
    stumble(g, "OFF BEAT", 6, 0.5);
    return;
  }
  g.lastSide = side;

  if (g.lastTap < 0) {
    g.lastTap = g.elapsed;
    g.speed += 0.66;
    g.goodSteps += 1;
    floater(g, PLAYER_X, P_LANE - 96, "GO", "#fde68a");
    return;
  }

  const gap = g.elapsed - g.lastTap;
  g.lastTap = g.elapsed;
  const tired = g.stamina < 25 ? 0.55 : 1;

  if (gap < 0.095) {
    stumble(g, "SPAM!", 8, 0.7);
  } else if (gap <= 0.35) {
    g.speed += 0.66 * tired;
    g.stamina = Math.min(100, g.stamina + 1.2);
    g.goodSteps += 1;
    g.dips += 1;
    if (g.dips % 4 === 0) floater(g, PLAYER_X, P_LANE - 100, "LOCKED IN", "#fde68a");
  } else if (gap <= 0.6) {
    g.speed += 0.36 * tired;
    g.stamina = Math.min(100, g.stamina + 0.4);
  } else {
    g.speed += 0.12;
    g.stamina = Math.min(100, g.stamina + 2);
  }
}

function step(g: Game, rawDt: number): void {
  g.shake = Math.max(0, g.shake - rawDt * 26);
  g.flash = Math.max(0, g.flash - rawDt * 1.8);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - rawDt);
  if (g.stumbleT > 0) g.stumbleT = Math.max(0, g.stumbleT - rawDt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= rawDt;
    p.x += p.vx * rawDt;
    p.y += p.vy * rawDt;
    p.vy += 240 * rawDt;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= rawDt * 1.1;
    f.y -= 30 * rawDt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (g.phase === "finish") {
    g.finishT -= rawDt;
    if (g.slowT > 0) {
      g.slowT -= rawDt;
      g.anim += g.speed * rawDt * 0.3 * 0.9;
      g.dist += g.speed * rawDt * 0.3;
      g.speed = Math.max(0, g.speed - 3 * rawDt);
    } else if (g.finishT <= 0) {
      g.over = true;
    }
    return;
  }

  if (g.phase !== "run") return;

  const dt = rawDt;
  g.elapsed += dt;
  g.speed = Math.max(0, g.speed - 1.5 * dt);
  g.stamina = Math.min(100, g.stamina + 3 * dt);
  const vmax = 8 + 4 * (g.stamina / 100);
  if (g.speed > vmax) g.speed = Math.max(vmax, g.speed - 4 * dt);
  g.dist += g.speed * dt;
  g.anim += g.speed * dt * 0.9;

  if (g.dist >= RACE_M) {
    g.dist = RACE_M;
    g.finalMs = Math.round(g.elapsed * 1000);
    g.phase = "finish";
    g.slowT = 0.85;
    g.finishT = 1.7;
    g.tapes = 0;
    g.banner = "FINISH!";
    g.bannerT = 1.6;
    g.shake = 10;
    g.flash = 0.5;
    g.flashC = "#fde68a";
    burst(g, PLAYER_X + 40, P_LANE - 30, "#fde68a", 26, 260);
    floater(g, PLAYER_X, P_LANE - 120, `${(g.finalMs / 1000).toFixed(2)}s`, "#fef3c7");
  }
}

/* ------------------------------ render ------------------------------ */

function sx(worldM: number, dist: number): number {
  return PLAYER_X + (worldM - dist) * PX_PER_M;
}

function drawRunner(
  ctx: CanvasRenderingContext2D,
  x: number,
  feetY: number,
  color: string,
  trim: string,
  anim: number,
  ghost: boolean,
  stumbleT: number,
): void {
  const leg = Math.sin(anim * 1.6);
  const arm = Math.sin(anim * 1.6 + Math.PI);
  const wob = stumbleT > 0 ? Math.sin(anim * 9) * 0.35 : 0;

  ctx.save();
  ctx.translate(x, feetY);
  ctx.rotate(wob);
  if (ghost) ctx.globalAlpha = 0.55;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 16, 5, 0, 0, TAU);
  ctx.fill();

  ctx.lineCap = "round";
  // legs
  ctx.strokeStyle = trim;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(leg * 14, 0);
  ctx.moveTo(0, -26);
  ctx.lineTo(-leg * 14, 0);
  ctx.stroke();
  // torso
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(2, -52);
  ctx.stroke();
  // arms
  ctx.strokeStyle = trim;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(2, -46);
  ctx.lineTo(-arm * 14, -34);
  ctx.moveTo(2, -46);
  ctx.lineTo(arm * 14, -38);
  ctx.stroke();
  // head
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = ghost ? 6 : 12;
  ctx.beginPath();
  ctx.arc(5, -62, 8, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dip = g && g.phase === "finish" && g.slowT > 0 ? Math.sin((0.85 - g.slowT) * 3) * 6 : 0;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }
  ctx.translate(0, dip);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#2a1503");
  bg.addColorStop(0.4, "#1c0f06");
  bg.addColorStop(1, "#12080a");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -30, W + 28, H + 44);

  // floodlights + crowd
  for (const lx of [60, W - 60]) {
    const gl = ctx.createRadialGradient(lx, 26, 4, lx, 26, 120);
    gl.addColorStop(0, "rgba(253, 224, 71, 0.32)");
    gl.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = gl;
    ctx.fillRect(lx - 120, -40, 240, 180);
  }
  const crowd = ["#fbbf24", "#f97316", "#fde68a", "#e2e8f0", "#c4b5fd"];
  for (let i = 0; i < 60; i++) {
    const cx = ((i * 71) % (W + 20)) - 10;
    const cy = 6 + ((i * 37) % 52);
    ctx.fillStyle = crowd[i % crowd.length];
    ctx.globalAlpha = 0.12 + ((i * 5) % 10) * 0.03 + Math.sin(time / 500 + i) * 0.05;
    ctx.fillRect(cx, cy, 3, 3);
  }
  ctx.globalAlpha = 1;

  if (g) {
    const dist = g.dist;
    const ghostM = g.phase === "ready" ? 0 : Math.min(RACE_M, g.elapsed * GHOST_MS);

    // lanes
    const lane = (yTop: number, yBot: number, base: string, dash: string) => {
      ctx.fillStyle = base;
      ctx.fillRect(-14, yTop, W + 28, yBot - yTop);
      ctx.strokeStyle = dash;
      ctx.lineWidth = 3;
      ctx.setLineDash([16, 14]);
      ctx.lineDashOffset = -dist * PX_PER_M;
      ctx.beginPath();
      ctx.moveTo(-14, yTop + 6);
      ctx.lineTo(W + 14, yTop + 6);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    lane(120, 200, "#1b1140", "rgba(167, 139, 250, 0.45)");
    lane(226, 330, "#3d1d05", "rgba(251, 191, 36, 0.55)");

    // ground lines between lanes
    ctx.strokeStyle = "rgba(226, 232, 240, 0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, 213);
    ctx.lineTo(W + 14, 213);
    ctx.stroke();

    // 10m markers
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.textAlign = "center";
    for (let m = 0; m <= RACE_M; m += 10) {
      const x = sx(m, dist);
      if (x < -30 || x > W + 30) continue;
      ctx.strokeStyle = m === 0 || m === RACE_M ? "rgba(254, 243, 199, 0.9)" : "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = m === RACE_M ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(x, 226);
      ctx.lineTo(x, 330);
      ctx.moveTo(x, 120);
      ctx.lineTo(x, 200);
      ctx.stroke();
      ctx.fillStyle = "rgba(254, 243, 199, 0.65)";
      ctx.fillText(m === 0 ? "START" : `${m}`, x, 348);
    }

    // finish tape
    const fx = sx(RACE_M, dist);
    if (fx > -40 && fx < W + 60) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(fx - 4, 206, 8, 128);
      if (g.tapes > 0) {
        ctx.strokeStyle = "#fb7185";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(fx, 240);
        ctx.lineTo(fx, 320);
        ctx.stroke();
      } else {
        // broken tape ribbons
        ctx.strokeStyle = "#fb7185";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(fx + 10, 316);
        ctx.quadraticCurveTo(fx + 34, 330 + Math.sin(time / 120) * 6, fx + 52, 318);
        ctx.stroke();
      }
      ctx.font = "800 11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fda4af";
      ctx.fillText("100M", fx, 200);
    }

    // runners
    const gX = sx(ghostM, dist);
    if (gX > -60 && gX < W + 60 && g.phase !== "ready") {
      drawRunner(ctx, gX, G_LANE, "#a78bfa", "#7c3aed", g.elapsed * 9.4, true, 0);
      ctx.font = "700 9px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#c4b5fd";
      ctx.fillText("GHOST · WR 9.58", gX, G_LANE - 82);
    }

    drawRunner(
      ctx,
      PLAYER_X,
      P_LANE,
      "#fbbf24",
      "#f97316",
      g.phase === "ready" ? 0 : g.anim,
      false,
      g.stumbleT,
    );

    // HUD: clock
    const shown = g.phase === "ready" ? 0 : g.finalMs > 0 && g.phase === "finish" ? g.finalMs : g.elapsed * 1000;
    ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
    ctx.beginPath();
    ctx.roundRect(W - 168, 14, 154, 62, 12);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillStyle = "#fde68a";
    ctx.fillText("TIME", W - 28, 34);
    ctx.font = "800 26px ui-monospace, monospace";
    ctx.fillStyle = g.phase === "finish" ? "#fde68a" : "#ffffff";
    ctx.fillText(`${(shown / 1000).toFixed(2)}`, W - 28, 62);

    // speed + distance
    ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
    ctx.beginPath();
    ctx.roundRect(14, 14, 150, 62, 12);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillStyle = "#fdba74";
    ctx.fillText("DISTANCE", 28, 34);
    ctx.font = "800 24px ui-monospace, monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${g.dist.toFixed(1)}m`, 28, 62);
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.fillStyle = "rgba(254, 243, 199, 0.75)";
    ctx.fillText(`${g.speed.toFixed(1)} m/s`, 92, 62);

    // lead vs ghost
    if (g.phase === "run" || g.phase === "finish") {
      const lead = g.dist - ghostM;
      ctx.font = "700 11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = lead >= 0 ? "#4ade80" : "#f87171";
      ctx.fillText(
        lead >= 0 ? `+${lead.toFixed(1)}M ON GHOST` : `${lead.toFixed(1)}M BEHIND`,
        W / 2,
        112,
      );
    }

    // stamina bar
    const bw = 300;
    const bx = (W - bw) / 2;
    const by = H - 44;
    ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
    ctx.beginPath();
    ctx.roundRect(bx - 7, by - 7, bw + 14, 30, 13);
    ctx.fill();
    ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, 16, 8);
    ctx.fill();
    const st = g.stamina / 100;
    ctx.fillStyle = st > 0.5 ? "#fde68a" : st > 0.25 ? "#fbbf24" : "#fb7185";
    ctx.beginPath();
    ctx.roundRect(bx, by, Math.max(5, st * bw), 16, 8);
    ctx.fill();
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(254, 243, 199, 0.85)";
    ctx.fillText("STAMINA", W / 2, by - 12);

    // ready hint
    if (g.phase === "ready") {
      ctx.font = "800 18px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("ALTERNATE ← / → TO START", W / 2, P_LANE - 70);
      ctx.font = "700 12px ui-monospace, monospace";
      ctx.fillStyle = "rgba(254, 243, 199, 0.8)";
      ctx.fillText("steady rhythm = top speed · mashing = stumbles", W / 2, P_LANE - 46);
    }

    // particles
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // floaters
    ctx.font = "800 15px ui-monospace, monospace";
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
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.5);
      ctx.font = "800 34px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(251, 191, 36, 0.9)";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, 210);
      ctx.restore();
    }

    if (g.flash > 0.01) {
      ctx.fillStyle = hexA(g.flashC, g.flash * 0.28);
      ctx.fillRect(-14, -30, W + 28, H + 44);
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

function fmt(ms: number): string {
  return (ms / 1000).toFixed(2);
}

export default function TrackDash({ gameId = "track-dash" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [time, setTime] = useState("0.00");
  const [stats, setStats] = useState("");
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "low");

  const draw = useCallback((time2: number) => {
    const canvas = canvasRef.current;
    if (canvas) render(canvas, gameRef.current, time2);
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
    setTime("0.00");
    setStats("");
    setNewBest(false);
    setStatus("playing");
  }, []);

  const step2 = useCallback((side: Side) => {
    const g = gameRef.current;
    if (g && !g.over) tap(g, side);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastCenti = -1;

    const loop = (t: number) => {
      const rawDt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, rawDt);

      const centi = Math.floor(g.elapsed * 100);
      if (centi !== lastCenti && g.phase === "run") {
        lastCenti = centi;
        setTime((g.elapsed).toFixed(2));
      }

      draw(t);
      if (g.over) {
        setTime(fmt(g.finalMs));
        setStats(`${g.goodSteps}/${g.steps} clean strides`);
        setNewBest(submit(g.finalMs));
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
      const k = e.key.toLowerCase();
      if (e.key === "ArrowLeft" || k === "a") {
        e.preventDefault();
        if (!e.repeat) step2("l");
      } else if (e.key === "ArrowRight" || k === "d") {
        e.preventDefault();
        if (!e.repeat) step2("r");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start, step2]);

  const padBtn =
    "touch-none flex-1 rounded-xl border border-amber-400/50 bg-surface py-5 font-mono text-lg font-bold text-amber-300 transition active:scale-95";

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud
        score={time}
        best={best ? fmt(best) : "—"}
        accent="text-emerald-300"
      >
        <span className="text-violet-300">
          Ghost <b className="ml-1 text-sm text-ink">9.58s</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(251,191,36,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Track Dash 100 metre sprint"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") return;
            const rect = e.currentTarget.getBoundingClientRect();
            step2(e.clientX - rect.left < rect.width / 2 ? "l" : "r");
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">TRACK DASH</p>
            <p className="mt-2 text-sm text-muted">
              One hundred metres, one shot, and a ghost running world-record pace in the next
              lane. Smash the left and right keys in a steady alternating rhythm to build speed —
              keep the cadence clean and your stamina climbs back, mash too fast or repeat a side
              and you&apos;ll stumble in a flash. Your time lives in the ledger, hundredths and
              all.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              On your marks
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Alternate ← / → (or A / D) · tap the left and right halves on touch
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-amber-300">PHOTO FINISH</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best time!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{time}s</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              100m · Best {best ? fmt(best) : "—"} · ghost 9.58
            </p>
            <p className="mt-1 text-xs text-muted">{stats}</p>
            <PrimaryButton onClick={start} tone={TONE}>
              Run it back
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Rhythm beats spam — 2–3 taps a second, clean</p>
          </Overlay>
        )}
      </div>

      <div className="mt-2 flex touch-none select-none gap-2">
        <button
          type="button"
          onPointerDown={() => step2("l")}
          aria-label="Left stride — arrow left or A"
          className={padBtn}
        >
          ◀ LEFT
        </button>
        <button
          type="button"
          onPointerDown={() => step2("r")}
          aria-label="Right stride — arrow right or D"
          className={padBtn}
        >
          RIGHT ▶
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Steady alternation = max acceleration · too fast or repeat a side = stumble
      </p>
    </div>
  );
}
