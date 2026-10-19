"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 270;
const STEP = 10; // terrain sample spacing
const WB = 52; // wheelbase
const WHEEL_R = 14;
const STAGES = 8;
const TIP_ANGLE = 1.05; // radians — past this the cab goes over
const TONE = "from-slate-400 via-zinc-500 to-neutral-700";

type Status = "idle" | "playing" | "over";

interface MudZone {
  x0: number;
  x1: number;
}

interface Terrain {
  heights: number[]; // sampled every STEP px
  mud: MudZone[];
  flags: number[]; // checkpoint x positions
  length: number;
  par: number;
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

interface TruckGame {
  stage: number;
  terrain: Terrain;
  x: number;
  vx: number;
  axleY: number; // screen y of the axle line
  vy: number;
  angle: number;
  angVel: number;
  airborne: boolean;
  overTilt: number;
  wheelSpin: number;
  slip: number; // 0..1 — how much the wheels are spinning uselessly
  totalTime: number;
  flagIdx: number;
  lastFlagX: number;
  tips: number;
  parts: Particle[];
  shake: number;
  flash: number;
  banner: string;
  bannerT: number;
  over: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothNoise(t: number, seed: number): number {
  return (
    Math.sin(t * 0.9 + seed) * 0.5 +
    Math.sin(t * 2.3 + seed * 1.7) * 0.3 +
    Math.sin(t * 5.1 + seed * 0.4) * 0.2
  );
}

/** Handcrafted-random stage: flat runs, boulder fields, ledges, mud pits. */
function makeTerrain(stage: number): Terrain {
  const heights: number[] = [190];
  const mud: MudZone[] = [];
  const flags: number[] = [];
  const target = 2200 + stage * 240;
  let x = 0;
  let base = 190;
  let seed = stage * 37.7 + Math.random() * 100;

  const push = (px: number, py: number) => {
    while (x < px) {
      heights.push(py);
      x += STEP;
    }
    heights.push(py);
    x += STEP;
  };

  while (x < target) {
    const roll = Math.random();
    if (roll < 0.26) {
      // boulder field
      const len = 130 + Math.random() * 140;
      const amp = 10 + Math.random() * 14 + stage;
      const end = x + len;
      while (x < end) {
        base = clamp(base + smoothNoise(x * 0.055, seed) * 3.2, 130, 214);
        push(x, base + Math.abs(smoothNoise(x * 0.12, seed + 4)) * amp);
      }
      base = clamp(base, 140, 205);
    } else if (roll < 0.46) {
      // ledge — a step down or up
      const drop = 22 + Math.random() * 24;
      base = clamp(base + (Math.random() < 0.62 ? drop : -drop), 120, 210);
      push(x, base);
      push(x + 26, base);
    } else if (roll < 0.68 && x > 320) {
      // mud pit — flat and greasy
      const len = 130 + Math.random() * 90;
      mud.push({ x0: x, x1: x + len });
      const end = x + len;
      while (x < end) {
        base = clamp(base + smoothNoise(x * 0.04, seed + 9) * 1.2, 140, 205);
        push(x, base + 6);
      }
    } else {
      // flat run
      const len = 130 + Math.random() * 110;
      const end = x + len;
      while (x < end) {
        base = clamp(base + smoothNoise(x * 0.03, seed + 2) * 1.6, 140, 208);
        push(x, base);
      }
    }
    seed += 13.3;
    if (x - (flags.length ? flags[flags.length - 1] : -400) > 560) {
      flags.push(x);
    }
  }
  while (heights.length * STEP < target + 260) heights.push(base);
  return {
    heights,
    mud,
    flags,
    length: target,
    par: 26 + stage * 3,
  };
}

function groundAt(t: Terrain, x: number): number {
  const i = clamp(Math.floor(x / STEP), 0, t.heights.length - 2);
  const f = clamp(x / STEP - i, 0, 1);
  return t.heights[i] + (t.heights[i + 1] - t.heights[i]) * f;
}

function inMud(t: Terrain, x: number): boolean {
  for (const m of t.mud) if (x > m.x0 && x < m.x1) return true;
  return false;
}

function createGame(): TruckGame {
  const terrain = makeTerrain(1);
  return {
    stage: 1,
    terrain,
    x: 40,
    vx: 0,
    axleY: groundAt(terrain, 40) - WHEEL_R,
    vy: 0,
    angle: 0,
    angVel: 0,
    airborne: false,
    overTilt: 0,
    wheelSpin: 0,
    slip: 0,
    totalTime: 0,
    flagIdx: 0,
    lastFlagX: 0,
    tips: 0,
    parts: [],
    shake: 0,
    flash: 0,
    banner: "",
    bannerT: 0,
    over: false,
  };
}

function burst(
  g: TruckGame,
  x: number,
  y: number,
  n: number,
  c: string,
  r = 3,
): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 20 + Math.random() * 90;
    g.parts.push({
      x,
      y,
      vx: Math.cos(a) * sp - g.vx * 0.3,
      vy: Math.sin(a) * sp - 40,
      life: 0.4 + Math.random() * 0.4,
      max: 0.8,
      r: r + Math.random() * 2,
      c,
    });
  }
}

export default function TractionTruck() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [boot] = useState(createGame);
  const gameRef = useRef<TruckGame>(boot);

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0); // total seconds (1 decimal)
  const [stage, setStage] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("traction-truck", "low");

  const keysRef = useRef<Set<string>>(new Set());
  const touchRef = useRef(0); // -1 brake, +1 gas
  const dispRef = useRef(0);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const t = g.terrain;
    const camX = g.x - 130; // world x at screen x=0
    const sx = (Math.random() - 0.5) * g.shake;
    const sy = (Math.random() - 0.5) * g.shake;
    const toScreenX = (wx: number) => wx - camX + sx;

    // sky
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0b1220");
    grad.addColorStop(1, "#1e293b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // far ridges
    ctx.fillStyle = "rgba(148, 163, 184, 0.10)";
    for (let i = 0; i < 7; i++) {
      const hx = ((i * 120 - camX * 0.25) % (W + 240)) - 120;
      ctx.beginPath();
      ctx.arc(hx + sx, 190, 66, Math.PI, 0);
      ctx.fill();
    }

    // terrain polygon
    const i0 = clamp(Math.floor(camX / STEP) - 1, 0, t.heights.length - 2);
    const i1 = clamp(Math.ceil((camX + W) / STEP) + 1, 0, t.heights.length - 1);
    ctx.beginPath();
    ctx.moveTo(toScreenX(i0 * STEP), H);
    for (let i = i0; i <= i1; i++) {
      ctx.lineTo(toScreenX(i * STEP), t.heights[i]);
    }
    ctx.lineTo(toScreenX(i1 * STEP), H);
    ctx.closePath();
    const rock = ctx.createLinearGradient(0, 120, 0, H);
    rock.addColorStop(0, "#4b5563");
    rock.addColorStop(1, "#1f2937");
    ctx.fillStyle = rock;
    ctx.fill();
    ctx.strokeStyle = "rgba(203, 213, 225, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // mud patches
    for (const m of t.mud) {
      const mx = toScreenX(m.x0);
      const mw = m.x1 - m.x0;
      if (mx > W || mx + mw < 0) continue;
      ctx.fillStyle = "rgba(87, 63, 46, 0.85)";
      ctx.beginPath();
      ctx.ellipse(mx + mw / 2, groundAt(t, (m.x0 + m.x1) / 2) + 8, mw / 2, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(120, 90, 60, 0.5)";
      ctx.stroke();
    }

    // flags
    for (let i = 0; i < t.flags.length; i++) {
      const fx = toScreenX(t.flags[i]);
      if (fx < -30 || fx > W + 30) continue;
      const fy = groundAt(t, t.flags[i]);
      const passed = i < g.flagIdx;
      ctx.strokeStyle = passed ? "rgba(148,163,184,0.5)" : "#e2e8f0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy - 44);
      ctx.stroke();
      ctx.fillStyle = passed ? "rgba(52, 211, 153, 0.4)" : "#34d399";
      ctx.shadowColor = "#34d399";
      ctx.shadowBlur = passed ? 0 : 10;
      const wave = Math.sin(time / 220 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(fx, fy - 44);
      ctx.lineTo(fx + 22, fy - 38 + wave);
      ctx.lineTo(fx, fy - 30);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // finish gate
    const finX = toScreenX(t.length);
    if (finX > -40 && finX < W + 40) {
      const fy = groundAt(t, t.length);
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(finX, fy);
      ctx.lineTo(finX, fy - 64);
      ctx.stroke();
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("FINISH", finX, fy - 70);
    }

    // particles
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // truck
    const cx = toScreenX(g.x);
    const cy = g.axleY + sy;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(g.angle);
    // suspension arms
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-WB / 2, 0);
    ctx.lineTo(-WB / 2, WHEEL_R);
    ctx.moveTo(WB / 2, 0);
    ctx.lineTo(WB / 2, WHEEL_R);
    ctx.stroke();
    // chassis + cab
    ctx.fillStyle = "#78716c";
    ctx.shadowColor = "#a8a29e";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(-34, -16, 68, 17, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.roundRect(4, -30, 24, 16, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(11,11,22,0.6)";
    ctx.beginPath();
    ctx.roundRect(12, -27, 12, 9, 3);
    ctx.fill();
    ctx.restore();

    // wheels (spin shows slip in mud)
    for (const wx of [-WB / 2, WB / 2]) {
      const wScreenX = cx + Math.cos(g.angle) * wx;
      const wScreenY = cy + Math.sin(g.angle) * wx + WHEEL_R;
      ctx.save();
      ctx.translate(wScreenX, wScreenY);
      ctx.rotate(g.wheelSpin);
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(0, 0, WHEEL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, WHEEL_R - 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(148,163,184,0.8)";
      ctx.lineWidth = 1.5;
      for (let s = 0; s < 3; s++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-(WHEEL_R - 4), 0);
        ctx.lineTo(WHEEL_R - 4, 0);
        ctx.stroke();
        ctx.rotate(Math.PI / 3);
      }
      ctx.restore();
    }

    // tilt warning
    if (Math.abs(g.angle) > TIP_ANGLE * 0.72) {
      ctx.strokeStyle = `rgba(244, 63, 94, ${Math.min(0.9, Math.abs(g.angle) / TIP_ANGLE)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 46, cy - 40, 92, 60);
    }

    // top bar
    ctx.fillStyle = "rgba(2, 6, 23, 0.6)";
    ctx.fillRect(0, 0, W, 34);
    ctx.font = "bold 15px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`⏱ ${g.totalTime.toFixed(1)}s`, 12, 22);
    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`STAGE ${g.stage}/${STAGES} · PAR ${t.par}s`, W / 2, 22);
    ctx.textAlign = "right";
    ctx.fillStyle = g.totalTime > t.par * g.stage ? "#f87171" : "#34d399";
    ctx.fillText(`${g.tips} TIPS`, W - 12, 22);

    if (g.bannerT > 0) {
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.6);
      ctx.font = "bold 28px ui-sans-serif, system-ui";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "center";
      ctx.fillText(g.banner, W / 2, H * 0.38);
      ctx.globalAlpha = 1;
    }

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(244, 63, 94, ${Math.min(0.5, g.flash)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.font = "bold 26px ui-sans-serif, system-ui";
      ctx.fillStyle = "#fecaca";
      ctx.textAlign = "center";
      ctx.fillText("TIPPED! +8s", W / 2, H / 2);
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

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setStage(1);
    setNewBest(false);
    dispRef.current = 0;
    setStatus("playing");
  }, []);

  const step = useCallback(
    (dt: number): boolean => {
      const g = gameRef.current;
      if (g.over) return true;
      const t = g.terrain;

      g.totalTime += dt;
      if (g.shake > 0) g.shake = Math.max(0, g.shake - 30 * dt);
      if (g.flash > 0) g.flash = Math.max(0, g.flash - 2 * dt);
      if (g.bannerT > 0) g.bannerT -= dt;

      const keys = keysRef.current;
      const touch = touchRef.current;
      const gasIn =
        keys.has("ArrowRight") || keys.has("d") || touch === 1 ? 1 : 0;
      const brakeIn =
        keys.has("ArrowLeft") || keys.has("a") || touch === -1 ? 1 : 0;
      const input = gasIn - brakeIn; // +1 gas, -1 brake/reverse

      const onMud = inMud(t, g.x - WB / 2) || inMud(t, g.x + WB / 2);
      const traction = onMud ? 0.42 : 1;

      // longitudinal dynamics
      if (input > 0) {
        g.vx += 300 * traction * dt;
      } else if (input < 0) {
        if (g.vx > 0) g.vx -= 420 * traction * dt; // brake
        else g.vx -= 170 * traction * dt; // reverse
      }
      g.vx -= g.vx * (onMud ? 1.6 : 0.7) * dt;
      g.vx = clamp(g.vx, -85, 250);

      const prevX = g.x;
      g.x = Math.max(g.lastFlagX, g.x + g.vx * dt);

      // wheel/axle heights
      const hr = groundAt(t, g.x - WB / 2);
      const hf = groundAt(t, g.x + WB / 2);
      const targetAxle = (hr + hf) / 2 - WHEEL_R;
      const slope = Math.atan2(hf - hr, WB);

      if (!g.airborne && targetAxle > g.axleY + 16) {
        // drove off a ledge
        g.airborne = true;
        g.vy = 0;
      }
      if (g.airborne) {
        g.vy += 1500 * dt;
        g.axleY += g.vy * dt;
        g.angle += -g.angVel * dt * 0.4;
        if (g.axleY >= targetAxle) {
          g.axleY = targetAxle;
          g.airborne = false;
          const impact = g.vy;
          g.vy = 0;
          g.shake = Math.max(g.shake, Math.min(9, impact * 0.014));
          g.angVel += clamp(slope - g.angle, -0.8, 0.8) * 7;
          burst(g, g.x, targetAxle + WHEEL_R, 8, "rgba(148,163,184,0.6)");
        }
      } else {
        g.axleY += (targetAxle - g.axleY) * Math.min(1, 16 * dt);
        // suspension chases the slope; throttle pitches the cab
        g.angVel += (slope - g.angle) * 15 * dt;
        g.angVel += -input * 1.9 * dt * clamp(Math.abs(g.vx) / 120, 0.25, 1);
      }
      g.angVel *= Math.exp(-4.2 * dt);
      g.angle += g.angVel * dt;

      // wheels: roll with slip
      const roll = (g.vx / WHEEL_R) * dt;
      g.slip = onMud && gasIn ? Math.min(1, 0.4 + (250 - Math.abs(g.vx)) / 250) : 0;
      g.wheelSpin += roll + g.slip * 14 * dt * (g.vx >= 0 ? 1 : -1);
      if (g.slip > 0.1 && Math.random() < 0.6) {
        g.parts.push({
          x: g.x - 20,
          y: g.axleY + WHEEL_R,
          vx: -60 - Math.random() * 80,
          vy: -30 - Math.random() * 60,
          life: 0.5,
          max: 0.5,
          r: 2.5,
          c: "rgba(120, 90, 60, 0.9)",
        });
      }

      // tipping
      if (Math.abs(g.angle) > TIP_ANGLE) {
        g.overTilt += dt;
        if (g.overTilt > 0.3) {
          // cab over — back to the last flag, +8s
          g.tips += 1;
          g.totalTime += 8;
          burst(g, g.x, g.axleY, 18, "#a8a29e", 140);
          g.x = g.lastFlagX;
          g.vx = 0;
          g.angle = 0;
          g.angVel = 0;
          g.airborne = false;
          g.axleY = groundAt(t, g.x) - WHEEL_R;
          g.vy = 0;
          g.overTilt = 0;
          g.shake = 12;
          g.flash = 1.1;
        }
      } else {
        g.overTilt = Math.max(0, g.overTilt - dt * 2);
      }

      // checkpoints
      while (g.flagIdx < t.flags.length && g.x >= t.flags[g.flagIdx]) {
        g.lastFlagX = t.flags[g.flagIdx] + 8;
        g.flagIdx += 1;
        burst(g, g.x, g.axleY - 30, 6, "#34d399", 60);
      }

      // particles
      for (let i = g.parts.length - 1; i >= 0; i--) {
        const p = g.parts[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 260 * dt;
        if (p.life <= 0) g.parts.splice(i, 1);
      }

      // stage complete?
      if (g.x >= t.length) {
        if (g.stage >= STAGES) {
          g.over = true;
          const final = Math.round(g.totalTime * 10) / 10;
          setScore(final);
          setNewBest(submit(final));
          setStatus("over");
          return true;
        }
        g.stage += 1;
        g.terrain = makeTerrain(g.stage);
        g.x = 40;
        g.vx = 0;
        g.axleY = groundAt(g.terrain, 40) - WHEEL_R;
        g.angle = 0;
        g.angVel = 0;
        g.airborne = false;
        g.flagIdx = 0;
        g.lastFlagX = 0;
        g.banner = `STAGE ${g.stage}`;
        g.bannerT = 1.6;
        setStage(g.stage);
      }

      const shown = Math.round(g.totalTime * 10) / 10;
      if (shown !== dispRef.current) {
        dispRef.current = shown;
        setScore(shown);
      }
      return g.over || prevX === g.x - 0 ? false : false;
    },
    [submit],
  );

  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const done = step(dt);
      draw(t);
      if (!done) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, step, draw]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const keys = keysRef.current;
    const normalize = (k: string) => (k.length === 1 ? k.toLowerCase() : k);
    const onDown = (e: KeyboardEvent) => {
      const k = normalize(e.key);
      if (
        status === "playing" &&
        (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown" || k === " ")
      ) {
        e.preventDefault();
      }
      keys.add(k);
      if ((k === " " || k === "Enter") && status !== "playing") {
        e.preventDefault();
        start();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      keys.delete(normalize(e.key));
    };
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [status, start]);

  const hold = useCallback(
    (v: number) => {
      if (status !== "playing") start();
      touchRef.current = v;
    },
    [status, start],
  );

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={`${score.toFixed(1)}s`} best={best !== null ? `${best.toFixed(1)}s` : "—"}>
        <span className="text-warn">
          Stage <b className="ml-1 text-sm text-ink">{stage}/{STAGES}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(148,163,184,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none"
          aria-label="Traction Truck rock crawl"
        />

        {status === "playing" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
            <button
              type="button"
              className="pointer-events-auto h-14 w-20 rounded-xl bg-zinc-500/50 text-sm font-bold text-ink backdrop-blur active:scale-95"
              aria-label="Brake and reverse"
              onPointerDown={(e) => {
                e.preventDefault();
                hold(-1);
              }}
              onPointerUp={() => hold(0)}
              onPointerLeave={() => hold(0)}
              onPointerCancel={() => hold(0)}
            >
              ◀ REV
            </button>
            <button
              type="button"
              className="pointer-events-auto h-14 w-20 rounded-xl bg-amber-500/60 text-sm font-bold text-ink backdrop-blur active:scale-95"
              aria-label="Gas"
              onPointerDown={(e) => {
                e.preventDefault();
                hold(1);
              }}
              onPointerUp={() => hold(0)}
              onPointerLeave={() => hold(0)}
              onPointerCancel={() => hold(0)}
            >
              GAS ▶
            </button>
          </div>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">TRACTION TRUCK</p>
            <p className="mt-2 text-sm text-muted">
              Eight stages of boulders, ledges and mud. Feather the throttle — tip
              the cab and you reset to the last flag with an 8-second penalty.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              → / D gas · ← / A brake &amp; reverse · on mobile use REV / GAS
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">ALL 8 STAGES</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best time!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {score.toFixed(1)}s
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best !== null ? `${best.toFixed(1)}s` : "—"} · {stage} stages
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Crawl again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Slow is smooth, smooth is fast · green flags are safe · mud kills traction
      </p>
    </div>
  );
}
