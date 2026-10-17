"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

const SIZE = 12;
const WORDS_PER_GAME = 10;
const HINTS_PER_GAME = 3;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const THEMES: { name: string; words: string[] }[] = [
  {
    name: "Animals",
    words: [
      "TIGER", "PANDA", "ZEBRA", "EAGLE", "SHARK", "WHALE", "HORSE",
      "MOUSE", "SNAKE", "WOLF", "BEAR", "DEER", "OTTER", "GECKO",
    ],
  },
  {
    name: "Food",
    words: [
      "PIZZA", "SUSHI", "TACO", "BREAD", "APPLE", "MANGO", "BERRY",
      "SALAD", "PASTA", "COOKIE", "STEAK", "GRAPE", "OLIVE", "DONUT",
    ],
  },
  {
    name: "Space",
    words: [
      "PLANET", "ROCKET", "COMET", "GALAXY", "ORBIT", "NEBULA", "ALIEN",
      "QUASAR", "STARS", "LUNAR", "COSMOS", "METEOR", "SOLAR", "VENUS",
    ],
  },
  {
    name: "Cities",
    words: [
      "TOKYO", "PARIS", "LONDON", "CAIRO", "DUBAI", "BERLIN", "MADRID",
      "ROME", "SEOUL", "LIMA", "OSLO", "HANOI", "ATHENS", "KYIV",
    ],
  },
];

/** Eight directions, including every one of them reversed. */
const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [-1, 1],
];

interface Placement {
  word: string;
  cells: number[];
}

interface Puzzle {
  grid: string[];
  placements: Placement[];
}

const rowOf = (i: number) => Math.floor(i / SIZE);
const colOf = (i: number) => i % SIZE;

function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function placeWord(grid: string[], word: string): number[] | null {
  for (let t = 0; t < 300; t++) {
    const r = Math.floor(Math.random() * SIZE);
    const c = Math.floor(Math.random() * SIZE);
    const [dr, dc] = DIRS[Math.floor(Math.random() * DIRS.length)];
    const er = r + dr * (word.length - 1);
    const ec = c + dc * (word.length - 1);
    if (er < 0 || er >= SIZE || ec < 0 || ec >= SIZE) continue;

    const cells: number[] = [];
    let ok = true;
    for (let k = 0; k < word.length; k++) {
      const i = (r + dr * k) * SIZE + (c + dc * k);
      if (grid[i] !== "" && grid[i] !== word[k]) {
        ok = false;
        break;
      }
      cells.push(i);
    }
    if (!ok) continue;

    cells.forEach((i, k) => {
      grid[i] = word[k];
    });
    return cells;
  }
  return null;
}

function makePuzzle(theme: number): Puzzle {
  const grid = Array<string>(SIZE * SIZE).fill("");
  const placements: Placement[] = [];

  for (const word of shuffle(THEMES[theme].words)) {
    if (placements.length >= WORDS_PER_GAME) break;
    const cells = placeWord(grid, word);
    if (cells) placements.push({ word, cells });
  }

  // Decoy letters, half of them pulled from the theme's own alphabet.
  const pool = placements.flatMap((p) => p.word.split(""));
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === "") {
      grid[i] =
        pool.length > 0 && Math.random() < 0.5
          ? pool[Math.floor(Math.random() * pool.length)]
          : LETTERS[Math.floor(Math.random() * 26)];
    }
  }
  return { grid, placements };
}

/** Cells on the straight span from start to end, or null if it's crooked. */
function lineCells(start: number, end: number): number[] | null {
  const sr = rowOf(start);
  const sc = colOf(start);
  const dr = Math.sign(rowOf(end) - sr);
  const dc = Math.sign(colOf(end) - sc);
  const straight =
    sr === rowOf(end) || sc === colOf(end) ||
    Math.abs(rowOf(end) - sr) === Math.abs(colOf(end) - sc);
  if (!straight) return null;

  const len = Math.max(Math.abs(rowOf(end) - sr), Math.abs(colOf(end) - sc)) + 1;
  const cells: number[] = [];
  for (let k = 0; k < len; k++) {
    cells.push((sr + dr * k) * SIZE + (sc + dc * k));
  }
  return cells;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WordHunt({ gameId }: { gameId: string }) {
  const [theme, setTheme] = useState(
    () => Math.floor(Math.random() * THEMES.length),
  );
  const [puzzle, setPuzzle] = useState<Puzzle>(() => makePuzzle(theme));
  const [found, setFound] = useState<string[]>([]);
  const [hintCells, setHintCells] = useState<number[]>([]);
  const [hintsLeft, setHintsLeft] = useState(HINTS_PER_GAME);
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<"playing" | "won">("playing");
  const [newBest, setNewBest] = useState(false);
  const [jitter, setJitter] = useState(0);
  const { best, submit } = useBestScore(gameId, "low");

  const gridRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const selRef = useRef<{ start: number; end: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // The clock only runs once the hunt is under way.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const shake = useCallback(() => {
    clearTimers();
    [-8, 8, -5, 5, 0].forEach((dx, i) => {
      timers.current.push(setTimeout(() => setJitter(dx), i * 55));
    });
  }, [clearTimers]);

  const newPuzzle = useCallback(() => {
    clearTimers();
    const nextTheme = Math.floor(Math.random() * THEMES.length);
    setTheme(nextTheme);
    setPuzzle(makePuzzle(nextTheme));
    setFound([]);
    setHintCells([]);
    setHintsLeft(HINTS_PER_GAME);
    setSel(null);
    selRef.current = null;
    setSeconds(0);
    setRunning(false);
    setStatus("playing");
    setNewBest(false);
    setJitter(0);
  }, [clearTimers]);

  const cellFromPoint = (x: number, y: number): number | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const size = rect.width / SIZE;
    const r = Math.floor((y - rect.top) / size);
    const c = Math.floor((x - rect.left) / size);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
    return r * SIZE + c;
  };

  const commit = (selection: { start: number; end: number }) => {
    const cells = lineCells(selection.start, selection.end);
    if (!cells) {
      shake();
      return;
    }
    const word = cells.map((i) => puzzle.grid[i]).join("");
    const reversed = [...word].reverse().join("");
    const hit = puzzle.placements.find(
      (p) => p.word === word || p.word === reversed,
    );
    if (!hit || found.includes(hit.word)) {
      shake();
      return;
    }

    const next = [...found, hit.word];
    setFound(next);
    if (next.length >= puzzle.placements.length) {
      setStatus("won");
      setRunning(false);
      setNewBest(submit(seconds));
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (status !== "playing") return;
    const i = cellFromPoint(e.clientX, e.clientY);
    if (i === null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    selRef.current = { start: i, end: i };
    setSel({ start: i, end: i });
    if (!running) setRunning(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !selRef.current) return;
    const i = cellFromPoint(e.clientX, e.clientY);
    if (i === null) return;
    const next = { start: selRef.current.start, end: i };
    selRef.current = next;
    setSel(next);
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const selection = selRef.current;
    selRef.current = null;
    setSel(null);
    if (selection) commit(selection);
  };

  const takeHint = () => {
    if (status !== "playing" || hintsLeft <= 0) return;
    const left = puzzle.placements.filter((p) => !found.includes(p.word));
    if (left.length === 0) return;
    const pick = left[Math.floor(Math.random() * left.length)];
    setHintCells((h) => [...h, pick.cells[0]]);
    setHintsLeft((n) => n - 1);
  };

  const trail = sel ? lineCells(sel.start, sel.end) : null;
  const trailSet = new Set(trail ?? []);
  const hintSet = new Set(hintCells);
  const foundCells = new Set(
    puzzle.placements
      .filter((p) => found.includes(p.word))
      .flatMap((p) => p.cells),
  );
  const first = trail ? trail[0] : -1;
  const last = trail ? trail[trail.length - 1] : -1;

  return (
    <div className="w-full max-w-[600px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Time{" "}
          <b className="ml-1 text-sm text-ink tabular-nums">
            {formatTime(seconds)}
          </b>
        </span>
        <span className="flex items-center gap-3">
          <span className="text-accent">
            Found{" "}
            <b className="ml-1 text-sm text-ink tabular-nums">
              {found.length}/{puzzle.placements.length}
            </b>
          </span>
          <span className="text-warn">
            Best{" "}
            <b className="ml-1 text-sm text-ink tabular-nums">
              {best === null ? "—" : `${best}s`}
            </b>
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1 rounded-2xl border border-line bg-surface-2 p-2.5 shadow-[0_0_60px_-24px_rgba(168,85,247,0.6)]">
          <div
            ref={gridRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            role="application"
            aria-label={`Word search grid, theme ${THEMES[theme].name}. Drag from a word's first letter to its last.`}
            className="grid aspect-square w-full grid-cols-12 grid-rows-12 touch-none border-t border-l border-line/60 transition-transform duration-75 select-none"
            style={{ transform: `translateX(${jitter}px)` }}
          >
            {puzzle.grid.map((letter, i) => {
              const onTrail = trailSet.has(i);
              const isEnd = i === first || i === last;
              return (
                <div
                  key={i}
                  aria-hidden
                  className={cn(
                    "grid place-items-center border-r border-b border-line/60 font-display text-[10px] uppercase transition-colors duration-75 sm:text-xs",
                    foundCells.has(i) && "bg-primary/20 text-ink/70",
                    onTrail && !isEnd && "bg-cyan-500/30 text-ink",
                    isEnd && "bg-cyan-500/60 text-black",
                    hintSet.has(i) && "bg-warn/15 font-bold text-warn",
                  )}
                >
                  {letter}
                </div>
              );
            })}
          </div>

          {status === "won" && (
            <Overlay>
              <p className="text-4xl">🔍</p>
              <p className="mt-2 font-display text-2xl font-bold text-gradient">
                ALL WORDS FOUND
              </p>
              {newBest && (
                <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                  ✦ New fastest clear!
                </p>
              )}
              <p className="mt-3 font-mono text-3xl font-bold text-white tabular-nums">
                {formatTime(seconds)}
              </p>
              <p className="text-xs uppercase tracking-widest text-muted">
                Best {best === null ? "—" : `${best}s`} · {THEMES[theme].name}
              </p>
              <PrimaryButton
                onClick={newPuzzle}
                tone="from-violet-500 via-purple-500 to-fuchsia-500"
              >
                New puzzle
              </PrimaryButton>
            </Overlay>
          )}
        </div>

        <div className="sm:w-44">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
            {THEMES[theme].name} · find them all
          </p>
          <div className="flex flex-wrap gap-1.5 sm:flex-col">
            {puzzle.placements.map((p) => (
              <span
                key={p.word}
                className={cn(
                  "rounded-md border border-line bg-[#131322] px-2 py-1 text-xs font-display tracking-wider transition",
                  found.includes(p.word)
                    ? "text-muted line-through"
                    : "text-ink",
                )}
              >
                {p.word}
              </span>
            ))}
          </div>

          <div className="mt-3 flex gap-2 sm:flex-col">
            <button
              type="button"
              onClick={takeHint}
              disabled={hintsLeft <= 0 || status !== "playing"}
              className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2 disabled:opacity-40"
            >
              Hint ({hintsLeft})
            </button>
            <button
              type="button"
              onClick={newPuzzle}
              className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2"
            >
              New puzzle
            </button>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Drag from the first letter to the last · words run in all eight
        directions, backwards included
      </p>
    </div>
  );
}
