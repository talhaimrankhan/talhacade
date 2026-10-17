"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const CELL = 44;
const W = 420;
const H = 520;
const STEP = 16.667;
const WINDOW = 46;
const MIN_RUN = 3;
const MAX_RUN = 7;

type Status = "idle" | "playing" | "over";

interface Cell { c: number; r: number }

interface DashGame {
  cells: Cell[]; s: number; cornerIdx: number; camX: number; camY: number;
  score: number; flash: number; shake: number; alive: boolean;
}

function dirOf(a: Cell, b: Cell): Cell {
  return { c: a.c - b.c, r: a.r - b.r };
}

function occupied(cells: Cell[], c: number, r: number): boolean {
  for (const x of cells) {
    if (x.c === c && x.r === r) return true;
  }
  return false;
}

/** Extends the route with straight runs and 90° turns. */
function extend(cells: Cell[], need: number): Cell[] {
  const out = cells.slice();
  while (out.length < need) {
    const last = out[out.length - 1];
    const prev = out[out.length - 2];
    const cur = prev ? dirOf(last, prev) : { c: 1, r: 0 };

    let run = 1;
    for (let i = out.length - 1; i > 1; i--) {
      const d = dirOf(out[i], out[i - 1]);
      const p = dirOf(out[i - 1], out[i - 2]);
      if (d.c !== p.c || d.r !== p.r) break;
      run += 1;
    }

    const left = { c: cur.r, r: -cur.c };
    const right = { c: -cur.r, r: cur.c };
    let order: Cell[];
    if (run < MIN_RUN) order = [cur];
    else if (run >= MAX_RUN) order = Math.random() < 0.5 ? [left, right] : [right, left];
    else order = Math.random() < 0.5 ? [left, right, cur] : [right, left, cur];

    let next: Cell | null = null;
    for (const d of order) {
      const c = last.c + d.c;
      const r = last.r + d.r;
      if (!occupied(out, c, r)) {
        next = { c, r };
        break;
      }
    }
    if (!next) {
      next = { c: last.c + cur.c, r: last.r + cur.r };
    }
    out.push(next);
  }
  return out;
}

/** Index of the next vertex where the route bends. */
function nextCorner(cells: Cell[], from: number): number {
  for (let i = Math.max(3, from + 2); i < cells.length; i++) {
    const a = dirOf(cells[i], cells[i - 1]);
    const b = dirOf(cells[i - 1], cells[i - 2]);
    if (a.c !== b.c || a.r !== b.r) return i - 1;
  }
  return -1;
}

function createGame(): DashGame {
  const cells: Cell[] = [
    { c: 0, r: 0 },
    { c: 1, r: 0 },
    { c: 2, r: 0 },
  ];
  const extended = extend(cells, 50);
  return {
    cells: extended,
    s: 0,
    cornerIdx: nextCorner(extended, 0),
    camX: CELL / 2 - W / 2,
    camY: CELL / 2 - H / 2,
    score: 0,
    flash: 0,
    shake: 0,
    alive: true,
  };
}

function speedFor(cells: number): number {
  return Math.min(4.6, 2 + Math.floor(cells / 6) * 0.2);
}

export default function DriftDash({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<DashGame | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;

    const idx = Math.min(g.cells.length - 2, Math.floor(g.s / CELL));
    const frac = (g.s - idx * CELL) / CELL;
    const a = g.cells[idx];
    const b = g.cells[idx + 1] ?? a;
    const carX = (a.c + (b.c - a.c) * frac) * CELL + CELL / 2;
    const carY = (a.r + (b.r - a.r) * frac) * CELL + CELL / 2;
    const heading = Math.atan2(b.r - a.r, b.c - a.c);

    const camX = g.camX;
    const camY = g.camY;
    const sx = (Math.random() - 0.5) * g.shake;
    const sy = (Math.random() - 0.5) * g.shake;
    const ox = camX + sx;
    const oy = camY + sy;

    ctx.fillStyle = "#0b0b16";
    ctx.fillRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = "rgba(251,191,36,0.10)";
    ctx.lineWidth = 1;
    const startC = Math.floor(ox / CELL) * CELL;
    const startR = Math.floor(oy / CELL) * CELL;
    ctx.beginPath();
    for (let x = startC; x < ox + W + CELL; x += CELL) {
      ctx.moveTo(x - ox, 0);
      ctx.lineTo(x - ox, H);
    }
    for (let y = startR; y < oy + H + CELL; y += CELL) {
      ctx.moveTo(0, y - oy);
      ctx.lineTo(W, y - oy);
    }
    ctx.stroke();

    // route
    const from = Math.max(0, idx - 10);
    const to = Math.min(g.cells.length - 1, idx + 42);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 30;
    ctx.strokeStyle = "rgba(56,189,248,0.16)";
    ctx.beginPath();
    for (let i = from; i <= to; i++) {
      const cell = g.cells[i];
      const px = cell.c * CELL + CELL / 2 - ox;
      const py = cell.r * CELL + CELL / 2 - oy;
      if (i === from) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(103,232,249,0.55)";
    ctx.setLineDash([10, 12]);
    ctx.stroke();
    ctx.setLineDash([]);

    // turn window marker
    const corner = g.cornerIdx;
    if (corner > 0 && corner < g.cells.length) {
      const d = corner * CELL - g.s;
      if (d > -CELL && d < 150) {
        const cell = g.cells[corner];
        const px = cell.c * CELL + CELL / 2 - ox;
        const py = cell.r * CELL + CELL / 2 - oy;
        const inWindow = d <= WINDOW && d >= 0;
        const pulse = inWindow ? 0.55 + Math.sin(time / 90) * 0.35 : 0.3;
        ctx.strokeStyle = inWindow
          ? `rgba(74,222,128,${pulse})`
          : `rgba(251,191,36,${pulse + 0.15})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(px - CELL / 2 + 3, py - CELL / 2 + 3, CELL - 6, CELL - 6, 8);
        ctx.stroke();
      }
    }

    // car
    ctx.save();
    ctx.translate(carX - ox, carY - oy);
    ctx.rotate(heading);
    ctx.shadowColor = "#f59e0b";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.roundRect(-16, -11, 32, 22, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(11,11,22,0.6)";
    ctx.beginPath();
    ctx.roundRect(2, -7, 10, 14, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.roundRect(-13, -7, 6, 14, 3);
    ctx.fill();
    ctx.restore();

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(244,63,94,${Math.min(0.7, g.flash)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.font = "bold 44px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💥", W / 2, H / 2);
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
    setNewBest(false);
    setStatus("playing");
  }, []);

  const crash = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;
    g.alive = false;
    g.flash = 0.8;
    g.shake = 16;
    const final = g.score;
    setScore(final);
    setNewBest(submit(final));
    setStatus("over");
    draw(performance.now());
  }, [draw, submit]);

  /** Advances one frame. */
  const step = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;

    const idx = Math.floor(g.s / CELL);
    const need = idx + 45;
    if (g.cells.length < need) g.cells = extend(g.cells, need);

    g.s += speedFor(g.score);

    const cornerArc = g.cornerIdx * CELL;
    if (g.s >= cornerArc) {
      // rolled past the bend without turning
      crash();
      return;
    }

    const cellsTravelled = Math.floor(g.s / CELL);
    if (cellsTravelled !== g.score) {
      g.score = cellsTravelled;
      setScore(cellsTravelled);
    }

    const idx2 = Math.min(g.cells.length - 2, Math.floor(g.s / CELL));
    const frac = (g.s - idx2 * CELL) / CELL;
    const a = g.cells[idx2];
    const b = g.cells[idx2 + 1] ?? a;
    const carX = (a.c + (b.c - a.c) * frac) * CELL + CELL / 2;
    const carY = (a.r + (b.r - a.r) * frac) * CELL + CELL / 2;
    const tx = carX - W / 2;
    const ty = carY - H / 2;
    g.camX += (tx - g.camX) * 0.12;
    g.camY += (ty - g.camY) * 0.12;
  }, [crash]);

  const press = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;
    const d = g.cornerIdx * CELL - g.s;
    if (d > WINDOW) {
      crash();
      return;
    }
    let next = nextCorner(g.cells, g.cornerIdx);
    if (next < 0) {
      g.cells = extend(g.cells, g.cornerIdx + 50);
      next = nextCorner(g.cells, g.cornerIdx);
    }
    g.cornerIdx = next >= 0 ? next : g.cornerIdx + 4;
    g.shake = 5;
  }, [crash]);

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
        step();
      }
      const g = gameRef.current;
      if (g && g.shake > 0) g.shake = Math.max(0, g.shake - 0.8);
      draw(t);
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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (status === "playing") press();
        else start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, press, start]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (status !== "playing") {
      start();
      return;
    }
    press();
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-warn">
          Speed{" "}
          <b className="ml-1 text-sm text-ink">
            {1 + Math.floor(score / 6)}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(245,158,11,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          onPointerDown={onPointerDown}
          aria-label="Drift Dash driving grid"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              DRIFT DASH
            </p>
            <p className="mt-2 text-sm text-muted">
              One button, one route. Hit the turn window at every corner —
              too early and you spin out.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-yellow-400 via-amber-500 to-orange-600"
            >
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Click, tap or Space when the corner lights up green
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              CRASHED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {score}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Cells travelled · Best {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-yellow-400 via-amber-500 to-orange-600"
            >
              Drive again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Click / tap / Space to take the corner · green means go · speed climbs
        every 6 cells
      </p>
    </div>
  );
}
