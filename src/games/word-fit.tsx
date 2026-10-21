"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

interface Slot {
  /** The target word for this run of cells. */
  w: string;
  r: number;
  c: number;
  /** Direction: [rowDelta, colDelta] — [0,1] across, [1,0] down. */
  d: [number, number];
}

interface Given {
  r: number;
  c: number;
  l: string;
}

interface Puzzle {
  /** "#" is a blocked cell, "." is a letter cell to be filled. */
  grid: string[];
  slots: Slot[];
  /** Pre-filled letters that seed the grid. */
  givens: Given[];
}

const BANK: Puzzle[] = [
  {
    grid: ["#.####...",".......##","#.####.##","#.##.#.##","##.....##","####.#.##","#.....###","####.####"],
    slots: [
      { w: "heron", r: 4, c: 2, d: [0,1] },
      { w: "island", r: 0, c: 6, d: [1,0] },
      { w: "ivy", r: 0, c: 6, d: [0,1] },
      { w: "orbit", r: 3, c: 4, d: [1,0] },
      { w: "compass", r: 1, c: 0, d: [0,1] },
      { w: "snail", r: 6, c: 1, d: [0,1] },
      { w: "rose", r: 0, c: 1, d: [1,0] },
    ],
    givens: [
      { r: 1, c: 6, l: "s" },
      { r: 4, c: 4, l: "r" },
      { r: 0, c: 6, l: "i" },
      { r: 4, c: 6, l: "n" },
    ],
  },
  {
    grid: ["#......##","#.#######",".....##.#","#.##....#","#.##.##.#","#######.#","####.##.#","###......","####.####"],
    slots: [
      { w: "table", r: 2, c: 0, d: [0,1] },
      { w: "elk", r: 2, c: 4, d: [1,0] },
      { w: "lake", r: 3, c: 4, d: [0,1] },
      { w: "whale", r: 0, c: 1, d: [1,0] },
      { w: "gentle", r: 2, c: 7, d: [1,0] },
      { w: "window", r: 0, c: 1, d: [0,1] },
      { w: "summer", r: 7, c: 3, d: [0,1] },
      { w: "run", r: 6, c: 4, d: [1,0] },
    ],
    givens: [
      { r: 3, c: 7, l: "e" },
      { r: 7, c: 7, l: "e" },
    ],
  },
  {
    grid: ["......###","####.####","####.####","####.####",".....###.","##.#.#.#.","#...#....","##.###.##","##.###.##","#......##"],
    slots: [
      { w: "pepper", r: 9, c: 1, d: [0,1] },
      { w: "solar", r: 5, c: 6, d: [1,0] },
      { w: "orange", r: 4, c: 2, d: [1,0] },
      { w: "phone", r: 4, c: 0, d: [0,1] },
      { w: "song", r: 6, c: 5, d: [0,1] },
      { w: "fig", r: 4, c: 8, d: [1,0] },
      { w: "van", r: 6, c: 1, d: [0,1] },
      { w: "ladder", r: 0, c: 4, d: [1,0] },
      { w: "marble", r: 0, c: 0, d: [0,1] },
    ],
    givens: [
      { r: 6, c: 2, l: "a" },
      { r: 9, c: 2, l: "e" },
    ],
  },
  {
    grid: ["#...######","###.######","###.######","#...###.##","###.#.....","......#.#.","#####.###.","#.....###.","#####.####","####.....#"],
    slots: [
      { w: "winter", r: 5, c: 0, d: [0,1] },
      { w: "bridge", r: 4, c: 5, d: [1,0] },
      { w: "beach", r: 4, c: 5, d: [0,1] },
      { w: "oak", r: 3, c: 7, d: [1,0] },
      { w: "bread", r: 7, c: 1, d: [0,1] },
      { w: "hill", r: 4, c: 9, d: [1,0] },
      { w: "planet", r: 0, c: 3, d: [1,0] },
      { w: "run", r: 3, c: 1, d: [0,1] },
      { w: "gecko", r: 9, c: 4, d: [0,1] },
      { w: "cup", r: 0, c: 1, d: [0,1] },
    ],
    givens: [
      { r: 0, c: 3, l: "p" },
      { r: 5, c: 3, l: "t" },
      { r: 7, c: 5, l: "d" },
    ],
  },
  {
    grid: ["########.","########.","###......","###.####.",".#.....#.",".##.#.##.","....#.###",".####.###",".####.###",".####.###"],
    slots: [
      { w: "market", r: 4, c: 0, d: [1,0] },
      { w: "road", r: 6, c: 0, d: [0,1] },
      { w: "cloud", r: 2, c: 3, d: [1,0] },
      { w: "horse", r: 4, c: 2, d: [0,1] },
      { w: "clever", r: 2, c: 3, d: [0,1] },
      { w: "street", r: 0, c: 8, d: [1,0] },
      { w: "silver", r: 4, c: 5, d: [1,0] },
    ],
    givens: [
      { r: 2, c: 3, l: "c" },
      { r: 4, c: 3, l: "o" },
    ],
  },
  {
    grid: ["#.#######","#.#######","#.....###","#.###.##.","###......","#.###.##.","#.###.##.","......##.",".#######.",".########"],
    slots: [
      { w: "market", r: 2, c: 5, d: [1,0] },
      { w: "carrot", r: 7, c: 0, d: [0,1] },
      { w: "harbor", r: 4, c: 3, d: [0,1] },
      { w: "storm", r: 2, c: 1, d: [0,1] },
      { w: "artist", r: 3, c: 8, d: [1,0] },
      { w: "fish", r: 0, c: 1, d: [1,0] },
      { w: "cow", r: 7, c: 0, d: [1,0] },
      { w: "sea", r: 5, c: 1, d: [1,0] },
    ],
    givens: [
      { r: 7, c: 1, l: "a" },
      { r: 7, c: 5, l: "t" },
    ],
  },
  {
    grid: ["#######.##","####.##.##",".#......##",".###.####.",".###.####.","......###.",".###.####.","####......","#######.##","####......"],
    slots: [
      { w: "morning", r: 1, c: 4, d: [1,0] },
      { w: "pencil", r: 5, c: 0, d: [0,1] },
      { w: "gentle", r: 7, c: 4, d: [0,1] },
      { w: "grape", r: 2, c: 0, d: [1,0] },
      { w: "whale", r: 3, c: 9, d: [1,0] },
      { w: "tin", r: 7, c: 7, d: [1,0] },
      { w: "violin", r: 2, c: 2, d: [0,1] },
      { w: "sun", r: 0, c: 7, d: [1,0] },
      { w: "tunnel", r: 9, c: 4, d: [0,1] },
    ],
    givens: [
      { r: 2, c: 4, l: "o" },
      { r: 9, c: 7, l: "n" },
    ],
  },
  {
    grid: ["#.#####.##","#.#####.#.","#...###.#.","#.#####.#.","#.##......",".....#.##.","####.#.##.",".....#.###","####.#.###","......####"],
    slots: [
      { w: "golden", r: 4, c: 4, d: [0,1] },
      { w: "gentle", r: 4, c: 4, d: [1,0] },
      { w: "brave", r: 5, c: 0, d: [0,1] },
      { w: "valley", r: 9, c: 0, d: [0,1] },
      { w: "light", r: 4, c: 6, d: [1,0] },
      { w: "orbit", r: 7, c: 0, d: [0,1] },
      { w: "anchor", r: 0, c: 1, d: [1,0] },
      { w: "cup", r: 2, c: 1, d: [0,1] },
      { w: "proud", r: 0, c: 7, d: [1,0] },
      { w: "tunnel", r: 1, c: 9, d: [1,0] },
    ],
    givens: [
      { r: 4, c: 6, l: "l" },
      { r: 4, c: 7, l: "d" },
      { r: 7, c: 4, l: "t" },
    ],
  },
  {
    grid: ["####......","#.###.####","......####","#.###.#.##","#.#.......","#.###.#.##","#.#####.##","##......##","#######.##"],
    slots: [
      { w: "compass", r: 4, c: 3, d: [0,1] },
      { w: "autumn", r: 0, c: 5, d: [1,0] },
      { w: "ticket", r: 2, c: 0, d: [0,1] },
      { w: "banana", r: 0, c: 4, d: [0,1] },
      { w: "winter", r: 1, c: 1, d: [1,0] },
      { w: "ladder", r: 3, c: 7, d: [1,0] },
      { w: "candle", r: 7, c: 2, d: [0,1] },
    ],
    givens: [
      { r: 7, c: 7, l: "e" },
      { r: 4, c: 7, l: "a" },
      { r: 0, c: 5, l: "a" },
    ],
  },
  {
    grid: [".....#####","####.####.","####.##...","##.#.##.#.",".....##.#.","##.#....#.","##.#######"],
    slots: [
      { w: "juice", r: 4, c: 0, d: [0,1] },
      { w: "pepper", r: 0, c: 4, d: [1,0] },
      { w: "rose", r: 5, c: 4, d: [0,1] },
      { w: "tree", r: 2, c: 7, d: [1,0] },
      { w: "hill", r: 3, c: 2, d: [1,0] },
      { w: "tulip", r: 0, c: 0, d: [0,1] },
      { w: "tin", r: 2, c: 7, d: [0,1] },
      { w: "onion", r: 1, c: 9, d: [1,0] },
    ],
    givens: [
      { r: 5, c: 7, l: "e" },
      { r: 0, c: 4, l: "p" },
    ],
  },
  {
    grid: ["#.#####.##",".....##.##","#.###.....","#.#.#.#.#.","......#.#.","#.#.#.###.","###.#.###.","###.######","#...######"],
    slots: [
      { w: "swift", r: 2, c: 5, d: [0,1] },
      { w: "sugar", r: 2, c: 5, d: [1,0] },
      { w: "rowing", r: 4, c: 0, d: [0,1] },
      { w: "meadow", r: 0, c: 1, d: [1,0] },
      { w: "tulip", r: 2, c: 9, d: [1,0] },
      { w: "berry", r: 1, c: 0, d: [0,1] },
      { w: "daisy", r: 0, c: 7, d: [1,0] },
      { w: "violet", r: 3, c: 3, d: [1,0] },
      { w: "hat", r: 8, c: 1, d: [0,1] },
    ],
    givens: [
      { r: 4, c: 5, l: "g" },
      { r: 2, c: 7, l: "i" },
      { r: 2, c: 5, l: "s" },
    ],
  },
  {
    grid: ["#.#....###","#.##.#####",".....#...#","#.##.#.#.#","#.#.......","...#.#.###","#.####.###","##.....###"],
    slots: [
      { w: "morning", r: 4, c: 3, d: [0,1] },
      { w: "harbor", r: 0, c: 4, d: [1,0] },
      { w: "canyon", r: 2, c: 6, d: [1,0] },
      { w: "water", r: 2, c: 0, d: [0,1] },
      { w: "cat", r: 2, c: 6, d: [0,1] },
      { w: "ship", r: 0, c: 3, d: [0,1] },
      { w: "lemon", r: 7, c: 2, d: [0,1] },
      { w: "tin", r: 2, c: 8, d: [1,0] },
      { w: "teacher", r: 0, c: 1, d: [1,0] },
      { w: "net", r: 5, c: 0, d: [0,1] },
    ],
    givens: [
      { r: 7, c: 6, l: "n" },
      { r: 5, c: 1, l: "e" },
      { r: 4, c: 8, l: "n" },
      { r: 2, c: 6, l: "c" },
    ],
  },
  {
    grid: ["###.....##","####.#####","###....#.#",".###.##...",".....###.#",".###.###.#",".##......#",".#######.#",".#########"],
    slots: [
      { w: "teacher", r: 0, c: 4, d: [1,0] },
      { w: "salt", r: 2, c: 3, d: [0,1] },
      { w: "peach", r: 4, c: 0, d: [0,1] },
      { w: "stone", r: 0, c: 3, d: [0,1] },
      { w: "orange", r: 6, c: 3, d: [0,1] },
      { w: "ladder", r: 2, c: 8, d: [1,0] },
      { w: "saw", r: 3, c: 7, d: [0,1] },
      { w: "spring", r: 3, c: 0, d: [1,0] },
    ],
    givens: [
      { r: 6, c: 4, l: "r" },
      { r: 4, c: 4, l: "h" },
      { r: 2, c: 4, l: "a" },
    ],
  },
  {
    grid: ["#####.####","####......",".####.####",".#.##.#.##",".#.##....#","......#.##",".###.#####","####.#####","......####","####.#####"],
    slots: [
      { w: "artist", r: 5, c: 0, d: [0,1] },
      { w: "ant", r: 3, c: 2, d: [1,0] },
      { w: "forest", r: 0, c: 5, d: [1,0] },
      { w: "pocket", r: 1, c: 4, d: [0,1] },
      { w: "sheep", r: 5, c: 4, d: [1,0] },
      { w: "sugar", r: 2, c: 0, d: [1,0] },
      { w: "snow", r: 4, c: 5, d: [0,1] },
      { w: "hammer", r: 8, c: 0, d: [0,1] },
      { w: "dog", r: 3, c: 7, d: [1,0] },
    ],
    givens: [
      { r: 4, c: 7, l: "o" },
      { r: 5, c: 2, l: "t" },
      { r: 5, c: 0, l: "a" },
    ],
  },
  {
    grid: ["####.....#","#######.#.","#######.#.",".###....#.",".###.##.#.",".....#....","####.####.","##.#.#####","......####","##.#######"],
    slots: [
      { w: "summer", r: 0, c: 7, d: [1,0] },
      { w: "plum", r: 3, c: 4, d: [0,1] },
      { w: "mouse", r: 0, c: 4, d: [0,1] },
      { w: "potato", r: 3, c: 4, d: [1,0] },
      { w: "night", r: 5, c: 0, d: [0,1] },
      { w: "canyon", r: 8, c: 0, d: [0,1] },
      { w: "tree", r: 5, c: 6, d: [0,1] },
      { w: "ink", r: 7, c: 2, d: [1,0] },
      { w: "urn", r: 3, c: 0, d: [1,0] },
      { w: "basket", r: 1, c: 9, d: [1,0] },
    ],
    givens: [
      { r: 8, c: 4, l: "o" },
      { r: 8, c: 2, l: "n" },
      { r: 5, c: 9, l: "e" },
    ],
  },
];

const PUZZLES_PER_RUN = 3;
const TONE = "from-lime-400 via-emerald-500 to-teal-600";

type Status = "idle" | "playing" | "over";

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

/** Flat index -> list of slot indices that cover that cell. */
function buildCellMap(puzzle: Puzzle): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (let s = 0; s < puzzle.slots.length; s++) {
    const slot = puzzle.slots[s];
    for (let k = 0; k < slot.w.length; k++) {
      const key = `${slot.r + slot.d[0] * k},${slot.c + slot.d[1] * k}`;
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
  }
  return map;
}

export default function WordFit() {
  const { best, submit } = useBestScore("word-fit", "low");

  const [status, setStatus] = useState<Status>("idle");
  const [deck, setDeck] = useState<number[]>([0, 1, 2]);
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [bank, setBank] = useState<string[]>(() => BANK[0].slots.map((s) => s.w));
  const [placed, setPlaced] = useState<(string | null)[]>(() =>
    BANK[0].slots.map(() => null),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [newBest, setNewBest] = useState(false);

  const wrongTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    },
    [],
  );

  // The stopwatch only ticks while a run is under way.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const puzzle = deck[puzzleIdx] !== undefined ? BANK[deck[puzzleIdx]] : BANK[0];
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0].length;

  const cellMap = useMemo(() => buildCellMap(puzzle), [puzzle]);

  const board = useMemo(() => {
    const givenMap = new Map<string, string>();
    for (let i = 0; i < puzzle.givens.length; i++) {
      const g = puzzle.givens[i];
      givenMap.set(`${g.r},${g.c}`, g.l);
    }
    const b: string[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < cols; c++) {
        if (puzzle.grid[r][c] === "#") {
          row.push("#");
          continue;
        }
        const given = givenMap.get(`${r},${c}`);
        if (given) {
          row.push(given);
          continue;
        }
        let ch = "";
        for (let s = 0; s < puzzle.slots.length && !ch; s++) {
          const word = placed[s];
          if (!word) continue;
          const slot = puzzle.slots[s];
          for (let k = 0; k < word.length; k++) {
            if (slot.r + slot.d[0] * k === r && slot.c + slot.d[1] * k === c) {
              ch = word[k];
              break;
            }
          }
        }
        row.push(ch);
      }
      b.push(row);
    }
    return b;
  }, [puzzle, placed, rows, cols]);

  const givenSet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < puzzle.givens.length; i++) {
      const g = puzzle.givens[i];
      set.add(`${g.r},${g.c}`);
    }
    return set;
  }, [puzzle]);

  const filledSet = useMemo(() => {
    const set = new Set<string>();
    for (let s = 0; s < puzzle.slots.length; s++) {
      const word = placed[s];
      if (!word) continue;
      const slot = puzzle.slots[s];
      for (let k = 0; k < word.length; k++) {
        set.add(`${slot.r + slot.d[0] * k},${slot.c + slot.d[1] * k}`);
      }
    }
    return set;
  }, [puzzle, placed]);

  const usedWords = useMemo(
    () => new Set(placed.filter((x): x is string => x !== null)),
    [placed],
  );

  const hintCells = useMemo(() => {
    const set = new Set<string>();
    if (selected === null) return set;
    const len = bank[selected]?.length ?? -1;
    for (let s = 0; s < puzzle.slots.length; s++) {
      if (placed[s]) continue;
      const slot = puzzle.slots[s];
      if (slot.w.length !== len) continue;
      for (let k = 0; k < slot.w.length; k++) {
        set.add(`${slot.r + slot.d[0] * k},${slot.c + slot.d[1] * k}`);
      }
    }
    return set;
  }, [selected, bank, puzzle, placed]);

  const flashWrong = useCallback(() => {
    if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    setWrong(true);
    wrongTimer.current = window.setTimeout(() => setWrong(false), 420);
  }, []);

  const start = useCallback(() => {
    const d = shuffle(BANK.map((_, i) => i)).slice(0, PUZZLES_PER_RUN);
    const p = BANK[d[0]];
    setDeck(d);
    setPuzzleIdx(0);
    setBank(shuffle(p.slots.map((s) => s.w)));
    setPlaced(p.slots.map(() => null));
    setSelected(null);
    setSeconds(0);
    setRunning(true);
    setStatus("playing");
    setWrong(false);
    setNewBest(false);
  }, []);

  const pickWord = useCallback(
    (i: number) => {
      if (status !== "playing") return;
      setSelected((sel) => (sel === i ? null : i));
    },
    [status],
  );

  const place = useCallback(
    (r: number, c: number) => {
      if (status !== "playing" || selected === null) return;
      const word = bank[selected];
      const candidates = cellMap.get(`${r},${c}`);
      if (!candidates) {
        flashWrong();
        return;
      }
      let target = -1;
      for (let i = 0; i < candidates.length; i++) {
        const s = candidates[i];
        if (placed[s] === null && puzzle.slots[s].w.length === word.length) {
          target = s;
          break;
        }
      }
      if (target === -1 || puzzle.slots[target].w !== word) {
        flashWrong();
        return;
      }
      const next = placed.slice();
      next[target] = word;
      setPlaced(next);
      setSelected(null);
      if (next.every((x) => x !== null)) {
        const nextIdx = puzzleIdx + 1;
        if (nextIdx >= deck.length) {
          setRunning(false);
          setStatus("over");
          setNewBest(submit(seconds));
        } else {
          const np = BANK[deck[nextIdx]];
          setPuzzleIdx(nextIdx);
          setBank(shuffle(np.slots.map((s) => s.w)));
          setPlaced(np.slots.map(() => null));
          setSelected(null);
        }
      }
    },
    [status, selected, bank, cellMap, placed, puzzle, puzzleIdx, deck, seconds, submit, flashWrong],
  );

  const placedCount = placed.filter((x) => x !== null).length;

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={`${seconds}s`} best={best === null ? "—" : `${best}s`}>
        <span>
          Grid <b className="ml-1 text-sm text-ink">{Math.min(puzzleIdx + 1, PUZZLES_PER_RUN)}/{PUZZLES_PER_RUN}</b>
        </span>
        <span>
          <b className="ml-1 text-sm text-ink">{placedCount}</b> placed
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(16,185,129,0.7)] sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Pick a word, then tap where it fits
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {puzzle.slots.length - placedCount} left
          </span>
        </div>

        <div className="flex justify-center">
          <div
            className={cn("inline-grid gap-0.5 transition", wrong && "-translate-x-1")}
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
          >
            {Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols }, (_, c) => {
                const key = `${r},${c}`;
                if (puzzle.grid[r][c] === "#") {
                  return <div key={c} className="h-7 w-7 sm:h-8 sm:w-8" />;
                }
                const ch = board[r][c];
                const revealed = givenSet.has(key) || filledSet.has(key);
                return (
                  <button
                    key={c}
                    type="button"
                    onPointerUp={() => place(r, c)}
                    disabled={status !== "playing"}
                    aria-label={`cell ${r + 1} ${c + 1}`}
                    className={cn(
                      "h-7 w-7 rounded border text-sm font-bold uppercase transition select-none touch-none sm:h-8 sm:w-8",
                      revealed
                        ? "border-accent/50 bg-accent/10 text-ink"
                        : "border-line/60 bg-[#0b0b16] text-ink",
                      filledSet.has(key) && "animate-pop",
                      hintCells.has(key) && !revealed && "ring-1 ring-accent/60",
                      wrong && !revealed && "border-rose-400/70",
                    )}
                  >
                    {ch === "#" ? "" : ch}
                  </button>
                );
              }),
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {bank.map((word, i) => {
            const isUsed = usedWords.has(word);
            const isSel = selected === i;
            return (
              <button
                key={`${word}-${i}`}
                type="button"
                onPointerDown={(e) => {
                  // Release implicit (touch) capture so a drag can drop on a cell.
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                  pickWord(i);
                }}
                disabled={isUsed || status !== "playing"}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wide transition select-none touch-none",
                  isUsed
                    ? "border-line/40 bg-surface/40 text-muted/50 line-through"
                    : isSel
                      ? "scale-105 border-accent bg-accent/15 text-ink"
                      : "border-line bg-surface text-ink hover:border-accent/60 hover:bg-surface-2 active:scale-95",
                )}
              >
                {word}
              </button>
            );
          })}
        </div>

        {status === "idle" && (
          <Overlay>
            <p className="text-4xl">🧩</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              FIT EVERY WORD
            </p>
            <p className="mt-2 text-sm text-muted">
              Pick a word, then tap the row or column where it belongs — three grids, one shared clock. Wrong fits shake.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start fitting
            </PrimaryButton>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="text-4xl">🧩</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              ALL GRIDS FILLED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fastest time!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">
              {seconds}s
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : `${best}s`} · {PUZZLES_PER_RUN} grids · faster is better
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              New grids
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap a word, then tap its slot · crossing letters guide the fit · beat the clock
      </p>
    </div>
  );
}
