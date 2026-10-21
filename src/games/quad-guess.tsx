"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

interface Puzzle {
  clue: string;
  answer: string;
  wrong: [string, string, string];
}

const ROUNDS = 10;
const MAX_WRONG = 3;
const BASE_POINTS = 100;

const BANK: Puzzle[] = [
  { clue: "How many legs does a spider have?", answer: "8", wrong: ["6", "10", "4"] },
  { clue: "What is the largest planet in our solar system?", answer: "Jupiter", wrong: ["Saturn", "Neptune", "Earth"] },
  { clue: "How many continents are there on Earth?", answer: "7", wrong: ["6", "5", "8"] },
  { clue: "What gas do plants absorb from the air?", answer: "Carbon dioxide", wrong: ["Oxygen", "Nitrogen", "Helium"] },
  { clue: "How many days are in a leap year?", answer: "366", wrong: ["365", "364", "367"] },
  { clue: "What is the capital of France?", answer: "Paris", wrong: ["Rome", "Madrid", "Lisbon"] },
  { clue: "Which planet is known as the Red Planet?", answer: "Mars", wrong: ["Venus", "Mercury", "Jupiter"] },
  { clue: "How many minutes are in an hour and a half?", answer: "90", wrong: ["80", "100", "75"] },
  { clue: "H2O is the chemical formula for what?", answer: "Water", wrong: ["Salt", "Sugar", "Peroxide"] },
  { clue: "How many sides does a hexagon have?", answer: "6", wrong: ["5", "7", "8"] },
  { clue: "What is the largest ocean on Earth?", answer: "Pacific", wrong: ["Atlantic", "Indian", "Arctic"] },
  { clue: "Which animal is called the king of the jungle?", answer: "Lion", wrong: ["Tiger", "Elephant", "Gorilla"] },
  { clue: "How many keys does a standard piano have?", answer: "88", wrong: ["84", "92", "76"] },
  { clue: "What is the chemical symbol for gold?", answer: "Au", wrong: ["Ag", "Gd", "Go"] },
  { clue: "How many players per side are on a soccer field?", answer: "11", wrong: ["10", "12", "9"] },
  { clue: "Which is the longest river in the world?", answer: "Nile", wrong: ["Amazon", "Yangtze", "Mississippi"] },
  { clue: "How many degrees are in a right angle?", answer: "90", wrong: ["45", "180", "60"] },
  { clue: "What is the hardest known natural substance?", answer: "Diamond", wrong: ["Quartz", "Ruby", "Granite"] },
  { clue: "How many teeth does an adult human typically have?", answer: "32", wrong: ["28", "30", "36"] },
  { clue: "Which planet is closest to the Sun?", answer: "Mercury", wrong: ["Venus", "Earth", "Mars"] },
  { clue: "How many colors are in a rainbow?", answer: "7", wrong: ["6", "8", "5"] },
  { clue: "What is the smallest prime number?", answer: "2", wrong: ["1", "3", "0"] },
  { clue: "Which organ pumps blood through the body?", answer: "Heart", wrong: ["Lungs", "Liver", "Brain"] },
  { clue: "How many vowels are in the English alphabet?", answer: "5", wrong: ["6", "4", "7"] },
  { clue: "What is the freezing point of water in Celsius?", answer: "0", wrong: ["32", "10", "-10"] },
  { clue: "How many hours are in three full days?", answer: "72", wrong: ["66", "84", "60"] },
  { clue: "Which metal is liquid at room temperature?", answer: "Mercury", wrong: ["Sodium", "Zinc", "Lead"] },
  { clue: "What is the largest mammal in the world?", answer: "Blue whale", wrong: ["Elephant", "Giraffe", "Hippo"] },
  { clue: "How many edges does a cube have?", answer: "12", wrong: ["8", "6", "16"] },
  { clue: "Which gas do humans need to survive?", answer: "Oxygen", wrong: ["Nitrogen", "Helium", "Methane"] },
  { clue: "What is the square root of 64?", answer: "8", wrong: ["6", "7", "9"] },
  { clue: "How many continents does the equator pass through?", answer: "3", wrong: ["2", "4", "5"] },
  { clue: "What is the tallest living animal?", answer: "Giraffe", wrong: ["Elephant", "Camel", "Ostrich"] },
  { clue: "How many strings does a standard guitar have?", answer: "6", wrong: ["5", "7", "8"] },
  { clue: "What is the main language spoken in Brazil?", answer: "Portuguese", wrong: ["Spanish", "French", "English"] },
  { clue: "Which mammal is the only one that can truly fly?", answer: "Bat", wrong: ["Flying squirrel", "Colugo", "Lemur"] },
  { clue: "How many degrees are in a full circle?", answer: "360", wrong: ["300", "400", "450"] },
  { clue: "What is the chemical symbol for iron?", answer: "Fe", wrong: ["Ir", "In", "Fo"] },
  { clue: "How many planets are in our solar system?", answer: "8", wrong: ["9", "7", "10"] },
  { clue: "Which sense is associated with the tongue?", answer: "Taste", wrong: ["Touch", "Smell", "Sight"] },
  { clue: "What is the largest hot desert in the world?", answer: "Sahara", wrong: ["Gobi", "Kalahari", "Arabian"] },
  { clue: "How many wheels does a standard bicycle have?", answer: "2", wrong: ["3", "4", "1"] },
  { clue: "What is the study of plants called?", answer: "Botany", wrong: ["Zoology", "Geology", "Ecology"] },
  { clue: "Which animal lays eggs but is a mammal?", answer: "Platypus", wrong: ["Whale", "Dolphin", "Kangaroo"] },
  { clue: "How many letters are in the English alphabet?", answer: "26", wrong: ["25", "27", "24"] },
  { clue: "What is the boiling point of water in Celsius?", answer: "100", wrong: ["90", "110", "120"] },
  { clue: "Which planet is famous for its bright rings?", answer: "Saturn", wrong: ["Jupiter", "Neptune", "Mars"] },
  { clue: "How many zeros are in one million?", answer: "6", wrong: ["5", "7", "8"] },
  { clue: "What is the distance around a circle called?", answer: "Circumference", wrong: ["Diameter", "Radius", "Area"] },
  { clue: "What is the smallest country in the world?", answer: "Vatican City", wrong: ["Monaco", "San Marino", "Liechtenstein"] },
  { clue: "How many days are in a common year?", answer: "365", wrong: ["364", "366", "360"] },
  { clue: "What is the chemical symbol for silver?", answer: "Ag", wrong: ["Si", "Se", "Al"] },
  { clue: "Which planet do humans live on?", answer: "Earth", wrong: ["Mars", "Venus", "Jupiter"] },
  { clue: "How many faces does a standard die have?", answer: "6", wrong: ["4", "8", "12"] },
  { clue: "What is the largest organ of the human body?", answer: "Skin", wrong: ["Liver", "Brain", "Heart"] },
  { clue: "Which fruit is said to keep the doctor away?", answer: "Apple", wrong: ["Banana", "Orange", "Grape"] },
  { clue: "How many minutes are in a full day?", answer: "1440", wrong: ["1200", "1500", "1320"] },
  { clue: "What is the study of weather called?", answer: "Meteorology", wrong: ["Astronomy", "Geology", "Hydrology"] },
  { clue: "Which instrument has 88 keys?", answer: "Piano", wrong: ["Organ", "Harp", "Accordion"] },
  { clue: "How many hearts does an octopus have?", answer: "3", wrong: ["2", "4", "1"] },
  { clue: "What is the capital of Japan?", answer: "Tokyo", wrong: ["Kyoto", "Osaka", "Seoul"] },
  { clue: "Which element makes up most of the Sun?", answer: "Hydrogen", wrong: ["Helium", "Oxygen", "Carbon"] },
  { clue: "How many sides does a pentagon have?", answer: "5", wrong: ["6", "4", "7"] },
  { clue: "What is a group of lions called?", answer: "Pride", wrong: ["Pack", "Herd", "Gaggle"] },
  { clue: "Which planet is the hottest in the solar system?", answer: "Venus", wrong: ["Mercury", "Mars", "Jupiter"] },
  { clue: "What is the total of a triangle's angles?", answer: "180", wrong: ["360", "90", "270"] },
  { clue: "Which is the largest species of bear?", answer: "Polar bear", wrong: ["Grizzly bear", "Black bear", "Sun bear"] },
  { clue: "What is the main ingredient in guacamole?", answer: "Avocado", wrong: ["Tomato", "Onion", "Lime"] },
  { clue: "How many bones are in an adult human body?", answer: "206", wrong: ["210", "200", "300"] },
  { clue: "Which planet is known as the Morning Star?", answer: "Venus", wrong: ["Mars", "Mercury", "Jupiter"] },
  { clue: "What do we call a three-sided shape?", answer: "Triangle", wrong: ["Square", "Pentagon", "Hexagon"] },
  { clue: "Which animal is the fastest runner on land?", answer: "Cheetah", wrong: ["Lion", "Horse", "Gazelle"] },
  { clue: "How many strings does a standard violin have?", answer: "4", wrong: ["5", "6", "3"] },
  { clue: "What is the chemical symbol for sodium?", answer: "Na", wrong: ["So", "Sd", "No"] },
  { clue: "Which season is the coldest in the northern hemisphere?", answer: "Winter", wrong: ["Summer", "Spring", "Autumn"] },
  { clue: "What is the largest big cat in the world?", answer: "Tiger", wrong: ["Lion", "Jaguar", "Leopard"] },
  { clue: "How many time zones does China officially use?", answer: "One", wrong: ["Four", "Five", "Three"] },
  { clue: "Which vitamin does sunlight help the skin make?", answer: "Vitamin D", wrong: ["Vitamin C", "Vitamin A", "Vitamin B12"] },
  { clue: "Animals active mainly at dawn and dusk are called…", answer: "Crepuscular", wrong: ["Nocturnal", "Diurnal", "Arboreal"] },
  { clue: "How many rings are on the Olympic flag?", answer: "5", wrong: ["6", "4", "7"] },
  { clue: "What is the capital of Egypt?", answer: "Cairo", wrong: ["Alexandria", "Giza", "Luxor"] },
  { clue: "Which gas is most abundant in Earth's atmosphere?", answer: "Nitrogen", wrong: ["Oxygen", "Carbon dioxide", "Argon"] },
  { clue: "Approximately how fast is light in km per second?", answer: "300,000", wrong: ["150,000", "500,000", "1,000,000"] },
  { clue: "Which animal has black and white stripes?", answer: "Zebra", wrong: ["Tiger", "Panda", "Skunk"] },
  { clue: "What is the study of insects called?", answer: "Entomology", wrong: ["Ornithology", "Ichthyology", "Herpetology"] },
  { clue: "How many grams are in a kilogram?", answer: "1000", wrong: ["100", "500", "10,000"] },
  { clue: "Which is the largest bone in the human body?", answer: "Femur", wrong: ["Tibia", "Humerus", "Fibula"] },
  { clue: "What is a group of crows called?", answer: "A murder", wrong: ["A gaggle", "A parliament", "A shrewdness"] },
  { clue: "Which planet spins almost completely on its side?", answer: "Uranus", wrong: ["Neptune", "Saturn", "Mars"] },
  { clue: "What grain is the base of a classic risotto?", answer: "Rice", wrong: ["Barley", "Wheat", "Corn"] },
  { clue: "How many long sides does a square have?", answer: "4", wrong: ["3", "5", "6"] },
  { clue: "Which sea creature has three hearts?", answer: "Octopus", wrong: ["Squid", "Crab", "Lobster"] },
];

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

export default function QuadGuess({ gameId = "quad-guess" }: { gameId?: string }) {
  const { best, submit } = useBestScore(gameId, "high");

  const [status, setStatus] = useState<Status>("idle");
  const [round, setRound] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle>(BANK[0]);
  const [options, setOptions] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [wrongs, setWrongs] = useState(0);
  const [newBest, setNewBest] = useState(false);

  const advanceTimer = useRef<number | null>(null);
  const deckRef = useRef<Puzzle[]>([BANK[0]]);

  useEffect(
    () => () => {
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    },
    [],
  );

  const multiplier = Math.min(4, Math.max(1, streak));

  const beginRound = useCallback((deck: Puzzle[], i: number) => {
    const p = deck[i];
    setPuzzle(p);
    setOptions(shuffle([p.answer, ...p.wrong]));
    setPicked(null);
  }, []);

  const start = useCallback(() => {
    const deck = shuffle(BANK).slice(0, ROUNDS);
    deckRef.current = deck;
    setRound(0);
    setScore(0);
    setStreak(0);
    setCleared(0);
    setWrongs(0);
    setStatus("playing");
    setNewBest(false);
    beginRound(deck, 0);
  }, [beginRound]);

  const choose = useCallback(
    (optionIndex: number) => {
      if (status !== "playing" || picked !== null) return;
      setPicked(optionIndex);
      const correct = options[optionIndex] === puzzle.answer;

      const nextScore = correct ? score + BASE_POINTS * multiplier : score;
      const nextStreak = correct ? streak + 1 : 0;
      const nextCleared = cleared + (correct ? 1 : 0);
      const nextWrongs = wrongs + (correct ? 0 : 1);
      setScore(nextScore);
      setStreak(nextStreak);
      setCleared(nextCleared);
      setWrongs(nextWrongs);

      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => {
        if (nextWrongs >= MAX_WRONG || round + 1 >= ROUNDS) {
          setStatus("over");
          setNewBest(submit(nextScore));
        } else {
          const next = round + 1;
          setRound(next);
          beginRound(deckRef.current, next);
        }
      }, 950);
    },
    [status, picked, options, puzzle, score, multiplier, streak, cleared, wrongs, round, beginRound, submit],
  );

  useEffect(() => {
    if (status !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        choose(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, choose]);

  const heartsLeft = MAX_WRONG - wrongs;

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Round <b className="ml-1 text-sm text-ink">{Math.min(round + 1, ROUNDS)}/{ROUNDS}</b>
        </span>
        <span className="text-warn">
          ×{multiplier} <b className="ml-0.5 text-sm text-ink">{streak}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(34,211,238,0.5)] sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Pick one
          </span>
          <span className="flex gap-1">
            {Array.from({ length: MAX_WRONG }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  i < heartsLeft ? "bg-rose-400" : "bg-line",
                )}
              />
            ))}
          </span>
        </div>

        <p className="min-h-16 text-center font-display text-lg font-bold leading-snug text-ink sm:text-xl">
          {puzzle.clue}
        </p>

        <div className="mt-4 grid gap-2">
          {options.map((option, i) => {
            const isAnswer = option === puzzle.answer;
            const isPicked = picked === i;
            const revealed = picked !== null;
            return (
              <button
                key={option}
                type="button"
                onClick={() => choose(i)}
                disabled={revealed}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                  revealed && isAnswer
                    ? "border-emerald-400 bg-emerald-500/15"
                    : revealed && isPicked
                      ? "border-rose-500 bg-rose-500/15"
                      : "border-line bg-[#131322] hover:border-primary/60 hover:bg-surface",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line font-mono text-xs font-bold",
                    revealed && isAnswer
                      ? "border-emerald-400 text-emerald-300"
                      : revealed && isPicked
                        ? "border-rose-500 text-rose-400"
                        : "text-muted",
                  )}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-ink">{option}</span>
                {revealed && isAnswer && <span className="ml-auto text-emerald-300">✓</span>}
                {revealed && isPicked && !isAnswer && <span className="ml-auto text-rose-400">✕</span>}
              </button>
            );
          })}
        </div>

        {status === "idle" && (
          <Overlay>
            <p className="text-4xl">🎯</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              ONE RIGHT ANSWER
            </p>
            <p className="mt-2 text-sm text-muted">
              Ten questions, three misses allowed. Consecutive hits stack a ×4 multiplier.
            </p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">
              Start run
            </PrimaryButton>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="text-4xl">{wrongs >= MAX_WRONG ? "💥" : "🏆"}</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              {wrongs >= MAX_WRONG ? "RUN OVER" : "PERFECT RUN"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · {cleared} of {ROUNDS} cleared
            </p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap an answer or press 1–4 · streaks build the multiplier
      </p>
    </div>
  );
}
