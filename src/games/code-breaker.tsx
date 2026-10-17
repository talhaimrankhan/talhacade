"use client";

import { useCallback, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

type Diff = "easy" | "hard";
type Fb = "black" | "white" | "empty";

const RULES: Record<Diff, { slots: number; colors: number; max: number }> = {
  easy: { slots: 4, colors: 6, max: 10 },
  hard: { slots: 5, colors: 8, max: 12 },
};

/** Literal Tailwind colors — up to eight code pegs. */
const COLORS = [
  "bg-rose-500 border-rose-700",
  "bg-cyan-400 border-cyan-600",
  "bg-emerald-500 border-emerald-700",
  "bg-amber-400 border-amber-600",
  "bg-violet-500 border-violet-700",
  "bg-sky-500 border-sky-700",
  "bg-fuchsia-500 border-fuchsia-700",
  "bg-lime-400 border-lime-600",
];

interface Guess {
  colors: number[];
  fb: Fb[];
}

function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeCode(slots: number, colors: number): number[] {
  const code: number[] = [];
  for (let i = 0; i < slots; i++) {
    code.push(Math.floor(Math.random() * colors));
  }
  return code;
}

/** Exact-match pegs first, then colour-only matches drawn from what's left. */
function scoreGuess(guess: number[], code: number[]) {
  let black = 0;
  let white = 0;
  const left: Record<number, number> = {};
  const need: Record<number, number> = {};
  for (let i = 0; i < code.length; i++) {
    if (guess[i] === code[i]) {
      black++;
    } else {
      need[code[i]] = (need[code[i]] ?? 0) + 1;
      left[guess[i]] = (left[guess[i]] ?? 0) + 1;
    }
  }
  for (const key of Object.keys(left)) {
    white += Math.min(left[Number(key)], need[Number(key)] ?? 0);
  }
  return { black, white };
}

export default function CodeBreaker({ gameId }: { gameId: string }) {
  const [diff, setDiff] = useState<Diff>("easy");
  const [code, setCode] = useState<number[]>(() =>
    makeCode(RULES.easy.slots, RULES.easy.colors),
  );
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [current, setCurrent] = useState<number[]>(() =>
    Array<number>(RULES.easy.slots).fill(-1),
  );
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [newBest, setNewBest] = useState(false);
  const easyBest = useBestScore(`${gameId}-easy`, "low");
  const hardBest = useBestScore(`${gameId}-hard`, "low");
  const { best, submit } = diff === "easy" ? easyBest : hardBest;

  const start = useCallback((d: Diff) => {
    const rules = RULES[d];
    setDiff(d);
    setCode(makeCode(rules.slots, rules.colors));
    setGuesses([]);
    setCurrent(Array<number>(rules.slots).fill(-1));
    setStatus("playing");
    setNewBest(false);
    setActive(0);
  }, []);

  const setSlot = useCallback(
    (i: number) => {
      if (status !== "playing") return;
      const colors = RULES[diff].colors;
      setCurrent((prev) =>
        prev.map((c, k) => {
          if (k !== i) return c;
          // Re-tapping the active colour cycles the slot onward.
          return c === active ? (c + 1) % colors : active;
        }),
      );
    },
    [status, diff, active],
  );

  const check = useCallback(() => {
    if (status !== "playing") return;
    const rules = RULES[diff];
    if (current.some((c) => c < 0)) return;

    const { black, white } = scoreGuess(current, code);
    // Randomised order so the pegs never give away which slot matched.
    const fb = shuffle<Fb>([
      ...Array<Fb>(black).fill("black"),
      ...Array<Fb>(white).fill("white"),
      ...Array<Fb>(rules.slots - black - white).fill("empty"),
    ]);
    const next = [...guesses, { colors: current, fb }];
    setGuesses(next);
    setCurrent(Array<number>(rules.slots).fill(-1));

    if (black === rules.slots) {
      setStatus("won");
      setNewBest(submit(next.length));
    } else if (next.length >= rules.max) {
      setStatus("lost");
    }
  }, [status, current, code, guesses, diff, submit]);

  const rules = RULES[diff];
  const filled = current.every((c) => c >= 0);
  const revealed = status !== "playing";
  const rowsLeft = Math.max(rules.max - guesses.length - (revealed ? 0 : 1), 0);

  return (
    <div className="w-full max-w-[440px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Guess{" "}
          <b className="ml-1 text-sm text-ink tabular-nums">
            {Math.min(guesses.length + 1, rules.max)}/{rules.max}
          </b>
        </span>
        <span className="flex items-center gap-3">
          <span className="text-warn">
            Best{" "}
            <b className="ml-1 text-sm text-ink tabular-nums">
              {best === null ? "—" : best}
            </b>
          </span>
          <button
            type="button"
            onClick={() => start("easy")}
            aria-pressed={diff === "easy"}
            className={cn(
              "rounded-md border px-2 py-1 transition",
              diff === "easy"
                ? "border-primary bg-primary/20 text-ink"
                : "border-line text-muted hover:border-primary/60 hover:text-ink",
            )}
          >
            Easy
          </button>
          <button
            type="button"
            onClick={() => start("hard")}
            aria-pressed={diff === "hard"}
            className={cn(
              "rounded-md border px-2 py-1 transition",
              diff === "hard"
                ? "border-primary bg-primary/20 text-ink"
                : "border-line text-muted hover:border-primary/60 hover:text-ink",
            )}
          >
            Hard
          </button>
        </span>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(251,191,36,0.45)] sm:p-4">
        {/* The secret, covered until the round ends. */}
        <div className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-line bg-[#0d0d18] px-3 py-2">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            Code
          </span>
          {code.map((c, i) => (
            <span
              key={i}
              aria-label={revealed ? `Secret peg ${i + 1}` : "Covered peg"}
              className={cn(
                "h-6 w-6 rounded-full border-2",
                revealed ? COLORS[c] : "border-line bg-[#1c1c33]",
              )}
            />
          ))}
        </div>

        <div className="grid gap-1.5">
          {guesses.map((guess, row) => (
            <div
              key={row}
              className="flex items-center justify-center gap-2 rounded-lg border border-transparent px-2 py-1"
            >
              <span className="w-5 font-mono text-[10px] text-muted tabular-nums">
                {row + 1}
              </span>
              {guess.colors.map((c, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 sm:h-7 sm:w-7",
                    COLORS[c],
                  )}
                />
              ))}
              <span className="ml-1 flex w-14 flex-wrap items-center justify-center gap-1">
                {guess.fb.map((f, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-2.5 w-2.5 rounded-full border",
                      f === "black"
                        ? "border-white/30 bg-[#0b0b14]"
                        : f === "white"
                          ? "border-white bg-white"
                          : "border-line bg-transparent",
                    )}
                  />
                ))}
              </span>
            </div>
          ))}

          {!revealed && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1">
              <span className="w-5 font-mono text-[10px] text-muted tabular-nums">
                {guesses.length + 1}
              </span>
              {current.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSlot(i)}
                  aria-label={`Set guess slot ${i + 1}`}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition hover:scale-110 sm:h-7 sm:w-7",
                    c < 0
                      ? "border-dashed border-line bg-[#15152a] text-[10px] text-muted"
                      : COLORS[c],
                  )}
                >
                  {c < 0 ? "?" : ""}
                </button>
              ))}
            </div>
          )}

          {Array.from({ length: rowsLeft }, (_, i) => (
            <div
              key={`pad-${i}`}
              aria-hidden
              className="flex items-center justify-center gap-2 px-2 py-1 opacity-40"
            >
              <span className="w-5 font-mono text-[10px] text-muted" />
              {Array.from({ length: rules.slots }, (_, k) => (
                <span
                  key={k}
                  className="h-6 w-6 rounded-full border-2 border-dashed border-line/70 sm:h-7 sm:w-7"
                />
              ))}
            </div>
          ))}
        </div>

        {status === "playing" && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {Array.from({ length: rules.colors }, (_, c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActive(c)}
                aria-label={`Choose colour ${c + 1}`}
                aria-pressed={active === c}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition",
                  COLORS[c],
                  active === c
                    ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#15152a]"
                    : "hover:scale-105",
                )}
              />
            ))}
            <button
              type="button"
              onClick={check}
              disabled={!filled}
              className="ml-1 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 px-4 py-2 text-xs font-bold text-black transition hover:brightness-110 active:scale-95 disabled:opacity-40"
            >
              Submit
            </button>
          </div>
        )}

        {status !== "playing" && (
          <Overlay>
            <p className="text-4xl">{status === "won" ? "🔑" : "🔒"}</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              {status === "won" ? "CODE CRACKED" : "CODE LOCKED"}
            </p>
            {status === "won" && newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fewest guesses!
              </p>
            )}
            <p className="mt-3 font-mono text-3xl font-bold text-white tabular-nums">
              {status === "won"
                ? `${guesses.length} guesses`
                : `${rules.max} guesses used`}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : best} · {diff} mode
            </p>
            <PrimaryButton
              onClick={() => start(diff)}
              tone="from-amber-400 via-orange-500 to-red-500"
            >
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap a swatch, then tap a slot · black = right colour right spot ·
        white = right colour wrong spot · {rules.max} guesses
      </p>
    </div>
  );
}
