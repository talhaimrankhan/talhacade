"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const SIZE = 10;
const WORDS_PER_ROUND = 8;
const ROUNDS = 3;
const TONE = "from-teal-400 via-cyan-500 to-sky-600";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const BANK = (
  "APPLE BEACH BREAD BRICK BRING BRUSH CABLE CAMEL CANDY CARRY CHAIR CHARM CHASE CHEAP CHECK " +
  "CHEST CHIEF CHILD CHUNK CIRCLE CLEAN CLEAR CLIMB CLOCK CLOUD COAST CORAL COUNT COURT COVER " +
  "CRAFT CRANE CRASH CREAM CREEK CRISP CROWN DANCE DIARY DREAM DRINK DRIVE EAGLE EARTH FAIRY " +
  "FIELD FLAME FLOOR FLOWER FRAME FRESH FRUIT GHOST GIANT GLASS GLOBE GLOVE GRACE GRAIN GRASS " +
  "GREAT GREEN GRILL GROUP GUARD HONEY HORSE HOUSE HUMAN IDEAL IMAGE IVORY JELLY JUICE KNIGHT " +
  "LADDER LEMON LIGHT LIZARD MAGIC MANGO MELON MERCY METER MIRROR MONEY MONTH MOUSE MUSIC NIGHT " +
  "NOISE OCEAN OLIVE ORBIT ORGAN PAINT PAPER PARTY PASTA PEACH PEARL PIANO PILLOW PLANET PLATE " +
  "QUEST QUICK QUIET RADIO RAISE RIVER ROAST ROBOT ROUND ROUTE ROYAL SCALE SCENE SCORE SHELL " +
  "SHORE SIGHT SKILL SMILE SNAKE SOLAR SOUND SPACE SPARK SPICE STONE STORM STORY SUGAR TABLE " +
  "TIGER TOAST TOKEN TOWER TRAIN TREAT TRIAL TRUNK TURTLE UNION VALID VALUE VIDEO WATER WHEAT " +
  "WHEEL WORLD YEAST ZEBRA ANCHOR BASKET BEAVER BERRY BLANK BLOOM BONUS BRANCH BREEZE BRIDGE " +
  "BROOM BUCKET BUNNY BUTTON CACTUS CAMERA CANDLE CARPET CAVES CELERY CHERRY CLIFF CLOVER COBRA " +
  "COMET COPPER CORNER COTTON CRADLE DOLPHIN DONUT DRAGON ENGINE FABLE FEATHER FINGER FJORD " +
  "FLASK FLUTE FOXES FROST FUTURE GARDEN GARNET GATEWAY GECKO GINGER GLIDER HAMMER HARVEST " +
  "HARBOR HOLLOW IGLOO ISLAND JACKET JAGUAR JAZZED JUNGLE KETTLE KIWI LANTERN LEAFY LIBRARY " +
  "LION LYNX MARBLE MEADOW MEDAL MELTED MONKEY MOON NATURE NINJA NOODLE NUZZLE OASIS OTTER " +
  "OXEN PANDA PEBBLE PENCIL PENGUIN PEPPER PHOENIX PIRATE PIZZA PLAZA POCKET POLAR POND PORCH " +
  "POSSUM PRISM PUPPY QUEEN QUARTZ RABBIT RACCOON RAINY ROCKET RUBBER SAFARI SCARF SCOUT " +
  "SEASHELL SHADOW SHIP SIEGE SKATES SKULL SLEIGH SLOTH SMITH SPIDER SPONGE SQUID STAMP " +
  "STAPLE STOVE STRAW SUMMER SUNSET SWAMP SWEATER TEMPLE THUNDER TOFU TOMATO TORCH TOWEL " +
  "TRACTOR TROPHY ULTRA VALLEY VELVET WALNUT WALRUS WINTER WIZARD ZEPHYR ZIGZAG"
).split(" ");

/** Eight directions — every one of them, reversed included. */
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

const EMPTY_GRID: string[] = Array<string>(SIZE * SIZE).fill("");
const EMPTY_PUZZLE: Puzzle = { grid: EMPTY_GRID, placements: [] };

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

function placeWord(grid: string[], word: string): number[] | null {
  for (let t = 0; t < 400; t++) {
    const r = Math.floor(Math.random() * SIZE);
    const c = Math.floor(Math.random() * SIZE);
    const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    const dr = dir[0];
    const dc = dir[1];
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

    for (let k = 0; k < cells.length; k++) {
      grid[cells[k]] = word[k];
    }
    return cells;
  }
  return null;
}

/** Builds a full round; retries until all eight words land. */
function makePuzzle(): Puzzle {
  for (let attempt = 0; attempt < 24; attempt++) {
    const grid = Array<string>(SIZE * SIZE).fill("");
    const placements: Placement[] = [];
    const picks = shuffle(BANK);

    for (let i = 0; i < picks.length && placements.length < WORDS_PER_ROUND; i++) {
      const cells = placeWord(grid, picks[i]);
      if (cells) placements.push({ word: picks[i], cells });
    }

    if (placements.length < WORDS_PER_ROUND) continue;

    // Decoy letters, mostly pulled from the words themselves.
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
  return EMPTY_PUZZLE;
}

/** Cells on the straight span from start to end, or null if it is crooked. */
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

type Status = "idle" | "playing" | "won";

export default function LetterGrid() {
  const [status, setStatus] = useState<Status>("idle");
  const [round, setRound] = useState(1);
  const [puzzle, setPuzzle] = useState<Puzzle>(EMPTY_PUZZLE);
  const [found, setFound] = useState<string[]>([]);
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [jitter, setJitter] = useState(0);
  const { best, submit } = useBestScore("letter-grid", "low");

  const gridRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const selRef = useRef<{ start: number; end: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (let i = 0; i < timers.current.length; i++) clearTimeout(timers.current[i]);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // The clock runs until the third grid is cleared.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const shake = useCallback(() => {
    clearTimers();
    const offsets = [-8, 8, -5, 5, 0];
    for (let i = 0; i < offsets.length; i++) {
      const dx = offsets[i];
      timers.current.push(setTimeout(() => setJitter(dx), i * 55));
    }
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    setRound(1);
    setPuzzle(makePuzzle());
    setFound([]);
    setSel(null);
    selRef.current = null;
    setSeconds(0);
    setRunning(true);
    setStatus("playing");
    setNewBest(false);
    setJitter(0);
  }, [clearTimers]);

  const cellFromPoint = (x: number, y: number): number | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cell = rect.width / SIZE;
    const r = Math.floor((y - rect.top) / cell);
    const c = Math.floor((x - rect.left) / cell);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
    return r * SIZE + c;
  };

  const commit = useCallback(
    (selection: { start: number; end: number }) => {
      const cells = lineCells(selection.start, selection.end);
      if (!cells) {
        shake();
        return;
      }
      const word = cells.map((i) => puzzle.grid[i]).join("");
      const reversed = [...word].reverse().join("");
      const hit = puzzle.placements.find((p) => p.word === word || p.word === reversed);
      if (!hit || found.includes(hit.word)) {
        shake();
        return;
      }

      const next = [...found, hit.word];
      setFound(next);
      if (next.length < puzzle.placements.length) return;

      if (round >= ROUNDS) {
        setRunning(false);
        setStatus("won");
        setNewBest(submit(seconds));
      } else {
        setRound(round + 1);
        setPuzzle(makePuzzle());
        setFound([]);
      }
    },
    [puzzle, found, round, seconds, shake, submit],
  );

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

  const trail = sel ? lineCells(sel.start, sel.end) : null;
  const trailSet = new Set(trail ?? []);
  const foundCells = new Set(
    puzzle.placements.filter((p) => found.includes(p.word)).flatMap((p) => p.cells),
  );
  const first = trail ? trail[0] : -1;
  const last = trail ? trail[trail.length - 1] : -1;

  return (
    <div className="w-full max-w-[600px]">
      <GameHud
        score={formatTime(seconds)}
        best={best === null ? "—" : `${best}s`}
      >
        <span>
          Grid <b className="ml-1 text-sm text-ink">{Math.min(round, ROUNDS)}/{ROUNDS}</b>
        </span>
        <span className="text-accent">
          Found <b className="ml-1 text-sm text-ink">{found.length}/{WORDS_PER_ROUND}</b>
        </span>
      </GameHud>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1 rounded-2xl border border-line bg-surface-2 p-2.5 shadow-[0_0_60px_-24px_rgba(56,189,248,0.6)]">
          <div
            ref={gridRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            role="application"
            aria-label="Word search grid. Drag from a word&apos;s first letter to its last."
            className="grid aspect-square w-full grid-cols-10 grid-rows-10 touch-none border-t border-l border-line/60 transition-transform duration-75 select-none"
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
                    foundCells.has(i) && "bg-sky-500/25 text-ink/70",
                    onTrail && !isEnd && "bg-sky-500/40 text-ink",
                    isEnd && "bg-sky-500/70 text-black",
                  )}
                >
                  {letter}
                </div>
              );
            })}
          </div>

          {status === "idle" && (
            <Overlay>
              <p className="text-4xl">🔍</p>
              <p className="mt-2 font-display text-2xl font-bold text-gradient">
                FIND EIGHT, THREE TIMES
              </p>
              <p className="mt-2 text-sm text-muted">
                Drag across each hidden word — they run in all eight directions, backwards included.
              </p>
              <PrimaryButton onClick={start} tone={TONE}>
                Start hunt
              </PrimaryButton>
            </Overlay>
          )}

          {status === "won" && (
            <Overlay>
              <p className="text-4xl">🏁</p>
              <p className="mt-2 font-display text-2xl font-bold text-gradient">
                ALL THREE GRIDS CLEARED
              </p>
              {newBest && (
                <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                  ✦ New fastest time!
                </p>
              )}
              <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">
                {formatTime(seconds)}
              </p>
              <p className="text-xs uppercase tracking-widest text-muted">
                Best {best === null ? "—" : `${best}s`}
              </p>
              <PrimaryButton onClick={start} tone={TONE}>
                New run
              </PrimaryButton>
            </Overlay>
          )}
        </div>

        <div className="sm:w-44">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
            Round {Math.min(round, ROUNDS)} · find them all
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
            {puzzle.placements.length === 0 && (
              <span className="text-xs text-muted">Start a run to reveal the list.</span>
            )}
          </div>

          <button
            type="button"
            onClick={start}
            className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2"
          >
            New run
          </button>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Drag from the first letter to the last · three grids, one shared clock
      </p>
    </div>
  );
}
