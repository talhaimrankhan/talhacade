"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 440;
const H = 520;
const FLOOR = 505;
const HORIZON = 250;
const MAX_PULL = 180;
const MIN_PULL = 12;
const GRAVITY = 0.5;
const START_DIST = 3;

type Pt = { x: number; y: number };
type Phase = "idle" | "ready" | "fly" | "over";

interface Bin {
  x: number;
  base: number;
  scale: number;
  w: number;
  h: number;
  rim: number;
}

const LAUNCH: Pt = { x: 90, y: 500 };

function binAt(dist: number): Bin {
  const scale = Math.max(0.35, 1 - (dist - START_DIST) * 0.05);
  const w = 48 * scale;
  const h = 60 * scale;
  const x = Math.min(320 + (dist - START_DIST) * 10, 405);
  const base = Math.max(470 - (dist - START_DIST) * 6, 400);
  return { x, base, scale, w, h, rim: base - h };
}

/** Wind grows with the streak but never becomes unfair. */
function randomWind(streak: number): number {
  const mag = Math.min(0.11, 0.02 + streak * 0.012);
  return (Math.random() < 0.5 ? -1 : 1) * (0.008 + Math.random() * mag);
}

export default function PaperToss({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballRef = useRef<Pt>({ ...LAUNCH });
  const velRef = useRef<Pt>({ x: 0, y: 0 });
  const aimRef = useRef({ active: false, x: 0, y: 0 });
  const windRef = useRef(0);
  const scoredRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [streak, setStreak] = useState(0);
  const [misses, setMisses] = useState(0);
  const [wind, setWind] = useState(0);
  const [message, setMessage] = useState("Drag back from the paper, let it fly");
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const dist = START_DIST + streak * 0.5;
  const bin = useMemo(() => binAt(dist), [dist]);

  /* ------------------------------ drawing ------------------------------ */

  const draw = useCallback((phase: Phase) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const wall = ctx.createLinearGradient(0, 0, 0, HORIZON);
    wall.addColorStop(0, "#1d1b31");
    wall.addColorStop(1, "#12101d");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, HORIZON);

    const floor = ctx.createLinearGradient(0, HORIZON, 0, H);
    floor.addColorStop(0, "#2b2338");
    floor.addColorStop(1, "#15111d");
    ctx.fillStyle = floor;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, HORIZON - 3, W, 3);

    // window with late-afternoon light
    ctx.fillStyle = "rgba(125,211,252,0.16)";
    ctx.fillRect(318, 52, 96, 112);
    ctx.strokeStyle = "rgba(125,211,252,0.5)";
    ctx.lineWidth = 3;
    ctx.strokeRect(318, 52, 96, 112);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(366, 52);
    ctx.lineTo(366, 164);
    ctx.moveTo(318, 108);
    ctx.lineTo(414, 108);
    ctx.stroke();

    // floor shadow under the bin
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(bin.x, bin.base - 2, bin.w / 2 + 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // glowing bin
    ctx.save();
    ctx.fillStyle = "rgba(34,211,238,0.16)";
    ctx.strokeStyle = "rgba(34,211,238,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bin.x - bin.w / 2, bin.rim);
    ctx.lineTo(bin.x - bin.w / 2, bin.base - 9);
    ctx.quadraticCurveTo(bin.x, bin.base + 8, bin.x + bin.w / 2, bin.base - 9);
    ctx.lineTo(bin.x + bin.w / 2, bin.rim);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(3,7,18,0.9)";
    ctx.beginPath();
    ctx.ellipse(bin.x, bin.rim, bin.w / 2, bin.w / 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 16;
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(bin.x, bin.rim, bin.w / 2, bin.w / 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // distance marker on the floor
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${dist.toFixed(1)} m`, bin.x, bin.base + 26);

    // aim slingshot
    const ball = ballRef.current;
    if (phase === "ready" && aimRef.current.active) {
      ctx.strokeStyle = "#fb7185";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(aimRef.current.x, aimRef.current.y);
      ctx.stroke();
      const pull = Math.min(
        Math.hypot(ball.x - aimRef.current.x, ball.y - aimRef.current.y),
        MAX_PULL,
      );
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(16, H - 26, 160, 12);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(16, H - 26, 160 * (pull / MAX_PULL), 12);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(16, H - 26, 160, 12);
      // fixed 45° launch arrow
      ctx.strokeStyle = "rgba(34,211,238,0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + 120, ball.y - 120);
      ctx.stroke();
    }

    // crumpled paper ball
    ctx.save();
    ctx.shadowColor = "rgba(226,232,240,0.6)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#f1f5f9";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(71,85,105,0.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ball.x - 7, ball.y - 5);
    ctx.lineTo(ball.x + 2, ball.y + 1);
    ctx.lineTo(ball.x + 8, ball.y - 6);
    ctx.moveTo(ball.x - 4, ball.y + 8);
    ctx.lineTo(ball.x + 1, ball.y + 1);
    ctx.lineTo(ball.x + 7, ball.y + 7);
    ctx.moveTo(ball.x - 9, ball.y + 2);
    ctx.lineTo(ball.x - 2, ball.y - 1);
    ctx.stroke();
  }, [bin, dist]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(phase);
  }, [draw, phase]);

  /* ------------------------------ logic ------------------------------ */

  const resolve = useCallback(
    (made: boolean) => {
      ballRef.current = { ...LAUNCH };
      velRef.current = { x: 0, y: 0 };
      aimRef.current.active = false;

      if (made) {
        const next = streak + 1;
        setStreak(next);
        setMessage("Swish! The bin drifts back");
        const w = randomWind(next);
        windRef.current = w;
        setWind(w);
        setPhase("ready");
        return;
      }

      const nextMisses = misses + 1;
      setMisses(nextMisses);
      if (nextMisses >= 3) {
        if (streak > 0) setNewBest(submit(streak));
        setMessage("Three misses — run over");
        setPhase("over");
        return;
      }
      setMessage("Off target — reset and refocus");
      const w = randomWind(streak);
      windRef.current = w;
      setWind(w);
      setPhase("ready");
    },
    [streak, misses, submit],
  );

  const throwBall = useCallback(() => {
    const pull = Math.min(
      Math.hypot(
        ballRef.current.x - aimRef.current.x,
        ballRef.current.y - aimRef.current.y,
      ),
      MAX_PULL,
    );
    if (pull < MIN_PULL) {
      aimRef.current.active = false;
      return;
    }
    const v0 = 7 + (pull / MAX_PULL) * 11;
    velRef.current = { x: v0 * Math.SQRT1_2, y: -v0 * Math.SQRT1_2 };
    scoredRef.current = false;
    setMessage("…and it's in the air");
    setPhase("fly");
  }, []);

  const start = useCallback(() => {
    ballRef.current = { ...LAUNCH };
    velRef.current = { x: 0, y: 0 };
    aimRef.current.active = false;
    scoredRef.current = false;
    const w = randomWind(0);
    windRef.current = w;
    setWind(w);
    setStreak(0);
    setMisses(0);
    setNewBest(false);
    setMessage("Drag back from the paper, let it fly");
    setPhase("ready");
  }, []);

  // live render loop — physics while the ball flies, aim preview while dragging
  useEffect(() => {
    if (phase !== "fly" && phase !== "ready") return;

    let raf = 0;
    let last = performance.now();

    const loop = (t: number) => {
      const f = Math.min((t - last) / 16.667, 2.5);
      last = t;

      if (phase === "fly") {
        const ball = ballRef.current;
        const vel = velRef.current;
        ball.x += vel.x * f;
        vel.x += windRef.current * f;
        ball.y += vel.y * f;
        vel.y += GRAVITY * f;

        if (!scoredRef.current && vel.y > 0) {
          const inMouthX = Math.abs(ball.x - bin.x) <= bin.w / 2 + 4;
          const inMouthY =
            ball.y >= bin.rim - 2 && ball.y <= bin.rim + bin.h * 0.6;
          if (inMouthX && inMouthY) {
            scoredRef.current = true;
            resolve(true);
            return;
          }
        }

        if (ball.y >= FLOOR || ball.x > W - 8 || ball.x < 8) {
          resolve(false);
          return;
        }
      }

      draw(phase);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, bin, resolve, draw]);

  // static frames while idle or showing the result
  useEffect(() => {
    if (phase !== "fly" && phase !== "ready") draw(phase);
  }, [phase, draw]);

  /* ------------------------------ input ------------------------------ */

  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "ready") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toCanvas(e);
    aimRef.current = { active: true, x: pt.x, y: pt.y };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimRef.current.active) return;
    const pt = toCanvas(e);
    aimRef.current.x = pt.x;
    aimRef.current.y = pt.y;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimRef.current.active) return;
    const pt = toCanvas(e);
    aimRef.current.x = pt.x;
    aimRef.current.y = pt.y;
    throwBall();
  };

  /* ------------------------------ view ------------------------------ */

  const strength = Math.max(1, Math.round(Math.abs(wind) / 0.03));

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={streak} best={best ?? "—"}>
        <span className="text-cyan-400">
          Wind{" "}
          <b className="ml-1 text-sm text-ink">
            {wind >= 0 ? "→" : "←"} {strength}
          </b>
        </span>
        <span className="text-rose-400">
          Miss{" "}
          <b className="ml-1 text-sm text-ink">
            {"✕".repeat(misses) || "—"}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(251,191,36,0.7)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            aimRef.current.active = false;
          }}
          aria-label="Paper Toss room"
        />

        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
          <span className="rounded-full border border-white/20 bg-black/70 px-4 py-1 font-mono text-[11px] uppercase tracking-widest text-ink backdrop-blur">
            {message}
          </span>
        </div>

        <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-line bg-black/60 px-2.5 py-1.5 text-center font-mono text-[11px] uppercase tracking-widest text-muted">
          Bin
          <b className="block text-sm text-warn">{dist.toFixed(1)} m</b>
        </div>

        {phase === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">PAPER TOSS</p>
            <p className="mt-2 text-sm text-muted">
              Drag back, release, and drop the paper in the bin.
            </p>
            <p className="mt-1 text-xs text-muted">
              The wind shifts every throw — three misses ends the run.
            </p>
            <PrimaryButton onClick={start} tone="from-slate-400 via-zinc-500 to-neutral-700">
              Start tossing
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">RUN OVER</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New longest streak!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{streak}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Streak · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-slate-400 via-zinc-500 to-neutral-700">
              Toss again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Angle is locked at 45° — only your pull sets the power
      </p>
    </div>
  );
}
