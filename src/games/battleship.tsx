"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

/* ------------------------------------------------------------------ */
/* Fleet rules (pure)                                                  */
/* ------------------------------------------------------------------ */

const SIZE = 10;
const CELLS = SIZE * SIZE;

interface ShipSpec { name: string; size: number }

const FLEET: ShipSpec[] = [
  { name: "Carrier", size: 5 },
  { name: "Battleship", size: 4 },
  { name: "Cruiser", size: 3 },
  { name: "Submarine", size: 3 },
  { name: "Destroyer", size: 2 },
];

/** Hunt / target memory for the CPU gunners. */
interface Ai { queue: number[]; hits: number[] }
type Phase = "setup" | "battle" | "won" | "lost";
interface Series { you: number; draws: number; cpu: number }

const ROW = (i: number) => Math.floor(i / SIZE);
const COL = (i: number) => i % SIZE;
const label = (i: number) => `${String.fromCharCode(97 + COL(i))}${ROW(i) + 1}`;
const emptyAi = (): Ai => ({ queue: [], hits: [] });

function shipCells(anchor: number, size: number, horizontal: boolean): number[] | null {
  const cells: number[] = [];
  for (let k = 0; k < size; k++) {
    const r = ROW(anchor) + (horizontal ? 0 : k);
    const c = COL(anchor) + (horizontal ? k : 0);
    if (r >= SIZE || c >= SIZE) return null;
    cells.push(r * SIZE + c);
  }
  return cells;
}

function collides(cells: number[], fleet: number[][]): boolean {
  return cells.some((c) => fleet.some((ship) => ship.includes(c)));
}

/** Random but legal placement for all five ships (systematic fallback). */
function randomFleet(): number[][] {
  const fleet: number[][] = [];
  for (const spec of FLEET) {
    let placed: number[] | null = null;
    for (let t = 0; t < 400 && placed === null; t++) {
      const anchor = Math.floor(Math.random() * CELLS);
      const cells = shipCells(anchor, spec.size, Math.random() < 0.5);
      if (cells && !collides(cells, fleet)) placed = cells;
    }
    if (placed === null) {
      for (let i = 0; i < CELLS && placed === null; i++) {
        for (const horizontal of [true, false]) {
          const cells = shipCells(i, spec.size, horizontal);
          if (cells && !collides(cells, fleet)) {
            placed = cells;
            break;
          }
        }
      }
    }
    fleet.push(placed ?? [0]);
  }
  return fleet;
}

const isSunk = (ship: number[], shots: number[]) => ship.every((c) => shots.includes(c));
const allSunk = (fleet: number[][], shots: number[]) => fleet.every((s) => isSunk(s, shots));
const shipAt = (fleet: number[][], c: number) => fleet.findIndex((s) => s.includes(c));

/** Cells that would keep a line of hits going. */
function alongHits(hits: number[], taken: Set<number>): number[] {
  const rows = new Set(hits.map(ROW));
  const cols = new Set(hits.map(COL));
  const out: number[] = [];
  const scan = (fixed: number, alongRow: boolean) => {
    const marks = hits.map((h) => (alongRow ? COL(h) : ROW(h))).sort((a, b) => a - b);
    for (const step of [-1, 1]) {
      let v = marks[step > 0 ? marks.length - 1 : 0] + step;
      while (v >= 0 && v < SIZE) {
        const i = alongRow ? fixed * SIZE + v : v * SIZE + fixed;
        if (taken.has(i)) break;
        out.push(i);
        v += step;
      }
    }
  };
  if (rows.size === 1) scan(ROW(hits[0]), true);
  else if (cols.size === 1) scan(COL(hits[0]), false);
  return out;
}

/**
 * Parity-aware hunting, then targeted follow-ups: neighbours of every hit,
 * narrowed to a straight line as soon as two hits line up.
 */
function chooseCpuShot(shots: number[], ai: Ai): number {
  const taken = new Set(shots);
  ai.queue = ai.queue.filter((c) => !taken.has(c));
  if (ai.hits.length >= 2) {
    const line = alongHits(ai.hits, taken);
    if (line.length > 0) ai.queue = line;
  }
  if (ai.queue.length > 0) return ai.queue.pop()!;

  const open: number[] = [];
  const parity: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (taken.has(i)) continue;
    open.push(i);
    if ((ROW(i) + COL(i)) % 2 === 0) parity.push(i);
  }
  const pool = parity.length > 0 ? parity : open;
  if (pool.length === 0) return -1;
  return pool[Math.floor(Math.random() * pool.length)];
}

function neighbours(i: number): number[] {
  const out: number[] = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const r = ROW(i) + dr;
    const c = COL(i) + dc;
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) out.push(r * SIZE + c);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Battleship({ gameId }: { gameId: string }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [myShips, setMyShips] = useState<number[][]>([]);
  const [enemyShips, setEnemyShips] = useState<number[][]>([]);
  const [horizontal, setHorizontal] = useState(true);
  const [myShots, setMyShots] = useState<number[]>([]);
  const [cpuShots, setCpuShots] = useState<number[]>([]);
  const [note, setNote] = useState("Place your Carrier (5 cells)");
  const [thinking, setThinking] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [series, setSeries] = useStored<Series>(`series:${gameId}`, {
    you: 0,
    draws: 0,
    cpu: 0,
  });
  const { best, submit } = useBestScore(gameId, "high");
  const cpuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ai = useRef<Ai>(emptyAi());
  const seriesRef = useRef<Series>(series);
  useEffect(() => {
    seriesRef.current = series;
  }, [series]);

  useEffect(
    () => () => {
      if (cpuTimer.current) clearTimeout(cpuTimer.current);
    },
    [],
  );

  const finish = useCallback(
    (result: "won" | "lost") => {
      setPhase(result);
      const s = seriesRef.current;
      const key = result === "won" ? "you" : "cpu";
      const updated: Series = { ...s, [key]: s[key] + 1 };
      seriesRef.current = updated;
      setSeries(updated);
      if (result === "won") setNewBest(submit(updated.you));
    },
    [setSeries, submit],
  );

  const pending = myShips.length < FLEET.length ? myShips.length : -1;

  /** Setup: drop the next ship on the clicked square. */
  const placeShip = (anchor: number) => {
    if (pending < 0) return;
    const cells = shipCells(anchor, FLEET[pending].size, horizontal);
    if (!cells || collides(cells, myShips)) {
      setNote("That spot is blocked \u2014 try another");
      return;
    }
    setMyShips((prev) => [...prev, cells]);
    setNote(
      pending + 1 < FLEET.length
        ? `Place your ${FLEET[pending + 1].name} (${FLEET[pending + 1].size})`
        : "Fleet ready \u2014 start the battle",
    );
  };

  const startBattle = () => {
    setEnemyShips(randomFleet());
    setMyShots([]);
    setCpuShots([]);
    ai.current = emptyAi();
    setNote("Enemy waters are open \u2014 fire!");
    setPhase("battle");
  };

  const newGame = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setPhase("setup");
    setMyShips([]);
    setEnemyShips([]);
    setHorizontal(true);
    setMyShots([]);
    setCpuShots([]);
    ai.current = emptyAi();
    setThinking(false);
    setNewBest(false);
    setNote("Place your Carrier (5 cells)");
  }, []);

  /** Player fires at the enemy grid. */
  const fire = (target: number) => {
    if (phase !== "battle" || thinking || myShots.includes(target)) return;
    const next = [...myShots, target];
    setMyShots(next);
    const idx = shipAt(enemyShips, target);
    if (idx >= 0) {
      const sunk = isSunk(enemyShips[idx], next);
      setNote(
        sunk
          ? `You sank their ${FLEET[idx].name}!`
          : `Hit on ${label(target)} \u2014 keep going`,
      );
      if (allSunk(enemyShips, next)) {
        finish("won");
        return;
      }
    } else {
      setNote(`Miss at ${label(target)}`);
    }

    setThinking(true);
    cpuTimer.current = setTimeout(() => {
      const shot = chooseCpuShot(cpuShots, ai.current);
      if (shot < 0) {
        setThinking(false);
        return;
      }
      const reply = [...cpuShots, shot];
      setCpuShots(reply);
      const hitIdx = shipAt(myShips, shot);
      if (hitIdx >= 0) {
        ai.current.hits.push(shot);
        if (isSunk(myShips[hitIdx], reply)) {
          const sunkShip = myShips[hitIdx];
          ai.current.hits = ai.current.hits.filter((c) => !sunkShip.includes(c));
          ai.current.queue = [];
          setNote(`CPU sank your ${FLEET[hitIdx].name}!`);
        } else {
          ai.current.queue.push(...neighbours(shot));
          setNote(`CPU hits ${label(shot)}`);
        }
        if (allSunk(myShips, reply)) {
          setThinking(false);
          finish("lost");
          return;
        }
      } else {
        setNote(`CPU misses at ${label(shot)}`);
      }
      setThinking(false);
    }, 480);
  };

  const statusText =
    phase === "setup"
      ? pending >= 0
        ? `Place your ${FLEET[pending].name} (${FLEET[pending].size} cells)`
        : "Fleet deployed"
      : thinking
        ? "CPU is thinking\u2026"
        : note;

  const sunkEnemy = enemyShips.map((s) => isSunk(s, myShots));
  const sunkMine = myShips.map((s) => (s ? isSunk(s, cpuShots) : false));

  const grid = (owner: "enemy" | "mine") => {
    const ships = owner === "enemy" ? enemyShips : myShips;
    const shots = owner === "enemy" ? myShots : cpuShots;
    return (
      <div className="flex-1">
        <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
          <span className={owner === "enemy" ? "text-rose-300" : "text-cyan-300"}>
            {owner === "enemy" ? "Enemy waters" : "Your fleet"}
          </span>
          <span className="text-muted">
            {owner === "enemy"
              ? `${sunkEnemy.filter(Boolean).length}/5 sunk`
              : `${sunkMine.filter(Boolean).length}/5 sunk`}
          </span>
        </div>
        <div className="grid grid-cols-10 gap-px overflow-hidden rounded-lg border border-line bg-line">
          {Array.from({ length: CELLS }, (_, i) => {
            const shot = shots.includes(i);
            const shipIdx = shipAt(ships, i);
            const isShip = shipIdx >= 0;
            const sunk = isShip && ships[shipIdx].every((c) => shots.includes(c));
            const clickable = owner === "enemy" && phase === "battle" && !shot && !thinking;
            const preview =
              owner === "mine" && phase === "setup" && pending >= 0
                ? shipCells(i, FLEET[pending].size, horizontal)
                : null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => (owner === "enemy" ? fire(i) : phase === "setup" && placeShip(i))}
                aria-label={`${owner === "enemy" ? "Enemy" : "Your"} waters ${label(i)}${isShip ? " (ship)" : ""}${shot ? ", shot" : ""}`}
                disabled={owner === "mine" && phase !== "setup"}
                className={cn(
                  "relative grid aspect-square select-none place-items-center border border-transparent text-xs font-bold transition disabled:cursor-default",
                  shot
                    ? sunk
                      ? "bg-rose-600/60"
                      : isShip
                        ? "bg-rose-500/40"
                        : "bg-[#0f0f1e]"
                    : isShip
                      ? owner === "mine"
                        ? "bg-cyan-500/25 hover:border-primary/50"
                        : "bg-[#131322]"
                      : "bg-[#131322]",
                  clickable && "hover:border-primary/50 hover:bg-[#1c1c38]",
                  preview && preview.includes(i) && "bg-cyan-500/30",
                )}
              >
                {shot &&
                  (isShip ? (
                    <span className="text-white drop-shadow">{sunk ? "\u2620" : "\u2715"}</span>
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-muted" />
                  ))}
                {!shot && isShip && owner === "mine" && (
                  <span className="h-2 w-2 rounded-full bg-cyan-300/80" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[620px]">
      <div className="mb-3 grid grid-cols-3 gap-2 font-mono text-xs uppercase tracking-wider">
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-center text-cyan-300">
          You <b className="ml-1 text-sm text-ink">{series.you}</b>
        </div>
        <div className="rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-muted">
          Draw <b className="ml-1 text-sm text-ink">{series.draws}</b>
        </div>
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-center text-rose-300">
          CPU <b className="ml-1 text-sm text-ink">{series.cpu}</b>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs uppercase tracking-wider">
        <span className={thinking ? "text-rose-300" : "text-muted"}>
          <b className="text-ink">{thinking ? "Thinking\u2026 " : ""}{statusText}</b>
        </span>
        <div className="flex gap-1.5">
          {phase === "setup" && (
            <>
              <button
                type="button"
                onClick={() => setHorizontal((h) => !h)}
                aria-pressed={horizontal}
                className="rounded-full border border-line px-3 py-1 text-[11px] font-semibold text-muted transition hover:text-ink"
              >
                Rotate &middot; {horizontal ? "horizontal" : "vertical"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMyShips(randomFleet());
                  setNote("Fleet auto-placed \u2014 start the battle");
                }}
                className="rounded-full border border-line px-3 py-1 text-[11px] font-semibold text-muted transition hover:text-ink"
              >
                Randomize
              </button>
            </>
          )}
          {phase === "battle" && (
            <button
              type="button"
              onClick={newGame}
              className="rounded-full border border-line px-3 py-1 text-[11px] font-semibold text-muted transition hover:text-ink"
            >
              New game
            </button>
          )}
        </div>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(34,211,238,0.7)]">
        <div className="flex flex-col gap-4 sm:flex-row">
          {grid("enemy")}
          {grid("mine")}
        </div>

        {phase === "setup" && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {FLEET.map((spec, i) => (
                <span
                  key={spec.name}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
                    i === pending
                      ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-300"
                      : myShips[i]
                        ? "border-line bg-surface text-muted"
                        : "border-line text-muted/60",
                  )}
                >
                  {spec.name} {myShips[i] ? "\u2713" : spec.size}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={startBattle}
              disabled={pending >= 0}
              className="rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-600 px-5 py-2 text-xs font-bold text-black transition hover:brightness-110 active:scale-95 disabled:opacity-40"
            >
              Start battle
            </button>
          </div>
        )}

        {(phase === "won" || phase === "lost") && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {phase === "won" ? "Enemy fleet wiped out \uD83C\uDF89" : "Your fleet is at the bottom \uD83E\uDD16"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                &#10022; Most games won &mdash; new best!
              </p>
            )}
            <p className="mt-2 text-xs uppercase tracking-widest text-muted">
              All-time wins {best ?? 0} &middot; Series {series.you}&ndash;
              {series.draws}&ndash;{series.cpu}
            </p>
            <PrimaryButton
              onClick={newGame}
              tone={
                phase === "won"
                  ? "from-cyan-400 via-sky-500 to-blue-600"
                  : "from-amber-400 via-orange-500 to-red-500"
              }
            >
              New game
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        {phase === "setup"
          ? "Click your grid to drop each ship &middot; Rotate flips the orientation"
          : "Click enemy water to fire &middot; ☠ marks a sunk hull"}
      </p>
    </div>
  );
}
