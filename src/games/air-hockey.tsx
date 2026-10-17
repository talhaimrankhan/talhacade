"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { Overlay, PrimaryButton } from "./parts";

const W = 420;
const H = 560;
const PUCK_R = 11;
const MALLET_R = 23;
const GOAL_W = 132;
const WIN_SCORE = 7;
const FRICTION = 0.9955;
const MAX_SPEED = 16;
const MIN_SPEED = 1.4;
const CPU_SPEED = 4.3;

type Status = "idle" | "playing" | "over";

interface Puck {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Mallet {
  x: number;
  y: number;
  px: number;
  py: number;
}

interface Match {
  puck: Puck;
  player: Mallet;
  cpu: Mallet;
  pScore: number;
  cScore: number;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function makeMallet(x: number, y: number): Mallet {
  return { x, y, px: x, py: y };
}

function createMatch(): Match {
  return {
    puck: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    player: makeMallet(W / 2, H - 90),
    cpu: makeMallet(W / 2, 90),
    pScore: 0,
    cScore: 0,
  };
}

/** Circle-vs-mallet bounce. Returns true when they touched. */
function bounceOff(puck: Puck, m: Mallet, mvx: number, mvy: number) {
  const dx = puck.x - m.x;
  const dy = puck.y - m.y;
  const dist = Math.hypot(dx, dy);
  const min = PUCK_R + MALLET_R;
  if (dist >= min || dist < 0.0001) return false;

  const nx = dx / dist;
  const ny = dy / dist;
  puck.x = m.x + nx * min;
  puck.y = m.y + ny * min;

  const rvx = puck.vx - mvx;
  const rvy = puck.vy - mvy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    puck.vx -= 1.7 * vn * nx;
    puck.vy -= 1.7 * vn * ny;
  }
  puck.vx += mvx * 0.5;
  puck.vy += mvy * 0.5;
  return true;
}

function clampSpeed(puck: Puck) {
  const speed = Math.hypot(puck.vx, puck.vy);
  if (speed > MAX_SPEED) {
    puck.vx = (puck.vx / speed) * MAX_SPEED;
    puck.vy = (puck.vy / speed) * MAX_SPEED;
  } else if (speed < MIN_SPEED && speed > 0.001) {
    puck.vx = (puck.vx / speed) * MIN_SPEED;
    puck.vy = (puck.vy / speed) * MIN_SPEED;
  }
}

export default function AirHockey({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Match | null>(null);
  if (gameRef.current === null) gameRef.current = createMatch();

  const [status, setStatus] = useState<Status>("idle");
  const [pScore, setPScore] = useState(0);
  const [cScore, setCScore] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const targetRef = useRef({ x: W / 2, y: H - 90 });
  const cdRef = useRef(0);
  const bestRef = useRef(best);

  // keep the freshest stored "games won" available inside the RAF closure
  useEffect(() => {
    bestRef.current = best;
  }, [best]);

  /* ---------------- drawing ---------------- */

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    // rink
    const table = ctx.createLinearGradient(0, 0, 0, H);
    table.addColorStop(0, "#131327");
    table.addColorStop(0.5, "#1b1b36");
    table.addColorStop(1, "#131327");
    ctx.fillStyle = table;
    ctx.fillRect(0, 0, W, H);

    // centre line + circle
    ctx.strokeStyle = "rgba(139, 92, 246, 0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 54, 0, Math.PI * 2);
    ctx.stroke();

    // goal mouths (top = CPU's net, bottom = yours)
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(237, 237, 247, 0.35)";
    ctx.fillStyle = "rgba(34, 211, 238, 0.22)";
    ctx.fillRect(W / 2 - GOAL_W / 2, 0, GOAL_W, 9);
    ctx.strokeRect(W / 2 - GOAL_W / 2, 0, GOAL_W, 9);
    ctx.fillStyle = "rgba(244, 114, 182, 0.22)";
    ctx.fillRect(W / 2 - GOAL_W / 2, H - 9, GOAL_W, 9);
    ctx.strokeRect(W / 2 - GOAL_W / 2, H - 9, GOAL_W, 9);

    // half-way divider tint for the player's half
    ctx.fillStyle = "rgba(34, 211, 238, 0.04)";
    ctx.fillRect(0, H / 2, W, H / 2);

    // mallets
    const drawMallet = (m: Mallet, main: string, glow: string) => {
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = 18;
      ctx.fillStyle = main;
      ctx.beginPath();
      ctx.arc(m.x, m.y, MALLET_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.arc(m.x, m.y, MALLET_R * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    drawMallet(g.cpu, "#fb7185", "#f43f5e");
    drawMallet(g.player, "#22d3ee", "#22d3ee");

    // puck
    ctx.save();
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(g.puck.x, g.puck.y, PUCK_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // kickoff countdown
    if (cdRef.current > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(7, 7, 14, 0.35)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "700 72px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(cdRef.current), W / 2, H / 2);
      ctx.restore();
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

  const scorePoint = useCallback(
    (forPlayer: boolean) => {
      const g = gameRef.current;
      if (!g) return;
      if (forPlayer) {
        g.pScore += 1;
        setPScore(g.pScore);
      } else {
        g.cScore += 1;
        setCScore(g.cScore);
      }
      g.puck.x = W / 2;
      g.puck.y = H / 2;
      g.puck.vx = 0;
      g.puck.vy = 0;      if (g.pScore >= WIN_SCORE || g.cScore >= WIN_SCORE) {
        setStatus("over");
        if (g.pScore >= WIN_SCORE) setNewBest(submit((bestRef.current ?? 0) + 1));
        return;
      }
      cdRef.current = 3;
      setCountdown(3);
    },
    [submit],
  );

  const tick = useCallback(
    (f: number) => {
      const g = gameRef.current;
      if (!g) return;

      // player mallet chases the pointer, clamped to its own half
      const p = g.player;
      p.px = p.x;
      p.py = p.y;
      const target = targetRef.current;
      p.x += (target.x - p.x) * Math.min(1, 0.55 * f);
      p.y += (clamp(target.y, H / 2 + MALLET_R, H - MALLET_R - 4) - p.y) * Math.min(1, 0.55 * f);
      p.x = clamp(p.x, MALLET_R + 4, W - MALLET_R - 4);
      p.y = clamp(p.y, H / 2 + MALLET_R, H - MALLET_R - 4);

      // CPU: hold a defensive point, chase when the puck comes close
      const c = g.cpu;
      c.px = c.x;
      c.py = c.y;
      const puck = g.puck;
      const chase = puck.y < c.y + 26 && puck.y < H / 2;
      const ax = chase ? puck.x : clamp(puck.x, MALLET_R + 6, W - MALLET_R - 6);
      const ay = chase
        ? puck.y + 10
        : clamp(puck.y - 58, MALLET_R + 6, H / 2 - MALLET_R - 6);
      const ddx = ax - c.x;
      const ddy = ay - c.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      const step = Math.min(dist, CPU_SPEED * f);
      c.x = clamp(c.x + (ddx / dist) * step, MALLET_R + 4, W - MALLET_R - 4);
      c.y = clamp(c.y + (ddy / dist) * step, MALLET_R + 4, H / 2 - MALLET_R - 4);

      // puck physics (paused during the kickoff countdown)
      if (cdRef.current > 0) return;

      puck.x += puck.vx * f;
      puck.y += puck.vy * f;
      puck.vx *= FRICTION ** f;
      puck.vy *= FRICTION ** f;

      // side walls
      if (puck.x < PUCK_R) {
        puck.x = PUCK_R;
        puck.vx = Math.abs(puck.vx) * 0.98;
      } else if (puck.x > W - PUCK_R) {
        puck.x = W - PUCK_R;
        puck.vx = -Math.abs(puck.vx) * 0.98;
      }

      const inGap = Math.abs(puck.x - W / 2) < GOAL_W / 2;

      // top / bottom walls (open at the goals)
      if (!inGap) {
        if (puck.y < PUCK_R) {
          puck.y = PUCK_R;
          puck.vy = Math.abs(puck.vy) * 0.98;
        } else if (puck.y > H - PUCK_R) {
          puck.y = H - PUCK_R;
          puck.vy = -Math.abs(puck.vy) * 0.98;
        }
      } else if (puck.y < -PUCK_R) {
        scorePoint(true); // pucked through the CPU goal
        return;
      } else if (puck.y > H + PUCK_R) {
        scorePoint(false);
        return;
      }

      // mallet collisions
      bounceOff(puck, p, p.x - p.px, p.y - p.py);

      if (bounceOff(puck, c, c.x - c.px, c.y - c.py) && puck.y < c.y) {
        // CPU strike: aim at the player's goal with a little error
        const aimX = W / 2 + (Math.random() * 70 - 35);
        const angle =
          Math.atan2(H + 40 - puck.y, aimX - puck.x) + (Math.random() * 0.24 - 0.12);
        const power = 7.5 + Math.random() * 2.5;
        puck.vx = Math.cos(angle) * power;
        puck.vy = Math.sin(angle) * power;
      }

      clampSpeed(puck);
    },
    [scorePoint],
  );

  // main loop
  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();

    const loop = (t: number) => {
      const f = Math.min((t - last) / 16.667, 2);
      last = t;
      tick(f);
      draw();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, tick, draw]);

  // kickoff countdown — the tick lives in a timer callback, never the effect body
  useEffect(() => {
    if (cdRef.current <= 0) return;
    const id = setTimeout(() => {
      cdRef.current -= 1;
      setCountdown(cdRef.current);
      if (cdRef.current === 0) {
        const g = gameRef.current;
        if (g) {
          g.puck.vx = Math.random() * 4 - 2;
          g.puck.vy = Math.random() < 0.5 ? 3 : -3;
        }
      }
    }, 700);
    return () => clearTimeout(id);
  }, [countdown]);

  // idle / finished frames
  useEffect(() => {
    if (status !== "playing") draw();
  }, [status, draw]);

  const start = useCallback(() => {
    gameRef.current = createMatch();
    targetRef.current = { x: W / 2, y: H - 90 };
    cdRef.current = 3;
    setPScore(0);
    setCScore(0);
    setCountdown(3);
    setNewBest(false);
    setStatus("playing");
  }, []);

  /* ---------------- input ---------------- */

  const movePointer = (clientX: number, clientY: number, el: HTMLCanvasElement) => {
    const rect = el.getBoundingClientRect();
    targetRef.current = {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  return (
    <div className="w-full max-w-[460px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          You <b className="ml-1 text-sm tabular-nums text-cyan-400">{pScore}</b>
          <span className="mx-1">—</span>
          <b className="text-sm tabular-nums text-rose-400">{cScore}</b> CPU
        </span>
        <span className="text-warn">
          Games won <b className="ml-1 text-sm text-ink">{best ?? "—"}</b>
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(34,211,238,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          onPointerMove={(e) => movePointer(e.clientX, e.clientY, e.currentTarget)}
          onPointerDown={(e) => {
            e.preventDefault();
            movePointer(e.clientX, e.clientY, e.currentTarget);
            if (status !== "playing") start();
          }}
          aria-label="Air hockey rink"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">AIR HOCKEY</p>
            <p className="mt-2 text-sm text-muted">
              First to {WIN_SCORE} takes the match. Keep the puck out of your net.
            </p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">
              New match
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Move the pointer to drive your mallet</p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {pScore >= WIN_SCORE ? "YOU WIN" : "CPU WINS"}
            </p>
            {pScore >= WIN_SCORE && newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New record!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{pScore} — {cScore}</p>
            <p className="text-xs uppercase tracking-wider text-muted">Games won {best ?? "—"}</p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">
              New match
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Drive the mallet with your pointer · sink {WIN_SCORE} goals to win
      </p>    </div>
  );
}
