"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

type CatId =
  | "ones"
  | "twos"
  | "threes"
  | "fours"
  | "fives"
  | "sixes"
  | "three"
  | "four"
  | "full"
  | "small"
  | "large"
  | "yahtzee"
  | "chance";

type Scores = Record<CatId, number | null>;

interface Category {
  id: CatId;
  name: string;
}

const FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const DICE = 5;
const MAX_ROLLS = 3;
const EMPTY_HAND = [false, false, false, false, false];

const UPPER: CatId[] = ["ones", "twos", "threes", "fours", "fives", "sixes"];

const CATEGORIES: Category[] = [
  { id: "ones", name: "Ones" },
  { id: "twos", name: "Twos" },
  { id: "threes", name: "Threes" },
  { id: "fours", name: "Fours" },
  { id: "fives", name: "Fives" },
  { id: "sixes", name: "Sixes" },
  { id: "three", name: "Three of a kind" },
  { id: "four", name: "Four of a kind" },
  { id: "full", name: "Full house" },
  { id: "small", name: "Small straight" },
  { id: "large", name: "Large straight" },
  { id: "yahtzee", name: "Yahtzee" },
  { id: "chance", name: "Chance" },
];

function emptyScores(): Scores {
  return {
    ones: null,
    twos: null,
    threes: null,
    fours: null,
    fives: null,
    sixes: null,
    three: null,
    four: null,
    full: null,
    small: null,
    large: null,
    yahtzee: null,
    chance: null,
  };
}

function randomDice(): number[] {
  return Array.from({ length: DICE }, () => 1 + Math.floor(Math.random() * 6));
}

function counts(dice: number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const v of dice) c[v] += 1;
  return c;
}

function longestRun(dice: number[]): number {
  const uniq = [...new Set(dice)].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < uniq.length; i++) {
    if (uniq[i] === uniq[i - 1] + 1) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

/** What this dice hand is worth in that category right now. */
function scoreCat(id: CatId, dice: number[]): number {
  const c = counts(dice);
  const sum = dice.reduce((a, b) => a + b, 0);
  switch (id) {
    case "ones":
      return c[1];
    case "twos":
      return c[2] * 2;
    case "threes":
      return c[3] * 3;
    case "fours":
      return c[4] * 4;
    case "fives":
      return c[5] * 5;
    case "sixes":
      return c[6] * 6;
    case "three":
      return c.some((n) => n >= 3) ? sum : 0;
    case "four":
      return c.some((n) => n >= 4) ? sum : 0;
    case "full":
      return c.includes(3) && c.includes(2) ? 25 : 0;
    case "small":
      return longestRun(dice) >= 4 ? 30 : 0;
    case "large":
      return longestRun(dice) >= 5 ? 40 : 0;
    case "yahtzee":
      return c.some((n) => n === DICE) ? 50 : 0;
    case "chance":
      return sum;
  }
}

function upperSum(scores: Scores): number {
  return UPPER.reduce((total, id) => total + (scores[id] ?? 0), 0);
}

function finalTotal(scores: Scores): number {
  const filled = CATEGORIES.reduce(
    (total, cat) => total + (scores[cat.id] ?? 0),
    0,
  );
  return filled + (upperSum(scores) >= 63 ? 35 : 0);
}

type Phase = "idle" | "playing" | "over";

export default function DiceKings({ gameId }: { gameId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [dice, setDice] = useState<number[]>(() => randomDice());
  const [held, setHeld] = useState<boolean[]>(EMPTY_HAND);
  const [rollsUsed, setRollsUsed] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [scores, setScores] = useState<Scores>(emptyScores);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const diceRef = useRef<number[]>(dice);
  const heldRef = useRef<boolean[]>(EMPTY_HAND);

  // spin animation: random values on a timer, final faces on the last tick
  useEffect(() => {
    if (!rolling) return;

    const spin = setInterval(() => {
      diceRef.current = diceRef.current.map((v, i) =>
        heldRef.current[i] ? v : 1 + Math.floor(Math.random() * 6),
      );
      setDice([...diceRef.current]);
    }, 75);

    const stop = setTimeout(() => {
      clearInterval(spin);
      diceRef.current = diceRef.current.map((v, i) =>
        heldRef.current[i] ? v : 1 + Math.floor(Math.random() * 6),
      );
      setDice([...diceRef.current]);
      setRolling(false);
      setRollsUsed((r) => Math.min(MAX_ROLLS, r + 1));
    }, 520);

    return () => {
      clearInterval(spin);
      clearTimeout(stop);
    };
  }, [rolling]);

  const start = useCallback(() => {
    diceRef.current = randomDice();
    heldRef.current = [...EMPTY_HAND];
    setDice([...diceRef.current]);
    setHeld([...EMPTY_HAND]);
    setRollsUsed(0);
    setRolling(false);
    setScores(emptyScores());
    setNewBest(false);
    setPhase("playing");
  }, []);

  const roll = () => {
    if (phase !== "playing" || rolling || rollsUsed >= MAX_ROLLS) return;
    if (heldRef.current.every(Boolean)) return;
    setRolling(true);
  };

  const toggleHold = (index: number) => {
    if (phase !== "playing" || rolling || rollsUsed === 0) return;
    heldRef.current = heldRef.current.map((h, i) =>
      i === index ? !h : h,
    );
    setHeld([...heldRef.current]);
  };

  const pick = (id: CatId) => {
    if (phase !== "playing" || rolling || rollsUsed === 0) return;
    if (scores[id] !== null) return;

    const next: Scores = { ...scores, [id]: scoreCat(id, diceRef.current) };
    setScores(next);
    heldRef.current = [...EMPTY_HAND];
    setHeld([...EMPTY_HAND]);
    setRollsUsed(0);

    if (CATEGORIES.every((cat) => next[cat.id] !== null)) {
      setNewBest(submit(finalTotal(next)));
      setPhase("over");
    }
  };

  const total = finalTotal(scores);
  const bonusReady = upperSum(scores) >= 63;
  const canRoll =
    phase === "playing" &&
    !rolling &&
    rollsUsed < MAX_ROLLS &&
    !held.every(Boolean);

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={total} best={best ?? "—"}>
        <span className="text-cyan-400">
          Rolls{" "}
          <b className="ml-1 text-sm text-ink">
            {MAX_ROLLS - rollsUsed}
          </b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(34,211,238,0.7)]">
        {/* dice */}
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {dice.map((value, i) => (
            <button
              key={`${i}-${value}`}
              type="button"
              onClick={() => toggleHold(i)}
              aria-label={`Die ${i + 1}: ${value}${
                held[i] ? ", held" : ", tap to hold"
              }`}
              aria-pressed={held[i]}
              className={`animate-pop grid aspect-square w-[16%] min-w-[52px] place-items-center rounded-xl border-2 text-4xl leading-none transition sm:text-5xl ${
                held[i]
                  ? "border-cyan-400 bg-cyan-500/15 text-cyan-300 shadow-[0_0_20px_-4px_rgba(34,211,238,0.95)]"
                  : "border-line bg-surface text-ink hover:border-cyan-400/50"
              }`}
            >
              <span aria-hidden="true">{FACES[value - 1]}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={roll}
            disabled={!canRoll}
            className="rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 px-8 py-2 font-display text-sm font-bold text-black transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {rolling ? "Rolling…" : rollsUsed === 0 ? "Roll dice" : "Re-roll"}
          </button>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
            {rollsUsed === 0
              ? "Roll first"
              : `${MAX_ROLLS - rollsUsed} rolls left`}
          </span>
        </div>

        {/* category grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const locked = scores[cat.id] !== null;
            const preview =
              rollsUsed === 0 ? "—" : scoreCat(cat.id, dice);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => pick(cat.id)}
                disabled={locked || phase !== "playing" || rollsUsed === 0}
                aria-label={
                  locked
                    ? `${cat.name}: ${scores[cat.id]} points, locked`
                    : `Lock ${cat.name} for ${preview} points`
                }
                className={`flex items-center justify-between gap-1 rounded-lg border px-2.5 py-2 text-left transition disabled:cursor-default ${
                  locked
                    ? "border-line bg-surface/60"
                    : "border-line bg-surface hover:border-warn/60 hover:bg-surface-2"
                }`}
              >
                <span
                  className={`truncate text-[11px] ${
                    locked ? "text-muted" : "text-ink"
                  }`}
                >
                  {cat.name}
                </span>
                <span
                  className={`font-mono text-sm font-bold ${
                    locked
                      ? "text-success"
                      : rollsUsed === 0
                        ? "text-muted"
                        : "text-warn"
                  }`}
                >
                  {locked ? scores[cat.id] : preview}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[11px] uppercase tracking-widest">
          <span className="text-muted">
            Upper bonus{" "}
            <b className={bonusReady ? "text-success" : "text-ink"}>
              {upperSum(scores)}/63
            </b>
          </span>
          <span className={bonusReady ? "text-success" : "text-muted"}>
            {bonusReady ? "+35 locked" : "+35 at 63"}
          </span>
        </div>

        {phase === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              DICE KINGS
            </p>
            <p className="mt-2 text-sm text-muted">
              Five dice, three rolls, thirteen boxes to fill.
            </p>
            <p className="mt-1 text-xs text-muted">
              Hold the keepers — every preview shows its live score.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-yellow-400 via-amber-500 to-orange-600"
            >
              Start game
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              BOARD COMPLETE
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best game!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {total}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {bonusReady ? "Includes +35 upper bonus" : "No upper bonus"} · Best{" "}
              {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-yellow-400 via-amber-500 to-orange-600"
            >
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap dice to hold them · lock a box once per turn · order is free
      </p>
    </div>
  );
}
