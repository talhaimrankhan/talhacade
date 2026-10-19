"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 520;
const TAU = Math.PI * 2;
const COLS = 5;
const ROWS = 4;
const MARGIN_X = 18;
const TOP = 56;
const BOTTOM = 18;
const CELL_W = (W - MARGIN_X * 2) / COLS;
const CELL_H = (H - TOP - BOTTOM) / ROWS;
const WIN_W = 58;
const WIN_H = 78;
const GHOST_R = 22;
const MAX_HEARTS = 3;
const GHOST_COLOR = "#a5b4fc";
const WRAITH_COLOR = "#f87171";

type Status = "idle" | "playing" | "over";
type Phase = "in" | "solid" | "out";

interface Ghost {
  col: number;
  row: number;
  phase: Phase;
  t: number;
  wraith: boolean;
  hp: number;
  seed: number;
  flash: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}
interface Floater {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
}
interface Ring {
  x: number;
  y: number;
  t: number;
  color: string;
}

interface Game {
  ghosts: Ghost[];
  particles: Particle[];
  floaters: Floater[];
  rings: Ring[];
  hearts: number;
  score: number;
  kills: number;
  combo: number;
  wave: number;
  spawnT: number;
  banner: string;
  bannerT: number;
  shake: number;
  hurt: number;
  aim: { x: number; y: number };
  over: boolean;
}

/* ------------------------------ helpers ------------------------------ */

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
}

function windowCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: MARGIN_X + col * CELL_W + CELL_W / 2,
    y: TOP + row * CELL_H + CELL_H / 2,
  };
}

function burst(
  g: Game,
  x: number,
  y: number,
  color: string,
  n: number,
  power: number,
): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = power * (0.35 + Math.random() * 0.65);
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.4,
      max: 0.8,
      color,
      size: 1.5 + Math.random() * 2.4,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, color: string): void {
  g.floaters.push({ x, y, text, t: 1, color });
}

/* ------------------------------ pacing ------------------------------ */

function inDur(wave: number): number {
  return Math.max(0.42, 0.95 - (wave - 1) * 0.035);
}
function solidDur(wave: number): number {
  return Math.max(0.5, 1.25 - (wave - 1) * 0.055);
}
function outDur(wave: number): number {
  return Math.max(0.34, 0.62 - (wave - 1) * 0.03);
}
function spawnGap(wave: number): number {
  return Math.max(0.5, 1.5 - (wave - 1) * 0.07);
}

function createGame(): Game {
  return {
    ghosts: [],
    particles: [],
    floaters: [],
    rings: [],
    hearts: MAX_HEARTS,
    score: 0,
    kills: 0,
    combo: 0,
    wave: 1,
    spawnT: 0.5,
    banner: "WAVE 1",
    bannerT: 1.3,
    shake: 0,
    hurt: 0,
    aim: { x: W / 2, y: H / 2 },
    over: false,
  };
}

function spawnGhosts(g: Game): void {
  const free: { col: number; row: number }[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!g.ghosts.some((gh) => gh.col === col && gh.row === row)) {
        free.push({ col, row });
      }
    }
  }
  let count = 1;
  if (g.wave >= 4 && Math.random() < 0.35 + g.wave * 0.03) count = 2;
  if (g.wave >= 9 && Math.random() < 0.3) count = 3;
  const cap = Math.min(7, 3 + Math.floor(g.wave / 3));
  count = Math.min(count, Math.max(1, cap - g.ghosts.length), free.length);

  const wraithChance = Math.min(0.34, Math.max(0, (g.wave - 2) * 0.05));
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * free.length);
    const spot = free.splice(idx, 1)[0];
    if (!spot) break;
    const wraith = Math.random() < wraithChance;
    g.ghosts.push({
      col: spot.col,
      row: spot.row,
      phase: "in",
      t: 0,
      wraith,
      hp: wraith ? 2 : 1,
      seed: Math.random() * TAU,
      flash: 0,
    });
  }
}

/* ------------------------------ shooting ------------------------------ */

function shoot(g: Game, x: number, y: number): void {
  const col = Math.floor((x - MARGIN_X) / CELL_W);
  const row = Math.floor((y - TOP) / CELL_H);
  const hit =
    col >= 0 && col < COLS && row >= 0 && row < ROWS
      ? g.ghosts.find((gh) => gh.col === col && gh.row === row)
      : undefined;

  if (!hit) {
    g.rings.push({ x, y, t: 1, color: "#67e8f9" });
    return;
  }

  const c = windowCenter(hit.col, hit.row);

  if (hit.phase === "solid") {
    hit.flash = 0.18;
    g.rings.push({ x, y, t: 1, color: "#ffffff" });
    burst(g, x, y, "#ffffff", 6, 130);
    if (hit.hp > 1) {
      hit.hp -= 1;
      g.score += 5;
      floater(g, c.x, c.y - 30, "STUN!", "#fbbf24");
      g.shake = Math.max(g.shake, 4);
      return;
    }
    // kill
    const idx = g.ghosts.indexOf(hit);
    if (idx >= 0) g.ghosts.splice(idx, 1);
    const mult = Math.min(8, 1 + Math.floor(g.combo / 4));
    const base = hit.wraith ? 25 : 10;
    const pts = base * mult;
    g.score += pts;
    g.kills += 1;
    g.combo += 1;
    const color = hit.wraith ? WRAITH_COLOR : GHOST_COLOR;
    burst(g, c.x, c.y, color, 22, 190);
    g.rings.push({ x: c.x, y: c.y, t: 1, color });
    floater(g, c.x, c.y - 28, `+${pts}`, color);
    if (mult > 1) floater(g, c.x, c.y - 8, `COMBO ×${mult}`, "#fbbf24");
    g.shake = Math.max(g.shake, 3);

    const nextWave = 1 + Math.floor(g.kills / 10);
    if (nextWave > g.wave) {
      g.wave = nextWave;
      g.banner = `WAVE ${g.wave}`;
      g.bannerT = 1.2;
    }
    return;
  }

  // fired while the ghost was still fading in / out — costs a heart
  const idx = g.ghosts.indexOf(hit);
  if (idx >= 0) g.ghosts.splice(idx, 1);
  g.hearts -= 1;
  g.combo = 0;
  g.hurt = 1;
  g.shake = Math.max(g.shake, 11);
  burst(g, c.x, c.y, "#6b7280", 14, 150);
  g.rings.push({ x, y, t: 1, color: "#f87171" });
  floater(g, c.x, c.y - 26, hit.phase === "in" ? "TOO SOON!" : "TOO LATE!", "#f87171");
  if (g.hearts <= 0) {
    g.hearts = 0;
    g.over = true;
  }
}

/* ------------------------------ step ------------------------------ */

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.hurt = Math.max(0, g.hurt - dt * 1.8);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);

  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 120 * dt;
    if (p.life <= 0) g.particles.splice(i, 1);
  }
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.t -= dt * 1.35;
    f.y -= 32 * dt;
    if (f.t <= 0) g.floaters.splice(i, 1);
  }
  for (let i = g.rings.length - 1; i >= 0; i--) {
    g.rings[i].t -= dt * 2.2;
    if (g.rings[i].t <= 0) g.rings.splice(i, 1);
  }

  g.spawnT -= dt;
  if (g.spawnT <= 0) {
    spawnGhosts(g);
    g.spawnT = spawnGap(g.wave) * (0.8 + Math.random() * 0.4);
  }

  const inD = inDur(g.wave);
  const solidD = solidDur(g.wave);
  const outD = outDur(g.wave);
  for (let i = g.ghosts.length - 1; i >= 0; i--) {
    const gh = g.ghosts[i];
    gh.flash = Math.max(0, gh.flash - dt);
    gh.t += dt;
    if (gh.phase === "in" && gh.t >= inD) {
      gh.phase = "solid";
      gh.t = 0;
    } else if (gh.phase === "solid" && gh.t >= solidD) {
      gh.phase = "out";
      gh.t = 0;
    } else if (gh.phase === "out" && gh.t >= outD) {
      const c = windowCenter(gh.col, gh.row);
      burst(g, c.x, c.y, hexA("#8b5cf6", 1), 5, 60);
      g.ghosts.splice(i, 1);
    }
  }
}

/* ------------------------------ render ------------------------------ */

function drawGhost(
  ctx: CanvasRenderingContext2D,
  gh: Ghost,
  x: number,
  y: number,
  alpha: number,
  scale: number,
  aim: { x: number; y: number },
  time: number,
): void {
  const r = GHOST_R * scale;
  const color = gh.wraith ? WRAITH_COLOR : GHOST_COLOR;
  const bob = Math.sin(time / 320 + gh.seed) * 2.5;
  const cy = y + bob;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = gh.flash > 0 ? "#ffffff" : color;

  // classic ghost: dome + wavy hem
  ctx.beginPath();
  ctx.arc(x, cy - 2, r, Math.PI, 0);
  const hem = cy + r - 4;
  const legs = 4;
  for (let i = 0; i < legs; i++) {
    const lx0 = x + r - (i * (2 * r)) / legs;
    const lx1 = x + r - ((i + 1) * (2 * r)) / legs;
    ctx.quadraticCurveTo((lx0 + lx1) / 2, hem + (i % 2 === 0 ? 9 : 2), lx1, hem - 2);
  }
  ctx.closePath();
  ctx.fill();

  // wraith horns
  if (gh.wraith) {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, cy - r * 0.55);
    ctx.lineTo(x - r * 1.05, cy - r * 1.25);
    ctx.lineTo(x - r * 0.3, cy - r * 0.9);
    ctx.moveTo(x + r * 0.7, cy - r * 0.55);
    ctx.lineTo(x + r * 1.05, cy - r * 1.25);
    ctx.lineTo(x + r * 0.3, cy - r * 0.9);
    ctx.fill();
  }

  // eyes track the crosshair
  let ex = (aim.x - x) / 60;
  let ey = (aim.y - cy) / 60;
  const em = Math.hypot(ex, ey);
  if (em > 1) {
    ex /= em;
    ey /= em;
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.36, cy - r * 0.15, r * 0.22, r * 0.28, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "#1a1033";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + side * r * 0.36 + ex * 3, cy - r * 0.15 + ey * 3, r * 0.12, 0, TAU);
    ctx.fill();
  }

  // mouth
  ctx.strokeStyle = "#1a1033";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (gh.wraith) {
    // jagged wraith grin
    ctx.moveTo(x - r * 0.34, cy + r * 0.38);
    for (let i = 1; i <= 4; i++) {
      ctx.lineTo(x - r * 0.34 + (i * r * 0.68) / 4, cy + r * (i % 2 === 0 ? 0.38 : 0.55));
    }
  } else {
    ctx.arc(x, cy + r * 0.32, r * 0.18, 0, Math.PI);
  }
  ctx.stroke();

  // stun spark for a wounded wraith
  if (gh.wraith && gh.hp === 1) {
    ctx.strokeStyle = "rgba(251, 191, 36, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(x, cy, r + 6, time / 300, time / 300 + TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0d0a1c");
  bg.addColorStop(1, "#191033");
  ctx.fillStyle = bg;
  ctx.fillRect(-12, -12, W + 24, H + 24);

  ctx.fillStyle = "rgba(165, 180, 252, 0.08)";
  for (let x = 22; x < W; x += 22) {
    for (let y = 22; y < H; y += 22) {
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, TAU);
      ctx.fill();
    }
  }

  if (g) {
    const inD = inDur(g.wave);
    const outD = outDur(g.wave);

    // haunted window grid
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const c = windowCenter(col, row);
        const gh = g.ghosts.find((q) => q.col === col && q.row === row);
        const x = c.x - WIN_W / 2;
        const y = c.y - WIN_H / 2;

        ctx.fillStyle = "rgba(8, 6, 20, 0.9)";
        ctx.beginPath();
        ctx.roundRect(x, y, WIN_W, WIN_H, 6);
        ctx.fill();

        if (gh) {
          const glow = gh.wraith ? WRAITH_COLOR : "#8b5cf6";
          ctx.save();
          ctx.shadowColor = glow;
          ctx.shadowBlur = 12;
          ctx.strokeStyle = hexA(glow, 0.85);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(x, y, WIN_W, WIN_H, 6);
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.strokeStyle = "rgba(148, 163, 184, 0.28)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(x, y, WIN_W, WIN_H, 6);
          ctx.stroke();
        }

        // window mullions
        ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(c.x, y + 3);
        ctx.lineTo(c.x, y + WIN_H - 3);
        ctx.moveTo(x + 3, c.y);
        ctx.lineTo(x + WIN_W - 3, c.y);
        ctx.stroke();

        if (gh) {
          let alpha = 1;
          let scale = 1;
          if (gh.phase === "in") {
            const p = Math.min(1, gh.t / inD);
            alpha = 0.12 + 0.88 * p;
            scale = 0.55 + 0.45 * p;
          } else if (gh.phase === "out") {
            const p = Math.min(1, gh.t / outD);
            alpha = 1 - 0.88 * p;
            scale = 1 - 0.25 * p;
          }
          drawGhost(ctx, gh, c.x, c.y, alpha, scale, g.aim, time + gh.seed * 400);
        }
      }
    }

    // shot rings
    for (const r of g.rings) {
      const rad = 6 + (1 - Math.max(0, r.t)) * 34;
      ctx.strokeStyle = hexA(r.color, Math.max(0, r.t));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
    }

    // particles
    for (const p of g.particles) {
      ctx.fillStyle = hexA(p.color, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }

    // floaters
    ctx.textAlign = "center";
    for (const f of g.floaters) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.t));
      ctx.font = "800 15px ui-monospace, monospace";
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // hearts + combo strip
    ctx.font = "700 15px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fb7185";
    ctx.fillText("♥".repeat(Math.max(0, g.hearts)), 16, 32);
    ctx.textAlign = "right";
    ctx.fillStyle = g.combo >= 4 ? "#fbbf24" : "rgba(148, 163, 184, 0.8)";
    ctx.fillText(g.combo > 1 ? `COMBO ${g.combo}` : "", W - 16, 32);

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.6);
      ctx.font = "800 30px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(165, 180, 252, 0.9)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 40);
      ctx.restore();
    }

    // crosshair
    if (!g.over) {
      const { x, y } = g.aim;
      ctx.save();
      ctx.strokeStyle = "#67e8f9";
      ctx.lineWidth = 1.6;
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, TAU);
      ctx.moveTo(x - 16, y);
      ctx.lineTo(x - 5, y);
      ctx.moveTo(x + 5, y);
      ctx.lineTo(x + 16, y);
      ctx.moveTo(x, y - 16);
      ctx.lineTo(x, y - 5);
      ctx.moveTo(x, y + 5);
      ctx.lineTo(x, y + 16);
      ctx.stroke();
      ctx.restore();
    }

    // hurt flash
    if (g.hurt > 0.01) {
      const grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
      grd.addColorStop(0, "rgba(248, 113, 113, 0)");
      grd.addColorStop(1, `rgba(248, 113, 113, ${(g.hurt * 0.45).toFixed(3)})`);
      ctx.fillStyle = grd;
      ctx.fillRect(-12, -12, W + 24, H + 24);
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function GhostHunter() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [wave, setWave] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("ghost-hunter", "high");

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (canvas) render(canvas, gameRef.current, time);
  }, []);

  // canvas setup + idle frame
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
    setHearts(MAX_HEARTS);
    setWave(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  // main loop
  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastWave = -1;

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
      if (g.wave !== lastWave) {
        lastWave = g.wave;
        setWave(g.wave);
      }

      draw(t);
      if (g.over) {
        setScore(g.score);
        setHearts(0);
        setNewBest(submit(g.score));
        setStatus("over");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit]);

  // static frame after mount / on the game-over screen
  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  const toPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  /* ------------------------------ view ------------------------------ */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Wave <b className="ml-1 text-sm text-ink">{wave}</b>
        </span>
        <span className="text-rose-400">
          Hearts{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${hearts} hearts`}>
            {"♥".repeat(Math.max(0, hearts))}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(165,180,252,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full cursor-crosshair touch-none"
          aria-label="Ghost hunter playfield"
          onPointerMove={(e) => {
            const g = gameRef.current;
            if (g && status === "playing") g.aim = toPos(e);
          }}
          onPointerDown={(e) => {
            if (status !== "playing") return;
            const g = gameRef.current;
            if (!g) return;
            const pt = toPos(e);
            g.aim = pt;
            shoot(g, pt.x, pt.y);
            setScore(g.score);
            setHearts(g.hearts);
            setWave(g.wave);
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">GHOST HUNTER</p>
            <p className="mt-2 text-sm text-muted">
              Ghosts fade through the mansion windows. Fire only when they are
              fully materialized — a shot into a fading ghost costs a heart.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-indigo-400 via-violet-500 to-purple-600"
            >
              Start hunt
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Aim with the mouse · click or tap to shoot · red wraiths take two
              hits · chain hits for combo multipliers
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              THE HOUSE WINS
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Score · Best {best ?? "—"} · reached wave {wave}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-indigo-400 via-violet-500 to-purple-600"
            >
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Wait for the glow to go solid · wraiths pay 25 · combo multiplies every
        four clean hits
      </p>
    </div>
  );
}
