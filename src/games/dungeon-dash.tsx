"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Overlay, PrimaryButton } from "@/games/parts";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";

const MAP_W = 30;
const MAP_H = 20;
const VIEW_W = 15;
const VIEW_H = 11;
const SIGHT = 7;
const MAX_HP = 30;
const CELLS = MAP_W * MAP_H;

type MonsterKind = "rat" | "skeleton" | "ogre";

const MONSTER_DEFS: Record<
  MonsterKind,
  { name: string; hp: number; lo: number; hi: number; glyph: string }
> = {
  rat: { name: "rat", hp: 6, lo: 2, hi: 4, glyph: "🐀" },
  skeleton: { name: "skeleton", hp: 12, lo: 3, hi: 6, glyph: "💀" },
  ogre: { name: "ogre", hp: 22, lo: 5, hi: 9, glyph: "👹" },
};

interface Monster {
  id: number;
  kind: MonsterKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  lo: number;
  hi: number;
}

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Run {
  floor: number;
  grid: number[];
  player: { x: number; y: number; hp: number };
  monsters: Monster[];
  potions: { x: number; y: number }[];
  stairs: { x: number; y: number };
  explored: boolean[];
  log: string[];
  dead: boolean;
}

function centre(r: Room): { x: number; y: number } {
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

function carveRoom(grid: number[], r: Room): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) grid[y * MAP_W + x] = 1;
  }
}

function carveH(grid: number[], x0: number, x1: number, y: number): void {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
    grid[y * MAP_W + x] = 1;
  }
}
function carveV(grid: number[], y0: number, y1: number, x: number): void {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
    grid[y * MAP_W + x] = 1;
  }
}

function reveal(explored: boolean[], px: number, py: number): boolean[] {
  const next = explored.slice();
  let changed = false;
  for (let y = Math.max(0, py - SIGHT); y <= Math.min(MAP_H - 1, py + SIGHT); y++) {
    for (let x = Math.max(0, px - SIGHT); x <= Math.min(MAP_W - 1, px + SIGHT); x++) {
      const dx = x - px;
      const dy = y - py;
      if (dx * dx + dy * dy > SIGHT * SIGHT) continue;
      if (!next[y * MAP_W + x]) {
        next[y * MAP_W + x] = true;
        changed = true;
      }
    }
  }
  return changed ? next : explored;
}

function pickMonsterKind(floor: number): MonsterKind {
  const roll = Math.random() * 100;
  const ogreChance = Math.min(8 + floor * 4, 26);
  const skeletonChance = Math.min(30 + floor * 5, 52);
  if (roll < ogreChance) return "ogre";
  if (roll < ogreChance + skeletonChance) return "skeleton";
  return "rat";
}

function spawnMonster(kind: MonsterKind, floor: number, id: number, x: number, y: number): Monster {
  const def = MONSTER_DEFS[kind];
  const hp = def.hp + 2 * (floor - 1);
  return {
    id,
    kind,
    x,
    y,
    hp,
    maxHp: hp,
    lo: def.lo + (floor - 1),
    hi: def.hi + (floor - 1),
  };
}

function generateFloor(floor: number, hp: number): Run {
  const grid = Array<number>(CELLS).fill(0);
  const rooms: Room[] = [];
  const target = 5 + Math.floor(Math.random() * 4); // 5–8 rooms
  let attempts = 0;
  while (rooms.length < target && attempts < 220) {
    attempts++;
    const w = 4 + Math.floor(Math.random() * 5);
    const h = 3 + Math.floor(Math.random() * 3);
    const x = 1 + Math.floor(Math.random() * (MAP_W - w - 2));
    const y = 1 + Math.floor(Math.random() * (MAP_H - h - 2));
    const room = { x, y, w, h };
    const collides = rooms.some(
      (r) =>
        x < r.x + r.w + 1 &&
        x + w + 1 > r.x &&
        y < r.y + r.h + 1 &&
        y + h + 1 > r.y,
    );
    if (collides) continue;
    carveRoom(grid, room);
    if (rooms.length > 0) {
      const a = centre(rooms[rooms.length - 1]);
      const b = centre(room);
      if (Math.random() < 0.5) {
        carveH(grid, a.x, b.x, a.y);
        carveV(grid, a.y, b.y, b.x);
      } else {
        carveV(grid, a.y, b.y, a.x);
        carveH(grid, a.x, b.x, b.y);
      }
    }
    rooms.push(room);
  }

  const start = centre(rooms[0]);
  const end = centre(rooms[rooms.length - 1]);
  const taken = new Set<number>([start.y * MAP_W + start.x, end.y * MAP_W + end.x]);

  const randomFloorCell = (): { x: number; y: number } | null => {
    for (let i = 0; i < 60; i++) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const x = room.x + Math.floor(Math.random() * room.w);
      const y = room.y + Math.floor(Math.random() * room.h);
      if (grid[y * MAP_W + x] === 1 && !taken.has(y * MAP_W + x)) {
        taken.add(y * MAP_W + x);
        return { x, y };
      }
    }
    return null;
  };

  const monsters: Monster[] = [];
  let nextId = 1;
  for (let i = 1; i < rooms.length; i++) {
    const count = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < count; k++) {
      const spot = randomFloorCell();
      if (!spot) continue;
      monsters.push(
        spawnMonster(pickMonsterKind(floor), floor, nextId++, spot.x, spot.y),
      );
    }
  }

  const potions: { x: number; y: number }[] = [];
  const potionCount = 2 + Math.floor(Math.random() * 2) + Math.min(floor, 3);
  for (let k = 0; k < potionCount; k++) {
    const spot = randomFloorCell();
    if (spot) potions.push(spot);
  }

  return {
    floor,
    grid,
    player: { x: start.x, y: start.y, hp },
    monsters,
    potions,
    stairs: end,
    explored: reveal(Array<boolean>(CELLS).fill(false), start.x, start.y),
    log: [`You reach floor ${floor}.`, `Hunt, heal, find the stairs 🪜.`],
    dead: false,
  };
}

function createRun(): Run {
  return generateFloor(1, MAX_HP);
}

export default function DungeonDash({ gameId }: { gameId: string }) {
  const [run, setRun] = useState<Run>(() => createRun());
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const visible = useMemo(() => {
    const set = new Set<number>();
    const px = run.player.x;
    const py = run.player.y;
    for (let y = Math.max(0, py - SIGHT); y <= Math.min(MAP_H - 1, py + SIGHT); y++) {
      for (let x = Math.max(0, px - SIGHT); x <= Math.min(MAP_W - 1, px + SIGHT); x++) {
        const dx = x - px;
        const dy = y - py;
        if (dx * dx + dy * dy <= SIGHT * SIGHT) set.add(y * MAP_W + x);
      }
    }
    return set;
  }, [run.player.x, run.player.y]);

  const move = useCallback(
    (dx: number, dy: number) => {
      if (run.dead) return;
      const nx = run.player.x + dx;
      const ny = run.player.y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) return;
      if (run.grid[ny * MAP_W + nx] === 0) return; // walls never cost a turn

      let player = { ...run.player };
      let monsters = run.monsters;
      let potions = run.potions;
      const notes: string[] = [];
      let descended = false;

      const foe = monsters.find((m) => m.x === nx && m.y === ny);
      if (foe) {
        const dmg = 4 + Math.floor(Math.random() * 4);
        const name = MONSTER_DEFS[foe.kind].name;
        monsters = monsters
          .map((m) => (m.id === foe.id ? { ...m, hp: m.hp - dmg } : m))
          .filter((m) => {
            if (m.id === foe.id && m.hp <= 0) {
              notes.push(`You hit the ${name} for ${dmg} — slain!`);
              return false;
            }
            return true;
          });
        if (foe.hp - dmg > 0) notes.push(`You hit the ${name} for ${dmg}.`);
      } else {
        player = { ...player, x: nx, y: ny };
        const idx = potions.findIndex((p) => p.x === nx && p.y === ny);
        if (idx >= 0 && player.hp < MAX_HP) {
          potions = potions.filter((_, i) => i !== idx);
          player.hp = Math.min(MAX_HP, player.hp + 10);
          notes.push("You drink a potion. +10 HP 💧");
        }
        if (nx === run.stairs.x && ny === run.stairs.y) descended = true;
      }

      let dead = false;
      if (!descended) {
        for (const m of monsters) {
          const mdx = player.x - m.x;
          const mdy = player.y - m.y;
          const reach = Math.abs(mdx) + Math.abs(mdy);
          if (reach === 1) {
            const dmg = m.lo + Math.floor(Math.random() * (m.hi - m.lo + 1));
            player.hp -= dmg;
            notes.push(
              `${MONSTER_DEFS[m.kind].glyph} The ${MONSTER_DEFS[m.kind].name} hits you for ${dmg}.`,
            );
            if (player.hp <= 0) {
              player.hp = 0;
              dead = true;
              notes.push("You die. The dungeon keeps your bones.");
              break;
            }
            continue;
          }
          if (Math.hypot(mdx, mdy) > 7) continue;

          const steps: Array<[number, number]> =
            Math.abs(mdx) >= Math.abs(mdy)
              ? [[Math.sign(mdx), 0], [0, Math.sign(mdy)]]
              : [[0, Math.sign(mdy)], [Math.sign(mdx), 0]];
          for (const [ax, ay] of steps) {
            if (ax === 0 && ay === 0) continue;
            const tx = m.x + ax;
            const ty = m.y + ay;
            if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
            if (run.grid[ty * MAP_W + tx] === 0) continue;
            if (tx === player.x && ty === player.y) continue;
            if (monsters.some((o) => o.id !== m.id && o.x === tx && o.y === ty)) continue;
            monsters = monsters.map((o) => (o.id === m.id ? { ...o, x: tx, y: ty } : o));
            break;
          }
        }
      }

      const log = [...run.log, ...notes].slice(-6);

      if (dead) {
        setRun({
          ...run,
          player,
          monsters,
          potions,
          explored: reveal(run.explored, player.x, player.y),
          log,
          dead: true,
        });
        setNewBest(submit(run.floor));
        return;
      }
      if (descended) {
        setRun(generateFloor(run.floor + 1, player.hp));
        return;
      }
      setRun({
        ...run,
        player,
        monsters,
        potions,
        explored: reveal(run.explored, player.x, player.y),
        log,
      });
    },
    [run, submit],
  );

  useEffect(() => {
    const DIRS: Record<string, [number, number]> = {
      arrowup: [0, -1],
      w: [0, -1],
      arrowdown: [0, 1],
      s: [0, 1],
      arrowleft: [-1, 0],
      a: [-1, 0],
      arrowright: [1, 0],
      d: [1, 0],
    };
    const onKey = (e: KeyboardEvent) => {
      const dir = DIRS[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();
      move(dir[0], dir[1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    const t = e.changedTouches[0];
    touchStart.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx), 0);
    else move(0, Math.sign(dy));
  };

  const restart = () => {
    setRun(createRun());
    setNewBest(false);
  };

  const vx0 = Math.max(0, Math.min(run.player.x - 7, MAP_W - VIEW_W));
  const vy0 = Math.max(0, Math.min(run.player.y - 5, MAP_H - VIEW_H));

  const cells: React.ReactNode[] = [];
  for (let y = vy0; y < vy0 + VIEW_H; y++) {
    for (let x = vx0; x < vx0 + VIEW_W; x++) {
      const i = y * MAP_W + x;
      const seen = run.explored[i];
      const vis = visible.has(i);
      const wall = run.grid[i] === 0;
      const monster = vis
        ? run.monsters.find((m) => m.x === x && m.y === y)
        : undefined;
      const potion = vis
        ? run.potions.find((p) => p.x === x && p.y === y)
        : undefined;
      const isStairs = seen && run.stairs.x === x && run.stairs.y === y;
      const isPlayer = run.player.x === x && run.player.y === y;

      const label = !seen
        ? "Unexplored"
        : wall
          ? "Wall"
          : isPlayer
            ? "You"
            : monster
              ? `${MONSTER_DEFS[monster.kind].name} ${monster.hp} hp`
              : potion
                ? "Potion"
                : isStairs
                  ? "Stairs"
                  : "Floor";

      cells.push(
        <div
          key={i}
          role="gridcell"
          aria-label={label}
          className={cn(
            "relative grid aspect-square place-items-center text-[11px] leading-none",
            !seen
              ? "bg-[#050509]"
              : wall
                ? vis
                  ? "bg-[#1c1c30]"
                  : "bg-[#10101c]"
                : vis
                  ? "bg-[#0d0d18]"
                  : "bg-[#07070e]",
          )}
        >
          {isPlayer && (
            <>
              <span className="animate-pop">🧙</span>
              <span className="absolute bottom-0 left-1 right-1 h-[3px] rounded bg-black/70">
                <span
                  className="block h-full rounded bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-600"
                  style={{ width: `${(run.player.hp / MAX_HP) * 100}%` }}
                />
              </span>
            </>
          )}
          {!isPlayer && monster && (
            <>
              <span>{MONSTER_DEFS[monster.kind].glyph}</span>
              <span className="absolute bottom-0 left-1 right-1 h-[3px] rounded bg-black/70">
                <span
                  className="block h-full rounded bg-rose-400"
                  style={{ width: `${(monster.hp / monster.maxHp) * 100}%` }}
                />
              </span>
            </>
          )}
          {!isPlayer && !monster && potion && <span>💧</span>}
          {!isPlayer && !monster && !potion && isStairs && <span>🪜</span>}
        </div>,
      );
    }
  }

  return (
    <div className="w-full max-w-[460px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Floor <b className="text-sm text-ink">{run.floor}</b>
        </span>
        <span className="flex items-center gap-2">
          HP
          <span className="inline-block h-2 w-24 overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-600"
              style={{ width: `${(run.player.hp / MAX_HP) * 100}%` }}
            />
          </span>
          <b className="text-sm text-ink">{run.player.hp}</b>
        </span>
        <span className={best !== null && run.floor > best ? "text-warn" : ""}>
          Best <b className="text-sm text-ink">{best ?? "—"}</b>
        </span>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(139,92,246,0.8)]">
        <div
          role="grid"
          aria-label="Dungeon map"
          className="grid grid-cols-[repeat(15,1fr)] gap-px overflow-hidden rounded-lg"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {cells}
        </div>

        {run.dead && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              YOU DIED 💀
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ Deepest floor — new best!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {run.floor}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Floor reached · Best {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={restart}
              tone="from-violet-500 via-purple-500 to-fuchsia-500"
            >
              New run
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-line bg-surface p-2.5 font-mono text-[11px] leading-relaxed text-muted">
        {run.log.slice(-3).map((entry, i) => (
          <p key={i} className="truncate">
            {entry}
          </p>
        ))}
      </div>

      <div className="mx-auto mt-3 grid w-40 grid-cols-3 gap-1">
        <span />
        <button
          type="button"
          onClick={() => move(0, -1)}
          disabled={run.dead}
          aria-label="Move up"
          className="rounded-lg border border-line bg-surface py-2 text-ink transition hover:border-primary/60 disabled:opacity-40"
        >
          ▲
        </button>
        <span />
        <button
          type="button"
          onClick={() => move(-1, 0)}
          disabled={run.dead}
          aria-label="Move left"
          className="rounded-lg border border-line bg-surface py-2 text-ink transition hover:border-primary/60 disabled:opacity-40"
        >
          ◀
        </button>
        <span />
        <button
          type="button"
          onClick={() => move(1, 0)}
          disabled={run.dead}
          aria-label="Move right"
          className="rounded-lg border border-line bg-surface py-2 text-ink transition hover:border-primary/60 disabled:opacity-40"
        >
          ▶
        </button>
        <span />
        <button
          type="button"
          onClick={() => move(0, 1)}
          disabled={run.dead}
          aria-label="Move down"
          className="rounded-lg border border-line bg-surface py-2 text-ink transition hover:border-primary/60 disabled:opacity-40"
        >
          ▼
        </button>
        <span />
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Arrows / WASD or swipe · bump enemies to attack · reach the stairs 🪜
      </p>
    </div>
  );
}
