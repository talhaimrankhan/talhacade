"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

interface RhymeSet {
  word: string;
  rhymes: string[];
  distractors: string[];
}

/** [target, rhyme1, rhyme2, decoy1, decoy2, decoy3, decoy4] */
const RAW: [string, string, string, string, string, string, string][] = [
  ["cat", "hat", "mat", "dog", "kitten", "paws", "mouse"],
  ["dog", "fog", "log", "puppy", "bark", "tail", "bone"],
  ["bed", "red", "fed", "pillow", "sheet", "blanket", "sleep"],
  ["cake", "lake", "bake", "flour", "icing", "slice", "candle"],
  ["star", "car", "far", "moon", "sky", "planet", "shine"],
  ["moon", "spoon", "balloon", "night", "crater", "glow", "orbit"],
  ["tree", "bee", "free", "branch", "root", "leaf", "bark"],
  ["rain", "train", "plain", "cloud", "drop", "storm", "puddle"],
  ["house", "mouse", "blouse", "roof", "wall", "door", "home"],
  ["hand", "land", "sand", "finger", "palm", "arm", "thumb"],
  ["frog", "bog", "jog", "pond", "toad", "hop", "green"],
  ["light", "night", "bright", "dark", "lamp", "beam", "shade"],
  ["boat", "coat", "goat", "sail", "ship", "wave", "dock"],
  ["bee", "see", "tree", "hive", "honey", "sting", "wing"],
  ["key", "sea", "free", "lock", "door", "handle", "turn"],
  ["snail", "mail", "tail", "shell", "slow", "slime", "garden"],
  ["bread", "said", "head", "loaf", "crust", "toast", "flour"],
  ["play", "day", "stay", "game", "fun", "sport", "toy"],
  ["jump", "bump", "lump", "hop", "leap", "bounce", "high"],
  ["swing", "ring", "sing", "slide", "sway", "rope", "park"],
  ["face", "race", "lace", "nose", "smile", "mouth", "eye"],
  ["book", "cook", "look", "page", "read", "story", "shelf"],
  ["door", "floor", "more", "knob", "hinge", "open", "gate"],
  ["hill", "fill", "mill", "valley", "slope", "climb", "top"],
  ["kite", "light", "night", "fly", "string", "wind", "tail"],
  ["lamp", "camp", "damp", "bulb", "shade", "glow", "desk"],
  ["nest", "best", "west", "twig", "eggs", "branch", "bird"],
  ["king", "cling", "wing", "queen", "crown", "throne", "royal"],
  ["snake", "cake", "lake", "scale", "hiss", "fang", "reptile"],
  ["train", "rain", "plain", "track", "steam", "rail", "carriage"],
  ["sock", "rock", "lock", "shoe", "toe", "boot", "ankle"],
  ["spoon", "moon", "boon", "fork", "knife", "bowl", "ladle"],
  ["bell", "well", "tell", "ring", "chime", "sound", "tower"],
  ["bug", "rug", "hug", "insect", "crawl", "beetle", "ant"],
  ["corn", "horn", "torn", "cob", "field", "husk", "kernel"],
  ["leaf", "thief", "beef", "stem", "branch", "tree", "green"],
  ["pear", "bear", "wear", "apple", "fruit", "seed", "orchard"],
  ["ship", "chip", "flip", "deck", "anchor", "wave", "mast"],
  ["chair", "stair", "fair", "table", "seat", "legs", "stool"],
  ["flag", "bag", "tag", "pole", "cloth", "banner", "colour"],
  ["glue", "blue", "true", "stick", "tape", "paste", "wet"],
  ["hen", "pen", "ten", "rooster", "coop", "eggs", "farm"],
  ["jar", "bar", "far", "lid", "bottle", "glass", "shelf"],
  ["drum", "hum", "plum", "beat", "stick", "band", "noise"],
  ["gate", "wait", "late", "fence", "latch", "yard", "path"],
  ["glove", "love", "dove", "hand", "mitten", "fit", "pair"],
  ["grape", "tape", "cape", "vine", "wine", "bunch", "juice"],
  ["hike", "bike", "like", "trail", "walk", "backpack", "climb"],
  ["lace", "face", "pace", "shoe", "bow", "thread", "ribbon"],
  ["mask", "task", "bask", "face", "nose", "costume", "dark"],
  ["neat", "beat", "meat", "tidy", "clean", "order", "messy"],
  ["oak", "cloak", "smoke", "tree", "leaf", "acorn", "bark"],
  ["tube", "cube", "mute", "pipe", "hose", "cylinder", "air"],
  ["quilt", "guilt", "built", "blanket", "stitch", "patch", "warm"],
  ["reef", "chief", "brief", "coral", "fish", "shark", "tide"],
  ["shed", "bed", "red", "hut", "tool", "garden", "roof"],
  ["veil", "jail", "nail", "mask", "glass", "sight", "shadow"],
  ["toes", "hose", "goes", "feet", "shoe", "walk", "wobble"],
  ["wax", "tax", "max", "candle", "polish", "golden", "seal"],
  ["yawn", "dawn", "lawn", "sleep", "tired", "morning", "bed"],
  ["zip", "tip", "lip", "jacket", "pull", "fastener", "slide"],
  ["barn", "yarn", "darn", "farm", "hay", "tractor", "cow"],
];

const BANK: RhymeSet[] = RAW.map(([word, r1, r2, d1, d2, d3, d4]) => ({
  word,
  rhymes: [r1, r2],
  distractors: [d1, d2, d3, d4],
}));

const ROUNDS = 8;
const BASE_POINTS = 100;
const TONE = "from-amber-400 via-orange-500 to-red-500";

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

export default function RhymeChime() {
  const { best, submit } = useBestScore("rhyme-chime", "high");

  const [status, setStatus] = useState<Status>("idle");
  const [round, setRound] = useState(0);
  const [puzzle, setPuzzle] = useState<RhymeSet>(BANK[0]);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [wrongIndex, setWrongIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [newBest, setNewBest] = useState(false);

  const advanceTimer = useRef<number | null>(null);
  const wrongTimer = useRef<number | null>(null);
  const deckRef = useRef<RhymeSet[]>([BANK[0]]);

  useEffect(
    () => () => {
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
      if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    },
    [],
  );

  const multiplier = Math.min(4, Math.max(1, streak));

  const beginRound = useCallback((deck: RhymeSet[], i: number) => {
    const next = deck[i];
    setPuzzle(next);
    setCandidates(shuffle([...next.rhymes, ...next.distractors]));
    setPicked([]);
    setWrongIndex(null);
  }, []);

  const start = useCallback(() => {
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    const deck = shuffle(BANK).slice(0, ROUNDS);
    deckRef.current = deck;
    setRound(0);
    setScore(0);
    setStreak(0);
    setCleared(0);
    setJitter(0);
    setStatus("playing");
    setNewBest(false);
    beginRound(deck, 0);
  }, [beginRound]);

  const tap = useCallback(
    (index: number) => {
      if (status !== "playing" || picked.length >= 2 || picked.includes(index)) return;
      const chosen = candidates[index];
      if (!chosen) return;

      if (puzzle.rhymes.includes(chosen)) {
        const nextPicked = [...picked, index];
        setPicked(nextPicked);
        if (nextPicked.length < 2) return;

        const nextStreak = streak + 1;
        const nextScore = score + BASE_POINTS * Math.min(4, nextStreak);
        setStreak(nextStreak);
        setScore(nextScore);
        setCleared((n) => n + 1);

        if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
        advanceTimer.current = window.setTimeout(() => {
          if (round + 1 >= ROUNDS) {
            setStatus("over");
            setNewBest(submit(nextScore));
          } else {
            const next = round + 1;
            setRound(next);
            beginRound(deckRef.current, next);
          }
        }, 850);
      } else {
        setStreak(0);
        setWrongIndex(index);
        const offsets = [-8, 8, -5, 5, 0];
        for (let i = 0; i < offsets.length; i++) {
          const dx = offsets[i];
          window.setTimeout(() => setJitter(dx), i * 55);
        }
        if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
        wrongTimer.current = window.setTimeout(() => setWrongIndex(null), 450);
      }
    },
    [status, picked, candidates, puzzle, streak, score, round, beginRound, submit],
  );

  useEffect(() => {
    if (status !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (["1", "2", "3", "4", "5", "6"].includes(e.key)) {
        e.preventDefault();
        tap(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, tap]);

  const shownRound = Math.min(round + 1, ROUNDS);

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Round <b className="ml-1 text-sm text-ink">{shownRound}/{ROUNDS}</b>
        </span>
        <span className="text-warn">
          ×{multiplier} <b className="ml-0.5 text-sm text-ink">{streak}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(251,146,60,0.6)] sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Pick the two that rhyme
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {picked.length}/2 found
          </span>
        </div>

        <div className="rounded-xl border border-line bg-[#0e0e1c] px-4 py-5 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Word</p>
          <p className="mt-1 font-display text-4xl font-bold lowercase tracking-wide text-ink sm:text-5xl">
            {puzzle.word}
          </p>
        </div>

        <div
          className="mt-4 grid grid-cols-2 gap-2 transition-transform duration-75 sm:grid-cols-3"
          style={{ transform: `translateX(${jitter}px)` }}
        >
          {candidates.map((option, i) => {
            const isPicked = picked.includes(i);
            const isWrong = wrongIndex === i;
            return (
              <button
                key={`${puzzle.word}-${option}`}
                type="button"
                onClick={() => tap(i)}
                disabled={isPicked}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition",
                  isPicked
                    ? "border-emerald-400 bg-emerald-500/15"
                    : isWrong
                      ? "border-rose-500 bg-rose-500/15"
                      : "border-line bg-[#131322] hover:border-primary/60 hover:bg-surface",
                )}
              >
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line font-mono text-[10px] font-bold",
                    isPicked
                      ? "border-emerald-400 text-emerald-300"
                      : isWrong
                        ? "border-rose-500 text-rose-400"
                        : "text-muted",
                  )}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-ink">{option}</span>
                {isPicked && <span className="ml-auto text-emerald-300">✓</span>}
                {isWrong && <span className="ml-auto text-rose-400">✕</span>}
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
                  ? "bg-amber-400"
                  : i === round && status === "playing"
                    ? "bg-primary"
                    : "bg-line",
              )}
            />
          ))}
        </div>

        {status === "idle" && (
          <Overlay>
            <p className="text-4xl">🔔</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              TWO OF SIX SOUND ALIKE
            </p>
            <p className="mt-2 text-sm text-muted">
              Tap both rhyming words to clear the round. A wrong tap breaks your streak multiplier.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start run
            </PrimaryButton>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="text-4xl">🏆</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              EIGHT ROUNDS CHIMED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · {cleared} of {ROUNDS} rounds cleared
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap both rhymes or press 1–6 · either order · misses reset the streak
      </p>
    </div>
  );
}
