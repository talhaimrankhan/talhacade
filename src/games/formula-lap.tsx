"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { Overlay, PrimaryButton } from "./parts";

const W = 640;
const H = 480;
const SAMPLES = 12; // catmull-rom samples per control segment
const HALF = 27; // track half-width
const WALL = 47; // barrier distance from centreline
const MAX_V = 268; // top speed px/s
const GHOST_MS = 50; // ghost sample interval

type Pt = { x: number; y: number };
type Status = "idle" | "playing" | "over";

/** Technical infield circuit: long straight, two sweepers, tight hairpin. */
const CTRL: Pt[] = [
  { x: 92, y: 74 },
  { x: 300, y: 62 },
  { x: 452, y: 66 },
  { x: 556, y: 104 },
  { x: 590, y: 192 },
  { x: 576, y: 286 },
  { x: 522, y: 332 },
  { x: 586, y: 374 },
  { x: 562, y: 432 },
  { x: 468, y: 428 },
  { x: 330, y: 408 },
  { x: 196, y: 410 },
  { x: 106, y: 372 },
  { x: 68, y: 300 },
  { x: 62, y: 182 },
];

function cr(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  );
}

function buildTrack(): Pt[] {
  const pts: Pt[] = [];
  const n = CTRL.length;
  for (let i = 0; i < n; i++) {
    const p0 = CTRL[(i - 1 + n) % n];
    const p1 = CTRL[i];
    const p2 = CTRL[(i + 1) % n];
    const p3 = CTRL[(i + 2) % n];
    for (let s = 0; s < SAMPLES; s++) {
      const t = s / SAMPLES;
      pts.push({
        x: cr(p0.x, p1.x, p2.x, p3.x, t),
        y: cr(p0.y, p1.y, p2.y, p3.y, t),
      });
    }
  }
  return pts;
}

const TRACK = buildTrack();
const N = TRACK.length;

/** Distance from the start line along the centreline, per sample point. */
const CUM: number[] = (() => {
  const c = [0];
  for (let i = 1; i <= N; i++) {
    const a = TRACK[i - 1];
    const b = TRACK[i % N];
    c.push(c[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return c;
})();
const LEN = CUM[N];

function probe(x: number, y: number, hint: number) {
  let best = hint;
  let bd = Infinity;
  for (let k = -14; k <= 14; k++) {
    const i = (hint + k + N) % N;
    const p = TRACK[i];
    const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  let dist = Infinity;
  let seg = best;
  let tt = 0;
  for (let k = -2; k <= 2; k++) {
    const i1 = (best + k + N) % N;
    const i2 = (i1 + 1) % N;
    const a = TRACK[i1];
    const b = TRACK[i2];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const l2 = abx * abx + aby * aby || 1;
    let t = ((x - a.x) * abx + (y - a.y) * aby) / l2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (a.x + abx * t), y - (a.y + aby * t));
    if (d < dist) {
      dist = d;
      seg = i1;
      tt = t;
    }
  }
  return { idx: best, seg, t: tt, dist };
}

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  c: string;
}

interface G {
  x: number;
  y: number;
  a: number;
  v: number;
  hint: number;
  seg: number;
  prevIdx: number;
  maxIdx: number;
  elapsed: number;
  ghost: number[];
  sampleAcc: number;
  parts: Part[];
  shake: number;
  off: boolean;
}

function makeCar() {
  const p = TRACK[0];
  const q = TRACK[6];
  return {
    x: p.x,
    y: p.y,
    a: Math.atan2(q.y - p.y, q.x - p.x),
    v: 0,
  };
}

function createGame(ghost: number[]): G {
  const c = makeCar();
  return {
    ...c,
    hint: 0,
    seg: 0,
    prevIdx: 0,
    maxIdx: 0,
    elapsed: 0,
    ghost,
    sampleAcc: 0,
    parts: [],
    shake: 0,
    off: false,
  };
}

function drawCarShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: number,
  body: string,
  wing: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(a);
  // rear wing
  ctx.fillStyle = wing;
  ctx.fillRect(-13, -11, 5, 22);
  // side pods
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-11, -9, 18, 18, 4);
  ctx.fill();
  // nose
  ctx.beginPath();
  ctx.moveTo(7, -4);
  ctx.lineTo(17, -1.6);
  ctx.lineTo(17, 1.6);
  ctx.lineTo(7, 4);
  ctx.closePath();
  ctx.fill();
  // front wing
  ctx.fillStyle = wing;
  ctx.fillRect(14, -9, 4, 18);
  // cockpit
  ctx.fillStyle = "rgba(8,8,16,0.85)";
  ctx.beginPath();
  ctx.roundRect(-4, -3.2, 8, 6.4, 2);
  ctx.fill();
  // wheels
  ctx.fillStyle = "#0c0c14";
  ctx.fillRect(-11, -12, 7, 5);
  ctx.fillRect(-11, 7, 7, 5);
  ctx.fillRect(6, -12, 6, 5);
  ctx.fillRect(6, 7, 6, 5);
  ctx.restore();
}

export default function FormulaLap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<G | null>(null);
  const keys = useRef({ up: false, down: false, left: false, right: false });
  const tickRef = useRef(-1);
  const deltaRef = useRef(-999);

  const [status, setStatus] = useState<Status>("idle");
  const [live, setLive] = useState(0);
  const [delta, setDelta] = useState<number | null>(null);
  const [result, setResult] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("formula-lap", "low");
  const [ghost, setGhost] = useStored<number[]>("formula-lap-ghost", []);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const sx = (Math.random() - 0.5) * g.shake;
    const sy = (Math.random() - 0.5) * g.shake;

    ctx.fillStyle = "#08110d";
    ctx.fillRect(0, 0, W, H);
    // mown grass stripes
    ctx.fillStyle = "rgba(52,211,153,0.045)";
    for (let i = 0; i < 8; i++) ctx.fillRect(0, i * 64, W, 32);

    ctx.save();
    ctx.translate(sx, sy);

    // track shoulder + asphalt + edge line
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(TRACK[0].x, TRACK[0].y);
      for (let i = 1; i < N; i++) ctx.lineTo(TRACK[i].x, TRACK[i].y);
      ctx.closePath();
    };
    trace();
    ctx.strokeStyle = "#2c2c40";
    ctx.lineWidth = WALL * 2;
    ctx.stroke();
    trace();
    ctx.strokeStyle = "#17172a";
    ctx.lineWidth = HALF * 2;
    ctx.stroke();
    trace();
    ctx.strokeStyle = "rgba(237,237,247,0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.stroke();

    // centre dashed line
    trace();
    ctx.strokeStyle = "rgba(237,237,247,0.14)";
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 18]);
    ctx.stroke();
    ctx.setLineDash([]);

    // start / finish chequer
    const s0 = TRACK[0];
    const s1 = TRACK[4];
    const na = Math.atan2(s1.y - s0.y, s1.x - s0.x) + Math.PI / 2;
    ctx.save();
    ctx.translate(s0.x, s0.y);
    ctx.rotate(na);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#ededf7" : "#10101b";
        ctx.fillRect(-7 + r * 7, -HALF + c * (HALF / 4), 7, HALF / 4);
      }
    }
    ctx.restore();

    // ghost car
    const gs = g.ghost;
    if (gs.length >= 6 && status !== "idle") {
      const gi = Math.min(gs.length / 3 - 1, Math.floor(g.elapsed / GHOST_MS));
      const i0 = Math.floor(gi);
      const i1 = Math.min(gs.length / 3 - 1, i0 + 1);
      const f = gi - i0;
      const gx = gs[i0 * 3] + (gs[i1 * 3] - gs[i0 * 3]) * f;
      const gy = gs[i0 * 3 + 1] + (gs[i1 * 3 + 1] - gs[i0 * 3 + 1]) * f;
      const ga = gs[i0 * 3 + 2] + (gs[i1 * 3 + 2] - gs[i0 * 3 + 2]) * f;
      drawCarShape(ctx, gx, gy, ga, "rgba(244,114,182,0.5)", "rgba(244,114,182,0.35)", 0.55);
    }

    // particles
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // player car
    const glow = g.off ? "#fbbf24" : "#38bdf8";
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
    drawCarShape(ctx, g.x, g.y, g.a, "#38bdf8", "#e0f2fe", 1);
    ctx.restore();

    ctx.restore();

    // off-track warning strip
    if (g.off && g.v > 60) {
      ctx.fillStyle = `rgba(251,191,36,${0.14 + Math.sin(time / 90) * 0.08})`;
      ctx.fillRect(0, 0, W, 6);
      ctx.fillRect(0, H - 6, W, 6);
    }
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!gameRef.current) gameRef.current = createGame([]);
    draw(performance.now());
  }, [draw]);

  /* ---------------- loop ---------------- */

  const finishLap = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const ms = Math.round(g.elapsed);
    setResult(ms);
    const isBest = submit(ms);
    setNewBest(isBest);
    if (isBest && g.ghost.length > 0) setGhost(g.ghost);
    setLive(ms);
    setStatus("over");
  }, [submit, setGhost]);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      const k = keys.current;
      const steer = (k.left ? -1 : 0) + (k.right ? 1 : 0);

      // throttle / brake
      if (k.up) g.v += 215 * dt;
      else g.v -= 26 * dt;
      if (k.down) g.v -= 420 * dt;

      const p = probe(g.x, g.y, g.hint);
      g.hint = p.idx;
      g.seg = p.seg;
      g.off = p.dist > HALF;

      const cap = g.off ? MAX_V * 0.42 : MAX_V;
      if (g.off) g.v *= 1 - 1.7 * dt;
      g.v = Math.max(-70, Math.min(cap, g.v));

      // steering scales with speed
      const turn = 2.9 * Math.min(1, Math.abs(g.v) / 115);
      g.a += steer * turn * dt * (g.v < 0 ? -1 : 1);

      g.x += Math.cos(g.a) * g.v * dt;
      g.y += Math.sin(g.a) * g.v * dt;

      // wall barrier
      if (p.dist > WALL) {
        const tp = TRACK[p.seg];
        const tq = TRACK[(p.seg + 1) % N];
        const nx = -(tq.y - tp.y);
        const ny = tq.x - tp.x;
        const nl = Math.hypot(nx, ny) || 1;
        const side =
          (g.x - (tp.x + ((tq.x - tp.x) * p.t))) * (nx / nl) +
          (g.y - (tp.y + ((tq.y - tp.y) * p.t))) * (ny / nl);
        const sgn = Math.sign(side) || 1;
        const over = p.dist - WALL;
        g.x -= (nx / nl) * sgn * over;
        g.y -= (ny / nl) * sgn * over;
        g.v *= 0.35;
        g.shake = Math.max(g.shake, 9);
        for (let i = 0; i < 8; i++) {
          g.parts.push({
            x: g.x,
            y: g.y,
            vx: (Math.random() - 0.5) * 160,
            vy: (Math.random() - 0.5) * 160,
            life: 0.6,
            c: "#fbbf24",
          });
        }
      }

      // grass dust
      if (g.off && g.v > 70 && Math.random() < 0.6) {
        g.parts.push({
          x: g.x - Math.cos(g.a) * 12,
          y: g.y - Math.sin(g.a) * 12,
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
          life: 0.5,
          c: "#65a30d",
        });
      }

      // particles
      for (const pt of g.parts) {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt * 1.6;
      }
      g.parts = g.parts.filter((pt) => pt.life > 0);
      g.shake = Math.max(0, g.shake - dt * 40);

      // lap progress
      g.elapsed += dt * 1000;
      g.sampleAcc += dt * 1000;
      if (g.sampleAcc >= GHOST_MS) {
        g.sampleAcc -= GHOST_MS;
        g.ghost.push(Math.round(g.x * 10) / 10, Math.round(g.y * 10) / 10, Math.round(g.a * 100) / 100);
      }

      const idx = p.idx;
      if (idx > g.maxIdx) g.maxIdx = idx;
      if (g.prevIdx > N * 0.75 && idx < N * 0.25 && g.maxIdx > N * 0.6 && g.elapsed > 5000) {
        finishLap();
        draw(t);
        return;
      }
      g.prevIdx = idx;

      // live timer + delta (throttled state writes)
      const t50 = Math.floor(g.elapsed / 50);
      if (t50 !== tickRef.current) {
        tickRef.current = t50;
        setLive(Math.round(g.elapsed));
      }
      if (g.ghost.length >= 6) {
        let gi = -1;
        let gd = 90 * 90;
        for (let i = 0; i < g.ghost.length / 3; i++) {
          const dx = g.ghost[i * 3] - g.x;
          const dy = g.ghost[i * 3 + 1] - g.y;
          const d = dx * dx + dy * dy;
          if (d < gd) {
            gd = d;
            gi = i;
          }
        }
        if (gi >= 0) {
          const d = gi * GHOST_MS - g.elapsed;
          if (Math.abs(d - deltaRef.current) > 60) {
            deltaRef.current = d;
            setDelta(Math.round(d) / 1000);
          }
        }
      }

      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, finishLap]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame(ghost);
    keys.current = { up: false, down: false, left: false, right: false };
    tickRef.current = -1;
    deltaRef.current = -999;
    setLive(0);
    setDelta(null);
    setNewBest(false);
    setStatus("playing");
  }, [ghost]);

  useEffect(() => {
    const set = (code: string, v: boolean) => {
      const k = keys.current;
      if (code === "ArrowUp" || code === "KeyW") k.up = v;
      if (code === "ArrowDown" || code === "KeyS") k.down = v;
      if (code === "ArrowLeft" || code === "KeyA") k.left = v;
      if (code === "ArrowRight" || code === "KeyD") k.right = v;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)
      ) {
        e.preventDefault();
      }
      if (e.code === "KeyR") {
        start();
        return;
      }
      if (e.code === "Space" || e.code === "Enter") {
        if (status !== "playing") start();
        return;
      }
      set(e.code, true);
    };
    const onKeyUp = (e: KeyboardEvent) => set(e.code, false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start]);

  /* ---------------- view ---------------- */

  const fmt = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

  return (
    <div className="w-full max-w-[660px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Lap <b className="ml-1 text-sm text-ink">{fmt(live)}</b>
        </span>
        <span className={delta === null ? "opacity-40" : delta <= 0 ? "text-emerald-400" : "text-rose-400"}>
          Δ <b className="ml-1 text-sm text-ink">{delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`}</b>
        </span>
        <span className="text-warn">
          Best <b className="ml-1 text-sm text-ink">{best === null ? "—" : fmt(best)}</b>
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(56,189,248,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none"
          aria-label="Formula Lap circuit"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">FORMULA LAP</p>
            <p className="mt-2 text-sm text-muted">
              One flying lap of the technical infield. Keep it on the tarmac, beat
              the clock — your best lap comes back as a ghost.
            </p>
            <PrimaryButton onClick={start} tone="from-sky-400 to-indigo-500">
              Start lap
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ↑ throttle · ↓ brake · ← → steer · R = instant restart
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-sky-300">LAP COMPLETE</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best lap!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{fmt(result)}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : fmt(best)} · ghost updated
            </p>
            <PrimaryButton onClick={start} tone="from-sky-400 to-indigo-500">
              Run it again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Press R for an instant new attempt</p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Watch the Δ vs your ghost · grass kills speed · the wall kills everything
      </p>
      <p className="mt-1 text-center text-[11px] text-muted">
        Circuit length {(LEN / 10).toFixed(0)}u · one lap, every tenth hurts
      </p>
    </div>
  );
}
