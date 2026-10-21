"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const ROUNDS = 8;
const ROUND_MS = 30000;
const TICK_MS = 250;
const TONE = "from-rose-400 via-pink-500 to-fuchsia-600";

interface Puzzle {
  art: string;
  answer: string;
}

/** Hand-built emoji rebuses; answers are short common words or phrases. */
const BANK: Puzzle[] = [
  { art: "⭐🐟", answer: "starfish" },
  { art: "🌙💡", answer: "moonlight" },
  { art: "🐶🏠", answer: "doghouse" },
  { art: "📚🐛", answer: "bookworm" },
  { art: "🌧🏹", answer: "rainbow" },
  { art: "☀️🌸", answer: "sunflower" },
  { art: "🔥🪰", answer: "firefly" },
  { art: "⭐💡", answer: "starlight" },
  { art: "🌊🐚", answer: "seashell" },
  { art: "🏖️🏰", answer: "sandcastle" },
  { art: "🧈✈️", answer: "butterfly" },
  { art: "🐉✈️", answer: "dragonfly" },
  { art: "🐴✈️", answer: "horsefly" },
  { art: "👩🐞", answer: "ladybug" },
  { art: "🔙🦴", answer: "backbone" },
  { art: "🐶👀", answer: "watchdog" },
  { art: "🧱📄", answer: "wallpaper" },
  { art: "✋👜", answer: "handbag" },
  { art: "🌙🚶", answer: "moonwalk" },
  { art: "⭐🚀", answer: "starship" },
  { art: "☀️✨", answer: "sunshine" },
  { art: "🌧🍂", answer: "rainfall" },
  { art: "❄️🍂", answer: "snowfall" },
  { art: "🌊🍂", answer: "waterfall" },
  { art: "🥚🪴", answer: "eggplant" },
  { art: "✉️📦", answer: "mailbox" },
  { art: "❤️🥁", answer: "heartbeat" },
  { art: "🌊🐴", answer: "seahorse" },
  { art: "💡🏠", answer: "lighthouse" },
  { art: "👆🖨️", answer: "fingerprint" },
  { art: "🧺🏀", answer: "basketball" },
  { art: "👟⚽", answer: "football" },
  { art: "🍯🐝", answer: "honeybee" },
  { art: "🌊🏖️", answer: "seaside" },
  { art: "🏜️📄", answer: "sandpaper" },
  { art: "🌪🌸", answer: "wildflower" },
  { art: "🌊✈️", answer: "seaplane" },
  { art: "🥚🐚", answer: "eggshell" },
  { art: "🐶🍖", answer: "dog food" },
  { art: "🚢💥", answer: "shipwreck" },
  { art: "🐦🏠", answer: "birdhouse" },
  { art: "🔥🏠", answer: "firehouse" },
  { art: "❄️⚽", answer: "snowball" },
  { art: "🏖️⚽", answer: "beach ball" },
  { art: "🌨🧍", answer: "snowman" },
  { art: "✋🧍", answer: "handstand" },
  { art: "🔙🧳", answer: "backpack" },
  { art: "💙📋", answer: "blueprint" },
  { art: "📸🔙", answer: "flashback" },
  { art: "👁️🎨", answer: "eyeshadow" },
  { art: "🛏️⏰", answer: "bedtime" },
  { art: "🍵⏰", answer: "teatime" },
  { art: "🎭⏰", answer: "showtime" },
  { art: "💀📏", answer: "deadline" },
  { art: "🧠🚿", answer: "brain drain" },
  { art: "🔥🐶", answer: "hot dog" },
  { art: "🔊🌽", answer: "popcorn" },
  { art: "☕🎂", answer: "cupcake" },
  { art: "🌲🍎", answer: "pineapple" },
  { art: "🌿🦗", answer: "grasshopper" },
  { art: "🔙🌿", answer: "backyard" },
  { art: "✋📘", answer: "handbook" },
  { art: "✋🤝", answer: "handshake" },
  { art: "🌧🧥", answer: "raincoat" },
  { art: "❄️👟", answer: "snowshoe" },
  { art: "🌙🧢", answer: "nightcap" },
  { art: "🌊🍈", answer: "watermelon" },
  { art: "🔥🚒", answer: "fire truck" },
  { art: "🪙🏃", answer: "gold rush" },
  { art: "🏜️🛝", answer: "landslide" },
  { art: "🏃🛟", answer: "lifesaver" },
  { art: "✋✍️", answer: "handwriting" },
  { art: "☁️9️⃣", answer: "cloud nine" },
  { art: "🃏🍭", answer: "trick or treat" },
  { art: "💥🦵", answer: "break a leg" },
  { art: "🥶🫂", answer: "cold shoulder" },
  { art: "🐱🐭", answer: "cat and mouse" },
  { art: "☝️ AND 👇", answer: "up and down" },
  { art: "🔒 AND 🔑", answer: "lock and key" },
  { art: "🔥 AND 🧊", answer: "fire and ice" },
  { art: "🍰🍰", answer: "piece of cake" },
  { art: "🍳🛏️", answer: "breakfast in bed" },
  { art: "👅🪢", answer: "tongue tied" },
  { art: "🌞🌙", answer: "day and night" },
  { art: "🌧☀️", answer: "rain or shine" },
  { art: "🐴🏠", answer: "stable" },
  { art: "🚦🟢", answer: "green light" },
  { art: "🚦🔴", answer: "red light" },
  { art: "☀️🐟", answer: "sunfish" },
  { art: "🌙🪨", answer: "moonstone" },
  { art: "🐝🦵", answer: "bee's knees" },
  { art: "🍳 AND 🎂", answer: "pancake" },
  { art: "🍞🧈", answer: "bread and butter" },
  { art: "🎈🎂", answer: "birthday party" },
  { art: "🧊 AND 🐟", answer: "cold fish" },
  { art: "☀️ AND 🌙", answer: "sun and moon" },
  { art: "🚪 AND 🚪", answer: "double doors" },
];

type Phase = "idle" | "playing" | "over";

/** Case, spaces and punctuation never matter for a rebus answer. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

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

export default function RebusRiddle() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [rounds, setRounds] = useState<Puzzle[]>(BANK.slice(0, ROUNDS));
  const [idx, setIdx] = useState(0);
  const [msLeft, setMsLeft] = useState(ROUND_MS);
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState(false);
  const [hold, setHold] = useState(false);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [solved, setSolved] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("rebus-riddle", "high");

  const roundsRef = useRef<Puzzle[]>(BANK.slice(0, ROUNDS));
  const idxRef = useRef(0);
  const msRef = useRef(ROUND_MS);
  const streakRef = useRef(0);
  const scoreRef = useRef(0);
  const solvedRef = useRef(0);
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

  const finish = useCallback(() => {
    setPhase("over");
    setNewBest(submit(scoreRef.current));
  }, [submit]);

  const loadRound = useCallback((next: number) => {
    idxRef.current = next;
    msRef.current = ROUND_MS;
    setIdx(next);
    setMsLeft(ROUND_MS);
    setDraft("");
    setHint(false);
    setHold(false);
  }, []);

  const start = useCallback(() => {
    clearTimers();
    roundsRef.current = shuffle(BANK).slice(0, ROUNDS);
    streakRef.current = 0;
    scoreRef.current = 0;
    solvedRef.current = 0;
    setRounds(roundsRef.current);
    setStreak(0);
    setScore(0);
    setSolved(0);
    setNewBest(false);
    setPhase("playing");
    loadRound(0);
  }, [clearTimers, loadRound]);

  const advance = useCallback(() => {
    const next = idxRef.current + 1;
    if (next >= ROUNDS) {
      finish();
      return;
    }
    loadRound(next);
  }, [finish, loadRound]);

  const afterTimeout = useCallback(() => {
    streakRef.current = 0;
    setStreak(0);
    advance();
  }, [advance]);

  useEffect(() => {
    if (phase !== "playing" || hold) return;
    const id = setInterval(() => {
      msRef.current -= TICK_MS;
      setMsLeft(msRef.current);
      if (msRef.current <= 0) afterTimeout();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, hold, afterTimeout]);

  const send = useCallback(() => {
    if (phase !== "playing") return;
    const guess = norm(draft);
    if (guess === "") return;
    if (guess === norm(roundsRef.current[idxRef.current].answer)) {
      const speed = Math.round(100 * (Math.max(0, msRef.current) / ROUND_MS));
      streakRef.current += 1;
      setStreak(streakRef.current);
      const mult = streakRef.current >= 7 ? 3 : streakRef.current >= 4 ? 2 : 1;
      const pts = (100 + speed) * mult;
      scoreRef.current += pts;
      setScore(scoreRef.current);
      solvedRef.current += 1;
      setSolved(solvedRef.current);
      setDraft("");
      setHold(true);
      timers.current.push(setTimeout(advance, 520));
      return;
    }
    streakRef.current = 0;
    setStreak(0);
    setDraft("");
  }, [phase, draft, advance]);

  const mult = streak >= 7 ? 3 : streak >= 4 ? 2 : 1;
  const puzzle = rounds[idx];
  const timerPct = Math.max(0, (msLeft / ROUND_MS) * 100);

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-pink-300">
          ×<b className="ml-1 text-sm text-ink">{mult}</b>
        </span>
        <span className="text-accent">
          Puzzle <b className="ml-1 text-sm text-ink">{Math.min(idx + 1, ROUNDS)}/{ROUNDS}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(244,114,182,0.7)] sm:p-5">
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#131322]">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-200 ease-linear",
              timerPct > 50
                ? "bg-pink-400"
                : timerPct > 20
                  ? "bg-warn"
                  : "bg-rose-500",
            )}
            style={{ width: `${timerPct}%` }}
          />
        </div>

        <div className="grid min-h-[140px] place-items-center rounded-2xl border border-line bg-[#0d0d18] px-4 py-6">
          <p className="whitespace-pre-wrap text-center font-display text-5xl leading-relaxed tracking-widest sm:text-6xl">
            {puzzle.art}
          </p>
        </div>

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
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            aria-label="Type the answer"
            placeholder="the answer is…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-[#0d0d18] px-3 py-2 font-display text-sm text-ink placeholder:text-muted/60 focus:border-primary/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={phase !== "playing"}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-bold text-ink transition hover:border-primary/60 hover:bg-surface-2"
          >
            Solve
          </button>
        </form>

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setHint(true)}
            disabled={phase !== "playing" || hint}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2 disabled:opacity-50"
          >
            💡 Hint
          </button>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            {hint ? (
              <span className="text-ink">
                Starts with {puzzle.answer.slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <span>streak {streak}</span>
            )}
          </p>
        </div>

        {phase === "idle" && (
          <Overlay>
            <p className="text-4xl">🤔</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient-hot">
              READ THE EMOJI
            </p>
            <p className="mt-2 text-sm text-muted">
              Each picture hides a word or phrase — spaces and punctuation don&apos;t matter.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              First riddle
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">RUN COMPLETE</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {solved}/{ROUNDS} solved · best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              New riddles
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Type the answer and press Enter · clean solves build a ×3 multiplier · eight puzzles per run
      </p>
    </div>
  );
}
