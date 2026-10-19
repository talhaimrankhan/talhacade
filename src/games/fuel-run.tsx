"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 560;
const ROAD_L = 26;
const ROAD_R = W - 26;
const LANES = 4;
const LANE_W = (ROAD_R - ROAD_L) / LANES;
const PY = H - 120; // player's fixed screen y
const TONE = "from-amber-400 via-orange-500 to-red-500";

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

interface Pop {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
}

interface Traffic {
  x: number;
  y: number;
  speed: number;
  w: number;
  h: number;
  color: string;
  crossed: boolean;
}

interface FuelItem {
  x: number;
  y: number;
  kind: "can" | "station";
}

interface FuelRunGame {
  px: number; // player x (lane position)
  dist: number; // metres driven
  bonus: number; // metres banked from near-miss chains
  speed: number; // px/s
  fuel: number; // 0..100
  chain: number;
  chainT: number;
  tilt: number;
  scroll: number;
  cars: Traffic[];
  items: FuelItem[];
  spawnT: number;
  itemT: number;
  deadT: number; // seconds spent dry — the engine dies at 1.8
  shake: number;
  flash: number;
  flashC: string;
  parts: Particle[];
  pops: Pop[];
  over: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function hash01(i: number): number {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function laneCenter(lane: number): number {
  return ROAD_L + LANE_W * (lane + 0.5);
}

const TRAFFIC_COLORS = [
  "#60a5fa",
  "#f472b6",
  "#34d399",
  "#a78bfa",
  "#fbbf24",
  "#e2e8f0",
];

function createGame(): FuelRunGame {
  return {
    px: laneCenter(1),
    dist: 0,
    bonus: 0,
    speed: 260,
    fuel: 100,
    chain: 0,
    chainT: 0,
    tilt: 0,
    scroll: 0,
    cars: [],
    items: [],
    spawnT: 1.7,
    itemT: 0.6,
    deadT: 0,
    shake: 0,
    flash: 0,
    flashC: "#f97316",
    parts: [],
    pops: [],
    over: false,
  };
}

function burst(
  g: FuelRunGame,
  x: number,
  y: number,
  n: number,
  c: string,
  power = 150,
): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * power;
    g.parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.45 + Math.random() * 0.45,
      max: 0.9,
      r: 2 + Math.random() * 3,
      c,
    });
  }
}

function pop(g: FuelRunGame, x: number, y: number, text: string, c: string): void {
  g.pops.push({ x, y, text, life: 1.2, c });
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  tilt: number,
  player: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.shadowColor = color;
  ctx.shadowBlur = player ? 18 : 10;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 9);
  ctx.fill();
  ctx.shadowBlur = 0;
  // cabin
  ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 5, -h * 0.18, w - 10, h * 0.36, 5);
  ctx.fill();
  // rear window
  ctx.fillStyle = "rgba(186, 230, 253, 0.6)";
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 6, -h * 0.32, w - 12, h * 0.11, 4);
  ctx.fill();
  // windshield
  ctx.fillStyle = "rgba(186, 230, 253, 0.85)";
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 6, h * 0.2, w - 12, h * 0.12, 4);
  ctx.fill();
  // tail lights
  ctx.fillStyle = "#ef4444";
  ctx.shadowColor = "#ef4444";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 3, h / 2 - 8, 9, 5, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(w / 2 - 12, h / 2 - 8, 9, 5, 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (player) {
    // roof stripe so the hero car reads instantly
    ctx.fillStyle = "#fff7ed";
    ctx.fillRect(-3, -h / 2 + 7, 6, h - 14);
  }
  ctx.restore();
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: FuelItem["kind"],
  time: number,
): void {
  const pulse = 1 + Math.sin(time / 180 + x * 0.03) * 0.08;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  if (kind === "station") {
    ctx.shadowColor = "#34d399";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.roundRect(-30, -34, 60, 68, 10);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#064e3b";
    ctx.beginPath();
    ctx.roundRect(-30, -34, 60, 15, 10);
    ctx.fill();
    ctx.fillStyle = "#065f46";
    ctx.beginPath();
    ctx.roundRect(-40, -16, 10, 34, 3);
    ctx.fill();
    ctx.fillStyle = "#d1fae5";
    ctx.textAlign = "center";
    ctx.font = "bold 11px ui-monospace, monospace";
    ctx.fillText("FULL", 0, -4);
    ctx.font = "bold 14px ui-monospace, monospace";
    ctx.fillText("+55", 0, 18);
  } else {
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.roundRect(-13, -16, 26, 32, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.roundRect(-6, -21, 12, 7, 2);
    ctx.fill();
    ctx.fillStyle = "#fde68a";
    ctx.fillRect(-7, -6, 14, 11);
    ctx.fillStyle = "#78350f";
    ctx.textAlign = "center";
    ctx.font = "bold 9px ui-monospace, monospace";
    ctx.fillText("+18", 0, 3);
  }
  ctx.restore();
}

export default function FuelRun() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [boot] = useState(createGame);
  const gameRef = useRef<FuelRunGame>(boot);

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0); // metres (distance + chain bonus)
  const [newBest, setNewBest] = useState(false);
  const [reason, setReason] = useState("");
  const { best, submit } = useBestScore("fuel-run", "high");

  const keysRef = useRef<Set<string>>(new Set());
  const touchRef = useRef({ steer: 0, gas: false });
  const dispRef = useRef(0);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const sx = (Math.random() - 0.5) * g.shake;

    // desert shoulder
    const ground = ctx.createLinearGradient(0, 0, W, 0);
    ground.addColorStop(0, "#3f1d0b");
    ground.addColorStop(0.5, "#7c2d12");
    ground.addColorStop(1, "#3f1d0b");
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, W, H);

    // asphalt
    ctx.fillStyle = "#111827";
    ctx.fillRect(ROAD_L + sx, 0, ROAD_R - ROAD_L, H);

    // road specks scrolling toward the camera
    ctx.fillStyle = "rgba(148, 163, 184, 0.16)";
    const span = 600;
    for (let i = 0; i < 44; i++) {
      const px = ROAD_L + 12 + hash01(i) * (ROAD_R - ROAD_L - 24);
      const raw = (hash01(i + 50) * span + g.scroll) % span;
      ctx.fillRect(px + sx, raw - 40, 3, 3);
    }

    // edge lines
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(ROAD_L + 5 + sx, 0, 4, H);
    ctx.fillRect(ROAD_R - 9 + sx, 0, 4, H);

    // lane dashes
    ctx.fillStyle = "rgba(253, 224, 71, 0.9)";
    for (let k = 1; k < LANES; k++) {
      const lx = ROAD_L + LANE_W * k - 3 + sx;
      for (let y = (g.scroll % 74) - 74; y < H; y += 74) {
        ctx.fillRect(lx, y, 6, 36);
      }
    }

    // shoulder reflectors
    for (let y = (g.scroll % 132) - 132; y < H; y += 132) {
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.roundRect(ROAD_L - 13 + sx, y, 7, 20, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(ROAD_R + 6 + sx, y, 7, 20, 3);
      ctx.fill();
    }

    // fuel pickups
    for (let i = 0; i < g.items.length; i++) {
      const it = g.items[i];
      drawItem(ctx, it.x + sx, it.y, it.kind, time);
    }

    // traffic
    for (let i = 0; i < g.cars.length; i++) {
      const c = g.cars[i];
      drawCar(ctx, c.x + sx, c.y, c.w, c.h, c.color, 0, false);
    }

    // particles
    for (let i = 0; i < g.parts.length; i++) {
      const p = g.parts[i];
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x + sx, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // player
    drawCar(ctx, g.px + sx, PY, 34, 62, "#fb923c", g.tilt, true);

    // pops
    ctx.textAlign = "center";
    ctx.font = "bold 15px ui-monospace, monospace";
    for (let i = 0; i < g.pops.length; i++) {
      const p = g.pops[i];
      ctx.globalAlpha = Math.min(1, p.life / 0.6);
      ctx.fillStyle = p.c;
      ctx.fillText(p.text, p.x + sx, p.y - (1.2 - p.life) * 34);
    }
    ctx.globalAlpha = 1;

    // top bar
    ctx.fillStyle = "rgba(2, 6, 23, 0.68)";
    ctx.fillRect(0, 0, W, 40);
    ctx.font = "bold 15px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`${Math.floor(g.dist + g.bonus)} m`, 12, 26);
    ctx.textAlign = "center";
    if (g.chain > 0) {
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`×${g.chain} NEAR`, W / 2, 26);
    } else {
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`${Math.round(g.speed * 0.36)} km/h`, W / 2, 26);
    }
    const bw = 140;
    const bx = W - bw - 14;
    ctx.textAlign = "right";
    ctx.fillStyle = g.fuel > 30 ? "#94a3b8" : "#f87171";
    ctx.fillText("FUEL", bx - 8, 26);
    ctx.fillStyle = "rgba(148, 163, 184, 0.28)";
    ctx.beginPath();
    ctx.roundRect(bx, 12, bw, 15, 7);
    ctx.fill();
    const f = clamp(g.fuel / 100, 0, 1);
    if (f > 0.03) {
      ctx.fillStyle = f > 0.35 ? "#34d399" : f > 0.16 ? "#fbbf24" : "#f43f5e";
      ctx.beginPath();
      ctx.roundRect(bx, 12, Math.max(4, bw * f), 15, 7);
      ctx.fill();
    }
    if (g.chain > 0 && g.chainT > 0) {
      // chain clock under the multiplier
      ctx.fillStyle = "rgba(251, 191, 36, 0.4)";
      ctx.fillRect(W / 2 - 34, 32, 68 * (g.chainT / 3.2), 3);
    }

    // dry-tank warning frame
    if (g.fuel <= 0) {
      const a = 0.25 + 0.18 * Math.sin(time / 110);
      ctx.strokeStyle = `rgba(244, 63, 94, ${a})`;
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 44, W - 8, H - 48);
      ctx.lineWidth = 1;
    }

    // impact wash
    if (g.flash > 0) {
      ctx.globalAlpha = Math.min(0.5, g.flash);
      ctx.fillStyle = g.flashC;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
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
    setNewBest(false);
    setReason("");
    dispRef.current = 0;
    touchRef.current = { steer: 0, gas: false };
    setStatus("playing");
  }, []);

  const crash = useCallback(
    (why: string) => {
      const g = gameRef.current;
      if (g.over) return;
      g.over = true;
      g.shake = 18;
      g.flash = 0.85;
      g.flashC = "#ef4444";
      burst(g, g.px, PY, 34, "#f97316", 240);
      burst(g, g.px, PY, 16, "#e2e8f0", 150);
      const final = Math.floor(g.dist + g.bonus);
      setScore(final);
      setReason(why);
      setNewBest(submit(final));
      setStatus("over");
      draw(performance.now());
    },
    [draw, submit],
  );

  const step = useCallback(
    (dt: number): boolean => {
      const g = gameRef.current;
      if (g.over) return true;

      if (g.shake > 0) g.shake = Math.max(0, g.shake - 26 * dt);
      if (g.flash > 0) g.flash = Math.max(0, g.flash - 2.2 * dt);

      const keys = keysRef.current;
      const touch = touchRef.current;
      const left = keys.has("ArrowLeft") || keys.has("a") || touch.steer === -1;
      const right = keys.has("ArrowRight") || keys.has("d") || touch.steer === 1;
      const gas = keys.has("ArrowUp") || keys.has("w") || touch.gas;
      const boost = keys.has(" ");

      const hard = clamp(g.dist / 6000, 0, 1);
      const base = 250 + hard * 230;

      // fuel burn + engine death
      if (g.fuel > 0) {
        let burn = 2.0;
        if (gas) burn += 5.5;
        if (boost) burn += 12;
        g.fuel = Math.max(0, g.fuel - burn * dt);
        g.deadT = 0;
      } else {
        if (g.deadT === 0) {
          pop(g, g.px, PY - 58, "OUT OF FUEL!", "#f87171");
          g.shake = 12;
        }
        g.deadT += dt;
        if (g.deadT > 1.8) {
          crash("engine starved");
          return true;
        }
        if (Math.random() < 0.6) {
          g.parts.push({
            x: g.px - 6 + Math.random() * 12,
            y: PY - 26,
            vx: -30 + Math.random() * 60,
            vy: -40 - Math.random() * 60,
            life: 0.7,
            max: 0.7,
            r: 4 + Math.random() * 4,
            c: "rgba(100, 116, 139, 0.7)",
          });
        }
      }

      // throttle
      if (g.fuel > 0) {
        let want = base * 0.66;
        if (gas) want = base;
        if (boost) want = base * 1.3;
        g.speed += (want - g.speed) * Math.min(1, 1.7 * dt);
      } else {
        g.speed = Math.max(70, g.speed - 260 * dt);
      }
      g.speed = Math.min(g.speed, base * 1.34);

      // steering
      const steer = (right ? 1 : 0) - (left ? 1 : 0);
      g.px = clamp(g.px + steer * 330 * dt, ROAD_L + 18, ROAD_R - 18);
      g.tilt += (steer * 0.16 - g.tilt) * Math.min(1, 12 * dt);

      // world scroll + score
      g.scroll += g.speed * dt;
      g.dist += (g.speed * dt) / 10;

      // chain clock
      if (g.chainT > 0) {
        g.chainT -= dt;
        if (g.chainT <= 0) g.chain = 0;
      }

      // spawn traffic
      g.spawnT -= dt;
      if (g.spawnT <= 0) {
        g.spawnT = Math.max(0.45, 1.1 - hard * 0.5) + Math.random() * 0.5;
        const truck = Math.random() < 0.2;
        for (let attempt = 0; attempt < 4; attempt++) {
          const lane = Math.floor(Math.random() * LANES);
          const cx = laneCenter(lane);
          let blocked = false;
          for (let i = 0; i < g.cars.length; i++) {
            const c = g.cars[i];
            if (c.y < 230 && Math.abs(c.x - cx) < LANE_W * 0.8) blocked = true;
          }
          if (blocked) continue;
          g.cars.push({
            x: cx,
            y: -90,
            speed: (0.45 + Math.random() * 0.3) * (250 + hard * 230),
            w: truck ? 46 : 40,
            h: truck ? 96 : 68,
            color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
            crossed: false,
          });
          break;
        }
      }

      // spawn fuel
      g.itemT -= dt;
      if (g.itemT <= 0) {
        g.itemT = Math.max(0.75, 1.4 - hard * 0.4) + Math.random() * 0.5;
        const kind: FuelItem["kind"] = Math.random() < 0.16 ? "station" : "can";
        g.items.push({
          x: laneCenter(Math.floor(Math.random() * LANES)),
          y: -70,
          kind,
        });
      }

      // move traffic + collisions + near misses
      for (let i = g.cars.length - 1; i >= 0; i--) {
        const c = g.cars[i];
        c.y += (g.speed - c.speed) * dt;
        if (c.y > H + 160 || c.y < -300) {
          g.cars.splice(i, 1);
          continue;
        }
        if (
          Math.abs(c.x - g.px) < c.w / 2 + 15 &&
          Math.abs(c.y - PY) < c.h / 2 + 30
        ) {
          crash("wrecked in traffic");
          return true;
        }
        if (!c.crossed && c.y - c.h / 2 > PY + 34) {
          c.crossed = true;
          const gap = Math.abs(c.x - g.px) - (c.w / 2 + 17);
          if (gap < 26) {
            g.chain = Math.min(12, g.chain + 1);
            g.chainT = 3.2;
            g.bonus += 5 + Math.min(45, g.chain * 4);
            g.flash = 0.18;
            g.flashC = "#fbbf24";
            pop(g, g.px, PY - 52, `NEAR MISS ×${g.chain}`, "#fbbf24");
            burst(g, (g.px + c.x) / 2, PY, 10, "#fde047", 130);
          }
        }
      }

      // fuel pickups
      for (let i = g.items.length - 1; i >= 0; i--) {
        const it = g.items[i];
        it.y += g.speed * dt;
        if (it.y > H + 110) {
          g.items.splice(i, 1);
          continue;
        }
        const reach = it.kind === "station" ? 50 : 36;
        if (Math.abs(it.y - PY) < 40 && Math.abs(it.x - g.px) < reach) {
          const gain = it.kind === "station" ? 55 : 18;
          g.fuel = Math.min(100, g.fuel + gain);
          g.items.splice(i, 1);
          g.flash = 0.22;
          g.flashC = it.kind === "station" ? "#34d399" : "#f59e0b";
          pop(g, it.x, it.y - 34, `+${gain} FUEL`, "#34d399");
          burst(
            g,
            it.x,
            it.y,
            16,
            it.kind === "station" ? "#34d399" : "#fbbf24",
            160,
          );
        }
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
      for (let i = g.pops.length - 1; i >= 0; i--) {
        g.pops[i].life -= dt;
        if (g.pops[i].life <= 0) g.pops.splice(i, 1);
      }

      const shown = Math.floor(g.dist + g.bonus);
      if (shown !== dispRef.current) {
        dispRef.current = shown;
        setScore(shown);
      }
      return false;
    },
    [crash],
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
        (k === " " ||
          k === "ArrowUp" ||
          k === "ArrowDown" ||
          k === "ArrowLeft" ||
          k === "ArrowRight")
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

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={`${score} m`} best={best !== null ? `${best} m` : "—"} />

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(249,158,21,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none"
          aria-label="Fuel Run highway"
        />

        {status === "playing" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
            <div className="pointer-events-auto flex gap-2">
              <button
                type="button"
                className="h-14 w-14 rounded-xl bg-black/45 text-xl text-ink backdrop-blur active:scale-95"
                aria-label="Steer left"
                onPointerDown={(e) => {
                  e.preventDefault();
                  touchRef.current.steer = -1;
                }}
                onPointerUp={() => {
                  touchRef.current.steer = 0;
                }}
                onPointerLeave={() => {
                  touchRef.current.steer = 0;
                }}
                onPointerCancel={() => {
                  touchRef.current.steer = 0;
                }}
              >
                ◀
              </button>
              <button
                type="button"
                className="h-14 w-14 rounded-xl bg-black/45 text-xl text-ink backdrop-blur active:scale-95"
                aria-label="Steer right"
                onPointerDown={(e) => {
                  e.preventDefault();
                  touchRef.current.steer = 1;
                }}
                onPointerUp={() => {
                  touchRef.current.steer = 0;
                }}
                onPointerLeave={() => {
                  touchRef.current.steer = 0;
                }}
                onPointerCancel={() => {
                  touchRef.current.steer = 0;
                }}
              >
                ▶
              </button>
            </div>
            <button
              type="button"
              className="pointer-events-auto h-14 w-24 rounded-xl bg-amber-500/70 text-sm font-bold text-ink backdrop-blur active:scale-95"
              aria-label="Gas"
              onPointerDown={(e) => {
                e.preventDefault();
                touchRef.current.gas = true;
              }}
              onPointerUp={() => {
                touchRef.current.gas = false;
              }}
              onPointerLeave={() => {
                touchRef.current.gas = false;
              }}
              onPointerCancel={() => {
                touchRef.current.gas = false;
              }}
            >
              GAS
            </button>
          </div>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">FUEL RUN</p>
            <p className="mt-2 text-sm text-muted">
              The engine drinks fuel whether you floor it or not. Snag glowing
              jerrycans and full gas stations across the lanes, weave through
              traffic, and chain near-misses for bonus metres — run dry and the
              engine sputters, then dies.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Arrows / A D steer · Up / W gas · Space boost · on mobile use ◀ ▶ + GAS
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">RUN OVER</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-muted">{reason}</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score} m</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best !== null ? `${best} m` : "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Fill up &amp; retry
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Gas station or grass — choose · near-misses bank metres · a dry tank ends the
        run
      </p>
    </div>
  );
}
