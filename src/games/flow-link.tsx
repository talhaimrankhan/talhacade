"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { Overlay, PrimaryButton } from "./parts";

/* ------------------------------------------------------------------ */
/* Handmade-style board library. Every pair is solvable: the endpoint   */
/* pairs were cut from real non-crossing pipe routes on the same grid.  */
/* ------------------------------------------------------------------ */

const EASY: string[][] = [
  [".c..d..", "..d....", ".......", "....a.a", "c......", ".......", ".b.b..."],
  ["......a", ".a....b", ".....b.", ".......", ".d.d...", "....c..", "c......"],
  [".b.....", "..a....", "......a", "...b...", ".....c.", "...d.d.", ".c....."],
  ["......c", ".c.....", "b..d...", ".......", "...b...", ".a..a.d", "......."],
  [".......", ".cd....", "......d", "...b...", "..c..a.", "b......", "..a...."],
  [".....a.", "...c...", ".......", ".c..d..", "......d", "ab.....", "....b.."],
  [".......", ".d..d..", ".c.....", "..b..c.", ".......", "..a..b.", "......a"],
  ["c...b..", ".......", ".d..b..", "......a", "...d...", ".......", ".c..a.."],
];

const HARD: string[][] = [
  ["a...b....c", "....d...e.", "......f...", "..........", ".......e..", "..........", ".b...f....", "..........", "a.........", "...d....c."],
  ["a..b......", ".......c.b", "..........", "..........", "...a...e..", "c.........", "...d......", ".........f", "....e.f...", "d........."],
  [".....b.a..", "..........", "c..b..a...", "..........", "..........", ".e......f.", "..........", "...e....f.", ".d........", ".c...d...."],
  [".......e..", ".b........", "...a......", "..........", ".c.b..a..e", ".......d..", ".d..c....f", "..........", "..........", ".....f...."],
  ["..........", "......f...", "......d...", ".d.....e..", "..b..a....", "c.......f.", "..........", "....a....e", "....b.....", "...c......"],
  ["...a.b....", "..........", "........e.", ".b.c..d...", ".a........", "..........", "..c.d.....", "f.e.......", "....f.....", ".........."],
  ["......c..b", "...c....d.", "....f.....", "..........", "......e...", "...f......", "e.........", ".d........", ".........b", ".....a..a."],
  ["....e...d.", "..........", "......f...", ".a........", "..b.......", "..........", ".a...f....", "...b....e.", "c.....c.d.", ".........."],
];

const COLORS = ["#22d3ee", "#fb7185", "#fbbf24", "#a78bfa", "#34d399", "#f472b6"];

type Size = "easy" | "hard";

interface Pt {
  r: number;
  c: number;
}

interface Pair {
  a: Pt;
  b: Pt;
}

function sameCell(x: Pt, y: Pt): boolean {
  return x.r === y.r && x.c === y.c;
}

/** Endpoint pairs in the order their letters first appear (a, b, c …). */
function parsePairs(grid: string[]): Pair[] {
  const found = new Map<string, Pt[]>();
  grid.forEach((row, r) => {
    row.split("").forEach((ch, c) => {
      if (ch === ".") return;
      const list = found.get(ch);
      if (list) list.push({ r, c });
      else found.set(ch, [{ r, c }]);
    });
  });
  return [...found.values()].map(([a, b]) => ({ a, b }));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function FlowLink({ gameId }: { gameId: string }) {
  const [size, setSize] = useState<Size>("easy");
  const [idxs, setIdxs] = useState<Record<Size, number>>({ easy: 0, hard: 0 });
  const [paths, setPathsState] = useState<Pt[][]>(() => parsePairs(EASY[0]).map(() => []));
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [solved, setSolved] = useState(false);
  const [perfect, setPerfect] = useState(false);
  const [newBest, setNewBest] = useState(false);

  const easyBest = useBestScore(`${gameId}-easy`, "low");
  const hardBest = useBestScore(`${gameId}-hard`, "low");
  const best = size === "easy" ? easyBest.best : hardBest.best;

  const board = (size === "easy" ? EASY : HARD)[idxs[size]];
  const rows = board.length;
  const cols = board[0].length;
  const pairs = useMemo(() => parsePairs(board), [board]);

  const pathsRef = useRef<Pt[][]>(paths);
  const dragRef = useRef<number | null>(null);
  const startedAt = useRef(0);

  const applyPaths = useCallback((next: Pt[][]) => {
    pathsRef.current = next;
    setPathsState(next);
  }, []);

  const occupancy = useMemo(() => {
    const map = new Map<string, { pair: number; idx: number }>();
    paths.forEach((p, i) =>
      p.forEach((cell, idx) => map.set(`${cell.r},${cell.c}`, { pair: i, idx })),
    );
    return map;
  }, [paths]);

  const endpointOwner = useCallback(
    (cell: Pt) => pairs.findIndex((p) => sameCell(cell, p.a) || sameCell(cell, p.b)),
    [pairs],
  );

  /* ------------------------------ flow ------------------------------ */

  const loadBoard = useCallback(
    (s: Size, idx: number) => {
      const list = s === "easy" ? EASY : HARD;
      setSize(s);
      setIdxs((prev) => ({ ...prev, [s]: idx }));
      applyPaths(parsePairs(list[idx]).map(() => []));
      setSeconds(0);
      setStarted(false);
      setSolved(false);
      setPerfect(false);
      setNewBest(false);
    },
    [applyPaths],
  );

  const nextBoard = useCallback(() => {
    const list = size === "easy" ? EASY : HARD;
    loadBoard(size, (idxs[size] + 1) % list.length);
  }, [size, idxs, loadBoard]);

  // counts up until the board is cleared
  useEffect(() => {
    if (!started || solved) return;
    const id = setInterval(() => {
      setSeconds(Math.round((Date.now() - startedAt.current) / 1000));
    }, 300);
    return () => clearInterval(id);
  }, [started, solved]);

  const finish = useCallback(() => {
    const secs = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const filled = pathsRef.current.reduce((n, p) => n + p.length, 0);
    setSeconds(secs);
    setPerfect(filled === rows * cols);
    setSolved(true);
    const hook = size === "easy" ? easyBest : hardBest;
    setNewBest(hook.submit(secs));
  }, [rows, cols, size, easyBest, hardBest]);

  /* ---------------------------- pointer ---------------------------- */

  const cellFromEvent = (e: React.PointerEvent<HTMLDivElement>): Pt | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * cols);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * rows);
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
    return { r, c };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (solved) return;
    const cell = cellFromEvent(e);
    if (!cell) return;

    const owner = endpointOwner(cell);
    const occ = occupancy.get(`${cell.r},${cell.c}`);
    let pair: number | null = null;
    let startPath: Pt[] = [];
    if (owner >= 0) {
      pair = owner;
      startPath = [cell];
    } else if (occ) {
      pair = occ.pair;
      startPath = pathsRef.current[pair].slice(0, occ.idx + 1);
    }
    if (pair === null) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = pair;
    applyPaths(pathsRef.current.map((p, i) => (i === pair ? startPath : p)));
    if (!started) {
      startedAt.current = Date.now();
      setStarted(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pair = dragRef.current;
    if (pair === null || solved) return;
    const cell = cellFromEvent(e);
    if (!cell) return;

    const path = pathsRef.current[pair];
    const end = path[path.length - 1];
    if (!end || sameCell(cell, end)) return;
    if (Math.abs(cell.r - end.r) + Math.abs(cell.c - end.c) !== 1) return;

    const occ = occupancy.get(`${cell.r},${cell.c}`);
    if (occ) {
      // drag back over our own pipe → retract; other pipes are simply blocked
      if (occ.pair === pair) {
        applyPaths(
          pathsRef.current.map((p, i) => (i === pair ? p.slice(0, occ.idx + 1) : p)),
        );
      }
      return;
    }

    const owner = endpointOwner(cell);
    if (owner >= 0) {
      if (owner === pair) {
        applyPaths(pathsRef.current.map((p, i) => (i === pair ? [...p, cell] : p)));
      } else {
        // wrong endpoint → the pipe snaps back to its dot
        applyPaths(pathsRef.current.map((p, i) => (i === pair ? [p[0]] : p)));
      }
      return;
    }

    applyPaths(pathsRef.current.map((p, i) => (i === pair ? [...p, cell] : p)));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current === null) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer may already be gone */
    }

    const done = pairs.every((pair, i) => {
      const p = pathsRef.current[i];
      if (p.length < 2) return false;
      const [s, t] = [p[0], p[p.length - 1]];
      return (sameCell(s, pair.a) && sameCell(t, pair.b)) ||
        (sameCell(s, pair.b) && sameCell(t, pair.a));
    });
    if (done) finish();
  };

  /* ------------------------------ view ------------------------------ */

  return (
    <div className="w-full max-w-[460px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Time <b className="ml-1 text-sm text-ink tabular-nums">{formatTime(seconds)}</b>
        </span>
        <div className="flex items-center gap-3">
          <span className="text-accent">
            Board <b className="ml-1 text-sm text-ink">{idxs[size] + 1}</b>
          </span>
          <span className="text-warn">
            Best <b className="ml-1 text-sm text-ink tabular-nums">{best ?? "—"}</b>
          </span>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(["easy", "hard"] as Size[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => loadBoard(s, idxs[s])}
              aria-pressed={size === s}
              className={
                size === s
                  ? "rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-black shadow-[0_0_18px_-6px_rgba(34,211,238,0.9)]"
                  : "rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
              }
            >
              {s === "easy" ? "Easy 7×7" : "Hard 10×10"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={nextBoard}
          aria-label="New puzzle"
          className="rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
        >
          ⟳ New puzzle
        </button>
      </div>

      <div
        className={`relative mx-auto touch-none select-none overflow-hidden rounded-2xl border border-line bg-surface-2 p-2 shadow-[0_0_60px_-24px_rgba(56,189,248,0.8)] ${
          size === "easy" ? "max-w-[340px]" : "max-w-[440px]"
        }`}
      >
        <div
          role="application"
          aria-label={`Pipe board ${idxs[size] + 1}, ${rows} by ${cols}`}
          className="relative aspect-square cursor-pointer"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* cells */}
          <div
            className="absolute inset-0 grid gap-[2px]"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {Array.from({ length: rows * cols }, (_, i) => (
              <div key={i} className="rounded-[3px] bg-[#131322]" />
            ))}
          </div>

          {/* pipes + dots */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${cols} ${rows}`}
            aria-hidden="true"
          >
            {pairs.map((pair, i) => {
              const path = paths[i];
              const color = COLORS[i % COLORS.length];
              return (
                <g key={i}>
                  {path.length > 1 && (
                    <polyline
                      points={path.map((p) => `${p.c + 0.5},${p.r + 0.5}`).join(" ")}
                      fill="none"
                      stroke={color}
                      strokeWidth={0.36}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.95}
                    />
                  )}
                  {[pair.a, pair.b].map((dot, k) => (
                    <g key={k}>
                      <circle cx={dot.c + 0.5} cy={dot.r + 0.5} r={0.3} fill={color} opacity={0.28} />
                      <circle cx={dot.c + 0.5} cy={dot.r + 0.5} r={0.18} fill={color} />
                    </g>
                  ))}
                </g>
              );
            })}
          </svg>

          {solved && (
            <Overlay>
              <p className="text-4xl">🔗</p>
              <p className="mt-2 font-display text-2xl font-bold text-gradient">EVERY LINE LINKED</p>
              {perfect && (
                <p className="animate-pop mt-2 rounded-full bg-success/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-success">
                  ✦ Perfect — board full!
                </p>
              )}
              <p className="mt-3 font-mono text-4xl font-bold text-white">{formatTime(seconds)}</p>
              {newBest && (
                <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                  ✦ New fastest clear!
                </p>
              )}
              <p className="text-xs uppercase tracking-widest text-muted">
                Best {best ?? "—"}s · {size === "easy" ? "Easy" : "Hard"} boards
              </p>
              <PrimaryButton onClick={nextBoard} tone="from-cyan-400 via-sky-500 to-blue-600">
                Next board
              </PrimaryButton>
            </Overlay>
          )}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Drag from dot to dot · fill the whole board for a perfect clear
      </p>
    </div>
  );
}
