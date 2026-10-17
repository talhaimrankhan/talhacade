"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

/* ------------------------------------------------------------------ */
/* Puzzle library — groups ordered easiest (amber) → devious (violet)   */
/* ------------------------------------------------------------------ */

interface Group {
  name: string;
  words: string[];
}

interface PuzzleData {
  groups: Group[];
}

const PUZZLES: PuzzleData[] = [
  {
    groups: [
      { name: "Chess pieces", words: ["BISHOP", "KNIGHT", "ROOK", "PAWN"] },
      { name: "Types of pie", words: ["APPLE", "PUMPKIN", "CHERRY", "BLUEBERRY"] },
      { name: "___ fish", words: ["CLOWN", "ANGEL", "STAR", "CATFISH"] },
      { name: "___ party", words: ["BLOCK", "DANCE", "SEARCH", "GARDEN"] },
    ],
  },
  {
    groups: [
      { name: "Types of tea", words: ["GREEN", "OOLONG", "JASMINE", "PEKOE"] },
      { name: "Things with keys", words: ["PIANO", "LOCK", "KEYBOARD", "MAP"] },
      { name: "___ ball", words: ["BASE", "EYE", "FOOT", "VOLLEY"] },
      { name: "Casino card games", words: ["POKER", "BLACKJACK", "BACCARAT", "BRIDGE"] },
    ],
  },
  {
    groups: [
      { name: "Farm animals", words: ["GOAT", "SHEEP", "PIG", "DONKEY"] },
      { name: "Cinema terms", words: ["REEL", "TAKE", "CUT", "WRAP"] },
      { name: "Types of cloud", words: ["CUMULUS", "STRATUS", "CIRRUS", "NIMBUS"] },
      { name: "Types of sword", words: ["RAPIER", "SCIMITAR", "CUTLASS", "CLAYMORE"] },
    ],
  },
  {
    groups: [
      { name: "Breakfast foods", words: ["TOAST", "OMELET", "CEREAL", "BACON"] },
      { name: "Parts of a car", words: ["ENGINE", "BUMPER", "HUBCAP", "AXLE"] },
      { name: "Types of jacket", words: ["BOMBER", "DENIM", "LEATHER", "WINDBREAKER"] },
      { name: "___ storm", words: ["BRAIN", "DUST", "FIRE", "SNOW"] },
    ],
  },
  {
    groups: [
      { name: "Units of length", words: ["INCH", "FOOT", "YARD", "MILE"] },
      { name: "Parts of a plant", words: ["STEM", "ROOT", "LEAF", "BLOOM"] },
      { name: "Nautical terms", words: ["KNOT", "STERN", "KEEL", "PORT"] },
      { name: "After 'fire'", words: ["FIGHTER", "POWER", "WORKS", "FLY"] },
    ],
  },
  {
    groups: [
      { name: "Types of bread", words: ["SOURDOUGH", "RYE", "BAGUETTE", "PITA"] },
      { name: "Math terms", words: ["SUM", "PRODUCT", "DIFFERENCE", "FRACTION"] },
      { name: "Types of cake", words: ["ANGEL", "CARROT", "SPONGE", "LAYER"] },
      { name: "After 'brain'", words: ["WAVE", "DRAIN", "STORM", "POWER"] },
    ],
  },
  {
    groups: [
      { name: "Types of hat", words: ["FEDORA", "BEANIE", "BOWLER", "STETSON"] },
      { name: "Music genres", words: ["JAZZ", "BLUES", "TECHNO", "GOSPEL"] },
      { name: "Cuts of steak", words: ["SIRLOIN", "RIBEYE", "TENDERLOIN", "FILET"] },
      { name: "After 'night'", words: ["CLUB", "MARE", "GOWN", "CAP"] },
    ],
  },
  {
    groups: [
      { name: "Ocean creatures", words: ["WHALE", "DOLPHIN", "SHARK", "OCTOPUS"] },
      { name: "Greek letters", words: ["ALPHA", "BETA", "GAMMA", "DELTA"] },
      { name: "Types of bridge", words: ["SUSPENSION", "ARCH", "TRUSS", "CAISSON"] },
      { name: "After 'moon'", words: ["WALK", "LIGHT", "STONE", "RISE"] },
    ],
  },
  {
    groups: [
      { name: "Types of pasta", words: ["SPAGHETTI", "PENNE", "RAVIOLI", "LASAGNA"] },
      { name: "Weather words", words: ["DRIZZLE", "SLEET", "HAIL", "FROST"] },
      { name: "Types of cheese", words: ["CHEDDAR", "GOUDA", "BRIE", "FETA"] },
      { name: "After 'snow'", words: ["BALL", "PLOW", "FLAKE", "BANK"] },
    ],
  },
  {
    groups: [
      { name: "Types of tree", words: ["OAK", "MAPLE", "BIRCH", "ELM"] },
      { name: "Types of shoe", words: ["SNEAKER", "LOAFER", "OXFORD", "STILETTO"] },
      { name: "After 'dream'", words: ["CATCHER", "TEAM", "HOUSE", "JOB"] },
      { name: "Types of bean", words: ["KIDNEY", "NAVY", "LIMA", "PINTO"] },
    ],
  },
  {
    groups: [
      { name: "Types of gem", words: ["DIAMOND", "RUBY", "EMERALD", "SAPPHIRE"] },
      { name: "Types of snake", words: ["COBRA", "VIPER", "PYTHON", "ADDER"] },
      { name: "Before 'man'", words: ["BAT", "SUPER", "FISHER", "SNOW"] },
      { name: "After 'heart'", words: ["ATTACK", "BREAK", "BEAT", "THROB"] },
    ],
  },
  {
    groups: [
      { name: "Types of soup", words: ["CHOWDER", "BISQUE", "BROTH", "GUMBO"] },
      { name: "Instruments", words: ["TRUMPET", "VIOLIN", "FLUTE", "CLARINET"] },
      { name: "Types of wine", words: ["MERLOT", "CABERNET", "CHARDONNAY", "PINOT"] },
      { name: "After 'head'", words: ["LIGHT", "BAND", "LINE", "START"] },
    ],
  },
];

/** Straightforward → devious. */
const TIERS = [
  "border-amber-400/60 bg-amber-400/20 text-amber-100",
  "border-emerald-400/60 bg-emerald-400/20 text-emerald-100",
  "border-sky-400/60 bg-sky-400/20 text-sky-100",
  "border-violet-400/60 bg-violet-400/20 text-violet-100",
];

const BAR_TEXT = [
  "text-amber-300",
  "text-emerald-300",
  "text-sky-300",
  "text-violet-300",
];

interface Round {
  idx: number;
  words: string[];
}

function shuffle(list: string[]): string[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Random new puzzle, never the same board twice in a row. */
function makeRound(exclude: number): Round {
  let idx = Math.floor(Math.random() * PUZZLES.length);
  if (idx === exclude) idx = (idx + 1) % PUZZLES.length;
  return {
    idx,
    words: shuffle(PUZZLES[idx].groups.flatMap((g) => g.words)),
  };
}

const SHAKE_STEPS = [7, -7, 4, -3, 0];

export default function Connections({ gameId }: { gameId: string }) {
  const [round, setRound] = useState<Round>(() => makeRound(-1));
  const [selection, setSelection] = useState<string[]>([]);
  const [found, setFound] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [nudge, setNudge] = useState(0);
  const [streak, setStreak] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const shakeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearShake = useCallback(() => {
    shakeTimers.current.forEach((t) => clearTimeout(t));
    shakeTimers.current = [];
  }, []);

  useEffect(() => clearShake, [clearShake]);

  const shake = useCallback(() => {
    clearShake();
    SHAKE_STEPS.forEach((step, i) => {
      shakeTimers.current.push(setTimeout(() => setNudge(step), i * 65));
    });
  }, [clearShake]);

  const puzzle = PUZZLES[round.idx];
  const remaining = round.words.filter(
    (w) => !puzzle.groups.some((g) => g.words.includes(w) && found.includes(puzzle.groups.indexOf(g))),
  );

  const toggle = useCallback(
    (word: string) => {
      if (status !== "playing") return;
      setSelection((sel) =>
        sel.includes(word)
          ? sel.filter((w) => w !== word)
          : sel.length >= 4
            ? sel
            : [...sel, word],
      );
    },
    [status],
  );

  const nearMiss =
    status === "playing" &&
    selection.length === 4 &&
    puzzle.groups.some(
      (g, i) => !found.includes(i) && g.words.filter((w) => selection.includes(w)).length === 3,
    );

  const check = useCallback(() => {
    if (status !== "playing" || selection.length !== 4) return;
    const groups = PUZZLES[round.idx].groups;
    const hit = groups.findIndex(
      (g, i) => !found.includes(i) && g.words.every((w) => selection.includes(w)),
    );

    if (hit >= 0) {
      const nextFound = [...found, hit];
      setFound(nextFound);
      setSelection([]);
      if (nextFound.length === groups.length) {
        setStatus("won");
        const next = streak + 1;
        setStreak(next);
        setNewBest(submit(next));
      }
      return;
    }

    const nextMistakes = mistakes + 1;
    setMistakes(nextMistakes);
    setSelection([]);
    shake();
    if (nextMistakes >= 4) {
      setStatus("lost");
      setStreak(0);
    }
  }, [status, selection, round.idx, found, streak, submit, mistakes, shake]);

  const nextPuzzle = useCallback(() => {
    clearShake();
    setRound((prev) => makeRound(prev.idx));
    setSelection([]);
    setFound([]);
    setMistakes(0);
    setNewBest(false);
    setStatus("playing");
  }, [clearShake]);

  return (
    <div className="w-full max-w-[460px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Streak <b className="ml-1 text-sm text-ink">{streak}</b>
        </span>
        <div className="flex items-center gap-3">
          <span className={mistakes > 0 ? "text-rose-400" : "text-success"}>
            Mistakes{" "}
            <b className="ml-1 text-sm text-ink">
              {Array.from({ length: 4 }, (_, i) => (i < mistakes ? "✕" : "○")).join("")}
            </b>
          </span>
          <span className="text-warn">
            Best <b className="ml-1 text-sm text-ink">{best ?? "—"}</b>
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(168,85,247,0.8)]">
        {/* found group bars */}
        <div className="mb-3 grid gap-1.5">
          {TIERS.map((tier, i) => {
            const isFound = found.includes(i);
            const group = puzzle.groups[i];
            return (
              <div
                key={group.name}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-1.5 transition",
                  isFound ? tier : "border-line bg-[#131322]",
                )}
              >
                <span
                  className={cn(
                    "font-mono text-[10px] font-bold uppercase tracking-widest",
                    isFound ? BAR_TEXT[i] : "text-muted/50",
                  )}
                >
                  {isFound ? group.name : "· · · ·"}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-semibold tracking-wide",
                    isFound ? "text-ink" : "text-muted/30",
                  )}
                >
                  {isFound ? group.words.join("  ") : "□ □ □ □"}
                </span>
              </div>
            );
          })}
        </div>

        {/* word grid */}
        <div
          className="grid grid-cols-4 gap-1.5 transition-transform duration-100"
          style={{ transform: nudge ? `translateX(${nudge}px)` : undefined }}
        >
          {remaining.map((word) => {
            const picked = selection.includes(word);
            return (
              <button
                key={word}
                type="button"
                onClick={() => toggle(word)}
                aria-label={`Word ${word}${picked ? ", selected" : ""}`}
                aria-pressed={picked}
                className={cn(
                  "rounded-lg border px-1 py-2.5 font-display text-[11px] font-bold tracking-wide transition sm:text-xs",
                  picked
                    ? "border-cyan-400 bg-cyan-400/20 text-cyan-100 shadow-[0_0_18px_-6px_rgba(34,211,238,0.9)]"
                    : "border-line bg-[#131322] text-ink hover:border-primary/60 hover:bg-[#1b1b33]",
                )}
              >
                {word}
              </button>
            );
          })}
        </div>

        {/* actions */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={nextPuzzle}
            aria-label="New puzzle"
            className="rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
          >
            ⟳ New puzzle
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-muted">
              {selection.length}/4 picked
            </span>
            <button
              type="button"
              onClick={check}
              disabled={selection.length !== 4 || status !== "playing"}
              aria-label="Check the selected four words"
              className="rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 px-5 py-1.5 text-xs font-bold text-black transition hover:brightness-110 active:scale-95 disabled:opacity-35"
            >
              Check
            </button>
          </div>
        </div>

        {nearMiss && (
          <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-warn">
            One away…
          </p>
        )}

        {status === "won" && (
          <Overlay>
            <p className="text-4xl">🎉</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              PUZZLE SOLVED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best streak!
              </p>
            )}
            <p className="mt-3 font-mono text-3xl font-bold text-white">{streak} in a row</p>
            <p className="text-xs uppercase tracking-widest text-muted">Best {best ?? "—"}</p>
            <PrimaryButton onClick={nextPuzzle} tone="from-violet-500 via-purple-500 to-fuchsia-500">
              Next puzzle
            </PrimaryButton>
          </Overlay>
        )}

        {status === "lost" && (
          <Overlay>
            <p className="text-4xl">💀</p>
            <p className="mt-2 font-display text-2xl font-bold text-rose-400">RUN OVER</p>
            <div className="mx-auto mt-3 grid max-w-[340px] gap-1 text-left">
              {puzzle.groups.map((g, i) => (
                <div
                  key={g.name}
                  className={`rounded-lg border px-2.5 py-1 ${TIERS[i]}`}
                >
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest">
                    {g.name}
                  </span>
                  <span className="ml-2 text-[11px] font-semibold">{g.words.join(" ")}</span>
                </div>
              ))}
            </div>
            <PrimaryButton onClick={nextPuzzle} tone="from-slate-400 via-zinc-500 to-neutral-700">
              Try another
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Pick four words that share a theme · four misses ends the streak
      </p>
    </div>
  );
}
