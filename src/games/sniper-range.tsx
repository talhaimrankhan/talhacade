"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 520;
const STAGE_TIME = 28;

type Status = "idle" | "playing" | "over";

interface Droid {
  id: number;
  dist: number; // 100..800 m — drives size and score
  x: number; // screen-space slot (0..1 across the range)
  popT: number; // seconds until it ducks back down
  maxPop: number;
  y: number; // rises 0→1 as it pops up
  rising: boolean;
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

interface SniperGame {
  stage: number;
  targetsLeft: number;
  spawned: number;
  droids: Droid[];
  parts: Particle[];
  nextId: number;
  spawnT: number;
  time: number;
  wind: number; // -3..3 m/s drift applied to the shot
  swayX: number;
  swayY: number;
  swayPhase: number;
  stillT: number; // how long the shooter has held still
  aimX: number; // raw pointer, 0..1 of viewport
  aimY: number;
  zoom: number; // 1, 2, 4
  shots: number;
  hits: number;
  score: number;
  kick: number; // recoil offset
  muzzle: number;
  flash: number;
  over: boolean;
  reason: "time" | "done";
  dirty: boolean;
}

function droidSize(dist: number): number {
  // further = smaller on screen
  return Math.max(7, 46 - dist / 22);
}

function targetQuota(stage: number): number {
  return 5 + stage * 2;
}

function burst(parts: Particle[], x: number, y: number, n: number): void {
  const colors = ["#f87171", "#fca5a5", "#e5e7eb"];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 160;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 30,
      life: 0.3 + Math.random() * 0.35,
      max: 0.65,
      r: 1.2 + Math.random() * 2.2,
      c: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

function spawnDroid(g: SniperGame): void {
  const dist = 100 + Math.floor(Math.random() * 8) * 100;
  const maxPop = Math.max(1.6, 3.4 - g.stage * 0.3 - dist / 900);
  g.droids.push({
    id: g.nextId++,
    dist,
    x: 0.12 + Math.random() * 0.76,
    popT: maxPop,
    maxPop,
    y: 0,
    rising: true,
  });
  g.spawned += 1;
}

function createGame(): SniperGame {
  return {
    stage: 1,
    targetsLeft: targetQuota(1),
    spawned: 0,
    droids: [],
    parts: [],
    nextId: 1,
    spawnT: 0.6,
    time: STAGE_TIME,
    wind: Math.round((Math.random() * 6 - 3) * 10) / 10,
    swayX: 0,
    swayY: 0,
    swayPhase: Math.random() * 6,
    stillT: 0,
    aimX: 0.5,
    aimY: 0.5,
    zoom: 2,
    shots: 0,
    hits: 0,
    score: 0,
    kick: 0,
    muzzle: 0,
    flash: 0,
    over: false,
    reason: "time",
    dirty: true,
  };
}

function stepGame(g: SniperGame, dt: number): void {
  if (g.over) return;

  g.time -= dt;
  if (g.time <= 0) {
    g.time = 0;
    g.over = true;
    g.reason = "time";
    g.dirty = true;
    return;
  }

  g.kick = Math.max(0, g.kick - dt * 26);
  g.muzzle = Math.max(0, g.muzzle - dt);
  g.flash = Math.max(0, g.flash - dt);

  // breathing sway — settles the longer you hold still, grows with zoom
  g.swayPhase += dt * 1.9;
  g.stillT = Math.min(2.4, g.stillT + dt);
  const calm = 1 - Math.min(1, g.stillT / 1.8); // 1 → 0 as you steady
  const amp = (2.2 + calm * 7.5) * Math.sqrt(g.zoom);
  g.swayX = (Math.sin(g.swayPhase) + Math.sin(g.swayPhase * 2.3) * 0.4) * amp;
  g.swayY = (Math.cos(g.swayPhase * 0.8) + Math.sin(g.swayPhase * 1.7) * 0.5) * amp * 0.7;

  // droid pop-ups
  g.spawnT -= dt;
  const maxOnStage = Math.min(4, 1 + Math.ceil(g.stage / 2));
  if (g.spawnT <= 0 && g.droids.length < maxOnStage && g.spawned < g.targetsLeft) {
    g.spawnT = Math.max(0.35, 0.9 - g.stage * 0.08) + Math.random() * 0.4;
    spawnDroid(g);
  }

  for (let i = g.droids.length - 1; i >= 0; i--) {
    const d = g.droids[i];
    if (d.rising) {
      d.y = Math.min(1, d.y + dt * 5);
      if (d.y >= 1) d.rising = false;
    }
    d.popT -= dt;
    if (d.popT <= 0) {
      d.y = Math.max(0, d.y - dt * 6);
      if (d.y <= 0) g.droids.splice(i, 1);
    }
  }

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      g.parts.splice(i, 1);
      continue;
    }
    p.vy += 220 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  // stage cleared
  if (g.targetsLeft <= 0 && g.droids.length === 0) {
    g.stage += 1;
    g.targetsLeft = targetQuota(g.stage);
    g.spawned = 0;
    g.spawnT = 1;
    g.time = Math.max(16, STAGE_TIME - g.stage * 2);
    g.wind = Math.round((Math.random() * 6 - 3) * 10) / 10;
    g.dirty = true;
  }
}

/** Map the (swayed) aim point to a screen position. */
function aimScreen(g: SniperGame): { x: number; y: number } {
  return {
    x: g.aimX * W + g.swayX,
    y: g.aimY * H + g.swayY - g.kick,
  };
}

export default function SniperRange() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<SniperGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [stage, setStage] = useState(1);
  const [left, setLeft] = useState(targetQuota(1));
  const [time, setTime] = useState(STAGE_TIME);
  const [newBest, setNewBest] = useState(false);
  const [endStats, setEndStats] = useState({ reason: "time" as "time" | "done", hits: 0, shots: 0 });
  const { best, submit } = useBestScore("sniper-range", "high");
  const pointerHeld = useRef(false);

  /* ---------------- drawing ---------------- */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    const aim = aimScreen(g);

    // ---- world (rendered through the scope) ----
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, W, H);

    // distant range with parallax by zoom
    const z = g.zoom;
    const panX = (g.aimX - 0.5) * W * (1 - 1 / z);
    const panY = (g.aimY - 0.5) * H * (1 - 1 / z);

    ctx.save();
    ctx.translate(W / 2 - panX * (z / 2), H / 2 - panY * (z / 2));
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#18181b");
    sky.addColorStop(0.55, "#27272a");
    sky.addColorStop(1, "#3f3f46");
    ctx.fillStyle = sky;
    ctx.fillRect(-W, -H, W * 3, H * 3);

    // berm rows at distance bands
    const bands = [100, 200, 300, 400, 500, 600, 700, 800];
    for (let i = 0; i < bands.length; i++) {
      const y = H - 40 - i * 46;
      ctx.fillStyle = i % 2 === 0 ? "rgba(82, 82, 91, 0.55)" : "rgba(63, 63, 70, 0.55)";
      ctx.beginPath();
      ctx.moveTo(-W, y + 26);
      for (let x = -W; x <= W * 2; x += 60) {
        ctx.lineTo(x, y + 18 + Math.sin(x * 0.02 + i) * 5);
      }
      ctx.lineTo(W * 2, H + 60);
      ctx.lineTo(-W, H + 60);
      ctx.closePath();
      ctx.fill();
      // distance marker post
      ctx.fillStyle = "rgba(161, 161, 170, 0.8)";
      ctx.fillRect(36, y - 14, 3, 26);
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillStyle = "rgba(212, 212, 216, 0.85)";
      ctx.fillText(`${bands[i]}m`, 43, y - 4);
    }

    // droids
    for (const d of g.droids) {
      const size = droidSize(d.dist);
      const dx = d.x * W;
      const dy = H - 46 - (d.dist / 100 - 1) * 46 + (1 - d.y) * 30;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.globalAlpha = d.y;

      // body
      ctx.shadowColor = "#f87171";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#a1a1aa";
      ctx.beginPath();
      ctx.roundRect(-size * 0.5, -size * 0.35, size, size * 0.85, 3);
      ctx.fill();
      // head ring (bullseye)
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = Math.max(1, size * 0.1);
      ctx.beginPath();
      ctx.arc(0, -size * 0.62, size * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#27272a";
      ctx.beginPath();
      ctx.arc(0, -size * 0.62, size * 0.16, 0, Math.PI * 2);
      ctx.fill();
      // eye
      ctx.fillStyle = g.flash > 0 ? "#ffffff" : "#ef4444";
      ctx.beginPath();
      ctx.arc(0, -size * 0.62, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
      // legs
      ctx.strokeStyle = "#71717a";
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(-size * 0.3, size * 0.5);
      ctx.lineTo(-size * 0.45, size * 0.8);
      ctx.moveTo(size * 0.3, size * 0.5);
      ctx.lineTo(size * 0.45, size * 0.8);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    ctx.restore();

    // ---- scope overlay ----
    // vignette: dark mask with a clear lens circle
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(aim.x, aim.y, 150, 0, Math.PI * 2, true);
    ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
    ctx.fill("evenodd");
    ctx.restore();

    // lens rim
    ctx.strokeStyle = "rgba(161, 161, 170, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, 150, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, 156, 0, Math.PI * 2);
    ctx.stroke();

    // reticle
    ctx.strokeStyle = "rgba(248, 113, 113, 0.9)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(aim.x - 140, aim.y);
    ctx.lineTo(aim.x - 12, aim.y);
    ctx.moveTo(aim.x + 12, aim.y);
    ctx.lineTo(aim.x + 140, aim.y);
    ctx.moveTo(aim.x, aim.y - 140);
    ctx.lineTo(aim.x, aim.y - 12);
    ctx.moveTo(aim.x, aim.y + 12);
    ctx.lineTo(aim.x, aim.y + 140);
    ctx.stroke();
    // mil dots
    ctx.fillStyle = "rgba(248, 113, 113, 0.9)";
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(aim.x + i * 28, aim.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(aim.x - i * 28, aim.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(aim.x, aim.y + i * 28, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // wind hold-off marker
    ctx.fillStyle = "rgba(253, 224, 71, 0.95)";
    ctx.beginPath();
    ctx.arc(aim.x + g.wind * 8, aim.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // hit sparks
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // breath meter (steadiness)
    const calm = Math.min(1, g.stillT / 1.8);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(14, H - 30, 90, 8);
    ctx.fillStyle = calm > 0.85 ? "#4ade80" : "#fbbf24";
    ctx.fillRect(15, H - 29, 88 * calm, 6);
    ctx.fillStyle = "rgba(212,212,216,0.9)";
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillText("BREATH", 14, H - 34);

    // zoom + wind readout
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(212,212,216,0.9)";
    ctx.font = "bold 12px ui-monospace, monospace";
    ctx.fillText(`×${g.zoom}`, W - 14, 24);
    ctx.fillStyle = "#fde047";
    ctx.fillText(
      `WIND ${g.wind > 0 ? "→" : g.wind < 0 ? "←" : "·"} ${Math.abs(g.wind).toFixed(1)}`,
      W - 14,
      40,
    );
    ctx.textAlign = "start";

    // shot flash
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255, 244, 200, ${g.flash * 2.2})`;
      ctx.beginPath();
      ctx.arc(aim.x, aim.y, 150, 0, Math.PI * 2);
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
    draw();
  }, [draw]);

  /* ---------------- loop ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setStage(1);
    setLeft(targetQuota(1));
    setTime(STAGE_TIME);
    setEndStats({ reason: "time", hits: 0, shots: 0 });
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastWhole = STAGE_TIME;
    let lastStage = 1;
    let lastLeft = targetQuota(1);

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      stepGame(g, dt);

      const whole = Math.ceil(g.time);
      if (whole !== lastWhole) {
        lastWhole = whole;
        setTime(whole);
      }
      if (g.stage !== lastStage) {
        lastStage = g.stage;
        setStage(g.stage);
      }
      if (g.targetsLeft !== lastLeft) {
        lastLeft = g.targetsLeft;
        setLeft(g.targetsLeft);
      }
      if (g.dirty) {
        g.dirty = false;
        setScore(g.score);
      }
      if (g.over) {
        setScore(g.score);
        setEndStats({ reason: g.reason, hits: g.hits, shots: g.shots });
        setNewBest(submit(g.score));
        setStatus("over");
        draw();
        return;
      }

      draw();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, submit, draw]);

  useEffect(() => {
    if (status !== "playing") draw();
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const setZoom = (next: number) => {
      const g = gameRef.current;
      if (!g || g.over) return;
      g.zoom = next;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "q" || key === "e") {
        e.preventDefault();
        const g = gameRef.current;
        if (!g) return;
        setZoom(key === "q" ? (g.zoom === 1 ? 2 : 4) : g.zoom === 4 ? 2 : 1);
      } else if (key === " ") {
        e.preventDefault();
        if (status !== "playing") start();
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (status !== "playing") return;
      const g = gameRef.current;
      if (!g) return;
      setZoom(e.deltaY < 0 ? (g.zoom === 1 ? 2 : 4) : g.zoom === 4 ? 2 : 1);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [status, start]);

  const aimAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const g = gameRef.current;
    if (!canvas || !g) return;
    const rect = canvas.getBoundingClientRect();
    g.aimX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    g.aimY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    g.stillT = 0; // moving the scope re-starts the breath
  };

  const fire = (clientX: number, clientY: number) => {
    const g = gameRef.current;
    if (!g || g.over) return;
    aimAt(clientX, clientY);
    g.shots += 1;
    g.flash = 0.12;
    g.kick = 16;
    g.stillT = 0;

    const aim = aimScreen(g);

    // hit test back-to-front (closest to the crosshair)
    for (let i = g.droids.length - 1; i >= 0; i--) {
      const d = g.droids[i];
      if (d.y < 0.6) continue; // still rising — not a fair shot
      const size = droidSize(d.dist);
      const dx = d.x * W;
      const dy = H - 46 - (d.dist / 100 - 1) * 46;
      const headY = dy - size * 0.62;
      const dHead = Math.hypot(aim.x - dx, aim.y - headY);
      const dBody = Math.hypot(aim.x - dx, aim.y - (dy + size * 0.1));

      let points = 0;
      if (dHead <= size * 0.34) points = 300;
      else if (dBody <= size * 0.62) points = 120;
      if (points === 0) continue;

      // distance multiplier — a hit at 800m is worth far more
      const mult = 1 + (d.dist - 100) / 700;
      const gained = Math.round(points * mult);
      g.score += gained;
      g.hits += 1;
      g.targetsLeft -= 1;
      g.droids.splice(i, 1);
      burst(g.parts, aim.x, aim.y, 18);
      g.dirty = true;
      return;
    }

    // clean miss — the shot kicked up dirt somewhere off-target
    g.parts.push({
      x: aim.x + (Math.random() - 0.5) * 60,
      y: H - 40,
      vx: (Math.random() - 0.5) * 30,
      vy: -60 - Math.random() * 40,
      life: 0.5,
      max: 0.5,
      r: 2.5,
      c: "#78716c",
    });
  };

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Stage <b className="ml-1 text-sm text-ink">{stage}</b>
        </span>
        <span>
          Targets <b className="ml-1 text-sm text-ink">{left}</b>
        </span>
        <span>
          Time <b className="ml-1 text-sm text-ink">{time}s</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-24px_rgba(161,161,170,0.7)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-none"
          aria-label="Sniper Range scope view"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") {
              start();
              return;
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            pointerHeld.current = true;
            fire(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            aimAt(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            pointerHeld.current = false;
          }}
          onPointerCancel={() => {
            pointerHeld.current = false;
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">SNIPER RANGE</p>
            <p className="mt-2 text-sm text-muted">
              Robot droids pop between 100m and 800m. Hold still to steady your breath, account
              for the wind, clear every target before the clock.
            </p>
            <PrimaryButton onClick={start} tone="from-stone-400 to-zinc-600">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Mouse to aim · click to shoot · Q/E or wheel to zoom · headshots pay 2.5×
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              {endStats.reason === "time" ? "TIME'S UP" : "RANGE CLEAR"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · {endStats.hits}/{endStats.shots} on target · stage {stage}
            </p>
            <PrimaryButton onClick={start} tone="from-stone-400 to-zinc-600">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Heads = 300 pts, bodies = 120 · distant droids multiply up to 8× · the yellow dot shows
        your wind hold-off
      </p>
    </div>
  );
}
