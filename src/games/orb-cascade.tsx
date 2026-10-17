"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 440;
const H = 540;
const ORB_R = 13;
const SPACING = 26;
/** Front orb spawns at this path offset so long chains never start past the end. */
const SPAWN_S = 470;
const SHOT_SPEED = 470;
const STEP = 16.667;
const CANNON_X = W / 2;
const CANNON_Y = H - 44;

type Status = "idle" | "playing" | "over";

const COLORS = ["#22d3ee", "#f472b6", "#fbbf24", "#a78bfa", "#34d399"];

interface Pt { x: number; y: number; len: number }
interface Orb { color: number; s: number }
interface Proj { x: number; y: number; vx: number; vy: number; color: number }
interface CascadeGame {
  chain: Orb[]; proj: Proj | null; aim: number; current: number; next: number;
  level: number; score: number; speed: number; combo: number; comboPts: number;
  comboT: number; banner: string; bannerT: number; alive: boolean;
}

/* ---------------- path (sine wave across the board) ---------------- */

const PATH: Pt[] = (() => {
  const pts: Pt[] = [];
  const N = 360;
  const x0 = 44;
  const x1 = W - 44;
  let total = 0;
  let prevX = x0;
  let prevY = 160 + 78 * Math.sin(0);
  pts.push({ x: prevX, y: prevY, len: 0 });
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const x = x0 + (x1 - x0) * t;
    const y = 160 + 78 * Math.sin(t * Math.PI * 4);
    total += Math.hypot(x - prevX, y - prevY);
    pts.push({ x, y, len: total });
    prevX = x;
    prevY = y;
  }
  return pts;
})();

const PATH_LEN = PATH[PATH.length - 1].len;

function pathPos(s: number) {
  const c = Math.max(0, Math.min(PATH_LEN, s));
  let lo = 0;
  let hi = PATH.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (PATH[mid].len <= c) lo = mid;
    else hi = mid;
  }
  const a = PATH[lo];
  const b = PATH[lo + 1];
  const span = b.len - a.len || 1;
  const f = (c - a.len) / span;
  const x = a.x + (b.x - a.x) * f; const y = a.y + (b.y - a.y) * f;
  const tx = (b.x - a.x) / span; const ty = (b.y - a.y) / span;
  const m = Math.hypot(tx, ty) || 1;
  return { x, y, tx: tx / m, ty: ty / m };
}

function chainCount(level: number): number {
  if (level === 1) return 16;
  if (level === 2) return 24;
  if (level === 3) return 32;
  return Math.min(60, 32 + (level - 3) * 6);
}

function chainSpeed(level: number): number {
  if (level <= 3) return [15, 21, 27][level - 1];
  return Math.min(68, 27 + (level - 3) * 7);
}

function buildChain(level: number): Orb[] {
  const count = chainCount(level);
  const chain: Orb[] = [];
  for (let i = 0; i < count; i++) {
    let color = Math.floor(Math.random() * COLORS.length);
    const a = chain[chain.length - 1]?.color;
    const b = chain[chain.length - 2]?.color;
    let guard = 0;
    while (color === a && color === b && guard < 8) {
      color = Math.floor(Math.random() * COLORS.length);
      guard += 1;
    }
    chain.push({ color, s: SPAWN_S - i * SPACING });
  }
  return chain;
}

function createGame(): CascadeGame {
  return {
    chain: buildChain(1), proj: null, aim: -Math.PI / 2,
    current: Math.floor(Math.random() * COLORS.length),
    next: Math.floor(Math.random() * COLORS.length),
    level: 1, score: 0, speed: chainSpeed(1),
    combo: 0, comboPts: 0, comboT: 0, banner: "", bannerT: 0, alive: true,
  };
}

export default function OrbCascade({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<CascadeGame | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    ctx.fillStyle = "#0b0b16";
    ctx.fillRect(0, 0, W, H);

    // guide path
    ctx.strokeStyle = "rgba(139,92,246,0.35)"; ctx.lineWidth = 3; ctx.setLineDash([6, 10]);
    ctx.beginPath();
    for (let i = 0; i < PATH.length; i += 4) {
      const p = PATH[i];
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke(); ctx.setLineDash([]);

    // socket
    const end = pathPos(PATH_LEN);
    const open = 1 + Math.sin(time / 320) * 0.12;
    ctx.save();
    ctx.shadowColor = "#f43f5e"; ctx.shadowBlur = 20; ctx.strokeStyle = "#f43f5e"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(end.x, end.y, 17 * open, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.fillStyle = "#0b0b16";
    ctx.beginPath(); ctx.arc(end.x, end.y, 13, 0, Math.PI * 2); ctx.fill();

    const orb = (x: number, y: number, color: number, r = ORB_R) => {
      const c = COLORS[color % COLORS.length];
      ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 12; ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
    };

    for (const o of g.chain) {
      if (o.s < -ORB_R || o.s > PATH_LEN + ORB_R) continue;
      const p = pathPos(o.s);
      orb(p.x, p.y, o.color);
    }
    if (g.proj) orb(g.proj.x, g.proj.y, g.proj.color);

    // cannon
    ctx.save(); ctx.translate(CANNON_X, CANNON_Y); ctx.rotate(g.aim);
    ctx.fillStyle = "#334155";
    ctx.beginPath(); ctx.roundRect(-6, -10, 34, 20, 6); ctx.fill(); ctx.restore();
    ctx.save(); ctx.shadowColor = COLORS[g.current % COLORS.length];
    ctx.shadowBlur = 14; ctx.fillStyle = "#151530";
    ctx.beginPath(); ctx.arc(CANNON_X, CANNON_Y, 20, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    orb(CANNON_X, CANNON_Y, g.current, 12);

    // next preview
    ctx.font = "10px ui-monospace, monospace"; ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("NEXT", CANNON_X + 34, CANNON_Y + 2);
    orb(CANNON_X + 76, CANNON_Y + 2, g.next, 11);
    ctx.textAlign = "center";

    // aim guide
    ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 2; ctx.setLineDash([3, 9]);
    ctx.beginPath();
    ctx.moveTo(CANNON_X + Math.cos(g.aim) * 26, CANNON_Y + Math.sin(g.aim) * 26);
    ctx.lineTo(CANNON_X + Math.cos(g.aim) * 150, CANNON_Y + Math.sin(g.aim) * 150);
    ctx.stroke(); ctx.setLineDash([]);

    if (g.comboT > 0) {
      ctx.fillStyle = "#fde047"; ctx.font = "bold 18px ui-monospace, monospace";
      ctx.fillText(`COMBO ×${g.combo}  +${g.comboPts}`, W / 2, 320);
    }
    if (g.bannerT > 0) {
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 26px ui-monospace, monospace";
      ctx.fillText(g.banner, W / 2, 240);
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
    if (!gameRef.current) gameRef.current = createGame();
    draw(performance.now());
  }, [draw]);

  /* ---------------- logic ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setLevel(1);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const clearRuns = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    let gained = 0;
    let guard = 0;
    let again = true;
    while (again && guard < 24) {
      again = false;
      guard += 1;
      const chain = g.chain;
      let i = 0;
      while (i < chain.length) {
        let j = i;
        while (j + 1 < chain.length && chain[j + 1].color === chain[i].color && chain[j].s - chain[j + 1].s <= SPACING + 1.5) j += 1;
        if (j - i + 1 >= 3) {
          g.combo += 1;
          gained += (j - i + 1) * 10 * g.combo;
          g.chain = chain.slice(0, i).concat(chain.slice(j + 1));
          again = true;
          break;
        }
        i = j + 1;
      }
    }
    if (gained > 0) {
      g.comboPts = gained;
      g.comboT = 95;
      g.score += gained;
      setScore(g.score);
    }
  }, []);

  /** Advances one frame. Returns false when the run ends. */
  const step = useCallback((): boolean => {
    const g = gameRef.current;
    if (!g) return false;

    if (g.bannerT > 0) g.bannerT -= 1;
    if (g.comboT > 0) { g.comboT -= 1; if (g.comboT === 0) g.combo = 0; }

    const adv = g.speed * (STEP / 1000);
    let prevS = Number.POSITIVE_INFINITY;
    g.chain = g.chain.map((o, i) => {
      const s = i === 0 ? o.s + adv : Math.min(o.s + adv, prevS - SPACING);
      prevS = s;
      return s === o.s ? o : { ...o, s };
    });

    if (g.proj) {
      const p = g.proj;
      const nx = p.x + p.vx * (STEP / 1000);
      const ny = p.y + p.vy * (STEP / 1000);
      let hitIdx = -1;
      for (let i = 0; i < g.chain.length; i++) {
        const o = g.chain[i];
        if (o.s < -ORB_R) continue;
        const pos = pathPos(o.s);
        if (Math.hypot(nx - pos.x, ny - pos.y) < ORB_R * 2 - 3) { hitIdx = i; break; }
      }

      if (hitIdx >= 0) {
        const hit = g.chain[hitIdx];
        const hp = pathPos(hit.s);
        const ahead = (nx - hp.x) * hp.tx + (ny - hp.y) * hp.ty > 0;
        const idx = ahead ? hitIdx : hitIdx + 1;
        const s = idx === 0 ? g.chain[0].s + SPACING : g.chain[idx - 1].s - SPACING;
        const arr = g.chain.slice();
        arr.splice(idx, 0, { color: p.color, s });
        for (let k = idx + 1; k < arr.length; k++) {
          const cap = arr[k - 1].s - SPACING;
          if (arr[k].s > cap) arr[k] = { ...arr[k], s: cap };
        }
        g.chain = arr;
        g.proj = null;
      } else if (nx < -20 || nx > W + 20 || ny < -20 || ny > H + 20) {
        g.proj = null;
      } else {
        p.x = nx;
        p.y = ny;
      }
    }

    // matches clear as soon as they exist — chain reactions keep the combo alive
    clearRuns();

    if (g.chain.length > 0 && g.chain[0].s >= PATH_LEN) { g.alive = false; return false; }

    if (g.chain.length === 0) {
      g.level += 1;
      setLevel(g.level);
      g.chain = buildChain(g.level);
      g.speed = chainSpeed(g.level);
      g.proj = null;
      g.current = g.next;
      g.next = Math.floor(Math.random() * COLORS.length);
      g.banner = g.level <= 3 ? `LEVEL ${g.level}` : `WAVE ${g.level}`;
      g.bannerT = 90;
    }

    return true;
  }, [clearRuns]);

  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (t: number) => {
      const dt = Math.min(t - last, 250);
      last = t;
      acc += dt;
      let alive = true;
      while (acc >= STEP && alive) { acc -= STEP; alive = step(); }
      if (!alive) {
        const g = gameRef.current;
        const final = g ? g.score : 0;
        setScore(final);
        setNewBest(submit(final));
        setStatus("over");
        draw(t);
        return;
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, step, draw, submit]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  const aimAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const g = gameRef.current;
    if (!g) return;
    g.aim = Math.atan2(y - CANNON_Y, x - CANNON_X);
  };

  const shoot = () => {
    const g = gameRef.current;
    if (!g || g.proj) return;
    g.proj = {
      x: CANNON_X + Math.cos(g.aim) * 24,
      y: CANNON_Y + Math.sin(g.aim) * 24,
      vx: Math.cos(g.aim) * SHOT_SPEED,
      vy: Math.sin(g.aim) * SHOT_SPEED,
      color: g.current,
    };
    g.current = g.next;
    g.next = Math.floor(Math.random() * COLORS.length);
  };

  const swap = () => {
    const g = gameRef.current;
    if (!g) return;
    const c = g.current;
    g.current = g.next;
    g.next = c;
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        if (status === "playing") swap();
      } else if (key === " " || key === "enter") {
        e.preventDefault();
        if (status !== "playing") start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "playing") { start(); return; }
    aimAt(e);
    shoot();
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-cyan-400">Lvl <b className="ml-1 text-sm text-ink">{level}</b></span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(34,211,238,0.85)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          onPointerMove={(e) => { if (status === "playing") aimAt(e); }}
          onPointerDown={onPointerDown}
          aria-label="Orb Cascade chain board"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">ORB CASCADE</p>
            <p className="mt-2 text-sm text-muted">Line up your orbs with the creeping chain. Match three and let the cascade roll.</p>
            <PrimaryButton onClick={start} tone="from-violet-500 via-purple-500 to-fuchsia-500">Start game</PrimaryButton>
            <p className="mt-3 text-xs text-muted">Mouse to aim · click to shoot · S swaps the next orb</p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">CHAIN OVERRUN</p>
            {newBest && <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">✦ New best score!</p>}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">Reached level {level} · Best {best ?? "—"}</p>
            <PrimaryButton onClick={start} tone="from-violet-500 via-purple-500 to-fuchsia-500">Play again</PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">Aim with the mouse · click to fire · S swaps · don&apos;t let the chain reach the socket</p>
    </div>
  );
}
