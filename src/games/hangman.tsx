"use client";

import { useCallback, useEffect, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

type CategoryName =
  | "Animals"
  | "Food"
  | "Countries"
  | "Movies"
  | "Sports"
  | "Nature";

const BANK: Record<CategoryName, string[]> = {
  Animals: [
    "LION", "TIGER", "ELEPHANT", "GIRAFFE", "ZEBRA", "PENGUIN", "DOLPHIN",
    "SHARK", "OCTOPUS", "KANGAROO", "PANDA", "RABBIT", "TURTLE", "HEDGEHOG",
    "SQUIRREL", "FLAMINGO", "PELICAN", "CROCODILE", "HIPPOPOTAMUS",
    "RHINOCEROS", "BUTTERFLY", "SPIDER", "EAGLE", "FALCON", "OWL", "WOLF",
    "FOX", "BEAR", "DEER", "MOOSE", "BISON", "LEMUR", "KOALA", "LLAMA",
    "CAMEL", "HYENA",
  ],
  Food: [
    "PIZZA", "BURGER", "SUSHI", "TACO", "SPAGHETTI", "PANCAKE", "WAFFLE",
    "COOKIE", "BROWNIE", "SANDWICH", "LASAGNA", "RISOTTO", "PRETZEL",
    "CROISSANT", "BAGEL", "DOUGHNUT", "AVOCADO", "BROCCOLI", "CAULIFLOWER",
    "EGGPLANT", "PUMPKIN", "SPINACH", "MANGO", "PINEAPPLE", "WATERMELON",
    "STRAWBERRY", "BLUEBERRY", "POMEGRANATE", "CHOCOLATE", "CUPCAKE",
    "CHEESECAKE", "OMELETTE", "CEREAL", "HONEY", "GINGER", "GARLIC",
  ],
  Countries: [
    "CANADA", "BRAZIL", "ARGENTINA", "MEXICO", "JAPAN", "CHINA", "INDIA",
    "FRANCE", "SPAIN", "PORTUGAL", "ITALY", "GERMANY", "NORWAY", "SWEDEN",
    "FINLAND", "ICELAND", "GREECE", "TURKEY", "EGYPT", "MOROCCO", "KENYA",
    "NIGERIA", "AUSTRALIA", "VIETNAM", "THAILAND", "INDONESIA",
    "PHILIPPINES", "PAKISTAN", "UKRAINE", "POLAND", "NETHERLANDS",
    "SWITZERLAND", "MADAGASCAR", "JAMAICA", "CUBA", "PERU",
  ],
  Movies: [
    "INCEPTION", "INTERSTELLAR", "GRAVITY", "TENET", "DUNKIRK", "JAWS",
    "TITANIC", "AVATAR", "FROZEN", "MOANA", "SHREK", "GLADIATOR", "ALIENS",
    "TERMINATOR", "PREDATOR", "JOKER", "BATMAN", "SUPERMAN", "CASABLANCA",
    "PSYCHO", "VERTIGO", "RATATOUILLE", "ZOOTOPIA", "ENCANTO", "ONWARD",
    "COCO", "BRAVE", "FURIOSA", "SICARIO", "ARRIVAL", "MEMENTO", "BORAT",
    "JUMANJI", "POCAHONTAS", "HERCULES", "MULAN",
  ],
  Sports: [
    "FOOTBALL", "BASKETBALL", "BASEBALL", "CRICKET", "TENNIS", "GOLF",
    "BOXING", "WRESTLING", "SWIMMING", "CYCLING", "MARATHON", "GYMNASTICS",
    "VOLLEYBALL", "HANDBALL", "RUGBY", "HOCKEY", "LACROSSE", "BADMINTON",
    "SKIING", "SKATING", "SURFING", "SAILING", "ROWING", "ARCHERY",
    "FENCING", "KARATE", "JUDO", "TAEKWONDO", "CLIMBING", "SOFTBALL",
    "POLO", "SNOOKER", "SQUASH", "FISHING", "BOWLING", "BIKING",
  ],
  Nature: [
    "RAINBOW", "WATERFALL", "VOLCANO", "GLACIER", "CANYON", "MEADOW",
    "FOREST", "JUNGLE", "OCEAN", "RIVER", "LAGOON", "REEF", "ISLAND",
    "DESERT", "TUNDRA", "SAVANNA", "VALLEY", "SUMMIT", "CLIFF", "GORGE",
    "CAVE", "METEOR", "COMET", "NEBULA", "GALAXY", "AURORA", "TORNADO",
    "HURRICANE", "THUNDERSTORM", "BREEZE", "DRIZZLE", "SNOWFALL", "FERN",
    "MOSS", "ORCHID", "CACTUS",
  ],
};

const CATEGORY_NAMES = Object.keys(BANK) as CategoryName[];
const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const MAX_WRONG = 6;

interface Puzzle {
  word: string;
  category: CategoryName;
}

function pickWord(exclude?: string): Puzzle {
  const category = CATEGORY_NAMES[Math.floor(Math.random() * CATEGORY_NAMES.length)];
  const list = BANK[category];
  let word = list[Math.floor(Math.random() * list.length)];
  if (exclude && list.length > 1) {
    while (word === exclude) {
      word = list[Math.floor(Math.random() * list.length)];
    }
  }
  return { word, category };
}

/** Gallows drawn in six stages: pole, base, rope, head, body, limbs. */
function Gallows({ wrong }: { wrong: number }) {
  return (
    <svg viewBox="0 0 200 220" className="h-56 w-auto" aria-hidden="true">
      {wrong >= 1 && (
        <path d="M 36 14 L 36 200" stroke="#fb7185" strokeWidth="4" strokeLinecap="round" />
      )}
      {wrong >= 2 && (
        <path d="M 10 200 L 96 200" stroke="#fb7185" strokeWidth="4" strokeLinecap="round" />
      )}
      {wrong >= 3 && (
        <path
          d="M 36 16 L 112 16 L 112 46"
          stroke="#fb7185"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
      {wrong >= 4 && (
        <circle cx="112" cy="64" r="18" stroke="#fbbf24" strokeWidth="4" fill="none" />
      )}
      {wrong >= 5 && (
        <path d="M 112 82 L 112 146" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
      )}
      {wrong >= 6 && (
        <path
          d="M 112 100 L 86 122 M 112 100 L 138 122 M 112 146 L 88 178 M 112 146 L 136 178"
          stroke="#fbbf24"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}

export default function Hangman({ gameId }: { gameId: string }) {
  const [puzzle, setPuzzle] = useState<Puzzle>(() => pickWord());
  const [guessed, setGuessed] = useState<string[]>([]);
  const [streak, setStreak] = useStored(`${gameId}-streak`, 0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const wrong = guessed.filter((g) => !puzzle.word.includes(g)).length;
  const lost = wrong >= MAX_WRONG;
  const won = !lost && puzzle.word.split("").every((c) => guessed.includes(c));

  const guess = useCallback(
    (letter: string) => {
      if (guessed.includes(letter) || won || lost) return;
      const next = [...guessed, letter];
      setGuessed(next);
      const solved = puzzle.word.split("").every((c) => next.includes(c));
      const misses = next.filter((g) => !puzzle.word.includes(g)).length;
      if (solved) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        setNewBest(submit(nextStreak));
      } else if (misses >= MAX_WRONG) {
        setStreak(0);
      }
    },
    [guessed, puzzle.word, streak, setStreak, submit, won, lost],
  );

  const newWord = useCallback(() => {
    setPuzzle((prev) => pickWord(prev.word));
    setGuessed([]);
    setNewBest(false);
  }, []);

  // physical keyboard on top of the on-screen keycaps
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (key.length === 1 && key >= "A" && key <= "Z") {
        e.preventDefault();
        guess(key);
      } else if (key === "Enter") {
        e.preventDefault();
        newWord();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [guess, newWord]);

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={streak} best={best ?? "—"}>
        <span className="text-cyan-400">
          Hint{" "}
          <b className="ml-1 text-sm text-ink">{puzzle.category}</b>
        </span>
        <span className="text-rose-400">
          Wrong{" "}
          <b className="ml-1 text-sm text-ink">
            {wrong}/{MAX_WRONG}
          </b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(251,113,133,0.7)]">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="rounded-xl border border-line bg-surface p-2">
            <Gallows wrong={wrong} />
          </div>

          <div className="flex-1">
            <p className="text-center font-mono text-[11px] uppercase tracking-widest text-muted sm:text-left">
              {puzzle.word.length} letters · {puzzle.category}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {puzzle.word.split("").map((letter, i) => {
                const open = guessed.includes(letter);
                return (
                  <span
                    key={`${letter}-${i}`}
                    className={`grid h-10 w-8 place-items-center border-b-2 font-display text-2xl font-bold ${
                      open
                        ? "animate-pop border-success text-success"
                        : "border-line text-transparent"
                    }`}
                  >
                    {open ? letter : "_"}
                  </span>
                );
              })}
            </div>

            <div className="mt-4 space-y-1.5">
              {ROWS.map((row) => (
                <div key={row} className="flex justify-center gap-1.5">
                  {row.split("").map((letter) => {
                    const used = guessed.includes(letter);
                    const hit = used && puzzle.word.includes(letter);
                    return (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => guess(letter)}
                        disabled={used || won || lost}
                        aria-label={`Guess ${letter}`}
                        className={`grid h-9 w-8 place-items-center rounded-md border font-mono text-sm font-bold transition disabled:cursor-default ${
                          hit
                            ? "border-success/60 bg-success/15 text-success"
                            : used
                              ? "border-line bg-surface/50 text-muted/60"
                              : "border-line bg-surface text-ink hover:border-cyan-400/60 hover:bg-surface-2"
                        }`}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={newWord}
            className="rounded-full bg-gradient-to-r from-lime-400 via-emerald-500 to-teal-600 px-6 py-2 font-display text-sm font-bold text-black transition hover:brightness-110 active:scale-95"
          >
            New word
          </button>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
            Type A–Z or tap the keycaps
          </span>
        </div>

        {won && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">SOLVED!</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best streak!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-success">
              {puzzle.word}
            </p>
            <p className="mt-1 text-xs uppercase tracking-widest text-muted">
              Streak {streak} · Best {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={newWord}
              tone="from-lime-400 via-emerald-500 to-teal-600"
            >
              Next word
            </PrimaryButton>
          </Overlay>
        )}

        {lost && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">HUNG OUT</p>
            <p className="mt-3 font-mono text-3xl font-bold text-white">
              {puzzle.word}
            </p>
            <p className="mt-1 text-xs uppercase tracking-widest text-muted">
              It was {puzzle.category} · streak reset
            </p>
            <PrimaryButton
              onClick={newWord}
              tone="from-lime-400 via-emerald-500 to-teal-600"
            >
              New word
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Six wrong guesses and the gallows finish — read the hint category first
      </p>
    </div>
  );
}
