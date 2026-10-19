"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 520;
const ROUND_TIME = 60;
const START_LIVES = 3;

type Status = "idle" | "playing" | "over";

interface Target {
  x: number;
  y: number;
  r: number;
  life: number;
  maxLife: number;
  born: number;
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

interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
}

interface QuickDrawGame {
  targets: Target[];
  parts: Particle[];
  floaters: Floater[];
  time: number;
  spawnT: number;
  lives: number;
  score: number;
  streak: number;
  best: number;
  shots: number;
  pops: number;
  shake: number;
  markX: number;
  markY: number;
  markT: number;
  over: boolean;
  reason: "time" | "lives";
  dirty: boolean;
}

function multiplier(streak: number): number {
  return Math.min(8, 1 + Math.floor(streak / 4));
}

/** Targets get smaller and quicker as the score climbs. */
function targetLife(score: number): number {
  return Math.max(0.85, 1.9 - score / 900);
}

function targetRadius(score: number): number {
  return Math.max(13, 34 - score / 130);
}

function spawnTarget(g: QuickDrawGame): void {
  const r = targetRadius(g.score);
  const margin = r + 22;
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 12; tries++) {
    x = margin + Math.random() * (W - margin * 2);
    y = margin + Math.random() * (H - margin * 2);
    const clear = g.targets.every(
      (t) => (t.x - x) ** 2 + (t.y - y) ** 2 > (t.r + r + 26) ** 2,
    );
    if (clear) break;
  }
  const life = targetLife(g.score);
  g.targets.push({ x, y, r, life, maxLife: life, born: 0 });
}

function burst(parts: Particle[], x: number, y: number, c: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 180;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.3 + Math.random() * 0.3,
      max: 0.6,
      r: 1.5 + Math.random() * 2.5,
      c,
    });
  }
}

function createGame(): QuickDrawGame {
  const g: QuickDrawGame = {
    targets: [],
    parts: [],
    floaters: [],
    time: ROUND_TIME,
    spawnT: 0.4,
    lives: START_LIVES,
    score: 0,
    streak: 0,
    best: 0,
    shots: 0,
    pops: 0,
    shake: 0,
    markX: -99,
    markY: -99,
    markT: 0,
    over: false,
    reason: "time",
    dirty: true,
  };
  return g;
}

function stepGame(g: QuickDrawGame, dt: number): void {
  if (g.over) return;

  g.time -= dt;
  if (g.time <= 0) {
    g.time = 0;
    g.over = true;
    g.reason = "time";
    g.dirty = true;
    return;
  }

  g.shake = Math.max(0, g.shake - dt * 26);
  g.markT = Math.max(0, g.markT - dt);
  g.spawnT -= dt;
  if (g.spawnT <= 0 && g.targets.length < 4) {
    // pace tightens over the round
    const pace = 0.95 - (1 - g.time / ROUND_TIME) * 0.5;
    g.spawnT = pace + Math.random() * 0.35;
    spawnTarget(g);
  }

  for (let i = g.targets.length - 1; i >= 0; i--) {
    const t = g.targets[i];
    t.born += dt;
    t.life -= dt;
    if (t.life <= 0) {
      // target vanished — costs a life and the streak
      g.targets.splice(i, 1);
      g.lives -= 1;
      g.streak = 0;
      g.shake = 5;
      g.markX = t.x;
      g.markY = t.y;
      g.markT = 0.5;
      g.floaters.push({
        x: t.x,
        y: t.y,
        text: "MISS",
        life: 0.8,
        c: "#f87171",
      });
      g.dirty = true;
      if (g.lives <= 0) {
        g.lives = 0;
        g.over = true;
        g.reason = "lives";
        return;
      }
    }
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
    p.vy += 260 * dt;
  }

  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) g.floaters.splice(i, 1);
  }
}

export default function QuickDraw() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<QuickDrawGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(ROUND_TIME);
  const [lives, setLives] = useState(START_LIVES);
  const [newBest, setNewBest] = useState(false);
  const [endStats, setEndStats] = useState({ pops: 0, shots: 0, reason: "time" as "time" | "lives" });
  const { best, submit } = useBestScore("quick-draw", "high");

  /* ---------------- drawing ---------------- */

  const draw = useCallback((timeMs: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    // saloon wall
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, "#1a120b");
    wall.addColorStop(1, "#0d0a06");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.07)";
    ctx.lineWidth = 2;
    for (let y = 40; y < H; y += 52) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      const off = (Math.floor(y / 52) % 2) * 60;
      for (let x = off; x < W; x += 120) {
        ctx.beginPath();
        ctx.moveTo(x, y - 52);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }

    ctx.save();
    if (g.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    }

    // targets
    for (const t of g.targets) {
      const pop = Math.min(1, t.born / 0.12);
      const scale = pop * (0.85 + 0.15 * Math.min(1, t.life / t.maxLife + 0.35));
      const r = t.r * scale;
      const frac = Math.max(0, t.life / t.maxLife);

      ctx.save();
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "#fecaca";
      ctx.beginPath();
      ctx.arc(t.x, t.y, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(t.x, t.y, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff7ed";
      ctx.beginPath();
      ctx.arc(t.x, t.y, r * 0.11, 0, Math.PI * 2);
      ctx.fill();

      // life ring — drains as the window closes
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r + 5, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
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

    // miss X
    if (g.markT > 0) {
      ctx.globalAlpha = g.markT / 0.5;
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      const s = 10;
      ctx.beginPath();
      ctx.moveTo(g.markX - s, g.markY - s);
      ctx.lineTo(g.markX + s, g.markY + s);
      ctx.moveTo(g.markX + s, g.markY - s);
      ctx.lineTo(g.markX - s, g.markY + s);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // floaters
    for (const f of g.floaters) {
      ctx.globalAlpha = Math.min(1, f.life / 0.4);
      ctx.fillStyle = f.c;
      ctx.font = "bold 16px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
    ctx.restore();

    // timer bar
    const frac = Math.max(0, g.time / ROUND_TIME);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, 6);
    ctx.fillStyle = frac > 0.25 ? "#fbbf24" : "#f87171";
    ctx.fillRect(0, 0, W * frac, 6);

    // streak / multiplier
    if (g.streak >= 2) {
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 14px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`×${multiplier(g.streak)} STREAK ${g.streak}`, W - 12, 26);
      ctx.textAlign = "start";
    }

    // idle hint cursor sparkle
    if (g.targets.length === 0 && timeMs % 900 < 450) {
      ctx.fillStyle = "rgba(251,191,36,0.25)";
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2);
      ctx.fill();
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
    setTime(ROUND_TIME);
    setLives(START_LIVES);
    setEndStats({ pops: 0, shots: 0, reason: "time" });
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastWhole = ROUND_TIME;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      stepGame(g, dt);

      if (g.dirty) {
        g.dirty = false;
        setScore(g.score);
        setLives(g.lives);
      }
      const whole = Math.ceil(g.time);
      if (whole !== lastWhole) {
        lastWhole = whole;
        setTime(whole);
      }
      if (g.over) {
        setScore(g.score);
        setEndStats({ pops: g.pops, shots: g.shots, reason: g.reason });
        setNewBest(submit(g.score));
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
        if (status !== "playing") start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start]);

  const shoot = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const g = gameRef.current;
    if (!canvas || !g || g.over) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    g.shots += 1;

    for (let i = g.targets.length - 1; i >= 0; i--) {
      const t = g.targets[i];
      const dx = x - t.x;
      const dy = y - t.y;
      if (dx * dx + dy * dy > t.r * t.r) continue;

      g.targets.splice(i, 1);
      g.pops += 1;
      g.streak += 1;
      g.best = Math.max(g.best, g.streak);
      const m = multiplier(g.streak);
      // bullseye (center third) pays double
      const bullseye = dx * dx + dy * dy < (t.r * 0.34) ** 2;
      const sizeBonus = Math.round(34 / t.r); // smaller target = worth more
      const points = 10 * m * sizeBonus * (bullseye ? 2 : 1);
      g.score += points;
      g.floaters.push({
        x: t.x,
        y: t.y - t.r,
        text: `+${points}${bullseye ? " BULLSEYE" : ""}`,
        life: 0.7,
        c: bullseye ? "#fde047" : "#fdba74",
      });
      burst(g.parts, t.x, t.y, "#ef4444", 16);
      burst(g.parts, t.x, t.y, "#fbbf24", 8);
      g.dirty = true;
      return;
    }

    // empty click — combo broken, but no life lost
    g.streak = 0;
    g.dirty = true;
    burst(g.parts, x, y, "#78716c", 5);
  };

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Time <b className="ml-1 text-sm text-ink">{time}s</b>
        </span>
        <span>
          Lives{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${lives} lives`}>
            {"●".repeat(lives) || "—"}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-24px_rgba(251,191,36,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-crosshair"
          aria-label="Quick Draw target wall"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") {
              start();
              return;
            }
            shoot(e.clientX, e.clientY);
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">QUICK DRAW</p>
            <p className="mt-2 text-sm text-muted">
              Targets flash up and shrink away. Pop them before the ring runs out — misses cost a
              life.
            </p>
            <PrimaryButton onClick={start} tone="from-amber-400 to-red-500">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Click or tap targets · 60 seconds · 3 lives · streaks raise the multiplier
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              {endStats.reason === "lives" ? "OUT OF LIVES" : "TIME UP"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · {endStats.pops} pops · {endStats.shots} shots
            </p>
            <PrimaryButton onClick={start} tone="from-amber-400 to-red-500">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Center hits pay 2× · small targets pay more · 4 hits in a row = ×2 multiplier
      </p>
    </div>
  );
}
