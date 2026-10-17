"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

type LevelId = "easy" | "medium" | "hard";

interface Level {
  id: LevelId;
  name: string;
  clues: number;
}

const LEVELS: Level[] = [
  { id: "easy", name: "Easy", clues: 42 },
  { id: "medium", name: "Medium", clues: 33 },
  { id: "hard", name: "Hard", clues: 26 },
];

const CELLS = 81;

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

function shuffled(values: number[]): number[] {
  const arr = [...values];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Every number already seen in this cell's row, column and box. */
function peersUsed(grid: number[], index: number): Set<number> {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const used = new Set<number>();
  for (let i = 0; i < 9; i++) {
    used.add(grid[row * 9 + i]);
    used.add(grid[i * 9 + col]);
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      used.add(grid[(boxRow + r) * 9 + boxCol + c]);
    }
  }
  return used;
}

function candidates(grid: number[], index: number): number[] {
  const used = peersUsed(grid, index);
  const out: number[] = [];
  for (let n = 1; n <= 9; n++) if (!used.has(n)) out.push(n);
  return out;
}

/** Backtracking fill with randomized candidate order. Mutates `grid` only. */
function fillFrom(grid: number[], index: number): boolean {
  if (index === CELLS) return true;
  if (grid[index] !== 0) return fillFrom(grid, index + 1);
  for (const n of shuffled(candidates(grid, index))) {
    grid[index] = n;
    if (fillFrom(grid, index + 1)) return true;
    grid[index] = 0;
  }
  return false;
}

function generateSolved(): number[] {
  const grid = Array<number>(CELLS).fill(0);
  fillFrom(grid, 0);
  return grid;
}

/** Punch holes in random order until only `clues` givens remain. */
function carvePuzzle(solution: number[], clues: number): number[] {
  const puzzle = [...solution];
  const order = shuffled(Array.from({ length: CELLS }, (_, i) => i));
  let blanks = CELLS - clues;
  for (const i of order) {
    if (blanks <= 0) break;
    if (puzzle[i] === 0) continue;
    puzzle[i] = 0;
    blanks -= 1;
  }
  return puzzle;
}

/** Indices that share a row, column or box (but not the cell itself). */
function isPeer(a: number, b: number): boolean {
  if (a === b) return false;
  const ra = Math.floor(a / 9);
  const ca = a % 9;
  const rb = Math.floor(b / 9);
  const cb = b % 9;
  return (
    ra === rb ||
    ca === cb ||
    (Math.floor(ra / 3) === Math.floor(rb / 3) &&
      Math.floor(ca / 3) === Math.floor(cb / 3))
  );
}

/** Cells whose value duplicates a row / column / box neighbour. */
function conflictSet(grid: number[]): Set<number> {
  const bad = new Set<number>();
  const scan = (indices: number[]) => {
    const byValue = new Map<number, number[]>();
    for (const i of indices) {
      const v = grid[i];
      if (v === 0) continue;
      const list = byValue.get(v);
      if (list) list.push(i);
      else byValue.set(v, [i]);
    }
    for (const list of byValue.values()) {
      if (list.length > 1) for (const i of list) bad.add(i);
    }
  };
  for (let r = 0; r < 9; r++) {
    scan(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  }
  for (let c = 0; c < 9; c++) {
    scan(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const box: number[] = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) box.push((br * 3 + r) * 9 + bc * 3 + c);
      }
      scan(box);
    }
  }
  return bad;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */

interface GameState {
  level: Level;
  puzzle: number[];
  grid: number[];
  notes: number[];
}

function newGame(level: Level): GameState {
  const solution = generateSolved();
  const puzzle = carvePuzzle(solution, level.clues);
  return { level, puzzle, grid: [...puzzle], notes: Array<number>(CELLS).fill(0) };
}

export default function Sudoku({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<GameState>(() => newGame(LEVELS[0]));
  const [selected, setSelected] = useState<number | null>(null);
  const [pencil, setPencil] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [newBest, setNewBest] = useState(false);

  const easyBest = useBestScore(`${gameId}-easy`, "low");
  const mediumBest = useBestScore(`${gameId}-medium`, "low");
  const hardBest = useBestScore(`${gameId}-hard`, "low");
  const active =
    game.level.id === "easy"
      ? easyBest
      : game.level.id === "medium"
        ? mediumBest
        : hardBest;

  const conflicts = useMemo(() => conflictSet(game.grid), [game.grid]);

  // ticking clock — runs while a puzzle is in progress
  useEffect(() => {
    if (!started || won) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [started, won]);

  const restart = useCallback((level: Level) => {
    setGame(newGame(level));
    setSelected(null);
    setPencil(false);
    setStarted(false);
    setElapsed(0);
    setWon(false);
    setNewBest(false);
  }, []);

  const finish = useCallback(() => {
    const seconds = Math.max(1, elapsed);
    setElapsed(seconds);
    setWon(true);
    setNewBest(active.submit(seconds));
  }, [active, elapsed]);

  const place = useCallback(
    (digit: number) => {
      if (won || selected === null) return;
      if (game.puzzle[selected] !== 0) return;
      if (!started) setStarted(true);

      if (pencil) {
        setGame((g) => ({
          ...g,
          notes: g.notes.map((mask, i) =>
            i === selected ? mask ^ (1 << digit) : mask,
          ),
        }));
        return;
      }

      const grid = game.grid.map((v, i) =>
        i === selected ? (v === digit ? 0 : digit) : v,
      );
      const notes = game.notes.map((mask, i) => {
        if (i === selected) return 0;
        if (isPeer(selected, i)) return mask & ~(1 << digit);
        return mask;
      });
      setGame((g) => ({ ...g, grid, notes }));

      if (grid.every((v) => v !== 0) && conflictSet(grid).size === 0) {
        finish();
      }
    },
    [game, selected, pencil, won, started, finish],
  );

  const clearCell = useCallback(() => {
    if (won || selected === null) return;
    if (game.puzzle[selected] !== 0) return;
    setGame((g) => ({
      ...g,
      grid: g.grid.map((v, i) => (i === selected ? 0 : v)),
      notes: g.notes.map((mask, i) => (i === selected ? 0 : mask)),
    }));
  }, [game, selected, won]);

  const moveSelection = useCallback(
    (key: string) => {
      const base = selected ?? 0;
      const row = Math.floor(base / 9);
      const col = base % 9;
      let next = base;
      if (key === "ArrowUp") next = (row === 0 ? 8 : row - 1) * 9 + col;
      else if (key === "ArrowDown") next = (row === 8 ? 0 : row + 1) * 9 + col;
      else if (key === "ArrowLeft") next = row * 9 + (col === 0 ? 8 : col - 1);
      else next = row * 9 + (col === 8 ? 0 : col + 1);
      setSelected(next);
    },
    [selected],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        place(Number(e.key));
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        clearCell();
        return;
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setPencil((p) => !p);
        return;
      }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        moveSelection(e.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [place, clearCell, moveSelection]);

  const handleCell = (index: number) => {
    setSelected(index);
  };

  const remaining = game.puzzle.filter((v, i) => v === 0 && game.grid[i] === 0)
    .length;

  return (
    <div className="w-full max-w-[520px]">
      {/* HUD */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Time{" "}
          <b className="ml-1 text-sm tabular-nums text-ink">
            {formatClock(elapsed)}
          </b>
        </span>
        <span>
          Left <b className="ml-1 text-sm tabular-nums text-ink">{remaining}</b>
        </span>
        <span className="text-warn">
          Best ({game.level.name}){" "}
          <b className="ml-1 text-sm tabular-nums text-ink">
            {active.best === null ? "—" : `${active.best}s`}
          </b>
        </span>
      </div>

      {/* difficulty + new puzzle */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => restart(l)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                l.id === game.level.id
                  ? "bg-primary text-white shadow-[0_0_18px_-6px_rgba(139,92,246,0.9)]"
                  : "border border-line text-muted hover:text-ink",
              )}
            >
              {l.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => restart(game.level)}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
        >
          ⟳ New puzzle
        </button>
      </div>

      {/* board */}
      <div className="relative rounded-2xl border border-line bg-surface-2 p-2 shadow-[0_0_60px_-24px_rgba(139,92,246,0.8)]">
        <div className="grid grid-cols-9 overflow-hidden rounded-xl border-2 border-primary/30">
          {game.grid.map((value, i) => {
            const row = Math.floor(i / 9);
            const col = i % 9;
            const given = game.puzzle[i] !== 0;
            const conflict = conflicts.has(i);
            const isSelected = selected === i;
            const peer =
              selected !== null && selected !== i && isPeer(selected, i);
            const same =
              selected !== null && value !== 0 && value === game.grid[selected];
            const mask = game.notes[i];

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleCell(i)}
                aria-label={`Row ${row + 1} column ${col + 1}${
                  value !== 0 ? `, ${value}` : ", empty"
                }`}
                className={cn(
                  "relative grid aspect-square select-none place-items-center border-[#26264a] transition",
                  col % 3 === 2 && col !== 8 && "border-r-2",
                  row % 3 === 2 && row !== 8 && "border-b-2",
                  isSelected
                    ? "bg-primary/25"
                    : same
                      ? "bg-cyan-400/10"
                      : peer
                        ? "bg-white/[0.03]"
                        : "bg-[#131322] hover:bg-[#191933]",
                )}
              >
                {value !== 0 ? (
                  <span
                    className={cn(
                      "font-display text-base font-bold sm:text-lg",
                      conflict && "text-rose-400",
                      given
                        ? "text-ink"
                        : conflict
                          ? ""
                          : "text-cyan-300",
                    )}
                  >
                    {value}
                  </span>
                ) : mask !== 0 ? (
                  <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-[2px] font-mono text-[7px] leading-none text-muted sm:text-[9px]">
                    {Array.from({ length: 9 }, (_, n) => (
                      <span key={n} className="grid place-items-center">
                        {mask & (1 << (n + 1)) ? n + 1 : ""}
                      </span>
                    ))}
                  </span>
                ) : (
                  ""
                )}
              </button>
            );
          })}
        </div>

        {won && (
          <Overlay>
            <p className="text-4xl">🧩</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              PUZZLE SOLVED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fastest {game.level.name} clear!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {formatClock(elapsed)}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {game.level.name} · Best{" "}
              {active.best === null ? "—" : `${active.best}s`}
            </p>
            <PrimaryButton
              onClick={() => restart(game.level)}
              tone="from-violet-500 via-purple-500 to-fuchsia-500"
            >
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      {/* keypad */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        {Array.from({ length: 9 }, (_, n) => n + 1).map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => place(digit)}
            aria-label={`Fill ${digit}`}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-[#131322] font-mono text-sm font-bold text-ink transition hover:border-primary/50 hover:bg-[#191933] active:scale-95 sm:h-10 sm:w-10"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPencil((p) => !p)}
          aria-pressed={pencil}
          aria-label="Toggle pencil mode"
          className={cn(
            "grid h-9 w-9 place-items-center rounded-lg border text-sm transition active:scale-95 sm:h-10 sm:w-10",
            pencil
              ? "border-warn/60 bg-warn/15 text-warn shadow-[0_0_16px_-6px_rgba(251,191,36,0.9)]"
              : "border-line bg-[#131322] text-muted hover:text-ink",
          )}
        >
          ✏️
        </button>
        <button
          type="button"
          onClick={clearCell}
          aria-label="Clear selected cell"
          className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-[#131322] text-sm text-muted transition hover:text-ink active:scale-95 sm:h-10 sm:w-10"
        >
          ⌫
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap a cell, then tap a number · pencil ✏️ writes corner notes ·
        {" "}physical keys 1–9, N and Backspace work too
      </p>
    </div>
  );
}
