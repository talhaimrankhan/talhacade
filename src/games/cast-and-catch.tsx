"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 420;
const H = 480;
const SURFACE = 28;
const BOTTOM = H - 12;
const COLUMN = BOTTOM - SURFACE;
const CASTS_PER_RUN = 3;
const CHARGE_MS = 1500;
const DROP_SPEED = 7.5;
const REEL_SPEED = 5;

type Phase = "idle" | "charging" | "dropping" | "reeling";
type Status = "idle" | "playing" | "over";

interface Fish {
  x: number;
  y: number;
  speed: number;
  dir: number;
  emoji: string;
  value: number;
  size: number;
  band: number;
  bob: number;
}

interface Splash {
  x: number;
  y: number;
  t: number;
  text: string | null;
}

interface Cast {
  fish: Fish[];
  phase: Phase;
  chargeT: number;
  hookX: number;
  targetX: number;
  hookY: number;
  targetY: number;
  caught: Fish | null;
  casts: number;
  haul: number;
  splashes: Splash[];
}

interface BandDef {
  emoji: string;
  value: number;
  size: number;
  count: number;
  speed: [number, number];
  top: number;
}

const BANDS: BandDef[] = [
  { emoji: "🐟", value: 10, size: 16, count: 5, speed: [1.1, 1.9], top: 0.3 },
  { emoji: "🐠", value: 25, size: 19, count: 4, speed: [0.9, 1.5], top: 0.56 },
  { emoji: "🐡", value: 60, size: 22, count: 3, speed: [0.7, 1.2], top: 0.8 },
  { emoji: "🦈", value: 150, size: 27, count: 1, speed: [0.55, 0.9], top: 1 },
];

const HINTS: Record<Phase, string> = {
  idle: "Hold to charge",
  charging: "Release to drop!",
  dropping: "…",
  reeling: "Reeling in",
};

function bandTop(i: number) {
  return SURFACE + COLUMN * (i === 0 ? 0 : BANDS[i - 1].top);
}

function spawnFish(band: number): Fish {
  const def = BANDS[band];
  const from = bandTop(band);
  const to = SURFACE + COLUMN * def.top;
  return {
    x: Math.random() * (W + 60) - 30,
    y: from + 14 + Math.random() * Math.max(8, to - from - 26),
    speed: def.speed[0] + Math.random() * (def.speed[1] - def.speed[0]),
    dir: Math.random() < 0.5 ? -1 : 1,
    emoji: def.emoji,
    value: def.value,
    size: def.size,
    band,
    bob: Math.random() * Math.PI * 2,
  };
}

function createCast(): Cast {
  const fish: Fish[] = [];
  for (let b = 0; b < BANDS.length; b++) {
    for (let i = 0; i < BANDS[b].count; i++) fish.push(spawnFish(b));
  }
  return {
    fish,
    phase: "idle",
    chargeT: 0,
    hookX: W / 2,
    targetX: W / 2,
    hookY: SURFACE,
    targetY: SURFACE,
    caught: null,
    casts: CASTS_PER_RUN,
    haul: 0,
    splashes: [],
  };
}

export default function CastAndCatch({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const castRef = useRef<Cast | null>(null);
  if (castRef.current === null) castRef.current = createCast();

  const [status, setStatus] = useState<Status>("idle");
  const [phase, setPhase] = useState<Phase>("idle");
  const [casts, setCasts] = useState(CASTS_PER_RUN);
  const [haul, setHaul] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const bestRef = useRef(best);
  useEffect(() => {
    bestRef.current = best;
  }, [best]);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = castRef.current;
    if (!ctx || !g) return;

    // water
    const water = ctx.createLinearGradient(0, SURFACE, 0, BOTTOM);
    water.addColorStop(0, "#0b2545");
    water.addColorStop(0.45, "#0a1c3a");
    water.addColorStop(1, "#050b1c");
    ctx.fillStyle = water;
    ctx.fillRect(0, SURFACE, W, COLUMN);

    // depth band tints + guides
    for (let i = 0; i < BANDS.length; i++) {
      const from = bandTop(i);
      const to = SURFACE + COLUMN * BANDS[i].top;
      ctx.fillStyle = `rgba(56, 189, 248, ${0.1 - i * 0.028})`;
      ctx.fillRect(0, from, W, to - from);
      ctx.fillStyle = "rgba(148, 163, 184, 0.18)";
      ctx.fillRect(0, to, W, 1);
      ctx.fillStyle = "rgba(148, 163, 184, 0.55)";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const label = ["SHALLOW", "MID", "DEEP", "ABYSS"][i];
      ctx.fillText(`${label} +${BANDS[i].value}`, 8, from + 12);
    }

    // sky above the waterline
    ctx.fillStyle = "#0b0b16";
    ctx.fillRect(0, 0, W, SURFACE);

    // surface ripple
    ctx.strokeStyle = "rgba(34, 211, 238, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const y = SURFACE + Math.sin(x / 26 + time / 480) * 2.5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // fish
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const fish of g.fish) {
      const y = fish.y + Math.sin(time / 620 + fish.bob) * 3;
      ctx.save();
      ctx.translate(fish.x, y);
      ctx.scale(fish.dir < 0 ? -1 : 1, 1);
      ctx.font = `${fish.size}px serif`;
      ctx.fillText(fish.emoji, 0, 0);
      ctx.restore();
    }

    // depth power bar (right edge)
    const barX = W - 16;
    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.beginPath();
    ctx.roundRect(barX - 4, SURFACE + 6, 12, COLUMN - 12, 6);
    ctx.fill();
    if (g.phase === "charging") {
      const p = (g.chargeT % CHARGE_MS) / CHARGE_MS;
      const my = SURFACE + 6 + (p < 0.5 ? p * 2 : 2 - p * 2) * (COLUMN - 12);
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.roundRect(barX - 7, my - 3, 18, 6, 3);
      ctx.fill();
    }

    // line + hook
    ctx.strokeStyle = "rgba(226, 232, 240, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(g.hookX, 0);
    ctx.lineTo(g.hookX, g.hookY);
    ctx.stroke();

    ctx.fillStyle = g.phase === "dropping" ? "#fbbf24" : "#e2e8f0";
    ctx.beginPath();
    ctx.arc(g.hookX, g.hookY + 3, 5, 0, Math.PI * 2);
    ctx.fill();

    if (g.caught) {
      ctx.font = `${g.caught.size}px serif`;
      ctx.fillText(g.caught.emoji, g.hookX, g.hookY + 16);
    }

    // splashes & floating values
    for (const s of g.splashes) {
      const age = time - s.t;
      const k = Math.min(1, age / 700);
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.8 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6 + k * 26, 0, Math.PI * 2);
      ctx.stroke();
      if (s.text) {
        ctx.fillStyle = `rgba(251, 191, 36, ${1 - k})`;
        ctx.font = "700 20px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(s.text, s.x, s.y - 14 - k * 26);
      }
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

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();

    const loop = (t: number) => {
      const dt = Math.min(t - last, 50);
      last = t;
      const f = dt / 16.667;
      const g = castRef.current;
      if (!g) return;

      // fish keep swimming
      for (const fish of g.fish) {
        fish.x += fish.speed * fish.dir * f;
        if (fish.dir > 0 && fish.x > W + 30) {
          fish.x = -30;
          fish.y = spawnFish(fish.band).y;
        } else if (fish.dir < 0 && fish.x < -30) {
          fish.x = W + 30;
          fish.y = spawnFish(fish.band).y;
        }
      }

      if (g.phase === "charging") {
        g.chargeT += dt;
        g.hookX += (g.targetX - g.hookX) * Math.min(1, 0.3 * f);
      } else if (g.phase === "dropping") {
        g.hookY += DROP_SPEED * f;
        if (g.hookY >= g.targetY) {
          g.hookY = g.targetY;
          // did the hook land on a fish?
          let hit: Fish | null = null;
          let hitDist = Number.POSITIVE_INFINITY;
          for (const fish of g.fish) {
            const fy = fish.y + Math.sin(t / 620 + fish.bob) * 3;
            const dy = Math.abs(fy - g.hookY);
            const dx = Math.abs(fish.x - g.hookX);
            if (dy < fish.size * 0.6 + 9 && dx < 17 && dx + dy < hitDist) {
              hitDist = dx + dy;
              hit = fish;
            }
          }
          if (hit) {
            g.caught = hit;
            g.fish = g.fish.filter((x) => x !== hit);
            g.splashes.push({
              x: hit.x,
              y: hit.y,
              t,
              text: `+${hit.value}`,
            });
          } else {
            g.splashes.push({ x: g.hookX, y: g.hookY, t, text: null });
          }
          g.phase = "reeling";
          setPhase("reeling");
        }
      } else if (g.phase === "reeling") {
        g.hookY -= REEL_SPEED * f;
        if (g.hookY <= SURFACE) {
          g.hookY = SURFACE;
          g.phase = "idle";
          g.casts -= 1;
          if (g.caught) {
            g.haul += g.caught.value;
            g.fish.push(spawnFish(g.caught.band));
            g.caught = null;
            setHaul(g.haul);
          }
          setCasts(Math.max(0, g.casts));
          setPhase("idle");
          if (g.casts <= 0) {
            setStatus("over");
            setNewBest(submit(g.haul));
          }
        }
      }

      // retire old splashes
      g.splashes = g.splashes.filter((s) => t - s.t < 900);

      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  const aim = useCallback((clientX: number, el: HTMLCanvasElement) => {
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const g = castRef.current;
    if (g) g.targetX = Math.max(28, Math.min(W - 28, x));
  }, []);

  const start = useCallback(() => {
    castRef.current = createCast();
    setPhase("idle");
    setCasts(CASTS_PER_RUN);
    setHaul(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const release = () => {
      const g = castRef.current;
      if (!g || g.phase !== "charging") return;
      const p = (g.chargeT % CHARGE_MS) / CHARGE_MS;
      const pos = p < 0.5 ? p * 2 : 2 - p * 2;
      g.targetY = SURFACE + pos * COLUMN;
      g.phase = "dropping";
      setPhase("dropping");
    };
    window.addEventListener("pointerup", release);
    return () => window.removeEventListener("pointerup", release);
  }, [status]);

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={haul} best={best ?? "—"}>
        <span className="text-accent">
          Casts <b className="ml-1 text-sm tabular-nums text-ink">{Math.max(0, casts)}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(56,189,248,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          onPointerDown={(e) => {
            e.preventDefault();
            aim(e.clientX, e.currentTarget);
            const g = castRef.current;
            if (!g || status !== "playing") return;
            if (g.phase === "idle") {
              g.phase = "charging";
              g.chargeT = 0;
              g.hookX = g.targetX;
              setPhase("charging");
            }
          }}
          onPointerMove={(e) => aim(e.clientX, e.currentTarget)}
          aria-label="Fishing spot with four depth bands"
        />

        <p className="pointer-events-none absolute left-3 top-7 font-mono text-[10px] uppercase tracking-widest text-white/50">{HINTS[phase]}</p>

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">CAST &amp; CATCH</p>
            <p className="mt-2 max-w-[34ch] text-sm text-muted">
              Hold to swing the depth marker, aim with your pointer, release to
              drop. Land on a fish to reel it in — {CASTS_PER_RUN} casts per run.
            </p>
            <PrimaryButton onClick={start} tone="from-sky-400 via-blue-500 to-indigo-600">
              Start fishing
            </PrimaryButton>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">RUN&apos;S OVER</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best haul!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-gradient">{haul}</p>
            <p className="text-xs uppercase tracking-widest text-muted">Best haul {best ?? "—"}</p>
            <PrimaryButton onClick={start} tone="from-sky-400 via-blue-500 to-indigo-600">
              New run
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        🐟 +10 shallow · 🐠 +25 mid · 🐡 +60 deep · 🦈 +150 in the abyss
      </p>
    </div>
  );
}
