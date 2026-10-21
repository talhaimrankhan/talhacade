"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const TONE = "from-pink-400 via-rose-500 to-red-400";
const VOWELS = "aeiou";
const VOWEL_KEYS = ["a", "e", "i", "o", "u"];
const WORDS_PER_TIER = 4;
const MAX_LIVES = 3;

/** Short words (4–6 letters) — every skeleton below restores to one word only. */
const SHORT_WORDS = (
  "apple anchor bacon bagel blade bloom bonus castle chalk chess chest circle clean clown cloth " +
  "comet cotton cover crisp crown crumb cycle dizzy dodge doubt drain dream earth elbow finger " +
  "finish flyer frame glove graph grasp habit handle heart helmet honey honor juice kayak knife " +
  "ladle light lilac local magic magnet marble mercy monkey month orbit pearl photo pizza plaza " +
  "prism prize probe proud pulse quaint quartz query quest quilt remedy rifle rinse round ruler " +
  "scuba sight sleepy slice slime smile smoke snail sound spark spirit spray storm swamp swift " +
  "thorn tiger tight torch tough toxic trend truly tulip twice vinyl violet visit vivid vocal " +
  "voter waffle waist walnut wheat which whisk wicked width window wink wisdom wizard world " +
  "wrench yacht yeast young youth breeze candle carpet carrot chisel closet cobweb column comedy " +
  "corner couple cousin coyote crater crayon dancer dazzle desert design detail device dragon " +
  "escort fabric facade falcon fancy flight forest format fossil frosty frozen future galaxy " +
  "gallon garage garlic gentle geyser ghost gifted glance glider goblin gossip grill grip groom " +
  "guild half hamper harbor hazard health hefty helium hotel hound howl hustle hybrid igloo " +
  "impact insect intend island jacket jaguar jargon jockey jumble kindle kiss kiosk kitten kiwi " +
  "knight launch layer lazy league learn legal lens lily liquid listen little lizard locust lofty " +
  "lounge loyal luxury lyric maize manner mantle market marvel meadow medium memory mimic moment " +
  "move movie muffin muscle mystic napkin narrow nature nectar nerve news nickel north number " +
  "nylon offer often orphan outfit oyster parcel pardon parent pastry peanut pecan people period " +
  "phrase plane planet plant plea plenty plight plug poem portal powder praise prefer priest " +
  "prompt proper prove public quiche rapid realm rebel recipe record reduce refine refuge relax " +
  "relief repeat rescue resort return review rhythm rigid salary sauce screen script sector self " +
  "senior sequel sharp shower shrimp sign signal sister size sketch ski sleek slogan smart social " +
  "sonar spend splice sponge spouse spruce stable stalk statue steam study supply survey swan " +
  "swarm sway symbol syrup system tactic talent talk tavern temple tennis text thief thirst thirty " +
  "thumb title today topic travel tropic troop tumble tunnel tuxedo twelve twenty twin twist ugly " +
  "uncle unless update uphill upward usual vacant vacuum value vault velvet verbal view vigor " +
  "virtue vision visual vodka voice void volume voyage water wealth weapon wharf wipe worry wound " +
  "wrap zest zinc canary"
).split(" ");

/** Medium words (7–8 letters). */
const MEDIUM_WORDS = (
  "glacier typical cabbage campaign channel chapter charity cinnamon creator crystal cupboard " +
  "cushion delight diamond dinosaur doorway drizzle dungeon eclipse educate elderly elegant " +
  "eternal evening faculty fatigue feather fifteen flannel flavors florist foliage fountain " +
  "fragile furnace gesture harmony harvest horizon imagine journal journey keyhole laundry " +
  "leopard library machine mission morning mushroom mustard mystery network neutral ornament " +
  "ostrich outcome pilgrim pioneer plaster plumber popcorn practice pregnant primary protect " +
  "pumpkin quality quantum reflect research resolve shelter soldier strange stretch subject " +
  "support surgery survive suspect swallow tension tonight trolley umbrella venture village " +
  "vinegar volcano welcome backpack baseball bedroom carnival decorate hospital humidity magazine " +
  "mattress mechanic medicine notebook postcard princess raincoat sandwich sidewalk starfish " +
  "sunshine triangle gasoline janitor joystick kangaroo lemonade panther question treasure " +
  "upstream windmill kindling luggage nineteen numerous observe organize outdoors painters " +
  "problem produce purpose rainbow raindrop reindeer relative relaxed resemble southern souvenir " +
  "thousand tomorrow tropical variety"
).split(" ");

/** Long words (9–11 letters) — the final tier of every run. */
const LONG_WORDS = (
  "butterfly chocolate franchise marmalade apartment astronaut breakfast crocodile furniture " +
  "gingerbread jellyfish labyrinth lightning moustache pineapple pneumonia rhinoceros shipwreck " +
  "snowstorm tangerine waterfall wildflower anniversary basketball caterpillar dandelion " +
  "detective different discovery dragonfly fantastic firefighter geographer helicopter passenger " +
  "rainforest raspberry scarecrow snowflake trampoline wristband candlelight magnificent narrative " +
  "overnight particular patiently plentiful spectacle spectacular spontaneous stretching substance " +
  "suggestion tambourine telephone toothpaste tremendous ultimately universal vegetable versatile"
).split(" ");

type Status = "idle" | "playing" | "over";

function isVowel(ch: string): boolean {
  return VOWELS.indexOf(ch) !== -1;
}

/** Consonants kept, vowels emptied into slots. */
function buildSlots(word: string): string[] {
  const slots = word.split("");
  for (let i = 0; i < slots.length; i++) {
    if (isVowel(slots[i])) slots[i] = "";
  }
  return slots;
}

function firstEmpty(slots: string[]): number {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === "") return i;
  }
  return -1;
}

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

/** Four short, four medium, four long — the run always escalates. */
function pickRun(): string[] {
  const short = shuffle(SHORT_WORDS).slice(0, WORDS_PER_TIER);
  const medium = shuffle(MEDIUM_WORDS).slice(0, WORDS_PER_TIER);
  const long = shuffle(LONG_WORDS).slice(0, WORDS_PER_TIER);
  return [...short, ...medium, ...long];
}

export default function VowelDrop() {
  const { best, submit } = useBestScore("vowel-drop", "low");

  const [status, setStatus] = useState<Status>("idle");
  const [words, setWords] = useState<string[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [slots, setSlots] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [lives, setLives] = useState(MAX_LIVES);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [jitter, setJitter] = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (let i = 0; i < timers.current.length; i++) clearTimeout(timers.current[i]);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // The clock runs until the twelfth word is restored or the lives run out.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

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
    const run = pickRun();
    setWords(run);
    setWordIndex(0);
    setSlots(buildSlots(run[0]));
    setActive(firstEmpty(buildSlots(run[0])));
    setLives(MAX_LIVES);
    setSeconds(0);
    setRunning(true);
    setStatus("playing");
    setNewBest(false);
    setJitter(0);
  }, [clearTimers]);

  const chooseVowel = useCallback(
    (letter: string) => {
      if (status !== "playing" || active < 0) return;
      const word = words[wordIndex];
      if (!word) return;

      if (word[active] === letter) {
        const nextSlots = slots.slice();
        nextSlots[active] = letter;
        setSlots(nextSlots);

        const empty = firstEmpty(nextSlots);
        if (empty >= 0) {
          setActive(empty);
          return;
        }

        const nextIndex = wordIndex + 1;
        setWordIndex(nextIndex);
        if (nextIndex >= words.length) {
          setRunning(false);
          setStatus("over");
          setNewBest(submit(seconds));
          return;
        }
        const nextWord = words[nextIndex];
        const nextWordSlots = buildSlots(nextWord);
        setSlots(nextWordSlots);
        setActive(firstEmpty(nextWordSlots));
      } else {
        const nextLives = lives - 1;
        setLives(nextLives);
        shake();
        if (nextLives <= 0) {
          setRunning(false);
          setStatus("over");
        }
      }
    },
    [status, active, words, wordIndex, slots, lives, seconds, shake, submit],
  );

  useEffect(() => {
    if (status !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (VOWELS.includes(key)) {
        e.preventDefault();
        chooseVowel(key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, chooseVowel]);

  const currentWord = words[wordIndex] ?? "";
  const solvedCount = wordIndex;

  return (
    <div className="w-full max-w-[560px]">
      <GameHud
        score={`${seconds}s`}
        best={best === null ? "—" : `${best}s`}
      >
        <span>
          Word <b className="ml-1 text-sm text-ink">{Math.min(wordIndex + 1, 12)}/12</b>
        </span>
        <span className="flex items-center gap-1">
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                i < lives ? "bg-rose-400" : "bg-line",
              )}
            />
          ))}
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(244,63,94,0.6)] sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Drop the vowels back in
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {currentWord.length} letters
          </span>
        </div>

        <div
          className="flex min-h-16 flex-wrap items-center justify-center gap-1.5 transition-transform duration-75"
          style={{ transform: `translateX(${jitter}px)` }}
        >
          {currentWord.split("").map((ch, i) => {
            const isSlot = isVowel(ch);
            const filled = isSlot ? slots[i] : ch;
            return (
              <button
                key={`${i}-${ch}`}
                type="button"
                onClick={() => {
                  if (isSlot && slots[i] === "") setActive(i);
                }}
                disabled={!isSlot || slots[i] !== ""}
                className={cn(
                  "grid h-12 w-9 place-items-center rounded-lg border font-display text-xl font-bold transition sm:h-14 sm:w-11 sm:text-2xl",
                  isSlot && slots[i] === ""
                    ? cn(
                        "border-dashed bg-[#0e0e1c]",
                        active === i
                          ? "border-rose-400 text-rose-300 shadow-[0_0_14px_-4px_rgba(251,113,133,0.9)]"
                          : "border-line text-muted",
                      )
                    : isSlot
                      ? "border-emerald-400 bg-emerald-500/15 text-emerald-300"
                      : "border-line bg-[#131322] text-ink",
                )}
              >
                {filled || "\u00A0"}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex justify-center gap-2">
          {VOWEL_KEYS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => chooseVowel(v)}
              disabled={status !== "playing" || active < 0}
              className="h-14 w-14 rounded-xl border border-line bg-[#131322] font-display text-2xl font-bold uppercase text-ink transition hover:border-rose-400/70 hover:bg-surface active:scale-95 disabled:opacity-40 sm:h-16 sm:w-16 sm:text-3xl"
            >
              {v}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-1">
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-4 rounded-full transition-colors",
                i < wordIndex
                  ? "bg-emerald-400"
                  : i === wordIndex && status === "playing"
                    ? "bg-primary"
                    : "bg-line",
              )}
            />
          ))}
        </div>

        {status === "idle" && (
          <Overlay>
            <p className="text-4xl">🅰️</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              THE VOWELS ARE GONE
            </p>
            <p className="mt-2 text-sm text-muted">
              Twelve words lose every vowel — restore them with the pad or your keyboard. Three misses end the run.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start run
            </PrimaryButton>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="text-4xl">{lives <= 0 ? "💔" : "🏆"}</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              {lives <= 0 ? "OUT OF LIVES" : "ALL TWELVE RESTORED"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fastest time!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">{seconds}s</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : `${best}s`} · {solvedCount} of 12 words done
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap A E I O U or press the keys · tap a blank to jump to it · 3 lives
      </p>
    </div>
  );
}
