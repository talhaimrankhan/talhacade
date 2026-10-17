"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

const ROWS = 6;
const LEN = 5;

/** Every common five-letter word the answer is drawn from. */
const ANSWERS = [
  "apple", "beach", "bread", "brain", "brush", "chair", "charm", "chest",
  "climb", "clock", "cloud", "dance", "dream", "drink", "earth", "flame",
  "fruit", "glass", "grape", "green", "heart", "honey", "horse", "house",
  "juice", "knife", "light", "magic", "mango", "metal", "money", "mouse",
  "music", "ocean", "paint", "paper", "party", "peach", "pearl", "piano",
  "plant", "plane", "point", "queen", "river", "robot", "round", "shape",
  "sheep", "shine", "shirt", "smile", "sound", "space", "speak", "speed",
  "spice", "stone", "storm", "sugar", "table", "teach", "tiger", "toast",
  "train", "voice", "water", "whale", "wheat", "world", "youth", "zebra",
  "anger", "blade", "blank", "blast", "blaze", "blind", "block", "bloom",
  "board", "brave", "brief", "bunch", "carry", "cause", "chain", "chalk",
  "chart", "chess", "chill", "china", "clean", "clear", "clerk", "coast",
  "color", "could", "craft", "crane", "crash", "cream", "crime", "cross",
  "crowd", "crown", "curve", "daily", "debut", "delay", "depth", "devil",
  "diary", "dirty", "doubt", "dozen", "draft", "drama", "dread", "dried",
  "drove", "eager", "eagle", "early", "empty", "enemy", "enjoy", "enter",
  "entry", "equal", "error", "event", "every", "exact", "faith", "false",
  "fault", "favor", "fence", "fever", "fiber", "field", "fifth", "fight",
  "final", "first", "flash", "fleet", "floor", "flour", "focus", "force",
  "frame", "fresh", "front", "frost", "funny", "giant", "given", "glove",
  "glory", "grace", "grade", "grand", "grant", "grass", "great", "gross",
  "group", "guard", "guess", "guest", "guide", "happy", "heavy", "hello",
  "hence", "hobby", "human", "ideal", "image", "index", "input", "issue",
  "joint", "judge", "known", "label", "large", "laser", "later", "laugh",
  "layer", "learn", "least", "legal", "level", "liver", "local", "loose",
  "lucky", "lunch", "major", "maker", "march", "match", "maybe", "mayor",
  "medal", "media", "might", "minor", "model", "motor", "mount", "movie",
  "nerve", "never", "night", "noble", "noise", "north", "novel", "nurse",
  "occur", "offer", "often", "order", "other", "ought", "panel", "panic",
  "patch", "pause", "peace", "phase", "phone", "photo", "pilot", "pitch",
  "place", "plain", "plate", "plaza", "polar", "pound", "power", "press",
  "price", "pride", "prime", "print", "prior", "prize", "proof", "proud",
  "prove", "pupil", "quick", "quiet", "quite", "radio", "raise", "range",
  "rapid", "ratio", "reach", "ready", "refer", "right", "rival", "rough",
  "royal", "saint", "salad", "scale", "scene", "scope", "score", "sense",
  "serve", "seven", "shaft", "sharp", "sheet", "shell", "shift", "shock",
  "shoot", "short", "shown", "sight", "since", "sixth", "sixty", "skill",
  "sleep", "slide", "small", "smart", "solar", "solid", "solve", "sorry",
  "south", "spear", "spend", "spent", "split", "spoon", "sport", "staff",
  "stage", "stair", "stake", "stand", "start", "state", "steam", "steel",
  "stick", "still", "stock", "store", "story", "strip", "study", "stuff",
  "style", "super", "sweet", "swift", "swing", "taken", "taste", "taxes",
  "teeth", "tenth", "thank", "theft", "theme", "there", "thick", "thing",
  "think", "third", "those", "three", "threw", "throw", "tight", "timer",
  "title", "today", "topic", "total", "touch", "towel", "tower", "track",
  "trade", "trail", "trick", "truck", "truly", "trust", "truth", "twice",
  "under", "union", "unity", "until", "upper", "upset", "urban", "usage",
  "usual", "valid", "value", "video", "visit", "vital", "vivid", "wagon",
  "waste", "watch", "wheel", "where", "which", "while", "white", "whole",
  "woman", "women", "worry", "worse", "worst", "worth", "would", "wound",
  "wrist", "write", "wrong", "young", "abbey",
];

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

type Mark = "correct" | "present" | "absent";

/**
 * Wordle scoring with correct duplicate handling: green letters are consumed
 * first, then yellows draw from what's left (ABBEY vs ENTRY → one yellow E).
 */
function evaluate(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array<Mark>(LEN).fill("absent");
  const pool: Record<string, number> = {};
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === answer[i]) {
      marks[i] = "correct";
    } else {
      pool[answer[i]] = (pool[answer[i]] ?? 0) + 1;
    }
  }
  for (let i = 0; i < LEN; i++) {
    if (marks[i] === "correct") continue;
    const available = pool[guess[i]] ?? 0;
    if (available > 0) {
      marks[i] = "present";
      pool[guess[i]] = available - 1;
    }
  }
  return marks;
}

function tileFace(mark: Mark | undefined, letter: string): string {
  if (mark === "correct") return "border-emerald-600 bg-emerald-500 text-black";
  if (mark === "present") return "border-amber-600 bg-amber-400 text-black";
  if (mark === "absent") return "border-[#34344f] bg-[#26263d] text-muted";
  return letter
    ? "border-primary/60 bg-[#191933] text-ink"
    : "border-line bg-[#131322]";
}

export default function WordGuess({ gameId }: { gameId: string }) {
  const [answer, setAnswer] = useState(
    () => ANSWERS[Math.floor(Math.random() * ANSWERS.length)],
  );
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [jitter, setJitter] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [streak, setStreak] = useStored(`${gameId}-streak`, 0);
  const { best, submit } = useBestScore(gameId, "high");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const shake = useCallback(() => {
    clearTimers();
    [-8, 8, -5, 5, 0].forEach((dx, i) => {
      timers.current.push(setTimeout(() => setJitter(dx), i * 55));
    });
  }, [clearTimers]);

  const newWord = useCallback(() => {
    clearTimers();
    setAnswer(ANSWERS[Math.floor(Math.random() * ANSWERS.length)]);
    setGuesses([]);
    setCurrent("");
    setStatus("playing");
    setNewBest(false);
    setJitter(0);
  }, [clearTimers]);

  const submitGuess = useCallback(() => {
    if (status !== "playing") return;
    if (current.length < LEN) {
      shake();
      return;
    }
    const guess = current;
    const next = [...guesses, guess];
    setGuesses(next);
    setCurrent("");

    if (guess === answer) {
      const nextStreak = streak + 1;
      setStatus("won");
      setStreak(nextStreak);
      setNewBest(submit(nextStreak));
    } else if (next.length >= ROWS) {
      setStatus("lost");
      setStreak(0);
    }
  }, [status, current, guesses, answer, streak, setStreak, shake, submit]);

  const press = useCallback(
    (key: string) => {
      if (status !== "playing") return;
      if (key === "Enter") {
        submitGuess();
      } else if (key === "Backspace") {
        setCurrent((c) => c.slice(0, -1));
      } else {
        setCurrent((c) => (c.length < LEN ? c + key : c));
      }
    },
    [status, submitGuess],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Backspace") {
        e.preventDefault();
        press(e.key);
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        press(e.key.toLowerCase());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [press]);

  // Best-known state per letter, for tinting the on-screen keyboard.
  const letterMarks: Record<string, Mark> = {};
  const rank: Record<Mark, number> = { absent: 1, present: 2, correct: 3 };
  for (const g of guesses) {
    const marks = evaluate(g, answer);
    for (let i = 0; i < LEN; i++) {
      const letter = g[i];
      const prev = letterMarks[letter];
      if (!prev || rank[marks[i]] > rank[prev]) letterMarks[letter] = marks[i];
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Streak{" "}
          <b className="ml-1 text-sm text-ink tabular-nums">{streak}</b>
        </span>
        <span className="text-warn">
          Best <b className="ml-1 text-sm text-ink tabular-nums">{best ?? "—"}</b>
        </span>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(52,211,153,0.55)] sm:p-4">
        <div className="mx-auto grid w-full max-w-[320px] gap-1.5">
          {Array.from({ length: ROWS }, (_, r) => {
            const guess = guesses[r];
            const marks = guess ? evaluate(guess, answer) : null;
            const isCurrent = r === guesses.length && status === "playing";
            return (
              <div
                key={r}
                className="grid grid-cols-5 gap-1.5 transition-transform duration-75"
                style={{
                  transform: isCurrent ? `translateX(${jitter}px)` : undefined,
                }}
              >
                {Array.from({ length: LEN }, (_, c) => {
                  const letter =
                    guess?.[c] ?? (isCurrent ? current[c] ?? "" : "");
                  const mark = marks?.[c];
                  return (
                    <div
                      key={c}
                      style={
                        guess
                          ? { animationDelay: `${c * 80}ms` }
                          : undefined
                      }
                      className={cn(
                        "grid aspect-square place-items-center rounded-lg border-2 font-display text-2xl font-bold uppercase",
                        guess && "animate-pop",
                        tileFace(mark, letter),
                      )}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {(status === "won" || status === "lost") && (
          <Overlay>
            <p className="text-4xl">{status === "won" ? "🎉" : "🧩"}</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              {status === "won" ? "NICE WORD!" : "OUT OF ROWS"}
            </p>
            {status === "won" && (
              <>
                {newBest && (
                  <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                    ✦ New best streak!
                  </p>
                )}
                <p className="mt-3 font-mono text-3xl font-bold text-white tabular-nums">
                  {streak} in a row
                </p>
              </>
            )}
            <p className="mt-3 text-sm text-muted">
              The word was{" "}
              <b className="font-display text-lg uppercase tracking-widest text-ink">
                {answer}
              </b>
            </p>
            <PrimaryButton
              onClick={newWord}
              tone="from-emerald-400 via-teal-500 to-cyan-600"
            >
              New word
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <div className="mt-4 flex flex-col items-center gap-1.5 select-none">
        {KEY_ROWS.map((row, i) => (
          <div key={row} className="flex justify-center gap-1.5">
            {i === 2 && (
              <button
                type="button"
                onClick={() => press("Enter")}
                aria-label="Submit guess"
                className="rounded-md border border-line bg-surface px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-ink transition hover:border-primary/60 hover:bg-surface-2"
              >
                Enter
              </button>
            )}
            {row.split("").map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => press(letter)}
                aria-label={`Letter ${letter.toUpperCase()}`}
                className={cn(
                  "h-10 w-8 rounded-md border-2 font-display text-sm font-bold uppercase transition",
                  tileFace(letterMarks[letter], letter),
                )}
              >
                {letter}
              </button>
            ))}
            {i === 2 && (
              <button
                type="button"
                onClick={() => press("Backspace")}
                aria-label="Delete letter"
                className="rounded-md border border-line bg-surface px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-ink transition hover:border-primary/60 hover:bg-surface-2"
              >
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Type a five-letter word · green is right, yellow is elsewhere · six
        tries to keep the streak alive
      </p>
    </div>
  );
}
