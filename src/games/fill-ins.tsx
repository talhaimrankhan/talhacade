"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

interface Item {
  sentence: string;
  correct: string;
  wrong: string[];
}

/** [sentence with ___, correct, wrong1, wrong2, wrong3] */
const RAW: [string, string, string, string, string][] = [
  ["She packed the apples into a wooden ___.", "crate", "crown", "crumb", "cruise"],
  ["The library is quiet and full of ___.", "books", "cooks", "looks", "hooks"],
  ["He ___ the ball over the fence.", "threw", "through", "thought", "threat"],
  ["Please ___ the door when you leave.", "close", "clause", "clasp", "clerk"],
  ["The ___ roads shimmered after the rain.", "wet", "wide", "war", "win"],
  ["A caterpillar turns into a ___.", "butterfly", "dragonfly", "ladybug", "firefly"],
  ["Grandma knitted a warm ___ for the winter.", "scarf", "scar", "sketch", "square"],
  ["Be careful, the pan is very ___.", "hot", "pot", "hat", "hit"],
  ["The dog buried a bone in the ___.", "garden", "guardian", "garment", "garbage"],
  ["We set up a tent on the ___.", "campsite", "capsule", "carnival", "cassette"],
  ["Add a pinch of ___ to the soup.", "salt", "shot", "silk", "soil"],
  ["The sun sets in the ___.", "west", "east", "rest", "feast"],
  ["She won a gold ___ at the ceremony.", "medal", "metal", "model", "motel"],
  ["Please ___ your hands before dinner.", "wash", "wish", "wade", "waste"],
  ["An elephant is a huge ___.", "animal", "annual", "ankle", "arena"],
  ["The kite flew high in the ___.", "sky", "shy", "spy", "sly"],
  ["He told a funny ___ to the whole class.", "joke", "juice", "jacket", "jungle"],
  ["A cold glass of water on a hot day is ___.", "refreshing", "returning", "recording", "refusing"],
  ["Birds ___ south when the leaves turn brown.", "migrate", "mitigate", "meditate", "mention"],
  ["The museum was full of ancient ___.", "artifacts", "artillery", "artist", "artificial"],
  ["Sign your name at the ___ of the page.", "bottom", "bottle", "bridge", "blanket"],
  ["The train pulled into the ___.", "station", "situation", "stadium", "studio"],
  ["He ___ the rope tightly to the post.", "tied", "tried", "ride", "ridden"],
  ["A large group of fish is called a ___.", "school", "scholar", "scissors", "scooter"],
  ["The bread is baked in an ___.", "oven", "over", "open", "oxen"],
  ["She wore a red ___ to the party.", "dress", "stress", "drift", "drought"],
  ["Please keep the milk in the ___.", "fridge", "bridge", "fringe", "fright"],
  ["Rabbits hop across the ___.", "meadow", "medal", "melody", "mirror"],
  ["The faucet dripped ___ onto the floor.", "slowly", "snowy", "lonely", "sloppy"],
  ["He ___ his fingers on the desk while waiting.", "tapped", "tipped", "tugged", "torn"],
  ["A baby deer is called a ___.", "fawn", "lawn", "fern", "fin"],
  ["The camel crossed the hot ___.", "desert", "dessert", "desk", "detail"],
  ["Bees collect ___ from the flowers.", "nectar", "negative", "necklace", "neat"],
  ["She planted ___ seeds along the fence.", "sunflower", "sunburn", "sunrise", "sunbeam"],
  ["The witch flew through the night on a ___.", "broom", "bloom", "bridge", "breath"],
  ["Ice is ___ than liquid water.", "colder", "cold", "coldest", "freeze"],
  ["Write your answer in your ___.", "notebook", "notable", "notice", "notion"],
  ["The athlete ran at full ___.", "speed", "breed", "spread", "spend"],
  ["A spider spins a ___ to catch flies.", "web", "worm", "wing", "wave"],
  ["Cut the paper with a pair of ___.", "scissors", "scales", "screws", "shovel"],
  ["The moon shines brightly at ___.", "night", "right", "noon", "nine"],
  ["She kept the letter in a sealed ___.", "envelope", "energy", "event", "engine"],
  ["The library charges a fine for ___ books.", "overdue", "under", "upper", "undo"],
  ["A circle has no ___.", "corners", "cores", "cords", "colors"],
  ["The plumber fixed the leaking ___.", "pipe", "pine", "pill", "pot"],
  ["He scored the winning ___ in the final minute.", "goal", "coal", "gale", "goat"],
  ["The hikers reached the top of the ___.", "mountain", "fountain", "mounting", "amount"],
  ["Stir the batter until it is perfectly ___.", "smooth", "sharp", "salty", "sour"],
  ["The referee blew the loud ___.", "whistle", "thistle", "wrestle", "wisdom"],
  ["Snow fell softly from the gray ___.", "clouds", "clods", "crowds", "cords"],
  ["Cats love to chase a ball of ___.", "yarn", "yell", "yard", "yawn"],
  ["The knight wore shining ___.", "armor", "aroma", "anchor", "animal"],
  ["Water boils at one hundred ___ at sea level.", "degrees", "regrets", "rewards", "records"],
  ["The chef chopped the vegetables into small ___.", "pieces", "peace", "peanut", "pickle"],
  ["A spider has eight ___.", "legs", "leads", "leaves", "leans"],
  ["She ___ a beautiful song for everyone.", "sang", "sung", "song", "ring"],
  ["The old house stood empty and ___.", "hollow", "follow", "fellow", "furrow"],
  ["Keep your elbows off the ___.", "table", "fable", "cable", "stable"],
  ["He felt completely ___ after the long run.", "exhausted", "exhausting", "exercise", "example"],
  ["The puppy chewed up one old ___.", "slipper", "supper", "slider", "sleep"],
  ["Volcanoes erupt hot ___ and ash.", "lava", "lawn", "label", "lamp"],
  ["The owl slept through the bright ___.", "daylight", "discovery", "delay", "delight"],
  ["She ___ the whole puzzle in five minutes.", "solved", "shoulder", "solvent", "sofa"],
  ["Sharks live in the open ___.", "ocean", "orbit", "onion", "orange"],
  ["Your card lets you ___ books from the library.", "borrow", "borough", "berry", "barrel"],
  ["She wrote her name with a blue ___.", "pen", "pin", "pan", "pine"],
  ["The horse galloped across the open ___.", "field", "yield", "filter", "filled"],
  ["Ice cream melts quickly in the ___.", "heat", "hut", "hat", "hit"],
  ["The children played on the sandy ___.", "beach", "bench", "branch", "breech"],
  ["He ___ the ancient map and put it away.", "folded", "folder", "frozen", "found"],
  ["A ___ of wolves howled at the moon.", "pack", "park", "pick", "peck"],
  ["The bakery sells fresh ___ every morning.", "bread", "beard", "break", "broad"],
  ["She hung the wet clothes on the ___.", "line", "lime", "lion", "lane"],
  ["The sudden noise made me ___.", "jump", "juice", "jewel", "jungle"],
  ["Pirates bury their treasure on a secret ___.", "island", "ivory", "itch", "iron"],
  ["The cat ___ lazily in the afternoon sun.", "stretched", "strict", "street", "strike"],
  ["You need a ticket to ___ the cinema.", "enter", "center", "entire", "eaten"],
  ["The mountain path was steep and ___.", "rocky", "ducky", "ricky", "smoky"],
  ["The candle flickered in the dark ___.", "corner", "coroner", "corn", "core"],
  ["Fruit grows on trees in an ___.", "orchard", "orchid", "ordeal", "ordinary"],
  ["The soldiers ___ the bridge through the night.", "guarded", "garden", "guarantee", "guardrail"],
  ["Do not ___ on the freshly waxed floor.", "slip", "sip", "slap", "ship"],
  ["The printer has run out of ___ paper.", "blank", "black", "blanket", "blanch"],
  ["He dropped the coin down a wishing ___.", "well", "wall", "will", "wheel"],
  ["The scarecrow stood in the corn ___.", "field", "feast", "fiber", "flour"],
];

const BANK: Item[] = RAW.map(([sentence, correct, w1, w2, w3]) => ({
  sentence,
  correct,
  wrong: [w1, w2, w3],
}));

const ROUNDS = 10;
const MAX_WRONG = 3;
const BASE_POINTS = 100;
const TONE = "from-teal-400 via-emerald-500 to-green-600";

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

export default function FillIns() {
  const { best, submit } = useBestScore("fill-ins", "high");

  const [status, setStatus] = useState<Status>("idle");
  const [round, setRound] = useState(0);
  const [puzzle, setPuzzle] = useState<Item>(BANK[0]);
  const [options, setOptions] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [wrongs, setWrongs] = useState(0);
  const [newBest, setNewBest] = useState(false);

  const advanceTimer = useRef<number | null>(null);
  const deckRef = useRef<Item[]>([BANK[0]]);

  useEffect(
    () => () => {
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    },
    [],
  );

  const multiplier = Math.min(4, Math.max(1, streak));

  const beginRound = useCallback((deck: Item[], i: number) => {
    const next = deck[i];
    setPuzzle(next);
    setOptions(shuffle([next.correct, ...next.wrong]));
    setPicked(null);
  }, []);

  const start = useCallback(() => {
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
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
      const chosen = options[optionIndex];
      if (!chosen) return;
      setPicked(optionIndex);

      const correct = chosen === puzzle.correct;
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
  const sentenceParts = puzzle.sentence.split("___");
  const shownRound = Math.min(round + 1, ROUNDS);

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Sentence <b className="ml-1 text-sm text-ink">{shownRound}/{ROUNDS}</b>
        </span>
        <span className="text-warn">
          ×{multiplier} <b className="ml-0.5 text-sm text-ink">{streak}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(16,185,129,0.6)] sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Fill the blank
          </span>
          <span className="flex gap-1">
            {Array.from({ length: MAX_WRONG }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  i < heartsLeft ? "bg-emerald-400" : "bg-line",
                )}
              />
            ))}
          </span>
        </div>

        <p className="min-h-16 text-center font-display text-lg font-bold leading-snug text-ink sm:text-xl">
          {sentenceParts[0]}
          <span
            className={cn(
              "mx-1 inline-block min-w-24 rounded-md border-b-2 px-2 align-baseline transition-colors",
              picked !== null && options[picked] === puzzle.correct
                ? "border-emerald-400 text-emerald-300"
                : "border-accent text-accent",
            )}
          >
            {picked !== null ? puzzle.correct : "\u00A0"}
          </span>
          {sentenceParts[1]}
        </p>

        <div className="mt-4 grid gap-2">
          {options.map((option, i) => {
            const isAnswer = option === puzzle.correct;
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

        <div className="mt-4 flex justify-center gap-1">
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                i < cleared
                  ? "bg-emerald-400"
                  : i === round && status === "playing"
                    ? "bg-primary"
                    : "bg-line",
              )}
            />
          ))}
        </div>

        {status === "idle" && (
          <Overlay>
            <p className="text-4xl">✏️</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              TEN BLANKS, ONE WORD
            </p>
            <p className="mt-2 text-sm text-muted">
              Pick the word that completes the sentence. Three misses end the run — chain hits for ×4.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start run
            </PrimaryButton>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="text-4xl">{wrongs >= MAX_WRONG ? "💥" : "🏆"}</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              {wrongs >= MAX_WRONG ? "RUN OVER" : "TEN OF TEN"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · {cleared} of {ROUNDS} filled in
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap a word or press 1–4 · keep the streak alive for bigger multipliers
      </p>
    </div>
  );
}
