"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 560;
const TURRET_X = 240;
const TURRET_Y = 542;
const SHOT_V = 640;
const BASE_RELOAD = 0.3;

type Status = "idle" | "playing" | "perk" | "over";

interface Nest {
  x: number;
  y: number;
  eggs: number;
}

interface Bird {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  speed: number;
  wob: number;
  dart: boolean;
  state: "fly" | "steal" | "flee";
  target: number;
  stealT: number;
  carrying: boolean;
  born: number;
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
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

interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
}

interface Mods {
  reload: number;
  pellets: number;
  net: number;
}

interface NestGame {
  nests: Nest[];
  birds: Bird[];
  shots: Shot[];
  parts: Part[];
  floaters: Floater[];
  wave: number;
  cleared: number;
  toSpawn: number;
  spawnT: number;
  reloadT: number;
  mods: Mods;
  shake: number;
  flash: number;
  banner: string;
  bannerT: number;
  over: boolean;
  dirty: boolean;
}

const PERKS = [
  { id: "rapid", name: "RAPID SLING", desc: "Reload 40% faster", tone: "from-teal-400 to-emerald-500" },
  { id: "triple", name: "TRIPLE SHOT", desc: "+2 pellets per shot", tone: "from-emerald-400 to-green-500" },
  { id: "net", name: "WIDE NET", desc: "Bigger catch radius", tone: "from-green-400 to-teal-500" },
] as const;

type PerkId = (typeof PERKS)[number]["id"];

const NEST_X = [100, 240, 380];
const EGG_START = [2, 2, 1];

function totalEggs(g: NestGame): number {
  return g.nests.reduce((n, nest) => n + nest.eggs, 0);
}

function liveScore(g: NestGame): number {
  return g.cleared + totalEggs(g);
}

function createGame(): NestGame {
  return {
    nests: NEST_X.map((x, i) => ({ x, y: 492, eggs: EGG_START[i] })),
    birds: [],
    shots: [],
    parts: [],
    floaters: [],
    wave: 1,
    cleared: 0,
    toSpawn: 0,
    spawnT: 0,
    reloadT: 0,
    mods: { reload: BASE_RELOAD, pellets: 1, net: 0 },
    shake: 0,
    flash: 0,
    banner: "",
    bannerT: 0,
    over: false,
    dirty: true,
  };
}

function startWave(g: NestGame, wave: number): void {
  g.wave = wave;
  g.toSpawn = Math.min(16, 3 + wave);
  g.spawnT = 0.7;
  g.banner = `WAVE ${wave}`;
  g.bannerT = 1.5;
  g.dirty = true;
}

function spawnGap(wave: number): number {
  return Math.max(0.4, 1.35 - wave * 0.07);
}

function birdSpeed(wave: number): number {
  return Math.min(215, 78 + wave * 7);
}

function spawnBird(g: NestGame): void {
  const fromSide = Math.random() < 0.45;
  const dart = Math.random() < Math.min(0.45, 0.1 + g.wave * 0.035);
  let x: number;
  let y: number;
  if (fromSide) {
    const left = Math.random() < 0.5;
    x = left ? -24 : W + 24;
    y = 50 + Math.random() * 230;
  } else {
    x = 40 + Math.random() * (W - 80);
    y = -24;
  }
  const candidates = g.nests.map((n, i) => ({ n, i })).filter((c) => c.n.eggs > 0);
  const pick =
    candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)].i
      : Math.floor(Math.random() * g.nests.length);
  const sp = birdSpeed(g.wave) * (dart ? 1.45 : 1) * (0.9 + Math.random() * 0.2);
  g.birds.push({
    x,
    y,
    vx: 0,
    vy: 0,
    r: dart ? 11 : 15,
    speed: sp,
    wob: Math.random() * Math.PI * 2,
    dart,
    state: "fly",
    target: pick,
    stealT: 0,
    carrying: false,
    born: 0,
  });
}

function burst(parts: Part[], x: number, y: number, c: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 50 + Math.random() * 170;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.3 + Math.random() * 0.35,
      max: 0.65,
      r: 1.4 + Math.random() * 2.4,
      c,
    });
  }
}

/** Returns "over" or "wave" (wave cleared), else null. */
function stepGame(g: NestGame, dt: number): "over" | "wave" | null {
  if (g.over) return "over";
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt);
  g.bannerT = Math.max(0, g.bannerT - dt);
  g.reloadT = Math.max(0, g.reloadT - dt);

  if (g.toSpawn > 0) {
    g.spawnT -= dt;
    if (g.spawnT <= 0) {
      spawnBird(g);
      g.toSpawn -= 1;
      g.spawnT = spawnGap(g.wave);
    }
  }

  for (let i = g.birds.length - 1; i >= 0; i--) {
    const b = g.birds[i];
    b.born += dt;
    b.wob += dt * (b.dart ? 9 : 6);

    if (b.state === "steal") {
      b.stealT -= dt;
      if (b.stealT <= 0) {
        const nest = g.nests[b.target];
        if (nest.eggs > 0) {
          nest.eggs -= 1;
          b.carrying = true;
          g.flash = 0.3;
          g.shake = Math.max(g.shake, 6);
          g.dirty = true;
          g.floaters.push({
            x: nest.x,
            y: nest.y - 30,
            text: "−1 EGG",
            life: 1,
            c: "#fb7185",
          });
          burst(g.parts, nest.x, nest.y, "#fde68a", 12);
        }
        b.state = "flee";
        const away = b.x < W / 2 ? -1 : 1;
        b.vx = away * b.speed * 1.15;
        b.vy = -b.speed * 0.75;
      }
      continue;
    }

    if (b.state === "flee") {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -50 || b.x > W + 50 || b.y < -60) g.birds.splice(i, 1);
      continue;
    }

    // fly toward the target nest
    const nest = g.nests[b.target];
    const dx = nest.x - b.x;
    const dy = nest.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 30) {
      if (nest.eggs > 0) {
        b.state = "steal";
        b.stealT = 0.38;
        b.vx = 0;
        b.vy = 0;
      } else {
        // empty nest — grab from another or bail
        const others = g.nests.map((n, idx) => ({ n, idx })).filter((c) => c.n.eggs > 0);
        if (others.length > 0) {
          b.target = others[Math.floor(Math.random() * others.length)].idx;
        } else {
          b.state = "flee";
          b.vx = b.x < W / 2 ? -b.speed : b.speed;
          b.vy = -b.speed;
        }
      }
      continue;
    }
    const wobble = Math.sin(b.wob) * 0.4;
    b.vx = (dx / d - (dy / d) * wobble) * b.speed;
    b.vy = (dy / d + (dx / d) * wobble) * b.speed;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }

  // shots
  for (let i = g.shots.length - 1; i >= 0; i--) {
    const s = g.shots[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.x < -14 || s.y < -14 || s.x > W + 14 || s.y > H + 14) {
      g.shots.splice(i, 1);
      continue;
    }
    const hitR = 13 + g.mods.net * 5;
    let consumed = false;
    for (let j = g.birds.length - 1; j >= 0; j--) {
      const b = g.birds[j];
      if (Math.hypot(s.x - b.x, s.y - b.y) > hitR + b.r) continue;
      const saved = b.state === "steal";
      g.birds.splice(j, 1);
      g.shots.splice(i, 1);
      consumed = true;
      burst(g.parts, b.x, b.y, b.dart ? "#fde047" : "#99f6e4", 14);
      g.floaters.push({
        x: b.x,
        y: b.y - 12,
        text: saved ? "SAVED!" : b.dart ? "+2" : "+1",
        life: 0.7,
        c: saved ? "#fde68a" : "#5eead4",
      });
      g.shake = Math.max(g.shake, 3);
      break;
    }
    if (consumed) continue;
  }

  // particles + floaters
  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      g.parts.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 280 * dt;
    p.vx *= 1 - 1.5 * dt;
  }
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.life -= dt;
    f.y -= 28 * dt;
    if (f.life <= 0) g.floaters.splice(i, 1);
  }

  if (totalEggs(g) <= 0) {
    g.over = true;
    return "over";
  }

  if (g.toSpawn === 0 && g.birds.length === 0) return "wave";
  return null;
}

export default function NestDefense() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<NestGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(5);
  const [eggs, setEggs] = useState(5);
  const [wave, setWave] = useState(1);
  const [choices, setChoices] = useState<PerkId[]>([]);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("nest-defense", "high");
  const aim = useRef({ x: TURRET_X, y: 200 });

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#042f2e");
    sky.addColorStop(0.7, "#0b3b32");
    sky.addColorStop(1, "#06231d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // sun glow
    const sun = ctx.createRadialGradient(W / 2, 90, 10, W / 2, 90, 190);
    sun.addColorStop(0, "rgba(52, 211, 153, 0.22)");
    sun.addColorStop(1, "rgba(52, 211, 153, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, 300);

    ctx.save();
    if (g.shake > 0.2) {
      ctx.translate(Math.sin(time / 20) * g.shake, Math.cos(time / 16) * g.shake);
    }

    // ground
    ctx.fillStyle = "#0a2a22";
    ctx.fillRect(0, 512, W, H - 512);
    ctx.fillStyle = "rgba(52, 211, 153, 0.35)";
    ctx.fillRect(0, 512, W, 2);

    // nests
    for (const nest of g.nests) {
      ctx.save();
      ctx.shadowColor = "#34d399";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.ellipse(nest.x, nest.y, 40, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#b45309";
      ctx.beginPath();
      ctx.ellipse(nest.x, nest.y - 3, 34, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      for (let i = 0; i < nest.eggs; i++) {
        const ex = nest.x + (i - (nest.eggs - 1) / 2) * 17;
        const ey = nest.y - 9 - (i % 2) * 3;
        ctx.save();
        ctx.shadowColor = "#fde68a";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#fef3c7";
        ctx.beginPath();
        ctx.ellipse(ex, ey, 7, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (nest.eggs === 0) {
        ctx.fillStyle = "rgba(251, 113, 133, 0.85)";
        ctx.font = "bold 11px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("EMPTY", nest.x, nest.y + 30);
        ctx.textAlign = "start";
      }
    }

    // turret aim line
    const a = Math.atan2(aim.current.y - TURRET_Y, aim.current.x - TURRET_X);
    ctx.strokeStyle = "rgba(153, 246, 215, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 9]);
    ctx.beginPath();
    ctx.moveTo(TURRET_X + Math.cos(a) * 26, TURRET_Y + Math.sin(a) * 26);
    ctx.lineTo(TURRET_X + Math.cos(a) * 400, TURRET_Y + Math.sin(a) * 400);
    ctx.stroke();
    ctx.setLineDash([]);

    // turret
    ctx.save();
    ctx.translate(TURRET_X, TURRET_Y);
    ctx.rotate(a);
    ctx.shadowColor = "#2dd4bf";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#2dd4bf";
    ctx.beginPath();
    ctx.roundRect(0, -6, 30, 12, 4);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.shadowColor = "#14b8a6";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#0f766e";
    ctx.beginPath();
    ctx.arc(TURRET_X, TURRET_Y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5eead4";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // shots
    ctx.save();
    ctx.shadowColor = "#ecfeff";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#ecfeff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (const s of g.shots) {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02);
      ctx.stroke();
    }
    ctx.restore();

    // birds
    for (const b of g.birds) {
      const flap = Math.sin(b.wob) * 0.9;
      const face = b.vx >= 0 ? 1 : -1;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(face, 1);
      if (b.state === "steal") {
        ctx.rotate(Math.sin(time / 40) * 0.25);
      }
      ctx.shadowColor = b.dart ? "#fde047" : "#5eead4";
      ctx.shadowBlur = 12;
      ctx.fillStyle = b.state === "steal" ? "#ffffff" : b.dart ? "#fde047" : "#99f6e4";
      // body
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r, b.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // wings
      ctx.fillStyle = b.dart ? "#f59e0b" : "#2dd4bf";
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.quadraticCurveTo(-b.r * 0.6, -b.r * (0.7 + flap), -b.r * 1.3, -b.r * flap * 0.5);
      ctx.quadraticCurveTo(-b.r * 0.5, b.r * 0.3, -3, b.r * 0.25);
      ctx.closePath();
      ctx.fill();
      // beak
      ctx.fillStyle = "#fb923c";
      ctx.beginPath();
      ctx.moveTo(b.r * 0.9, -2);
      ctx.lineTo(b.r * 1.5, 0);
      ctx.lineTo(b.r * 0.9, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (b.carrying) {
        ctx.save();
        ctx.shadowColor = "#fde68a";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#fef3c7";
        ctx.beginPath();
        ctx.ellipse(b.x, b.y + b.r + 7, 5, 6.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

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
    ctx.font = "bold 14px ui-monospace, monospace";
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
      ctx.font = "bold 30px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(g.banner, W / 2, 70);
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
    }

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(225, 29, 72, ${g.flash * 0.45})`;
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
    const g = createGame();
    startWave(g, 1);
    gameRef.current = g;
    aim.current = { x: TURRET_X, y: 200 };
    setScore(5);
    setEggs(5);
    setWave(1);
    setChoices([]);
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
        setScore(liveScore(g));
        setEggs(totalEggs(g));
        setWave(g.wave);
      }

      if (result === "over") {
        setScore(liveScore(g));
        setEggs(totalEggs(g));
        setNewBest(submit(liveScore(g)));
        setStatus("over");
        draw(t);
        return;
      }
      if (result === "wave") {
        g.cleared = g.wave;
        g.dirty = true;
        setScore(liveScore(g));
        if (g.wave % 5 === 0) {
          const pool = [...PERKS];
          const picked: PerkId[] = [];
          while (picked.length < 3 && pool.length > 0) {
            const i = Math.floor(Math.random() * pool.length);
            picked.push(pool[i].id);
            pool.splice(i, 1);
          }
          setChoices(picked);
          setStatus("perk");
          draw(t);
          return;
        }
        startWave(g, g.wave + 1);
        setWave(g.wave);
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

  const pointAt = (clientX: number, clientY: number, el: HTMLCanvasElement) => {
    const rect = el.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  const fire = (clientX: number, clientY: number, el: HTMLCanvasElement) => {
    const g = gameRef.current;
    if (!g || status !== "playing" || g.reloadT > 0) return;
    const p = pointAt(clientX, clientY, el);
    aim.current = p;
    const dx = p.x - TURRET_X;
    const dy = p.y - TURRET_Y;
    const d = Math.hypot(dx, dy) || 1;
    const count = g.mods.pellets;
    const spread = count === 1 ? 0 : 0.11;
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * spread;
      const base = Math.atan2(dy, dx) + off;
      g.shots.push({
        x: TURRET_X + Math.cos(base) * 20,
        y: TURRET_Y + Math.sin(base) * 20,
        vx: Math.cos(base) * SHOT_V,
        vy: Math.sin(base) * SHOT_V,
      });
    }
    g.reloadT = g.mods.reload;
    burst(g.parts, TURRET_X + (dx / d) * 24, TURRET_Y + (dy / d) * 24, "#ccfbf1", 4);
  };

  const choose = (id: PerkId) => {
    const g = gameRef.current;
    if (!g) return;
    if (id === "rapid") g.mods.reload = Math.max(0.1, g.mods.reload * 0.6);
    else if (id === "triple") g.mods.pellets = Math.min(5, g.mods.pellets + 2);
    else g.mods.net += 1;
    startWave(g, g.wave + 1);
    setWave(g.wave);
    setStatus("playing");
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-amber-300">
          Eggs{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${eggs} eggs left`}>
            {"🥚".repeat(Math.max(0, eggs)) || "0"}
          </b>
        </span>
        <span className="text-teal-300">
          Wave <b className="ml-1 text-sm text-ink">{wave}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(45,212,191,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-crosshair select-none"
          aria-label="Nest Defense playfield"
          onPointerMove={(e) => {
            if (status !== "playing") return;
            aim.current = pointAt(e.clientX, e.clientY, e.currentTarget);
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") return;
            e.currentTarget.setPointerCapture(e.pointerId);
            fire(e.clientX, e.clientY, e.currentTarget);
          }}
        />

        {status === "playing" && (
          <p className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            Aim ahead — shots are fast, birds faster
          </p>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">NEST DEFENSE</p>
            <p className="mt-2 text-sm text-muted">
              Three nests, five eggs, and a sky full of dive-bombing pterodactyls. Snap off fast
              shots — lead the swoop or watch an egg vanish.
            </p>
            <PrimaryButton onClick={start} tone="from-teal-400 via-emerald-500 to-green-600">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Move to aim, click / tap to shoot · every 5 waves grants a perk
            </p>
          </Overlay>
        )}

        {status === "perk" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-teal-300">
              WAVE {wave} CLEARED
            </p>
            <p className="mt-1 text-sm text-muted">Snatch a perk before they regroup</p>
            <div className="mt-4 flex flex-col items-center gap-2">
              {choices.map((id) => {
                const p = PERKS.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choose(p.id)}
                    className={`w-64 rounded-xl bg-gradient-to-r ${p.tone} px-5 py-2.5 text-left text-black shadow-lg transition hover:brightness-110 active:scale-95`}
                  >
                    <span className="block text-sm font-bold">{p.name}</span>
                    <span className="block text-xs opacity-80">{p.desc}</span>
                  </button>
                );
              })}
            </div>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">NEST RAIDED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {wave} waves · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-teal-400 via-emerald-500 to-green-600">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Score = waves survived + eggs still in the nest · yellow darters are twice as quick
      </p>
    </div>
  );
}
