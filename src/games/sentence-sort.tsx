"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const ROUNDS = 8;
const TONE = "from-emerald-400 via-teal-500 to-cyan-600";

/** Everyday sentences, 5–9 words each, always in a single clear order. */
const BANK: string[] = [
  "The quick brown fox jumps over the lazy dog.",
  "She sells sea shells by the sea shore.",
  "Bright stars twinkle in the summer sky.",
  "The old dog lay by the warm fire.",
  "We walked along the beach at sunset.",
  "A little bird sang outside my window.",
  "The chef mixed flour eggs and sugar.",
  "Heavy rain fell on the tin roof.",
  "He planted a seed and waited patiently.",
  "The train arrived exactly on schedule today.",
  "My sister reads a book every night.",
  "A black cat crossed the moonlit road.",
  "The children laughed and chased each other.",
  "Fresh bread cooled on the wooden table.",
  "The river flowed quietly past the village.",
  "She painted the fence bright white.",
  "Wind scattered leaves across the empty street.",
  "The sleepy pilot checked his instruments twice.",
  "A friendly stranger helped carry the groceries.",
  "The moon rose slowly over the hills.",
  "He saved every coin in a glass jar.",
  "The bakery smells of cinnamon and honey.",
  "Small waves crashed against the rocky shore.",
  "The teacher wrote the answer on the board.",
  "A tired traveler rested under the oak.",
  "Snow covered the roofs of the town.",
  "The rabbit vanished into the tall grass.",
  "She folded the letter into a square.",
  "The mechanic fixed my car this morning.",
  "Lanterns glowed along the narrow alley.",
  "He chased the ball across the field.",
  "The kettle whistled on the stove.",
  "A bright idea came to her suddenly.",
  "The castle stood on a steep cliff.",
  "We shared a pizza under the stars.",
  "The gardener watered the roses every evening.",
  "A soft breeze moved the curtains gently.",
  "The judge reviewed the evidence carefully.",
  "Their boat drifted toward the misty island.",
  "The violinist practiced the same phrase again.",
  "He carried a lantern into the dark.",
  "The market opened early on summer mornings.",
  "A puppy chewed the old leather shoe.",
  "The hiker reached the summit before noon.",
  "Candles flickered during the thunderstorm last night.",
  "She wrote her name at the bottom.",
  "The blacksmith shaped a glowing iron horseshoe.",
  "Bees hummed around the apple blossoms.",
  "The ferry crossed the wide river daily.",
  "He stacked the firewood beside the door.",
  "A sparrow built a nest in the gutter.",
  "The librarian asked the room to be quiet.",
  "Mist covered the valley at dawn.",
  "The referee ended the match with a whistle.",
  "She balanced a tray of glasses carefully.",
  "The innkeeper lit a lamp in the hallway.",
  "A kite danced high above the dunes.",
  "The tailor measured him for a new suit.",
  "Frost lined the edges of the window.",
  "He practiced the speech in front of the mirror.",
  "The children built a fort from blankets.",
  "A fisherman mended his nets on the dock.",
  "The clock in the tower struck midnight.",
  "She gathered wildflowers along the country lane.",
  "The shepherd counted his sheep twice.",
  "Smoke rose from the chimney of the cottage.",
  "A sudden gust bent the young trees.",
  "The baker slid the loaf into the oven.",
  "Owls hunted near the old stone bridge.",
  "He wrote the poem on a napkin.",
  "The orchestra tuned before the concert began.",
  "A donkey carried the bags up the hill.",
  "The windows of the house were shut tight.",
  "Rain pooled in the cracks of the sidewalk.",
  "The captain studied the map by candlelight.",
  "A stranger knocked on the door at midnight.",
  "The museum guarded its newest painting closely.",
  "She planted tulips in a row along the path.",
];

interface Tile {
  id: number;
  word: string;
}

type Phase = "idle" | "playing" | "over";

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

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SentenceSort() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [idx, setIdx] = useState(0);
  const [sentence, setSentence] = useState(BANK[0]);
  const [pool, setPool] = useState<Tile[]>([]);
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [wrongAt, setWrongAt] = useState(-1);
  const [hintOn, setHintOn] = useState(false);
  const [jitter, setJitter] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("sentence-sort", "low");

  const roundsRef = useRef<string[]>(BANK.slice(0, ROUNDS));
  const idxRef = useRef(0);
  const secondsRef = useRef(0);
  const idRef = useRef({ n: 0 });
  const placedRef = useRef<Tile[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (let i = 0; i < timers.current.length; i++) clearTimeout(timers.current[i]);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const loadRound = useCallback((next: number) => {
    const text = roundsRef.current[next];
    const words = text.split(" ");
    const tiles: Tile[] = [];
    for (let i = 0; i < words.length; i++) {
      idRef.current.n += 1;
      tiles.push({ id: idRef.current.n, word: words[i] });
    }
    idxRef.current = next;
    placedRef.current = [];
    setIdx(next);
    setSentence(text);
    setPool(shuffle(tiles));
    setPlaced([]);
    setWrongAt(-1);
    setHintOn(false);
    setJitter(0);
  }, []);

  const start = useCallback(() => {
    clearTimers();
    roundsRef.current = shuffle(BANK).slice(0, ROUNDS);
    secondsRef.current = 0;
    setSeconds(0);
    setNewBest(false);
    setPhase("playing");
    loadRound(0);
  }, [clearTimers, loadRound]);

  const finish = useCallback(() => {
    setPhase("over");
    setNewBest(submit(secondsRef.current));
  }, [submit]);

  const shake = useCallback(() => {
    const offsets = [-8, 8, -5, 5, 0];
    for (let i = 0; i < offsets.length; i++) {
      const dx = offsets[i];
      timers.current.push(setTimeout(() => setJitter(dx), i * 55));
    }
  }, []);

  const takeFromPool = useCallback((tile: Tile) => {
    if (phase !== "playing") return;
    setPool((p) => p.filter((t) => t.id !== tile.id));
    placedRef.current = placedRef.current.concat(tile);
    setPlaced(placedRef.current);
  }, [phase]);

  const putBack = useCallback((tile: Tile) => {
    if (phase !== "playing") return;
    placedRef.current = placedRef.current.filter((t) => t.id !== tile.id);
    setPlaced(placedRef.current);
    setPool((p) => p.concat(tile));
  }, [phase]);

  const check = useCallback(() => {
    if (phase !== "playing") return;
    const goal = sentence.split(" ");
    const order = placedRef.current.map((t) => t.word);
    if (order.length === goal.length) {
      let good = true;
      for (let i = 0; i < goal.length; i++) {
        if (order[i] !== goal[i]) {
          good = false;
          break;
        }
      }
      if (good) {
        const next = idxRef.current + 1;
        if (next >= ROUNDS) {
          finish();
          return;
        }
        loadRound(next);
        return;
      }
    }
    let bad = 0;
    const limit = Math.min(order.length, goal.length);
    while (bad < limit && order[bad] === goal[bad]) bad += 1;
    setWrongAt(bad);
    shake();
    timers.current.push(setTimeout(() => setWrongAt(-1), 1100));
  }, [phase, sentence, finish, loadRound, shake]);

  const words = sentence.split(" ");

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={formatTime(seconds)} best={best === null ? "—" : `${best}s`}>
        <span className="text-accent">
          Sentence <b className="ml-1 text-sm text-ink">{Math.min(idx + 1, ROUNDS)}/{ROUNDS}</b>
        </span>
        <span>
          Words <b className="ml-1 text-sm text-ink">{words.length}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(45,212,191,0.6)] sm:p-5">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
          Your sentence
        </p>
        <div
          className="flex min-h-[74px] flex-wrap content-start items-start gap-1.5 rounded-xl border border-line bg-[#0d0d18] p-2.5 transition-transform duration-75"
          style={{ transform: `translateX(${jitter}px)` }}
        >
          {placed.length === 0 && (
            <p className="px-1 py-2 text-sm text-muted/70">tap the words in order…</p>
          )}
          {placed.map((tile, i) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => putBack(tile)}
              aria-label={`Remove word ${i + 1}: ${tile.word}`}
              className={cn(
                "relative rounded-lg border px-2.5 py-1.5 font-display text-sm transition sm:text-base",
                wrongAt === i
                  ? "border-rose-500 bg-rose-500/25 text-ink"
                  : "border-teal-500/50 bg-teal-500/15 text-ink hover:border-teal-400",
              )}
            >
              <span className="absolute -top-2.5 left-1.5 font-mono text-[8px] uppercase text-muted/70">
                {i + 1}
              </span>
              {tile.word}
            </button>
          ))}
        </div>

        <p className="mb-2 mt-4 font-mono text-[10px] uppercase tracking-widest text-muted">
          Scrambled tiles
        </p>
        <div className="flex flex-wrap gap-1.5">
          {pool.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => takeFromPool(tile)}
              aria-label={`Add word: ${tile.word}`}
              className="rounded-lg border border-line bg-[#1a1a30] px-2.5 py-1.5 font-display text-sm text-ink transition hover:border-primary/60 hover:bg-surface sm:text-base"
            >
              {tile.word}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setHintOn(true)}
            disabled={phase !== "playing" || hintOn}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2 disabled:opacity-50"
          >
            💡 Show first word
          </button>
          {hintOn && (
            <p className="font-mono text-xs uppercase tracking-widest text-muted">
              Starts with <b className="text-ink">{words[0]}</b>
            </p>
          )}
          <button
            type="button"
            onClick={check}
            disabled={phase !== "playing"}
            className="rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-2 text-sm font-bold text-black transition hover:brightness-110 active:scale-95"
          >
            Check
          </button>
        </div>

        {wrongAt >= 0 && (
          <p className="mt-2 text-center text-xs text-rose-400">
            Word {wrongAt + 1} is out of place — tap it to pull it back
          </p>
        )}

        {phase === "idle" && (
          <Overlay>
            <p className="text-4xl">🔀</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              SORT THE SENTENCE
            </p>
            <p className="mt-2 text-sm text-muted">
              Eight scrambled sentences — tap the tiles back into the right order.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start sorting
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-gradient">
              ALL SENTENCES SORTED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fastest time!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">
              {formatTime(seconds)}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : `${best}s`}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Sort again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap tiles to build the sentence · tap a placed tile to send it back · check when it reads right
      </p>
    </div>
  );
}
