"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

interface Puzzle {
  /** First letters, top to bottom, spell the answer. */
  lines: string[];
  /** Accepted answers (lowercase). */
  answers: string[];
}

const BANK: Puzzle[] = [
  {
    answers: ["candle"],
    lines: [
      "Climbing flame on a waxen stem,",
      "A small warm glow in a dark room,",
      "Nursed to life by a single match,",
      "Dripping soft wax down its side,",
      "Lost at last when the wick is pinched,",
      "Embers gone with nothing to hide,",
    ],
  },
  {
    answers: ["garden"],
    lines: [
      "Ground turned over with a spade,",
      "A patch of roses proudly displayed,",
      "Roots that drink the morning rain,",
      "Dirt that hides the worm&apos;s dark lane,",
      "Every vegetable neatly laid,",
      "Nature&apos;s own small green parade,",
    ],
  },
  {
    answers: ["robot"],
    lines: [
      "Runs on circuits, never sleeps,",
      "Obeys each task it is given,",
      "Built by hands, though nothing weeps,",
      "Often stronger than any person,",
      "Talks and moves without a question,",
    ],
  },
  {
    answers: ["shadow"],
    lines: [
      "Silent, dark, and never still,",
      "Hugging walls against your will,",
      "Always copying what you do,",
      "Darker when the light is low,",
      "Only there when sunshine shows,",
      "Wherever you walk, it goes,",
    ],
  },
  {
    answers: ["thunder"],
    lines: [
      "The great boom after every flash,",
      "Heard while storm clouds clash,",
      "Underneath the rolling sky,",
      "Nobody can quiet its cry,",
      "Distant first, then loud and near,",
      "Echoing so all can hear,",
      "Rumbling on from here to there,",
    ],
  },
  {
    answers: ["bridge"],
    lines: [
      "Built of timber, steel, and stone,",
      "Reaching across the stream alone,",
      "It joins both sides where water flows,",
      "Dozens crossing every day,",
      "Getting every traveler home,",
      "Ending where the far road goes,",
    ],
  },
  {
    answers: ["compass"],
    lines: [
      "Carried in a coat or pack,",
      "Only useful when you lack,",
      "Metal needle, thin and bright,",
      "Pointing north, then left and right,",
      "A tiny disk of glass and steel,",
      "Steady as a sailor&apos;s will,",
      "Safe upon the ocean still,",
    ],
  },
  {
    answers: ["winter"],
    lines: [
      "When the first flakes start to fall,",
      "Ice upon the garden wall,",
      "Numb the fingers and the toes,",
      "The season everyone knows,",
      "Every branch stands bare and thin,",
      "Ready for the spring again,",
    ],
  },
  {
    answers: ["lantern"],
    lines: [
      "Little light that sailors kept,",
      "A glow inside a glass-walled cup,",
      "Now it guides the camper&apos;s step,",
      "Through the woods when stars are up,",
      "Even darkness cannot hide,",
      "Resting when the sun is high,",
      "Nursing just a flame inside,",
    ],
  },
  {
    answers: ["pirate"],
    lines: [
      "Plunderer who sails the sea,",
      "In search of buried gold,",
      "Rum and rope and loyalty,",
      "Anchor dropped on a shore untold,",
      "Taking every coin in sight,",
      "Ever hidden from the law&apos;s light,",
    ],
  },
  {
    answers: ["castle"],
    lines: [
      "Crumbling keep upon a hill,",
      "Around the moat the water is still,",
      "Stone by stone the walls were raised,",
      "Tall and built to never yield,",
      "Lords and ladies fill the hall,",
      "Every king has walked the wall,",
    ],
  },
  {
    answers: ["dragon"],
    lines: [
      "Deep in caves the legend sleeps,",
      "Red-hot breath the farmer fears,",
      "Ancient, armored, huge, and loud,",
      "Golden hoards it guards alone,",
      "Only knights of valor shown,",
      "None have ever tamed the beast,",
    ],
  },
  {
    answers: ["engine"],
    lines: [
      "Every car relies on me,",
      "Nothing moves until I roar,",
      "Gears and pistons working free,",
      "I drink the fuel, then give more,",
      "Noise and heat are what I make,",
      "Each new mile I gladly take,",
    ],
  },
  {
    answers: ["forest"],
    lines: [
      "Ferns and moss beneath my crown,",
      "Oak and pine of great renown,",
      "Roots that knot the woodland floor,",
      "Echo of a distant roar,",
      "Stags and foxes call it home,",
      "Towering where the wild things roam,",
    ],
  },
  {
    answers: ["harvest"],
    lines: [
      "Hills of wheat in golden rows,",
      "Autumn air and colder toes,",
      "Reaping all the season grew,",
      "Vegetables in wheelbarrows piled,",
      "Every crate and cellar stored,",
      "So much gathered, nothing hoarded,",
      "Time to rest when work is done,",
    ],
  },
  {
    answers: ["island"],
    lines: [
      "In seas so wide and blue,",
      "Sandy shores in full view,",
      "Lapping waves on every side,",
      "Always palms and sun that shine,",
      "Noise of gulls upon the tide,",
      "Dot of green the sailors spied,",
    ],
  },
  {
    answers: ["jungle"],
    lines: [
      "Jaunt beneath a canopy,",
      "Undergrowth as thick as can be,",
      "Nowhere else so wild and free,",
      "Green leaves hiding what we see,",
      "Lions and parrots pass us by,",
      "Every step a new surprise,",
    ],
  },
  {
    answers: ["kettle"],
    lines: [
      "Kept beside the kitchen flame,",
      "Empty until you fill it up,",
      "Tiny spout that pours a cup,",
      "Two quick notes when it is done,",
      "Lifting lids and steam that curls,",
      "Everyone in the kitchen learns,",
    ],
  },
  {
    answers: ["marble"],
    lines: [
      "Many colors, smooth and round,",
      "Always found upon the ground,",
      "Rolling fast down gutters wide,",
      "Boys and girls in every land,",
      "Lucky shooters take their stand,",
      "Every player lends a hand,",
    ],
  },
  {
    answers: ["orchid"],
    lines: [
      "Often grown in glass and heat,",
      "Rare white petals, crisp and sweet,",
      "Curled in shapes you have rarely seen,",
      "Hung in pots of living green,",
      "In the jungle air it clings,",
      "Dotted bright on tiny strings,",
    ],
  },
  {
    answers: ["pebble"],
    lines: [
      "Passed from hand to skipping flight,",
      "Endless numbers on the beach,",
      "Buried under waves each night,",
      "Beautiful in morning light,",
      "Little stone the river churns,",
      "Every boot has crushed a few,",
    ],
  },
  {
    answers: ["penguin"],
    lines: [
      "Plush-coated diver of the south,",
      "Evolved to swim, not fly,",
      "Never far from icy water,",
      "Gliding where the cold winds gather,",
      "Unafraid of frost or snow,",
      "In a tuxedo, standing tall,",
      "No one waddles quite so slow,",
    ],
  },
  {
    answers: ["queen"],
    lines: [
      "Quietly she wears the crown,",
      "Unmatched in any royal town,",
      "Every decree is law,",
      "Elevated above the crowd,",
      "Nobles bow and speak aloud,",
    ],
  },
  {
    answers: ["rabbit"],
    lines: [
      "Racing off without a sound,",
      "Always hopping over ground,",
      "Burrows deep beneath the hill,",
      "Brown and soft and hopping still,",
      "In the garden, nibbling greens,",
      "Two long ears and twitching nose,",
    ],
  },
  {
    answers: ["rocket"],
    lines: [
      "Roaring loud on a pillar of fire,",
      "Over rooftops climbing higher,",
      "Cutting through the upper air,",
      "Knowing just where it must steer,",
      "Every stage that falls away,",
      "Toward the stars it blazes on,",
    ],
  },
  {
    answers: ["silver"],
    lines: [
      "Shining brighter than the moon,",
      "In rings and coins it is often strewn,",
      "Loose as change in any hand,",
      "Verses praise its subtle sheen,",
      "Every spoon the kitchen has seen,",
      "Riches that outlast the man,",
    ],
  },
  {
    answers: ["temple"],
    lines: [
      "Towering stones of ancient hands,",
      "Echoing where the priest stands,",
      "Many kneel in silent prayer,",
      "Pillars holding up the sky,",
      "Lost to time but standing still,",
      "Every visitor is awed,",
    ],
  },
  {
    answers: ["umbrella"],
    lines: [
      "Up above the rain it opens wide,",
      "Made of cloth on spokes of pride,",
      "Bent in wind but holding true,",
      "Round and bright in every hue,",
      "Every pocket holds one tight,",
      "Long and slim when folded flat,",
      "Leaning by the hallway mat,",
      "Awaiting any storm to come,",
    ],
  },
  {
    answers: ["velvet"],
    lines: [
      "Very soft upon the skin,",
      "Every royal robe within,",
      "Lining boxes, books, and capes,",
      "Violet, red, and green drapes,",
      "Evening gowns of perfect sheen,",
      "Touch it once and you will know what I mean,",
    ],
  },
  {
    answers: ["walnut"],
    lines: [
      "Whispering husks on autumn lawns,",
      "Always crunchy, always brown,",
      "Lined in shells both ridged and round,",
      "Never sweet, but never plain,",
      "Used by bakers, pie-crust bound,",
      "Toasted, salted, passed around,",
    ],
  },
  {
    answers: ["anchor"],
    lines: [
      "Always heavy, always true,",
      "Never moving once it is thrown,",
      "Chains that hold the ship alone,",
      "Holding fast through wind and roar,",
      "Old tattoos of sailors lore,",
      "Resting deep beneath the oar,",
    ],
  },
  {
    answers: ["blanket"],
    lines: [
      "Beneath you on the sofa lie,",
      "Layered warm for winter nights,",
      "Around your bed, pulled to your chin,",
      "Never letting the cold win,",
      "Knitted, woven, fleeced, or sewn,",
      "Every bedroom has its own,",
      "Tucked in snug, you are never alone,",
    ],
  },
  {
    answers: ["circus"],
    lines: [
      "Colorful tents upon the field,",
      "Illusionists and acts revealed,",
      "Rings where clowns and acrobats spin,",
      "Cotton candy begins to thin,",
      "Under the big top wonders wake,",
      "Sawdust, laughter, and one more cake,",
    ],
  },
  {
    answers: ["dolphin"],
    lines: [
      "Deep where waves and currents run,",
      "Ocean friends who love to play,",
      "Leaping high beneath the sun,",
      "Powerful swimmers, never done,",
      "Hunting fish in silver schools,",
      "In pods they talk with clicks and tones,",
      "Never far from ocean homes,",
    ],
  },
  {
    answers: ["elephant"],
    lines: [
      "Enormous ears and wrinkled skin,",
      "Largest of all the land beasts known,",
      "Eyes that rarely ever forget,",
      "Plant-munching, gentle, and grand,",
      "Herd-living across the sand,",
      "Awesome from tail to toe,",
      "Nobody forgets this sight,",
      "Towering over all in height,",
    ],
  },
  {
    answers: ["feather"],
    lines: [
      "Falling softly from a wing,",
      "Every bird is clad in this,",
      "Airborne, weightless, whispering,",
      "Tickling those who dare to sing,",
      "Hearts grow light at just one touch,",
      "Everything that gives down comfort,",
      "Rising on a breeze so free,",
    ],
  },
  {
    answers: ["hammock"],
    lines: [
      "Hung between two steady trees,",
      "Attached with ropes and easy ease,",
      "Made of canvas, rope, or net,",
      "Mornings in it, nothing better yet,",
      "Ocean-side it swings alone,",
      "Counting clouds until they are gone,",
      "Keeping sleepers gently rocked,",
    ],
  },
  {
    answers: ["igloo"],
    lines: [
      "In the far north, built of blocks,",
      "Glazed with frost around the locks,",
      "Lodging carved from frozen snow,",
      "Only warmth a lamp can throw,",
      "Once inside you will never want to go,",
    ],
  },
  {
    answers: ["jigsaw"],
    lines: [
      "Joining wooden shapes with care,",
      "In the box they hide their pair,",
      "Got to fit them edge to edge,",
      "Scene of hills or lakeside ledge,",
      "Always losing that one piece,",
      "Weary searchers never cease,",
    ],
  },
  {
    answers: ["kangaroo"],
    lines: [
      "Kicking strong across the plains,",
      "Always a pouch it carries,",
      "Never far the joey goes,",
      "Grazing all across the plain,",
      "Always ready with a bound,",
      "Racing over open ground,",
      "One leap never makes a sound,",
      "Outback is where it is always found,",
    ],
  },
  {
    answers: ["library"],
    lines: [
      "Lending tales of every kind,",
      "In rows the silent people stand,",
      "Books that change what is in your mind,",
      "Reading rooms you will always find,",
      "Aisles of whisper and of hush,",
      "Research and reference hush,",
      "Your next favorite tale lives on,",
    ],
  },
  {
    answers: ["magnet"],
    lines: [
      "Metal leaps to meet my face,",
      "Always pulling from a space,",
      "Grab the fridge-door note and stay,",
      "Never letting iron stray,",
      "East and north, the poles align,",
      "Tugging needles just in time,",
    ],
  },
  {
    answers: ["oyster"],
    lines: [
      "Odd gray shell upon the reef,",
      "Yielding pearls beyond belief,",
      "Salty, slick, and served on ice,",
      "Taken from the mud with tongs,",
      "Every chef adores their source,",
      "Raw or roasted, never forced,",
    ],
  },
  {
    answers: ["pumpkin"],
    lines: [
      "Plump and orange in the patch,",
      "Underneath the autumn hatch,",
      "Massive pies on every table,",
      "Planted rows of orange labels,",
      "Knives carve faces, teeth, and eyes,",
      "In the patch it softly lies,",
      "Nourished by the cooler skies,",
    ],
  },
  {
    answers: ["wizard"],
    lines: [
      "Waving wands of ancient spell,",
      "In a tower, brewing well,",
      "Zapping sparks from wooden rods,",
      "Alchemy at his command,",
      "Riddles solved with wave of hand,",
      "Deep in books, the mystic stands,",
    ],
  },
  {
    answers: ["frost"],
    lines: [
      "Frozen ferns on grassy floor,",
      "Rime that coats the garden door,",
      "Only when the cold winds blow,",
      "Silent, silver, glinting low,",
      "Tiny blades beneath the moon,",
    ],
  },
  {
    answers: ["storm"],
    lines: [
      "Screaming through the open sky,",
      "Tearing clouds as they go by,",
      "Only fools stay out too long,",
      "Rain and thunder, wild and strong,",
      "Mountains of cloud begin to form,",
    ],
  },
  {
    answers: ["trumpet"],
    lines: [
      "Tubing brass with valves and shine,",
      "Ringing loud through every hall,",
      "Under every parade&apos;s call,",
      "Made to blast and never sulk,",
      "Players lips against the brass,",
      "Every fanfare starts this way,",
      "Tooting proudly till the day,",
    ],
  },
  {
    answers: ["voyage"],
    lines: [
      "Vast expeditions out to sea,",
      "Over oceans, wild and free,",
      "Years away from any pier,",
      "Anchor-less and full of cheer,",
      "Grand return with tales to tell,",
      "Every sailor knows it well,",
    ],
  },
];

const PUZZLES_PER_RUN = 3;
const REVEAL_COST = 5;
const TONE = "from-blue-400 via-indigo-500 to-violet-600";
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const MAX_TEN = 10;

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

export default function AcrosticReveal() {
  const { best, submit } = useBestScore("acrostic-reveal", "low");

  const [status, setStatus] = useState<Status>("idle");
  const [deck, setDeck] = useState<Puzzle[]>([BANK[0]]);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [typed, setTyped] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [penalty, setPenalty] = useState(0);
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
    const nextDeck = shuffle(BANK).slice(0, PUZZLES_PER_RUN);
    setDeck(nextDeck);
    setPuzzleIndex(0);
    setRevealed(0);
    setTyped("");
    setSeconds(0);
    setPenalty(0);
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

  const revealLine = useCallback(() => {
    if (status !== "playing") return;
    const puzzle = deck[puzzleIndex];
    if (!puzzle || revealed >= puzzle.lines.length) return;
    setRevealed(revealed + 1);
    setPenalty(penalty + REVEAL_COST);
  }, [status, deck, puzzleIndex, revealed, penalty]);

  const submitAnswer = useCallback(() => {
    if (status !== "playing") return;
    const puzzle = deck[puzzleIndex];
    if (!puzzle) return;
    const guess = typed.trim().toLowerCase();
    if (guess.length === 0) return;

    if (puzzle.answers.includes(guess)) {
      const nextIndex = puzzleIndex + 1;
      setTyped("");
      setRevealed(0);
      if (nextIndex >= PUZZLES_PER_RUN) {
        setRunning(false);
        setStatus("over");
        setNewBest(submit(seconds + penalty));
      } else {
        setPuzzleIndex(nextIndex);
      }
      return;
    }

    setTyped("");
    flashWrong();
  }, [status, deck, puzzleIndex, typed, seconds, penalty, submit, flashWrong]);

  const press = useCallback(
    (key: string) => {
      if (status !== "playing") return;
      if (key === "enter") {
        submitAnswer();
      } else if (key === "back") {
        setTyped((t) => t.slice(0, -1));
      } else if (typed.length < MAX_TEN) {
        setTyped((t) => t + key);
      }
    },
    [status, typed.length, submitAnswer],
  );

  useEffect(() => {
    if (status !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitAnswer();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setTyped((t) => t.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        setTyped((t) => (t.length < MAX_TEN ? t + e.key.toLowerCase() : t));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, submitAnswer]);

  const puzzle = deck[puzzleIndex];
  const shownTime = seconds + penalty;
  const answerLetters = (puzzle?.answers[0] ?? "").split("");

  return (
    <div className="w-full max-w-[560px]">
      <GameHud
        score={`${shownTime}s`}
        best={best === null ? "—" : `${best}s`}
      >
        <span>
          Verse <b className="ml-1 text-sm text-ink">{Math.min(puzzleIndex + 1, PUZZLES_PER_RUN)}/{PUZZLES_PER_RUN}</b>
        </span>
        <span className="text-warn">
          <b className="text-sm text-ink">{revealed}</b> revealed
        </span>
        {penalty > 0 && <span className="text-warn">+{penalty}s</span>}
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(99,102,241,0.7)] sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Read down the first letters
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {revealed}/{puzzle?.lines.length ?? 0} lines
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {puzzle?.lines.map((line, i) => (
            <div
              key={`${puzzleIndex}-${i}`}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm leading-snug transition sm:text-base",
                i < revealed
                  ? "border-line bg-[#0e0e1c] text-ink"
                  : "border-dashed border-line/70 bg-[#0b0b16] text-transparent",
              )}
            >
              {i < revealed ? (
                <span>
                  <span className="font-display text-lg font-bold text-accent">{line[0]}</span>
                  {line.slice(1)}
                </span>
              ) : (
                "Hidden line — reveal it for time"
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {answerLetters.map((ch, i) => {
            const shown = i < revealed && i < (puzzle?.lines.length ?? 0);
            return (
              <span
                key={`${ch}-${i}`}
                className={cn(
                  "grid h-7 w-6 place-items-center rounded border font-display text-sm font-bold uppercase",
                  shown
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-line bg-[#131322] text-muted",
                )}
              >
                {shown ? ch : "?"}
              </span>
            );
          })}
        </div>

        <div className="mt-4 flex min-h-12 items-center justify-center rounded-xl border border-line bg-[#0e0e1c] px-3 py-2">
          {typed.length === 0 ? (
            <span className="text-sm text-muted">Type the hidden word…</span>
          ) : (
            <span className={cn("font-display text-xl font-bold tracking-widest text-white", wrong && "text-rose-400")}>
              {typed}
              <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-0.5 animate-pulse bg-primary" />
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-1.5 select-none">
          {ROWS.map((row, r) => (
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

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={revealLine}
            disabled={status !== "playing" || !puzzle || revealed >= puzzle.lines.length}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2 disabled:opacity-40"
          >
            Reveal next line (+{REVEAL_COST}s)
          </button>
          <button
            type="button"
            onClick={submitAnswer}
            disabled={status !== "playing" || typed.length === 0}
            className="rounded-lg border border-primary/50 bg-primary/15 px-4 py-2 text-xs font-bold text-ink transition hover:bg-primary/25 disabled:opacity-40"
          >
            Submit word
          </button>
        </div>

        {status === "idle" && (
          <Overlay>
            <p className="text-4xl">📜</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              SPELL IT DOWN THE MARGIN
            </p>
            <p className="mt-2 text-sm text-muted">
              Each verse hides a word in its first letters. Reveal lines for +5s each, then type it — three verses total.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Begin the verses
            </PrimaryButton>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="text-4xl">📜</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              ALL VERSES SOLVED
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
              Best {best === null ? "—" : `${best}s`} · {penalty}s in reveals · 3 of 3
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              New verses
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Reveal lines, read the first letters, type the word · Enter to submit · tap keys on touch
      </p>
    </div>
  );
}
