"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

const SIZE = 10;

/* Hand-authored 10×10 patterns, one string per row ("1" = filled). */
const PATTERNS: string[][] = [
  [ // heart
    "0011001100",
    "0111111110",
    "1111111111",
    "1111111111",
    "0111111110",
    "0011111100",
    "0001111000",
    "0000110000",
    "0000110000",
    "0000000000",
  ],
  [ // smiley
    "0011111100",
    "0100000010",
    "1010000101",
    "1000000001",
    "1000000001",
    "1001001001",
    "1010000101",
    "0111111110",
    "0011111100",
    "0000000000",
  ],
  [ // up arrow
    "0000010000",
    "0000111000",
    "0001111100",
    "0011111110",
    "0111111111",
    "0001111100",
    "0000111000",
    "0000010000",
    "0000010000",
    "0000010000",
  ],
  [ // house
    "0000110000",
    "0001111000",
    "0011111100",
    "0111111110",
    "1111111111",
    "0111111110",
    "0110000110",
    "0110000110",
    "0110000110",
    "0111111110",
  ],
  [ // tree
    "0000110000",
    "0001111000",
    "0011111100",
    "0001111000",
    "0011111100",
    "0111111110",
    "1111111111",
    "0000110000",
    "0000110000",
    "0001111000",
  ],
  [ // fish
    "0000000000",
    "0011100000",
    "0111110010",
    "1111111111",
    "0111111110",
    "0011111100",
    "0111111110",
    "1111111111",
    "0011100010",
    "0000000000",
  ],
  [ // cup
    "0000000000",
    "0111111110",
    "0100000011",
    "0100000011",
    "0100000011",
    "0100000010",
    "0111111100",
    "0011111000",
    "0000000000",
    "0000000000",
  ],
  [ // diamond
    "0000110000",
    "0001111000",
    "0011111100",
    "0111111110",
    "1111111111",
    "1111111111",
    "0111111110",
    "0011111100",
    "0001111000",
    "0000110000",
  ],
  [ // boat
    "0000010000",
    "0000111000",
    "0001111100",
    "0000111000",
    "0000010000",
    "0000000000",
    "1111111111",
    "0111111110",
    "0011111000",
    "0000000000",
  ],
  [ // plus
    "0000110000",
    "0000110000",
    "0000110000",
    "1111111111",
    "1111111111",
    "1111111111",
    "0000110000",
    "0000110000",
    "0000110000",
    "0000000000",
  ],
  [ // key
    "0011111100",
    "0110001110",
    "0110001100",
    "0110001110",
    "0011111100",
    "0000110000",
    "0000110000",
    "0000110000",
    "0000111100",
    "0000000000",
  ],
  [ // ladder / grid
    "1111111111",
    "1000100001",
    "1000100001",
    "1111111111",
    "1000100001",
    "1000100001",
    "1111111111",
    "1000100001",
    "1000100001",
    "1111111111",
  ],
  [ // mug
    "0000000000",
    "0111111100",
    "0100000110",
    "0100000110",
    "0100000110",
    "0100000110",
    "0111111100",
    "0011111000",
    "0011111000",
    "0000000000",
  ],
];

interface Clues {
  rows: number[][];
  cols: number[][];
}

function lineClues(line: string): number[] {
  const out: number[] = [];
  let run = 0;
  for (const ch of line) {
    if (ch === "1") run += 1;
    else if (run > 0) {
      out.push(run);
      run = 0;
    }
  }
  if (run > 0) out.push(run);
  return out.length > 0 ? out : [0];
}

function patternClues(pattern: string[]): Clues {
  const rows = pattern.map(lineClues);
  const cols: number[][] = [];
  for (let c = 0; c < SIZE; c++) {
    let col = "";
    for (let r = 0; r < SIZE; r++) col += pattern[r][c];
    cols.push(lineClues(col));
  }
  return { rows, cols };
}

const CLUES = PATTERNS.map(patternClues);

/** Runs of filled cells in a played line, for the "satisfied" dimming. */
function filledClues(line: number[]): number[] {
  const out: number[] = [];
  let run = 0;
  for (const v of line) {
    if (v === 1) run += 1;
    else if (run > 0) {
      out.push(run);
      run = 0;
    }
  }
  if (run > 0) out.push(run);
  return out;
}

function sameClues(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */

export default function Nonogram({ gameId }: { gameId: string }) {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * PATTERNS.length),
  );
  // 0 = empty, 1 = filled, 2 = crossed out
  const [cells, setCells] = useState<number[]>(() =>
    Array<number>(SIZE * SIZE).fill(0),
  );
  const [flagMode, setFlagMode] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "low");

  const pattern = PATTERNS[index];
  const clues = CLUES[index];

  // ticking clock while the puzzle is in play
  useEffect(() => {
    if (!started || won) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [started, won]);

  const nextPuzzle = useCallback(() => {
    setIndex((i) => (i + 1) % PATTERNS.length);
    setCells(Array<number>(SIZE * SIZE).fill(0));
    setFlagMode(false);
    setStarted(false);
    setElapsed(0);
    setWon(false);
    setNewBest(false);
  }, []);

  const tap = useCallback(
    (row: number, col: number, mark: boolean) => {
      if (won) return;
      if (!started) setStarted(true);
      const i = row * SIZE + col;
      const next = [...cells];
      if (mark) next[i] = next[i] === 2 ? 0 : 2;
      else next[i] = next[i] === 1 ? 0 : 1;
      setCells(next);

      // win when filled cells match the hidden pattern exactly
      const solved = next.every(
        (v, k) => (v === 1) === (pattern[Math.floor(k / SIZE)][k % SIZE] === "1"),
      );
      if (solved) {
        const seconds = Math.max(1, elapsed);
        setElapsed(seconds);
        setWon(true);
        setNewBest(submit(seconds));
      }
    },
    [cells, won, started, pattern, elapsed, submit],
  );

  const solvedRows = useMemo(() => {
    return Array.from({ length: SIZE }, (_, r) =>
      sameClues(
        filledClues(cells.slice(r * SIZE, r * SIZE + SIZE)),
        clues.rows[r],
      ),
    );
  }, [cells, clues]);

  const solvedCols = useMemo(() => {
    return Array.from({ length: SIZE }, (_, c) => {
      const col: number[] = [];
      for (let r = 0; r < SIZE; r++) col.push(cells[r * SIZE + c]);
      return sameClues(filledClues(col), clues.cols[c]);
    });
  }, [cells, clues]);

  const filledCount = cells.filter((v) => v === 1).length;
  const targetCount = pattern.reduce(
    (sum, row) => sum + row.split("").filter((ch) => ch === "1").length,
    0,
  );

  return (
    <div className="w-full max-w-[560px]">
      {/* HUD */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Time{" "}
          <b className="ml-1 text-sm tabular-nums text-ink">
            {formatClock(elapsed)}
          </b>
        </span>
        <span>
          Filled{" "}
          <b className="ml-1 text-sm tabular-nums text-ink">
            {filledCount}/{targetCount}
          </b>
        </span>
        <span className="text-warn">
          Best{" "}
          <b className="ml-1 text-sm tabular-nums text-ink">
            {best === null ? "—" : `${best}s`}
          </b>
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setFlagMode((f) => !f)}
          aria-pressed={flagMode}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition",
            flagMode
              ? "bg-rose-500 text-white shadow-[0_0_18px_-6px_rgba(244,63,94,0.9)]"
              : "border border-line text-muted hover:text-ink",
          )}
        >
          ✕ Mark mode {flagMode ? "ON" : "off"}
        </button>
        <button
          type="button"
          onClick={nextPuzzle}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
        >
          ⟳ New puzzle ({index + 1}/{PATTERNS.length})
        </button>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(244,114,182,0.7)]">
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: "auto 1fr" }}>
          {/* column clues */}
          <div aria-hidden className="w-10" />
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: SIZE }, (_, c) => (
              <div
                key={c}
                className={cn(
                  "flex flex-col items-center justify-end gap-0.5 font-mono text-[10px] leading-none transition sm:text-xs",
                  solvedCols[c] ? "text-line" : "text-cyan-400",
                )}
              >
                {clues.cols[c].map((n, k) => (
                  <span key={k}>{n}</span>
                ))}
              </div>
            ))}
          </div>

          {/* row clues + grid */}
          <div
            className="grid gap-1"
            style={{ gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: SIZE }, (_, r) => (
              <div
                key={r}
                className={cn(
                  "flex items-center justify-end gap-1 pr-1.5 font-mono text-[10px] leading-none transition sm:text-xs",
                  solvedRows[r] ? "text-line" : "text-cyan-400",
                )}
              >
                {clues.rows[r].map((n, k) => (
                  <span key={k} className="tabular-nums">
                    {n}
                  </span>
                ))}
              </div>
            ))}
          </div>

          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))`,
            }}
          >
            {cells.map((value, i) => {
              const row = Math.floor(i / SIZE);
              const col = i % SIZE;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => tap(row, col, flagMode)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    tap(row, col, true);
                  }}
                  aria-label={`Row ${row + 1} column ${col + 1}`}
                  className={cn(
                    "grid aspect-square select-none place-items-center rounded border font-mono text-xs font-bold transition sm:text-sm",
                    value === 1
                      ? "border-cyan-400/50 bg-cyan-400/80 text-black"
                      : value === 2
                        ? "border-line bg-[#131322] text-rose-400"
                        : "border-line bg-[#131322] hover:border-primary/50 hover:bg-[#191933]",
                  )}
                >
                  {value === 2 ? "✕" : ""}
                </button>
              );
            })}
          </div>
        </div>

        {won && (
          <Overlay>
            <p className="text-4xl">🎨</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              PICTURE COMPLETE
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fastest clear!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {formatClock(elapsed)}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : `${best}s`}
            </p>
            <PrimaryButton
              onClick={nextPuzzle}
              tone="from-pink-400 via-rose-500 to-red-400"
            >
              Next picture
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Left-click fills · right-click or mark mode draws an ✕ · dimmed clues
        are satisfied
      </p>
    </div>
  );
}
