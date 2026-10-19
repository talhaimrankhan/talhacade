"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 560;
const H = 460;
const TAU = Math.PI * 2;
const TONE = "from-slate-400 via-zinc-500 to-neutral-700";
const PX = 168; // player x
const AX = 392; // rival x
const PISTE_Y = 356;
const RIPOSTE_W = 0.62; // riposte window length

type Status = "idle" | "playing" | "over";
type Guard = "high" | "low" | "lunge";
type Key3 = "j" | "k" | "l";

const COL: Record<Guard, string> = {
  high: "#67e8f9",
  low: "#fbbf24",
  lunge: "#fb7185",
};
const NAME: Record<Guard, string> = {
  high: "HIGH · J",
  low: "LOW · K",
  lunge: "LUNGE · L",
};

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

interface Ai {
  state: "idle" | "wind" | "recover";
  timer: number;
  dur: number;
  kind: Guard;
  fake: Guard | null;
  lvl: number;
  hitT: number;
  lungeT: number;
}

interface Game {
  pScore: number;
  aScore: number;
  score: number;
  bout: number;
  phase: "fight" | "pause";
  pauseT: number;
  pending: "bout" | "over";
  usage: Record<Key3, number>;
  stance: Key3;
  stanceT: number;
  lungeT: number;
  hitT: number;
  pLock: number;
  riposteT: number;
  a: Ai;
  parts: Particle[];
  floats: Floater[];
  shake: number;
  flash: number;
  flashC: string;
  stripT: number;
  stripSide: "p" | "a" | null;
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
      life: 0.3 + Math.random() * 0.4,
      max: 0.7,
      r: 1.4 + Math.random() * 2.2,
      c,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, c: string): void {
  g.floats.push({ x, y, text, life: 1, c });
}

function freshAi(lvl: number): Ai {
  return {
    state: "idle",
    timer: Math.max(0.4, 1.1 - lvl * 0.08) + Math.random() * 0.5,
    dur: 0.85,
    kind: "high",
    fake: null,
    lvl,
    hitT: 0,
    lungeT: 0,
  };
}

function createGame(): Game {
  return {
    pScore: 0,
    aScore: 0,
    score: 0,
    bout: 1,
    phase: "fight",
    pauseT: 0,
    pending: "bout",
    usage: { j: 0, k: 0, l: 0 },
    stance: "j",
    stanceT: 0,
    lungeT: 0,
    hitT: 0,
    pLock: 0,
    riposteT: 0,
    a: freshAi(0),
    parts: [],
    floats: [],
    shake: 0,
    flash: 0,
    flashC: "#ffffff",
    stripT: 0,
    stripSide: null,
    over: false,
  };
}

function visibleKind(a: Ai): Guard {
  if (a.fake && a.timer > a.dur * 0.45) return a.fake;
  return a.kind;
}

function aiWind(g: Game): void {
  const a = g.a;
  const favJ = g.usage.j;
  const favK = g.usage.k;
  // adapts: leans toward whichever guard you lean on least
  let kind: Guard = favJ <= favK ? "high" : "low";
  if (Math.random() < 0.5) kind = kind === "high" ? "low" : "high";

  a.fake = null;
  if (a.lvl >= 1 && Math.random() < Math.min(0.55, 0.25 + a.lvl * 0.07)) {
    // feint — flashes YOUR favourite guard before committing the other way
    const fav: Guard = favJ >= favK ? "high" : "low";
    a.fake = fav;
    a.kind = fav === "high" ? "low" : "high";
  } else {
    a.kind = kind;
  }
  if (Math.random() < 0.12 + a.lvl * 0.02) {
    a.kind = "lunge";
    a.fake = null;
  }
  a.dur = Math.max(0.42, 0.88 - a.lvl * 0.055);
  a.timer = a.dur;
  a.state = "wind";
}

function aiIdle(g: Game): void {
  const a = g.a;
  a.state = "idle";
  a.fake = null;
  a.timer = Math.max(0.3, 1.15 - a.lvl * 0.09) + Math.random() * 0.55;
}

function touchScore(g: Game, who: "p" | "a", label: string): void {
  g.stripT = 0.7;
  g.stripSide = who;
  g.shake = Math.max(g.shake, who === "p" ? 8 : 11);
  if (who === "p") {
    g.pScore += 1;
    g.score += 1;
    g.flash = 0.5;
    g.flashC = "#34d399";
    floater(g, AX, PISTE_Y - 150, label, "#6ee7b7");
    burst(g, AX - 26, PISTE_Y - 84, "#6ee7b7", 18, 200);
  } else {
    g.aScore += 1;
    g.flash = 0.4;
    g.flashC = "#fb7185";
    floater(g, PX, PISTE_Y - 150, label, "#fda4af");
    burst(g, PX + 26, PISTE_Y - 84, "#fb7185", 16, 180);
  }
}

function endBout(g: Game, winner: "p" | "a"): void {
  g.phase = "pause";
  g.riposteT = 0;
  g.pending = winner === "p" ? "bout" : "over";
  g.pauseT = winner === "p" ? 1.9 : 1.6;
  g.shake = Math.max(g.shake, 10);
}

function parry(g: Game): void {
  g.riposteT = RIPOSTE_W;
  g.a.state = "recover";
  g.a.timer = 0.75;
  g.a.fake = null;
  g.shake = Math.max(g.shake, 5);
  g.flash = 0.35;
  g.flashC = "#e2e8f0";
  burst(g, (PX + AX) / 2, PISTE_Y - 86, "#e2e8f0", 14, 170);
  floater(g, (PX + AX) / 2, PISTE_Y - 122, "PARRY!", "#e2e8f0");
}

function riposteHit(g: Game): void {
  g.riposteT = 0;
  g.a.hitT = 0.45;
  g.a.state = "recover";
  g.a.timer = 0.85;
  g.lungeT = 0.4;
  touchScore(g, "p", "RIPOSTE!");
  if (g.pScore >= 5) endBout(g, "p");
}

function lungeBeat(g: Game): void {
  g.lungeT = 0.5;
  g.a.hitT = 0.45;
  g.a.state = "recover";
  g.a.timer = 0.9;
  touchScore(g, "p", "LUNGE — UNPREPARED!");
  if (g.pScore >= 5) endBout(g, "p");
}

function hitTaken(g: Game, kind: Guard): void {
  g.hitT = 0.5;
  g.pLock = 0.6;
  g.riposteT = 0;
  g.a.state = "recover";
  g.a.timer = 0.8;
  g.a.lungeT = kind === "lunge" ? 0.4 : 0;
  touchScore(g, "a", kind === "lunge" ? "HIS LUNGE LANDS" : `${NAME[kind].split(" ·")[0]} — HIT`);
  if (g.aScore >= 5) endBout(g, "a");
}

function act(g: Game, key: Key3): void {
  if (g.phase !== "fight" || g.over || g.pLock > 0) return;
  if (g.riposteT > 0) {
    riposteHit(g);
    return;
  }
  g.usage[key] += 1;
  g.stance = key;
  g.stanceT = 0.3;

  const a = g.a;
  if (a.state === "wind") {
    const need = visibleKind(a);
    if (key === (need === "high" ? "j" : need === "low" ? "k" : "l")) {
      parry(g);
    } else {
      hitTaken(g, need);
    }
    return;
  }
  if (a.state === "recover" && key === "l") {
    lungeBeat(g);
    return;
  }
  if (a.state === "idle" && key === "l") {
    // he was waiting for exactly that
    g.a.hitT = 0.2;
    touchScore(g, "a", "READ! YOUR LUNGE DIES");
    g.hitT = 0.5;
    g.pLock = 0.6;
    if (g.aScore >= 5) endBout(g, "a");
  }
}

/* ------------------------------ step ------------------------------ */

function step(g: Game, dt: number): void {
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt * 1.7);
  g.stripT = Math.max(0, g.stripT - dt);
  if (g.riposteT > 0) {
    g.riposteT = Math.max(0, g.riposteT - dt);
    if (g.riposteT === 0 && g.a.state === "recover") aiIdle(g);
  }
  if (g.stanceT > 0) g.stanceT = Math.max(0, g.stanceT - dt);
  if (g.lungeT > 0) g.lungeT = Math.max(0, g.lungeT - dt);
  if (g.hitT > 0) g.hitT = Math.max(0, g.hitT - dt);
  if (g.pLock > 0) g.pLock = Math.max(0, g.pLock - dt);
  if (g.a.hitT > 0) g.a.hitT = Math.max(0, g.a.hitT - dt);
  if (g.a.lungeT > 0) g.a.lungeT = Math.max(0, g.a.lungeT - dt);

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt * 1.15;
    f.y -= 28 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  if (g.phase === "pause") {
    g.pauseT -= dt;
    if (g.pauseT <= 0) {
      if (g.pending === "over") {
        g.over = true;
      } else {
        g.bout += 1;
        g.pScore = 0;
        g.aScore = 0;
        g.usage = { j: 0, k: 0, l: 0 };
        g.a = freshAi(g.a.lvl + 1);
        g.phase = "fight";
        floater(g, W / 2, PISTE_Y - 190, `BOUT ${g.bout} — EN GARDE`, "#e2e8f0");
      }
    }
    return;
  }

  const a = g.a;
  if (a.state === "idle") {
    a.timer -= dt;
    if (a.timer <= 0) aiWind(g);
  } else if (a.state === "wind") {
    a.timer -= dt;
    if (a.timer <= 0) {
      // strike lands — nobody parried
      a.lungeT = a.kind === "lunge" ? 0.4 : 0;
      hitTaken(g, a.kind);
    }
  }
}

/* ------------------------------ render ------------------------------ */

// draw-time scoring strip state (fed from the game each frame)
let g_pScore = 0;
let g_aScore = 0;
let lightPulse = 0;
let lightPulseSide: "p" | "a" = "p";
function g_light(i: number, side: "p" | "a"): boolean {
  return side === "p" ? i < g_pScore : i < g_aScore;
}

function drawPiste(ctx: CanvasRenderingContext2D): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0c0f16");
  bg.addColorStop(0.6, "#0a0d13");
  bg.addColorStop(1, "#070910");
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  const spot = ctx.createRadialGradient(W / 2, PISTE_Y - 60, 40, W / 2, PISTE_Y - 60, 330);
  spot.addColorStop(0, "rgba(203, 213, 225, 0.12)");
  spot.addColorStop(1, "rgba(203, 213, 225, 0)");
  ctx.fillStyle = spot;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // piste
  ctx.fillStyle = "rgba(148, 163, 184, 0.10)";
  ctx.beginPath();
  ctx.roundRect(40, PISTE_Y - 12, W - 80, 44, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(203, 213, 225, 0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  // en-garde lines + centre
  ctx.strokeStyle = "rgba(203, 213, 225, 0.25)";
  ctx.lineWidth = 1.5;
  for (const x of [W / 2, PX - 40, PX + 40, AX - 40, AX + 40]) {
    ctx.beginPath();
    ctx.moveTo(x, PISTE_Y - 12);
    ctx.lineTo(x, PISTE_Y + 32);
    ctx.stroke();
  }

  // point-light scoring strip
  ctx.fillStyle = "rgba(2, 6, 23, 0.7)";
  ctx.beginPath();
  ctx.roundRect(W / 2 - 190, 44, 380, 26, 13);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    // your lights (left) grow from the centre out
    const lit = g_light(i, "p");
    ctx.fillStyle = lit ? "#67e8f9" : "rgba(103, 232, 249, 0.14)";
    ctx.beginPath();
    ctx.arc(W / 2 - 22 - i * 30, 57, 7, 0, TAU);
    ctx.fill();
    const litA = g_light(i, "a");
    ctx.fillStyle = litA ? "#fb7185" : "rgba(251, 113, 133, 0.14)";
    ctx.beginPath();
    ctx.arc(W / 2 + 22 + i * 30, 57, 7, 0, TAU);
    ctx.fill();
  }
  if (lightPulse > 0) {
    ctx.fillStyle = lightPulseSide === "p" ? "rgba(103, 232, 249," : "rgba(251, 113, 133,";
    const k = 1 - lightPulse;
    ctx.fillRect(40, 54, (W - 80) * (lightPulseSide === "p" ? k : 1), 6);
  }
}

// scoring-strip lights: your five on the left, rival's five on the right
function drawFencer(
  ctx: CanvasRenderingContext2D,
  side: "p" | "a",
  x: number,
  opts: {
    guard: Guard | null;
    lungeT: number;
    hitT: number;
    time: number;
    telegraph: string | null;
    telegraphC: string;
  },
): void {
  const face = side === "p" ? 1 : -1;
  const main = side === "p" ? "#e2e8f0" : "#94a3b8";
  const glow = side === "p" ? "#67e8f9" : "#fb7185";
  const lunge = opts.lungeT > 0 ? Math.sin((opts.lungeT / 0.5) * Math.PI) : 0;
  const lean = lunge * 26;
  const hit = opts.hitT > 0 ? Math.sin((opts.hitT / 0.5) * Math.PI) : 0;
  const bob = Math.sin(opts.time / 420 + (side === "p" ? 0 : 1.4)) * 1.5;

  ctx.save();
  ctx.translate(x + face * lean - hit * face * 16, PISTE_Y + bob);
  if (hit > 0) ctx.rotate(-face * hit * 0.22);

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(0, 4, 22, 5, 0, 0, TAU);
  ctx.fill();

  // legs — lunge stretches the front leg out
  ctx.strokeStyle = main;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.lineTo(face * (12 + lunge * 24), -2);
  ctx.moveTo(0, -40);
  ctx.lineTo(-face * 12, -2);
  ctx.stroke();

  // torso
  ctx.save();
  ctx.shadowColor = hexA(glow, 0.5);
  ctx.shadowBlur = 10;
  ctx.strokeStyle = hit > 0 ? "#ffffff" : main;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.lineTo(face * 4, -84);
  ctx.stroke();
  ctx.restore();

  // mask
  ctx.fillStyle = hit > 0 ? "#ffffff" : "#cbd5e1";
  ctx.beginPath();
  ctx.arc(face * 7, -97, 11, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(51, 65, 85, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(face * 7, -97, 7, -0.9, 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(face * 12, -103);
  ctx.lineTo(face * 18, -100);
  ctx.stroke();

  // sword arm + blade
  const g = opts.guard;
  const tipUp = g === "high" ? -34 : g === "low" ? 30 : -4;
  const armX = face * (16 + lunge * 22);
  const armY = -74;
  ctx.strokeStyle = hit > 0 ? "#ffffff" : main;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(face * 4, -78);
  ctx.lineTo(armX, armY);
  ctx.stroke();
  ctx.strokeStyle = opts.telegraphC;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = opts.telegraphC;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(armX, armY);
  ctx.lineTo(armX + face * 58, armY + tipUp);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.restore();

  // telegraph aura + label
  if (opts.telegraph) {
    const pulse = 0.6 + Math.sin(opts.time / 90) * 0.4;
    ctx.save();
    ctx.globalAlpha = 0.55 + pulse * 0.45;
    ctx.strokeStyle = opts.telegraphC;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, PISTE_Y - 120, 14 + pulse * 5, 0, TAU);
    ctx.stroke();
    ctx.font = "800 13px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = opts.telegraphC;
    ctx.fillText(opts.telegraph, x, PISTE_Y - 152);
    ctx.restore();
  }
}

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (g) {
    g_pScore = g.pScore;
    g_aScore = g.aScore;
    lightPulse = g.stripT / 0.7;
    lightPulseSide = g.stripSide ?? "p";
  } else {
    g_pScore = 0;
    g_aScore = 0;
    lightPulse = 0;
  }

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  drawPiste(ctx);

  if (g) {
    // rival telegraph
    const showTele =
      g.phase === "fight" && g.a.state === "wind" ? NAME[visibleKind(g.a)] : null;
    const teleCol =
      g.a.state === "wind" ? COL[visibleKind(g.a)] : "rgba(148,163,184,0.5)";

    drawFencer(ctx, "a", AX, {
      guard: g.a.state === "wind" ? visibleKind(g.a) : null,
      lungeT: g.a.lungeT,
      hitT: g.a.hitT,
      time,
      telegraph: showTele,
      telegraphC: teleCol,
    });
    const stanceGuard: Guard | null =
      g.stance === "j" ? "high" : g.stance === "k" ? "low" : null;
    drawFencer(ctx, "p", PX, {
      guard: g.riposteT > 0 || g.stanceT > 0 ? stanceGuard : null,
      lungeT: g.lungeT,
      hitT: g.hitT,
      time,
      telegraph: null,
      telegraphC: "#67e8f9",
    });

    // riposte window ring
    if (g.riposteT > 0) {
      ctx.strokeStyle = "rgba(52, 211, 153, 0.9)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(PX, PISTE_Y - 110, 20, -Math.PI / 2, -Math.PI / 2 + (g.riposteT / RIPOSTE_W) * TAU);
      ctx.stroke();
      ctx.font = "800 13px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#6ee7b7";
      ctx.fillText("TAP — RIPOSTE!", PX, PISTE_Y - 140);
    }

    for (const p of g.parts) {
      ctx.fillStyle = hexA(p.c, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    // bout pips
    ctx.textAlign = "left";
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillStyle = "#a5f3fc";
    ctx.fillText(`YOU ${g.pScore}`, 40, 100);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fda4af";
    ctx.fillText(`RIVAL${g.a.lvl > 0 ? ` ×${g.a.lvl + 1}` : ""} ${g.aScore}`, W - 40, 100);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
    ctx.fillText(`BOUT ${g.bout} · FIRST TO 5 · TOUCHES ${g.score}`, W / 2, 100);

    ctx.font = "800 15px ui-monospace, monospace";
    for (const f of g.floats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.textAlign = "center";
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    if (g.phase === "pause") {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.pauseT);
      ctx.font = "800 30px ui-sans-serif, system-ui, sans-serif";
      ctx.shadowColor = g.pending === "bout" ? "rgba(103, 232, 249, 0.9)" : "rgba(251, 113, 133, 0.9)";
      ctx.shadowBlur = 22;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(g.pending === "bout" ? "HALT — BOUT YOURS" : "HALT — HE TAKES IT", W / 2, 180);
      ctx.restore();
    }

    if (g.flash > 0.01) {
      ctx.fillStyle = hexA(g.flashC, g.flash * 0.28);
      ctx.fillRect(-14, -14, W + 28, H + 28);
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function FencingBout({ gameId = "fencing-bout" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [bout, setBout] = useState(1);
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
    setScore(0);
    setBout(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const press = useCallback((key: Key3) => {
    const g = gameRef.current;
    if (g) act(g, key);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastBout = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      step(g, dt);

      if (g.score !== lastScore) {
        lastScore = g.score;
        setScore(g.score);
      }
      if (g.bout !== lastBout) {
        lastBout = g.bout;
        setBout(g.bout);
      }

      draw(t);
      if (g.over) {
        setScore(g.score);
        setNewBest(submit(g.score));
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
        else if (!e.repeat) {
          const g = gameRef.current;
          if (g && g.riposteT > 0) press("j"); // any action ripostes
        }
        return;
      }
      if (status !== "playing" || e.repeat) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "j" || key === "k" || key === "l") press(key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start, press]);

  const padBtn =
    "touch-none rounded-xl border bg-surface py-3 font-mono text-xs font-bold uppercase tracking-wider transition active:scale-95";

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={score} best={best ?? "—"} accent="text-slate-300">
        <span className="text-zinc-300">
          Bout <b className="ml-1 text-sm text-ink">{bout}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(148,163,184,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none select-none"
          aria-label="Fencing Bout piste"
          onPointerDown={() => {
            const g = gameRef.current;
            if (status === "playing" && g && g.riposteT > 0) press("j");
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">FENCING BOUT</p>
            <p className="mt-2 text-sm text-muted">
              First to five touches. Watch the rival&apos;s blade flash — cyan means high (parry
              with J), amber means low (parry with K), red is his lunge (counter with L). A clean
              parry opens a riposte window: tap to score. His lunge beats you when you&apos;re
              unprepared, and he learns which guard you lean on — expect feints.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              En garde
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">J high · K low · L lunge · tap / Space to riposte</p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">BOUT LOST</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Touches · best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Parry on the colour, riposte on the tap</p>
          </Overlay>
        )}
      </div>

      <div className="mt-2 grid touch-none select-none grid-cols-3 gap-2">
        <button
          type="button"
          onPointerDown={() => press("j")}
          aria-label="High parry — key J"
          className={`${padBtn} border-cyan-400/50 text-cyan-300`}
        >
          J · High
        </button>
        <button
          type="button"
          onPointerDown={() => press("k")}
          aria-label="Low parry — key K"
          className={`${padBtn} border-amber-400/50 text-amber-300`}
        >
          K · Low
        </button>
        <button
          type="button"
          onPointerDown={() => press("l")}
          aria-label="Lunge — key L"
          className={`${padBtn} border-rose-400/50 text-rose-300`}
        >
          L · Lunge
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Cyan flash = high · amber flash = low · red flash = his lunge · tap to riposte
      </p>
    </div>
  );
}
