"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const RUN_LENGTH = 8;
const HINT_PENALTY = 10;

const WORDS = (
  "apple beach brain bread brick bring brush cable camel candy carry chair charm chase cheap check " +
  "chest chief child chunk circle clean clear climb clock cloud coast coral count court cover craft " +
  "crane crash cream creek crisp crown dance diary dream drink drive eagle earth fairy field flame " +
  "floor flower frame fresh fruit ghost giant glass globe glove grace grain grape grass great green " +
  "grill group guard heart honey horse house human ideal image ivory jelly juice knight ladder lamp " +
  "lemon light lizard magic mango melon mercy meter mirror money month mouse music night noise ocean " +
  "olive orbit organ paint paper party pasta peach pearl piano pillow planet plate point pond queen " +
  "quest quick quiet radio raise river roast robot round route royal scale scene score shell shore " +
  "sight skill smile snake solar sound space spark spice star stone storm story sugar table tiger " +
  "toast token tower train treat trial trunk turtle ultra uncle union valid value video water whale " +
  "wheat wheel world yeast zebra"
).split(" ");

const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

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

/** Shuffled letters that are guaranteed to differ from the real word. */
function scrambleOf(word: string): string[] {
  const letters = word.split("");
  for (let t = 0; t < 24; t++) {
    const s = shuffle(letters);
    if (s.join("") !== word) return s;
  }
  // Only reachable for words like "aaaa"; a rotation still differs.
  return letters.slice(1).concat(letters[0]);
}

export default function WordScramble({ gameId = "word-scramble" }: { gameId?: string }) {
  const { best, submit } = useBestScore(gameId, "low");

  const [status, setStatus] = useState<Status>("idle");
  const [words, setWords] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [scrambled, setScrambled] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [hintLetter, setHintLetter] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
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

  // The clock only ticks while a run is under way.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback(() => {
    const pool = shuffle(WORDS);
    const picks: string[] = [];
    for (let i = 0; i < RUN_LENGTH; i++) {
      picks.push(pool[i]);
    }
    setWords(picks);
    setIndex(0);
    setScrambled(scrambleOf(picks[0]));
    setTyped("");
    setHintLetter(false);
    setHintsUsed(0);
    setSeconds(0);
    setRunning(true);
    setStatus("playing");
    setWrong(false);
    setNewBest(false);
  }, []);

  const flashWrong = useCallback(() => {
    if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    setWrong(true);
    wrongTimer.current = window.setTimeout(() => setWrong(false), 420);
  }, []);

  const submitWord = useCallback(() => {
    if (status !== "playing") return;
    const word = words[index];
    if (!word || typed.length === 0) return;

    if (typed === word) {
      if (index + 1 >= words.length) {
        const final = seconds + hintsUsed * HINT_PENALTY;
        setRunning(false);
        setStatus("over");
        setNewBest(submit(final));
      } else {
        const next = index + 1;
        setIndex(next);
        setScrambled(scrambleOf(words[next]));
        setTyped("");
        setHintLetter(false);
      }
      return;
    }

    setTyped("");
    flashWrong();
  }, [status, words, index, typed, seconds, hintsUsed, submit, flashWrong]);

  const press = useCallback(
    (key: string) => {
      if (status !== "playing") return;
      if (key === "enter") {
        submitWord();
      } else if (key === "back") {
        setTyped((t) => t.slice(0, -1));
      } else if (typed.length < 12) {
        setTyped((t) => t + key);
      }
    },
    [status, typed.length, submitWord],
  );

  useEffect(() => {
    if (status !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitWord();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setTyped((t) => t.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        setTyped((t) => (t.length < 12 ? t + e.key.toLowerCase() : t));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, submitWord]);

  const takeHint = useCallback(() => {
    if (status !== "playing" || hintLetter) return;
    setHintLetter(true);
    setHintsUsed((n) => n + 1);
  }, [status, hintLetter]);

  const penalty = hintsUsed * HINT_PENALTY;
  const shownTime = seconds + penalty;
  const word = words[index] ?? "";

  return (
    <div className="w-full max-w-[520px]">
      <GameHud
        score={`${shownTime}s`}
        best={best === null ? "—" : `${best}s`}
      >
        <span>
          Word <b className="ml-1 text-sm text-ink">{Math.min(index + 1, RUN_LENGTH)}/{RUN_LENGTH}</b>
        </span>
        {penalty > 0 && <span className="text-warn">+{penalty}s</span>}
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(168,85,247,0.8)] sm:p-5">
        <div className="flex flex-wrap justify-center gap-1.5">
          {scrambled.map((ch, i) => (
            <span
              key={`${i}-${ch}`}
              className={cn(
                "grid h-11 w-10 place-items-center rounded-lg border border-line bg-[#131322] font-display text-xl font-bold text-ink transition-transform duration-75 sm:h-12 sm:w-11 sm:text-2xl",
                wrong && "-translate-x-1",
              )}
            >
              {hintLetter && i === 0 ? word[0] : ch}
            </span>
          ))}
        </div>

        <div className="mt-4 flex min-h-12 items-center justify-center rounded-xl border border-line bg-[#0e0e1c] px-3 py-2">
          {typed.length === 0 ? (
            <span className="text-sm text-muted">Type or tap the letters…</span>
          ) : (
            <span className="font-display text-xl font-bold tracking-widest text-white">
              {typed}
              <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-0.5 animate-pulse bg-primary" />
            </span>
          )}
        </div>

        <div className="mt-3 flex justify-center gap-1">
          {words.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                i < index ? "bg-emerald-400" : i === index ? "bg-primary" : "bg-line",
              )}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-1.5 select-none">
          {KEYS.map((row, r) => (
            <div key={r} className="flex justify-center gap-1">
              {r === 2 && (
                <button
                  type="button"
                  onPointerDown={() => press("back")}
                  className="rounded-lg border border-line bg-surface px-2.5 py-2 text-xs text-muted transition hover:bg-surface-2"
                >
                  ⌫
                </button>
              )}
              {row.split("").map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onPointerDown={() => press(ch)}
                  className="h-9 w-8 rounded-lg border border-line bg-surface text-sm font-display text-ink transition hover:border-primary/60 hover:bg-surface-2 active:scale-95 sm:w-9"
                >
                  {ch}
                </button>
              ))}
              {r === 2 && (
                <button
                  type="button"
                  onPointerDown={() => press("enter")}
                  className="rounded-lg border border-primary/50 bg-primary/15 px-2.5 py-2 text-xs font-bold text-ink transition hover:bg-primary/25"
                >
                  ⏎
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={takeHint}
            disabled={status !== "playing" || hintLetter}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2 disabled:opacity-40"
          >
            Hint · first letter (+{HINT_PENALTY}s)
          </button>
          <button
            type="button"
            onClick={start}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2"
          >
            New run
          </button>
        </div>

        {status === "idle" && (
          <Overlay>
            <p className="text-4xl">🔤</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              UN-SCRAMBLE 8 WORDS
            </p>
            <p className="mt-2 text-sm text-muted">
              Letters are shuffled — type the real word. Hints cost 10 seconds each.
            </p>
            <PrimaryButton onClick={start} tone="from-violet-500 via-purple-500 to-fuchsia-500">
              Start run
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
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">
              {shownTime}s
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : `${best}s`} · {penalty > 0 ? `${penalty}s in hints` : "no hints"}
            </p>
            <PrimaryButton onClick={start} tone="from-violet-500 via-purple-500 to-fuchsia-500">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Type the unscrambled word · Enter to submit · tap keys on touch
      </p>
    </div>
  );
}
