"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 640;
const H = 480;
const STEP = 1000 / 60;
const TAU = Math.PI * 2;

const GBASE = 344; // baseline screen-y of the terrain
const WB = 86; // wheelbase
const WR = 20; // wheel radius
const GRAV = 980;
const START_X = 120;

type Status = "idle" | "playing" | "over";

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  c: string;
  r: number;
}

interface G {
  x: number;
  y: number;
  vy: number;
  a: number;
  vx: number;
  air: boolean;
  airT: number;
  wheelSpin: number;
  bonus: number;
  parts: Part[];
  crushed: Record<string, boolean>;
  shake: number;
  flash: number;
  toast: string;
  toastT: number;
  hudAcc: number;
  lastScore: number;
  alive: boolean;
}

/* ---------------- terrain ---------------- */

function sines(x: number) {
  return (
    62 * Math.sin(x * 0.0018) +
    34 * Math.sin(x * 0.0009 + 2.1) +
    18 * Math.sin(x * 0.0035 + 0.7)
  );
}

/** triangular jump ramps layered on the rolling hills */
function rampAt(x: number) {
  const k0 = Math.floor((x - 620) / 760);
  let d = 0;
  for (let k = k0; k <= k0 + 1; k++) {
    if (k < 0) continue;
    const cx = 620 + k * 760 + (k % 3) * 60;
    const w = 130 + (k % 2) * 50;
    const h = 52 + (k % 4) * 14;
    const dx = Math.abs(x - cx);
    if (dx < w) d += h * (1 - dx / w);
  }
  return d;
}

function terrainY(x: number) {
  return GBASE - sines(x) - rampAt(x);
}

/** parked cars waiting to be crushed */
function carSpots(k: number) {
  const base = 560 + k * 540;
  const n = 1 + ((k * 7) % 3);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(base + i * 50);
  return out;
}

const CAR_COLORS = ["#7dd3fc", "#fda4af", "#c4b5fd", "#86efac", "#fcd34d", "#fdba74"];

function createGame(): G {
  return {
    x: START_X,
    y: terrainY(START_X) - WR,
    vy: 0,
    a: 0,
    vx: 0,
    air: false,
    airT: 0,
    wheelSpin: 0,
    bonus: 0,
    parts: [],
    crushed: {},
    shake: 0,
    flash: 0,
    toast: "",
    toastT: 0,
    hudAcc: 0,
    lastScore: 0,
    alive: true,
  };
}

/* ---------------- drawing helpers ---------------- */

function drawTruck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: number,
  spin: number,
  t: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);

  // chassis shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, WR + 6, 46, 7, 0, 0, TAU);
  ctx.fill();

  // suspension arms
  ctx.strokeStyle = "#57534e";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-WB / 2, 2);
  ctx.lineTo(-WB / 2 + 12, -12);
  ctx.moveTo(WB / 2, 2);
  ctx.lineTo(WB / 2 - 12, -12);
  ctx.stroke();

  // body
  ctx.fillStyle = "#ea580c";
  ctx.beginPath();
  ctx.roundRect(-42, -34, 84, 26, 7);
  ctx.fill();
  ctx.fillStyle = "#9a3412";
  ctx.beginPath();
  ctx.roundRect(-30, -48, 40, 18, 6);
  ctx.fill();
  // window
  ctx.fillStyle = "rgba(186,230,253,0.85)";
  ctx.beginPath();
  ctx.roundRect(-26, -45, 28, 12, 4);
  ctx.fill();
  // stripe + lights
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(-42, -24, 84, 4);
  ctx.fillStyle = "#fef08a";
  ctx.fillRect(38, -30, 5, 7);
  ctx.fillRect(38, -18, 5, 7);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(-43, -30, 4, 7);
  ctx.fillRect(-43, -18, 4, 7);
  // idle rumble
  const rumble = Math.sin(t * 0.02) * 0.8;
  ctx.translate(0, rumble);

  ctx.restore();

  // wheels (drawn unrotated-ly positioned but spinning)
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(x + Math.cos(a) * (WB / 2) * s, y + Math.sin(a) * (WB / 2) * s);
    ctx.fillStyle = "#111114";
    ctx.beginPath();
    ctx.arc(0, 0, WR, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#3f3f46";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, WR - 4, 0, TAU);
    ctx.stroke();
    // tread spokes
    ctx.strokeStyle = "#78716c";
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) {
      const ang = spin + (i * TAU) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 4, Math.sin(ang) * 4);
      ctx.lineTo(Math.cos(ang) * (WR - 5), Math.sin(ang) * (WR - 5));
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawParkedCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  crushed: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 3, crushed ? 26 : 20, crushed ? 4 : 5, 0, 0, TAU);
  ctx.fill();
  const h = crushed ? 7 : 15;
  ctx.fillStyle = crushed ? "#4b5563" : color;
  ctx.beginPath();
  ctx.roundRect(-24, -h, 48, h, crushed ? 2 : 4);
  ctx.fill();
  if (!crushed) {
    ctx.fillStyle = "rgba(15,23,42,0.75)";
    ctx.beginPath();
    ctx.roundRect(-12, -h - 9, 22, 10, 3);
    ctx.fill();
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(-14, -h, 10, 4);
    ctx.fillRect(6, -h + 2, 9, 3);
  }
  ctx.restore();
}

/* ---------------- component ---------------- */

export default function MonsterRamp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<G | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("monster-ramp", "high");
  const inputRef = useRef({ gas: false, brake: false });

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    const camX = g.x - 168;

    /* sky */
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#3b0a12");
    sky.addColorStop(0.55, "#7c2d12");
    sky.addColorStop(1, "#f59e0b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // sun
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.arc(W - 110, 96, 34, 0, TAU);
    ctx.fill();
    ctx.restore();

    /* parallax ridges */
    for (let layer = 0; layer < 2; layer++) {
      const par = layer === 0 ? 0.28 : 0.55;
      const base = layer === 0 ? 250 : 300;
      const amp = layer === 0 ? 44 : 60;
      const col = layer === 0 ? "#78350f" : "#5b2508";
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let sx = 0; sx <= W; sx += 10) {
        const wx = camX * par + sx;
        const y = base - amp * Math.sin(wx * 0.004) - amp * 0.5 * Math.sin(wx * 0.009 + 1.1);
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }

    /* terrain */
    const shake = g.shake;
    ctx.save();
    ctx.translate(Math.sin(time * 0.013) * shake, Math.cos(time * 0.017) * shake);
    ctx.fillStyle = "#3f2716";
    ctx.beginPath();
    ctx.moveTo(-10, H + 10);
    for (let sx = -10; sx <= W + 10; sx += 7) {
      ctx.lineTo(sx, terrainY(camX + sx));
    }
    ctx.lineTo(W + 10, H + 10);
    ctx.closePath();
    ctx.fill();
    // grass line
    ctx.strokeStyle = "#65a30d";
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let sx = -10; sx <= W + 10; sx += 7) {
      const y = terrainY(camX + sx);
      if (sx === -10) ctx.moveTo(sx, y);
      else ctx.lineTo(sx, y);
    }
    ctx.stroke();

    /* parked cars */
    const k0 = Math.floor((camX - 620) / 540);
    for (let k = Math.max(0, k0); k <= k0 + 4; k++) {
      const spots = carSpots(k);
      for (let i = 0; i < spots.length; i++) {
        const sx = spots[i] - camX;
        if (sx < -60 || sx > W + 60) continue;
        const key = `${k}-${i}`;
        drawParkedCar(
          ctx,
          sx,
          terrainY(spots[i]),
          CAR_COLORS[(k + i) % CAR_COLORS.length],
          g.crushed[key] === true,
        );
      }
    }

    /* particles */
    for (const pt of g.parts) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.c;
      ctx.beginPath();
      ctx.arc(pt.x - camX, pt.y, pt.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* truck */
    drawTruck(ctx, g.x - camX, g.y, g.a, g.wheelSpin, time);

    ctx.restore();

    /* air / hang-time readout */
    if (g.air && g.airT > 0.35) {
      ctx.textAlign = "center";
      ctx.font = "bold 15px ui-monospace, monospace";
      ctx.fillStyle = "#fde68a";
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 12;
      ctx.fillText(`${g.airT.toFixed(1)}s AIR`, W / 2, 54);
      ctx.shadowBlur = 0;
      ctx.textAlign = "left";
    }

    /* speed strip */
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.roundRect(W - 118, H - 40, 102, 26, 8);
    ctx.fill();
    ctx.font = "bold 11px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = "#fed7aa";
    ctx.fillText(`${Math.round(g.vx * 0.34)} KM/H`, W - 28, H - 22);
    ctx.textAlign = "left";

    /* toast */
    if (g.toastT > 0) {
      const a = Math.min(1, g.toastT * 2);
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.font = "bold 22px ui-monospace, monospace";
      ctx.fillStyle = "#fef08a";
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 16;
      ctx.fillText(g.toast, W / 2, 104 - (1 - a) * 10);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    }

    /* crash flash */
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(244,63,94,${Math.min(0.55, g.flash * 0.55)})`;
      ctx.fillRect(0, 0, W, H);
      if (!g.alive) {
        ctx.font = "54px serif";
        ctx.textAlign = "center";
        ctx.fillText("💥", W / 2, H / 2);
        ctx.textAlign = "left";
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

  /* ---------------- transitions ---------------- */

  const gameOver = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;
    g.alive = false;
    g.shake = 16;
    g.flash = 1;
    for (let i = 0; i < 30; i++) {
      const ang = Math.random() * TAU;
      const sp = 60 + Math.random() * 260;
      g.parts.push({
        x: g.x,
        y: g.y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 60,
        life: 0.6 + Math.random() * 0.7,
        max: 1.3,
        c: i % 3 === 0 ? "#fbbf24" : "#f97316",
        r: 2 + Math.random() * 3.5,
      });
    }
    const final = Math.max(0, Math.floor((g.x - START_X) / 12) + g.bonus);
    setScore(final);
    setNewBest(submit(final));
    setStatus("over");
    draw(performance.now());
  }, [draw, submit]);

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  // main loop — all mutable game logic runs inline here (react-compiler safe)
  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      const frame = Math.min(t - last, 250);
      last = t;
      acc += frame;
      while (acc >= STEP) {
        acc -= STEP;
        const g = gameRef.current;
        if (!g || !g.alive) break;
        const dt = STEP / 1000;
        const k = inputRef.current;

        /* throttle */
        if (k.gas) g.vx += 300 * dt;
        if (k.brake) g.vx -= 380 * dt;
        if (!k.gas && !k.brake) g.vx -= g.vx * 0.5 * dt;
        if (g.vx < -70) g.vx = -70;
        if (g.vx > 430) g.vx = 430;
        g.x += g.vx * dt;
        if (g.x < START_X) g.x = START_X;
        g.wheelSpin += (g.vx / WR) * dt;

        /* terrain sample at both wheels */
        const yF = terrainY(g.x + WB / 2) + WR;
        const yR = terrainY(g.x - WB / 2) + WR;
        const support = (yF + yR) / 2;
        const slopeA = Math.atan2(yF - yR, WB);

        if (g.air) {
          g.vy += GRAV * dt;
          g.y += g.vy * dt;
          const lean = (k.gas ? 1 : 0) - (k.brake ? 1 : 0);
          g.a += lean * 2.6 * dt;
          g.airT += dt;
          if (g.y >= support && g.vy > 0) {
            let da = g.a - slopeA;
            while (da > Math.PI) da -= TAU;
            while (da < -Math.PI) da += TAU;
            if (Math.abs(da) > 0.62) {
              gameOver();
              break;
            }
            g.air = false;
            g.y = support;
            g.vy = 0;
            g.shake = Math.max(g.shake, 6);
            // dust on touchdown
            for (let s = 0; s < 10; s++) {
              g.parts.push({
                x: g.x + (Math.random() - 0.5) * 50,
                y: support + 4,
                vx: (Math.random() - 0.5) * 190,
                vy: -30 - Math.random() * 90,
                life: 0.45,
                max: 0.45,
                c: "rgba(180,140,90,0.8)",
                r: 2 + Math.random() * 3,
              });
            }
            if (g.airT > 0.5) {
              const airBonus = Math.round(g.airT * 26);
              g.bonus += airBonus;
              g.toast = `AIR ${g.airT.toFixed(1)}s  +${airBonus}`;
              g.toastT = 1.3;
            }
            g.airT = 0;
            // settle onto the slope so the next frame doesn't re-trigger
            g.a += (slopeA - g.a) * 0.6;
          }
        } else {
          const dropRate = (support - g.y) / dt;
          g.y = support;
          g.a += (slopeA - g.a) * Math.min(1, 20 * dt);
          if (dropRate > 320 && g.vx > 55) {
            g.air = true;
            g.vy = dropRate * 0.7;
            g.airT = 0;
          }
        }

        /* crush parked cars */
        const kc = Math.floor((g.x - 620) / 540);
        for (let kk = Math.max(0, kc - 1); kk <= kc + 1; kk++) {
          const spots = carSpots(kk);
          for (let i = 0; i < spots.length; i++) {
            const key = `${kk}-${i}`;
            if (g.crushed[key]) continue;
            const cx = spots[i];
            if (Math.abs(cx - g.x) > 30) continue;
            const cy = terrainY(cx);
            if (Math.abs(g.y - cy) > 44) continue;
            g.crushed[key] = true;
            g.bonus += 18;
            g.toast = "CRUSH  +18";
            g.toastT = 1.1;
            g.shake = Math.max(g.shake, 7);
            g.flash = Math.max(g.flash, 0.35);
            for (let s = 0; s < 16; s++) {
              const ang = Math.random() * TAU;
              const sp = 50 + Math.random() * 210;
              g.parts.push({
                x: cx,
                y: cy - 8,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp - 70,
                life: 0.5 + Math.random() * 0.5,
                max: 1,
                c: s % 3 === 0 ? "#94a3b8" : "#f97316",
                r: 1.5 + Math.random() * 3,
              });
            }
          }
        }

        /* particles + decay */
        for (const pt of g.parts) {
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.vy += 150 * dt;
          pt.life -= dt;
        }
        if (g.parts.length > 180) g.parts.splice(0, g.parts.length - 180);
        g.parts = g.parts.filter((pt) => pt.life > 0);
        // engine smoke while moving
        if (g.vx > 40 && Math.random() < 0.4) {
          g.parts.push({
            x: g.x - 44,
            y: g.y - 26,
            vx: -30 - Math.random() * 40,
            vy: -14 - Math.random() * 26,
            life: 0.55,
            max: 0.55,
            c: "rgba(63,63,70,0.7)",
            r: 2 + Math.random() * 3,
          });
        }
        g.shake = Math.max(0, g.shake - 0.4);
        g.flash = Math.max(0, g.flash - dt * 1.9);
        g.toastT = Math.max(0, g.toastT - dt);

        /* throttled HUD sync */
        g.hudAcc += STEP;
        if (g.hudAcc >= 90) {
          g.hudAcc = 0;
          const s = Math.max(0, Math.floor((g.x - START_X) / 12) + g.bonus);
          if (s !== g.lastScore) {
            g.lastScore = s;
            setScore(s);
          }
        }
      }
      draw(t);
      const g = gameRef.current;
      if (g && !g.alive) return;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, gameOver]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const set = (code: string, v: boolean) => {
      const k = inputRef.current;
      if (code === "ArrowRight" || code === "KeyD") k.gas = v;
      if (code === "ArrowLeft" || code === "KeyA") k.brake = v;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      if ((e.code === "Space" || e.code === "Enter") && status !== "playing") {
        start();
        return;
      }
      set(e.code, true);
    };
    const onKeyUp = (e: KeyboardEvent) => set(e.code, false);
    const onBlur = () => {
      inputRef.current.gas = false;
      inputRef.current.brake = false;
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

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "playing") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const right = e.clientX - rect.left >= rect.width / 2;
    if (right) inputRef.current.gas = true;
    else inputRef.current.brake = true;
  };
  const clearPointer = () => {
    inputRef.current.gas = false;
    inputRef.current.brake = false;
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[680px]">
      <GameHud score={score} best={best ?? "—"} />

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(234,88,12,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerUp={clearPointer}
          onPointerCancel={clearPointer}
          onPointerLeave={clearPointer}
          aria-label="Monster Ramp off-road trucking"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">MONSTER RAMP</p>
            <p className="mt-2 text-sm text-muted">
              A monster truck with two axles and no sympathy. Launch off the ramps, hold
              the nose level in the air, and land on the parked cars instead of on the
              roof.
            </p>
            <PrimaryButton onClick={start} tone="from-orange-500 via-red-500 to-rose-600">
              Fire it up
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              → gas · ← brake &amp; tilt back · touch right / left half · land flat
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">ROLLED IT</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {score} pts · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-orange-500 via-red-500 to-rose-600">
              Flip it back over
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Space / Enter to retry</p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Air time pays · parked cars pay more · a bad landing angle ends the run
      </p>
    </div>
  );
}
