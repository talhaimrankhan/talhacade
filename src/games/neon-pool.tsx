"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 640;
const H = 360;
const R = 9;
const POCKET_R = 15;
const FRICTION = 0.985;
const BOUNCE = 0.94;
const CUSH = 16;
const L = CUSH + R;
const RIGHT = W - CUSH - R;
const T = CUSH + R;
const BOT = H - CUSH - R;
const MAX_PULL = 150;
const MIN_PULL = 14;
const KITCHEN = W * 0.26;

type Group = "solid" | "stripe";
type Phase = "idle" | "aim" | "place" | "sim" | "cpu" | "over";
type Pt = { x: number; y: number };
interface Ball {
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  potted: boolean;
}
interface Shot {
  dir: Pt;
  power: number;
}

const POCKETS: Pt[] = [
  { x: CUSH, y: CUSH },
  { x: W / 2, y: CUSH },
  { x: W - CUSH, y: CUSH },
  { x: CUSH, y: H - CUSH },
  { x: W / 2, y: H - CUSH },
  { x: W - CUSH, y: H - CUSH },
];
const COLORS: Record<number, string> = {
  1: "#fbbf24", 2: "#3b82f6", 3: "#ef4444", 4: "#a855f7", 5: "#f97316",
  6: "#22c55e", 7: "#b91c1c", 8: "#111827", 9: "#fbbf24", 10: "#3b82f6",
  11: "#ef4444", 12: "#a855f7", 13: "#f97316", 14: "#22c55e", 15: "#b91c1c",
};

function rack(): Ball[] {
  const balls: Ball[] = [
    { n: 0, x: W * 0.26, y: H / 2, vx: 0, vy: 0, potted: false },
  ];
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  const dx = R * 2 * Math.cos(Math.PI / 6);
  let k = 0;
  for (let row = 0; row < 5; row++)
    for (let i = 0; i <= row; i++)
      balls.push({
        n: order[k++],
        x: W * 0.64 + row * dx,
        y: H / 2 + (i - row / 2) * (R * 2 + 0.6),
        vx: 0,
        vy: 0,
        potted: false,
      });
  return balls;
}

const isMoving = (balls: Ball[]) =>
  balls.some((b) => !b.potted && (b.vx !== 0 || b.vy !== 0));

/** One physics frame: roll, pocket, bounce, collide. Returns potted numbers. */
function stepPhysics(balls: Ball[]): number[] {
  const potted: number[] = [];
  for (const b of balls) {
    if (b.potted) continue;
    b.x += b.vx;
    b.y += b.vy;
    b.vx *= FRICTION;
    b.vy *= FRICTION;
    if (Math.abs(b.vx) < 0.05) b.vx = 0;
    if (Math.abs(b.vy) < 0.05) b.vy = 0;
  }
  for (const b of balls) {
    if (b.potted) continue;
    for (const p of POCKETS) {
      if (Math.hypot(b.x - p.x, b.y - p.y) < POCKET_R) {
        b.potted = true;
        b.vx = 0;
        b.vy = 0;
        potted.push(b.n);
        break;
      }
    }
  }
  for (const b of balls) {
    if (b.potted) continue;
    if (b.x < L) {
      b.x = L;
      b.vx = Math.abs(b.vx) * BOUNCE;
    } else if (b.x > RIGHT) {
      b.x = RIGHT;
      b.vx = -Math.abs(b.vx) * BOUNCE;
    }
    if (b.y < T) {
      b.y = T;
      b.vy = Math.abs(b.vy) * BOUNCE;
    } else if (b.y > BOT) {
      b.y = BOT;
      b.vy = -Math.abs(b.vy) * BOUNCE;
    }
  }
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (a.potted) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (b.potted) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d === 0 || d >= R * 2) continue;
      const nx = dx / d;
      const ny = dy / d;
      const push = (R * 2 - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (vn > 0) {
        a.vx -= vn * nx;
        a.vy -= vn * ny;
        b.vx += vn * nx;
        b.vy += vn * ny;
      }
    }
  }
  return potted;
}

function segClear(balls: Ball[], from: Pt, to: Pt, skip: number[]): boolean {
  const ex = to.x - from.x;
  const ey = to.y - from.y;
  const len2 = ex * ex + ey * ey || 1;
  for (const b of balls) {
    if (b.potted || skip.includes(b.n)) continue;
    const t = Math.max(
      0,
      Math.min(1, ((b.x - from.x) * ex + (b.y - from.y) * ey) / len2),
    );
    if (Math.hypot(b.x - (from.x + ex * t), b.y - (from.y + ey * t)) < R * 2 - 1.5)
      return false;
  }
  return true;
}

const groupOf = (n: number): Group | null =>
  n >= 1 && n <= 7 ? "solid" : n >= 9 ? "stripe" : null;

function legalTargets(balls: Ball[], group: Group | null): Ball[] {
  const live = balls.filter((b) => !b.potted && b.n !== 0 && b.n !== 8);
  if (group === null) return live;
  const own = live.filter((b) => groupOf(b.n) === group);
  return own.length > 0 ? own : balls.filter((b) => !b.potted && b.n === 8);
}

const clearPath = (balls: Ball[], from: Pt, to: Pt, skip: number[]) =>
  to.x >= L &&
  to.x <= RIGHT &&
  to.y >= T &&
  to.y <= BOT &&
  segClear(balls, from, to, skip);

/** Geometric best shot for the CPU, with a little human error sprinkled in. */
function planShot(balls: Ball[], group: Group | null): Shot {
  const cue = balls.find((b) => b.n === 0 && !b.potted);
  const targets = legalTargets(balls, group);
  if (!cue || targets.length === 0) return { dir: { x: 1, y: 0 }, power: 0.5 };

  let best: { shot: Shot; score: number } | null = null;
  for (const t of targets) {
    for (const p of POCKETS) {
      const pd = Math.hypot(p.x - t.x, p.y - t.y) || 1;
      const ux = (p.x - t.x) / pd;
      const uy = (p.y - t.y) / pd;
      const ghost = { x: t.x - ux * R * 2, y: t.y - uy * R * 2 };
      const cg = Math.hypot(ghost.x - cue.x, ghost.y - cue.y) || 1;
      const dirx = (ghost.x - cue.x) / cg;
      const diry = (ghost.y - cue.y) / cg;
      if (dirx * ux + diry * uy < 0.3) continue;
      if (!clearPath(balls, cue, ghost, [0, t.n])) continue;
      if (!clearPath(balls, t, p, [t.n])) continue;
      const score = cg + pd;
      if (!best || score < best.score)
        best = {
          score,
          shot: {
            dir: { x: dirx, y: diry },
            power: Math.max(0.35, Math.min(1, (score + 80) / 640)),
          },
        };
    }
  }

  if (best) {
    const err = (Math.random() * 2 - 1) * 0.035;
    const cos = Math.cos(err);
    const sin = Math.sin(err);
    return {
      dir: {
        x: best.shot.dir.x * cos - best.shot.dir.y * sin,
        y: best.shot.dir.x * sin + best.shot.dir.y * cos,
      },
      power: Math.max(
        0.3,
        Math.min(1, best.shot.power + (Math.random() - 0.5) * 0.16),
      ),
    };
  }

  // no shot on — roll up gently to the nearest legal ball
  const nearest = targets.reduce((a, b) =>
    Math.hypot(a.x - cue.x, a.y - cue.y) <
    Math.hypot(b.x - cue.x, b.y - cue.y)
      ? a
      : b,
  );
  const ang =
    Math.atan2(nearest.y - cue.y, nearest.x - cue.x) +
    (Math.random() * 2 - 1) * 0.06;
  return { dir: { x: Math.cos(ang), y: Math.sin(ang) }, power: 0.4 };
}

function freeSpot(balls: Ball[], p: Pt): boolean {
  if (p.x < L || p.x > KITCHEN || p.y < T || p.y > BOT) return false;
  return balls.every(
    (b) =>
      b.potted || b.n === 0 || Math.hypot(b.x - p.x, b.y - p.y) > R * 2 + 1,
  );
}

function kitchenSpot(balls: Ball[]): Pt {
  for (let i = 0; i < 50; i++) {
    const p = {
      x: L + 6 + Math.random() * Math.max(10, KITCHEN - L - 12),
      y: T + 6 + Math.random() * Math.max(10, BOT - T - 12),
    };
    if (freeSpot(balls, p)) return p;
  }
  return { x: L + 24, y: H / 2 };
}

export default function NeonPool({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<Ball[]>([]);
  const aimRef = useRef({ active: false, x: 0, y: 0 });
  const pottedRef = useRef<number[]>([]);
  const resolvedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [turn, setTurn] = useState<"player" | "cpu">("player");
  const [groups, setGroups] = useState<{ player: Group | null; cpu: Group | null }>({
    player: null,
    cpu: null,
  });
  const [message, setMessage] = useState("Drag back from the cue ball, release to shoot");
  const [newBest, setNewBest] = useState(false);
  const [rackWon, setRackWon] = useState(false);
  const [wins, setWins] = useStored(`wins:${gameId}`, 0);
  const { best, submit } = useBestScore(gameId, "high");

  /* ------------------------------ drawing ------------------------------ */

  const draw = useCallback((phase: Phase) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#07070f";
    ctx.fillRect(0, 0, W, H);

    const felt = ctx.createLinearGradient(0, 0, W, H);
    felt.addColorStop(0, "#0f4a4a");
    felt.addColorStop(1, "#0a2b4a");
    ctx.fillStyle = felt;
    ctx.beginPath();
    ctx.roundRect(CUSH - 6, CUSH - 6, W - (CUSH - 6) * 2, H - (CUSH - 6) * 2, 10);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(5, 5, W - 10, H - 10, 14);
    ctx.stroke();
    ctx.restore();

    for (const p of POCKETS) {
      ctx.fillStyle = "#05050b";
      ctx.beginPath();
      ctx.arc(p.x, p.y, POCKET_R + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(139,92,246,0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (const b of ballsRef.current) {
      if (b.potted) continue;
      const color = b.n === 0 ? "#f8fafc" : COLORS[b.n];
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.n > 8 ? "#f8fafc" : color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (b.n > 8) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = color;
        ctx.fillRect(b.x - R, b.y - R * 0.5, R * 2, R);
        ctx.restore();
      }
      if (b.n > 0) {
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0b0b16";
        ctx.font = "bold 7px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(b.n), b.x, b.y + 0.5);
      }
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
      ctx.stroke();
    }

    const cue = ballsRef.current.find((b) => b.n === 0 && !b.potted);
    if (phase === "aim" && aimRef.current.active && cue) {
      const dx = cue.x - aimRef.current.x;
      const dy = cue.y - aimRef.current.y;
      const pull = Math.hypot(dx, dy);
      if (pull > 1) {
        const ux = dx / pull;
        const uy = dy / pull;
        ctx.strokeStyle = "rgba(34,211,238,0.75)";
        ctx.setLineDash([7, 7]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cue.x + ux * R, cue.y + uy * R);
        ctx.lineTo(cue.x + ux * 240, cue.y + uy * 240);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = "#fb7185";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cue.x, cue.y);
        ctx.lineTo(aimRef.current.x, aimRef.current.y);
        ctx.stroke();
        const power = Math.min(pull, MAX_PULL) / MAX_PULL;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(16, H - 26, 160, 12);
        ctx.fillStyle = power > 0.75 ? "#fb7185" : "#fbbf24";
        ctx.fillRect(16, H - 26, 160 * power, 12);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.strokeRect(16, H - 26, 160, 12);
      }
    }
  }, []);

  // canvas setup + static frames between phases
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ballsRef.current.length === 0) ballsRef.current = rack();
    draw(phase);
  }, [draw, phase]);

  /* ------------------------------ rules ------------------------------ */

  const start = useCallback(() => {
    ballsRef.current = rack();
    pottedRef.current = [];
    resolvedRef.current = false;
    aimRef.current.active = false;
    setTurn("player");
    setGroups({ player: null, cpu: null });
    setMessage("Break time — drag back and let it fly");
    setNewBest(false);
    setRackWon(false);
    setPhase("aim");
  }, []);

  const shoot = useCallback((dir: Pt, power: number) => {
    const cue = ballsRef.current.find((b) => b.n === 0);
    if (!cue || cue.potted) return;
    const speed = 3 + Math.max(0, Math.min(1, power)) * 9;
    cue.vx = dir.x * speed;
    cue.vy = dir.y * speed;
    pottedRef.current = [];
    resolvedRef.current = false;
    setPhase("sim");
  }, []);

  const resolveShot = useCallback(() => {
    const balls = ballsRef.current;
    const potted = pottedRef.current;
    const shooter = turn;
    const other = shooter === "player" ? "cpu" : "player";
    const myGroup = groups[shooter];
    const objects = potted.filter((n) => n !== 0 && n !== 8);
    const who = shooter === "player" ? "You" : "CPU";

    if (potted.includes(8)) {
      const cleared =
        myGroup !== null &&
        !balls.some(
          (b) => !b.potted && b.n !== 0 && b.n !== 8 && groupOf(b.n) === myGroup,
        );
      const playerWon = shooter === "player" ? cleared : !cleared;
      setMessage(
        playerWon
          ? "Eight ball potted — rack won!"
          : "Eight ball down too early — rack lost",
      );
      if (playerWon) {
        const next = wins + 1;
        setWins(next);
        setNewBest(submit(next));
      }
      setRackWon(playerWon);
      setPhase("over");
      return;
    }

    let nextGroups = groups;
    if (groups.player === null && objects.length > 0) {
      const g = groupOf(objects[0]);
      if (g) {
        nextGroups =
          shooter === "player"
            ? { player: g, cpu: g === "solid" ? "stripe" : "solid" }
            : { player: g === "solid" ? "stripe" : "solid", cpu: g };
        setMessage(`${who} potted ${objects[0]} first — groups locked in`);
      }
    }

    const shooterGroup = nextGroups[shooter];
    const continues =
      objects.length > 0 &&
      objects.some((n) => shooterGroup === null || groupOf(n) === shooterGroup);
    const scratch = potted.includes(0);
    setGroups(nextGroups);

    if (scratch) {
      setTurn(other);
      setMessage(
        other === "player"
          ? "Scratch — ball in hand, place it in the kitchen"
          : "Scratch — the CPU has ball in hand",
      );
      setPhase(other === "player" ? "place" : "cpu");
    } else if (continues) {
      setMessage(`${who} potted — shoot again`);
      setPhase(shooter === "player" ? "aim" : "cpu");
    } else {
      setTurn(other);
      setMessage(
        other === "player" ? "Turn over — your shot" : "Turn over — CPU stepping up",
      );
      setPhase(other === "player" ? "aim" : "cpu");
    }
  }, [turn, groups, wins, setWins, submit]);

  // physics loop — runs for every live phase, resolves the shot at rest
  useEffect(() => {
    if (phase === "idle" || phase === "over") return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (t: number) => {
      const dt = Math.min(t - last, 250);
      last = t;
      if (phase === "sim") {
        acc += dt;
        let steps = 0;
        while (acc >= 16.667 && steps < 4) {
          acc -= 16.667;
          steps += 1;
          const fresh = stepPhysics(ballsRef.current);
          if (fresh.length > 0) pottedRef.current.push(...fresh);
        }
        if (acc > 120) acc = 0;
        if (!isMoving(ballsRef.current) && !resolvedRef.current) {
          resolvedRef.current = true;
          resolveShot();
          return;
        }
      } else {
        acc = 0;
      }
      draw(phase);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, draw, resolveShot]);

  // CPU turn: place a scratched cue ball, then play the geometric shot
  useEffect(() => {
    if (phase !== "cpu") return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const balls = ballsRef.current;
      const cue = balls.find((b) => b.n === 0);
      if (!cue) return;
      if (cue.potted) {
        const spot = kitchenSpot(balls);
        cue.potted = false;
        cue.x = spot.x;
        cue.y = spot.y;
        cue.vx = 0;
        cue.vy = 0;
      }
      const shot = planShot(balls, groups.cpu);
      shoot(shot.dir, shot.power);
      setMessage("CPU lines up its shot…");
    }, 950);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, groups.cpu, shoot]);

  /* ------------------------------ input ------------------------------ */

  const toTable = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toTable(e);
    if (phase === "place") {
      const balls = ballsRef.current;
      const cue = balls.find((b) => b.n === 0);
      if (!cue || !freeSpot(balls, pt)) {
        setMessage("Blocked spot — pick a clear spot in the kitchen");
        return;
      }
      cue.potted = false;
      cue.x = pt.x;
      cue.y = pt.y;
      cue.vx = 0;
      cue.vy = 0;
      setMessage("Drag back from the cue ball, release to shoot");
      setPhase("aim");
      return;
    }
    if (phase !== "aim") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    aimRef.current = { active: true, x: pt.x, y: pt.y };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimRef.current.active) return;
    const pt = toTable(e);
    aimRef.current.x = pt.x;
    aimRef.current.y = pt.y;
  };

  const release = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimRef.current.active) return;
    const pt = toTable(e);
    aimRef.current.active = false;
    const cue = ballsRef.current.find((b) => b.n === 0 && !b.potted);
    if (!cue) return;
    const dx = cue.x - pt.x;
    const dy = cue.y - pt.y;
    const pull = Math.hypot(dx, dy);
    if (pull < MIN_PULL) return;
    shoot({ x: dx / pull, y: dy / pull }, Math.min(pull, MAX_PULL) / MAX_PULL);
  };

  /* ------------------------------ view ------------------------------ */

  const groupLabel = (g: Group | null) =>
    g === null ? "open" : g === "solid" ? "solids 1–7" : "stripes 9–15";

  return (
    <div className="w-full max-w-[640px]">
      <GameHud score={wins} best={best ?? "—"}>
        <span className="text-cyan-400">
          Turn <b className="ml-1 text-sm text-ink">{turn === "player" ? "You" : "CPU"}</b>
        </span>
        <span className="text-rose-400">
          You <b className="ml-1 text-sm text-ink">{groupLabel(groups.player)}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(34,211,238,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={release}
          onPointerCancel={() => {
            aimRef.current.active = false;
          }}
          aria-label="Neon Pool table"
        />

        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
          <span className="rounded-full border border-white/20 bg-black/70 px-4 py-1 font-mono text-[11px] uppercase tracking-widest text-ink backdrop-blur">
            {phase === "place" ? "Ball in hand — tap the kitchen" : message}
          </span>
        </div>

        {phase === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">NEON POOL</p>
            <p className="mt-2 text-sm text-muted">
              Slingshot the cue ball, clear your group, then the eight.
            </p>
            <p className="mt-1 text-xs text-muted">
              Scratch and the opponent gets ball in hand.
            </p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">
              Break the rack
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {rackWon ? "RACK WON" : "RACK LOST"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{wins}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Games won · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">
              New rack
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Drag away from the cue ball and release · longer pull, harder shot
      </p>
    </div>
  );
}
