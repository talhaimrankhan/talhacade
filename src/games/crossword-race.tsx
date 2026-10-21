"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

interface Item {
  clue: string;
  answers: string[];
}

/** [clue, answer(s) — variants separated by "/"] */
const RAW: [string, string][] = [
  ["Opposite of cold", "hot"],
  ["Feline household pet", "cat"],
  ["A baby dog", "puppy"],
  ["Colour of fresh snow", "white"],
  ["Opposite of buy", "sell"],
  ["Sweet produce of bees", "honey"],
  ["Slow reptile with a shell", "turtle"],
  ["Farm animal that gives milk", "cow"],
  ["King of the beasts", "lion"],
  ["Furry pet that barks", "dog"],
  ["Opposite of arrive", "depart"],
  ["Water in solid form", "ice"],
  ["You borrow books from this", "library"],
  ["Worn on your feet", "shoes"],
  ["Neighs in the stable", "horse"],
  ["Feathered creature that flies", "bird"],
  ["Opposite of soft", "hard"],
  ["Ocean water tastes like this", "salty"],
  ["A sliced loaf before eating", "slices"],
  ["Opens like a canopy against rain", "umbrella"],
  ["Days in a full week", "seven"],
  ["Opposite of young", "old"],
  ["Eight-legged web spinner", "spider"],
  ["Sweet orange root vegetable", "carrot"],
  ["Home to the sun and its planets", "galaxy"],
  ["Big-eared trunk-carrying mammal", "elephant"],
  ["Green jumper by the pond", "frog"],
  ["Fluffy flakes falling from clouds", "snow"],
  ["Opposite of full", "empty"],
  ["Sharp tool for cutting", "knife"],
  ["Where the cook prepares food", "kitchen"],
  ["Soft cushion for sleeping", "pillow"],
  ["Writes with ink", "pen"],
  ["Has hands but cannot clap", "clock"],
  ["Two wheels and a set of pedals", "bicycle"],
  ["What your ears pick up", "sound"],
  ["Opposite of inside", "outside"],
  ["Striped runner of the plains", "zebra"],
  ["Waxen stick with a wick", "candle"],
  ["Turn its pages to read", "book"],
  ["Small fruit that grows in bunches", "grape"],
  ["Opposite of same", "different"],
  ["Tallest animal in the savanna", "giraffe"],
  ["Has fins and lives underwater", "fish"],
  ["Where planes take off", "airport"],
  ["Hangs in a tower and rings", "bell"],
  ["Costs very little", "cheap"],
  ["Opposite of win", "lose"],
  ["Yeast makes this rise", "dough"],
  ["Two handles and serrated blades", "scissors"],
  ["Mountain with a crater", "volcano"],
  ["World that circles the sun", "planet"],
  ["Half of twelve", "six"],
  ["Opposite of dry", "wet"],
  ["A chick comes out of this", "egg"],
  ["First meal of the day", "breakfast"],
  ["Baked sweet treat with icing", "cake"],
  ["Stands at the board and teaches", "teacher"],
  ["Learns lessons at school", "student"],
  ["Fixes leaking pipes", "plumber"],
  ["Trims your hair", "barber"],
  ["Writes stories and books", "author"],
  ["Flies at night and hoots", "owl"],
  ["Opposite of south", "north"],
  ["Opposite of left", "right"],
  ["One hundred cents", "dollar"],
  ["Coins and notes together", "money"],
  ["Where your savings are kept", "bank"],
  ["Sleeps through the winter", "bear"],
  ["Tallest bird, and it cannot fly", "ostrich"],
  ["Striped big cat", "tiger"],
  ["Opposite of happiness", "sadness"],
  ["Tells jokes for a living", "comedian"],
  ["Has a screen and a keyboard", "computer"],
  ["You type on this", "keyboard"],
  ["Fits in a pocket and makes calls", "phone"],
  ["Lights a room, and it needs a bulb", "lamp"],
  ["Seven colours in one arc", "rainbow"],
  ["Falls from the sky in drops", "rain"],
  ["Lightning and thunder together", "storm"],
  ["Sandy land with dunes", "desert"],
  ["Salty water covering the globe", "ocean"],
  ["Has a handle and boils water", "kettle"],
  ["Brewed from beans, wakes you up", "coffee"],
  ["Steeped leaves in a cup", "tea"],
  ["Sweetens your tea", "sugar"],
  ["Spread on toast, made from milk", "butter"],
  ["White liquid from a cow", "milk"],
  ["Laid by hens", "eggs"],
  ["Yellow curved fruit", "banana"],
  ["An apple a day keeps this away", "doctor"],
  ["Red berry with seeds outside", "strawberry"],
  ["Red tart fruit for pies", "cherry"],
  ["Opposite of tame", "wild"],
  ["Opposite of lazy", "active"],
  ["You close your eyes to do this", "sleep"],
  ["The study of numbers", "math/maths"],
  ["Three sides and three angles", "triangle"],
  ["Four equal sides", "square"],
  ["Round shape with no corners", "circle"],
  ["Half of twenty", "ten"],
  ["Sixty minutes in one", "hour"],
  ["Days in a common year", "365"],
  ["Study of the weather", "meteorology"],
  ["Animal that gives us wool", "sheep"],
  ["Cloth hung over a window", "curtain"],
  ["Sweeps the floor", "broom"],
  ["Dries your hands", "towel"],
  ["Has keys but opens no doors", "piano"],
  ["Six strings and a fretboard", "guitar"],
  ["Blow across its holes to play", "flute"],
  ["Black and white bear that eats bamboo", "panda"],
  ["Sits in the henhouse", "hen"],
  ["A young cat", "kitten"],
  ["Grows in soil and needs sun", "plant"],
  ["Photosynthesis happens in these", "leaves"],
  ["The thick main stem of a tree", "trunk"],
  ["Roots hold this together", "soil"],
  ["Flowers bloom in this season", "spring"],
  ["Season of falling leaves", "autumn"],
  ["Hottest season of the year", "summer"],
  ["Coldest season of the year", "winter"],
  ["Opposite of hot", "cold"],
  ["Pops in the toaster", "bread"],
  ["Bread with a filling", "sandwich"],
  ["Round bread with a hole", "bagel"],
  ["Long thin Italian pasta", "spaghetti"],
  ["Melts across the top of a pizza", "cheese"],
  ["Crustacean with two claws", "crab"],
  ["Eight arms and jet-black ink", "octopus"],
  ["Waddles on the ice", "penguin"],
  ["Largest animal on Earth", "whale"],
  ["Opposite of generous", "selfish"],
  ["Opposite of difficult", "easy"],
  ["Opposite of tall", "short"],
  ["Opposite of heavy", "light"],
  ["A soaking burst of rain", "downpour"],
  ["Blocks the sun at the beach", "shade"],
  ["Sand and waves at the coast", "beach"],
  ["Low tide leaves these behind", "shells"],
  ["Treasure chests are full of this", "gold"],
  ["Grey metal that rusts", "iron"],
  ["Hardest natural gemstone", "diamond"],
  ["Rubies and these are gems", "jewels"],
  ["A pilot flies this", "plane"],
  ["A firefighter battles this", "fire"],
  ["Gives shade under its leaves", "tree"],
  ["Turns green after the rains", "grass"],
  ["Floats in the sky, all white", "cloud"],
  ["Caught with a rod and a worm", "fish"],
  ["You chop vegetables on this", "board"],
  ["Keeps bread fresh in the cupboard", "flour"],
  ["A bundle of hay in a field", "bale"],
  ["The soft down of a bird", "feather"],
  ["Wicks oil and gives flame", "lantern"],
  ["A wheelbarrow carries this", "soil"],
];

const BANK: Item[] = RAW.map(([clue, answers]) => ({
  clue,
  answers: answers.split("/"),
}));

const START_CLOCK = 60;
const TIME_BONUS = 3;
const BASE_POINTS = 100;
const STREAK_BONUS = 50;
const STREAK_NEEDED = 3;
const TONE = "from-orange-500 via-red-500 to-rose-600";

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

export default function CrosswordRace() {
  const { best, submit } = useBestScore("crossword-race", "high");

  const [status, setStatus] = useState<Status>("idle");
  const [clue, setClue] = useState<Item>(BANK[0]);
  const [entry, setEntry] = useState("");
  const [clock, setClock] = useState(START_CLOCK);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(0);
  const [gain, setGain] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [running, setRunning] = useState(false);

  const clockRef = useRef(START_CLOCK);
  const scoreRef = useRef(0);
  const deckRef = useRef<Item[]>([BANK[0]]);
  const deckPosRef = useRef(0);
  const feedbackRef = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const clearTimers = useCallback(() => {
    for (let i = 0; i < timers.current.length; i++) clearTimeout(timers.current[i]);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const finish = useCallback(() => {
    setRunning(false);
    setStatus("over");
    setNewBest(submit(scoreRef.current));
  }, [submit]);

  // The clock only ticks while a run is under way.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const next = Math.max(0, clockRef.current - 1);
      clockRef.current = next;
      setClock(next);
      if (next <= 0) finish();
    }, 1000);
    return () => clearInterval(id);
  }, [running, finish]);

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
    const deck = shuffle(BANK);
    deckRef.current = deck;
    deckPosRef.current = 0;
    feedbackRef.current = 0;
    clockRef.current = START_CLOCK;
    scoreRef.current = 0;
    setClue(deck[0]);
    setEntry("");
    setClock(START_CLOCK);
    setScore(0);
    setStreak(0);
    setSolved(0);
    setGain(0);
    setJitter(0);
    setNewBest(false);
    setStatus("playing");
    setRunning(true);
    inputRef.current?.focus();
  }, [clearTimers]);

  const advanceClue = useCallback(() => {
    deckPosRef.current += 1;
    if (deckPosRef.current >= deckRef.current.length) {
      deckRef.current = shuffle(BANK);
      deckPosRef.current = 0;
    }
    setClue(deckRef.current[deckPosRef.current]);
  }, []);

  const submitGuess = useCallback(() => {
    if (status !== "playing") return;
    const guess = entry.trim().toLowerCase();
    if (guess.length === 0) return;

    if (clue.answers.includes(guess)) {
      const nextStreak = streak + 1;
      const earned = BASE_POINTS + (nextStreak >= STREAK_NEEDED ? STREAK_BONUS : 0);
      scoreRef.current += earned;
      clockRef.current = Math.min(START_CLOCK, clockRef.current + TIME_BONUS);
      setScore(scoreRef.current);
      setClock(clockRef.current);
      setStreak(nextStreak);
      setSolved((n) => n + 1);
      setEntry("");

      feedbackRef.current += 1;
      const token = feedbackRef.current;
      setGain(earned);
      timers.current.push(
        setTimeout(() => {
          if (feedbackRef.current === token) setGain(0);
        }, 900),
      );

      advanceClue();
      inputRef.current?.focus();
    } else {
      setStreak(0);
      shake();
    }
  }, [status, entry, clue, streak, advanceClue, shake]);

  const clockPct = Math.max(0, Math.min(100, (clock / START_CLOCK) * 100));

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className={clock <= 10 ? "text-rose-400" : undefined}>
          Clock <b className="ml-1 text-sm text-ink tabular-nums">{clock}s</b>
        </span>
        <span className="text-warn">
          ×{streak >= STREAK_NEEDED ? 2 : 1} <b className="ml-0.5 text-sm text-ink">{streak}</b>
        </span>
      </GameHud>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-1000 ease-linear",
            clock <= 10 ? "bg-rose-500" : "bg-orange-400",
          )}
          style={{ width: `${clockPct}%` }}
        />
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(249,115,22,0.6)] sm:p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Clue {solved + 1} · bank {BANK.length}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {streak >= STREAK_NEEDED ? (
              <b className="text-warn">streak bonus live</b>
            ) : (
              `${Math.max(0, STREAK_NEEDED - streak)} more for the bonus`
            )}
          </span>
        </div>

        <p className="mt-3 min-h-16 text-center font-display text-lg font-bold leading-snug text-ink sm:text-xl">
          {clue.clue}
        </p>

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            submitGuess();
          }}
        >
          <div
            className="flex gap-2 transition-transform duration-75"
            style={{ transform: `translateX(${jitter}px)` }}
          >
            <input
              ref={inputRef}
              type="text"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder="Type your answer…"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Type the answer"
              className="min-w-0 flex-1 rounded-xl border border-line bg-[#131322] px-3 py-3 text-center font-display text-base font-bold tracking-wide text-ink outline-none placeholder:text-xs placeholder:font-normal placeholder:tracking-normal placeholder:text-muted focus:border-primary/60 sm:text-lg"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl border border-primary/50 bg-primary/15 px-4 text-xs font-bold text-ink transition hover:bg-primary/25 active:scale-95"
            >
              Enter
            </button>
          </div>
        </form>

        <div className="mt-3 h-8 text-center">
          {gain > 0 ? (
            <span className="animate-pop inline-block rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-300">
              +{gain} points · +{TIME_BONUS}s
            </span>
          ) : status === "playing" && streak === 0 && solved > 0 ? (
            <span className="inline-block rounded-full bg-rose-500/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-rose-400">
              not the answer — streak reset
            </span>
          ) : null}
        </div>

        {status === "idle" && (
          <Overlay>
            <p className="text-4xl">⏱️</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              SIXTY SECONDS OF CLUES
            </p>
            <p className="mt-2 text-sm text-muted">
              Type each answer and hit Enter — correct hits add 3s, and three in a row double the points.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start the clock
            </PrimaryButton>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="text-4xl">⏰</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              TIME IS UP
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · {solved} clues solved
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Race again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Type the answer and press Enter · tap Enter on screen · wrong guesses only break the streak
      </p>
    </div>
  );
}
