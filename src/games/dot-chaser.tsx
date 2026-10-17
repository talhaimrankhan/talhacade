"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const COLS = 19;
const ROWS = 19;
const CELL = 24;
const SIZE = COLS * CELL;
const STEP = 1 / 120; // fixed logic step (seconds)
const TUNNEL_Y = 9;
const POWER_SECONDS = 6;

const EMPTY = 1;
const WALL = 3;
const PELLET = 2;

type Dir = { x: number; y: number };
type Cell = { x: number; y: number };
type Status = "idle" | "playing" | "over";

const UP: Dir = { x: 0, y: -1 };
const DOWN: Dir = { x: 0, y: 1 };
const LEFT: Dir = { x: -1, y: 0 };
const RIGHT: Dir = { x: 1, y: 0 };
const DIRS = [UP, LEFT, DOWN, RIGHT];

/** Interior blocks, symmetric under 180° rotation — corridors stay connected. */
const BLOCKS: [number, number, number, number][] = [
  [2, 2, 4, 2],
  [13, 2, 4, 2],
  [8, 2, 3, 2],
  [6, 5, 2, 2],
  [11, 12, 2, 2],
  [3, 7, 2, 5],
  [14, 7, 2, 5],
  [8, 8, 3, 3],
  [2, 15, 4, 2],
  [13, 15, 4, 2],
  [8, 15, 3, 2],
];

const PELLETS: Cell[] = [
  { x: 2, y: 5 },
  { x: 16, y: 5 },
  { x: 2, y: 13 },
  { x: 16, y: 13 },
];

const PLAYER_SPAWN: Cell = { x: 9, y: 11 };
const GHOST_SPAWNS: Cell[] = [
  { x: 9, y: 7 },
  { x: 8, y: 7 },
  { x: 10, y: 7 },
  { x: 9, y: 6 },
];
const SCATTER: Cell[] = [
  { x: 17, y: 1 },
  { x: 1, y: 1 },
  { x: 17, y: 17 },
  { x: 1, y: 17 },
];
const GHOST_COLORS = ["#f87171", "#f472b6", "#22d3ee", "#fbbf24"];
/** scatter / chase / scatter / chase / scatter / chase forever */
const MODE_SECONDS = [6, 18, 5, 18, 5, Infinity];

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: UP,
  ArrowDown: DOWN,
  ArrowLeft: LEFT,
  ArrowRight: RIGHT,
  w: UP,
  s: DOWN,
  a: LEFT,
  d: RIGHT,
};

interface Mover {
  cx: number;
  cy: number;
  dir: Dir;
  progress: number;
}

interface Ghost extends Mover {
  kind: number;
  hidden: number;
}

interface MazeGame {
  board: number[];
  dotsLeft: number;
  player: Mover;
  ghosts: Ghost[];
  queue: Dir[];
  score: number;
  lives: number;
  level: number;
  power: number;
  mult: number;
  modeIndex: number;
  modeTimer: number;
  freeze: number;
  over: boolean;
  banner: string;
  bannerT: number;
  scoreDirty: boolean;
  livesDirty: boolean;
}

function wrapX(x: number): number {
  return ((x % COLS) + COLS) % COLS;
}

function wrapDelta(a: number, b: number): number {
  const d = a - b;
  return Math.abs(d) > COLS / 2 ? d - Math.sign(d) * COLS : d;
}

function buildBoard(): { board: number[]; dots: number } {
  const board = new Array<number>(COLS * ROWS).fill(EMPTY);
  let dots = 0;
  for (let x = 0; x < COLS; x++) {
    board[x] = WALL;
    board[(ROWS - 1) * COLS + x] = WALL;
  }
  for (let y = 1; y < ROWS - 1; y++) {
    board[y * COLS] = WALL;
    board[y * COLS + COLS - 1] = WALL;
  }
  for (const [bx, by, bw, bh] of BLOCKS) {
    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) board[y * COLS + x] = WALL;
    }
  }
  // tunnel row: open at both ends, no dots
  board[TUNNEL_Y * COLS] = EMPTY;
  board[TUNNEL_Y * COLS + COLS - 1] = EMPTY;
  for (let x = 0; x < COLS; x++) {
    const i = TUNNEL_Y * COLS + x;
    if (board[i] !== WALL) board[i] = EMPTY;
  }
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY) {
      board[i] = 0; // dot
      dots++;
    }
  }
  for (const p of PELLETS) {
    board[p.y * COLS + p.x] = PELLET;
    dots++;
  }
  return { board, dots };
}

function playerSpeed(level: number): number {
  return Math.min(9.4, 6.2 + (level - 1) * 0.35);
}

function ghostSpeed(level: number, frightened: boolean): number {
  if (frightened) return 3.6;
  return Math.min(8.4, 5.6 + (level - 1) * 0.3);
}

function makeMover(c: Cell, dir: Dir): Mover {
  return { cx: c.x, cy: c.y, dir, progress: 0 };
}

function createGame(): MazeGame {
  const { board, dots } = buildBoard();
  return {
    board,
    dotsLeft: dots,
    player: makeMover(PLAYER_SPAWN, LEFT),
    ghosts: GHOST_SPAWNS.map((s, i) => ({
      ...makeMover(s, i % 2 === 0 ? UP : DOWN),
      kind: i,
      hidden: 0,
    })),
    queue: [],
    score: 0,
    lives: 3,
    level: 1,
    power: 0,
    mult: 1,
    modeIndex: 0,
    modeTimer: MODE_SECONDS[0],
    freeze: 1.6,
    over: false,
    banner: "READY",
    bannerT: 1.6,
    scoreDirty: false,
    livesDirty: false,
  };
}

function resetActors(g: MazeGame, freeze: number, banner: string): void {
  g.player = makeMover(PLAYER_SPAWN, LEFT);
  g.ghosts = GHOST_SPAWNS.map((s, i) => ({
    ...makeMover(s, i % 2 === 0 ? UP : DOWN),
    kind: i,
    hidden: 0,
  }));
  g.queue = [];
  g.power = 0;
  g.mult = 1;
  g.modeIndex = 0;
  g.modeTimer = MODE_SECONDS[0];
  g.freeze = freeze;
  g.banner = banner;
  g.bannerT = freeze;
}

function isOpen(board: number[], x: number, y: number): boolean {
  if (y < 0 || y >= ROWS) return false;
  return board[y * COLS + wrapX(x)] !== WALL;
}

function pos(m: Mover): { x: number; y: number } {
  return { x: wrapX(m.cx + m.dir.x * m.progress), y: m.cy + m.dir.y * m.progress };
}

function reverse(m: Mover): void {
  if (m.dir.x === 0 && m.dir.y === 0) return;
  m.cx = wrapX(m.cx + m.dir.x);
  m.dir = { x: -m.dir.x, y: -m.dir.y };
  m.progress = 1 - m.progress;
}

function eatAt(g: MazeGame, cx: number, cy: number): void {
  const i = cy * COLS + wrapX(cx);
  const cell = g.board[i];
  if (cell === 0) {
    g.board[i] = EMPTY;
    g.score += 10;
    g.dotsLeft--;
    g.scoreDirty = true;
  } else if (cell === PELLET) {
    g.board[i] = EMPTY;
    g.score += 50;
    g.dotsLeft--;
    g.scoreDirty = true;
    if (g.power <= 0) g.mult = 1;
    g.power = POWER_SECONDS;
    g.ghosts.forEach((gh) => reverse(gh));
  }
}

function advancePlayer(g: MazeGame): void {
  const p = g.player;
  if (p.dir.x === 0 && p.dir.y === 0) {
    const q = g.queue.shift();
    if (q && isOpen(g.board, p.cx + q.x, p.cy + q.y)) p.dir = q;
    else return;
  }
  p.progress += playerSpeed(g.level) * STEP;
  while (p.progress >= 1) {
    p.cx = wrapX(p.cx + p.dir.x);
    p.cy += p.dir.y;
    p.progress -= 1;
    eatAt(g, p.cx, p.cy);
    const q = g.queue.shift();
    if (q && isOpen(g.board, p.cx + q.x, p.cy + q.y)) {
      p.dir = q;
    } else if (!isOpen(g.board, p.cx + p.dir.x, p.cy + p.dir.y)) {
      p.dir = { x: 0, y: 0 };
      p.progress = 0;
      return;
    }
  }
}

function ghostTarget(g: MazeGame, gh: Ghost): Cell {
  const pp = pos(g.player);
  const pc = { x: Math.round(pp.x), y: Math.round(pp.y) };
  const pd =
    g.player.dir.x === 0 && g.player.dir.y === 0 ? LEFT : g.player.dir;
  switch (gh.kind) {
    case 1: // ambusher: 3 tiles ahead of the player
      return { x: pc.x + pd.x * 3, y: pc.y + pd.y * 3 };
    case 2: {
      // shy: keeps its distance when cornered
      const gp = pos(gh);
      const d = Math.hypot(wrapDelta(gp.x, pc.x), gp.y - pc.y);
      return d < 6 ? { ...SCATTER[2] } : { x: pc.x + pd.x * 2, y: pc.y + pd.y * 2 };
    }
    case 3: // wanderer behaves like the chaser half the time
      return pc;
    default:
      return pc;
  }
}

function decideGhost(g: MazeGame, gh: Ghost): Dir {
  const back = { x: -gh.dir.x, y: -gh.dir.y };
  let options = DIRS.filter(
    (d) => !(d.x === back.x && d.y === back.y) && isOpen(g.board, gh.cx + d.x, gh.cy + d.y),
  );
  if (options.length === 0) {
    options = DIRS.filter((d) => isOpen(g.board, gh.cx + d.x, gh.cy + d.y));
  }
  if (options.length === 0) return { x: 0, y: 0 };
  if (options.length === 1) return options[0];

  if (g.power > 0) {
    const pp = pos(g.player);
    let best = options[0];
    let bestD = -Infinity;
    for (const d of options) {
      const nx = gh.cx + d.x;
      const d2 = Math.hypot(wrapDelta(nx, pp.x), gh.cy + d.y - pp.y);
      if (d2 > bestD) {
        bestD = d2;
        best = d;
      }
    }
    return best;
  }

  if (gh.kind === 3 && Math.random() < 0.55) {
    return options[Math.floor(Math.random() * options.length)];
  }

  const scatter = g.modeIndex % 2 === 0;
  const target = scatter ? SCATTER[gh.kind] : ghostTarget(g, gh);
  let best = options[0];
  let bestD = Infinity;
  for (const d of options) {
    const nx = gh.cx + d.x;
    const d2 =
      Math.abs(wrapDelta(nx, target.x)) + Math.abs(gh.cy + d.y - target.y);
    if (d2 < bestD) {
      bestD = d2;
      best = d;
    }
  }
  return best;
}

function advanceGhost(g: MazeGame, gh: Ghost): void {
  const fright = g.power > 0;
  gh.progress += ghostSpeed(g.level, fright) * STEP;
  let guard = 0;
  while (gh.progress >= 1 && guard++ < 4) {
    gh.cx = wrapX(gh.cx + gh.dir.x);
    gh.cy += gh.dir.y;
    gh.progress -= 1;
    gh.dir = decideGhost(g, gh);
  }
}

function stepGame(g: MazeGame): void {
  if (g.freeze > 0) {
    g.freeze = Math.max(0, g.freeze - STEP);
    g.bannerT = Math.max(0, g.bannerT - STEP);
    if (g.bannerT === 0) g.banner = "";
    return;
  }

  advancePlayer(g);

  if (g.power > 0) {
    g.power = Math.max(0, g.power - STEP);
    if (g.power === 0) g.mult = 1;
  }

  // global scatter/chase clock
  g.modeTimer -= STEP;
  if (g.modeTimer <= 0 && g.modeIndex < MODE_SECONDS.length - 1) {
    g.modeIndex++;
    g.modeTimer = MODE_SECONDS[g.modeIndex];
    g.ghosts.forEach((gh) => reverse(gh));
  }

  for (const gh of g.ghosts) {
    if (gh.hidden > 0) {
      gh.hidden -= STEP;
      if (gh.hidden <= 0) {
        const s = GHOST_SPAWNS[gh.kind];
        gh.cx = s.x;
        gh.cy = s.y;
        gh.dir = UP;
        gh.progress = 0;
      }
      continue;
    }
    advanceGhost(g, gh);
  }

  // collisions
  const pp = pos(g.player);
  for (const gh of g.ghosts) {
    if (gh.hidden > 0) continue;
    const gp = pos(gh);
    const dx = wrapDelta(gp.x, pp.x);
    const dy = gp.y - pp.y;
    if (dx * dx + dy * dy > 0.36) continue;

    if (g.power > 0) {
      const points = 200 * g.mult;
      g.mult = Math.min(8, g.mult * 2);
      g.score += points;
      g.scoreDirty = true;
      gh.hidden = 2.6;
    } else {
      g.lives -= 1;
      g.livesDirty = true;
      if (g.lives <= 0) {
        g.over = true;
      } else {
        resetActors(g, 1.6, "READY");
      }
      return;
    }
  }

  if (g.dotsLeft <= 0) {
    g.level += 1;
    const { board, dots } = buildBoard();
    g.board = board;
    g.dotsLeft = dots;
    resetActors(g, 1.4, `LEVEL ${g.level}`);
  }
}

export default function DotChaser({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<MazeGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [banner, setBanner] = useState("READY");
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    ctx.fillStyle = "#08080f";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // dots + pellets
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = g.board[y * COLS + x];
        const cx = x * CELL + CELL / 2;
        const cy = y * CELL + CELL / 2;
        if (cell === 0) {
          ctx.fillStyle = "rgba(253, 224, 71, 0.75)";
          ctx.beginPath();
          ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell === PELLET) {
          const pulse = 1 + Math.sin(time / 200) * 0.18;
          ctx.save();
          ctx.shadowColor = "#f472b6";
          ctx.shadowBlur = 16;
          ctx.fillStyle = "#f472b6";
          ctx.beginPath();
          ctx.arc(cx, cy, 6 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // walls
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (g.board[y * COLS + x] !== WALL) continue;
        ctx.fillStyle = "#151532";
        ctx.strokeStyle = "rgba(99, 102, 241, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x * CELL + 1.5, y * CELL + 1.5, CELL - 3, CELL - 3, 5);
        ctx.fill();
        ctx.stroke();
      }
    }

    // player (chomping orb)
    const pp = pos(g.player);
    const px = pp.x * CELL + CELL / 2;
    const py = pp.y * CELL + CELL / 2;
    const ang = Math.atan2(g.player.dir.y, g.player.dir.x);
    const mouth = 0.28 + Math.abs(Math.sin(time / 110)) * 0.34;
    ctx.save();
    ctx.shadowColor = "#facc15";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, CELL * 0.42, ang + mouth, ang + Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ghosts
    const fright = g.power > 0;
    const blink = fright && g.power < 2 && Math.floor(time / 160) % 2 === 0;
    for (const gh of g.ghosts) {
      if (gh.hidden > 0) continue;
      const gp = pos(gh);
      const gx = gp.x * CELL + CELL / 2;
      const gy = gp.y * CELL + CELL / 2;
      const r = CELL * 0.44;
      const body = fright ? (blink ? "#f8fafc" : "#3b4cca") : GHOST_COLORS[gh.kind];

      ctx.save();
      ctx.shadowColor = body;
      ctx.shadowBlur = 10;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(gx, gy - r * 0.15, r, Math.PI, 0);
      ctx.lineTo(gx + r, gy + r * 0.75);
      for (let s = 0; s < 3; s++) {
        const sx = gx + r - (s + 0.5) * ((2 * r) / 3);
        ctx.quadraticCurveTo(sx + r / 3, gy + r * 0.35, sx, gy + r * 0.75);
      }
      ctx.lineTo(gx - r, gy + r * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (fright) {
        ctx.fillStyle = blink ? "#3b4cca" : "#e0e7ff";
        ctx.beginPath();
        ctx.arc(gx - r * 0.35, gy - r * 0.1, 1.8, 0, Math.PI * 2);
        ctx.arc(gx + r * 0.35, gy - r * 0.1, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        for (const side of [-1, 1]) {
          const ex = gx + side * r * 0.36;
          ctx.fillStyle = "#f8fafc";
          ctx.beginPath();
          ctx.ellipse(ex, gy - r * 0.2, r * 0.26, r * 0.32, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#1e1b4b";
          ctx.beginPath();
          ctx.arc(
            ex + gh.dir.x * 1.6,
            gy - r * 0.2 + gh.dir.y * 1.6,
            r * 0.13,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
    }
  }, []);

  // canvas sizing (DPR) + first frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }, [draw]);

  /* ---------------- game loop ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setLives(3);
    setLevel(1);
    setBanner("READY");
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastBanner = "READY";

    const loop = (t: number) => {
      const dt = Math.min(t - last, 250);
      last = t;
      acc += dt / 1000;

      let guard = 0;
      while (acc >= STEP && guard < 20) {
        acc -= STEP;
        guard++;
        const g = gameRef.current;
        if (!g) return;
        stepGame(g);

        if (g.scoreDirty) {
          g.scoreDirty = false;
          setScore(g.score);
        }
        if (g.livesDirty) {
          g.livesDirty = false;
          setLives(g.lives);
        }
        if (g.banner !== lastBanner) {
          lastBanner = g.banner;
          setBanner(g.banner);
        }
        if (g.over) {
          setScore(g.score);
          setNewBest(submit(g.score));
          setStatus("over");
          draw(t);
          return;
        }
      }

      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, submit, draw]);

  // static frame when idle / game over
  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  const queueDir = useCallback((dir: Dir) => {
    const g = gameRef.current;
    if (!g || g.over) return;
    const p = g.player;
    if (g.freeze > 0) {
      if (g.queue.length < 2) g.queue.push(dir);
      return;
    }
    if (dir.x === -p.dir.x && dir.y === -p.dir.y) {
      if (p.dir.x !== 0 || p.dir.y !== 0) {
        reverse(p);
        g.queue = [];
        return;
      }
    }
    if (g.queue.length < 2) g.queue.push(dir);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const dir = KEY_DIRS[key];
      if (dir) {
        e.preventDefault();
        if (status === "idle") start();
        if (status === "playing") queueDir(dir);
        return;
      }
      if (key === " " || key === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start, queueDir]);

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const startPt = touchStart.current;
    const t = e.changedTouches[0];
    touchStart.current = null;
    if (!startPt || !t) return;

    const dx = t.clientX - startPt.x;
    const dy = t.clientY - startPt.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) {
      if (status !== "playing") start();
      return;
    }
    const dir =
      Math.abs(dx) > Math.abs(dy)
        ? { x: Math.sign(dx), y: 0 }
        : { x: 0, y: Math.sign(dy) };
    if (status === "idle") start();
    if (status === "playing") queueDir(dir);
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Level <b className="ml-1 text-sm text-ink">{level}</b>
        </span>
        <span>
          Lives{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${lives} lives`}>
            {"👻".repeat(Math.max(0, lives))}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(129,140,248,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          aria-label="Dot Chaser maze"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        />

        {banner && status === "playing" && (
          <p className="pointer-events-none absolute inset-x-0 top-[42%] text-center font-display text-3xl font-bold tracking-widest text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            {banner}
          </p>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">DOT CHASER</p>
            <p className="mt-2 text-sm text-muted">
              Clear every dot. Grab a power pellet to turn the tables.
            </p>
            <PrimaryButton onClick={start} tone="from-amber-400 via-orange-500 to-red-500">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Arrows / WASD · swipe on mobile
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">GAME OVER</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · reached level {level}
            </p>
            <PrimaryButton onClick={start} tone="from-amber-400 via-orange-500 to-red-500">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Pink pellets make ghosts flee for 6 seconds — eat them back for 1600
      </p>
    </div>
  );
}
