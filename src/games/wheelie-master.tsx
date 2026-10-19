"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 280;
const GY = 226; // ground line
const BIKE_X = 96; // bike's fixed screen x
const WB = 52; // wheelbase
const TONE = "from-emerald-400 via-teal-500 to-cyan-600";

type Status = "idle" | "playing" | "over";

interface Obstacle {
  x: number;
  kind: "car" | "sign" | "gap";
  w: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  c: string;
}

interface WheelieGame {
  dist: number; // world distance travelled (px)
  speed: number;
  angle: number; // 0 = flat, positive = front wheel up
  omega: number;
  score: number;
  mult: number;
  inGreen: boolean;
  obstacles: Obstacle[];
  nextSpawn: number;
  parts: Particle[];
  shake: number;
  flash: number;
  wheelSpin: number;
  over: boolean;
}

function speedAt(dist: number): number {
  return Math.min(330, 165 + dist * 0.012);
}

function makeObstacle(x: number, hard: boolean): Obstacle {
  const roll = Math.random();
  if (roll < 0.4) {
    return {
      x,
      kind: "car",
      w: hard ? 58 : 46,
      color: Math.random() < 0.5 ? "#f472b6" : "#60a5fa",
    };
  }
  if (roll < 0.72) {
    return { x, kind: "gap", w: hard ? 84 : 60, color: "#020617" };
  }
  return { x, kind: "sign", w: hard ? 78 : 62, color: "#fbbf24" };
}

function createGame(): WheelieGame {
  return {
    dist: 0,
    speed: speedAt(0),
    angle: 0,
    omega: 0,
    score: 0,
    mult: 1,
    inGreen: false,
    obstacles: [],
    nextSpawn: 420,
    parts: [],
    shake: 0,
    flash: 0,
    wheelSpin: 0,
    over: false,
  };
}

function burst(
  g: WheelieGame,
  x: number,
  y: number,
  n: number,
  c: string,
  power = 150,
): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * power;
    g.parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60,
      life: 0.5 + Math.random() * 0.5,
      max: 1,
      c,
    });
  }
}

export default function WheelieMaster() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [boot] = useState(createGame);
  const gameRef = useRef<WheelieGame>(boot);

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [mult, setMult] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const [reason, setReason] = useState("");
  const { best, submit } = useBestScore("wheelie-master", "high");

  const holdRef = useRef(false);
  const dispScore = useRef(0);
  const dispMult = useRef(1);

  /* ---------------- drawing ---------------- */

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const sx = (Math.random() - 0.5) * g.shake;
    const sy = (Math.random() - 0.5) * g.shake;

    // sky
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#04121f");
    grad.addColorStop(1, "#0a2434");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // parallax hills
    ctx.fillStyle = "rgba(45, 212, 191, 0.08)";
    for (let i = 0; i < 6; i++) {
      const hx = ((i * 130 - g.dist * 0.18) % (W + 260)) - 130;
      ctx.beginPath();
      ctx.arc(hx + sx, GY, 70, Math.PI, 0);
      ctx.fill();
    }

    // ground
    ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
    ctx.fillRect(0, GY, W, 3);
    ctx.fillStyle = "rgba(148, 163, 184, 0.14)";
    for (let x = (-g.dist * 1) % 44; x < W; x += 44) {
      ctx.fillRect(x + sx, GY + 12, 18, 2);
    }

    // obstacles
    for (const o of g.obstacles) {
      const x = o.x - g.dist + BIKE_X + sx;
      if (x < -140 || x > W + 140) continue;
      if (o.kind === "car") {
        ctx.fillStyle = o.color;
        ctx.shadowColor = o.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(x, GY - 30, o.w, 30, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(11,11,22,0.6)";
        ctx.beginPath();
        ctx.roundRect(x + o.w * 0.55, GY - 26, o.w * 0.3, 12, 3);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(x + 10, GY - 2, 6, 0, Math.PI * 2);
        ctx.arc(x + o.w - 10, GY - 2, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (o.kind === "gap") {
        ctx.fillStyle = "#020617";
        ctx.fillRect(x, GY, o.w, H - GY);
        ctx.strokeStyle = "rgba(148,163,184,0.5)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, GY, o.w - 2, H - GY);
        // warning stripes
        ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
        ctx.beginPath();
        for (let s = 0; s < o.w; s += 14) {
          ctx.moveTo(x + s, GY + 2);
          ctx.lineTo(x + s + 8, GY + 12);
        }
        ctx.stroke();
      } else {
        // overhead sign — drop the wheelie to duck it
        ctx.strokeStyle = "rgba(148,163,184,0.7)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + 6, GY);
        ctx.lineTo(x + 6, GY - 78);
        ctx.moveTo(x + o.w - 6, GY);
        ctx.lineTo(x + o.w - 6, GY - 78);
        ctx.stroke();
        ctx.fillStyle = o.color;
        ctx.shadowColor = o.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(x, GY - 78, o.w, 24, 5);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 13px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("LOW!", x + o.w / 2, GY - 61);
      }
    }

    // particles
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x + sx - 2, p.y + sy - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // bike
    const rearX = BIKE_X + sx;
    const rearY = GY - 14 + sy;
    const fx = rearX + Math.cos(-g.angle) * WB;
    const fy = rearY + Math.sin(-g.angle) * WB;

    ctx.save();
    // frame line
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(rearX, rearY);
    ctx.lineTo(fx, fy);
    ctx.stroke();

    // wheels
    for (const [wx, wy] of [
      [rearX, rearY],
      [fx, fy],
    ] as const) {
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(g.wheelSpin);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(203, 213, 225, 0.6)";
      ctx.lineWidth = 1.5;
      for (let s = 0; s < 4; s++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        ctx.rotate(Math.PI / 4);
      }
      ctx.restore();
    }

    // body + rider above the frame line
    ctx.translate((rearX + fx) / 2, (rearY + fy) / 2);
    ctx.rotate(-g.angle);
    ctx.fillStyle = "#2dd4bf";
    ctx.shadowColor = "#2dd4bf";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(-20, -14, 40, 12, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    // rider
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.roundRect(-6, -32, 14, 18, 5);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2, -37, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // sweet-spot angle bar (right side)
    const barX = W - 34;
    const barY = 64;
    const barH = H - 130;
    ctx.fillStyle = "rgba(2, 6, 23, 0.6)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, 16, barH, 8);
    ctx.fill();
    // green zone maps angle [0.5, 0.9] onto the bar
    const aToY = (a: number) => barY + barH - ((a + 0.35) / 1.65) * barH;
    ctx.fillStyle = "rgba(74, 222, 128, 0.55)";
    ctx.beginPath();
    ctx.roundRect(barX, aToY(0.9), 16, aToY(0.5) - aToY(0.9), 4);
    ctx.fill();
    ctx.fillStyle = g.inGreen ? "#4ade80" : "#f87171";
    ctx.fillRect(barX - 4, aToY(g.angle) - 2, 24, 4);
    ctx.font = "bold 10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(148,163,184,0.9)";
    ctx.fillText("ANGLE", barX + 8, barY - 8);
    if (g.inGreen) {
      ctx.fillStyle = "#4ade80";
      ctx.fillText(`×${g.mult.toFixed(1)}`, barX + 8, barY + barH + 16);
    }

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(244, 63, 94, ${Math.min(0.6, g.flash)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.font = "bold 40px serif";
      ctx.textAlign = "center";
      ctx.fillText("💥", W / 2, H / 2);
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

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setMult(1);
    setNewBest(false);
    dispScore.current = 0;
    dispMult.current = 1;
    holdRef.current = false;
    setReason("");
    setStatus("playing");
  }, []);

  const crash = useCallback(
    (reason: string) => {
      const g = gameRef.current;
      if (g.over) return;
      g.over = true;
      g.shake = 14;
      g.flash = 0.7;
      burst(g, BIKE_X + 30, GY - 30, 26, "#f43f5e", 220);
      burst(g, BIKE_X + 30, GY - 20, 14, "#e2e8f0", 160);
      const final = Math.floor(g.score);
      setScore(final);
      setMult(1);
      setReason(reason);
      setNewBest(submit(final));
      setStatus("over");
      draw();
    },
    [draw, submit],
  );

  const step = useCallback(
    (dt: number): boolean => {
      const g = gameRef.current;
      if (g.over) return true;

      g.speed = speedAt(g.dist);
      g.dist += g.speed * dt;
      g.wheelSpin += (g.speed / 13) * dt * 6;

      // spawn obstacles ahead
      if (g.nextSpawn - g.dist < W + 120) {
        const hard = g.dist > 2400;
        g.obstacles.push(makeObstacle(g.nextSpawn, hard));
        const gap = Math.random() * 160 + (hard ? 300 : 380);
        g.nextSpawn += gap + (hard ? 60 : 110);
      }
      while (g.obstacles.length && g.obstacles[0].x - g.dist < -200) {
        g.obstacles.shift();
      }

      // wheelie physics: throttle torque up, gravity torque down
      const target = holdRef.current ? 9.5 : -1.5;
      g.omega += (target - g.omega) * 3.2 * dt;
      g.omega -= 5.4 * dt; // gravity always pulls the nose down
      g.angle += g.omega * dt;

      if (g.angle > 1.12) {
        g.angle = 1.12;
        if (g.omega > 0) g.omega = 0;
        crash("tail scrape");
        return true;
      }
      if (g.angle < -0.3) {
        g.angle = -0.3;
        crash("nose dive");
        return true;
      }

      // sweet spot: multiplier climbs inside the green band
      g.inGreen = g.angle > 0.5 && g.angle < 0.9;
      if (g.inGreen) {
        g.mult = Math.min(6, g.mult + dt * 0.5);
      } else {
        g.mult = Math.max(1, g.mult - dt * 0.8);
      }
      g.score += (g.speed * dt * g.mult) / 10;

      // obstacle collisions (world-space: bike front wheel + body vs obstacle)
      const frontWX = g.dist + Math.cos(g.angle) * WB * 0.85;
      const rearWX = g.dist;
      for (const o of g.obstacles) {
        if (o.kind === "car") {
          const hitBand = o.x - 6 < rearWX && rearWX < o.x + o.w + 6;
          if (hitBand && g.angle < 0.42) {
            crash("clipped the car");
            return true;
          }
        } else if (o.kind === "gap") {
          const overGap = frontWX > o.x - 10 && rearWX < o.x + o.w + 10;
          if (overGap && g.angle < 0.34 && rearWX > o.x - 14) {
            crash("fell in the gap");
            return true;
          }
        } else {
          // sign: high front wheel smacks the board
          const underSign = frontWX > o.x - 8 && rearWX < o.x + o.w + 8;
          if (underSign && g.angle > 0.52) {
            crash("clipped the sign");
            return true;
          }
        }
      }

      // ground dust while wheelied
      if (g.inGreen && Math.random() < 0.5) {
        g.parts.push({
          x: BIKE_X - 8,
          y: GY - 4,
          vx: -40 - Math.random() * 60,
          vy: -Math.random() * 40,
          life: 0.4,
          max: 0.4,
          c: "rgba(148,163,184,0.5)",
        });
      }
      for (let i = g.parts.length - 1; i >= 0; i--) {
        const p = g.parts[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 300 * dt;
        if (p.life <= 0) g.parts.splice(i, 1);
      }
      if (g.shake > 0) g.shake = Math.max(0, g.shake - 30 * dt);
      if (g.flash > 0) g.flash = Math.max(0, g.flash - 2 * dt);

      const s = Math.floor(g.score);
      if (s !== dispScore.current) {
        dispScore.current = s;
        setScore(s);
      }
      const m = Math.round(g.mult * 10) / 10;
      if (m !== dispMult.current) {
        dispMult.current = m;
        setMult(m);
      }
      return false;
    },
    [crash],
  );

  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const done = step(dt);
      draw();
      if (!done) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, step, draw]);

  useEffect(() => {
    if (status !== "playing") draw();
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k !== "ArrowUp" && k !== "w" && k !== " ") return;
      if (status === "playing") {
        e.preventDefault();
        holdRef.current = true;
      } else {
        e.preventDefault();
        start();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === "ArrowUp" || k === "w" || k === " ") holdRef.current = false;
    };
    const onBlur = () => {
      holdRef.current = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [status, start]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (status !== "playing") {
      start();
      return;
    }
    holdRef.current = true;
  };
  const onPointerUp = () => {
    holdRef.current = false;
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-warn">
          Mult <b className="ml-1 text-sm text-ink">×{mult.toFixed(1)}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(45,212,191,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          aria-label="Wheelie Master bike course"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">WHEELIE MASTER</p>
            <p className="mt-2 text-sm text-muted">
              Hold Up to lift the front wheel. Keep it inside the green band of the
              angle bar — the multiplier climbs the longer you hold it. Scrape the
              tail or the nose and you&apos;re done.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Hold ↑ / W / Space (or hold the screen) · wheelie cars &amp; gaps ·
              drop it under the signs
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">WIPEOUT</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-muted">{reason}</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Points · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Get back on
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Front wheel down, dignity up · green band = multiplier · gaps and cars want a
        wheelie, signs want a duck
      </p>
    </div>
  );
}
