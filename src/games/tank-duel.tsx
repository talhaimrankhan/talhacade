"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay, PrimaryButton } from "@/games/parts";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";

const W = 640;
const H = 320;
const COLS = 160;
const COL_W = W / COLS;
const G = 260; // gravity px/s²
const WIND_ACC = 36; // px/s² at full wind
const V_MIN = 60;
const V_MAX = 460;
const MAX_HP = 100;
const DIRECT_DMG = 35;
const SPLASH_RADIUS = 74;
const CRATER_R = 16;

interface Series {
  you: number;
  cpu: number;
}
type Result = "won" | "lost";

interface Tank {
  x: number;
  hp: number;
}

interface Proj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: 1 | 2;
  trail: { x: number; y: number }[];
}

interface TGame {
  heights: number[];
  you: Tank;
  cpu: Tank;
  wind: number;
  turn: "you" | "cpu" | "fly" | "done";
  proj: Proj | null;
  impact: { x: number; y: number; life: number } | null;
  result: Result | null;
  cpuAngle: number;
  cpuLastLand: number | null;
}

const STARS = Array.from({ length: 46 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H * 0.55,
  r: Math.random() * 1.3 + 0.3,
}));

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function newWind(): number {
  const w = Math.random() * 2 - 1;
  return Math.abs(w) < 0.08 ? 0 : Math.round(w * 100) / 100;
}

function makeTerrain(): number[] {
  const base = H * 0.52 + Math.random() * H * 0.22;
  const a1 = 12 + Math.random() * 20;
  const a2 = 8 + Math.random() * 14;
  const a3 = 4 + Math.random() * 7;
  const f1 = 0.012 + Math.random() * 0.016;
  const f2 = 0.045 + Math.random() * 0.03;
  const p1 = Math.random() * Math.PI * 2;
  const p2 = Math.random() * Math.PI * 2;
  const p3 = Math.random() * Math.PI * 2;

  const heights: number[] = [];
  for (let x = 0; x < COLS; x++) {
    const y =
      base -
      Math.sin(x * f1 + p1) * a1 -
      Math.sin(x * f2 + p2) * a2 -
      Math.sin(x * 0.12 + p3) * a3;
    heights.push(clamp(y, H * 0.22, H - 30));
  }

  // gentle smoothing passes
  for (let pass = 0; pass < 2; pass++) {
    for (let x = 1; x < COLS - 1; x++) {
      heights[x] = (heights[x - 1] + heights[x] * 2 + heights[x + 1]) / 4;
    }
  }

  // flat shelves so neither tank starts on a cliff edge
  for (let x = 0; x <= 15; x++) heights[x] = heights[16];
  for (let x = COLS - 16; x < COLS; x++) heights[x] = heights[COLS - 17];
  return heights;
}

function terrainAt(heights: number[], x: number): number {
  const i = Math.floor(x / COL_W);
  if (i < 0) return heights[0];
  if (i >= COLS) return heights[COLS - 1];
  return heights[i];
}

/** Punch a bowl-shaped crater into the heightmap around the burst point. */
function carve(heights: number[], x: number, centreY: number, radius: number): void {
  const c0 = Math.floor((x - radius) / COL_W);
  const c1 = Math.ceil((x + radius) / COL_W);
  for (let i = Math.max(0, c0); i <= Math.min(COLS - 1, c1); i++) {
    const cx = i * COL_W + COL_W / 2;
    const dx = cx - x;
    const dy = Math.sqrt(Math.max(0, radius * radius - dx * dx));
    if (heights[i] > centreY - dy && heights[i] < centreY + dy) {
      heights[i] = Math.min(H - 4, centreY + dy);
    }
  }
}

function createGame(startTurn: "you" | "cpu"): TGame {
  const heights = makeTerrain();
  return {
    heights,
    you: { x: 52, hp: MAX_HP },
    cpu: { x: W - 52, hp: MAX_HP },
    wind: newWind(),
    turn: startTurn,
    proj: null,
    impact: null,
    result: null,
    cpuAngle: 45,
    cpuLastLand: null,
  };
}

function startShot(g: TGame, owner: 1 | 2, angleDeg: number, power: number): void {
  const tank = owner === 1 ? g.you : g.cpu;
  const dir = owner === 1 ? 1 : -1;
  const v = V_MIN + power * ((V_MAX - V_MIN) / 100);
  const a = (clamp(angleDeg, 10, 85) * Math.PI) / 180;
  g.proj = {
    x: tank.x,
    y: terrainAt(g.heights, tank.x) - 13,
    vx: dir * Math.cos(a) * v,
    vy: -Math.sin(a) * v,
    owner,
    trail: [],
  };
  g.turn = "fly";
}

function applyDamage(g: TGame, t: 1 | 2, dmg: number): void {
  if (dmg <= 0) return;
  const tank = t === 1 ? g.you : g.cpu;
  tank.hp -= dmg;
}

function resolveImpact(
  g: TGame,
  p: Proj,
  at: { x: number; y: number },
  direct: 1 | 2 | null,
): void {
  const cx = clamp(at.x, 4, W - 4);
  carve(g.heights, cx, at.y, CRATER_R);
  g.impact = { x: cx, y: at.y, life: 1 };

  if (direct) {
    applyDamage(g, direct, DIRECT_DMG);
  } else {
    for (const t of [1, 2] as const) {
      const tank = t === 1 ? g.you : g.cpu;
      const cy = terrainAt(g.heights, tank.x) - 10;
      const d = Math.hypot(cx - tank.x, at.y - cy);
      if (d < SPLASH_RADIUS) {
        applyDamage(g, t, Math.round(DIRECT_DMG * (1 - d / SPLASH_RADIUS)));
      }
    }
  }

  if (p.owner === 2) g.cpuLastLand = cx;
  g.proj = null;

  if (g.you.hp <= 0 || g.cpu.hp <= 0) {
    g.you.hp = Math.max(0, g.you.hp);
    g.cpu.hp = Math.max(0, g.cpu.hp);
    g.result = g.cpu.hp <= 0 ? "won" : "lost";
    g.turn = "done";
    return;
  }

  g.wind = newWind();
  g.turn = p.owner === 1 ? "cpu" : "you";
}

function update(g: TGame, dt: number): void {
  if (g.impact) {
    g.impact.life -= dt * 2.2;
    if (g.impact.life <= 0) g.impact = null;
  }

  const p = g.proj;
  if (!p) return;

  const h = dt / 6;
  for (let i = 0; i < 6; i++) {
    p.vy += G * h;
    p.vx += g.wind * WIND_ACC * h;
    p.x += p.vx * h;
    p.y += p.vy * h;

    const target: 1 | 2 = p.owner === 1 ? 2 : 1;
    const tank = target === 1 ? g.you : g.cpu;
    const ty = terrainAt(g.heights, tank.x) - 10;
    if (Math.hypot(p.x - tank.x, p.y - ty) < 13) {
      resolveImpact(g, p, { x: p.x, y: p.y }, target);
      return;
    }

    if (p.y >= terrainAt(g.heights, p.x) - 1) {
      resolveImpact(g, p, { x: p.x, y: p.y }, null);
      return;
    }
    if (p.x < -60 || p.x > W + 60 || p.y > H + 80) {
      const ex = clamp(p.x, 0, W - 1);
      resolveImpact(g, p, { x: ex, y: terrainAt(g.heights, ex) }, null);
      return;
    }
  }

  p.trail.push({ x: p.x, y: p.y });
  if (p.trail.length > 18) p.trail.shift();
}

/** Landing x for a given shot, using the same physics as live flight. */
function simulateLand(
  g: TGame,
  fromX: number,
  fromY: number,
  angleDeg: number,
  power: number,
  dir: 1 | -1,
): number {
  const v = V_MIN + power * ((V_MAX - V_MIN) / 100);
  const a = (angleDeg * Math.PI) / 180;
  let px = fromX;
  let py = fromY;
  let vx = dir * Math.cos(a) * v;
  let vy = -Math.sin(a) * v;
  const h = 1 / 60;
  for (let i = 0; i < 900; i++) {
    vy += G * h;
    vx += g.wind * WIND_ACC * h;
    px += vx * h;
    py += vy * h;
    if (px < -30 || px > W + 30) return px;
    if (py >= terrainAt(g.heights, px) - 1) return px;
  }
  return px;
}

/**
 * Estimate a shot for the gap, then correct the power using where the last
 * one actually landed — the CPU calibrates itself over the duel.
 */
function cpuSolve(g: TGame): { angle: number; power: number } {
  const fromX = g.cpu.x;
  const fromY = terrainAt(g.heights, g.cpu.x) - 13;
  const targetX = g.you.x;
  const angle = 45 + (Math.random() * 10 - 5);

  let bestPower = 55;
  let bestErr = Infinity;
  for (let p = 12; p <= 100; p += 2) {
    const land = simulateLand(g, fromX, fromY, angle, p, -1);
    const err = Math.abs(land - targetX);
    if (err < bestErr) {
      bestErr = err;
      bestPower = p;
    }
    if (err < 3) break;
  }

  let power = bestPower;
  if (g.cpuLastLand !== null) {
    power -= (g.cpuLastLand - targetX) * 0.05;
  }
  power += (Math.random() - 0.5) * 5; // human-ish wobble
  return { angle, power: Math.round(clamp(power, 8, 100)) };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface Hud {
  youHp: number;
  cpuHp: number;
  wind: number;
  turn: TGame["turn"];
}

export default function TankDuel({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<TGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame("you");

  const [hud, setHud] = useState<Hud>({
    youHp: MAX_HP,
    cpuHp: MAX_HP,
    wind: 0,
    turn: "you",
  });
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(30);
  const [charging, setCharging] = useState(false);
  const [over, setOver] = useState<Result | null>(null);
  const [round, setRound] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const [series, setSeries] = useStored<Series>(`series:${gameId}`, {
    you: 0,
    cpu: 0,
  });
  const { best, submit } = useBestScore(gameId, "high");
  const seriesRef = useRef<Series>(series);
  const angleRef = useRef(45);
  const powerRef = useRef(30);
  const dirRef = useRef(1);

  useEffect(() => {
    seriesRef.current = series;
  }, [series]);
  useEffect(() => {
    angleRef.current = angle;
  }, [angle]);
  useEffect(() => {
    powerRef.current = power;
  }, [power]);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0a0a1c");
    sky.addColorStop(1, "#1c1130");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(226,232,240,0.55)";
    for (const s of STARS) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // terrain
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < COLS; i++) ctx.lineTo(i * COL_W, g.heights[i]);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = "#241726";
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < COLS; i++) {
      if (i === 0) ctx.moveTo(i * COL_W, g.heights[i]);
      else ctx.lineTo(i * COL_W, g.heights[i]);
    }
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#f59e0b";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // tanks
    const drawTank = (
      tank: Tank,
      dir: 1 | -1,
      aimDeg: number,
      body: string,
    ) => {
      const gy = terrainAt(g.heights, tank.x);
      ctx.save();
      ctx.translate(tank.x, gy);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.roundRect(-13, -14, 26, 13, 4);
      ctx.fill();
      ctx.save();
      ctx.rotate(dir === 1 ? (-aimDeg * Math.PI) / 180 : Math.PI + (aimDeg * Math.PI) / 180);
      ctx.fillRect(-2, -2.5, 18, 5);
      ctx.restore();
      ctx.restore();

      const pct = Math.max(0, tank.hp / MAX_HP);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(tank.x - 16, gy - 26, 32, 5);
      ctx.fillStyle = pct > 0.5 ? "#34d399" : pct > 0.25 ? "#fbbf24" : "#f43f5e";
      ctx.fillRect(tank.x - 16, gy - 26, 32 * pct, 5);
    };

    drawTank(g.cpu, -1, g.cpuAngle, "#fb7185");
    drawTank(g.you, 1, angleRef.current, "#22d3ee");

    // projectile
    const p = g.proj;
    if (p) {
      ctx.strokeStyle = "rgba(250,204,21,0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      p.trail.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = "#facc15";
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // impact flash
    if (g.impact) {
      const r = (1 - g.impact.life) * 34 + 6;
      ctx.strokeStyle = `rgba(251,146,60,${g.impact.life * 0.9})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.impact.x, g.impact.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // wind ribbon
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = g.wind >= 0 ? "#38bdf8" : "#f472b6";
    ctx.setLineDash([10, 14]);
    ctx.lineDashOffset = -((time / 40) % 24);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const dirY = 22;
    ctx.moveTo(g.wind >= 0 ? 12 : W - 12, dirY);
    ctx.lineTo(g.wind >= 0 ? 12 + Math.abs(g.wind) * 120 : W - 12 - Math.abs(g.wind) * 120, dirY);
    ctx.stroke();
    ctx.restore();
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

  const finishRound = useCallback(
    (result: Result) => {
      setOver(result);
      const s = seriesRef.current;
      const updated =
        result === "won"
          ? { ...s, you: s.you + 1 }
          : { ...s, cpu: s.cpu + 1 };
      seriesRef.current = updated;
      setSeries(updated);
      if (result === "won") setNewBest(submit(updated.you));
    },
    [setSeries, submit],
  );

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const g0 = gameRef.current;
    let lastYou = g0 ? g0.you.hp : MAX_HP;
    let lastCpu = g0 ? g0.cpu.hp : MAX_HP;
    let lastWind = g0 ? g0.wind : 0;
    let lastTurn = g0 ? g0.turn : ("you" as const);
    let lastResult = g0 ? g0.result : null;

    const loop = (t: number) => {
      const g = gameRef.current;
      if (g) {
        const dt = Math.min((t - last) / 1000, 0.1);
        last = t;
        update(g, dt);

        if (
          g.you.hp !== lastYou ||
          g.cpu.hp !== lastCpu ||
          g.wind !== lastWind ||
          g.turn !== lastTurn
        ) {
          lastYou = g.you.hp;
          lastCpu = g.cpu.hp;
          lastWind = g.wind;
          lastTurn = g.turn;
          setHud({
            youHp: g.you.hp,
            cpuHp: g.cpu.hp,
            wind: g.wind,
            turn: g.turn,
          });
        }
        if (g.result !== lastResult) {
          lastResult = g.result;
          if (g.result) finishRound(g.result);
        }
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw, finishRound]);

  // CPU takes its shot after a beat
  useEffect(() => {
    if (hud.turn !== "cpu") return;
    const timer = setTimeout(() => {
      const g = gameRef.current;
      if (!g || g.turn !== "cpu") return;
      const aim = cpuSolve(g);
      g.cpuAngle = aim.angle;
      startShot(g, 2, aim.angle, aim.power);
    }, 720);
    return () => clearTimeout(timer);
  }, [hud.turn]);

  /* ---------------- charging + firing ---------------- */

  useEffect(() => {
    if (!charging) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.08);
      last = t;
      let n = powerRef.current + dirRef.current * 85 * dt;
      if (n >= 100) {
        n = 100;
        dirRef.current = -1;
      } else if (n <= 0) {
        n = 0;
        dirRef.current = 1;
      }
      powerRef.current = n;
      setPower(n);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [charging]);

  const canFire = hud.turn === "you" && over === null;

  const fire = useCallback((pw: number) => {
    const g = gameRef.current;
    if (!g || g.turn !== "you" || g.proj || g.result) return;
    startShot(g, 1, angleRef.current, pw);
  }, []);

  const startCharge = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.turn !== "you" || g.proj || g.result) return;
    dirRef.current = 1;
    powerRef.current = 0;
    setPower(0);
    setCharging(true);
  }, []);

  const releaseFire = useCallback(() => {
    setCharging(false);
    fire(powerRef.current);
  }, [fire]);

  const newRound = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const nextRound = round + 1;
    const fresh = createGame(nextRound % 2 === 1 ? "you" : "cpu");
    gameRef.current = fresh;
    setRound(nextRound);
    setOver(null);
    setNewBest(false);
    setCharging(false);
    setAngle(45);
    powerRef.current = 30;
    setPower(30);
    setHud({
      youHp: MAX_HP,
      cpuHp: MAX_HP,
      wind: fresh.wind,
      turn: fresh.turn,
    });
  }, [round]);

  // keyboard: angle + hold-to-fire
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAngle((a) => Math.min(85, a + 2));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAngle((a) => Math.max(10, a - 2));
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        if (over !== null) return;
        if (e.type === "keydown") {
          if (!e.repeat) startCharge();
        } else {
          releaseFire();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [over, startCharge, releaseFire]);

  /* ---------------- view ---------------- */

  const windText =
    hud.wind === 0
      ? "still"
      : `${hud.wind > 0 ? "→" : "←"} ${Math.abs(hud.wind).toFixed(1)}`;

  return (
    <div className="w-full max-w-[560px]">
      <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-xs uppercase tracking-wider">
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-cyan-300">
          You <b className="ml-1 text-sm text-ink">{series.you}</b>
        </div>
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-rose-300">
          CPU <b className="ml-1 text-sm text-ink">{series.cpu}</b>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted">
            <span className="text-cyan-300">Your tank</span>
            <span>{hud.youHp}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-600 transition-all"
              style={{ width: `${(hud.youHp / MAX_HP) * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted">
            <span className="text-rose-300">CPU tank</span>
            <span>{hud.cpuHp}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div
              className="ml-auto h-full rounded-full bg-gradient-to-r from-pink-400 via-rose-500 to-red-400 transition-all"
              style={{ width: `${(hud.cpuHp / MAX_HP) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(250,204,21,0.7)]">
        <canvas
          ref={canvasRef}
          aria-label="Tank duel battlefield"
          className="block w-full [touch-action:manipulation]"
        />

        {over && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {over === "won" ? "Direct hit! 🎉" : "Your tank is scrap 🤖"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ Most series wins — new best!
              </p>
            )}
            <p className="mt-2 text-xs uppercase tracking-widest text-muted">
              Round {round} · Series {series.you}–{series.cpu} · Best{" "}
              {best ?? 0}
            </p>
            <PrimaryButton
              onClick={newRound}
              tone="from-yellow-400 via-amber-500 to-orange-600"
            >
              New round
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <div className="rounded-lg border border-line bg-surface px-3 py-1.5 text-center font-mono text-xs uppercase tracking-wider text-muted">
          Wind
          <b
            className={cn(
              "ml-1.5 text-sm",
              hud.wind > 0 ? "text-sky-300" : hud.wind < 0 ? "text-rose-300" : "text-ink",
            )}
          >
            {windText}
          </b>
        </div>
        <div>
          <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted">
            <span>Angle {angle}°</span>
            <span>Power {Math.round(power)}</span>
          </div>
          <input
            type="range"
            min={10}
            max={85}
            step={1}
            value={angle}
            disabled={!canFire}
            aria-label="Set firing angle"
            onChange={(e) => setAngle(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600"
              style={{ width: `${power}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onPointerDown={startCharge}
          onPointerUp={releaseFire}
          onPointerCancel={() => setCharging(false)}
          onPointerLeave={() => setCharging(false)}
          disabled={!canFire}
          aria-label="Hold to charge, release to fire"
          className={cn(
            "select-none rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 px-5 py-3 text-xs font-bold text-black transition [touch-action:none]",
            canFire
              ? "hover:brightness-110 active:scale-95"
              : "cursor-not-allowed opacity-40",
          )}
        >
          {charging ? "RELEASE" : "HOLD TO FIRE"}
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        {over
          ? "Tap New round for a fresh battlefield"
          : hud.turn === "you"
            ? charging
              ? "Release to fire"
              : "Your shot — set angle, hold to charge"
            : hud.turn === "cpu"
              ? "CPU is aiming…"
              : "Shell in flight…"}
        {" · "}
        wind shifts every round
      </p>
      <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-widest text-muted">
        All-time series wins {best ?? 0}
      </p>
    </div>
  );
}
