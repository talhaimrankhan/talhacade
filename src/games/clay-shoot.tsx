"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 520;
const GROUND_Y = 452;
const CLAYS_PER_ROUND = 25;
const ROUNDS = 2;

type Status = "idle" | "playing" | "over" | "round";

interface Clay {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  r: number;
  alive: boolean;
  trail: number;
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

interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
  big?: boolean;
}

interface ClayGame {
  clays: Clay[];
  parts: Particle[];
  texts: FloatText[];
  launched: number;
  hits: number;
  round: number;
  wind: number; // -1..1 drift
  launchT: number;
  nextFrom: 0 | 1; // 0 left tower, 1 right tower
  active: Clay | null;
  score: number;
  shake: number;
  flash: number;
  pullText: number;
  over: boolean;
  dirty: boolean;
}

function roundSpeed(round: number): { vx: number; vy: number; r: number } {
  if (round === 1) return { vx: 190, vy: -235, r: 15 };
  return { vx: 260, vy: -265, r: 13 };
}

function burst(parts: Particle[], x: number, y: number, n: number): void {
  const colors = ["#7dd3fc", "#38bdf8", "#e0f2fe", "#0ea5e9"];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 200;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.35 + Math.random() * 0.4,
      max: 0.75,
      r: 1.5 + Math.random() * 3,
      c: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

function createGame(): ClayGame {
  return {
    clays: [],
    parts: [],
    texts: [],
    launched: 0,
    hits: 0,
    round: 1,
    wind: Math.random() * 1.6 - 0.8,
    launchT: 0.8,
    nextFrom: 0,
    active: null,
    score: 0,
    shake: 0,
    flash: 0,
    pullText: 0,
    over: false,
    dirty: true,
  };
}

function launch(g: ClayGame): void {
  const spec = roundSpeed(g.round);
  const fromLeft = g.nextFrom === 0;
  g.nextFrom = g.nextFrom === 0 ? 1 : 0;
  const x = fromLeft ? 30 : W - 30;
  const dir = fromLeft ? 1 : -1;
  const vy = spec.vy - Math.random() * 45;
  const vx = (spec.vx + Math.random() * 45) * dir;
  g.active = {
    x,
    y: GROUND_Y - 24,
    vx,
    vy,
    rot: 0,
    spin: dir * (4 + Math.random() * 4),
    r: spec.r,
    alive: true,
    trail: 0,
  };
  g.clays.push(g.active);
  g.launched += 1;
  g.pullText = 0.6;
}

function stepGame(g: ClayGame, dt: number): void {
  if (g.over) return;

  g.shake = Math.max(0, g.shake - dt * 22);
  g.flash = Math.max(0, g.flash - dt);
  g.pullText = Math.max(0, g.pullText - dt);

  // launch pacing — quicker as the round goes on
  if (g.active === null && g.launched < CLAYS_PER_ROUND) {
    g.launchT -= dt;
    if (g.launchT <= 0) {
      launch(g);
      g.launchT = Math.max(0.55, 1.15 - g.round * 0.12) - g.launched * 0.008;
    }
  }

  for (let i = g.clays.length - 1; i >= 0; i--) {
    const c = g.clays[i];
    if (!c.alive) {
      g.clays.splice(i, 1);
      continue;
    }
    c.vy += 300 * dt; // gravity
    c.vx += g.wind * 60 * dt; // wind drift
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.spin * dt;
    c.trail += dt;

    const off =
      c.x < -60 || c.x > W + 60 || (c.y > GROUND_Y + 40 && c.vy > 0) || c.y < -140;
    if (off) {
      c.alive = false;
      if (g.active === c) g.active = null;
      g.clays.splice(i, 1);
    }
  }

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      g.parts.splice(i, 1);
      continue;
    }
    p.vy += 320 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  for (let i = g.texts.length - 1; i >= 0; i--) {
    const f = g.texts[i];
    f.life -= dt;
    f.y -= 30 * dt;
    if (f.life <= 0) g.texts.splice(i, 1);
  }

  // round / match end
  if (g.active === null && g.launched >= CLAYS_PER_ROUND && g.parts.length === 0) {
    if (g.round >= ROUNDS) {
      g.score = g.hits;
      g.over = true;
      g.dirty = true;
      return;
    }
    g.round += 1;
    g.launched = 0;
    g.hits = 0;
    g.wind = Math.random() * 1.8 - 0.9;
    g.launchT = 1.4;
    g.texts.push({
      x: W / 2,
      y: H / 2 - 20,
      text: `ROUND ${g.round} — FASTER`,
      life: 1.3,
      c: "#fde047",
      big: true,
    });
    g.dirty = true;
  }
}

export default function ClayShoot() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<ClayGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [queue, setQueue] = useState(CLAYS_PER_ROUND);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("clay-shoot", "high");
  const cross = useRef({ x: W / 2, y: H / 2 });

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0b1c33");
    sky.addColorStop(0.6, "#123252");
    sky.addColorStop(1, "#1a4066");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // sun glow
    ctx.save();
    ctx.globalAlpha = 0.5;
    const sun = ctx.createRadialGradient(W * 0.78, 90, 10, W * 0.78, 90, 130);
    sun.addColorStop(0, "rgba(253, 224, 71, 0.35)");
    sun.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // clouds
    ctx.fillStyle = "rgba(148, 197, 233, 0.12)";
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 173 + time / 90) % (W + 160)) - 80;
      const cy = 70 + i * 58;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 54, 15, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 34, cy - 8, 34, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ground
    const ground = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    ground.addColorStop(0, "#14532d");
    ground.addColorStop(1, "#052e16");
    ctx.fillStyle = ground;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "rgba(134, 239, 172, 0.25)";
    ctx.fillRect(0, GROUND_Y, W, 2);

    // towers
    for (const tx of [16, W - 16]) {
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.roundRect(tx - 14, GROUND_Y - 46, 28, 46, 4);
      ctx.fill();
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.roundRect(tx - 18, GROUND_Y - 54, 36, 12, 3);
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(tx, GROUND_Y - 48, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // clays
    for (const c of g.clays) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#fb923c";
      ctx.beginPath();
      ctx.ellipse(0, 0, c.r, c.r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c2410c";
      ctx.beginPath();
      ctx.ellipse(0, 0, c.r * 0.55, c.r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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

    // float text
    ctx.textAlign = "center";
    for (const f of g.texts) {
      ctx.globalAlpha = Math.min(1, f.life / 0.4);
      ctx.fillStyle = f.c;
      if (f.big) {
        ctx.font = "bold 26px ui-sans-serif, system-ui, sans-serif";
      } else {
        ctx.font = "bold 16px ui-monospace, monospace";
      }
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    if (g.pullText > 0) {
      ctx.globalAlpha = g.pullText / 0.6;
      ctx.fillStyle = "#fde047";
      ctx.font = "bold 22px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("PULL!", W / 2, H / 2);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "start";

    // wind flag
    const midX = W / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(midX, 34);
    ctx.lineTo(midX, 62);
    ctx.stroke();
    const len = 10 + Math.abs(g.wind) * 22;
    const dirX = Math.sign(g.wind) || 1;
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.moveTo(midX + dirX * len, 34 + 6);
    ctx.lineTo(midX + dirX * 4, 30);
    ctx.lineTo(midX + dirX * 4, 44);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("WIND", midX, 76);
    ctx.textAlign = "start";

    // crosshair
    const cx = cross.current.x;
    const cy = cross.current.y;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy);
    ctx.lineTo(cx + 18, cy);
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5);
    ctx.lineTo(cx, cy + 18);
    ctx.stroke();

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${g.flash * 0.25})`;
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
    setRound(1);
    setQueue(CLAYS_PER_ROUND);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastRound = 1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      stepGame(g, dt);

      if (g.dirty) {
        g.dirty = false;
        setScore(g.hits);
        setQueue(Math.max(0, CLAYS_PER_ROUND - g.launched));
        if (g.round !== lastRound) {
          lastRound = g.round;
          setRound(g.round);
        }
      }
      if (g.over) {
        const finalScore = g.hits;
        setScore(finalScore);
        setNewBest(submit(finalScore));
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

  const aim = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    cross.current = {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  const shoot = (clientX: number, clientY: number) => {
    const g = gameRef.current;
    if (!g || g.over) return;
    aim(clientX, clientY);
    const x = cross.current.x;
    const y = cross.current.y;
    g.flash = 0.08;

    for (let i = g.clays.length - 1; i >= 0; i--) {
      const c = g.clays[i];
      const dx = x - c.x;
      const dy = y - c.y;
      // forgiving ellipse — clays are flat discs
      const ex = dx / (c.r + 8);
      const ey = dy / (c.r * 0.6 + 8);
      if (ex * ex + ey * ey > 1) continue;

      c.alive = false;
      if (g.active === c) g.active = null;
      g.clays.splice(i, 1);
      g.hits += 1;
      g.score = g.hits;
      g.shake = 5;
      burst(g.parts, c.x, c.y, 20);
      g.texts.push({ x: c.x, y: c.y - 14, text: "HIT!", life: 0.6, c: "#7dd3fc" });
      g.dirty = true;
      return;
    }

    g.texts.push({ x, y: y - 12, text: "miss", life: 0.45, c: "rgba(226,232,240,0.6)" });
  };

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Round <b className="ml-1 text-sm text-ink">{round}/{ROUNDS}</b>
        </span>
        <span>
          Left <b className="ml-1 text-sm text-ink">{queue}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-24px_rgba(56,189,248,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-none"
          aria-label="Clay Shoot range"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") {
              start();
              return;
            }
            shoot(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            aim(e.clientX, e.clientY);
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">CLAY SHOOT</p>
            <p className="mt-2 text-sm text-muted">
              Orange discs arc over the field. Lead them — wind pushes every shot you don&apos;t
              take. 25 per round, two rounds.
            </p>
            <PrimaryButton onClick={start} tone="from-sky-400 to-indigo-500">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Aim + click or tap · watch the wind flag · round 2 is faster
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-sky-300">ROUND COMPLETE</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {score}
              <span className="text-xl text-muted"> / {CLAYS_PER_ROUND * ROUNDS}</span>
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · clays broken
            </p>
            <PrimaryButton onClick={start} tone="from-sky-400 to-indigo-500">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Shoot ahead of the disc · head wind shortens the arc · tail wind stretches it
      </p>
    </div>
  );
}
