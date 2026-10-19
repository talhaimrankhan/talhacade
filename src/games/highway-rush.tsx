"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 420;
const H = 600;
const ROAD_L = 26;
const ROAD_R = W - 26;
const LANES = 4;
const LANE_W = (ROAD_R - ROAD_L) / LANES;
const CAR_W = 42;
const CAR_H = 76;
const PLAYER_Y = H - 132;
const STEP = 1000 / 60;

type Status = "idle" | "playing" | "over";

interface Car {
  x: number;
  y: number;
  v: number; // own speed (negative = oncoming)
  onc: boolean;
  color: string;
  passed: boolean;
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

interface RushGame {
  px: number;
  lean: number;
  speed: number;
  dist: number;
  score: number;
  cars: Car[];
  parts: Particle[];
  spawnT: number;
  combo: number;
  comboT: number;
  shake: number;
  flash: number;
  toast: string;
  toastT: number;
  alive: boolean;
}

const TRAFFIC = ["#38bdf8", "#a78bfa", "#f472b6", "#facc15", "#34d399", "#fb7185"];

function laneCenter(lane: number): number {
  return ROAD_L + LANE_W * (lane + 0.5);
}

function createGame(): RushGame {
  return {
    px: W / 2,
    lean: 0,
    speed: 330,
    dist: 0,
    score: 0,
    cars: [],
    parts: [],
    spawnT: 0.5,
    combo: 1,
    comboT: 0,
    shake: 0,
    flash: 0,
    toast: "",
    toastT: 0,
    alive: true,
  };
}

function burst(g: RushGame, x: number, y: number, n: number, color: string, spread: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = spread * (0.35 + Math.random() * 0.9);
    g.parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.5,
      max: 1,
      r: 1.5 + Math.random() * 3,
      c: color,
    });
  }
}

export default function HighwayRush({ gameId = "highway-rush" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<RushGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [mph, setMph] = useState(83);
  const [combo, setCombo] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const inputRef = useRef({ left: false, right: false });

  /* ---------------- drawing ---------------- */

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const sx = (Math.random() - 0.5) * g.shake;
    const sy = (Math.random() - 0.5) * g.shake;
    ctx.save();
    ctx.translate(sx, sy);

    // void + road
    ctx.fillStyle = "#080b14";
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.fillStyle = "#131826";
    ctx.fillRect(ROAD_L, -20, ROAD_R - ROAD_L, H + 40);

    // curbs
    const curbOff = g.dist % 56;
    for (let y = -56 + (curbOff % 56); y < H + 56; y += 56) {
      const idx = Math.floor((y + g.dist) / 56);
      ctx.fillStyle = idx % 2 === 0 ? "#ef4444" : "#e5e7eb";
      ctx.fillRect(ROAD_L - 9, y, 9, 56);
      ctx.fillStyle = idx % 2 === 0 ? "#e5e7eb" : "#ef4444";
      ctx.fillRect(ROAD_R, y, 9, 56);
    }

    // lane dashes
    ctx.fillStyle = "rgba(226,232,240,0.35)";
    for (let l = 1; l < LANES; l++) {
      const x = ROAD_L + LANE_W * l - 1.5;
      for (let y = -70 + (g.dist % 70); y < H + 40; y += 70) {
        ctx.fillRect(x, y, 3, 40);
      }
    }

    // edge glow
    ctx.strokeStyle = "rgba(34,211,238,0.55)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(ROAD_L + 2, 0);
    ctx.lineTo(ROAD_L + 2, H);
    ctx.moveTo(ROAD_R - 2, 0);
    ctx.lineTo(ROAD_R - 2, H);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // speed streaks
    ctx.fillStyle = "rgba(148,163,184,0.14)";
    for (let i = 0; i < 7; i++) {
      const x = ROAD_L + 12 + ((i * 137 + (g.dist * 1.9) % 340) % (ROAD_R - ROAD_L - 24));
      const y = (g.dist * 2.4 + i * 211) % (H + 260) - 130;
      ctx.fillRect(x, y, 2, 60);
    }

    // traffic
    for (const c of g.cars) {
      if (c.y < -120 || c.y > H + 130) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.roundRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 9);
      ctx.fill();
      ctx.shadowBlur = 0;
      // windshield
      ctx.fillStyle = "rgba(11,11,22,0.55)";
      ctx.beginPath();
      ctx.roundRect(-CAR_W / 2 + 5, c.onc ? 2 : -CAR_H / 2 + 8, CAR_W - 10, 16, 4);
      ctx.fill();
      // lights
      ctx.fillStyle = c.onc ? "#fef9c3" : "#f87171";
      const ly = c.onc ? CAR_H / 2 - 6 : -CAR_H / 2 + 3;
      ctx.fillRect(-CAR_W / 2 + 4, ly, 7, 3);
      ctx.fillRect(CAR_W / 2 - 11, ly, 7, 3);
      ctx.restore();
    }

    // player
    ctx.save();
    ctx.translate(g.px, PLAYER_Y);
    ctx.rotate(g.lean * 0.14);
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.roundRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 10);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(8,12,24,0.7)";
    ctx.beginPath();
    ctx.roundRect(-CAR_W / 2 + 5, -8, CAR_W - 10, 20, 5);
    ctx.fill();
    ctx.fillStyle = "#ecfeff";
    ctx.fillRect(-CAR_W / 2 + 4, -CAR_H / 2 + 3, 7, 3);
    ctx.fillRect(CAR_W / 2 - 11, -CAR_H / 2 + 3, 7, 3);
    ctx.restore();

    // combo badge
    if (g.combo > 1 && g.comboT > 0) {
      ctx.font = "bold 20px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(250,204,21,${Math.min(1, g.comboT)})`;
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 12;
      ctx.fillText(`×${g.combo} NEAR MISS`, g.px, PLAYER_Y - 62);
      ctx.shadowBlur = 0;
    }

    // particles
    for (const p of g.parts) {
      const a = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // crash flash sits on top, unshaken
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(244,63,94,${Math.min(0.65, g.flash)})`;
      ctx.fillRect(0, 0, W, H);
      if (!g.alive) {
        ctx.font = "52px serif";
        ctx.textAlign = "center";
        ctx.fillText("💥", W / 2, H / 2);
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
    draw();
  }, [draw]);

  /* ---------------- logic ---------------- */

  const spawnWave = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const taken = new Set<number>();
    for (const c of g.cars) {
      if (c.y < 210) taken.add(Math.round((c.x - ROAD_L) / LANE_W));
    }
    const free: number[] = [];
    for (let i = 0; i < LANES; i++) if (!taken.has(i)) free.push(i);
    if (free.length <= 1) return; // always leave an out

    const doubles = Math.min(0.72, 0.12 + g.dist * 0.00007);
    const count = Math.random() < doubles && free.length >= 3 ? 2 : 1;
    // shuffle-free pick: pop random slots
    for (let k = 0; k < count; k++) {
      const idx = Math.floor(Math.random() * free.length);
      const lane = free.splice(idx, 1)[0];
      if (lane === undefined) break;
      const onc = Math.random() < Math.min(0.55, 0.25 + g.dist * 0.00004);
      g.cars.push({
        x: laneCenter(lane),
        y: -100 - Math.random() * 40,
        v: onc ? -(120 + Math.random() * 90) : 90 + Math.random() * 90,
        onc,
        color: TRAFFIC[Math.floor(Math.random() * TRAFFIC.length)] ?? "#38bdf8",
        passed: false,
      });
    }
  }, []);

  const crash = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;
    g.alive = false;
    g.shake = 22;
    g.flash = 0.9;
    g.combo = 1;
    burst(g, g.px, PLAYER_Y, 34, "#fb7185", 320);
    burst(g, g.px, PLAYER_Y, 18, "#facc15", 240);
    const final = g.score;
    setScore(final);
    setCombo(1);
    setNewBest(submit(final));
    setStatus("over");
    draw();
  }, [draw, submit]);

  /** Advances one fixed frame. */
  const step = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;

    g.speed = Math.min(830, 330 + g.dist * 0.02);
    g.dist += g.speed * (STEP / 1000);

    // steering
    const input = (inputRef.current.right ? 1 : 0) - (inputRef.current.left ? 1 : 0);
    g.px += input * 330 * (STEP / 1000);
    g.px = Math.max(ROAD_L + CAR_W / 2, Math.min(ROAD_R - CAR_W / 2, g.px));
    g.lean += (input - g.lean) * 0.25;

    // spawn + move traffic
    g.spawnT -= STEP / 1000;
    if (g.spawnT <= 0) {
      spawnWave();
      g.spawnT = Math.max(0.36, 0.95 - g.dist * 0.00013);
    }

    const keep: Car[] = [];
    let crashed = false;
    for (let i = 0; i < g.cars.length; i++) {
      const c = g.cars[i];
      c.y += (g.speed - c.v) * (STEP / 1000);
      if (c.y > H + 140) continue;

      const dx = Math.abs(c.x - g.px);
      const dy = Math.abs(c.y - PLAYER_Y);
      if (dx < CAR_W - 5 && dy < CAR_H - 10) crashed = true;

      if (!c.passed && c.y > PLAYER_Y + CAR_H / 2) {
        c.passed = true;
        if (dx < CAR_W + 28) {
          g.combo = Math.min(9, g.combo + 1);
          g.comboT = 2.4;
          const bonus = 30 * g.combo;
          g.score += bonus;
          g.shake = Math.max(g.shake, 5);
          burst(g, c.x, PLAYER_Y + 10, 8, "#facc15", 130);
        }
      }
      keep.push(c);
    }
    g.cars = keep;

    if (crashed) {
      crash();
      return;
    }

    // combo decay
    if (g.comboT > 0) {
      g.comboT -= STEP / 1000;
      if (g.comboT <= 0 && g.combo !== 1) {
        g.combo = 1;
        setCombo(1);
      }
    }

    // particles + shake
    for (let i = 0; i < g.parts.length; i++) {
      const p = g.parts[i];
      p.x += p.vx * (STEP / 1000);
      p.y += p.vy * (STEP / 1000);
      p.vy += 260 * (STEP / 1000);
      p.life -= STEP / 1000;
    }
    g.parts = g.parts.filter((p) => p.life > 0);
    g.shake = Math.max(0, g.shake - 0.9);
    g.flash = Math.max(0, g.flash - 0.03);

    // score = distance metres + near-miss bonus
    setScore(Math.floor(g.dist / 12) + g.score);
    setCombo(g.combo);
    setMph(Math.round(g.speed / 4));
  }, [crash, spawnWave]);

  const start = useCallback(() => {
    gameRef.current = createGame();
    inputRef.current.left = false;
    inputRef.current.right = false;
    setScore(0);
    setCombo(1);
    setMph(83);
    setNewBest(false);
    setStatus("playing");
  }, []);

  // main loop
  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (t: number) => {
      const dt = Math.min(t - last, 250);
      last = t;
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        const g = gameRef.current;
        if (!g || !g.alive) break;
        step();
      }
      draw();
      const g = gameRef.current;
      if (g && !g.alive) return;
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, step, draw]);

  useEffect(() => {
    if (status !== "playing") draw();
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const setKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") {
        e.preventDefault();
        inputRef.current.left = down;
      } else if (k === "arrowright" || k === "d") {
        e.preventDefault();
        inputRef.current.right = down;
      } else if (down && (k === " " || k === "enter")) {
        e.preventDefault();
        if (status !== "playing") start();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => setKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => setKey(e, false);
    const onBlur = () => {
      inputRef.current.left = false;
      inputRef.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [status, start]);

  const hold = useCallback((side: "left" | "right", down: boolean) => {
    inputRef.current[side] = down;
  }, []);

  const touchBtn =
    "pointer-events-auto flex h-16 w-16 select-none items-center justify-center rounded-2xl border border-line bg-surface/70 text-2xl font-bold text-ink backdrop-blur active:scale-95 active:bg-surface";

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-warn">
          Combo{" "}
          <b className="ml-1 text-sm text-ink">×{combo}</b>
        </span>
        <span className="text-warn">
          Speed{" "}
          <b className="ml-1 text-sm text-ink">
            {mph}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(249,115,22,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full [touch-action:none]"
          aria-label="Highway Rush driving game"
        />

        {status === "playing" && (
          <>
            <button
              type="button"
              aria-label="Steer left"
              className={`absolute bottom-4 left-4 ${touchBtn}`}
              onPointerDown={(e) => {
                e.preventDefault();
                hold("left", true);
              }}
              onPointerUp={() => hold("left", false)}
              onPointerCancel={() => hold("left", false)}
              onPointerLeave={() => hold("left", false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Steer right"
              className={`absolute bottom-4 right-4 ${touchBtn}`}
              onPointerDown={(e) => {
                e.preventDefault();
                hold("right", true);
              }}
              onPointerUp={() => hold("right", false)}
              onPointerCancel={() => hold("right", false)}
              onPointerLeave={() => hold("right", false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              →
            </button>
          </>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">HIGHWAY RUSH</p>
            <p className="mt-2 text-sm text-muted">
              Weave through four lanes of traffic. Skim a car to start a near-miss
              combo — crash and the run is over.
            </p>
            <PrimaryButton onClick={start} tone="from-orange-500 via-red-500 to-rose-600">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Arrows / A·D to steer · on-screen buttons on touch
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">WRECKED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Metres · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-orange-500 via-red-500 to-rose-600">
              Drive again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Steer between the lanes · near misses stack a ×9 combo · speed climbs with
        distance
      </p>
    </div>
  );
}
