"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

const SIZE = 7;
const WALLS_EACH = 8;
const GOAL_YOU = 0;
const GOAL_CPU = SIZE - 1;

type Outcome = "playing" | "won" | "lost";

interface Pos {
  r: number;
  c: number;
}

interface Wall {
  dir: "h" | "v";
  r: number;
  c: number;
}

interface Series {
  you: number;
  cpu: number;
}

/** A wall "h" at (r,c) blocks edges under (r,c) and (r,c+1);
 *  a wall "v" at (r,c) blocks edges right of (r,c) and (r+1,c). */
function blockedAt(walls: Wall[], r1: number, c1: number, r2: number, c2: number): boolean {
  if (r1 === r2) {
    const c = Math.min(c1, c2);
    return walls.some((w) => w.dir === "v" && w.r === r1 && w.c === c);
  }
  const r = Math.min(r1, r2);
  return walls.some((w) => w.dir === "h" && w.r === r && w.c === c1);
}

function stepsFrom(r: number, c: number, walls: Wall[]): Pos[] {
  const out: Pos[] = [];
  if (r > 0 && !blockedAt(walls, r, c, r - 1, c)) out.push({ r: r - 1, c });
  if (r < SIZE - 1 && !blockedAt(walls, r, c, r + 1, c)) out.push({ r: r + 1, c });
  if (c > 0 && !blockedAt(walls, r, c, r, c - 1)) out.push({ r, c: c - 1 });
  if (c < SIZE - 1 && !blockedAt(walls, r, c, r, c + 1)) out.push({ r, c: c + 1 });
  return out;
}

/** Breadth-first shortest route to a goal row; null when fully blocked. */
function bfsPath(walls: Wall[], from: Pos, goalRow: number): Pos[] | null {
  const startId = from.r * SIZE + from.c;
  const visited = new Set<number>([startId]);
  const parent = new Map<number, number>();
  const queue: Pos[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.r === goalRow) {
      const path: Pos[] = [cur];
      let id = cur.r * SIZE + cur.c;
      while (parent.has(id)) {
        id = parent.get(id)!;
        path.unshift({ r: Math.floor(id / SIZE), c: id % SIZE });
      }
      return path;
    }
    for (const nxt of stepsFrom(cur.r, cur.c, walls)) {
      const id = nxt.r * SIZE + nxt.c;
      if (visited.has(id)) continue;
      visited.add(id);
      parent.set(id, cur.r * SIZE + cur.c);
      queue.push(nxt);
    }
  }
  return null;
}

function pathLen(walls: Wall[], from: Pos, goalRow: number): number {
  const path = bfsPath(walls, from, goalRow);
  return path ? path.length - 1 : 99;
}

function wallEdges(w: Wall): [Pos, Pos][] {
  if (w.dir === "h") {
    return [
      [{ r: w.r, c: w.c }, { r: w.r, c: w.c + 1 }],
      [{ r: w.r + 1, c: w.c }, { r: w.r + 1, c: w.c + 1 }],
    ];
  }
  return [
    [{ r: w.r, c: w.c }, { r: w.r + 1, c: w.c }],
    [{ r: w.r, c: w.c + 1 }, { r: w.r + 1, c: w.c + 1 }],
  ];
}

/** Legal iff in bounds, on fresh edges, and nobody gets walled off. */
function canPlace(
  walls: Wall[],
  w: Wall,
  you: Pos,
  cpu: Pos,
): boolean {
  if (w.r < 0 || w.c < 0 || w.r > SIZE - 2 || w.c > SIZE - 2) return false;
  for (const [a, b] of wallEdges(w)) {
    if (blockedAt(walls, a.r, a.c, b.r, b.c)) return false;
  }
  const next = [...walls, w];
  if (!bfsPath(next, you, GOAL_YOU)) return false;
  if (!bfsPath(next, cpu, GOAL_CPU)) return false;
  return true;
}

function adjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

function cpuDecide(
  walls: Wall[],
  you: Pos,
  cpu: Pos,
  cpuWalls: number,
): { move: Pos | null; wall: Wall | null } {
  const myPath = bfsPath(walls, cpu, GOAL_CPU);
  const yourPath = bfsPath(walls, you, GOAL_YOU);
  const myLen = myPath ? myPath.length : 99;
  const yourLen = yourPath ? yourPath.length : 99;

  const step = myPath && myPath.length > 1 ? myPath[1] : null;

  if (!yourPath || myLen <= yourLen || cpuWalls === 0 || !step) {
    return { move: step, wall: null };
  }

  // Try to split your shortest route with a wall.
  let bestWall: Wall | null = null;
  let bestGain = 0;
  for (let i = 0; i + 1 < yourPath.length; i++) {
    const a = yourPath[i];
    const b = yourPath[i + 1];
    const w: Wall =
      a.r === b.r
        ? { dir: "v", r: a.r, c: Math.min(a.c, b.c) }
        : { dir: "h", r: Math.min(a.r, b.r), c: a.c };
    if (!canPlace(walls, w, you, cpu)) continue;
    const gain = pathLen([...walls, w], you, GOAL_YOU) - yourLen;
    if (gain > bestGain) {
      bestGain = gain;
      bestWall = w;
    }
  }
  if (bestWall) return { move: null, wall: bestWall };
  return { move: step, wall: null };
}

export default function Quoridor({ gameId }: { gameId: string }) {
  const [you, setYou] = useState<Pos>({ r: SIZE - 1, c: 3 });
  const [cpu, setCpu] = useState<Pos>({ r: 0, c: 3 });
  const [walls, setWalls] = useState<Wall[]>([]);
  const [youWalls, setYouWalls] = useState(WALLS_EACH);
  const [cpuWalls, setCpuWalls] = useState(WALLS_EACH);
  const [outcome, setOutcome] = useState<Outcome>("playing");
  const [wallMode, setWallMode] = useState(false);
  const [wallFrom, setWallFrom] = useState<Pos | null>(null);
  const [notice, setNotice] = useState("");
  const [thinking, setThinking] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [series, setSeries] = useStored<Series>(`series:${gameId}`, {
    you: 0,
    cpu: 0,
  });
  const { best, submit } = useBestScore(gameId, "high");
  const cpuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    (winner: "you" | "cpu") => {
      setOutcome(winner === "you" ? "won" : "lost");
      if (winner === "you") {
        const updated = {
          ...seriesRef.current,
          you: seriesRef.current.you + 1,
        };
        seriesRef.current = updated;
        setSeries(updated);
        setNewBest(submit(updated.you));
      } else {
        const updated = {
          ...seriesRef.current,
          cpu: seriesRef.current.cpu + 1,
        };
        seriesRef.current = updated;
        setSeries(updated);
      }
    },
    [setSeries, submit],
  );

  const afterPlayer = (nextWalls: Wall[], nextYou: Pos, nextCpu: Pos) => {
    if (nextYou.r === GOAL_YOU) {
      finish("you");
      return;
    }
    setThinking(true);
    cpuTimer.current = setTimeout(() => {
      const decision = cpuDecide(nextWalls, nextYou, nextCpu, cpuWalls);
      if (decision.wall) {
        setWalls([...nextWalls, decision.wall]);
        setCpuWalls((n) => n - 1);
      } else if (decision.move) {
        setCpu(decision.move);
        if (decision.move.r === GOAL_CPU) {
          setThinking(false);
          finish("cpu");
          return;
        }
      }
      setThinking(false);
    }, 520);
  };

  const newGame = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setYou({ r: SIZE - 1, c: 3 });
    setCpu({ r: 0, c: 3 });
    setWalls([]);
    setYouWalls(WALLS_EACH);
    setCpuWalls(WALLS_EACH);
    setOutcome("playing");
    setWallMode(false);
    setWallFrom(null);
    setNotice("");
    setThinking(false);
    setNewBest(false);
  }, []);

  const onCell = (pos: Pos) => {
    if (outcome !== "playing" || thinking) return;

    if (wallMode) {
      if (youWalls === 0) {
        setNotice("No walls left — walk instead.");
        return;
      }
      if (!wallFrom) {
        setWallFrom(pos);
        setNotice("Now tap the neighbouring cell to set the wall.");
        return;
      }
      if (!adjacent(wallFrom, pos)) {
        setWallFrom(pos);
        setNotice("Not adjacent — tap a neighbouring cell.");
        return;
      }
      const w: Wall =
        wallFrom.r === pos.r
          ? { dir: "v", r: pos.r, c: Math.min(pos.c, wallFrom.c) }
          : { dir: "h", r: Math.min(pos.r, wallFrom.r), c: pos.c };
      if (!canPlace(walls, w, you, cpu)) {
        setWallFrom(null);
        setNotice("Illegal wall — it would seal off a path.");
        return;
      }
      const nextWalls = [...walls, w];
      setWalls(nextWalls);
      setYouWalls((n) => n - 1);
      setWallFrom(null);
      setNotice("");
      afterPlayer(nextWalls, you, cpu);
      return;
    }

    // Walking: must be an orthogonally adjacent free cell.
    if (!adjacent(you, pos)) return;
    if (blockedAt(walls, you.r, you.c, pos.r, pos.c)) return;
    if (cpu.r === pos.r && cpu.c === pos.c) return;
    setYou(pos);
    setNotice("");
    afterPlayer(walls, pos, cpu);
  };

  const youDist = pathLen(walls, you, GOAL_YOU);
  const cpuDist = pathLen(walls, cpu, GOAL_CPU);

  const hasH = (r: number, c: number, side: "top" | "bottom") => {
    const rr = side === "top" ? r - 1 : r;
    return walls.some((w) => w.dir === "h" && w.r === rr && (w.c === c || w.c === c - 1));
  };
  const hasV = (r: number, c: number, side: "left" | "right") => {
    const cc = side === "left" ? c - 1 : c;
    return walls.some((w) => w.dir === "v" && w.c === cc && (w.r === r || w.r === r - 1));
  };

  const statusText =
    outcome === "won"
      ? "You reached the far side! 🎉"
      : outcome === "lost"
        ? "The CPU broke through 🤖"
        : thinking
          ? "CPU is thinking…"
          : wallFrom
            ? "Tap the neighbouring cell to place the wall"
            : wallMode
              ? "Wall mode — tap two adjacent cells"
              : "Move a cell, or place a wall";

  return (
    <div className="w-full max-w-[460px]">
      <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-xs uppercase tracking-wider">
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-center text-cyan-300">
          You{" "}
          <b className="ml-1 text-sm text-ink">
            {series.you}
          </b>{" "}
          <span className="text-[10px] text-muted">
            🧱{youWalls} · path {youDist}
          </span>
        </div>
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-center text-rose-300">
          CPU{" "}
          <b className="ml-1 text-sm text-ink">
            {series.cpu}
          </b>{" "}
          <span className="text-[10px] text-muted">
            🧱{cpuWalls} · path {cpuDist}
          </span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setWallMode((m) => !m);
            setWallFrom(null);
            setNotice("");
          }}
          aria-pressed={wallMode}
          disabled={outcome !== "playing" || thinking}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-semibold transition",
            wallMode
              ? "bg-amber-400 text-black shadow-[0_0_18px_-6px_rgba(251,191,36,0.9)]"
              : "border border-line text-muted hover:text-ink",
            (outcome !== "playing" || thinking) && "opacity-50",
          )}
        >
          🧱 Wall mode {wallMode ? "ON" : "off"}
        </button>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
          You climb ↑ · CPU chases ↓
        </span>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(52,211,153,0.7)]">
        <div
          className="grid gap-[10px]"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: SIZE * SIZE }, (_, i) => {
            const r = Math.floor(i / SIZE);
            const c = i % SIZE;
            const isYou = you.r === r && you.c === c;
            const isCpu = cpu.r === r && cpu.c === c;
            const pending = wallFrom?.r === r && wallFrom?.c === c;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onCell({ r, c })}
                aria-label={`Cell row ${r + 1} column ${c + 1}${
                  isYou ? ", you" : isCpu ? ", CPU" : ""
                }`}
                disabled={outcome !== "playing" || thinking}
                className={cn(
                  "relative grid aspect-square select-none place-items-center rounded-lg border text-lg transition",
                  r === GOAL_YOU && "border-cyan-500/30 bg-cyan-500/10",
                  r === GOAL_CPU && "border-rose-500/30 bg-rose-500/10",
                  !isYou && !isCpu && "border-line bg-[#12121f] hover:border-primary/50",
                  pending && "border-amber-300 bg-amber-400/20",
                )}
              >
                {isYou && <span className="animate-pop">🧍</span>}
                {isCpu && <span className="animate-pop">🤖</span>}
                {hasH(r, c, "top") && (
                  <span className="pointer-events-none absolute inset-x-[-6px] top-[-6px] h-2 rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 shadow-[0_0_10px_-3px_rgba(251,191,36,0.9)]" />
                )}
                {hasH(r, c, "bottom") && (
                  <span className="pointer-events-none absolute inset-x-[-6px] bottom-[-6px] h-2 rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 shadow-[0_0_10px_-3px_rgba(251,191,36,0.9)]" />
                )}
                {hasV(r, c, "left") && (
                  <span className="pointer-events-none absolute inset-y-[-6px] left-[-6px] w-2 rounded-full bg-gradient-to-b from-yellow-400 via-amber-500 to-orange-600 shadow-[0_0_10px_-3px_rgba(251,191,36,0.9)]" />
                )}
                {hasV(r, c, "right") && (
                  <span className="pointer-events-none absolute inset-y-[-6px] right-[-6px] w-2 rounded-full bg-gradient-to-b from-yellow-400 via-amber-500 to-orange-600 shadow-[0_0_10px_-3px_rgba(251,191,36,0.9)]" />
                )}
              </button>
            );
          })}
        </div>

        {outcome !== "playing" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {statusText}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ Most games won — new best!
              </p>
            )}
            <p className="mt-2 text-xs uppercase tracking-widest text-muted">
              All-time wins {best ?? 0} · Series {series.you}–{series.cpu}
            </p>
            <PrimaryButton
              onClick={newGame}
              tone="from-lime-400 via-emerald-500 to-teal-600"
            >
              New game
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        {notice || statusText}
      </p>
    </div>
  );
}
