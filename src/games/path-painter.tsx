"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { Overlay, PrimaryButton } from "./parts";

const W = 380;
const H = 470;
const BALL_R = 9;
const SPEED = 200; // px per second
const WALL_PAD = BALL_R + 3;
const COLLECT_R = 16;
const START_R = 26;
const GOAL_R = 22;

type Vec2 = [number, number];

interface Level {
  name: string;
  start: Vec2;
  goal: Vec2;
  hazards: [number, number, number][];
  walls: [number, number, number, number][];
  stars: Vec2[];
}

interface Pt {
  x: number;
  y: number;
}

/* Handcrafted levels — geometry checked so a clean line always exists. */
const LEVELS: Level[] = [
  { name: "First Turn", start: [46, 420], goal: [334, 58], walls: [],
    hazards: [[124, 404, 20], [276, 254, 22]], stars: [[118, 330], [190, 240], [268, 150]] },
  { name: "The Bar", start: [52, 60], goal: [330, 412], walls: [[160, 200, 24, 170]],
    hazards: [[176, 112, 20], [58, 300, 22], [242, 330, 20]], stars: [[190, 60], [110, 280], [220, 412]] },
  { name: "Needle", start: [48, 424], goal: [332, 424], walls: [[150, 60, 24, 130], [206, 60, 24, 130]],
    hazards: [[118, 190, 26], [262, 190, 26], [190, 380, 24]], stars: [[48, 320], [190, 185], [332, 320]] },
  { name: "Switchback", start: [44, 60], goal: [336, 414], walls: [[150, 172, 80, 20], [150, 282, 80, 20]],
    hazards: [[190, 105, 24], [190, 205, 24], [190, 318, 24], [120, 380, 20]], stars: [[190, 150], [190, 260], [120, 414]] },
  { name: "Corridor", start: [52, 420], goal: [330, 60], walls: [[84, 90, 200, 18], [84, 240, 200, 18]],
    hazards: [[110, 300, 22], [180, 200, 24], [250, 120, 20], [292, 300, 22]], stars: [[52, 240], [200, 60], [292, 60]] },
  { name: "Crossroads", start: [50, 60], goal: [330, 410], walls: [[150, 150, 24, 50], [150, 300, 24, 60], [240, 200, 100, 20]],
    hazards: [[122, 128, 24], [262, 128, 24], [122, 342, 24], [266, 300, 26]], stars: [[50, 160], [120, 235], [260, 410]] },
  { name: "Gate", start: [46, 235], goal: [334, 235], walls: [[120, 120, 140, 16], [150, 380, 80, 18]],
    hazards: [[116, 178, 30], [190, 320, 26], [264, 178, 30]], stars: [[46, 150], [190, 90], [334, 150]] },
  { name: "Ring Road", start: [50, 412], goal: [330, 412], walls: [[90, 200, 200, 18], [90, 270, 200, 18]],
    hazards: [[120, 350, 22], [190, 130, 30], [262, 350, 22], [110, 170, 20], [272, 170, 20]], stars: [[50, 240], [190, 60], [330, 240]] },
  { name: "Zigzag Alley", start: [44, 60], goal: [336, 420], walls: [[230, 80, 80, 24], [66, 172, 80, 24], [230, 272, 80, 24]],
    hazards: [[190, 105, 20], [190, 200, 20], [190, 295, 20], [190, 380, 22]], stars: [[240, 150], [140, 250], [240, 340]] },
  { name: "Gauntlet", start: [50, 420], goal: [330, 60], walls: [[84, 190, 130, 18], [160, 280, 66, 18]],
    hazards: [[110, 150, 26], [190, 150, 26], [270, 150, 26], [190, 396, 26], [50, 120, 20]], stars: [[110, 240], [190, 330], [330, 150]] },
  { name: "Pinball", start: [46, 424], goal: [334, 46], walls: [[170, 240, 90, 18]],
    hazards: [[100, 350, 26], [220, 330, 26], [216, 288, 24], [66, 160, 24], [296, 130, 22], [176, 60, 22]],
    stars: [[46, 360], [200, 380], [176, 100], [334, 110]] },
  { name: "Grand Tour", start: [50, 424], goal: [50, 46], walls: [[200, 378, 120, 18], [170, 216, 120, 18], [60, 136, 100, 16]],
    hazards: [[160, 400, 26], [240, 310, 24], [70, 230, 24], [200, 150, 24], [270, 150, 24], [100, 90, 22]],
    stars: [[180, 350], [210, 270], [225, 190], [190, 78], [120, 230]] },
];

function pointInExpanded(p: Pt, r: [number, number, number, number], m: number): boolean {
  return p.x >= r[0] - m && p.x <= r[0] + r[2] + m && p.y >= r[1] - m && p.y <= r[1] + r[3] + m;
}

function segsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
}

/** A drawn segment is rejected if it would clip a wall or leave the pit. */
function segBlocked(a: Pt, b: Pt, level: Level): boolean {
  const out = (p: Pt) => p.x < WALL_PAD || p.x > W - WALL_PAD || p.y < WALL_PAD || p.y > H - WALL_PAD;
  if (out(a) || out(b)) return true;
  for (const w of level.walls) {
    if (pointInExpanded(a, w, WALL_PAD) || pointInExpanded(b, w, WALL_PAD)) return true;
    const [x, y, rw, rh] = w;
    const x1 = x - WALL_PAD, y1 = y - WALL_PAD, x2 = x + rw + WALL_PAD, y2 = y + rh + WALL_PAD;
    const corners: Pt[] = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
    for (let i = 0; i < 4; i++) {
      if (segsCross(a, b, corners[i], corners[(i + 1) % 4])) return true;
    }
  }
  return false;
}

/** Glowing ring used for the start pad and the goal cup. */
function ring(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, color: string, fill: string,
) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

/** Position of the ball `dist` px along the polyline. */
function pointAt(path: Pt[], cum: number[], dist: number): Pt {
  for (let i = 1; i < path.length; i++) {
    if (dist <= cum[i]) {
      const seg = cum[i] - cum[i - 1];
      const t = seg === 0 ? 0 : (dist - cum[i - 1]) / seg;
      return {
        x: path[i - 1].x + (path[i].x - path[i - 1].x) * t,
        y: path[i - 1].y + (path[i].y - path[i - 1].y) * t,
      };
    }
  }
  return path[path.length - 1];
}

export default function PathPainter({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [levelIdx, setLevelIdx] = useState(0);
  const [path, setPathState] = useState<Pt[]>([]);
  const [collected, setCollectedState] = useState<number[]>([]);
  const [status, setStatus] = useState<"ready" | "rolling" | "cleared">("ready");
  const [cleared, setCleared] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { best, submit } = useBestScore(gameId, "high");

  const pathRef = useRef<Pt[]>([]);
  const collectedRef = useRef<number[]>([]);
  const drawingRef = useRef(false);
  const rollRef = useRef({ cum: [0], total: 0, dist: 0, x: 0, y: 0 });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const level = LEVELS[levelIdx];

  const applyPath = useCallback((next: Pt[]) => {
    pathRef.current = next;
    setPathState(next);
  }, []);

  const applyCollected = useCallback((next: number[]) => {
    collectedRef.current = next;
    setCollectedState(next);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const draw = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const lv = LEVELS[levelIdx];
      if (!canvas || !ctx || !lv) return;

      ctx.fillStyle = "#0b0b16";
      ctx.fillRect(0, 0, W, H);

      // faint dot grid
      ctx.fillStyle = "rgba(139, 92, 246, 0.10)";
      for (let x = 20; x < W; x += 30) {
        for (let y = 20; y < H; y += 30) {
          ctx.beginPath();
          ctx.arc(x, y, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // walls
      for (const [x, y, w, h] of lv.walls) {
        ctx.fillStyle = "#1d1d33";
        ctx.strokeStyle = "#3d3d66";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();
        ctx.stroke();
      }

      // hazards (pulsing glow)
      const pulse = 1 + Math.sin(t / 260) * 0.05;
      for (const [x, y, r] of lv.hazards) {
        ctx.save();
        ctx.shadowColor = "#fb7185";
        ctx.shadowBlur = 16;
        ctx.fillStyle = "rgba(244, 63, 94, 0.20)";
        ctx.strokeStyle = "#fb7185";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, r * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // start pad + goal cup
      ring(ctx, lv.start[0], lv.start[1], START_R - 6, "#22d3ee", "rgba(34, 211, 238, 0.14)");
      ring(ctx, lv.goal[0], lv.goal[1], GOAL_R - 5, "#fbbf24", "rgba(251, 191, 36, 0.16)");

      // stars
      ctx.font = "16px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      lv.stars.forEach(([x, y], i) => {
        ctx.globalAlpha = collected.includes(i) ? 0.22 : 1;
        ctx.fillText("⭐", x, y);
      });
      ctx.globalAlpha = 1;

      // drawn path
      if (path.length > 1) {
        ctx.strokeStyle = "rgba(34, 211, 238, 0.75)";
        ctx.lineWidth = 6;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      // ball
      const bx = status === "rolling" ? rollRef.current.x : lv.start[0];
      const by = status === "rolling" ? rollRef.current.y : lv.start[1];
      ctx.save();
      ctx.shadowColor = "#e2e8f0";
      ctx.shadowBlur = 12;
      const grad = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, BALL_R);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, "#94a3b8");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    [levelIdx, path, collected, status],
  );

  // canvas setup + repaint whenever the scene changes
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

  const launch = useCallback((pts: Pt[]) => {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    rollRef.current = { cum, total: cum[cum.length - 1], dist: 0, x: pts[0].x, y: pts[0].y };
    setStatus("rolling");
  }, []);

  const failAttempt = useCallback(() => {
    applyPath([]);
    applyCollected([]);
    setStatus("ready");
    setToast("💥 Hit a hazard — redraw the path");
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1700);
  }, [applyPath, applyCollected]);

  const succeed = useCallback(() => {
    const total = cleared + 1;
    setCleared(total);
    setNewBest(submit(total));
    setStatus("cleared");
  }, [cleared, submit]);

  useEffect(() => {
    if (status !== "rolling") return;
    let raf = 0;
    let last = performance.now();

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const roll = rollRef.current;
      roll.dist += SPEED * dt;
      const lv = LEVELS[levelIdx];
      const pos = pointAt(path, roll.cum, roll.dist);
      roll.x = pos.x;
      roll.y = pos.y;

      lv.stars.forEach(([sx, sy], i) => {
        if (!collectedRef.current.includes(i) && Math.hypot(sx - pos.x, sy - pos.y) < COLLECT_R) {
          applyCollected([...collectedRef.current, i]);
        }
      });

      const hit = lv.hazards.some(([hx, hy, hr]) => Math.hypot(hx - pos.x, hy - pos.y) < hr + BALL_R);
      if (hit) return failAttempt();
      if (roll.dist >= roll.total) return succeed();

      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, levelIdx, path, draw, failAttempt, succeed, applyCollected]);

  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top) * (H / rect.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "ready") return;
    const p = toLocal(e);
    const pts = pathRef.current;
    const end = pts[pts.length - 1];
    const nearEnd = end ? Math.hypot(p.x - end.x, p.y - end.y) < 16 : false;
    const inStart = Math.hypot(p.x - level.start[0], p.y - level.start[1]) < START_R;
    if (!inStart && !nearEnd) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    if (inStart) applyPath([{ x: level.start[0], y: level.start[1] }]);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || status !== "ready") return;
    const pts = pathRef.current;
    const last = pts[pts.length - 1];
    if (!last) return;
    const p = toLocal(e);
    if (Math.hypot(p.x - last.x, p.y - last.y) < 7) return;
    if (segBlocked(last, p, level)) return; // walls stop the pen
    applyPath([...pts, p]);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer may already be gone */
    }
    const pts = pathRef.current;
    const end = pts[pts.length - 1];
    if (end && pts.length >= 2 && Math.hypot(end.x - level.goal[0], end.y - level.goal[1]) < GOAL_R) {
      launch(pts);
    }
  };

  const clearPath = useCallback(() => {
    if (status !== "ready") return;
    applyPath([]);
    applyCollected([]);
  }, [status, applyPath, applyCollected]);

  const nextLevel = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setLevelIdx((i) => (i + 1) % LEVELS.length);
    applyPath([]);
    applyCollected([]);
    setToast(null);
    setNewBest(false);
    setStatus("ready");
  }, [applyPath, applyCollected]);

  return (
    <div className="w-full max-w-[440px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>Level <b className="ml-1 text-sm text-ink">{levelIdx + 1}/{LEVELS.length}</b></span>
        <div className="flex items-center gap-3">
          <span className="text-warn">⭐ <b className="ml-0.5 text-sm text-ink tabular-nums">{collected.length}</b></span>
          <span className="text-success">Cleared <b className="ml-1 text-sm text-ink tabular-nums">{cleared}</b></span>
          <span className="text-accent">Best <b className="ml-1 text-sm text-ink tabular-nums">{best ?? "—"}</b></span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-24px_rgba(52,211,153,0.75)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          style={{ aspectRatio: `${W} / ${H}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label={`Path Painter level ${levelIdx + 1}: ${level.name}`}
        />

        {toast && (
          <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full border border-rose-500/40 bg-black/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-rose-300">{toast}</p>
        )}
        {status === "cleared" && (
          <Overlay>
            <p className="text-4xl">🏁</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">{level.name.toUpperCase()} CLEARED</p>
            <p className="mt-2 font-mono text-3xl font-bold text-white">⭐ {collected.length}/{level.stars.length}</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best run!
              </p>
            )}
            <p className="mt-2 text-xs uppercase tracking-widest text-muted">Cleared {cleared} · best {best ?? "—"}</p>
            <PrimaryButton onClick={nextLevel} tone="from-lime-400 via-emerald-500 to-teal-600">
              Next level
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Drag from the pad to the cup · release to roll · stars are bonus</p>
        <button
          type="button"
          onClick={clearPath}
          disabled={status !== "ready" || path.length === 0}
          aria-label="Clear the drawn path"
          className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-ink disabled:opacity-35"
        >
          ⟲ Clear
        </button>
      </div>
    </div>
  );
}
