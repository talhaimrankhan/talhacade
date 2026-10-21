"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const PHRASES = [
  "actions speak louder than words",
  "practice makes perfect",
  "better late than never",
  "the early bird catches the worm",
  "look before you leap",
  "better safe than sorry",
  "a picture is worth a thousand words",
  "all that glitters is not gold",
  "every cloud has a silver lining",
  "good things come to those who wait",
  "the pen is mightier than the sword",
  "time and tide wait for no one",
  "two heads are better than one",
  "birds of a feather flock together",
  "you reap what you sow",
  "what goes around comes around",
  "great minds think alike",
  "absence makes the heart grow fonder",
  "curiosity killed the cat",
  "slow and steady wins the race",
  "the best things in life are free",
  "there is no place like home",
  "practice what you preach",
  "strike while the iron is hot",
  "the grass is always greener",
  "waste not want not",
  "an apple a day keeps the doctor away",
  "all good things must come to an end",
  "blood is thicker than water",
  "count your blessings",
  "do not judge a book by its cover",
  "everything happens for a reason",
  "kill two birds with one stone",
  "measure twice cut once",
  "necessity is the mother of invention",
  "the squeaky wheel gets the grease",
  "time flies when you are having fun",
  "variety is the spice of life",
  "well begun is half done",
  "you miss every shot you do not take",
];

const PHRASES_PER_RUN = 3;
const MAX_MISTAKES = 3;
const MAX_HINTS = 2;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

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

/** Bijective letter-substitution where no letter maps to itself. */
function buildCipher(phrase: string): Record<string, string> {
  const used = [...new Set(phrase.split("").filter((c) => c !== " "))];
  for (let attempt = 0; attempt < 80; attempt++) {
    const perm = shuffle(used);
    let deranged = true;
    for (let i = 0; i < used.length; i++) {
      if (perm[i] === used[i]) {
        deranged = false;
        break;
      }
    }
    if (deranged) {
      const map: Record<string, string> = {};
      for (let i = 0; i < used.length; i++) map[used[i]] = perm[i];
      return map;
    }
  }
  // Rotation is always a derangement when there are 2+ letters.
  const map: Record<string, string> = {};
  for (let i = 0; i < used.length; i++) map[used[i]] = used[(i + 1) % used.length];
  return map;
}

interface Guess {
  plain: string;
  ok: boolean;
}

export default function CodeWords({ gameId = "code-words" }: { gameId?: string }) {
  const { best, submit } = useBestScore(gameId, "high");

  const [status, setStatus] = useState<Status>("idle");
  const [deck, setDeck] = useState<string[]>([PHRASES[0]]);
  const [index, setIndex] = useState(0);
  const [phrase, setPhrase] = useState(PHRASES[0]);
  /** plain letter -> cipher letter */
  const [cipher, setCipher] = useState<Record<string, string>>({});
  /** cipher letter -> plain letter */
  const [solution, setSolution] = useState<Record<string, string>>({});
  /** cipher letter -> player guess */
  const [guesses, setGuesses] = useState<Record<string, Guess>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [solved, setSolved] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [toast, setToast] = useState("");
  const [newBest, setNewBest] = useState(false);
  /** Distinct cipher letters shown in the current phrase. */
  const [shown, setShown] = useState<string[]>([]);

  const toastTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1900);
  }, []);

  const loadPhrase = useCallback((p: string) => {
    const map = buildCipher(p);
    const inv: Record<string, string> = {};
    for (const plain of Object.keys(map)) inv[map[plain]] = plain;
    setPhrase(p);
    setCipher(map);
    setSolution(inv);
    setGuesses({});
    setSelected(null);
    setShown([...new Set(p.split("").filter((c) => c !== " "))].map((plain) => map[plain]));
  }, []);

  const start = useCallback(() => {
    const picked = shuffle(PHRASES).slice(0, PHRASES_PER_RUN);
    setDeck(picked);
    setIndex(0);
    setMistakes(0);
    setSolved(0);
    setHintsLeft(MAX_HINTS);
    setToast("");
    setStatus("playing");
    setNewBest(false);
    loadPhrase(picked[0]);
  }, [loadPhrase]);

  const solvedCount = shown.filter((c) => guesses[c]?.ok).length;
  const isPhraseSolved = shown.length > 0 && solvedCount === shown.length;

  const finishRun = useCallback(
    (totalSolved: number, totalMistakes: number) => {
      setStatus("over");
      setNewBest(submit(totalSolved));
      if (totalMistakes >= MAX_MISTAKES) showToast("Out of chances.");
    },
    [submit, showToast],
  );

  const guess = useCallback(
    (plain: string) => {
      if (status !== "playing" || !selected) return;
      const target = selected;
      const correct = solution[target] === plain;

      // A plain letter can only live on one cipher letter — steal it back.
      const prior = Object.keys(guesses).find((c) => guesses[c].plain === plain);
      let nextGuesses: Record<string, Guess> = { ...guesses };
      if (prior && prior !== target) {
        if (guesses[prior].ok) {
          showToast("That letter is already solved.");
          return;
        }
        delete nextGuesses[prior];
      }

      nextGuesses = { ...nextGuesses, [target]: { plain, ok: correct } };
      setGuesses(nextGuesses);

      if (!correct) {
        const nextMistakes = mistakes + 1;
        setMistakes(nextMistakes);
        showToast("That one is wrong.");
        if (nextMistakes >= MAX_MISTAKES) {
          finishRun(solved, nextMistakes);
          return;
        }
        return;
      }

      const allSolved = shown.every((c) =>
        c === target ? true : nextGuesses[c]?.ok,
      );
      if (allSolved) {
        const total = solved + 1;
        setSolved(total);
        if (index + 1 >= deck.length) {
          finishRun(total, mistakes);
        } else {
          showToast("Phrase solved!");
          const next = index + 1;
          setIndex(next);
          loadPhrase(deck[next]);
        }
      } else {
        setSelected(null);
      }
    },
    [status, selected, solution, guesses, mistakes, solved, index, deck, shown, showToast, finishRun, loadPhrase],
  );

  const clearGuess = useCallback(() => {
    if (status !== "playing" || !selected) return;
    setGuesses((g) => {
      if (!g[selected]?.ok) {
        const next = { ...g };
        delete next[selected];
        return next;
      }
      return g;
    });
  }, [status, selected]);

  const takeHint = useCallback(() => {
    if (status !== "playing" || hintsLeft <= 0) return;
    const open = shown.filter((c) => !guesses[c]?.ok);
    if (open.length === 0) return;
    const pick = open[Math.floor(Math.random() * open.length)];
    setGuesses((g) => ({ ...g, [pick]: { plain: solution[pick], ok: true } }));
    setHintsLeft((n) => n - 1);
    setSelected(null);
    showToast(`Revealed ${solution[pick].toUpperCase()}.`);
  }, [status, hintsLeft, guesses, solution, shown, showToast]);

  useEffect(() => {
    if (status !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        clearGuess();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        guess(e.key.toLowerCase());
      } else if (e.key === "Escape") {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, guess, clearGuess]);

  const press = useCallback(
    (key: string) => {
      if (key === "back") clearGuess();
      else if (key === "clear") setSelected(null);
      else guess(key);
    },
    [clearGuess, guess],
  );

  const words = phrase.split(" ");

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={solved} best={best ?? "—"}>
        <span>
          Phrase <b className="ml-1 text-sm text-ink">{Math.min(index + 1, deck.length)}/{deck.length}</b>
        </span>
        <span className="text-rose-400">
          {"●".repeat(MAX_MISTAKES - mistakes)}
          <span className="text-line">{"●".repeat(mistakes)}</span>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(129,140,248,0.5)] sm:p-5">
        <p className="mb-1 text-center font-mono text-[10px] uppercase tracking-widest text-muted">
          Tap a code letter, then pick what it stands for
        </p>
        <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-widest text-warn">
          {isPhraseSolved
            ? "Phrase cracked!"
            : `Decoded ${solvedCount}/${shown.length} letters`}
        </p>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-3">
          {words.map((word, wi) => (
            <div key={wi} className="flex gap-1">
              {word.split("").map((plain, li) => {
                const code = cipher[plain];
                const g = guesses[code];
                const isSel = selected === code;
                return (
                  <button
                    key={`${wi}-${li}`}
                    type="button"
                    onClick={() => setSelected(code)}
                    className={cn(
                      "grid h-11 w-8 place-items-center rounded-md border-b-2 font-display text-lg font-bold transition sm:h-12 sm:w-9 sm:text-xl",
                      isSel
                        ? "border-warn bg-warn/15 text-warn"
                        : "border-line bg-[#131322]",
                      g?.ok && "border-emerald-400 bg-emerald-500/10 text-emerald-300",
                      g && !g.ok && "border-rose-500 bg-rose-500/10 text-rose-400",
                    )}
                  >
                    {g ? g.plain.toUpperCase() : code?.toUpperCase()}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-3 min-h-6 text-center">
          {toast && (
            <p className="animate-pop inline-block rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
              <span>{toast}</span>
            </p>
          )}
        </div>

        <div className="mt-1 flex flex-wrap justify-center gap-1 select-none">
          {ALPHABET.map((ch) => (
            <button
              key={ch}
              type="button"
              onPointerDown={() => press(ch)}
              className="h-9 w-8 rounded-lg border border-line bg-surface text-sm font-display text-ink transition hover:border-primary/60 hover:bg-surface-2 active:scale-95"
            >
              {ch}
            </button>
          ))}
          <button
            type="button"
            onPointerDown={() => press("back")}
            className="h-9 w-10 rounded-lg border border-line bg-surface text-xs text-muted transition hover:bg-surface-2"
          >
            ⌫
          </button>
        </div>

        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={takeHint}
            disabled={status !== "playing" || hintsLeft <= 0}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2 disabled:opacity-40"
          >
            Reveal letter ({hintsLeft})
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
            <p className="text-4xl">🔐</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              CRACK THREE CODES
            </p>
            <p className="mt-2 text-sm text-muted">
              Every letter stands for the same letter throughout. Three wrong guesses ends the run.
            </p>
            <PrimaryButton onClick={start} tone="from-indigo-400 via-violet-500 to-purple-600">
              Start run
            </PrimaryButton>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="text-4xl">{solved >= deck.length ? "🔓" : "🔒"}</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              {solved >= deck.length ? "ALL CODES CRACKED" : "RUN OVER"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best run!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">
              {solved}/{deck.length}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} phrases · {mistakes} mistakes
            </p>
            <PrimaryButton onClick={start} tone="from-indigo-400 via-violet-500 to-purple-600">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Select a cipher letter · type or tap your guess · ⌫ clears a guess
      </p>
    </div>
  );
}
