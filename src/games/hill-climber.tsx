"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 640;
const H = 360;
const STEP = 1000 / 60;
const TS = 8; // terrain sample spacing (px)
const BASE = 226; // resting ground line
const R = 13; // wheel radius
const WB = 27; // half wheelbase
const WHEEL_Y = 8; // wheel centre, below chassis origin
const GRAVITY = 900;
const K = 230; // suspension spring
const C = 7; // suspension damping
const J = 2400; // angular inertia
const DRIVE = 560;
const REVERSE = 260;
const START_X = 90;

type Status = "idle" | "playing" | "over";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
}

interface HillGame {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ang: number;
  angVel: number;
  wheelSpin: number;
  grounded: boolean;
  airTime: number;
  bonus: number;
  toast: string;
  toastT: number;
  shake: number;
  flash: number;
  parts: Particle[];
  heights: number[];
  slope: number;
  h: number;
  camY: number;
  alive: boolean;
}

function createGame(): HillGame {
  return {
    x: START_X,
    y: BASE - 46,
    vx: 0,
    vy: 0,
    ang: 0,
    angVel: 0,
    wheelSpin: 0,
    grounded: false,
    airTime: 0,
    bonus: 0,
    toast: "",
    toastT: 0,
    shake: 0,
    flash: 0,
    parts: [],
    heights: [],
    slope: 0,
    h: BASE,
    camY: BASE - H * 0.58,
    alive: true,
  };
}

/** Procedural hills: random-walk slope, gnarlier the further you go. */
function extendTerrain(g: HillGame, uptoX: number) {
  const need = Math.ceil(uptoX / TS) + 8;
  while (g.heights.length < need) {
    const x = g.heights.length * TS;
    const gnarly = 1 + Math.min(2, x / 20000);
    g.slope += (Math.random() - 0.5) * 1.25 * gnarly;
    g.slope += (BASE - g.h) * 0.0045;
    g.slope = Math.max(-9, Math.min(9, g.slope));
    g.h += g.slope;
    if (g.h < 74) {
      g.h = 74;
      g.slope = Math.max(0, g.slope);
    }
    if (g.h > 332) {
      g.h = 332;
      g.slope = Math.min(0, g.slope);
    }
    g.heights.push(g.h);
  }
}

function heightAt(g: HillGame, x: number): number {
  if (x < 0) return BASE;
  const f = x / TS;
  const i = Math.floor(f);
  const a = g.heights[i];
  const b = g.heights[i + 1];
  if (a === undefined || b === undefined) return BASE;
  const t = 0.5 - 0.5 * Math.cos(Math.PI * (f - i));
  return a + (b - a) * t;
}

export default function HillClimber({ gameId = "hill-climber" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<HillGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [airborne, setAirborne] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const inputRef = useRef({ gas: false, brake: false });
  const pointersRef = useRef(new Map<number, "gas" | "brake">());
  const lastScoreRef = useRef(-1);
  const lastAirRef = useRef(false);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const camX = g.x - W * 0.36;
    const sx = (Math.random() - 0.5) * g.shake;
    const sy = (Math.random() - 0.5) * g.shake;

    // dusk sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#2b1030");
    sky.addColorStop(0.55, "#7c2d12");
    sky.addColorStop(1, "#ea580c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // sun
    ctx.fillStyle = "rgba(253,224,71,0.85)";
    ctx.shadowColor = "#fde047";
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(W - 130 - camX * 0.02, 118, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // parallax dunes
    const dune = (factor: number, amp: number, baseY: number, color: string, phase: number) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let px = 0; px <= W; px += 16) {
        const wx = (px + camX * factor) * 0.006 + phase;
        ctx.lineTo(px, baseY + Math.sin(wx) * amp + Math.sin(wx * 2.3) * amp * 0.4);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    };
    dune(0.12, 26, 208, "rgba(120,53,15,0.55)", 0);
    dune(0.3, 34, 244, "rgba(69,26,3,0.85)", 2.4);

    ctx.save();
    ctx.translate(-camX + sx, -g.camY + sy);

    // terrain
    ctx.beginPath();
    ctx.moveTo(-40, H + 200);
    for (let px = -40; px <= camX + W + 40; px += 6) {
      ctx.lineTo(px, heightAt(g, px));
    }
    ctx.lineTo(camX + W + 40, H + 200);
    ctx.closePath();
    ctx.fillStyle = "#1c1408";
    ctx.fill();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#f59e0b";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let px = -40; px <= camX + W + 40; px += 6) {
      const py = heightAt(g, px);
      if (px === -40) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // distance flags every 250 px
    for (let d = 250; d < g.x + W; d += 250) {
      const fy = heightAt(g, d);
      ctx.strokeStyle = "rgba(250,204,21,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(d, fy);
      ctx.lineTo(d, fy - 22);
      ctx.stroke();
      ctx.fillStyle = "rgba(250,204,21,0.5)";
      ctx.fillRect(d, fy - 22, 12, 7);
    }

    // particles
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = "#fcd34d";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // car
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.ang);
    // suspension
    ctx.strokeStyle = "rgba(30,20,8,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-WB, -4);
    ctx.lineTo(-WB, WHEEL_Y);
    ctx.moveTo(WB, -4);
    ctx.lineTo(WB, WHEEL_Y);
    ctx.stroke();
    // body
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.roundRect(-34, -14, 68, 18, 6);
    ctx.fill();
    // cabin
    ctx.fillStyle = "#7c2d12";
    ctx.beginPath();
    ctx.roundRect(-16, -28, 30, 15, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(254,243,199,0.6)";
    ctx.fillRect(-12, -25, 22, 8);
    // wheels
    for (const ox of [-WB, WB]) {
      ctx.save();
      ctx.translate(ox, WHEEL_Y);
      ctx.rotate(g.wheelSpin);
      ctx.fillStyle = "#0c0a09";
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a8a29e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-R + 4, 0);
      ctx.lineTo(R - 4, 0);
      ctx.moveTo(0, -R + 4);
      ctx.lineTo(0, R - 4);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // air-time toast
    if (g.toastT > 0) {
      ctx.font = "bold 20px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(253,224,71,${Math.min(1, g.toastT * 2)})`;
      ctx.shadowColor = "#fde047";
      ctx.shadowBlur = 12;
      ctx.fillText(g.toast, g.x, g.y - 52 - (1 - Math.min(1, g.toastT * 2)) * 20);
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(244,63,94,${Math.min(0.6, g.flash)})`;
      ctx.fillRect(0, 0, W, H);
      if (!g.alive) {
        ctx.font = "52px serif";
        ctx.textAlign = "center";
        ctx.fillText("💥", W / 2, H / 2);
      }
    }
    void time;
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

  const crash = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;
    g.alive = false;
    g.shake = 16;
    g.flash = 0.85;
    const metres = Math.max(0, Math.floor((g.x - START_X) / 10));
    const final = metres + g.bonus;
    setScore(final);
    setNewBest(submit(final));
    setStatus("over");
    draw(performance.now());
  }, [draw, submit]);

  /** Advances one fixed frame. */
  const step = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;
    const dt = STEP / 1000;

    extendTerrain(g, g.x + 520);

    const gas = inputRef.current.gas;
    const brake = inputRef.current.brake;
    const throttle = gas ? 1 : brake ? -1 : 0;

    const cosA = Math.cos(g.ang);
    const sinA = Math.sin(g.ang);

    let fx = 0;
    let fy = 0;
    let tq = 0;
    let grounded = false;

    const wheels: Array<[number, boolean]> = [
      [-WB, true], // rear drives
      [WB, false],
    ];
    for (const [ox, isRear] of wheels) {
      const oy = WHEEL_Y;
      const rx = ox * cosA - oy * sinA;
      const ry = ox * sinA + oy * cosA;
      const wx = g.x + rx;
      const wy = g.y + ry;
      const pen = wy + R - heightAt(g, wx);
      if (pen <= 0) continue;
      grounded = true;
      const vpy = g.vy + g.angVel * rx;
      let aN = K * pen - C * vpy;
      if (aN < 0) aN = 0;
      fy -= aN;
      tq += rx * -aN;
      if (throttle !== 0 && isRear) {
        const drive = throttle > 0 ? DRIVE : REVERSE;
        const fwx = drive * cosA;
        const fwy = drive * sinA;
        fx += fwx;
        fy += fwy;
        tq += rx * fwy - ry * fwx;
      }
      // rolling resistance
      fx -= g.vx * 0.35;
    }

    if (!grounded) {
      // air control: gas = lean back, brake = lean forward
      g.angVel += (-throttle) * 2.6 * dt;
    }

    g.vy += GRAVITY * dt;
    g.vx += fx * dt;
    g.vy += fy * dt;
    g.angVel += (tq / J) * dt;
    g.angVel *= 1 - (grounded ? 4.2 : 0.5) * dt;
    g.vx = Math.max(-220, Math.min(540, g.vx));

    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.ang += g.angVel * dt;
    if (g.ang > Math.PI * 2 || g.ang < -Math.PI * 2) g.ang %= Math.PI * 2;
    g.wheelSpin += (g.vx / R) * dt;

    // airborne time → bonus on landing
    if (!grounded) {
      g.airTime += dt;
    } else if (g.airTime > 0.32) {
      const bonus = Math.round(g.airTime * 26);
      g.bonus += bonus;
      g.toast = `AIR ${g.airTime.toFixed(1)}s +${bonus}`;
      g.toastT = 1.4;
      g.shake = Math.max(g.shake, 5);
    }
    if (grounded && g.airTime > 0) g.airTime = 0;

    const total = Math.max(0, Math.floor((g.x - START_X) / 10)) + g.bonus;
    if (total !== lastScoreRef.current) {
      lastScoreRef.current = total;
      setScore(total);
    }
    const isAir = !grounded;
    if (isAir !== lastAirRef.current) {
      lastAirRef.current = isAir;
      setAirborne(isAir);
    }

    // dust
    if (grounded && Math.abs(g.vx) > 70 && Math.random() < 0.5) {
      const rx2 = -WB * cosA - WHEEL_Y * sinA;
      g.parts.push({
        x: g.x + rx2,
        y: heightAt(g, g.x + rx2) - 2,
        vx: -g.vx * 0.25 + (Math.random() - 0.5) * 40,
        vy: -30 - Math.random() * 40,
        life: 0.6,
        max: 0.6,
        r: 2 + Math.random() * 2.5,
      });
    }
    for (let i = 0; i < g.parts.length; i++) {
      const p = g.parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      p.life -= dt;
    }
    if (g.parts.length > 120) g.parts.splice(0, g.parts.length - 120);
    g.parts = g.parts.filter((p) => p.life > 0);

    g.toastT = Math.max(0, g.toastT - dt);
    g.shake = Math.max(0, g.shake - 0.6);
    g.flash = Math.max(0, g.flash - 0.03);

    // roof touches ground → flipped
    const ca = Math.cos(g.ang);
    const sa = Math.sin(g.ang);
    const roofX = g.x + (0 * ca - -24 * sa);
    const roofY = g.y + (0 * sa + -24 * ca);
    if (roofY + 3 > heightAt(g, roofX)) {
      crash();
      return;
    }

    // fell off the world (shouldn't happen, but stay safe)
    if (g.y > 900) crash();

    // camera
    const targetY = g.y - H * 0.58;
    g.camY += (targetY - g.camY) * 0.1;
  }, [crash]);

  const start = useCallback(() => {
    gameRef.current = createGame();
    extendTerrain(gameRef.current, 900);
    inputRef.current.gas = false;
    inputRef.current.brake = false;
    pointersRef.current.clear();
    setScore(0);
    setAirborne(false);
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
      draw(t);
      const g = gameRef.current;
      if (g && !g.alive) return;
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, step, draw]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const MAP: Record<string, "gas" | "brake"> = {
      ArrowRight: "gas",
      d: "gas",
      ArrowLeft: "brake",
      a: "brake",
    };
    const sync = () => {
      // keep touch + keyboard independent: recompute from pointer map,
      // then OR in keyboard state held in the same ref pair
      const p = pointersRef.current;
      let gas = false;
      let brake = false;
      p.forEach((side) => {
        if (side === "gas") gas = true;
        else brake = true;
      });
      inputRef.current.gas = gas || keyRef.gas;
      inputRef.current.brake = brake || keyRef.brake;
    };
    const keyRef = { gas: false, brake: false };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const side = MAP[k];
      if (side) {
        e.preventDefault();
        keyRef[side] = true;
        sync();
        return;
      }
      if (k === " " || k === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const side = MAP[k];
      if (side) {
        keyRef[side] = false;
        sync();
      }
    };
    const onBlur = () => {
      keyRef.gas = false;
      keyRef.brake = false;
      sync();
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
    e.preventDefault();
    if (status !== "playing") {
      start();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const side = e.clientX - rect.left < rect.width / 2 ? "brake" : "gas";
    pointersRef.current.set(e.pointerId, side);
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointersRef.current;
    let gas = false;
    let brake = false;
    p.forEach((s) => (s === "gas" ? (gas = true) : (brake = true)));
    inputRef.current.gas = gas;
    inputRef.current.brake = brake;
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    const p = pointersRef.current;
    let gas = false;
    let brake = false;
    p.forEach((s) => (s === "gas" ? (gas = true) : (brake = true)));
    inputRef.current.gas = gas;
    inputRef.current.brake = brake;
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[680px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className={airborne ? "text-warn" : "text-muted"}>
          Airborne{" "}
          <b className="ml-1 text-sm text-ink">{airborne ? "yes" : "no"}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(249,115,22,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full [touch-action:none]"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          aria-label="Hill Climb side-view driving game"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">HILL CLIMB</p>
            <p className="mt-2 text-sm text-muted">
              Gas over endless procedural hills. Land your jumps clean — flip the
              roof onto the dirt and the run is done.
            </p>
            <PrimaryButton onClick={start} tone="from-yellow-400 via-amber-500 to-orange-600">
              Start engine
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              → / D gas · ← / A brake-lean · hold a screen half on touch
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">FLIPPED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-fever uppercase tracking-widest text-warn">
                ✦ New best distance!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Metres + air bonus · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-yellow-400 via-amber-500 to-orange-600">
              Drive again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        → gas · ← brake · in the air gas leans back and brake leans forward ·
        big air pays bonus points
      </p>
    </div>
  );
}
