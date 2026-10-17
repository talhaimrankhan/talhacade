"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay, PrimaryButton } from "@/games/parts";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";

const COLS = 19;
const ROWS = 10;
const CELL = 26;
const W = COLS * CELL;
const H = ROWS * CELL;
const START_COINS = 175;
const START_LIVES = 10;

type TowerKind = "pulse" | "mortar" | "rail";
type EnemyKind = "runner" | "grunt" | "tank";

interface TowerDef {
  name: string;
  blurb: string;
  cost: number;
  range: number;
  cd: number;
  dmg: number;
  splash: number;
  color: string;
}

const TOWERS: Record<TowerKind, TowerDef> = {
  pulse: {
    name: "Pulse",
    blurb: "Fast fire, low damage",
    cost: 50,
    range: 3.3,
    cd: 0.4,
    dmg: 7,
    splash: 0,
    color: "#22d3ee",
  },
  mortar: {
    name: "Mortar",
    blurb: "Slow shells, splash damage",
    cost: 90,
    range: 4.6,
    cd: 1.6,
    dmg: 16,
    splash: 1.35,
    color: "#fb7185",
  },
  rail: {
    name: "Rail",
    blurb: "Long range, heavy hit",
    cost: 130,
    range: 6.5,
    cd: 1.2,
    dmg: 34,
    splash: 0,
    color: "#a78bfa",
  },
};

const TOWER_ORDER: TowerKind[] = ["pulse", "mortar", "rail"];

interface EnemyDef {
  name: string;
  speed: number;
  bounty: number;
  leak: number;
  armor: number;
  radius: number;
  color: string;
}

const ENEMIES: Record<EnemyKind, EnemyDef> = {
  runner: { name: "Runner", speed: 2.4, bounty: 6, leak: 1, armor: 0, radius: 5, color: "#f472b6" },
  grunt: { name: "Grunt", speed: 1.4, bounty: 8, leak: 1, armor: 0, radius: 6.5, color: "#fb923c" },
  tank: { name: "Tank", speed: 0.85, bounty: 18, leak: 2, armor: 2, radius: 8.5, color: "#c084fc" },
};

interface Spawn {
  kind: EnemyKind;
  count: number;
  hp: number;
  gap: number;
}
interface Wave {
  label: string;
  spawns: Spawn[];
}

const WAVES: Wave[] = [
  { label: "8 Grunts", spawns: [{ kind: "grunt", count: 8, hp: 24, gap: 1.1 }] },
  {
    label: "10 Grunts · 4 Runners",
    spawns: [
      { kind: "grunt", count: 10, hp: 30, gap: 1 },
      { kind: "runner", count: 4, hp: 20, gap: 0.7 },
    ],
  },
  {
    label: "6 Grunts · 6 Runners",
    spawns: [
      { kind: "grunt", count: 6, hp: 38, gap: 0.9 },
      { kind: "runner", count: 6, hp: 24, gap: 0.6 },
    ],
  },
  {
    label: "1 Tank · 8 Grunts",
    spawns: [
      { kind: "tank", count: 1, hp: 120, gap: 1 },
      { kind: "grunt", count: 8, hp: 44, gap: 0.9 },
    ],
  },
  {
    label: "12 Runners · 5 Grunts",
    spawns: [
      { kind: "runner", count: 12, hp: 32, gap: 0.5 },
      { kind: "grunt", count: 5, hp: 50, gap: 0.9 },
    ],
  },
  {
    label: "2 Tanks · 8 Grunts",
    spawns: [
      { kind: "tank", count: 2, hp: 160, gap: 2 },
      { kind: "grunt", count: 8, hp: 56, gap: 0.85 },
    ],
  },
  {
    label: "14 Runners · 6 Grunts",
    spawns: [
      { kind: "runner", count: 14, hp: 40, gap: 0.45 },
      { kind: "grunt", count: 6, hp: 64, gap: 0.8 },
    ],
  },
  {
    label: "3 Tanks · 10 Grunts",
    spawns: [
      { kind: "tank", count: 3, hp: 200, gap: 2.2 },
      { kind: "grunt", count: 10, hp: 70, gap: 0.8 },
    ],
  },
  {
    label: "16 Runners · 8 Grunts",
    spawns: [
      { kind: "runner", count: 16, hp: 50, gap: 0.4 },
      { kind: "grunt", count: 8, hp: 78, gap: 0.75 },
    ],
  },
  {
    label: "4 Tanks · 12 Grunts",
    spawns: [
      { kind: "tank", count: 4, hp: 260, gap: 2.4 },
      { kind: "grunt", count: 12, hp: 86, gap: 0.7 },
    ],
  },
  {
    label: "18 Runners · 10 Grunts",
    spawns: [
      { kind: "runner", count: 18, hp: 62, gap: 0.35 },
      { kind: "grunt", count: 10, hp: 96, gap: 0.65 },
    ],
  },
  {
    label: "6 Tanks · 14 Grunts · 10 Runners",
    spawns: [
      { kind: "tank", count: 6, hp: 340, gap: 2.4 },
      { kind: "grunt", count: 14, hp: 110, gap: 0.6 },
      { kind: "runner", count: 10, hp: 80, gap: 0.4 },
    ],
  },
];

/** Serpentine lane in grid-centre coordinates. */
const WAYPOINTS = [
  { x: -1, y: 1.5 },
  { x: 17.5, y: 1.5 },
  { x: 17.5, y: 3.5 },
  { x: 1.5, y: 3.5 },
  { x: 1.5, y: 5.5 },
  { x: 17.5, y: 5.5 },
  { x: 17.5, y: 7.5 },
  { x: 1.5, y: 7.5 },
  { x: 1.5, y: 9.5 },
  { x: 20, y: 9.5 },
];

const PATH: Set<number> = buildPath();

function buildPath(): Set<number> {
  const set = new Set<number>();
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const a = WAYPOINTS[i];
    const b = WAYPOINTS[i + 1];
    if (a.y === b.y) {
      const row = Math.round(a.y - 0.5);
      const c0 = Math.min(Math.floor(a.x), Math.floor(b.x));
      const c1 = Math.max(Math.floor(a.x), Math.floor(b.x));
      for (let c = c0; c <= c1; c++) {
        if (c >= 0 && c < COLS && row >= 0 && row < ROWS) set.add(row * COLS + c);
      }
    } else {
      const col = Math.round(a.x - 0.5);
      const r0 = Math.min(Math.floor(a.y), Math.floor(b.y));
      const r1 = Math.max(Math.floor(a.y), Math.floor(b.y));
      for (let r = r0; r <= r1; r++) {
        if (r >= 0 && r < ROWS && col >= 0 && col < COLS) set.add(r * COLS + col);
      }
    }
  }
  return set;
}

/* ------------------------------------------------------------------ */
/* Mutable game state (owned by the RAF loop)                          */
/* ------------------------------------------------------------------ */

interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  wp: number;
  x: number;
  y: number;
  traveled: number;
  done: boolean;
}

interface Tower {
  id: number;
  kind: TowerKind;
  c: number;
  r: number;
  level: number;
  cd: number;
  invested: number;
  aim: number;
}

interface Shot {
  sx: number;
  sy: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  kind: TowerKind;
  dmg: number;
  splash: number;
  target: number;
  arc: number;
  done: boolean;
}

interface Game {
  coins: number;
  lives: number;
  wave: number;
  active: boolean;
  queue: { kind: EnemyKind; hp: number; gap: number }[];
  gapTimer: number;
  enemies: Enemy[];
  towers: Tower[];
  shots: Shot[];
  over: boolean;
  victory: boolean;
  speed: number;
  nextId: number;
}

function createGame(): Game {
  return {
    coins: START_COINS,
    lives: START_LIVES,
    wave: 0,
    active: false,
    queue: [],
    gapTimer: 0,
    enemies: [],
    towers: [],
    shots: [],
    over: false,
    victory: false,
    speed: 1,
    nextId: 1,
  };
}

function upgradeCost(t: Tower): number {
  return Math.round(TOWERS[t.kind].cost * 0.6 * t.level);
}
function sellValue(t: Tower): number {
  return Math.round(t.invested * 0.7);
}
function towerRange(t: Tower): number {
  return TOWERS[t.kind].range + 0.4 * (t.level - 1);
}
function towerDamage(t: Tower): number {
  return TOWERS[t.kind].dmg * (1 + 0.6 * (t.level - 1));
}
function towerCooldown(t: Tower): number {
  return TOWERS[t.kind].cd * (1 - 0.12 * (t.level - 1));
}

function damageEnemy(g: Game, e: Enemy, raw: number): void {
  const def = ENEMIES[e.kind];
  const dmg = Math.max(1, Math.round(raw - def.armor));
  e.hp -= dmg;
  if (e.hp <= 0 && !e.done) {
    e.done = true;
    g.coins += def.bounty;
  }
}

function update(g: Game, dt: number): void {
  // spawning
  if (g.active && g.queue.length > 0) {
    g.gapTimer -= dt;
    if (g.gapTimer <= 0) {
      const next = g.queue.shift();
      if (next) {
        g.enemies.push({
          id: g.nextId++,
          kind: next.kind,
          hp: next.hp,
          maxHp: next.hp,
          wp: 1,
          x: WAYPOINTS[0].x,
          y: WAYPOINTS[0].y,
          traveled: 0,
          done: false,
        });
        g.gapTimer = g.queue[0]?.gap ?? 0.5;
      }
    }
  }

  // enemies walk the lane
  for (const e of g.enemies) {
    if (e.done) continue;
    const target = WAYPOINTS[e.wp];
    if (!target) {
      g.lives -= ENEMIES[e.kind].leak;
      e.done = true;
      continue;
    }
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const dist = Math.hypot(dx, dy);
    const step = ENEMIES[e.kind].speed * dt;
    if (dist <= step) {
      e.traveled += dist;
      e.x = target.x;
      e.y = target.y;
      e.wp += 1;
    } else {
      e.traveled += step;
      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
    }
  }
  if (g.enemies.some((e) => e.done)) {
    g.enemies = g.enemies.filter((e) => !e.done);
  }

  // towers fire
  for (const t of g.towers) {
    t.cd -= dt;
    if (t.cd > 0) continue;
    const cx = t.c + 0.5;
    const cy = t.r + 0.5;
    const range = towerRange(t);
    let target: Enemy | null = null;
    for (const e of g.enemies) {
      if (e.done || Math.hypot(e.x - cx, e.y - cy) > range) continue;
      if (!target || e.traveled > target.traveled) target = e;
    }
    if (!target) continue;

    t.cd = towerCooldown(t);
    t.aim = Math.atan2(target.y - cy, target.x - cx);

    let aimX = target.x;
    let aimY = target.y;
    if (t.kind === "mortar") {
      // lead the target by half a second of travel
      const wp = WAYPOINTS[target.wp];
      if (wp) {
        const d = Math.hypot(wp.x - target.x, wp.y - target.y) || 1;
        const lead = ENEMIES[target.kind].speed * 0.5;
        aimX += ((wp.x - target.x) / d) * lead;
        aimY += ((wp.y - target.y) / d) * lead;
      }
    }

    g.shots.push({
      sx: cx,
      sy: cy,
      x: cx,
      y: cy,
      tx: aimX,
      ty: aimY,
      t: 0,
      dur: t.kind === "mortar" ? 0.5 : t.kind === "rail" ? 0.1 : 0.14,
      kind: t.kind,
      dmg: towerDamage(t),
      splash: TOWERS[t.kind].splash,
      target: target.id,
      arc: t.kind === "mortar" ? 26 : 0,
      done: false,
    });
  }

  // projectiles
  for (const s of g.shots) {
    if (s.done) continue;
    s.t += dt / s.dur;
    if (s.t < 1) {
      s.x = s.sx + (s.tx - s.sx) * s.t;
      s.y = s.sy + (s.ty - s.sy) * s.t;
      continue;
    }
    s.done = true;
    if (s.kind === "mortar") {
      for (const e of g.enemies) {
        if (e.done) continue;
        const d = Math.hypot(e.x - s.tx, e.y - s.ty);
        if (d > s.splash) continue;
        damageEnemy(g, e, s.dmg * (1 - 0.5 * (d / s.splash)));
      }
    } else {
      const victim = g.enemies.find((e) => e.id === s.target && !e.done);
      if (victim) damageEnemy(g, victim, s.dmg);
    }
  }
  if (g.shots.some((s) => s.done)) {
    g.shots = g.shots.filter((s) => !s.done);
  }
  if (g.enemies.some((e) => e.done)) {
    g.enemies = g.enemies.filter((e) => !e.done);
  }

  // wave cleared
  if (g.active && g.queue.length === 0 && g.enemies.length === 0) {
    g.active = false;
    g.wave += 1;
    if (g.wave >= WAVES.length) {
      g.victory = true;
      g.over = true;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface TowerView {
  index: number;
  kind: TowerKind;
  level: number;
  invested: number;
}

interface Hud {
  coins: number;
  lives: number;
  wave: number;
  active: boolean;
}

export default function NeonTowerDefense({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [phase, setPhase] = useState<"idle" | "playing" | "over">("idle");
  const [hud, setHud] = useState<Hud>({
    coins: START_COINS,
    lives: START_LIVES,
    wave: 0,
    active: false,
  });
  const [towers, setTowers] = useState<TowerView[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  /* ---------------- drawing ---------------- */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    ctx.fillStyle = "#0a0a16";
    ctx.fillRect(0, 0, W, H);

    // cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        ctx.fillStyle = PATH.has(i) ? "#16162e" : "#0e0e1e";
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        ctx.strokeStyle = "rgba(120,120,190,0.10)";
        ctx.strokeRect(c * CELL + 0.5, r * CELL + 0.5, CELL - 1, CELL - 1);
      }
    }

    // lane centre line
    ctx.save();
    ctx.setLineDash([6, 7]);
    ctx.strokeStyle = "rgba(34,211,238,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    WAYPOINTS.forEach((w, i) => {
      const px = w.x * CELL;
      const py = w.y * CELL;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();

    // base gate
    ctx.save();
    ctx.fillStyle = "#f43f5e";
    ctx.shadowColor = "#f43f5e";
    ctx.shadowBlur = 14;
    ctx.fillRect(W - 6, 9 * CELL + 3, 6, CELL - 6);
    ctx.restore();

    // selection
    if (selected !== null && !g.over) {
      const sc = selected % COLS;
      const sr = Math.floor(selected / COLS);
      ctx.strokeStyle = "rgba(34,211,238,0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(sc * CELL + 2, sr * CELL + 2, CELL - 4, CELL - 4);
    }

    // towers
    for (const t of g.towers) {
      const cx = t.c * CELL + CELL / 2;
      const cy = t.r * CELL + CELL / 2;
      const def = TOWERS[t.kind];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "#1b1b32";
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-9, -9, 18, 18, 5);
      ctx.fill();
      ctx.stroke();
      ctx.rotate(t.aim);
      ctx.fillStyle = def.color;
      ctx.fillRect(-2, -2.5, 13, 5);
      ctx.restore();
      for (let p = 0; p < t.level; p++) {
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(cx - 5 + p * 5, cy + 12, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // range ring when selected
      if (selected !== null && selected === t.r * COLS + t.c) {
        ctx.strokeStyle = "rgba(34,211,238,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, towerRange(t) * CELL, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // enemies
    for (const e of g.enemies) {
      const def = ENEMIES[e.kind];
      const px = e.x * CELL;
      const py = e.y * CELL;
      ctx.save();
      ctx.fillStyle = def.color;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px, py, def.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const pct = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(px - 9, py - def.radius - 7, 18, 4);
      ctx.fillStyle = pct > 0.5 ? "#34d399" : pct > 0.25 ? "#fbbf24" : "#f43f5e";
      ctx.fillRect(px - 9, py - def.radius - 7, 18 * pct, 4);
    }

    // shots
    for (const s of g.shots) {
      const py = s.arc > 0 ? s.y - Math.sin(s.t * Math.PI) * s.arc : s.y;
      ctx.save();
      if (s.kind === "rail") {
        ctx.strokeStyle = "rgba(167,139,250,0.85)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(s.sx * CELL, s.sy * CELL);
        ctx.lineTo(s.x * CELL, py * CELL);
        ctx.stroke();
      } else {
        ctx.fillStyle = TOWERS[s.kind].color;
        ctx.shadowColor = TOWERS[s.kind].color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(s.x * CELL, py * CELL, s.kind === "mortar" ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }, [selected]);

  // canvas sizing + repaint on selection change
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

  /* ---------------- main loop ---------------- */

  useEffect(() => {
    if (phase === "over") return;

    let raf = 0;
    let last = performance.now();
    const g0 = gameRef.current;
    let lastCoins = g0 ? g0.coins : -1;
    let lastLives = g0 ? g0.lives : -1;
    let lastWave = g0 ? g0.wave : -1;
    let lastActive = g0 ? g0.active : false;

    const loop = (t: number) => {
      const g = gameRef.current;
      if (g) {
        const dt = Math.min((t - last) / 1000, 0.1);
        last = t;

        if (phase === "playing" && !g.over) {
          update(g, dt * g.speed);
          if (g.lives <= 0) {
            g.lives = 0;
            g.active = false;
            g.over = true;
            setNewBest(submit(g.wave));
            setPhase("over");
          } else if (g.victory) {
            setNewBest(submit(g.wave));
            setPhase("over");
          }
        }

        if (
          g.coins !== lastCoins ||
          g.lives !== lastLives ||
          g.wave !== lastWave ||
          g.active !== lastActive
        ) {
          lastCoins = g.coins;
          lastLives = g.lives;
          lastWave = g.wave;
          lastActive = g.active;
          setHud({
            coins: g.coins,
            lives: g.lives,
            wave: g.wave,
            active: g.active,
          });
        }
      }
      draw();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, draw, submit]);

  /* ---------------- actions ---------------- */

  const syncTowers = () => {
    const g = gameRef.current;
    if (!g) return;
    setTowers(
      g.towers.map((t) => ({
        index: t.r * COLS + t.c,
        kind: t.kind,
        level: t.level,
        invested: t.invested,
      })),
    );
  };

  const startRun = useCallback(() => {
    gameRef.current = createGame();
    setSelected(null);
    setSpeed(1);
    setNewBest(false);
    setTowers([]);
    setHud({
      coins: START_COINS,
      lives: START_LIVES,
      wave: 0,
      active: false,
    });
    setPhase("playing");
  }, []);

  const startWave = () => {
    const g = gameRef.current;
    if (!g || g.over || g.active || phase !== "playing") return;
    const wave = WAVES[g.wave];
    if (!wave) return;
    g.queue = wave.spawns.flatMap((s) =>
      Array.from({ length: s.count }, () => ({ kind: s.kind, hp: s.hp, gap: s.gap })),
    );
    g.active = true;
    g.gapTimer = 0.25;
    setHud({ coins: g.coins, lives: g.lives, wave: g.wave, active: true });
  };

  const toggleSpeed = () => {
    const g = gameRef.current;
    if (!g) return;
    g.speed = g.speed === 1 ? 2 : 1;
    setSpeed(g.speed);
  };

  const build = (kind: TowerKind) => {
    const g = gameRef.current;
    if (!g || g.over || selected === null) return;
    const def = TOWERS[kind];
    if (g.coins < def.cost || PATH.has(selected)) return;
    const c = selected % COLS;
    const r = Math.floor(selected / COLS);
    if (g.towers.some((t) => t.c === c && t.r === r)) return;
    g.towers.push({
      id: g.nextId++,
      kind,
      c,
      r,
      level: 1,
      cd: 0,
      invested: def.cost,
      aim: -Math.PI / 2,
    });
    g.coins -= def.cost;
    setHud({ coins: g.coins, lives: g.lives, wave: g.wave, active: g.active });
    syncTowers();
    draw();
  };

  const upgrade = () => {
    const g = gameRef.current;
    if (!g || g.over || selected === null) return;
    const t = g.towers.find((x) => x.c === selected % COLS && x.r === Math.floor(selected / COLS));
    if (!t || t.level >= 3) return;
    const cost = upgradeCost(t);
    if (g.coins < cost) return;
    g.coins -= cost;
    t.invested += cost;
    t.level += 1;
    setHud({ coins: g.coins, lives: g.lives, wave: g.wave, active: g.active });
    syncTowers();
    draw();
  };

  const sell = () => {
    const g = gameRef.current;
    if (!g || g.over || selected === null) return;
    const idx = g.towers.findIndex(
      (x) => x.c === selected % COLS && x.r === Math.floor(selected / COLS),
    );
    if (idx < 0) return;
    g.coins += sellValue(g.towers[idx]);
    g.towers.splice(idx, 1);
    setHud({ coins: g.coins, lives: g.lives, wave: g.wave, active: g.active });
    syncTowers();
    setSelected(null);
    draw();
  };

  const onBoardClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const g = gameRef.current;
    if (!canvas || !g || g.over) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    const i = r * COLS + c;
    if (PATH.has(i)) return;
    setSelected(i);
  };

  /* ---------------- view ---------------- */

  const selTower =
    selected === null ? undefined : towers.find((t) => t.index === selected);
  const selStats = selTower ? selTowerInfo(selTower) : null;
  const selUpgradeCost = selStats ? upgradeCost(selStats) : 0;
  const selSellValue = selStats ? sellValue(selStats) : 0;
  const selDamage = selStats ? Math.round(towerDamage(selStats)) : 0;
  const nextWave = WAVES[hud.wave];
  const livesTone =
    hud.lives <= 3 ? "text-rose-400" : hud.lives <= 6 ? "text-warn" : "text-success";

  return (
    <div className="w-full max-w-[540px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          🪙 <b className="text-sm text-ink">{hud.coins}</b>
        </span>
        <span className={livesTone}>
          ❤️ <b className="text-sm text-ink">{hud.lives}</b>
        </span>
        <span>
          Wave <b className="text-sm text-ink">{Math.min(hud.wave + 1, WAVES.length)}</b>
          <span className="text-muted">/{WAVES.length}</span>
        </span>
        <span>
          Best <b className="text-sm text-ink">{best ?? "—"}</b>
        </span>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(251,113,133,0.8)]">
        <canvas
          ref={canvasRef}
          onClick={onBoardClick}
          aria-label="Neon tower defense board"
          className="block w-full cursor-crosshair [touch-action:manipulation]"
        />

        {phase === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              NEON TOWER DEFENSE
            </p>
            <p className="mt-2 text-sm text-muted">
              Build beside the lane, then survive all 12 waves.
            </p>
            <PrimaryButton onClick={startRun} tone="from-amber-400 via-orange-500 to-red-500">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Tap a cell to build · kills pay coins
            </p>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              {hud.wave >= WAVES.length ? "ALL WAVES CLEARED 🏆" : "BASE OVERRUN"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best — waves survived!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {hud.wave}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Waves survived · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={startRun} tone="from-amber-400 via-orange-500 to-red-500">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startWave}
          disabled={phase !== "playing" || hud.active || !nextWave}
          aria-label="Start next wave"
          className={cn(
            "rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 px-5 py-2 text-xs font-bold text-black transition",
            phase !== "playing" || hud.active || !nextWave
              ? "cursor-not-allowed opacity-40"
              : "hover:brightness-110 active:scale-95",
          )}
        >
          Start wave
        </button>
        <button
          type="button"
          onClick={toggleSpeed}
          disabled={phase !== "playing"}
          aria-label="Toggle double speed"
          className={cn(
            "rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-wider transition",
            speed === 2
              ? "border-warn/70 bg-warn/15 text-warn"
              : "border-line bg-surface text-muted hover:border-warn/50",
            phase !== "playing" && "cursor-not-allowed opacity-40",
          )}
        >
          Speed ×{speed}
        </button>
        <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-muted">
          {hud.active
            ? "Wave in progress…"
            : nextWave
              ? `Next: ${nextWave.label}`
              : "Final wave cleared"}
        </span>
      </div>

      <div className="mt-3 min-h-[92px] rounded-xl border border-line bg-surface p-3">
        {selected === null ? (
          <p className="text-center text-xs text-muted">
            Tap any buildable cell — not the glowing lane — to open the shop.
          </p>
        ) : selTower && selStats ? (
          <div>
            <div className="flex items-center justify-between font-mono text-xs uppercase tracking-wider">
              <span style={{ color: TOWERS[selTower.kind].color }}>
                {TOWERS[selTower.kind].name}{" "}
                <b className="text-ink">Lv {selTower.level}/3</b>
              </span>
              <span className="text-muted">dmg {selDamage}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {TOWERS[selTower.kind].blurb}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selTower.level < 3 && (
                <button
                  type="button"
                  onClick={upgrade}
                  disabled={hud.coins < selUpgradeCost}
                  aria-label="Upgrade tower"
                  className={cn(
                    "rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink transition",
                    hud.coins < selUpgradeCost
                      ? "cursor-not-allowed opacity-40"
                      : "hover:border-success/60 hover:text-success",
                  )}
                >
                  Upgrade · {selUpgradeCost} 🪙
                </button>
              )}
              <button
                type="button"
                onClick={sell}
                aria-label="Sell tower"
                className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-rose-400/60 hover:text-rose-300"
              >
                Sell · {selSellValue} 🪙
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {TOWER_ORDER.map((kind) => {
              const def = TOWERS[kind];
              const afford = hud.coins >= def.cost;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => build(kind)}
                  disabled={!afford}
                  aria-label={`Build ${def.name} for ${def.cost} coins`}
                  className={cn(
                    "rounded-lg border border-line bg-surface-2 px-2 py-2 text-left transition",
                    afford
                      ? "hover:border-cyan-400/60"
                      : "cursor-not-allowed opacity-40",
                  )}
                >
                  <span
                    className="block text-xs font-bold"
                    style={{ color: def.color }}
                  >
                    {def.name}
                  </span>
                  <span className="block text-[10px] leading-tight text-muted">
                    {def.blurb}
                  </span>
                  <span className="mt-1 block font-mono text-[11px] text-warn">
                    {def.cost} 🪙
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Kills pay coins · upgrades reach Lv 3 · sell returns 70%
      </p>
    </div>
  );
}

/** TowerView → Tower so cost/damage helpers can be reused. */
function selTowerInfo(v: TowerView): Tower {
  return {
    id: 0,
    kind: v.kind,
    c: v.index % COLS,
    r: Math.floor(v.index / COLS),
    level: v.level,
    cd: 0,
    invested: v.invested,
    aim: 0,
  };
}
