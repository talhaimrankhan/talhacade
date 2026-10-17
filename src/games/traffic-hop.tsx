"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 360;
const H = 520;
const RH = 40; // row height
const CW = 36; // hop width (one column)
const START_SECONDS = 30;
const SLOTS = 5;
const SLOT_W = W / SLOTS;

/** Row map — 0 is the top of the canvas, 12 the starting verge. */
const R_HEDGE = 0;
const R_HOMES = 1;
const R_BANK = 2;
const RIVER_ROWS = [3, 4, 5, 6];
const R_MEDIAN = 7;
const ROAD_ROWS = [8, 9, 10, 11];
const R_START = 12;

type Kind = "car" | "truck" | "log" | "turtle";
type Splat = "car" | "water" | "time";

interface LaneDef {
  row: number;
  dir: 1 | -1;
  /** px per frame at 60fps, before the crossing multiplier. */
  speed: number;
  kind: Kind;
  size: number;
  count: number;
  color: string;
  /** Frames between turtle submersions. */
  cycle?: number;
}

/** Bottom four lanes are tarmac, top four are river — see ROAD/RIVER_ROWS. */
const LANE_DEFS: LaneDef[] = [
  { row: 11, dir: 1, speed: 1.35, kind: "truck", size: 80, count: 3, color: "#f472b6" },
  { row: 10, dir: -1, speed: 2.1, kind: "car", size: 46, count: 4, color: "#22d3ee" },
  { row: 9, dir: 1, speed: 1.7, kind: "car", size: 46, count: 4, color: "#a78bfa" },
  { row: 8, dir: -1, speed: 2.6, kind: "car", size: 36, count: 4, color: "#fbbf24" },
  { row: 6, dir: 1, speed: 1.05, kind: "log", size: 112, count: 3, color: "#8b5a2b" },
  { row: 5, dir: -1, speed: 1.5, kind: "turtle", size: 74, count: 4, color: "#34d399", cycle: 190 },
  { row: 4, dir: 1, speed: 1.75, kind: "log", size: 76, count: 4, color: "#a16207" },
  { row: 3, dir: -1, speed: 1.3, kind: "turtle", size: 74, count: 4, color: "#2dd4bf", cycle: 155 },
];

interface Lane {
  def: LaneDef;
  xs: number[];
  phases: number[];
  size: number;
  speed: number;
}

interface Game {
  frog: { x: number; row: number };
  lanes: Lane[];
  homes: boolean[];
  lives: number;
  score: number;
  crossings: number;
  time: number;
  elapsed: number;
  bestRow: number;
  dead: number;
  splat: Splat;
  ready: number;
}

/* ------------------------------------------------------------------ */
/* Module-level helpers                                                */
/* ------------------------------------------------------------------ */

function buildLanes(crossings: number): Lane[] {
  const speedMul = Math.min(2.1, 1 + crossings * 0.055);
  const grow = Math.min(32, crossings * 5); // traffic gets wider each crossing
  return LANE_DEFS.map((def) => {
    const motorised = def.kind === "car" || def.kind === "truck";
    const size = motorised ? def.size + grow : def.size;
    const spacing = (W + size * 2) / def.count;
    const xs: number[] = [];
    const phases: number[] = [];
    for (let i = 0; i < def.count; i++) {
      xs.push(-size + i * spacing + Math.random() * 22);
      phases.push(Math.random() * (def.cycle ?? 1));
    }
    return { def, xs, phases, size, speed: def.speed * speedMul };
  });
}

function createGame(): Game {
  return {
    frog: { x: W / 2, row: R_START },
    lanes: buildLanes(0),
    homes: [false, false, false, false, false],
    lives: 3,
    score: 0,
    crossings: 0,
    time: START_SECONDS,
    elapsed: 0,
    bestRow: R_START,
    dead: 0,
    splat: "car",
    ready: 0,
  };
}

function isRoad(row: number): boolean {
  return ROAD_ROWS.includes(row);
}

function isRiver(row: number): boolean {
  return RIVER_ROWS.includes(row);
}

/** Turtles dive for a beat — you can't ride a submerged shell. */
function isSubmerged(lane: Lane, i: number, elapsed: number): boolean {
  const cycle = lane.def.cycle;
  if (!cycle) return false;
  return (elapsed + lane.phases[i]) % cycle < 48;
}

function findCover(g: Game, row: number, x: number): { lane: Lane; i: number } | null {
  const lane = g.lanes.find((l) => l.def.row === row);
  if (!lane) return null;
  for (let i = 0; i < lane.xs.length; i++) {
    if (x + 12 >= lane.xs[i] && x - 12 <= lane.xs[i] + lane.size) return { lane, i };
  }
  return null;
}

function stepLanes(g: Game, f: number): void {
  for (const lane of g.lanes) {
    const v = lane.speed * lane.def.dir * f;
    for (let i = 0; i < lane.xs.length; i++) {
      let x = lane.xs[i] + v;
      if (lane.def.dir > 0 && x > W) x = -lane.size - Math.random() * 90;
      else if (lane.def.dir < 0 && x + lane.size < 0) x = W + Math.random() * 90;
      lane.xs[i] = x;
    }
  }
}

function kill(g: Game, kind: Splat): void {
  if (g.dead > 0) return;
  g.lives -= 1;
  g.dead = 52;
  g.splat = kind;
}

function respawn(g: Game): void {
  g.frog = { x: W / 2, row: R_START };
  g.bestRow = R_START;
  g.time = START_SECONDS;
}

/** Returns a banner string when the hop lands a frog in a free home slot. */
function resolveHome(g: Game): string | null {
  const slot = Math.max(0, Math.min(SLOTS - 1, Math.floor(g.frog.x / SLOT_W)));
  if (g.homes[slot]) {
    kill(g, "car"); // hedges are as lethal as the tarmac
    return null;
  }
  g.homes[slot] = true;
  g.score += 50;
  g.crossings += 1;
  g.lanes = buildLanes(g.crossings);
  respawn(g);
  g.ready = 62;
  const left = SLOTS - g.homes.filter(Boolean).length;
  if (left === 0) {
    g.homes = [false, false, false, false, false];
    return "ROUND CLEAR!";
  }
  return `HOME +50 · ${left} LEFT`;
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

function grass(ctx: CanvasRenderingContext2D, row: number): void {
  ctx.fillStyle = "#12301f";
  ctx.fillRect(0, row * RH, W, RH);
  ctx.fillStyle = "rgba(52,211,153,0.14)";
  for (let x = 6; x < W; x += 30) {
    ctx.fillRect(x + ((row * 9) % 16), row * RH + 10 + ((x + row * 5) % 18), 11, 3);
  }
}

function rrect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  lane: Lane,
  x: number,
  y: number,
): void {
  const dir = lane.def.dir;
  if (lane.def.kind === "truck") {
    const trailer = lane.size * 0.6;
    ctx.fillStyle = lane.def.color;
    rrect(ctx, x, y + 4, trailer, 26, 4);
    ctx.fillStyle = "#e5e7eb";
    rrect(ctx, x + trailer + 3, y, lane.size - trailer - 3, 30, 5);
    ctx.fillStyle = "#0b0b16";
    ctx.fillRect(x + trailer + 7, y + 5, lane.size - trailer - 11, 8);
    return;
  }
  const h = lane.def.kind === "car" ? 22 : 20;
  ctx.fillStyle = lane.def.color;
  rrect(ctx, x, y + 6, lane.size, h, 7);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  rrect(ctx, x + lane.size * 0.2, y + 2, lane.size * 0.55, 10, 4);
  ctx.fillStyle = dir > 0 ? "#fff7cc" : "#ffe4e6";
  const lightX = dir > 0 ? x + lane.size - 5 : x + 1;
  ctx.fillRect(lightX, y + 13, 4, 6);
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  lane: Lane,
  x: number,
  y: number,
  down: boolean,
): void {
  if (lane.def.kind === "log") {
    ctx.fillStyle = lane.def.color;
    rrect(ctx, x, y + 7, lane.size, 26, 10);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    for (let i = 12; i < lane.size - 6; i += 18) ctx.fillRect(x + i, y + 11, 3, 18);
    return;
  }
  const turtles = Math.max(2, Math.floor(lane.size / 34));
  const gap = lane.size / turtles;
  ctx.globalAlpha = down ? 0.32 : 1;
  for (let i = 0; i < turtles; i++) {
    const cx = x + gap * i + gap / 2;
    ctx.fillStyle = down ? "#1d4e56" : "#166534";
    ctx.beginPath();
    ctx.arc(cx, y + 20, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = down ? "#0f3a45" : "#4ade80";
    ctx.beginPath();
    ctx.arc(cx, y + 20, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawScene(ctx: CanvasRenderingContext2D, g: Game): void {
  ctx.fillStyle = "#0b0b16";
  ctx.fillRect(0, 0, W, H);

  // river
  ctx.fillStyle = "#0a2545";
  ctx.fillRect(0, RIVER_ROWS[0] * RH, W, RIVER_ROWS.length * RH);
  ctx.strokeStyle = "rgba(56,189,248,0.18)";
  ctx.lineWidth = 2;
  for (let r = 0; r < RIVER_ROWS.length; r++) {
    const y = RIVER_ROWS[r] * RH + 12 + r * 6;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const yy = y + Math.sin((x + g.elapsed * 1.4 + r * 40) / 26) * 3;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // tarmac
  ctx.fillStyle = "#14141d";
  ctx.fillRect(0, ROAD_ROWS[0] * RH, W, ROAD_ROWS.length * RH);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 16]);
  for (const row of ROAD_ROWS) {
    if (row === ROAD_ROWS[0]) continue;
    ctx.beginPath();
    ctx.moveTo(0, row * RH);
    ctx.lineTo(W, row * RH);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // grass banks + hedge
  grass(ctx, R_BANK);
  grass(ctx, R_MEDIAN);
  grass(ctx, R_START);
  ctx.fillStyle = "#0d2a1a";
  ctx.fillRect(0, R_HEDGE * RH, W, RH);
  ctx.fillStyle = "#14532d";
  for (let x = 8; x < W; x += 34) {
    ctx.beginPath();
    ctx.arc(x, R_HEDGE * RH + 34, 13, 0, Math.PI * 2);
    ctx.fill();
  }

  // home strip
  ctx.fillStyle = "#0a2545";
  ctx.fillRect(0, R_HOMES * RH, W, RH);
  ctx.textAlign = "center";
  ctx.font = "24px serif";
  for (let i = 0; i < SLOTS; i++) {
    const x = i * SLOT_W;
    ctx.fillStyle = "#061527";
    rrect(ctx, x + 3, R_HOMES * RH + 4, SLOT_W - 6, RH - 8, 8);
    if (g.homes[i]) {
      ctx.fillStyle = "#12301f";
      rrect(ctx, x + 5, R_HOMES * RH + 6, SLOT_W - 10, RH - 12, 7);
      ctx.fillText("🐸", x + SLOT_W / 2, R_HOMES * RH + 29);
    }
  }

  // traffic + river craft
  for (const lane of g.lanes) {
    const y = lane.def.row * RH;
    for (let i = 0; i < lane.xs.length; i++) {
      const x = lane.xs[i];
      if (x > W || x + lane.size < 0) continue;
      if (lane.def.kind === "log" || lane.def.kind === "turtle") {
        drawPlatform(ctx, lane, x, y, isSubmerged(lane, i, g.elapsed));
      } else {
        drawVehicle(ctx, lane, x, y + 4);
      }
    }
  }

  // frog / splat
  ctx.textAlign = "center";
  ctx.font = "26px serif";
  if (g.dead > 0) {
    ctx.font = "22px serif";
    const mark = g.splat === "water" ? "💦" : g.splat === "time" ? "⏰" : "💥";
    ctx.fillText(mark, g.frog.x, rowY(g.frog.row) + 26);
    ctx.font = "26px serif";
  } else {
    ctx.fillText("🐸", g.frog.x, rowY(g.frog.row) + 27);
  }
}

function rowY(row: number): number {
  return row * RH;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function TrafficHop({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<"idle" | "playing" | "over">("idle");
  const [hud, setHud] = useState({ score: 0, lives: 3, time: START_SECONDS, homes: 0, crossings: 0 });
  const [banner, setBanner] = useState<string | null>(null);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const hudRef = useRef(hud);

  const syncHud = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const next = {
      score: g.score,
      lives: g.lives,
      time: Math.max(0, Math.ceil(g.time)),
      homes: g.homes.filter(Boolean).length,
      crossings: g.crossings,
    };
    const cur = hudRef.current;
    if (
      cur.score !== next.score ||
      cur.lives !== next.lives ||
      cur.time !== next.time ||
      cur.homes !== next.homes ||
      cur.crossings !== next.crossings
    ) {
      hudRef.current = next;
      setHud(next);
    }
  }, []);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    drawScene(ctx, g);
  }, []);

  // canvas sizing + devicePixelRatio scaling
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

  const start = useCallback(() => {
    gameRef.current = createGame();
    hudRef.current = { score: 0, lives: 3, time: START_SECONDS, homes: 0, crossings: 0 };
    setHud(hudRef.current);
    setBanner(null);
    setNewBest(false);
    setStatus("playing");
  }, []);

  /** One hop. Returns false when the run ends mid-animation. */
  const tick = useCallback(
    (f: number): boolean => {
      const g = gameRef.current;
      if (!g) return false;
      g.elapsed += f;

      if (g.ready > 0) {
        g.ready -= f;
        if (g.ready <= 0) setBanner(null);
        return true;
      }

      if (g.dead > 0) {
        g.dead -= f;
        if (g.dead <= 0) {
          if (g.lives <= 0) return false;
          respawn(g);
        }
        syncHud();
        return true;
      }

      g.time -= f / 60;
      if (g.time <= 0) {
        g.time = 0;
        kill(g, "time");
        syncHud();
        return true;
      }

      stepLanes(g, f);

      const row = g.frog.row;
      if (isRiver(row)) {
        const cover = findCover(g, row, g.frog.x);
        if (!cover || isSubmerged(cover.lane, cover.i, g.elapsed)) {
          kill(g, "water");
          syncHud();
          return true;
        }
        g.frog.x = Math.max(
          13,
          Math.min(W - 13, g.frog.x + cover.lane.speed * cover.lane.def.dir * f),
        );
      } else if (isRoad(row)) {
        const cover = findCover(g, row, g.frog.x);
        if (cover) {
          kill(g, "car");
          syncHud();
          return true;
        }
      }

      syncHud();
      return true;
    },
    [syncHud],
  );

  // main loop
  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const f = Math.min((t - last) / 16.667, 2.4);
      last = t;
      if (!tick(f)) {
        setNewBest(submit(gameRef.current?.score ?? 0));
        setStatus("over");
        draw();
        return;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, tick, draw, submit]);

  useEffect(() => {
    if (status !== "playing") draw();
  }, [status, draw]);

  const hop = useCallback(
    (dx: number, dy: number) => {
      const g = gameRef.current;
      if (!g || status !== "playing" || g.dead > 0 || g.ready > 0) return;
      const row = g.frog.row + dy;
      if (row < R_HOMES || row > R_START) return;

      g.frog.row = row;
      g.frog.x = Math.max(13, Math.min(W - 13, g.frog.x + dx * CW));
      if (row < g.bestRow) {
        g.bestRow = row;
        g.score += 10;
      }

      if (row === R_HOMES) {
        const home = resolveHome(g);
        if (home) setBanner(home);
      }
      syncHud();
    },
    [status, syncHud],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === " " || key === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
        else if (gameRef.current && gameRef.current.ready > 0) {
          gameRef.current.ready = 0;
          setBanner(null);
        }
        return;
      }
      const dirs: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        w: [0, -1],
        s: [0, 1],
        a: [-1, 0],
        d: [1, 0],
      };
      const dir = dirs[key];
      if (!dir) return;
      e.preventDefault();
      if (status !== "playing") {
        start();
        return;
      }
      hop(dir[0], dir[1]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start, hop]);

  /* ---------------- touch: swipe to hop ---------------- */

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const from = touchStart.current;
    const t = e.changedTouches[0];
    touchStart.current = null;
    if (!from || !t) return;
    const dx = t.clientX - from.x;
    const dy = t.clientY - from.y;
    if (status !== "playing") {
      start();
      return;
    }
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    if (Math.abs(dx) > Math.abs(dy)) hop(Math.sign(dx), 0);
    else hop(0, Math.sign(dy));
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={hud.score} best={best ?? "—"}>
        <span className="text-rose-400">
          Lives <b className="ml-1 text-sm text-ink">{"❤".repeat(Math.max(0, hud.lives)) || "—"}</b>
        </span>
        <span className="text-cyan-400">
          Homes <b className="ml-1 text-sm text-ink">{hud.homes}/5</b>
        </span>
        <span className="text-accent">
          Time{" "}
          <b
            className={`ml-1 text-sm tabular-nums ${hud.time <= 5 ? "text-warn" : "text-ink"}`}
          >
            {hud.time}s
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(52,211,153,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          aria-label="Traffic Hop game board"
        />

        {banner && (
          <div className="animate-pop pointer-events-none absolute inset-x-0 top-[46%] grid place-items-center">
            <span className="rounded-full border border-white/25 bg-black/75 px-5 py-2 font-display text-lg font-bold tracking-[0.25em] text-white backdrop-blur">
              {banner}
            </span>
          </div>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">TRAFFIC HOP</p>
            <p className="mt-2 text-sm text-muted">
              Hop the lanes, ride the logs, fill all five homes.
            </p>
            <p className="mt-1 text-xs text-muted">
              30s per crossing · +10 per step · +50 per home · 3 lives
            </p>
            <PrimaryButton onClick={start} tone="from-lime-400 via-emerald-500 to-teal-600">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Arrows / WASD · swipe on touch · Space to start
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">RUN OVER</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{hud.score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {hud.crossings} crossings · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-lime-400 via-emerald-500 to-teal-600">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Turtles dive mid-crossing · the traffic widens every home you reach
      </p>
    </div>
  );
}
