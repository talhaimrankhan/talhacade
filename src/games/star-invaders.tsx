"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 440;
const H = 520;
const ROWS = 5;
const COLS = 11;
const CELL_W = 30;
const CELL_H = 26;
const FORM_W = (COLS - 1) * CELL_W + 22;
const SHIP_Y = H - 44;
const SHIELD_Y = H - 150;

type Status = "idle" | "playing" | "over";

const ROW_PTS = [30, 20, 20, 10, 10];

/** Two-frame sprite sets, top rows to bottom rows. */
const SPRITES: string[][][] = [
  [
    [
      "..X.....X..",
      "...X...X...",
      "..XXXXXXX..",
      ".XX.XXX.XX.",
      "XXXXXXXXXXX",
      "X.XXXXXXX.X",
      "X.X.....X.X",
      "...XX.XX...",
    ],
    [
      "..X.....X..",
      "X..X...X..X",
      "X.XXXXXXX.X",
      "XXX.XXX.XXX",
      "XXXXXXXXXXX",
      ".XXXXXXXXX.",
      "..X.....X..",
      ".X.......X.",
    ],
  ],
  [
    [
      "..XX...XX..",
      ".XXXX.XXXX.",
      "XXX.XXXXXXX",
      "XXXXXXXXXXX",
      "..XXXXXXX..",
      ".XX...XX.XX",
      "X.........X",
      ".X.......X.",
    ],
    [
      "..XX...XX..",
      ".XXXX.XXXX.",
      "XXX.XXXXXXX",
      "XXXXXXXXXXX",
      "..XXXXXXX..",
      "...X...X...",
      "..X.....X..",
      "...........",
    ],
  ],
  [
    [
      "...XXXX...",
      "..XXXXXX..",
      ".XXXXXXXX.",
      "XX.XX.XX.XX",
      "XXXXXXXXXX",
      "..XX..XX..",
      ".XX.XX.XX.",
      "X........X",
    ],
    [
      "...XXXX...",
      "..XXXXXX..",
      ".XXXXXXXX.",
      "XX.XX.XX.XX",
      "XXXXXXXXXX",
      ".XX..XX.X.",
      "X..XX..X.X",
      ".X......X.",
    ],
  ],
];

const ROW_COLOR = ["#f472b6", "#f472b6", "#22d3ee", "#22d3ee", "#34d399"];

const SHIP_SPRITE = [
  ".....X.....",
  "....XXX....",
  "....XXX....",
  "..XXXXXXX..",
  ".XXXXXXXXX.",
  "XXX.XXX.XXX",
  "XX.......XX",
];

const SAUCER_SPRITE = [
  "....XXXX....",
  "..XXXXXXXX..",
  ".XXXXXXXXXX.",
  "XX.XX.XX.XX.",
  ".XXXXXXXXXX.",
  "...X....X...",
];

const spriteCache = new Map<string, HTMLCanvasElement>();

function sprite(rows: string[], color: string): HTMLCanvasElement {
  const key = `${rows.join("|")}|${color}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = rows[0].length * 2;
  c.height = rows.length * 2;
  const cx = c.getContext("2d");
  if (cx) {
    cx.fillStyle = color;
    rows.forEach((row, y) =>
      row.split("").forEach((ch, x) => {
        if (ch !== ".") cx.fillRect(x * 2, y * 2, 2, 2);
      }),
    );
  }
  spriteCache.set(key, c);
  return c;
}

function shieldGrid(): boolean[][] {
  const cols = 16;
  const rows = 12;
  return Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      // dome shape with two legs
      if (y < 4 && (x < 2 - y || x > 13 + y)) return false;
      if (y > 7 && x > 5 && x < 10) return false;
      return true;
    }),
  );
}

interface Shot {
  x: number;
  y: number;
}

interface Boom {
  x: number;
  y: number;
  age: number;
}

interface InvadersGame {
  aliens: boolean[][];
  fx: number;
  fy: number;
  fdir: number;
  frame: number;
  tickT: number;
  shipX: number;
  bullet: Shot | null;
  bombs: Shot[];
  saucer: { x: number; worth: number } | null;
  saucerT: number;
  shields: boolean[][][];
  booms: Boom[];
  score: number;
  lives: number;
  wave: number;
  bombT: number;
  freeze: number;
  banner: string;
  bannerT: number;
  over: boolean;
  dirty: boolean;
}

function aliveCount(g: InvadersGame): number {
  let n = 0;
  for (const row of g.aliens) for (const a of row) if (a) n++;
  return n;
}

function tickInterval(g: InvadersGame, alive: number): number {
  const base = 120 + alive * 11;
  return Math.max(45, base * Math.max(0.5, 1 - (g.wave - 1) * 0.12));
}

function lowestAlien(g: InvadersGame, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (g.aliens[r][col]) return r;
  return -1;
}

function alienY(g: InvadersGame, row: number): number {
  return g.fy + row * CELL_H + CELL_H / 2;
}

function alienX(g: InvadersGame, col: number): number {
  return g.fx + col * CELL_W + 11;
}

function createGame(): InvadersGame {
  const aliens = Array.from({ length: ROWS }, () =>
    Array<boolean>(COLS).fill(true),
  );
  return {
    aliens,
    fx: 22,
    fy: 58,
    fdir: 1,
    frame: 0,
    tickT: 0,
    shipX: W / 2,
    bullet: null,
    bombs: [],
    saucer: null,
    saucerT: 9 + Math.random() * 8,
    shields: [shieldGrid(), shieldGrid()],
    booms: [],
    score: 0,
    lives: 3,
    wave: 1,
    bombT: 1,
    freeze: 1.4,
    banner: "WAVE 1",
    bannerT: 1.4,
    over: false,
    dirty: true,
  };
}

function nextWave(g: InvadersGame): void {
  g.wave += 1;
  g.aliens = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(true));
  g.fx = 22;
  g.fy = 58;
  g.fdir = 1;
  g.frame = 0;
  g.bullet = null;
  g.bombs = [];
  g.shields = [shieldGrid(), shieldGrid()];
  g.score += 50 * g.wave;
  g.freeze = 1.4;
  g.banner = `WAVE ${g.wave}`;
  g.bannerT = 1.4;
  g.dirty = true;
}

/** Erode a shield around an impact point. */
function erode(grid: boolean[][], x: number, y: number): void {
  const cols = grid[0].length;
  const rows = grid.length;
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      if (!grid[ry][rx]) continue;
      const dx = rx * 4 + 2 - x;
      const dy = ry * 4 + 2 - y;
      if (dx * dx + dy * dy < 90) grid[ry][rx] = false;
    }
  }
}

function fire(g: InvadersGame): void {
  if (g.bullet || g.freeze > 0 || g.over) return;
  g.bullet = { x: g.shipX, y: SHIP_Y - 10 };
}

function stepGame(g: InvadersGame, dt: number): void {
  if (g.freeze > 0) {
    g.freeze = Math.max(0, g.freeze - dt);
    g.bannerT = Math.max(0, g.bannerT - dt);
    if (g.bannerT === 0) g.banner = "";
    return;
  }

  // formation march
  const alive = aliveCount(g);
  if (alive === 0) {
    nextWave(g);
    return;
  }

  g.tickT += dt * 1000;
  const interval = tickInterval(g, alive);
  if (g.tickT >= interval) {
    g.tickT -= interval;
    const nx = g.fx + g.fdir * 8;
    const atEdge = nx < 10 || nx + FORM_W > W - 10;
    if (atEdge) {
      g.fdir *= -1;
      g.fy += 16;
    } else {
      g.fx = nx;
    }
    g.frame ^= 1;
  }

  // alien bombs
  g.bombT -= dt;
  if (g.bombT <= 0) {
    g.bombT = Math.max(0.28, (0.75 + Math.random() * 0.7) - (g.wave - 1) * 0.06);
    const cols: number[] = [];
    for (let c = 0; c < COLS; c++) if (lowestAlien(g, c) >= 0) cols.push(c);
    if (cols.length) {
      const col = cols[Math.floor(Math.random() * cols.length)];
      const r = lowestAlien(g, col);
      g.bombs.push({ x: alienX(g, col), y: alienY(g, r) + 8 });
    }
  }

  // bonus saucer
  if (g.saucer) {
    g.saucer.x += 140 * dt * (g.saucer.x > W / 2 ? -1 : 1);
    if (g.saucer.x < -30 || g.saucer.x > W + 30) g.saucer = null;
  } else {
    g.saucerT -= dt;
    if (g.saucerT <= 0) {
      g.saucerT = 11 + Math.random() * 9;
      const fromLeft = Math.random() < 0.5;
      g.saucer = {
        x: fromLeft ? -20 : W + 20,
        worth: [50, 100, 150][Math.floor(Math.random() * 3)],
      };
    }
  }

  // player bullet
  if (g.bullet) {
    g.bullet.y -= 440 * dt;
    if (g.bullet.y < -8) {
      g.bullet = null;
    } else {
      // saucer hit
      if (
        g.saucer &&
        Math.abs(g.bullet.x - g.saucer.x) < 16 &&
        Math.abs(g.bullet.y - 36) < 10
      ) {
        g.score += g.saucer.worth;
        g.booms.push({ x: g.saucer.x, y: 36, age: 0 });
        g.saucer = null;
        g.bullet = null;
        g.dirty = true;
      }
    }
  }

  // alien hits
  if (g.bullet) {
    let hitRow = -1;
    let hitCol = -1;
    for (let r = 0; r < ROWS && hitRow < 0; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!g.aliens[r][c]) continue;
        if (
          Math.abs(g.bullet.x - alienX(g, c)) < 11 &&
          Math.abs(g.bullet.y - alienY(g, r)) < 9
        ) {
          hitRow = r;
          hitCol = c;
          break;
        }
      }
    }
    if (hitRow >= 0) {
      g.aliens[hitRow][hitCol] = false;
      g.score += ROW_PTS[hitRow] * g.wave;
      g.booms.push({ x: alienX(g, hitCol), y: alienY(g, hitRow), age: 0 });
      g.bullet = null;
      g.dirty = true;
    }
  }

  // shields absorb shots
  if (g.bullet) {
    for (let s = 0; s < g.shields.length; s++) {
      const sx = s === 0 ? 88 : 288;
      const lx = g.bullet.x - sx;
      const ly = g.bullet.y - SHIELD_Y;
      if (lx >= 0 && lx < 64 && ly >= 0 && ly < 48) {
        erode(g.shields[s], lx, ly);
        g.bullet = null;
        break;
      }
    }
  }

  // bombs
  const speed = 200 + (g.wave - 1) * 18;
  for (let i = g.bombs.length - 1; i >= 0; i--) {
    const b = g.bombs[i];
    b.y += speed * dt;

    // shields absorb bombs
    let absorbed = false;
    for (let s = 0; s < g.shields.length; s++) {
      const sx = s === 0 ? 88 : 288;
      const lx = b.x - sx;
      const ly = b.y - SHIELD_Y;
      if (lx >= 0 && lx < 64 && ly >= 0 && ly < 48) {
        erode(g.shields[s], lx, ly);
        absorbed = true;
        break;
      }
    }
    if (absorbed) {
      g.bombs.splice(i, 1);
      continue;
    }

    if (b.y > SHIP_Y - 8 && Math.abs(b.x - g.shipX) < 11) {
      g.bombs.splice(i, 1);
      g.lives -= 1;
      g.dirty = true;
      g.booms.push({ x: g.shipX, y: SHIP_Y, age: 0 });
      if (g.lives <= 0) {
        g.over = true;
        return;
      }
      g.freeze = 1.3;
      g.banner = "READY";
      g.bannerT = 1.3;
      return;
    }
    if (b.y > H + 8) g.bombs.splice(i, 1);
  }

  // aliens reached the ship line
  for (let c = 0; c < COLS; c++) {
    const r = lowestAlien(g, c);
    if (r >= 0 && alienY(g, r) > SHIP_Y - 16) {
      g.over = true;
      return;
    }
  }

  for (let i = g.booms.length - 1; i >= 0; i--) {
    g.booms[i].age += dt;
    if (g.booms[i].age > 0.4) g.booms.splice(i, 1);
  }
}

export default function StarInvaders({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<InvadersGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [banner, setBanner] = useState("WAVE 1");
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const keys = useRef({ left: false, right: false });
  const dragging = useRef(false);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    // starfield
    ctx.fillStyle = "#07070e";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(226, 232, 240, 0.5)";
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % W;
      const y = ((i * 61) + time / 60) % H;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // shields
    for (let s = 0; s < g.shields.length; s++) {
      const sx = s === 0 ? 88 : 288;
      const grid = g.shields[s];
      ctx.fillStyle = "#34d399";
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
          if (!grid[y][x]) continue;
          ctx.fillRect(sx + x * 4, SHIELD_Y + y * 4, 4, 4);
        }
      }
    }

    // aliens
    for (let r = 0; r < ROWS; r++) {
      const art = sprite(SPRITES[Math.floor(r / 2) % 3][g.frame], ROW_COLOR[r]);
      for (let c = 0; c < COLS; c++) {
        if (!g.aliens[r][c]) continue;
        ctx.drawImage(art, alienX(g, c) - art.width / 2, alienY(g, r) - art.height / 2);
      }
    }

    // saucer
    if (g.saucer) {
      const s = sprite(SAUCER_SPRITE, "#f87171");
      ctx.drawImage(s, g.saucer.x - s.width / 2, 36 - s.height / 2);
    }

    // bombs (zig-zag bolts)
    ctx.fillStyle = "#facc15";
    for (const b of g.bombs) {
      const wob = Math.sin(time / 60 + b.y) * 2;
      ctx.fillRect(b.x - 1.5 + wob, b.y - 5, 3, 10);
    }

    // player bullet
    if (g.bullet) {
      ctx.save();
      ctx.shadowColor = "#67e8f9";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#67e8f9";
      ctx.fillRect(g.bullet.x - 1.5, g.bullet.y - 7, 3, 14);
      ctx.restore();
    }

    // explosions
    for (const boom of g.booms) {
      const t = boom.age / 0.4;
      ctx.strokeStyle = `rgba(251, 191, 36, ${1 - t})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(boom.x, boom.y, 4 + t * 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ship
    const ship = sprite(SHIP_SPRITE, "#67e8f9");
    const blink = g.freeze > 0 && g.banner === "READY" && Math.floor(time / 140) % 2 === 0;
    if (!blink) ctx.drawImage(ship, g.shipX - ship.width / 2, SHIP_Y - ship.height / 2);

    // ground line
    ctx.fillStyle = "rgba(103, 232, 249, 0.35)";
    ctx.fillRect(0, H - 14, W, 1.5);
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

  /* ---------------- game loop ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame();
    keys.current = { left: false, right: false };
    setScore(0);
    setLives(3);
    setWave(1);
    setBanner("WAVE 1");
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastBanner = "WAVE 1";

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      if (!g.over && g.freeze <= 0) {
        const speed = 270;
        if (keys.current.left) g.shipX -= speed * dt;
        if (keys.current.right) g.shipX += speed * dt;
        g.shipX = Math.max(14, Math.min(W - 14, g.shipX));
      }

      stepGame(g, dt);

      if (g.dirty) {
        g.dirty = false;
        setScore(g.score);
        setLives(g.lives);
        setWave(g.wave);
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

      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, submit, draw]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        keys.current.left = true;
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        keys.current.right = true;
      } else if (e.key === " ") {
        e.preventDefault();
        if (status !== "playing") {
          start();
        } else {
          const g = gameRef.current;
          if (g) fire(g);
        }
      } else if (e.key === "Enter" && status !== "playing") {
        e.preventDefault();
        start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") keys.current.left = false;
      if (e.key === "ArrowRight") keys.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start]);

  const aimShip = (clientX: number) => {
    const canvas = canvasRef.current;
    const g = gameRef.current;
    if (!canvas || !g) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    g.shipX = Math.max(14, Math.min(W - 14, x));
  };

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Wave <b className="ml-1 text-sm text-ink">{wave}</b>
        </span>
        <span>
          Lives{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${lives} lives`}>
            {"🚀".repeat(Math.max(0, lives))}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-24px_rgba(34,211,238,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          aria-label="Star Invaders playfield"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") {
              start();
              return;
            }
            const g = gameRef.current;
            if (!g) return;
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            aimShip(e.clientX);
            fire(g);
          }}
          onPointerMove={(e) => {
            if (dragging.current) aimShip(e.clientX);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        />

        {banner && status === "playing" && (
          <p className="pointer-events-none absolute inset-x-0 top-[38%] text-center font-display text-3xl font-bold tracking-widest text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            {banner}
          </p>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">STAR INVADERS</p>
            <p className="mt-2 text-sm text-muted">
              The formation marches down. Hold the line, shield what you can.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-violet-500 via-purple-500 to-fuchsia-500"
            >
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ←/→ or drag to move · Space or tap to fire
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">INVASION</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · held through wave {wave}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-violet-500 via-purple-500 to-fuchsia-500"
            >
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        One shot airborne at a time · top row aliens pay 30 × wave
      </p>
    </div>
  );
}
