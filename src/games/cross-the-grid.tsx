"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const COLS = 9;
const ROWS = 11;
const CELL = 44;
const W = COLS * CELL;
const H = ROWS * CELL;
const STEP = 16.667;
const HOP_MS = 130;

type Status = "idle" | "playing" | "over";
type RowType = "grass" | "road" | "river";

interface Car { x: number; len: number; color: string }
interface Log { x: number; len: number }
interface Row { type: RowType; dir: number; speed: number; cars: Car[]; logs: Log[] }
interface Token { col: number; row: number; fromCol: number; fromRow: number; toCol: number; toRow: number; t: number; moving: boolean; ride: number }
interface GridGame { rows: Row[]; token: Token; pending: { dc: number; dr: number } | null; camRow: number; furthest: number; alive: boolean }

const CAR_COLORS = ["#f43f5e", "#f59e0b", "#22d3ee", "#a78bfa", "#34d399"];

/** Deterministic pseudo-random in [0,1) for a row index. */
function hash(n: number): number {
  let h = Math.imul(n, 374761393) + 668265263;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rowTypeAt(n: number, cache: RowType[]): RowType {
  while (cache.length <= n) {
    const i = cache.length;
    let t: RowType;
    if (i < 3) t = "grass";
    else {
      const r = hash(i * 7 + 3);
      t = r < 0.4 ? "grass" : r < 0.76 ? "road" : "river";
    }
    const prev = i > 0 ? cache[i - 1] : "grass";
    if (i > 0 && t === "river" && prev === "river") t = "grass";
    if (i > 0 && t === "road" && prev === "road") t = "grass";
    cache.push(t);
  }
  return cache[n];
}

/** Rows are laid out deterministically: grass, then road / river bands. */
function buildRow(n: number, cache: RowType[]): Row {
  const type = rowTypeAt(n, cache);
  const dir = hash(n * 3 + 11) < 0.5 ? 1 : -1;
  const speed = dir * Math.min(4.2, 1.5 + n * 0.045);
  const cars: Car[] = [];
  const logs: Log[] = [];
  const offset = hash(n * 9 + 2) * 160;

  if (type === "road") {
    const len = 68;
    const span = len + 84 + hash(n * 5) * 70;
    for (let i = 0, count = Math.ceil((W + span * 2) / span); i < count; i++) {
      cars.push({ x: -span + offset + i * span, len, color: CAR_COLORS[Math.floor(hash(n * 13 + i) * CAR_COLORS.length)] });
    }
  } else if (type === "river") {
    const len = 98;
    const span = len + 118;
    for (let i = 0, count = Math.ceil((W + span * 2) / span); i < count; i++) {
      logs.push({ x: -span + offset + i * span, len });
    }
  }
  return { type, dir, speed, cars, logs };
}

function ease(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function rowY(r: number, camRow: number): number {
  return H - (r - camRow) * CELL - CELL;
}

function createGame(): GridGame {
  return {
    rows: [],
    token: { col: 4, row: 0, fromCol: 4, fromRow: 0, toCol: 4, toRow: 0, t: 1, moving: false, ride: 0 },
    pending: null, camRow: 0, furthest: 0, alive: true,
  };
}

function ensureRows(g: GridGame, typeCache: RowType[], upTo: number): void {
  for (let i = g.rows.length; i <= upTo; i++) g.rows.push(buildRow(i, typeCache));
}

export default function CrossTheGrid({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<GridGame | null>(null);
  const typeCache = useRef<RowType[]>([]);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    ctx.fillStyle = "#0b0b16";
    ctx.fillRect(0, 0, W, H);

    const first = Math.max(0, Math.floor(g.camRow) - 1);
    for (let r = first, last = first + ROWS + 2; r <= last; r++) {
      const row = g.rows[r];
      if (!row) continue;
      const y = rowY(r, g.camRow);

      if (row.type === "grass") {
        ctx.fillStyle = r % 2 === 0 ? "#101d18" : "#0d1914";
        ctx.fillRect(0, y, W, CELL);
        ctx.fillStyle = "rgba(52, 211, 153, 0.14)";
        for (let c = 0; c < COLS; c++) ctx.fillRect(c * CELL + CELL / 2 - 1.5, y + CELL / 2 - 1.5, 3, 3);
      } else if (row.type === "road") {
        ctx.fillStyle = "#181822";
        ctx.fillRect(0, y, W, CELL);
        ctx.strokeStyle = "rgba(253, 224, 71, 0.35)";
        ctx.lineWidth = 2;
        ctx.setLineDash([14, 16]);
        ctx.beginPath();
        ctx.moveTo(0, y + CELL / 2);
        ctx.lineTo(W, y + CELL / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        for (const car of row.cars) {
          const cy = y + 7;
          const ch = CELL - 14;
          ctx.save();
          ctx.shadowColor = car.color;
          ctx.shadowBlur = 12;
          ctx.fillStyle = car.color;
          ctx.beginPath();
          ctx.roundRect(car.x, cy, car.len, ch, 8);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.beginPath();
          ctx.roundRect(car.x + car.len * 0.45, cy + 4, car.len * 0.35, ch - 8, 4);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "#0c1c30";
        ctx.fillRect(0, y, W, CELL);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.28)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 24) {
          const wob = Math.sin(x * 0.05 + time / 300) * 3;
          if (x === 0) ctx.moveTo(x, y + CELL / 2 + wob);
          else ctx.lineTo(x, y + CELL / 2 + wob);
        }
        ctx.stroke();
        for (const log of row.logs) {
          ctx.fillStyle = "#7c5a3a";
          ctx.beginPath();
          ctx.roundRect(log.x, y + 9, log.len, CELL - 18, 10);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.16)";
          ctx.beginPath();
          ctx.roundRect(log.x + 6, y + 13, log.len - 12, 5, 3);
          ctx.fill();
        }
      }
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, y + 0.5, W - 1, CELL - 1);
    }

    // token
    const tk = g.token;
    const drawCol = tk.moving ? tk.fromCol + (tk.toCol - tk.fromCol) * ease(tk.t) : tk.col;
    const drawRow = tk.moving ? tk.fromRow + (tk.toRow - tk.fromRow) * ease(tk.t) : tk.row;
    const hop = tk.moving ? Math.sin(tk.t * Math.PI) * 12 : 0;
    const px = drawCol * CELL + CELL / 2 + tk.ride;
    const py = rowY(drawRow, g.camRow) + CELL / 2 - hop;

    ctx.save();
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.roundRect(px - 14, py - 14, 28, 28, 9);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#0b0b16";
    ctx.beginPath();
    ctx.arc(px - 4.5, py - 2, 2.6, 0, Math.PI * 2);
    ctx.arc(px + 4.5, py - 2, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(11,11,22,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py + 5, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = gameRef.current;
    if (g) ensureRows(g, typeCache.current, ROWS + 6);
    draw(performance.now());
  }, [draw]);

  /* ---------------- logic ---------------- */

  const start = useCallback(() => {
    const g = createGame();
    typeCache.current = [];
    gameRef.current = g;
    ensureRows(g, typeCache.current, ROWS + 6);
    setScore(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const settle = useCallback((g: GridGame) => {
    const tk = g.token;
    tk.col = tk.toCol;
    tk.row = tk.toRow;
    tk.moving = false;
    tk.t = 1;
    tk.ride = 0;
    if (tk.row > g.furthest) {
      g.furthest = tk.row;
      setScore(g.furthest);
    }
    ensureRows(g, typeCache.current, tk.row + ROWS + 4);
  }, []);

  /** Advances one frame. Returns false when the run ends. */
  const step = useCallback((): boolean => {
    const g = gameRef.current;
    if (!g) return false;
    const tk = g.token;
    ensureRows(g, typeCache.current, tk.row + ROWS + 6);

    // traffic + river drift (rebuilt, never mutated in place)
    if (g.rows.some((r) => r.type !== "grass")) {
      g.rows = g.rows.map((row) => {
        if (row.type === "grass") return row;
        const shift = <T extends { x: number; len: number }>(it: T) => {
          let x = it.x + row.speed;
          if (row.speed > 0 && x > W + 10) x = -it.len - 10;
          if (row.speed < 0 && x + it.len < -10) x = W + 10;
          return { ...it, x };
        };
        if (row.type === "road") return { ...row, cars: row.cars.map(shift) };
        return { ...row, logs: row.logs.map(shift) };
      });
    }

    if (tk.moving) {
      tk.t += STEP / HOP_MS;
      if (tk.t >= 1) settle(g);
    }

    const activeRow = tk.moving ? tk.toRow : tk.row;
    const drawCol = tk.moving ? tk.fromCol + (tk.toCol - tk.fromCol) * ease(tk.t) : tk.col;
    const px = drawCol * CELL + CELL / 2 + tk.ride;
    const row = g.rows[activeRow];

    if (row) {
      if (row.type === "road") {
        for (const car of row.cars) {
          if (px + 11 > car.x && px - 11 < car.x + car.len) return false;
        }
      } else if (row.type === "river" && !tk.moving) {
        const onLog = row.logs.some((log) => px > log.x - 4 && px < log.x + log.len + 4);
        if (!onLog) return false;
        tk.ride += row.speed;
        if (px < 8 || px > W - 8) return false;
      }
    }

    if (!tk.moving && g.pending) {
      const move = g.pending;
      g.pending = null;
      const nc = tk.col + move.dc;
      const nr = tk.row + move.dr;
      if (nc >= 0 && nc < COLS && nr >= 0) {
        tk.fromCol = tk.col;
        tk.fromRow = tk.row;
        tk.toCol = nc;
        tk.toRow = nr;
        tk.t = 0;
        tk.moving = true;
      }
    }

    // camera follows, clamped so the token is always on screen
    const focus = tk.moving ? tk.toRow : tk.row;
    g.camRow += (Math.max(0, focus - 4) - g.camRow) * 0.14;
    g.camRow = Math.max(Math.max(0, focus - (ROWS - 1)), Math.min(focus, g.camRow));
    return true;
  }, [settle]);

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
      while (acc >= STEP && alive) {
        acc -= STEP;
        alive = step();
      }
      if (!alive) {
        const g = gameRef.current;
        const final = g ? g.furthest : 0;
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

  const hop = useCallback((dc: number, dr: number) => {
    const g = gameRef.current;
    if (!g) return;
    if (g.token.moving) { if (!g.pending) g.pending = { dc, dr }; return; }
    const tk = g.token;
    const nc = tk.col + dc;
    const nr = tk.row + dr;
    if (nc < 0 || nc >= COLS || nr < 0) return;
    tk.fromCol = tk.col;
    tk.fromRow = tk.row;
    tk.toCol = nc;
    tk.toRow = nr;
    tk.t = 0;
    tk.moving = true;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === "ArrowUp" || key === "w") {
        e.preventDefault();
        if (status !== "playing") start();
        else hop(0, 1);
      } else if (key === "ArrowDown" || key === "s") {
        e.preventDefault();
        if (status === "playing") hop(0, -1);
      } else if (key === "ArrowLeft" || key === "a") {
        e.preventDefault();
        if (status === "playing") hop(-1, 0);
      } else if (key === "ArrowRight" || key === "d") {
        e.preventDefault();
        if (status === "playing") hop(1, 0);
      } else if (key === " " || key === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start, hop]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    touchStart.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const startPt = touchStart.current;
    touchStart.current = null;
    if (status !== "playing") { start(); return; }
    if (!startPt) { hop(0, 1); return; }
    const dx = e.clientX - startPt.x;
    const dy = e.clientY - startPt.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) { hop(0, 1); return; }
    if (Math.abs(dx) > Math.abs(dy)) hop(dx > 0 ? 1 : -1, 0);
    else hop(0, dy < 0 ? 1 : -1);
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"} />
      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(34,211,238,0.8)]">
        <canvas ref={canvasRef} className="block w-full touch-none" onPointerDown={onPointerDown} onPointerUp={onPointerUp} aria-label="Cross the Grid crossing board" />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">CROSS THE GRID</p>
            <p className="mt-2 text-sm text-muted">Hop across traffic and rivers. Ride the logs, dodge the cars, keep climbing.</p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">Start game</PrimaryButton>
            <p className="mt-3 text-xs text-muted">Arrow keys or swipe · tap to hop forward</p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">WIPED OUT</p>
            {newBest && <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">✦ New best score!</p>}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">Rows crossed · Best {best ?? "—"}</p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">Try again</PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">↑ tap to hop forward · ←/→ sidestep · ↓ step back · cars and water kill</p>
    </div>
  );
}
