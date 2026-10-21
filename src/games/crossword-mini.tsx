"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const SIZE = 5;
const PUZZLES_PER_RUN = 2;

interface Mini {
  /** 25 cells, row-major. "." marks a black square. */
  grid: string[];
  /** Clues for across entries in reading order of their start cells. */
  across: string[];
  /** Clues for down entries, same ordering rule. */
  down: string[];
}

/** Hand-built 5x5 minis — every crossing verified. */
const PUZZLES: Mini[] = [
  {
    grid: [
      "p", "e", "a", ".", ".",
      "o", "a", "r", ".", ".",
      "p", "r", "i", "d", "e",
      ".", ".", "s", "a", "w",
      ".", ".", "e", "y", "e",
    ],
    across: [
      "Legume that grows in pods",
      "Paddle for a rowboat",
      "A lion's group, or personal dignity",
      "Past tense of see",
      "Organ of sight",
    ],
    down: [
      "Soda, informally",
      "Organ of hearing",
      "To come about or emerge",
      "Twenty-four hours",
      "Female sheep",
    ],
  },
  {
    grid: [
      "l", "e", "d", ".", ".",
      "o", "a", "r", ".", ".",
      "g", "r", "a", "s", "s",
      ".", ".", "p", "e", "a",
      ".", ".", "e", "a", "t",
    ],
    across: [
      "Guided, as in led the way",
      "Rowboat paddle",
      "What a lawn is covered in",
      "Small green pod vegetable",
      "Consume food",
    ],
    down: [
      "Firewood piece, or a ship's record",
      "Organ of hearing",
      "Hang fabric loosely",
      "Salty body of water",
      "Past tense of sit",
    ],
  },
  {
    grid: [
      "c", "a", "b", ".", ".",
      "a", "l", "e", ".", ".",
      "p", "l", "a", "t", "e",
      ".", ".", "c", "o", "w",
      ".", ".", "h", "o", "e",
    ],
    across: [
      "City taxi",
      "Hoppy brew",
      "Dish you eat from",
      "Milk-giving farm animal",
      "Garden digging tool",
    ],
    down: [
      "Baseball headwear",
      "Every single one",
      "Sandy shore",
      "Also",
      "Female sheep",
    ],
  },
  {
    grid: [
      "p", "o", "p", ".", ".",
      "e", "a", "r", ".", ".",
      "a", "r", "i", "s", "e",
      ".", ".", "c", "o", "w",
      ".", ".", "e", "y", "e",
    ],
    across: [
      "Burst, or a genre of music",
      "It hears",
      "To come up or emerge",
      "Milk-giving farm animal",
      "Organ of sight",
    ],
    down: [
      "Small green pod vegetable",
      "Rowboat paddle",
      "What a shopper pays",
      "Bean behind soy milk",
      "Female sheep",
    ],
  },
];

interface Entry {
  cells: number[];
  answer: string;
  clue: string;
  number: number;
}

interface BuiltPuzzle {
  across: Entry[];
  down: Entry[];
  /** Cell index -> number shown in the corner, or 0. */
  numbers: number[];
  cellAcross: number[];
  cellDown: number[];
}

function buildPuzzle(mini: Mini): BuiltPuzzle {
  const numbers: number[] = Array(SIZE * SIZE).fill(0);
  const cellAcross: number[] = Array(SIZE * SIZE).fill(-1);
  const cellDown: number[] = Array(SIZE * SIZE).fill(-1);
  const across: Entry[] = [];
  const down: Entry[] = [];
  let num = 1;

  const isOpen = (r: number, c: number) =>
    r >= 0 && r < SIZE && c >= 0 && c < SIZE && mini.grid[r * SIZE + c] !== ".";

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const i = r * SIZE + c;
      if (!isOpen(r, c)) continue;
      const startAcross = !isOpen(r, c - 1) && isOpen(r, c + 1) && isOpen(r, c + 2);
      const startDown = !isOpen(r - 1, c) && isOpen(r + 1, c) && isOpen(r + 2, c);
      if (!startAcross && !startDown) continue;
      numbers[i] = num;
      num += 1;
      if (startAcross) {
        const cells: number[] = [];
        for (let cc = c; isOpen(r, cc); cc++) cells.push(r * SIZE + cc);
        across.push({
          cells,
          answer: cells.map((idx) => mini.grid[idx]).join(""),
          clue: mini.across[across.length] ?? "",
          number: numbers[i],
        });
        for (const cell of cells) cellAcross[cell] = across.length - 1;
      }
      if (startDown) {
        const cells: number[] = [];
        for (let rr = r; isOpen(rr, c); rr++) cells.push(rr * SIZE + c);
        down.push({
          cells,
          answer: cells.map((idx) => mini.grid[idx]).join(""),
          clue: mini.down[down.length] ?? "",
          number: numbers[i],
        });
        for (const cell of cells) cellDown[cell] = down.length - 1;
      }
    }
  }

  return { across, down, numbers, cellAcross, cellDown };
}

function shuffle<T>(list: T[]): T[] {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

type Status = "idle" | "playing" | "solved" | "over";

export default function CrosswordMini({ gameId = "crossword-mini" }: { gameId?: string }) {
  const { best, submit } = useBestScore(gameId, "low");

  const [mini, setMini] = useState<Mini>(PUZZLES[0]);
  const [letters, setLetters] = useState<string[]>(() => Array(SIZE * SIZE).fill(""));
  const [sel, setSel] = useState(0);
  const [dir, setDir] = useState<"across" | "down">("across");
  const [status, setStatus] = useState<Status>("idle");
  const [order, setOrder] = useState<number[]>([0, 1]);
  const [pIdx, setPIdx] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [warn, setWarn] = useState(false);
  const [newBest, setNewBest] = useState(false);

  const built = useMemo(() => buildPuzzle(mini), [mini]);
  const warnTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (warnTimer.current !== null) window.clearTimeout(warnTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const resetGrid = useCallback((next: Mini) => {
    setLetters(Array(SIZE * SIZE).fill(""));
    const firstOpen = next.grid.findIndex((ch) => ch !== ".");
    setSel(firstOpen < 0 ? 0 : firstOpen);
    setDir("across");
    setWarn(false);
  }, []);

  const start = useCallback(() => {
    const picked = shuffle([0, 1, 2, 3]).slice(0, PUZZLES_PER_RUN);
    setOrder(picked);
    setPIdx(0);
    setMini(PUZZLES[picked[0]]);
    resetGrid(PUZZLES[picked[0]]);
    setSeconds(0);
    setRunning(true);
    setStatus("playing");
    setNewBest(false);
  }, [resetGrid]);

  const advance = useCallback(() => {
    const next = pIdx + 1;
    if (next >= order.length) {
      setRunning(false);
      setStatus("over");
      setNewBest(submit(seconds));
      return;
    }
    setPIdx(next);
    setMini(PUZZLES[order[next]]);
    resetGrid(PUZZLES[order[next]]);
    setStatus("playing");
  }, [pIdx, order, seconds, submit, resetGrid]);

  /** Entry the cursor sits in, following the current direction. */
  const activeEntry = useMemo(() => {
    const idx = dir === "across" ? built.cellAcross[sel] : built.cellDown[sel];
    if (idx < 0) return null;
    return dir === "across" ? built.across[idx] : built.down[idx];
  }, [built, sel, dir]);

  const typeLetter = useCallback(
    (ch: string) => {
      if (status !== "playing") return;
      const entry = activeEntry;
      const next = letters.slice();
      next[sel] = ch;
      setLetters(next);
      if (!running) setRunning(true);

      if (entry) {
        const at = entry.cells.indexOf(sel);
        if (at >= 0 && at + 1 < entry.cells.length) setSel(entry.cells[at + 1]);
      }

      const filled = next.every((v, i) => mini.grid[i] === "." || v !== "");
      if (filled) {
        const solved = next.every((v, i) => mini.grid[i] === "." || v === mini.grid[i]);
        if (solved) {
          setRunning(false);
          setStatus("solved");
        } else {
          setWarn(true);
          if (warnTimer.current !== null) window.clearTimeout(warnTimer.current);
          warnTimer.current = window.setTimeout(() => setWarn(false), 900);
        }
      }
    },
    [status, activeEntry, letters, sel, mini, running],
  );

  const erase = useCallback(() => {
    if (status !== "playing") return;
    if (letters[sel] !== "") {
      const next = letters.slice();
      next[sel] = "";
      setLetters(next);
      return;
    }
    const entry = activeEntry;
    if (!entry) return;
    const at = entry.cells.indexOf(sel);
    if (at > 0) {
      const prevCell = entry.cells[at - 1];
      const next = letters.slice();
      next[prevCell] = "";
      setLetters(next);
      setSel(prevCell);
    }
  }, [status, letters, sel, activeEntry]);

  const selectCell = useCallback(
    (cell: number) => {
      if (status !== "playing") return;
      if (cell === sel) {
        const hasAcross = built.cellAcross[cell] >= 0;
        const hasDown = built.cellDown[cell] >= 0;
        if (hasAcross && hasDown) setDir((d) => (d === "across" ? "down" : "across"));
        return;
      }
      setSel(cell);
      if (built.cellAcross[cell] < 0) setDir("down");
      else if (built.cellDown[cell] < 0) setDir("across");
    },
    [status, sel, built],
  );

  const selectEntry = useCallback(
    (entry: Entry, entryDir: "across" | "down") => {
      if (status !== "playing") return;
      setSel(entry.cells[0]);
      setDir(entryDir);
    },
    [status],
  );

  const moveArrow = useCallback(
    (dr: number, dc: number) => {
      setDir(dr === 0 ? "across" : "down");
      const isOpenCell = (r: number, c: number) =>
        r >= 0 && r < SIZE && c >= 0 && c < SIZE && mini.grid[r * SIZE + c] !== ".";
      let r = Math.floor(sel / SIZE);
      let c = sel % SIZE;
      for (let step = 0; step < SIZE; step++) {
        r += dr;
        c += dc;
        if (!isOpenCell(r, c)) return;
        const cell = r * SIZE + c;
        setSel(cell);
      }
    },
    [sel, mini],
  );

  const cycleEntry = useCallback(
    (delta: number) => {
      const list = dir === "across" ? built.across : built.down;
      const idx = activeEntry ? list.indexOf(activeEntry) : -1;
      const next = list[(idx + delta + list.length) % list.length];
      if (next) {
        setSel(next.cells[0]);
        setDir(dir);
      }
    },
    [dir, built, activeEntry],
  );

  useEffect(() => {
    if (status !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        cycleEntry(e.shiftKey ? -1 : 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveArrow(0, -1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        moveArrow(0, 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveArrow(-1, 0);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        moveArrow(1, 0);
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        typeLetter(e.key.toLowerCase());
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        erase();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, typeLetter, erase, moveArrow, cycleEntry]);

  const pressKey = useCallback(
    (key: string) => {
      if (key === "back") erase();
      else typeLetter(key);
    },
    [erase, typeLetter],
  );

  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const entryClass = (entry: Entry, entryDir: "across" | "down") => {
    const done = entry.cells.every((c, k) => letters[c] === entry.answer[k]);
    if (done) return "text-emerald-400";
    if (activeEntry === entry && dir === entryDir) return "text-warn";
    return "text-ink";
  };

  const solvedCount =
    built.across.filter((e) => e.cells.every((c, k) => letters[c] === e.answer[k])).length +
    built.down.filter((e) => e.cells.every((c, k) => letters[c] === e.answer[k])).length;

  return (
    <div className="w-full max-w-[640px]">
      <GameHud
        score={time}
        best={best === null ? "—" : `${Math.floor(best / 60)}:${String(best % 60).padStart(2, "0")}`}
      >
        <span>
          Puzzle <b className="ml-1 text-sm text-ink">{Math.min(pIdx + 1, PUZZLES_PER_RUN)}/{PUZZLES_PER_RUN}</b>
        </span>
      </GameHud>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative mx-auto w-full max-w-[330px] rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-22px_rgba(148,163,184,0.5)]">
          <div
            className={cn(
              "grid grid-cols-5 gap-1 transition-transform duration-75",
              warn && "-translate-y-1",
            )}
          >
            {letters.map((letter, i) => {
              const black = mini.grid[i] === ".";
              const isActive =
                activeEntry !== null && activeEntry.cells.includes(i) && status === "playing";
              const isSelCell = i === sel && status === "playing";
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectCell(i)}
                  disabled={black}
                  className={cn(
                    "relative grid aspect-square place-items-center rounded-md border font-display text-lg font-bold sm:text-xl",
                    black
                      ? "cursor-default border-line bg-[#08080f]"
                      : cn(
                          "border-line transition",
                          isActive ? "bg-primary/20" : "bg-[#131322]",
                          isSelCell && "ring-2 ring-warn",
                          letter !== "" && (letter === mini.grid[i] ? "text-emerald-300" : "text-ink"),
                        ),
                  )}
                >
                  {built.numbers[i] > 0 && (
                    <span className="absolute left-1 top-0.5 font-sans text-[9px] font-normal text-muted">
                      {built.numbers[i]}
                    </span>
                  )}
                  {black ? "" : letter.toUpperCase()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-col gap-1 select-none">
            {KEYS.map((row, r) => (
              <div key={r} className="flex justify-center gap-1">
                {r === 2 && (
                  <button
                    type="button"
                    onPointerDown={() => pressKey("back")}
                    className="rounded-lg border border-line bg-surface px-2.5 py-2 text-xs text-muted transition hover:bg-surface-2"
                  >
                    ⌫
                  </button>
                )}
                {row.split("").map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onPointerDown={() => pressKey(ch)}
                    className="h-8 w-7 rounded-lg border border-line bg-surface text-xs font-display text-ink transition hover:border-primary/60 hover:bg-surface-2 active:scale-95 sm:w-8"
                  >
                    {ch}
                  </button>
                ))}
                {r === 2 && (
                  <button
                    type="button"
                    onPointerDown={() => setDir((d) => (d === "across" ? "down" : "across"))}
                    className="rounded-lg border border-primary/50 bg-primary/15 px-2.5 py-2 text-[10px] font-bold text-ink transition hover:bg-primary/25"
                  >
                    ⇄
                  </button>
                )}
              </div>
            ))}
          </div>

          {status === "idle" && (
            <Overlay>
              <p className="text-4xl">🧩</p>
              <p className="mt-2 font-display text-2xl font-bold text-gradient">
                FILL TWO MINI GRIDS
              </p>
              <p className="mt-2 text-sm text-muted">
                Tap a cell, then type or tap letters. Crossings tell you the truth.
              </p>
              <PrimaryButton onClick={start} tone="from-slate-400 via-zinc-500 to-neutral-700">
                Start run
              </PrimaryButton>
            </Overlay>
          )}

          {status === "solved" && (
            <Overlay>
              <p className="text-4xl">✨</p>
              <p className="mt-2 font-display text-2xl font-bold text-gradient">
                GRID FILLED
              </p>
              <p className="mt-2 text-sm text-muted">
                {pIdx + 1 >= order.length ? "That was the last one." : "One more grid to go."}
              </p>
              <PrimaryButton onClick={advance} tone="from-slate-400 via-zinc-500 to-neutral-700">
                {pIdx + 1 >= order.length ? "See results" : "Next puzzle"}
              </PrimaryButton>
            </Overlay>
          )}

          {status === "over" && (
            <Overlay>
              <p className="text-4xl">🏁</p>
              <p className="mt-2 font-display text-2xl font-bold text-gradient">
                RUN COMPLETE
              </p>
              {newBest && (
                <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                  ✦ New fastest time!
                </p>
              )}
              <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">{time}</p>
              <p className="text-xs uppercase tracking-widest text-muted">
                Best{" "}
                {best === null
                  ? "—"
                  : `${Math.floor(best / 60)}:${String(best % 60).padStart(2, "0")}`}
              </p>
              <PrimaryButton onClick={start} tone="from-slate-400 via-zinc-500 to-neutral-700">
                Play again
              </PrimaryButton>
            </Overlay>
          )}
        </div>

        <div className="flex gap-3 sm:w-64 sm:flex-col">
          {(["across", "down"] as const).map((entryDir) => (
            <div key={entryDir} className="flex-1">
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                {entryDir}
              </p>
              <div className="space-y-1">
                {(entryDir === "across" ? built.across : built.down).map((entry) => (
                  <button
                    key={`${entryDir}-${entry.number}`}
                    type="button"
                    onClick={() => selectEntry(entry, entryDir)}
                    className={cn(
                      "flex w-full gap-2 rounded-md border border-transparent px-1.5 py-1 text-left text-xs transition hover:border-line hover:bg-surface-2",
                      activeEntry === entry && dir === entryDir && "border-warn/50 bg-warn/10",
                    )}
                  >
                    <span className="font-mono text-muted">{entry.number}</span>
                    <span className={entryClass(entry, entryDir)}>{entry.clue}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-2 flex gap-2 sm:flex-col">
            <button
              type="button"
              onClick={advance}
              disabled={status !== "playing"}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2 disabled:opacity-40"
            >
              Skip grid
            </button>
            <button
              type="button"
              onClick={start}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2"
            >
              New run
            </button>
          </div>

          {status === "playing" && (
            <p className="hidden font-mono text-[10px] uppercase tracking-widest text-muted sm:block">
              {solvedCount}/{built.across.length + built.down.length} words solved
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Click a cell · type or tap letters · tap a clue to jump · ⇄ flips direction
      </p>
    </div>
  );
}
