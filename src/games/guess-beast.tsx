"use client";

import { useCallback, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, PrimaryButton } from "./parts";

const ATTRS = [
  "a mammal",
  "a bird",
  "a reptile",
  "a fish",
  "an insect",
  "a predator",
  "kept as a pet",
  "mostly aquatic",
  "nocturnal",
  "able to fly",
  "a herd or flock animal",
  "a strong swimmer",
  "striped or spotted",
  "domesticated by people",
  "dangerous to people",
  "extinct",
];

interface Beast {
  name: string;
  emoji: string;
  /** Indices into ATTRS that are true for this beast. */
  t: number[];
}

const BEASTS: Beast[] = [
  { name: "Dog", emoji: "🐕", t: [0, 6, 11, 13] },
  { name: "Cat", emoji: "🐈", t: [0, 5, 6, 8, 13] },
  { name: "Lion", emoji: "🦁", t: [0, 5, 10, 14] },
  { name: "Tiger", emoji: "🐯", t: [0, 5, 11, 12, 14] },
  { name: "Elephant", emoji: "🐘", t: [0, 10, 14] },
  { name: "Zebra", emoji: "🦓", t: [0, 10, 12] },
  { name: "Giraffe", emoji: "🦒", t: [0, 10] },
  { name: "Horse", emoji: "🐴", t: [0, 10, 11, 13] },
  { name: "Cow", emoji: "🐄", t: [0, 10, 13] },
  { name: "Sheep", emoji: "🐑", t: [0, 10, 13] },
  { name: "Pig", emoji: "🐖", t: [0, 13] },
  { name: "Rabbit", emoji: "🐰", t: [0, 6, 8, 13] },
  { name: "Mouse", emoji: "🐭", t: [0, 6, 8] },
  { name: "Bat", emoji: "🦇", t: [0, 8, 9] },
  { name: "Whale", emoji: "🐳", t: [0, 7, 11] },
  { name: "Dolphin", emoji: "🐬", t: [0, 5, 7, 11] },
  { name: "Mammoth", emoji: "🦣", t: [0, 10, 15] },
  { name: "Shark", emoji: "🦈", t: [3, 5, 7, 11, 14] },
  { name: "Clownfish", emoji: "🐠", t: [3, 7, 11, 12] },
  { name: "Salmon", emoji: "🐟", t: [3, 7, 11] },
  { name: "Octopus", emoji: "🐙", t: [7, 11] },
  { name: "Crab", emoji: "🦀", t: [7, 11] },
  { name: "Penguin", emoji: "🐧", t: [1, 5, 7, 11] },
  { name: "Eagle", emoji: "🦅", t: [1, 5, 9] },
  { name: "Owl", emoji: "🦉", t: [1, 5, 8, 9] },
  { name: "Parrot", emoji: "🦜", t: [1, 6, 9, 13] },
  { name: "Pigeon", emoji: "🕊️", t: [1, 9, 10] },
  { name: "Flamingo", emoji: "🦩", t: [1, 7, 9] },
  { name: "Duck", emoji: "🦆", t: [1, 7, 9, 11, 13] },
  { name: "Chicken", emoji: "🐔", t: [1, 13] },
  { name: "Swan", emoji: "🦢", t: [1, 7, 9, 11] },
  { name: "Snake", emoji: "🐍", t: [2, 5, 11] },
  { name: "Crocodile", emoji: "🐊", t: [2, 5, 7, 11, 14] },
  { name: "Lizard", emoji: "🦎", t: [2, 5] },
  { name: "Turtle", emoji: "🐢", t: [2, 7, 11] },
  { name: "Dinosaur", emoji: "🦕", t: [2, 10, 14, 15] },
  { name: "Butterfly", emoji: "🦋", t: [4, 9] },
  { name: "Bee", emoji: "🐝", t: [4, 9, 14] },
  { name: "Ant", emoji: "🐜", t: [4, 10] },
  { name: "Spider", emoji: "🕷️", t: [4, 5, 8] },
];

type Answer = "yes" | "no" | "maybe";
type Phase = "intro" | "asking" | "guessing" | "lost" | "won" | "stumped";

interface LogEntry {
  q: string;
  a: string;
}

const ANSWER_TEXT: Record<Answer, string> = {
  yes: "Yes",
  no: "No",
  maybe: "Not sure",
};

/** Pick the question that splits the remaining beasts as evenly as possible. */
function bestQuestion(cands: Beast[], asked: number[]): number | null {
  let bestIdx = -1;
  let bestGain = -1;
  for (let a = 0; a < ATTRS.length; a++) {
    if (asked.includes(a)) continue;
    let yes = 0;
    for (const b of cands) if (b.t.includes(a)) yes += 1;
    const p = yes / cands.length;
    if (p === 0 || p === 1) continue; // no information
    const gain = -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
    if (gain > bestGain) {
      bestGain = gain;
      bestIdx = a;
    }
  }
  return bestIdx === -1 ? null : bestIdx;
}

export default function GuessBeast({ gameId }: { gameId: string }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [cands, setCands] = useState<Beast[]>(() => BEASTS);
  const [asked, setAsked] = useState<number[]>([]);
  const [cur, setCur] = useState<number | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [qCount, setQCount] = useState(0);
  const [guessCount, setGuessCount] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const start = useCallback(() => {
    setPhase("asking");
    setCands(BEASTS);
    setAsked([]);
    setCur(bestQuestion(BEASTS, []));
    setLog([]);
    setQCount(0);
    setGuessCount(0);
    setNewBest(false);
  }, []);

  const answer = useCallback(
    (value: Answer) => {
      if (phase !== "asking" || cur === null) return;
      const attr = cur;
      const label = ATTRS[attr];
      const filtered =
        value === "yes"
          ? cands.filter((b) => b.t.includes(attr))
          : value === "no"
            ? cands.filter((b) => !b.t.includes(attr))
            : cands;

      const nextAsked = [...asked, attr];
      const nextLog = [...log, { q: `Is it ${label}?`, a: ANSWER_TEXT[value] }];
      const nextQ = qCount + 1;
      setLog(nextLog);
      setQCount(nextQ);
      setAsked(nextAsked);
      setCands(filtered);
      setCur(null);

      if (filtered.length === 0) {
        setPhase("stumped");
        return;
      }
      if (filtered.length <= 2) {
        setPhase("guessing");
        return;
      }
      const next = bestQuestion(filtered, nextAsked);
      if (next === null) {
        setPhase("guessing");
        return;
      }
      setPhase("asking");
      setCur(next);
    },
    [phase, cur, cands, asked, log, qCount],
  );

  const verdict = useCallback(
    (correct: boolean) => {
      if (phase !== "guessing") return;
      if (correct) {
        setPhase("lost");
        return;
      }
      const remaining = cands.slice(1);
      const guesses = guessCount + 1;
      setGuessCount(guesses);
      setCands(remaining);

      if (guesses >= 2 || remaining.length === 0) {
        setPhase("won");
        setNewBest(submit((best ?? 0) + 1));
        return;
      }
      if (remaining.length <= 2) {
        setPhase("guessing");
        return;
      }
      const next = bestQuestion(remaining, asked);
      if (next === null) {
        setPhase("guessing");
        return;
      }
      setPhase("asking");
      setCur(next);
    },
    [phase, cands, guessCount, asked, best, submit],
  );

  const guess = cands[0];
  const playing = phase === "asking" || phase === "guessing";

  return (
    <div className="w-full max-w-[460px]">
      <GameHud
        score={`${qCount} questions`}
        best={best === null ? "—" : `${best} won`}
      >
        <span className="text-accent">
          Guesses <b className="ml-1 text-sm text-ink">{guessCount}/2</b>
        </span>
        <span className="text-accent">
          Beasts left <b className="ml-1 text-sm text-ink">{cands.length}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(139,92,246,0.8)] sm:p-5">
        <div className="min-h-[248px]">
          {phase === "intro" && (
            <div className="grid place-items-center py-6 text-center">
              <p className="font-display text-2xl font-bold text-white">
                GUESS BEAST
              </p>
              <p className="mt-2 max-w-[34ch] text-sm text-muted">
                Think of any animal from the bestiary — the AI will interrogate
                you with yes / no questions until it knows exactly which one.
              </p>
              <p className="mt-3 text-3xl tracking-widest">
                🦁 🦈 🦋 🐘 🦉 🐙
              </p>
              <PrimaryButton
                onClick={start}
                tone="from-violet-500 via-purple-500 to-fuchsia-500"
              >
                I&apos;ve got one
              </PrimaryButton>
            </div>
          )}

          {phase === "asking" && cur !== null && (
            <div className="grid place-items-center gap-1 py-4 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">
                Question {qCount + 1}
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">
                Is it {ATTRS[cur]}?
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => answer("yes")}
                  aria-label="Answer yes"
                  className="rounded-full border border-success/50 bg-success/10 px-6 py-2 text-sm font-bold text-success transition hover:bg-success/20 active:scale-95"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => answer("no")}
                  aria-label="Answer no"
                  className="rounded-full border border-rose-400/50 bg-rose-400/10 px-6 py-2 text-sm font-bold text-rose-400 transition hover:bg-rose-400/20 active:scale-95"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => answer("maybe")}
                  aria-label="Answer not sure"
                  className="rounded-full border border-line bg-surface px-6 py-2 text-sm font-bold text-muted transition hover:text-ink active:scale-95"
                >
                  Not sure
                </button>
              </div>
            </div>
          )}

          {phase === "guessing" && guess && (
            <div className="grid place-items-center gap-1 py-4 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-warn">
                Final answer attempt {guessCount + 1} of 2
              </p>
              <p className="mt-2 text-5xl">{guess.emoji}</p>
              <p className="mt-2 font-display text-2xl font-bold text-white">
                Is it a {guess.name}?
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => verdict(true)}
                  aria-label="Confirm the guess is correct"
                  className="rounded-full border border-success/50 bg-success/10 px-6 py-2 text-sm font-bold text-success transition hover:bg-success/20 active:scale-95"
                >
                  🎯 That&apos;s it
                </button>
                <button
                  type="button"
                  onClick={() => verdict(false)}
                  aria-label="Reject the guess"
                  className="rounded-full border border-rose-400/50 bg-rose-400/10 px-6 py-2 text-sm font-bold text-rose-400 transition hover:bg-rose-400/20 active:scale-95"
                >
                  ❌ Wrong beast
                </button>
              </div>
            </div>
          )}

          {(phase === "lost" || phase === "won" || phase === "stumped") && (
            <div className="grid place-items-center gap-1 py-4 text-center">
              <p className="text-5xl">
                {phase === "stumped"
                  ? "🫠"
                  : phase === "won"
                    ? "🏆"
                    : (cands[0]?.emoji ?? "🤔")}
              </p>
              <p
                className={cn(
                  "mt-2 font-display text-2xl font-bold",
                  phase === "lost" ? "text-rose-400" : "text-success",
                )}
              >
                {phase === "lost"
                  ? "CAUGHT BY THE BEAST"
                  : phase === "won"
                    ? "YOU STUMPED IT"
                    : "IT GAVE UP"}
              </p>
              {phase === "lost" && (
                <p className="mt-1 text-sm text-muted">
                  It was a {cands[0]?.name} — guessed after just{" "}
                  <b className="text-ink">{qCount}</b>{" "}
                  {qCount === 1 ? "question" : "questions"}.
                </p>
              )}
              {phase === "won" && (
                <p className="mt-1 text-sm text-muted">
                  Two wrong guesses — your animal stays secret. Games won:{" "}
                  <b className="text-ink">{best ?? 0}</b>
                  {newBest && <span className="text-warn"> ✦ new record!</span>}
                </p>
              )}
              {phase === "stumped" && (
                <p className="mt-1 max-w-[36ch] text-sm text-muted">
                  Your answers pointed at no living creature — the AI taps out.
                </p>
              )}
              <PrimaryButton
                onClick={start}
                tone="from-violet-500 via-purple-500 to-fuchsia-500"
              >
                New game
              </PrimaryButton>
            </div>
          )}
        </div>

        {playing && log.length > 0 && (
          <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto border-t border-line pt-3 text-left">
            {log.map((entry, i) => (
              <li
                key={`${entry.q}-${i}`}
                className="flex items-baseline justify-between gap-3 font-mono text-[11px] text-muted"
              >
                <span className="truncate">{entry.q}</span>
                <span
                  className={cn(
                    "shrink-0 font-bold",
                    entry.a === "Yes" && "text-success",
                    entry.a === "No" && "text-rose-400",
                    entry.a === "Not sure" && "text-warn",
                  )}
                >
                  {entry.a}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Pick a beast in your head · answer honestly · it needs two misses to lose
      </p>
    </div>
  );
}
