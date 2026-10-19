"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 440;
const H = 560;
const BOAT_Y = H * 0.72; // boat's fixed screen y — the world scrolls past it
const STAGES = 4;
const BANK = 26;
const TONE = "from-cyan-400 via-sky-500 to-blue-600";

type Status = "idle" | "playing" | "over";

interface Gate {
  y: number;
  xl: number;
  xr: number;
  passed: boolean;
  penalized: boolean;
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

interface Pop {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
}

interface SlalomGame {
  x: number;
  y: number; // world space: x across the course, y up the course
  vx: number;
  vy: number;
  angle: number; // 0 = pointing up-course
  gates: Gate[];
  next: number;
  stage: number;
  top: number; // world y of the last generated gate
  finishY: number;
  time: number;
  clipCd: number;
  shake: number;
  wakeT: number;
  trail: { x: number; y: number; a: number }[];
  parts: Particle[];
  pops: Pop[];
  banner: string;
  bannerT: number;
  over: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Sideways push of the current at a given point of the course. */
function currentAt(y: number, stage: number): number {
  return Math.sin(y * 0.0042 + stage * 2.1) * (30 + stage * 18);
}

function makeStage(g: SlalomGame): void {
  const s = g.stage;
  let cx = W / 2;
  let y = g.top + 240;
  const count = 4 + s;
  g.gates = [];
  for (let i = 0; i < count; i++) {
    const gap = 150 - s * 10 + Math.random() * 14;
    const lo = BANK + 50 + gap / 2;
    const hi = W - BANK - 50 - gap / 2;
    cx = clamp(cx + (Math.random() * 2 - 1) * (78 + s * 26), lo, hi);
    y += 190 + Math.random() * 80 - s * 6;
    g.gates.push({
      y,
      xl: cx - gap / 2,
      xr: cx + gap / 2,
      passed: false,
      penalized: false,
    });
  }
  g.next = 0;
  g.top = y;
  g.finishY = y + 280;
}

function createGame(): SlalomGame {
  const g: SlalomGame = {
    x: W / 2,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    gates: [],
    next: 0,
    stage: 1,
    top: 0,
    finishY: 0,
    time: 0,
    clipCd: 0,
    shake: 0,
    wakeT: 0,
    trail: [],
    parts: [],
    pops: [],
    banner: "",
    bannerT: 0,
    over: false,
  };
  makeStage(g);
  return g;
}

function splash(g: SlalomGame, x: number, y: number, n: number, c: string): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * 90;
    g.parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.4,
      max: 0.9,
      r: 2 + Math.random() * 2.5,
      c,
    });
  }
}

function addPop(g: SlalomGame, x: number, y: number, text: string, c: string): void {
  g.pops.push({ x, y, text, life: 1.2, c });
}

export default function BoatSlalom() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [boot] = useState(createGame);
  const gameRef = useRef<SlalomGame>(boot);

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0); // elapsed seconds (1 decimal)
  const [stage, setStage] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("boat-slalom", "low");

  const keysRef = useRef<Set<string>>(new Set());
  const touchRef = useRef({ steer: 0, gas: false });
  const dispRef = useRef(0);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const shakeX = (Math.random() - 0.5) * g.shake;
    const shakeY = (Math.random() - 0.5) * g.shake;
    const toScreenY = (wy: number) => BOAT_Y + g.y - wy + shakeY;

    // water
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#082f49");
    grad.addColorStop(1, "#0c4a6e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // drifting current streaks
    ctx.strokeStyle = "rgba(125, 211, 252, 0.14)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 13; i++) {
      const sy = ((i * 47 + g.y * 0.55) % (H + 90)) - 45;
      ctx.beginPath();
      for (let x = BANK; x <= W - BANK; x += 22) {
        const yy = sy + Math.sin(x * 0.03 + time / 640 + i) * 6;
        if (x === BANK) ctx.moveTo(x + shakeX, yy);
        else ctx.lineTo(x + shakeX, yy);
      }
      ctx.stroke();
    }

    // banks
    ctx.fillStyle = "#3f2d1d";
    ctx.fillRect(0, 0, BANK + shakeX, H);
    ctx.fillRect(W - BANK + shakeX, 0, BANK, H);
    ctx.strokeStyle = "rgba(226, 232, 240, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(BANK + shakeX, 0);
    ctx.lineTo(BANK + shakeX, H);
    ctx.moveTo(W - BANK + shakeX, 0);
    ctx.lineTo(W - BANK + shakeX, H);
    ctx.stroke();

    // course line between gates
    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    for (const gate of g.gates) {
      const sy = toScreenY(gate.y);
      if (sy < -60 || sy > H + 60) continue;
      const cx = (gate.xl + gate.xr) / 2;
      if (!started) {
        ctx.moveTo(cx + shakeX, sy);
        started = true;
      } else ctx.lineTo(cx + shakeX, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // gates
    for (let i = 0; i < g.gates.length; i++) {
      const gate = g.gates[i];
      const sy = toScreenY(gate.y);
      if (sy < -60 || sy > H + 60) continue;
      const isNext = i === g.next;
      const col = gate.passed
        ? "rgba(148, 163, 184, 0.4)"
        : isNext
          ? "#34d399"
          : "#f87171";
      if (isNext) {
        const pulse = 0.45 + Math.sin(time / 140) * 0.3;
        ctx.strokeStyle = `rgba(52, 211, 153, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(gate.xl + shakeX, sy);
        ctx.lineTo(gate.xr + shakeX, sy);
        ctx.stroke();
        // arrow above the gate
        ctx.fillStyle = `rgba(52, 211, 153, ${pulse + 0.3})`;
        ctx.beginPath();
        ctx.moveTo((gate.xl + gate.xr) / 2 + shakeX, sy - 22);
        ctx.lineTo((gate.xl + gate.xr) / 2 - 7 + shakeX, sy - 34);
        ctx.lineTo((gate.xl + gate.xr) / 2 + 7 + shakeX, sy - 34);
        ctx.closePath();
        ctx.fill();
      }
      for (const bx of [gate.xl, gate.xr]) {
        ctx.save();
        ctx.shadowColor = col;
        ctx.shadowBlur = isNext ? 14 : 6;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(bx + shakeX, sy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(bx + shakeX, sy - 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // finish line
    const fy = toScreenY(g.finishY);
    if (fy > -30 && fy < H + 30) {
      for (let x = BANK; x < W - BANK; x += 20) {
        const white = Math.floor((x - BANK) / 20) % 2 === 0;
        ctx.fillStyle = white ? "#f8fafc" : "#111827";
        ctx.fillRect(x + shakeX, fy, 20, 12);
      }
    }

    // wake trail
    for (const t of g.trail) {
      const sy = toScreenY(t.y);
      ctx.fillStyle = `rgba(226, 232, 240, ${t.a * 0.4})`;
      ctx.beginPath();
      ctx.arc(t.x + shakeX, sy, 4 + (1 - t.a) * 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // particles
    for (const p of g.parts) {
      const a = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(p.x + shakeX, toScreenY(p.y), p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // boat
    ctx.save();
    ctx.translate(g.x + shakeX, BOAT_Y + shakeY);
    ctx.rotate(-g.angle);
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.quadraticCurveTo(11, -6, 9, 15);
    ctx.lineTo(-9, 15);
    ctx.quadraticCurveTo(-11, -6, 0, -20);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0ea5e9";
    ctx.beginPath();
    ctx.roundRect(-5, -6, 10, 14, 4);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(0, 2, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // pops
    ctx.textAlign = "center";
    ctx.font = "bold 15px ui-monospace, monospace";
    for (const p of g.pops) {
      const a = Math.min(1, p.life / 0.6);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.c;
      ctx.fillText(p.text, p.x + shakeX, toScreenY(p.y) - (1.2 - p.life) * 34);
    }
    ctx.globalAlpha = 1;

    // top bar
    ctx.fillStyle = "rgba(2, 6, 23, 0.55)";
    ctx.fillRect(0, 0, W, 34);
    ctx.font = "bold 15px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`⏱ ${g.time.toFixed(1)}s`, 12, 22);
    ctx.textAlign = "right";
    ctx.fillStyle = "#7dd3fc";
    ctx.fillText(`STAGE ${g.stage}/${STAGES}`, W - 12, 22);
    ctx.textAlign = "center";
    ctx.fillStyle = g.clipCd > 0 ? "#fbbf24" : "rgba(148, 163, 184, 0.9)";
    ctx.fillText(`GATE ${Math.min(g.next + 1, g.gates.length)}`, W / 2, 22);

    if (g.bannerT > 0) {
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.6);
      ctx.font = "bold 30px ui-sans-serif, system-ui";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(g.banner, W / 2, H * 0.4);
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
    setStage(1);
    setNewBest(false);
    dispRef.current = 0;
    setStatus("playing");
  }, []);

  const step = useCallback(
    (dt: number): boolean => {
      const g = gameRef.current;
      if (g.over) return true;
      g.time += dt;
      if (g.clipCd > 0) g.clipCd -= dt;
      if (g.shake > 0) g.shake = Math.max(0, g.shake - 24 * dt);
      if (g.bannerT > 0) g.bannerT -= dt;

      const keys = keysRef.current;
      const touch = touchRef.current;
      const left = keys.has("ArrowLeft") || keys.has("a") || touch.steer === -1;
      const right = keys.has("ArrowRight") || keys.has("d") || touch.steer === 1;
      const gas =
        keys.has("ArrowUp") || keys.has("w") || keys.has(" ") || touch.gas;

      const steer = (right ? 1 : 0) - (left ? 1 : 0);
      g.angle += steer * 2.5 * dt;

      const acc = gas ? 330 : 55; // gentle idle push so the boat never stalls
      g.vx += Math.sin(g.angle) * acc * dt;
      g.vy += Math.cos(g.angle) * acc * dt;

      // current always pushes sideways
      g.vx += currentAt(g.y, g.stage) * dt;

      g.vx -= g.vx * 1.05 * dt;
      g.vy -= g.vy * 1.05 * dt;
      const sp = Math.hypot(g.vx, g.vy);
      const maxSp = 275;
      if (sp > maxSp) {
        g.vx = (g.vx / sp) * maxSp;
        g.vy = (g.vy / sp) * maxSp;
      }

      const prevY = g.y;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (g.y < 0) {
        g.y = 0;
        g.vy = Math.max(0, g.vy);
      }

      // banks
      if (g.x < BANK + 14) {
        g.x = BANK + 14;
        g.vx = Math.abs(g.vx) * 0.4;
        g.shake = Math.max(g.shake, 5);
        splash(g, g.x, g.y, 6, "rgba(226,232,240,0.9)");
        addPop(g, g.x, g.y + 30, "SHORE", "#fbbf24");
      } else if (g.x > W - BANK - 14) {
        g.x = W - BANK - 14;
        g.vx = -Math.abs(g.vx) * 0.4;
        g.shake = Math.max(g.shake, 5);
        splash(g, g.x, g.y, 6, "rgba(226,232,240,0.9)");
        addPop(g, g.x, g.y + 30, "SHORE", "#fbbf24");
      }

      // wake
      g.wakeT -= dt;
      if (g.wakeT <= 0) {
        g.wakeT = 0.045;
        g.trail.unshift({ x: g.x, y: g.y, a: 1 });
        if (g.trail.length > 24) g.trail.pop();
      }
      for (let i = 0; i < g.trail.length; i++) g.trail[i].a -= dt * 1.6;

      // gate crossings
      for (let i = 0; i < g.gates.length; i++) {
        const gate = g.gates[i];
        if (gate.passed) continue;
        const crossedUp = prevY < gate.y && g.y >= gate.y;
        const crossedDown = prevY > gate.y && g.y <= gate.y;
        if (!crossedUp && !crossedDown) continue;
        const between = g.x > gate.xl + 8 && g.x < gate.xr - 8;
        if (!between) {
          // skimmed a buoy on the way through
          continue;
        }
        if (i === g.next) {
          gate.passed = true;
          g.next += 1;
          splash(g, gate.xl, gate.y, 8, "#34d399");
          splash(g, gate.xr, gate.y, 8, "#34d399");
          addPop(g, (gate.xl + gate.xr) / 2, gate.y, "GATE ✓", "#34d399");
        } else if (crossedUp && !gate.penalized) {
          gate.penalized = true;
          g.time += 3;
          addPop(g, g.x, g.y + 40, "OUT OF ORDER +3s", "#f87171");
          g.shake = Math.max(g.shake, 8);
        }
      }

      // buoy clips
      if (g.clipCd <= 0) {
        for (const gate of g.gates) {
          if (gate.passed || Math.abs(gate.y - g.y) > 40) continue;
          for (const bx of [gate.xl, gate.xr]) {
            const dx = g.x - bx;
            const dy = g.y - gate.y;
            if (dx * dx + dy * dy < 21 * 21) {
              g.clipCd = 0.7;
              g.time += 1;
              g.shake = Math.max(g.shake, 7);
              g.vx += Math.sign(dx || 1) * 70;
              splash(g, bx, gate.y, 10, "#f87171");
              addPop(g, g.x, g.y + 34, "BUOY +1s", "#f87171");
            }
          }
        }
      }

      // finish / stage advance
      if (g.y >= g.finishY) {
        if (g.stage < STAGES) {
          g.stage += 1;
          g.top = g.finishY;
          makeStage(g);
          g.banner = `STAGE ${g.stage}`;
          g.bannerT = 1.5;
          splash(g, g.x, g.y, 14, "#38bdf8");
          setStage(g.stage);
        } else {
          g.over = true;
          const final = Math.round(g.time * 10) / 10;
          setScore(final);
          setNewBest(submit(final));
          setStatus("over");
          return true;
        }
      }

      // particles
      for (let i = g.parts.length - 1; i >= 0; i--) {
        const p = g.parts[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx -= p.vx * 2 * dt;
        p.vy -= p.vy * 2 * dt;
        if (p.life <= 0) g.parts.splice(i, 1);
      }
      for (let i = g.pops.length - 1; i >= 0; i--) {
        g.pops[i].life -= dt;
        if (g.pops[i].life <= 0) g.pops.splice(i, 1);
      }

      const shown = Math.round(g.time * 10) / 10;
      if (shown !== dispRef.current) {
        dispRef.current = shown;
        setScore(shown);
      }
      return false;
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
        (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight" || k === " ")
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

  const touchDown = useCallback(
    (steer: number, gas: boolean) => {
      if (status !== "playing") start();
      touchRef.current = { steer, gas };
    },
    [status, start],
  );
  const touchUp = useCallback(() => {
    touchRef.current = { steer: 0, gas: false };
  }, []);

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={`${score.toFixed(1)}s`} best={best !== null ? `${best.toFixed(1)}s` : "—"}>
        <span className="text-warn">
          Stage <b className="ml-1 text-sm text-ink">{stage}/{STAGES}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(56,189,248,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none"
          aria-label="Boat Slalom course"
        />

        {status === "playing" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
            <div className="pointer-events-auto flex gap-2">
              <button
                type="button"
                className="h-14 w-14 rounded-xl bg-black/45 text-xl text-ink backdrop-blur active:scale-95"
                aria-label="Steer left"
                onPointerDown={() => touchDown(-1, false)}
                onPointerUp={touchUp}
                onPointerLeave={touchUp}
                onPointerCancel={touchUp}
              >
                ◀
              </button>
              <button
                type="button"
                className="h-14 w-14 rounded-xl bg-black/45 text-xl text-ink backdrop-blur active:scale-95"
                aria-label="Steer right"
                onPointerDown={() => touchDown(1, false)}
                onPointerUp={touchUp}
                onPointerLeave={touchUp}
                onPointerCancel={touchUp}
              >
                ▶
              </button>
            </div>
            <button
              type="button"
              className="pointer-events-auto h-14 w-20 rounded-xl bg-sky-500/60 text-sm font-bold text-ink backdrop-blur active:scale-95"
              aria-label="Throttle"
              onPointerDown={() => touchDown(0, true)}
              onPointerUp={touchUp}
              onPointerLeave={touchUp}
              onPointerCancel={touchUp}
            >
              GAS
            </button>
          </div>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">BOAT SLALOM</p>
            <p className="mt-2 text-sm text-muted">
              Thread every green gate in order. The current shoves you sideways —
              +3s for a skipped gate, +1s for clipping a buoy.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Arrows / WASD to steer · Up holds gas · on mobile use ◀ ▶ + GAS
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">COURSE COMPLETE</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best time!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {score.toFixed(1)}s
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best !== null ? `${best.toFixed(1)}s` : "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Sail again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Green gate is next · currents lie, gates don&apos;t · 4 stages get longer and rougher
      </p>
    </div>
  );
}
