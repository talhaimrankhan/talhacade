"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const MAX_GUESSES = 20;
const TONE = "from-sky-400 via-blue-500 to-indigo-600";

/** [word, rhyme hint, definition] — every guess must come from this bank. */
const BANK: [string, string, string][] = [
  ["apple", "dapple", "Round fruit that grows on trees"],
  ["beach", "reach", "Sandy land beside the sea"],
  ["bread", "dread", "Baked food made from flour"],
  ["bridge", "ridge", "Way across a river or a road"],
  ["brush", "rush", "Bristled tool for painting or cleaning"],
  ["camera", "drama", "Device that takes photographs"],
  ["candle", "handle", "Wax stick you light on fire"],
  ["castle", "wrestle", "Fortified stone home of kings"],
  ["chair", "stair", "Seat for one person"],
  ["charm", "harm", "Something that draws people in"],
  ["chicken", "thicken", "Farm bird kept for eggs and meat"],
  ["circle", "turtle", "Shape with no corners"],
  ["cloud", "crowd", "Soft white thing that floats in the sky"],
  ["coast", "toast", "Land along the edge of the sea"],
  ["coffee", "toffee", "Hot drink brewed from roasted beans"],
  ["corn", "horn", "Yellow kernels on a cob"],
  ["crab", "grab", "Pinching sea creature with claws"],
  ["cream", "dream", "Thick part of milk"],
  ["crime", "time", "Something against the law"],
  ["crown", "town", "Gold headpiece worn by a king"],
  ["dance", "chance", "Move your body to music"],
  ["diary", "cherry", "Book of private daily notes"],
  ["door", "floor", "You open it to come inside"],
  ["dragon", "wagon", "Fire-breathing creature of legend"],
  ["dream", "stream", "Pictures in your head while asleep"],
  ["drink", "think", "Liquid you swallow"],
  ["eagle", "beetle", "Large bird with sharp eyes"],
  ["earth", "birth", "The planet we live on"],
  ["fan", "man", "Spinning blade that moves air"],
  ["farm", "harm", "Land with crops and animals"],
  ["fence", "tense", "Barrier around a yard"],
  ["field", "yield", "Open land for crops or games"],
  ["fish", "wish", "Animal that swims with fins"],
  ["flame", "name", "The hot visible part of a fire"],
  ["flour", "power", "Powder used for baking"],
  ["floor", "door", "What you stand on indoors"],
  ["flower", "slower", "The colorful part of a plant"],
  ["fly", "sky", "Small insect with two wings"],
  ["fresh", "mesh", "New and recently made"],
  ["fruit", "root", "Sweet thing that grows on trees"],
  ["ghost", "toast", "Spirit of someone who died"],
  ["giant", "pliant", "Enormous person or thing"],
  ["glass", "grass", "Clear material used for windows"],
  ["globe", "robe", "Ball-shaped model of the world"],
  ["glove", "dove", "Covering for your hand"],
  ["grace", "face", "Smooth, elegant movement"],
  ["grain", "rain", "Single seed of wheat or rice"],
  ["grape", "tape", "Small fruit that grows in bunches"],
  ["guard", "card", "Person who watches and protects"],
  ["hair", "chair", "Grows on top of your head"],
  ["hammer", "clamor", "Tool you swing to drive nails"],
  ["heart", "start", "Organ that pumps your blood"],
  ["honey", "money", "Sweet golden stuff made by bees"],
  ["horse", "source", "Animal people ride"],
  ["house", "mouse", "Building where people live"],
  ["human", "rumor", "A person"],
  ["ice", "nice", "Frozen water"],
  ["island", "silent", "Land surrounded by water"],
  ["juice", "goose", "Liquid squeezed from fruit"],
  ["jungle", "tangle", "Dense tropical forest"],
  ["kettle", "settle", "Pot for boiling water"],
  ["knife", "life", "Blade used for cutting"],
  ["ladder", "matter", "Steps for climbing up"],
  ["lamp", "damp", "Gives light on a table"],
  ["laugh", "graph", "What you do when amused"],
  ["letter", "better", "What you write and mail"],
  ["light", "night", "What lets you see"],
  ["lily", "silly", "Flower that floats on ponds"],
  ["lion", "iron", "Big cat called the king of beasts"],
  ["lizard", "wizard", "Small reptile that crawls"],
  ["magic", "tragic", "Spells and illusions"],
  ["mango", "tango", "Sweet tropical fruit"],
  ["mirror", "error", "Shows your reflection"],
  ["monkey", "donkey", "Climbing animal with a long tail"],
  ["moon", "June", "Bright disc in the night sky"],
  ["mouse", "louse", "Small animal with a long tail"],
  ["nature", "creature", "Trees, animals and the outdoors"],
  ["noise", "voice", "Sound you hear"],
  ["north", "forth", "Direction opposite of south"],
  ["noodle", "cuddle", "Long string of pasta"],
  ["nose", "rose", "The part you smell with"],
  ["number", "slumber", "How many of something there are"],
  ["ocean", "motion", "Vast body of salt water"],
  ["orbit", "habit", "The path a planet travels"],
  ["orange", "door hinge", "Citrus fruit"],
  ["otter", "shutter", "Furry animal that swims on its back"],
  ["owl", "howl", "Night bird that hoots"],
  ["paint", "faint", "Color you brush onto walls"],
  ["paper", "vapor", "Sheets you write on"],
  ["peach", "teach", "Fuzzy sweet fruit"],
  ["pearl", "curl", "Gem found inside a clam"],
  ["pencil", "rental", "Writer made of wood and graphite"],
  ["planet", "granite", "World that circles a star"],
  ["plant", "grant", "Living thing that grows in soil"],
  ["plate", "gate", "Dish you eat from"],
  ["plum", "drum", "Purple sweet fruit"],
  ["pond", "bond", "Small still body of water"],
  ["pool", "stool", "Small shallow place to swim"],
  ["rain", "train", "Water falling from clouds"],
  ["ray", "day", "A single beam of light"],
  ["ribbon", "pigeon", "Decorative strip of cloth"],
  ["river", "giver", "Long stream of flowing water"],
  ["rocket", "pocket", "Craft that flies into space"],
  ["roof", "proof", "Top covering of a house"],
  ["rope", "hope", "Twisted cord for tying"],
  ["royal", "loyal", "Belonging to a king"],
  ["rule", "tool", "A law or a guide"],
  ["salad", "pallid", "Mix of raw vegetables"],
  ["scale", "tale", "Tells you how much you weigh"],
  ["scarf", "wharf", "Wrap worn around your neck"],
  ["scene", "keen", "Part of a play or a film"],
  ["scholar", "collar", "Person who studies hard"],
  ["shadow", "meadow", "Dark shape cast by light"],
  ["shape", "cape", "The form of a thing"],
  ["shell", "bell", "Hard cover of a sea creature"],
  ["shirt", "skirt", "Clothing for your upper body"],
  ["shore", "more", "Land beside the water"],
  ["silver", "sliver", "Shiny gray metal"],
  ["singer", "stinger", "Person who sings"],
  ["sister", "blister", "Your female sibling"],
  ["sky", "high", "Where clouds and birds live"],
  ["smile", "mile", "Happy look on your face"],
  ["snake", "lake", "Legless slithering reptile"],
  ["snow", "low", "Frozen flakes from the sky"],
  ["solar", "polar", "Having to do with the sun"],
  ["solid", "ballad", "Hard and firm, not liquid"],
  ["sound", "ground", "Something you hear"],
  ["space", "lace", "Where the stars are"],
  ["spark", "dark", "A tiny glowing fleck"],
  ["spice", "twice", "Flavor added to food"],
  ["spider", "rider", "Eight-legged web weaver"],
  ["spoon", "croon", "Utensil with a shallow bowl"],
  ["star", "far", "Bright point of light at night"],
  ["steam", "team", "Vapor rising from hot water"],
  ["stone", "phone", "A hard piece of rock"],
  ["storm", "warm", "Wind, rain and thunder"],
  ["story", "glory", "A tale you read or tell"],
  ["sugar", "buyer", "Sweet white stuff for tea"],
  ["sunny", "bunny", "Bright with sunshine"],
  ["table", "cable", "Furniture you eat on"],
  ["tiger", "wider", "Striped big cat"],
  ["tomato", "potato", "Red salad vegetable"],
  ["torch", "porch", "Handheld portable light"],
  ["tower", "flower", "Tall narrow building"],
  ["train", "brain", "Runs along rails"],
  ["treat", "sweet", "Something special you enjoy"],
  ["trunk", "skunk", "An elephant's long nose"],
  ["turtle", "hurtle", "Shelled reptile that crawls slowly"],
  ["union", "onion", "Vegetable that makes you cry"],
  ["valley", "tally", "Low land between hills"],
  ["velvet", "pellet", "Soft fabric with a thick pile"],
  ["vine", "wine", "Climbing plant stem"],
  ["voice", "choice", "The sound of speaking"],
  ["wait", "late", "Stay until something happens"],
  ["wallet", "bullet", "Pouch that holds money"],
  ["water", "daughter", "Clear liquid we drink"],
  ["whale", "tail", "Huge sea mammal"],
  ["wheat", "feet", "Grain milled into flour"],
  ["wheel", "feel", "Round part that turns"],
  ["whisper", "miser", "Very quiet speech"],
  ["window", "tornado", "Glass you look out of"],
  ["winter", "splinter", "Coldest season of the year"],
  ["wizard", "blizzard", "Magic user in old tales"],
  ["wolf", "golf", "Wild hunter of the forest"],
  ["world", "curled", "The whole planet"],
  ["yellow", "mellow", "Color of a banana"],
  ["zombie", "mommy", "Walking undead of horror films"],
  ["garden", "pardon", "Where flowers and vegetables grow"],
  ["gentle", "mental", "Soft and kind"],
  ["hungry", "funny", "Needing food"],
  ["kitten", "mitten", "Baby cat"],
  ["medal", "pedal", "Prize worn around your neck"],
  ["metal", "petal", "Hard shiny material like iron"],
  ["meter", "heater", "Measures how much you use"],
  ["mine", "fine", "Belonging to me"],
  ["month", "blunt", "One twelfth of a year"],
  ["palace", "malice", "Huge fancy royal home"],
  ["patrol", "control", "Walk a beat to keep watch"],
  ["pepper", "wrapper", "Spice that makes food hot"],
  ["pillow", "willow", "Soft thing your head rests on"],
  ["pity", "city", "Feel sorry for someone"],
  ["poison", "moisten", "Substance that makes you sick"],
  ["pollen", "fallen", "Yellow dust carried by flowers"],
  ["poster", "coaster", "Printed sheet stuck on a wall"],
  ["prairie", "fairy", "Vast flat grassland"],
  ["present", "pleasant", "A gift you receive"],
  ["priest", "beast", "Religious leader"],
  ["pumpkin", "bumpkin", "Big orange gourd"],
  ["purse", "nurse", "Bag carried on the arm"],
  ["rabbit", "habit", "Long-eared hopper"],
  ["ring", "sing", "Jewelry worn on a finger"],
  ["saddle", "cattle", "Seat strapped on a horse"],
  ["sailor", "tailor", "Person who works on a ship"],
  ["sauce", "pause", "Liquid poured over food"],
  ["scream", "stream", "Loud cry of fear"],
  ["season", "reason", "Spring, summer, autumn, winter"],
  ["sleepy", "creepy", "Ready for bed"],
  ["smoke", "joke", "What rises from a fire"],
  ["sock", "lock", "Clothing for your foot"],
  ["soda", "coder", "Fizzy cold drink"],
  ["soldier", "colder", "Trained fighter in uniform"],
  ["song", "long", "A tune with words"],
  ["soul", "bowl", "Spirit of a person"],
  ["soup", "loop", "Liquid food eaten from a bowl"],
  ["sphere", "beer", "A perfectly round ball"],
  ["spirit", "merit", "Ghost; also your mood"],
  ["spot", "shot", "A particular place"],
  ["squirrel", "whirl", "Bushy-tailed tree climber"],
  ["stair", "pair", "One step in a staircase"],
  ["stamp", "camp", "Sticks to the front of a letter"],
  ["stand", "band", "Get up on your feet"],
  ["station", "patience", "Place where trains stop"],
  ["steel", "keel", "Strong hard metal"],
  ["step", "deep", "One move of a staircase"],
  ["stick", "brick", "A thin piece of wood"],
  ["stitch", "switch", "One loop of thread"],
  ["stomach", "comic", "Where your food goes"],
  ["street", "feet", "Road in a town"],
  ["string", "spring", "Thin twisted cord"],
  ["study", "muddy", "Spend time learning hard"],
  ["summer", "hummer", "Warmest season of the year"],
  ["swing", "king", "Moves back and forth on a chain"],
  ["symbol", "thimble", "Sign that stands for something"],
  ["system", "piston", "Set of parts working together"],
  ["talk", "walk", "Speak to someone"],
  ["tank", "blank", "Heavy armored vehicle"],
  ["teeth", "beneath", "What you chew with"],
  ["thank", "rank", "Say grateful words"],
  ["theater", "cheater", "Place where films are shown"],
  ["theory", "airy", "Idea not yet proven"],
  ["thick", "flick", "Wide and solid"],
  ["thin", "skin", "Not wide and not fat"],
  ["thread", "bread", "String used in sewing"],
  ["throne", "grown", "Chair where a king sits"],
  ["thumb", "numb", "Short fat finger"],
  ["thunder", "blunder", "Rumbling that follows lightning"],
  ["ticket", "cricket", "Paper that admits you in"],
  ["timber", "limber", "Wood used for building"],
  ["tissue", "issue", "Soft paper for your nose"],
  ["today", "obey", "The current day"],
  ["toe", "dough", "One of the five digits on your foot"],
  ["tongue", "young", "Muscle inside your mouth"],
  ["tooth", "booth", "Hard white thing in your mouth"],
  ["top", "hop", "Toy that spins on a point"],
  ["towel", "scowl", "Dries you off after a wash"],
  ["track", "black", "Path used for running"],
  ["trade", "blade", "Job you learn and work at"],
  ["trail", "snail", "Path through the wild"],
  ["trap", "snap", "Catches animals"],
  ["travel", "gravel", "Go from place to place"],
  ["tree", "three", "Tall plant with bark"],
  ["trick", "brick", "A sneaky clever act"],
  ["truck", "duck", "Lorry that carries things"],
  ["true", "blue", "A fact, not a lie"],
  ["tub", "cub", "Short deep bath"],
  ["tunnel", "funnel", "Passage running under a hill"],
  ["turkey", "jerky", "Big bird roasted at feasts"],
  ["twig", "fig", "A tiny branch"],
  ["twist", "fist", "Turn something around"],
  ["uncle", "bundle", "Your parent's brother"],
  ["van", "can", "Boxy delivery vehicle"],
  ["vase", "case", "Holds cut flowers"],
  ["vest", "test", "Sleeveless jacket"],
  ["vision", "mission", "Eyesight; also a goal"],
  ["voyage", "rage", "Long journey by sea"],
  ["waffle", "awful", "Grid-patterned breakfast cake"],
  ["waist", "taste", "Where your belt sits"],
  ["wake", "cake", "Stop sleeping"],
  ["wander", "yonder", "Walk with no plan"],
  ["wasp", "cost", "Stinging yellow insect"],
  ["watch", "patch", "Tells the time on your wrist"],
  ["wave", "cave", "A moving ridge of sea"],
  ["wax", "tax", "Melts inside a candle"],
  ["well", "bell", "Hole you draw water from"],
  ["while", "mile", "During the time that"],
  ["whip", "lip", "Strikes to make something move"],
  ["whistle", "thistle", "Blow air out to make a sound"],
  ["wife", "life", "Your married partner"],
  ["wild", "child", "Untamed and free"],
  ["wing", "sing", "The limb a bird flies with"],
  ["wink", "blink", "Shut one eye very quickly"],
  ["wire", "fire", "Thin thread of metal"],
  ["wise", "skies", "Clever and thoughtful"],
  ["wonder", "squander", "Feel curious about something"],
  ["wood", "good", "Material that comes from trees"],
  ["wool", "full", "Soft hair from a sheep"],
  ["word", "bird", "Smallest unit of language"],
  ["work", "jerk", "Do your job"],
  ["worm", "term", "Long thin creature of the soil"],
  ["worry", "hurry", "Feel anxious about something"],
  ["wrist", "mist", "The joint below your hand"],
  ["writer", "lighter", "Person who writes books"],
  ["yarn", "barn", "Wool wound up for knitting"],
  ["year", "peer", "Twelve whole months"],
  ["zero", "hero", "The number 0"],
];

const WORDS = new Set(BANK.map((entry) => entry[0]));

interface Entry {
  word: string;
  rhyme: string;
  def: string;
}

type Phase = "idle" | "playing" | "won" | "lost";

const PLACEHOLDER: Entry = { word: "", rhyme: "", def: "" };

export default function TwentyQuestions() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [secret, setSecret] = useState<Entry>(PLACEHOLDER);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [newBest, setNewBest] = useState(false);
  const [jitter, setJitter] = useState(0);
  const { best, submit } = useBestScore("twenty-questions", "low");

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === "playing") inputRef.current?.focus();
  }, [phase]);

  const clearTimers = useCallback(() => {
    for (let i = 0; i < timers.current.length; i++) clearTimeout(timers.current[i]);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

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
    const idx = Math.floor(Math.random() * BANK.length);
    const pick = BANK[idx];
    setSecret({ word: pick[0], rhyme: pick[1], def: pick[2] });
    setGuesses([]);
    setDraft("");
    setNewBest(false);
    setJitter(0);
    setPhase("playing");
  }, [clearTimers]);

  const send = useCallback(() => {
    if (phase !== "playing") return;
    const guess = draft.trim().toLowerCase();
    if (guess === "" || !WORDS.has(guess)) {
      shake();
      return;
    }
    if (guess === secret.word) {
      setPhase("won");
      setNewBest(submit(guesses.length + 1));
      return;
    }
    const next = guesses.concat(guess);
    setGuesses(next);
    setDraft("");
    if (next.length >= MAX_GUESSES) setPhase("lost");
  }, [phase, draft, secret, guesses, shake, submit]);

  const clues: { label: string; value: string }[] = [
    { label: "Letter count", value: `${secret.word.length} letters` },
    { label: "First letter", value: secret.word.slice(0, 1).toUpperCase() },
    { label: "Rhymes with", value: secret.rhyme },
    { label: "Meaning", value: secret.def },
  ];
  const shown =
    phase === "playing" || phase === "won"
      ? Math.min(guesses.length, clues.length)
      : clues.length;

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={`${guesses.length}/${MAX_GUESSES}`} best={best === null ? "—" : `${best}g`}>
        <span className="text-sky-300">
          Guesses <b className="ml-1 text-sm text-ink">{guesses.length}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(56,189,248,0.7)] sm:p-5">
        <div className="flex flex-wrap justify-center gap-1.5">
          {Array.from({ length: MAX_GUESSES }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                "h-2 w-2 rounded-full transition",
                i < guesses.length ? "bg-sky-400" : "bg-[#26263d]",
              )}
            />
          ))}
        </div>

        {phase !== "idle" && (
          <div className="mt-4 grid gap-2">
            {clues.map((clue, i) => (
              <div
                key={clue.label}
                className={cn(
                  "rounded-xl border px-3 py-2 transition",
                  i < shown
                    ? "border-sky-500/40 bg-sky-500/10"
                    : "border-line bg-[#131322]",
                )}
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  {clue.label}
                </p>
                {i < shown ? (
                  <p className="font-display text-sm font-bold text-ink sm:text-base">
                    {clue.value}
                  </p>
                ) : (
                  <p className="text-sm text-muted/70">🔒 locked</p>
                )}
              </div>
            ))}
          </div>
        )}

        {guesses.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {guesses.map((g, i) => (
              <span
                key={`${g}-${i}`}
                className="rounded-md border border-line bg-[#131322] px-2 py-1 text-xs text-ink"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mt-4 flex gap-2"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={phase !== "playing"}
            maxLength={24}
            autoComplete="off"
            spellCheck={false}
            aria-label="Type a word from the list"
            placeholder="type a word…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-[#0d0d18] px-3 py-2 font-display text-sm text-ink placeholder:text-muted/60 focus:border-primary/60 focus:outline-none"
            style={{ transform: `translateX(${jitter}px)` }}
          />
          <button
            type="submit"
            disabled={phase !== "playing"}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-bold text-ink transition hover:border-primary/60 hover:bg-surface-2"
          >
            Guess
          </button>
        </form>

        {phase === "idle" && (
          <Overlay>
            <p className="text-4xl">❓</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              TWENTY QUESTIONS
            </p>
            <p className="mt-2 text-sm text-muted">
              One secret word. Every wrong guess peels back another clue.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Deal me a word
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "won" && (
          <Overlay>
            <p className="text-4xl">🎉</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              CRACKED IT
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best run!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {guesses.length}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              guesses · best {best === null ? "—" : `${best}`}
            </p>
            <p className="mt-2 text-sm text-muted">
              The word was{" "}
              <b className="font-display text-lg uppercase tracking-widest text-ink">
                {secret.word}
              </b>
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              New word
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "lost" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">OUT OF GUESSES</p>
            <p className="mt-3 text-sm text-muted">
              The word was{" "}
              <b className="font-display text-lg uppercase tracking-widest text-ink">
                {secret.word}
              </b>
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Try another
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Guess any word in the bank · clues unlock after each miss · twenty guesses max
      </p>
    </div>
  );
}
