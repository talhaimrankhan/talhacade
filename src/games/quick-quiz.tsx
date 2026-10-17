"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

interface Q {
  q: string;
  a: string;
  o: string[];
}

/** Original general-knowledge bank — every answer is stable fact. */
const QUESTIONS: Q[] = [
  { q: "What is the chemical symbol for gold?", a: "Au", o: ["Au", "Ag", "Fe", "Go"] },
  { q: "Which planet is known as the Red Planet?", a: "Mars", o: ["Mars", "Venus", "Jupiter", "Mercury"] },
  { q: "What is the capital of Australia?", a: "Canberra", o: ["Canberra", "Sydney", "Melbourne", "Perth"] },
  { q: "Which is the largest ocean on Earth?", a: "Pacific", o: ["Pacific", "Atlantic", "Indian", "Arctic"] },
  { q: "How many continents are there?", a: "7", o: ["7", "5", "6", "8"] },
  { q: "The Great Pyramid of Giza stands in which country?", a: "Egypt", o: ["Egypt", "Sudan", "Mexico", "Greece"] },
  { q: "Which gas do plants absorb from the air?", a: "Carbon dioxide", o: ["Carbon dioxide", "Oxygen", "Nitrogen", "Helium"] },
  { q: "How many legs does a spider have?", a: "8", o: ["8", "6", "10", "4"] },
  { q: "Light travels at roughly which speed?", a: "300,000 km per second", o: ["300,000 km per second", "30,000 km per second", "3,000 km per second", "30 km per second"] },
  { q: "H2O is the chemical formula for what?", a: "Water", o: ["Water", "Salt", "Sugar", "Vinegar"] },
  { q: "Which instrument has 88 keys?", a: "Piano", o: ["Piano", "Organ", "Harp", "Accordion"] },
  { q: "Who painted the Mona Lisa?", a: "Leonardo da Vinci", o: ["Leonardo da Vinci", "Michelangelo", "Van Gogh", "Picasso"] },
  { q: "In which sport is a score of zero called “love”?", a: "Tennis", o: ["Tennis", "Golf", "Cricket", "Baseball"] },
  { q: "How many players does a soccer team have on the field?", a: "11", o: ["11", "9", "10", "12"] },
  { q: "What is the tallest living land animal?", a: "Giraffe", o: ["Giraffe", "Elephant", "Camel", "Moose"] },
  { q: "Which is the longest river in Africa?", a: "Nile", o: ["Nile", "Congo", "Niger", "Zambezi"] },
  { q: "At sea level, water boils at what temperature in Celsius?", a: "100°C", o: ["100°C", "90°C", "80°C", "110°C"] },
  { q: "How many days are in a leap year?", a: "366", o: ["366", "365", "364", "360"] },
  { q: "Which country gifted the Statue of Liberty to the USA?", a: "France", o: ["France", "Spain", "Britain", "Italy"] },
  { q: "What is the smallest prime number?", a: "2", o: ["2", "1", "3", "5"] },
  { q: "Which blood type is called the universal donor?", a: "O negative", o: ["O negative", "AB positive", "A positive", "B negative"] },
  { q: "Which planet is known as the Morning Star?", a: "Venus", o: ["Venus", "Mars", "Mercury", "Jupiter"] },
  { q: "Which is the largest hot desert in the world?", a: "Sahara", o: ["Sahara", "Gobi", "Kalahari", "Arabian"] },
  { q: "How many bones are in the adult human body?", a: "206", o: ["206", "186", "224", "300"] },
  { q: "Which element has atomic number 1?", a: "Hydrogen", o: ["Hydrogen", "Helium", "Oxygen", "Carbon"] },
  { q: "Who wrote “Romeo and Juliet”?", a: "Shakespeare", o: ["Shakespeare", "Dickens", "Austen", "Twain"] },
  { q: "What is the capital of Japan?", a: "Tokyo", o: ["Tokyo", "Osaka", "Kyoto", "Sapporo"] },
  { q: "The Amazon rainforest lies mostly in which country?", a: "Brazil", o: ["Brazil", "Peru", "Colombia", "Venezuela"] },
  { q: "How many strings does a standard violin have?", a: "4", o: ["4", "5", "6", "3"] },
  { q: "What does the “www” in a web address stand for?", a: "World Wide Web", o: ["World Wide Web", "Wide World Web", "Web World Wide", "World Web Wide"] },
  { q: "Which planet is closest to the Sun?", a: "Mercury", o: ["Mercury", "Venus", "Earth", "Mars"] },
  { q: "Water freezes at what temperature in Celsius?", a: "0°C", o: ["0°C", "10°C", "32°C", "−10°C"] },
  { q: "Which mammal can truly fly?", a: "Bat", o: ["Bat", "Flying squirrel", "Sugar glider", "Colugo"] },
  { q: "The Eiffel Tower stands in which city?", a: "Paris", o: ["Paris", "Rome", "Madrid", "London"] },
  { q: "What is the largest planet in the solar system?", a: "Jupiter", o: ["Jupiter", "Saturn", "Neptune", "Earth"] },
  { q: "How many sides does a hexagon have?", a: "6", o: ["6", "5", "7", "8"] },
  { q: "Which sport is played at Wimbledon?", a: "Tennis", o: ["Tennis", "Golf", "Cricket", "Rugby"] },
  { q: "What is the main ingredient of guacamole?", a: "Avocado", o: ["Avocado", "Tomato", "Cucumber", "Pepper"] },
  { q: "Who released the album “Thriller”?", a: "Michael Jackson", o: ["Michael Jackson", "Prince", "Madonna", "Stevie Wonder"] },
  { q: "Which planet is famous for its bright rings?", a: "Saturn", o: ["Saturn", "Jupiter", "Uranus", "Neptune"] },
  { q: "What is the chemical symbol for iron?", a: "Fe", o: ["Fe", "Ir", "Fo", "Fr"] },
  { q: "In which year did humans first land on the Moon?", a: "1969", o: ["1969", "1965", "1972", "1959"] },
  { q: "Which country is called the Land of the Rising Sun?", a: "Japan", o: ["Japan", "China", "Thailand", "Korea"] },
  { q: "How many colours are traditionally in a rainbow?", a: "7", o: ["7", "5", "6", "8"] },
  { q: "What is the hardest natural substance?", a: "Diamond", o: ["Diamond", "Gold", "Iron", "Quartz"] },
  { q: "What is the largest organ of the human body?", a: "Skin", o: ["Skin", "Liver", "Brain", "Heart"] },
  { q: "Who discovered penicillin?", a: "Alexander Fleming", o: ["Alexander Fleming", "Marie Curie", "Louis Pasteur", "Isaac Newton"] },
  { q: "What is the square root of 64?", a: "8", o: ["8", "6", "7", "9"] },
  { q: "What is the capital of Canada?", a: "Ottawa", o: ["Ottawa", "Toronto", "Vancouver", "Montreal"] },
  { q: "Which animal is famously called man's best friend?", a: "Dog", o: ["Dog", "Cat", "Horse", "Parrot"] },
  { q: "How many zeros are in one million?", a: "6", o: ["6", "9", "5", "8"] },
];

const RUN_LENGTH = 10;
const QUESTION_SECONDS = 15;
const REVEAL_MS = 1500;

type Phase = "idle" | "playing" | "reveal" | "over";

function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function QuickQuiz({ gameId }: { gameId: string }) {
  const [run, setRun] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [right, setRight] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const streakRef = useRef(0);
  const idxRef = useRef(0);
  const timeRef = useRef(QUESTION_SECONDS);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grading = useRef(false);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const start = useCallback(() => {
    const next = shuffle(QUESTIONS)
      .slice(0, RUN_LENGTH)
      .map((item) => ({ ...item, o: shuffle(item.o) }));
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    grading.current = false;
    scoreRef.current = 0;
    livesRef.current = 3;
    streakRef.current = 0;
    idxRef.current = 0;
    timeRef.current = QUESTION_SECONDS;
    setRun(next);
    setIdx(0);
    setPicked(null);
    setLives(3);
    setStreak(0);
    setScore(0);
    setRight(0);
    setLastGain(0);
    setTimeLeft(QUESTION_SECONDS);
    setNewBest(false);
    setPhase("playing");
  }, []);

  const advance = useCallback(() => {
    grading.current = false;
    if (livesRef.current <= 0 || idxRef.current + 1 >= RUN_LENGTH) {
      setPhase("over");
      setNewBest(submit(scoreRef.current));
      return;
    }
    idxRef.current += 1;
    setIdx(idxRef.current);
    setPicked(null);
    setLastGain(0);
    timeRef.current = QUESTION_SECONDS;
    setTimeLeft(QUESTION_SECONDS);
    setPhase("playing");
  }, [submit]);

  const grade = useCallback(
    (choice: string | null) => {
      if (phase !== "playing" || grading.current) return;
      grading.current = true;
      const item = run[idx];
      if (!item) return;
      setPhase("reveal");
      setPicked(choice);

      if (choice === item.a) {
        streakRef.current += 1;
        const mult = streakRef.current >= 5 ? 2 : streakRef.current >= 3 ? 1.5 : 1;
        const gained = Math.round((100 + timeRef.current * 10) * mult);
        scoreRef.current += gained;
        setStreak(streakRef.current);
        setScore(scoreRef.current);
        setLastGain(gained);
        setRight((r) => r + 1);
      } else {
        streakRef.current = 0;
        livesRef.current -= 1;
        setStreak(0);
        setLives(livesRef.current);
        setLastGain(0);
      }
      advanceTimer.current = setTimeout(advance, REVEAL_MS);
    },
    [phase, run, idx, advance],
  );

  const nextNow = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    advance();
  }, [advance]);

  // 15-second countdown; a timeout counts as a wrong answer
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      timeRef.current -= 1;
      setTimeLeft(timeRef.current);
      if (timeRef.current <= 0) {
        clearInterval(id);
        grade(null);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, grade]);

  const item = run[idx];
  const mult = streak >= 5 ? "×2" : streak >= 3 ? "×1.5" : null;

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-rose-400">
          Lives{" "}
          <b className="ml-1 text-sm tracking-widest text-ink">
            {"♥".repeat(lives)}
            <span className="text-muted">{"♡".repeat(3 - lives)}</span>
          </b>
        </span>
        <span className="text-accent">
          Streak <b className="ml-1 text-sm text-ink">{streak}</b>
          {mult && <b className="ml-1 text-warn">{mult}</b>}
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(56,189,248,0.9)]">
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
          <div
            style={{ width: `${(timeLeft / QUESTION_SECONDS) * 100}%` }}
            className={cn(
              "h-full rounded-full transition-[width] duration-1000 ease-linear",
              timeLeft <= 5 ? "bg-rose-500" : "bg-cyan-400",
            )}
          />
        </div>

        {item && (
          <>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-muted">
              Question {idx + 1} / {RUN_LENGTH} · {timeLeft}s left
            </p>
            <p className="mt-1 font-display text-lg leading-snug text-ink sm:text-xl">
              {item.q}
            </p>
            <div className="mt-3 grid gap-2">
              {item.o.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => grade(opt)}
                  disabled={phase !== "playing"}
                  aria-label={`Answer ${opt}`}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm transition",
                    phase === "reveal" && opt === item.a
                      ? "border-success/70 bg-success/10 text-success"
                      : phase === "reveal" && opt === picked
                        ? "border-rose-500/70 bg-rose-500/10 text-rose-300"
                        : "border-line bg-surface text-ink enabled:hover:border-primary/50",
                  )}
                >
                  {opt}
                  {phase === "reveal" && opt === item.a && (
                    <span className="float-right font-mono text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {phase === "reveal" && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p
              className={cn(
                "font-mono text-sm font-bold",
                lastGain > 0 ? "text-warn" : "text-rose-400",
              )}
            >
              {lastGain > 0
                ? `+${lastGain} points`
                : lives > 0
                  ? "Missed — one life gone"
                  : "Out of lives"}
            </p>
            <button
              type="button"
              onClick={nextNow}
              className="rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 px-4 py-1.5 text-xs font-bold text-black transition hover:brightness-110 active:scale-95"
            >
              Next →
            </button>
          </div>
        )}

        {phase === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">QUICK QUIZ</p>
            <p className="mt-2 text-sm text-muted">
              Ten questions, three lives, fifteen seconds each.
            </p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">
              Start the run
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Fast answers score more · 3 in a row ×1.5 · 5 in a row ×2
            </p>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              {lives > 0 ? "RUN COMPLETE" : "OUT OF LIVES"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New high score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {right}/{RUN_LENGTH} correct · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Pick an answer before the bar empties · streaks multiply everything
      </p>
    </div>
  );
}
