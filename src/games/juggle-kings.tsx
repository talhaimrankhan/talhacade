"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 560;
const TAU = Math.PI * 2;
const TONE = "from-lime-400 via-emerald-500 to-teal-600";
const CX = W / 2;
const GROUND_Y = 500;
const PX = W / 2; // player x
const BR = 15; // ball radius
const GRAV = 1150;
const BASE_KICK = 720;
const CLOCK0 = 60;
const SWEET_LO = 84;
const SWEET_HI = 190;
const SWEET_DX = 74;

type Status = "idle" | "playing" | "over";
type Part3 = "foot" | "thigh" | "head";

const PART_COL: Record<Part3, string> = {
  foot: "#a3e635",
  thigh: "#34d399",
  head: "#22d3ee",
};
const PART_LABEL: Record<Part3, string> = {
  foot: "FOOT",
  thigh: "THIGH",
  head: "HEAD",
};

interface Pt {
  x: number;
  y: number;
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
interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
}

interface Game {
  ball: Pt & { vx: number; vy: number };
  clock: number;
  touches: number;
  flair: number;
  seq: Part3[];
  kickT: number;
  kickPart: Part3;
  kickUp: boolean;
  trail: Pt[];
  earlyT: number;
  parts: Particle[];
  floats: Floater[];
  shake: number;
  flash: number;
  over: boolean;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
}

function burst(g: Game, x: number, y: number, c: string, n: number, power: number): void {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * TAU;
    const sp = power * (0.35 + Math.random() * 0.65);
    g.parts.push({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: 0.35 + Math.random() * 0.4,
      max: 0.75,
      r: 1.4 + Math.random() * 2.2,
      c,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, c: string): void {
  g.floats.push({ x, y, text, life: 1, c });
}

function createGame(): Game {
  return {
    ball: { x: CX, y: GROUND_Y - 214, vx: 0, vy: -60 },
    clock: CLOCK0,
    touches: 0,
    flair: 0,
    seq: [],
    kickT: 0,
    kickPart: "foot",
    kickUp: false,
    trail: [],
    earlyT: 0,
    parts: [],
    floats: [],
    shake: 0,
    flash: 0,
    over: false,
  };
}

function scaleFor(touches: number): number {
  return Math.max(0.66, 1 - Math.floor(touches / 10) * 0.055);
}

function partFor(h: number): Part3 {
  if (h < 112) return "foot";
  if (h < 168) return "thigh";
  return "head";
}

function doTouch(g: Game): void {
  if (g.over) return;
  const b = g.ball;
  if (b.vy < -70) {
    // still rising — can't juggle a ball you just launched
    if (g.earlyT <= 0) {
      floater(g, b.x, b.y - 26, "TOO EARLY", "#64748b");
      g.earlyT = 0.5;
    }
    return;
  }

  const h = GROUND_Y - b.y;
  const dx = Math.abs(b.x - PX);
  const part = partFor(h);
  const scale = scaleFor(g.touches);
  g.touches += 1;
  g.kickT = 0.26;
  g.kickPart = part;
  g.kickUp = dx < SWEET_DX;

  if (h < 56) {
    // toe poke off the turf — kills the style run
    b.vy = -BASE_KICK * 0.62 * scale;
    b.vx += (b.x < PX ? -1 : 1) * 150;
    g.seq = [];
    g.shake = Math.max(g.shake, 4);
    burst(g, b.x, GROUND_Y - 4, "#78350f", 10, 130);
    floater(g, b.x, b.y - 28, "STUMBLE · STYLE RESET", "#fbbf24");
    return;
  }

  if (h >= SWEET_LO && h <= SWEET_HI && dx < SWEET_DX) {
    b.vy = -BASE_KICK * scale;
    b.vx = Math.max(-190, Math.min(190, (PX - b.x) * 2.4));
    const c = PART_COL[part];
    burst(g, b.x, b.y + BR, c, 14, 170);
    floater(g, b.x, b.y - 28, `+1 ${PART_LABEL[part]}`, c);
    g.flash = 0.22;
    g.seq.push(part);
    const n = g.seq.length;
    if (
      n >= 3 &&
      g.seq[n - 1] !== g.seq[n - 2] &&
      g.seq[n - 2] !== g.seq[n - 3] &&
      g.seq[n - 1] !== g.seq[n - 3]
    ) {
      g.flair += 1;
      g.touches += 1;
      g.seq = [];
      floater(g, b.x, b.y - 50, "FLAIR +1", "#fde68a");
      burst(g, b.x, b.y, "#fde68a", 18, 210);
    }
    return;
  }

  // edge of the sweet spot — keeps the run alive but kicks it sideways
  b.vy = -BASE_KICK * 0.82 * scale;
  b.vx += (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 90);
  burst(g, b.x, b.y + BR, "#facc15", 8, 120);
  floater(g, b.x, b.y - 28, "WOBBLE", "#fde68a");
}

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt * 1.7);
  if (g.earlyT > 0) g.earlyT = Math.max(0, g.earlyT - dt);
  if (g.kickT > 0) g.kickT = Math.max(0, g.kickT - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 320 * dt;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.15;
    f.y -= 28 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (g.over) return;

  g.clock = Math.max(0, g.clock - dt);

  const b = g.ball;
  b.vy += GRAV * dt;
  b.vx *= Math.exp(-0.55 * dt);
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // soft side rails keep the duel fair
  if (b.x < 40 + BR) {
    b.x = 40 + BR;
    b.vx = Math.abs(b.vx) * 0.55;
  } else if (b.x > W - 40 - BR) {
    b.x = W - 40 - BR;
    b.vx = -Math.abs(b.vx) * 0.55;
  }

  g.trail.push({ x: b.x, y: b.y });
  if (g.trail.length > 14) g.trail.shift();

  if (b.y + BR >= GROUND_Y) {
    b.y = GROUND_Y - BR;
    g.over = true;
    g.shake = 12;
    g.flash = 0.5;
    burst(g, b.x, GROUND_Y - 4, "#a3e635", 26, 240);
    floater(g, b.x, GROUND_Y - 40, "DROPPED!", "#f43f5e");
    return;
  }

  if (g.clock <= 0) {
    g.over = true;
    g.flash = 0.45;
    burst(g, CX, 240, "#a3e635", 30, 260);
  }
}

/* ------------------------------ render ------------------------------ */

function drawPlayer(ctx: CanvasRenderingContext2D, g: Game, time: number): void {
  const bob = Math.sin(time / 420) * 1.5;
  const main = "#a3e635";
  const trim = "#065f46";
  const kick = g.kickT > 0 ? Math.sin((1 - g.kickT / 0.26) * Math.PI) : 0;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(PX, GROUND_Y + 4, 26, 7, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(PX, GROUND_Y + bob);

  // legs
  ctx.strokeStyle = trim;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, -40);
  ctx.lineTo(-9, -2);
  ctx.moveTo(6, -40);
  ctx.lineTo(10, -2);
  ctx.stroke();

  // kicking leg
  if (g.kickUp) {
    const reach = kick * (g.kickPart === "foot" ? 34 : g.kickPart === "thigh" ? 22 : 6);
    ctx.strokeStyle = main;
    ctx.beginPath();
    ctx.moveTo(4, -40);
    ctx.lineTo(10 + reach, -34 + (g.kickPart === "head" ? -kick * 10 : kick * 6));
    ctx.stroke();
  }

  // torso
  ctx.save();
  ctx.shadowColor = hexA(main, 0.6);
  ctx.shadowBlur = 14;
  ctx.fillStyle = main;
  ctx.beginPath();
  ctx.roundRect(-11, -84, 22, 46, 8);
  ctx.fill();
  ctx.restore();

  // arms
  ctx.strokeStyle = main;
  ctx.lineWidth = 6;
  const armLift = g.kickUp ? kick * 14 : 0;
  ctx.beginPath();
  ctx.moveTo(-9, -74);
  ctx.lineTo(-20, -52 - armLift);
  ctx.moveTo(9, -74);
  ctx.lineTo(20, -52 - armLift);
  ctx.stroke();

  // head
  ctx.save();
  ctx.shadowColor = hexA(main, 0.8);
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#d9f99d";
  ctx.beginPath();
  ctx.arc(0, -97, 12, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#052e16";
  ctx.beginPath();
  ctx.arc(5, -98, 1.8, 0, TAU);
  ctx.fill();

  ctx.restore();

  // zone ladder — the lime band is the sweet spot for clean touches
  if (!g.over) {
    ctx.fillStyle = "rgba(163, 230, 53, 0.15)";
    ctx.fillRect(PX + 33, GROUND_Y - SWEET_HI, 10, SWEET_HI - SWEET_LO);
    ctx.strokeStyle = "rgba(163, 230, 53, 0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(PX + 33, GROUND_Y - SWEET_HI, 10, SWEET_HI - SWEET_LO);
    ctx.fillStyle = "rgba(148, 163, 184, 0.09)";
    ctx.fillRect(PX + 33, GROUND_Y - SWEET_LO, 10, SWEET_LO - 40);
    ctx.fillRect(PX + 33, GROUND_Y - 280, 10, 280 - SWEET_HI);
  }
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  // arena
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#08130c");
  bg.addColorStop(0.6, "#0a1a10");
  bg.addColorStop(1, "#061009");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // flood lights
  const spot = ctx.createRadialGradient(CX, 120, 40, CX, 120, 380);
  spot.addColorStop(0, "rgba(163, 230, 53, 0.10)");
  spot.addColorStop(1, "rgba(163, 230, 53, 0)");
  ctx.fillStyle = spot;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // pitch stripes
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(34, 197, 94, 0.05)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(40 + i * 38, 40, 38, GROUND_Y - 40);
  }
  // rails
  ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(38, 44);
  ctx.lineTo(38, GROUND_Y);
  ctx.moveTo(W - 38, 44);
  ctx.lineTo(W - 38, GROUND_Y);
  ctx.stroke();

  // turf
  ctx.fillStyle = "rgba(20, 83, 45, 0.55)";
  ctx.fillRect(38, GROUND_Y, W - 76, H - GROUND_Y);
  ctx.strokeStyle = "rgba(134, 239, 172, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(38, GROUND_Y);
  ctx.lineTo(W - 38, GROUND_Y);
  ctx.stroke();

  if (g) {
    drawPlayer(ctx, g, time);

    // trail
    for (let i = 0; i < g.trail.length; i++) {
      const t = g.trail[i];
      const k = i / g.trail.length;
      ctx.fillStyle = `rgba(254, 249, 195, ${0.05 + k * 0.3})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, BR * (0.4 + k * 0.6), 0, TAU);
      ctx.fill();
    }

    // ball
    const b = g.ball;
    ctx.save();
    ctx.shadowColor = "rgba(253, 224, 71, 0.9)";
    ctx.shadowBlur = 18;
    const grd = ctx.createRadialGradient(b.x - 4, b.y - 5, 2, b.x, b.y, BR);
    grd.addColorStop(0, "#fef9c3");
    grd.addColorStop(1, "#a16207");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BR, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(120, 53, 15, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BR, 0.4, 2.2);
    ctx.stroke();

    // particles
    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // clock bar
    const frac = g.clock / CLOCK0;
    const urgent = g.clock <= 10;
    ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
    ctx.beginPath();
    ctx.roundRect(40, 16, W - 80, 16, 8);
    ctx.fill();
    ctx.fillStyle =
      urgent && Math.floor(time / 300) % 2 === 0 ? "#f43f5e" : frac > 0.3 ? "#a3e635" : "#facc15";
    ctx.beginPath();
    ctx.roundRect(42, 18, Math.max(0, (W - 84) * frac), 12, 6);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.font = "800 11px ui-monospace, monospace";
    ctx.fillStyle = "#052e16";
    ctx.fillText(`${Math.ceil(g.clock)}s`, W / 2, 29);

    // big counter
    ctx.font = "800 44px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(163, 230, 53, 0.8)";
    ctx.shadowBlur = 16;
    ctx.fillText(String(g.touches), W / 2, 96);
    ctx.shadowBlur = 0;
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillStyle = "rgba(190, 242, 100, 0.9)";
    ctx.fillText("TOUCHES", W / 2, 112);

    // next-part readout
    if (!g.over) {
      const h = GROUND_Y - b.y;
      const part = partFor(h);
      const inSweet = h >= SWEET_LO && h <= SWEET_HI && Math.abs(b.x - PX) < SWEET_DX;
      ctx.font = "800 12px ui-monospace, monospace";
      ctx.fillStyle = inSweet ? PART_COL[part] : "rgba(148, 163, 184, 0.8)";
      ctx.fillText(`${PART_LABEL[part]} ZONE${inSweet ? " ✓" : ""}`, W / 2, H - 14);
      ctx.font = "600 10px ui-monospace, monospace";
      ctx.fillStyle = "rgba(148, 163, 184, 0.65)";
      ctx.fillText(`REACH ${Math.round(Math.max(0, h))}`, W / 2, H - 2);
    }

    // style strip
    ctx.textAlign = "left";
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
    ctx.fillText(`FLAIR ${g.flair}`, 44, 56);
    const seq = g.seq.slice(-3);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = seq[i] ? PART_COL[seq[i]] : "rgba(148, 163, 184, 0.2)";
      ctx.beginPath();
      ctx.arc(100 + i * 14, 52, 4.5, 0, TAU);
      ctx.fill();
    }
    ctx.textAlign = "center";

    // floaters
    ctx.font = "800 15px ui-monospace, monospace";
    for (const f of g.floats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // shrinking-height note
    const tier = Math.floor(g.touches / 10);
    if (tier > 0 && g.clock > 0) {
      ctx.font = "600 10px ui-monospace, monospace";
      ctx.fillStyle = "rgba(134, 239, 172, 0.75)";
      ctx.fillText(`HEIGHT TIER ${tier} — pop is ${Math.round((1 - scaleFor(g.touches)) * 100)}% lower`, W / 2, 132);
    }

    if (g.flash > 0.01) {
      ctx.fillStyle = `rgba(253, 224, 71, ${g.flash * 0.25})`;
      ctx.fillRect(-14, -14, W + 28, H + 28);
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function JuggleKings({ gameId = "juggle-kings" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [touches, setTouches] = useState(0);
  const [flair, setFlair] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (canvas) render(canvas, gameRef.current, time);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!gameRef.current) gameRef.current = createGame();
    draw(performance.now());
  }, [draw]);

  const start = useCallback(() => {
    gameRef.current = createGame();
    setTouches(0);
    setFlair(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const touch = useCallback(() => {
    const g = gameRef.current;
    if (g) doTouch(g);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastTouches = -1;
    let lastFlair = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      if (g.touches !== lastTouches) {
        lastTouches = g.touches;
        setTouches(g.touches);
      }
      if (g.flair !== lastFlair) {
        lastFlair = g.flair;
        setFlair(g.flair);
      }

      draw(t);
      if (g.over) {
        setTouches(g.touches);
        setFlair(g.flair);
        setNewBest(submit(g.touches));
        setStatus("over");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
        else if (!e.repeat) touch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start, touch]);

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={touches} best={best ?? "—"} accent="text-lime-300">
        <span className="text-emerald-300">
          Flair <b className="ml-1 text-sm text-ink">{flair}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(132,204,22,0.85)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Juggle Kings pitch"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") start();
            else touch();
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">JUGGLE KINGS</p>
            <p className="mt-2 text-sm text-muted">
              Sixty seconds, one ball, no hands. Touch it on the way down — clean contacts in the
              lime zone pop it straight back up, sloppy edges kick it sideways, and a ball on the
              turf ends the run. Rotate foot, thigh and head for flair bonuses, because every ten
              touches the pop gets a little lower.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Kick off
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Space or tap · only touch on the way down</p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              {touches >= 60 ? "FEET OF GOLD" : "BALL DOWN"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{touches}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Touches · flair ×{flair} · best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Watch the reach readout — meet the ball in the zone</p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap only on the way down · alternate foot / thigh / head for flair
      </p>
    </div>
  );
}
