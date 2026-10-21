"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const ROUNDS = 12;
const ROUND_MS = 6000;
const TICK_MS = 250;
const MAX_LIVES = 3;
const TONE = "from-lime-400 via-green-500 to-emerald-600";

/** [sentence written correctly, the one word shown misspelled] */
const BANK: [string, string][] = [
  ["She forgot her umbrella by the door.", "umbrela"],
  ["Please pass me the salt and pepper.", "peper"],
  ["The dog chased the ball across the yard.", "yrd"],
  ["He will arrive at the station soon.", "arive"],
  ["My favorite color is deep green.", "favrite"],
  ["We planted flowers along the garden path.", "gardern"],
  ["The library closes at eight tonight.", "libary"],
  ["A gentle breeze touched the tall grass.", "breez"],
  ["They built a castle out of sand.", "cstle"],
  ["I need to buy more bread and milk.", "bred"],
  ["The train was late because of the storm.", "becuase"],
  ["He wrote a letter to his friend.", "freind"],
  ["The children played quietly in the park.", "childern"],
  ["This recipe needs a little more sugar.", "reciepe"],
  ["The window was open all night long.", "windo"],
  ["She wore a bright yellow raincoat.", "yello"],
  ["We should leave before the traffic starts.", "traffik"],
  ["The old bridge crosses a wide river.", "bridg"],
  ["He always remembers his mother's birthday.", "remembur"],
  ["The pizza was hot and very cheesy.", "piza"],
  ["A small boat floated near the shore.", "shoree"],
  ["They opened the box and found a puppy.", "puppie"],
  ["The museum was full of strange paintings.", "muesum"],
  ["I keep my coins in a glass jar.", "coines"],
  ["The monkey climbed up the tallest tree.", "monkie"],
  ["Her handwriting is neat and easy to read.", "handritng"],
  ["The bakery sells fresh bread every morning.", "bakry"],
  ["We watched the sunset from the hilltop.", "sunsett"],
  ["He fixed the broken hinge on the door.", "hing"],
  ["The kitchen smells of cinnamon and apples.", "cinamon"],
  ["A curious fox appeared at the edge of the field.", "curius"],
  ["The pilot landed the plane in heavy rain.", "piolt"],
  ["Please wrap the gift in shiny paper.", "wrappe"],
  ["The soldier marched straight down the road.", "soldierd"],
  ["An old clock ticked in the hallway.", "hallwai"],
  ["The frog jumped into the murky pond.", "frogg"],
  ["She collected shells along the quiet beach.", "sheels"],
  ["His jacket was soaked after the downpour.", "jachet"],
  ["The carpenter measured the wooden plank.", "carpenterd"],
  ["We need more candles for the table.", "candels"],
  ["A flock of birds flew over the rooftops.", "flok"],
  ["The valley was covered in morning mist.", "valey"],
  ["He sharpened his pencil before the test.", "pensil"],
  ["The janitor mopped the corridor twice.", "janitur"],
  ["My cousin sends postcards from every trip.", "cuzin"],
  ["The violin rested inside its velvet case.", "violen"],
  ["They crossed the desert under a blazing sun.", "desrt"],
  ["A lantern swung from the wooden beam.", "lanturn"],
  ["The tailor stitched the seam with care.", "tailur"],
  ["She balanced the tray on one hand.", "trayy"],
  ["The castle walls were thick and cold.", "casle"],
  ["He whistled a tune while working outside.", "whisled"],
  ["The harvest brought baskets of ripe apples.", "harvist"],
  ["A shepherd counted his flock at dusk.", "shepard"],
  ["The mechanic tightened the loose bolt.", "mekanic"],
  ["We gathered shells and smooth pebbles.", "pebuls"],
  ["The lantern glow lit the narrow alley.", "alleyy"],
  ["His boots were caked with yellow mud.", "bootes"],
  ["The gardener pruned the rose bushes.", "gardenerd"],
  ["She traced the outline with a pencil.", "outlin"],
  ["The ferry boat crossed the choppy harbor.", "habor"],
  ["A cricket chirped beneath the garden bench.", "crickit"],
  ["The orphaned kitten slept by the fire.", "orfaned"],
  ["He juggled three oranges at the market.", "jugled"],
  ["The blacksmith hammered the glowing iron.", "blaksmith"],
  ["My neighbor lends me her garden tools.", "neighber"],
  ["A pebble skipped five times across the lake.", "pebl"],
  ["The referee blew the whistle for a foul.", "refree"],
  ["She fastened the necklace before leaving.", "neckless"],
  ["The wagon rattled over the cobblestones.", "waggon"],
  ["He inhaled deeply before diving under.", "inheald"],
  ["The librarian stamped the due date inside.", "libarian"],
  ["A lantern beetle crawled along the branch.", "beetul"],
  ["The choir sang in perfect harmony.", "choire"],
  ["She peeled the orange into one long strip.", "pealed"],
  ["The chimney leaked soot into the attic.", "chimny"],
  ["A drizzle settled over the quiet harbor.", "drizle"],
  ["He fastened the rope to the iron ring.", "roppe"],
  ["The shepherd whistled for his wandering dog.", "sheperd"],
  ["A sparrow hopped along the garden wall.", "sparow"],
  ["The cobbler repaired my worn leather boots.", "cobler"],
  ["She scribbled a note and left it on the desk.", "scribled"],
  ["The blackbird sang from the highest branch.", "blakbird"],
  ["A sudden gust scattered the papers across the floor.", "gustt"],
  ["The miller loaded the grain onto the cart.", "miler"],
  ["He stacked the firewood beside the stove.", "stakd"],
  ["The ferryman waved from the distant pier.", "feryman"],
  ["A cricket match filled the stadium with noise.", "cricet"],
  ["The innkeeper set a lamp by the window.", "innkeepur"],
  ["She braided her hair before the journey.", "braidedd"],
  ["The tinsmith patched the leaking bucket.", "tinsmth"],
  ["A swallow nested under the cottage eaves.", "swalow"],
  ["The lamplighter walked his route at dusk.", "lampliter"],
  ["He gathered kindling for the morning fire.", "kindingl"],
  ["The postman whistled as he approached the gate.", "postmen"],
  ["A dandelion grew through the cracked pavement.", "dandelionn"],
  ["The cooper hammered the barrel rings tight.", "coper"],
  ["She counted the coins twice before paying.", "coinnes"],
  ["The thatcher repaired the roof before winter.", "thacher"],
  ["A lantern flickered in the drafty hallway.", "lanterne"],
  ["The drover guided the cattle down the lane.", "drovur"],
];

type Phase = "idle" | "playing" | "over";

interface Round {
  sentence: string;
  wrong: string;
  tokens: string[];
  wrongIdx: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function buildRound(item: [string, string]): Round {
  const tokens = item[0].split(" ");
  let wrongIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (norm(tokens[i]) === norm(item[1])) {
      wrongIdx = i;
      break;
    }
  }
  return { sentence: item[0], wrong: item[1], tokens, wrongIdx };
}

const ROUNDS_BANK: Round[] = BANK.map(buildRound);

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

export default function TypoHunt() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Round>(ROUNDS_BANK[0]);
  const [roundIdx, setRoundIdx] = useState(0);
  const [msLeft, setMsLeft] = useState(ROUND_MS);
  const [lives, setLives] = useState(MAX_LIVES);
  const [streak, setStreak] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [score, setScore] = useState(0);
  const [reveal, setReveal] = useState<"none" | "right" | "wrong">("none");
  const [missIdx, setMissIdx] = useState(-1);
  const [posBuf, setPosBuf] = useState("");
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("typo-hunt", "high");

  const roundsRef = useRef<Round[]>(ROUNDS_BANK);
  const idxRef = useRef(0);
  const msRef = useRef(ROUND_MS);
  const livesRef = useRef(MAX_LIVES);
  const streakRef = useRef(0);
  const clearedRef = useRef(0);
  const scoreRef = useRef(0);
  const posRef = useRef("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (let i = 0; i < timers.current.length; i++) clearTimeout(timers.current[i]);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const finish = useCallback(() => {
    setPhase("over");
    setNewBest(submit(scoreRef.current));
  }, [submit]);

  const loadRound = useCallback((next: number) => {
    idxRef.current = next;
    msRef.current = ROUND_MS;
    posRef.current = "";
    setRoundIdx(next);
    setRound(roundsRef.current[next]);
    setMsLeft(ROUND_MS);
    setReveal("none");
    setMissIdx(-1);
    setPosBuf("");
  }, []);

  const start = useCallback(() => {
    clearTimers();
    roundsRef.current = shuffle(ROUNDS_BANK).slice(0, ROUNDS);
    livesRef.current = MAX_LIVES;
    streakRef.current = 0;
    clearedRef.current = 0;
    scoreRef.current = 0;
    setLives(MAX_LIVES);
    setStreak(0);
    setCleared(0);
    setScore(0);
    setNewBest(false);
    setPhase("playing");
    loadRound(0);
  }, [clearTimers, loadRound]);

  const afterTimeout = useCallback(() => {
    livesRef.current -= 1;
    setLives(livesRef.current);
    streakRef.current = 0;
    setStreak(0);
    if (livesRef.current <= 0) {
      finish();
      return;
    }
    const next = idxRef.current + 1;
    if (next >= ROUNDS) {
      finish();
      return;
    }
    loadRound(next);
  }, [finish, loadRound]);

  useEffect(() => {
    if (phase !== "playing" || reveal === "right") return;
    const id = setInterval(() => {
      msRef.current -= TICK_MS;
      setMsLeft(msRef.current);
      if (msRef.current <= 0) afterTimeout();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, reveal, afterTimeout]);

  const advance = useCallback(() => {
    const next = idxRef.current + 1;
    if (next >= ROUNDS) {
      finish();
      return;
    }
    loadRound(next);
  }, [finish, loadRound]);

  const rightTap = useCallback(() => {
    const speed = Math.max(1, Math.ceil(100 * (msRef.current / ROUND_MS)));
    streakRef.current += 1;
    setStreak(streakRef.current);
    const bonus =
      streakRef.current >= 5
        ? Math.min(100, (streakRef.current - 4) * 25)
        : 0;
    const pts = speed + bonus;
    scoreRef.current += pts;
    setScore(scoreRef.current);
    clearedRef.current += 1;
    setCleared(clearedRef.current);
    setReveal("right");
    timers.current.push(setTimeout(advance, 620));
  }, [advance]);

  const wrongTap = useCallback(() => {
    livesRef.current -= 1;
    setLives(livesRef.current);
    streakRef.current = 0;
    setStreak(0);
    if (livesRef.current <= 0) {
      finish();
      return;
    }
    setReveal("wrong");
    timers.current.push(
      setTimeout(() => {
        setReveal("none");
        setMissIdx(-1);
      }, 360),
    );
  }, [finish]);

  const judge = useCallback(
    (chosen: number) => {
      if (reveal === "wrong") return;
      if (chosen === round.wrongIdx) rightTap();
      else {
        setMissIdx(chosen);
        wrongTap();
      }
    },
    [round, reveal, rightTap, wrongTap],
  );

  const onWordTap = useCallback(
    (i: number) => {
      if (phase !== "playing" || reveal === "right") return;
      judge(i);
    },
    [phase, reveal, judge],
  );

  const onPosKey = useCallback(
    (key: string) => {
      if (phase !== "playing" || reveal === "right") return;
      if (key === "Enter") {
        const idx = Number(posRef.current) - 1;
        posRef.current = "";
        setPosBuf("");
        if (idx >= 0 && idx < round.tokens.length) judge(idx);
        return;
      }
      if (key === "Backspace") {
        posRef.current = posRef.current.slice(0, -1);
        setPosBuf(posRef.current);
        return;
      }
      if (/^[0-9]$/.test(key) && posRef.current.length < 2) {
        posRef.current += key;
        setPosBuf(posRef.current);
      }
    },
    [phase, reveal, round, judge],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase !== "playing" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter" || e.key === "Backspace") {
        e.preventDefault();
        onPosKey(e.key);
      } else if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        onPosKey(e.key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onPosKey, phase]);

  const timerPct = Math.max(0, (msLeft / ROUND_MS) * 100);

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-rose-400">
          Lives{" "}
          <b className="ml-1 text-sm tracking-widest text-ink">
            {"❤️".repeat(Math.max(0, lives))}
            {"·".repeat(MAX_LIVES - Math.max(0, lives))}
          </b>
        </span>
        <span className="text-accent">
          Round <b className="ml-1 text-sm text-ink">{Math.min(roundIdx + 1, ROUNDS)}/{ROUNDS}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(74,222,128,0.6)] sm:p-5">
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#131322]">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-200 ease-linear",
              timerPct > 50
                ? "bg-emerald-400"
                : timerPct > 20
                  ? "bg-warn"
                  : "bg-rose-500",
            )}
            style={{ width: `${timerPct}%` }}
          />
        </div>

        <div className="flex flex-wrap justify-center gap-x-2 gap-y-3">
          {round.tokens.map((word, i) => {
            const isWrong = i === round.wrongIdx;
            const shown = reveal === "right" && isWrong ? word : isWrong ? round.wrong : word;
            const marked = reveal !== "none" && isWrong;
            return (
              <button
                key={`${round.sentence}-${i}`}
                type="button"
                onClick={() => onWordTap(i)}
                aria-label={`Word ${i + 1}: ${shown}`}
                className={cn(
                  "relative rounded-lg border px-3 py-1.5 font-display text-base transition sm:text-lg",
                  marked && reveal === "right"
                    ? "border-emerald-500 bg-emerald-500/20 text-ink"
                    : marked && reveal === "wrong" && missIdx === i
                      ? "border-rose-500 bg-rose-500/25 text-ink"
                      : "border-line bg-[#131322] text-ink hover:border-primary/60 hover:bg-surface",
                )}
              >
                <span className="absolute -top-2.5 left-1.5 font-mono text-[8px] uppercase text-muted/70">
                  {i + 1}
                </span>
                {shown}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="font-mono text-xs uppercase tracking-widest text-muted">
            {posBuf ? (
              <span className="text-ink">Position: {posBuf}</span>
            ) : (
              <span>tap the typo or type its number</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-mono text-xs uppercase tracking-widest",
                streak >= 5 ? "text-warn" : "text-muted",
              )}
            >
              Streak <b className="ml-1 text-sm text-ink">{streak}</b>
              {streak >= 5 && <span className="ml-1">+{Math.min(100, (streak - 4) * 25)}</span>}
            </span>
          </div>
        </div>

        {phase === "idle" && (
          <Overlay>
            <p className="text-4xl">📝</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              FIND THE TYPO
            </p>
            <p className="mt-2 text-sm text-muted">
              Twelve sentences, one misspelled word each. Fast catches score more.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start hunting
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              {cleared >= ROUNDS ? "ALL TWELVE FOUND" : "RUN OVER"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {cleared}/{ROUNDS} typos found · best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Hunt again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap the misspelled word · or type its number and press Enter · three misses end the run
      </p>
    </div>
  );
}
