"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

/** ~180 common words, every one 3–8 letters long. */
const WORDS = `cat dog fox owl bat cow pig ant bee crab deer duck fish frog goat hen lion wolf zebra tiger whale rabbit monkey snake
sun moon star tree river ocean cloud rain snow wind fire rock sand grass flower leaf seed stone beach forest island
valley desert glacier storm rainbow sunset meadow pond stream hill cave wave shell coral nest branch bark
apple grape lemon mango peach berry bread honey sugar milk water juice coffee pizza salad rice corn cake cookie
table chair window kitchen bedroom house floor roof door wall lamp mirror bottle basket pillow towel soap clock
street city village bridge tower castle market school office park harbor station garden yard balcony
king queen prince knight wizard hero giant baby friend doctor singer dancer painter writer
music dance song piano guitar drum movie theater actor camera photo paint color brush design
story poem novel pixel game level player score puzzle logic speed mouse screen button robot
engine rocket planet comet galaxy brain dream think build chase catch throw spin float
glide wander travel explore focus happy lucky quick smile laugh jump walk run clap sing`.split(/\s+/);

const LANES = 5;
const BOARD_H = 420;
const MAX_STRIKES = 3;
const MAX_WORDS = 5;

interface Word {
  id: number;
  text: string;
  lane: number;
  y: number;
}

interface Pop {
  id: number;
  lane: number;
  y: number;
  text: string;
}

type Phase = "idle" | "playing" | "over";

const speedFor = (score: number) => 34 + Math.min(130, score * 0.05);
const intervalFor = (score: number) => Math.max(0.7, 2.4 - score / 900);

export default function TypeStorm({ gameId }: { gameId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [words, setWords] = useState<Word[]>([]);
  const [buffer, setBuffer] = useState("");
  const [score, setScore] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [pops, setPops] = useState<Pop[]>([]);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  // refs are the live truth inside timers; state mirrors them for the view
  const wordsRef = useRef<Word[]>([]);
  const bufferRef = useRef("");
  const scoreRef = useRef(0);
  const strikesRef = useRef(0);
  const popId = useRef(0);
  const popTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      popTimers.current.forEach(clearTimeout);
    },
    [],
  );

  const pushPop = useCallback((w: Word, gain: number) => {
    const id = ++popId.current;
    setPops((prev) => [...prev, { id, lane: w.lane, y: w.y, text: `+${gain}` }]);
    popTimers.current.push(
      setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 850),
    );
  }, []);

  const destroy = useCallback(
    (w: Word) => {
      wordsRef.current = wordsRef.current.filter((x) => x.id !== w.id);
      setWords(wordsRef.current);
      const gain = w.text.length * 10;
      scoreRef.current += gain;
      setScore(scoreRef.current);
      pushPop(w, gain);
    },
    [pushPop],
  );

  const start = useCallback(() => {
    wordsRef.current = [];
    setWords([]);
    bufferRef.current = "";
    setBuffer("");
    scoreRef.current = 0;
    setScore(0);
    strikesRef.current = 0;
    setStrikes(0);
    setPops([]);
    setNewBest(false);
    setPhase("playing");
  }, []);

  // falling, spawning and strikes all happen inside the animation frame
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;

      const dy = speedFor(scoreRef.current) * dt;
      let breached = 0;
      const survivors: Word[] = [];
      for (const w of wordsRef.current) {
        const y = w.y + dy;
        if (y > BOARD_H) breached += 1;
        else survivors.push({ ...w, y });
      }
      wordsRef.current = survivors;
      setWords(survivors);

      if (breached > 0) {
        strikesRef.current += breached;
        setStrikes(strikesRef.current);
        if (strikesRef.current >= MAX_STRIKES) {
          setPhase("over");
          setNewBest(submit(scoreRef.current));
          wordsRef.current = [];
          setWords([]);
          return;
        }
      }

      acc += dt;
      if (acc >= intervalFor(scoreRef.current) && survivors.length < MAX_WORDS) {
        acc = 0;
        const used = new Set(survivors.map((w) => w.lane));
        const free = [0, 1, 2, 3, 4].filter((l) => !used.has(l));
        if (free.length) {
          const lane = free[Math.floor(Math.random() * free.length)];
          const text = WORDS[Math.floor(Math.random() * WORDS.length)];
          if (!survivors.some((w) => w.text === text)) {
            const word: Word = { id: ++popId.current, text, lane, y: -30 };
            wordsRef.current = [...wordsRef.current, word];
            setWords(wordsRef.current);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, submit]);

  // typing — handled keys are swallowed so the page never scrolls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== "playing" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " ") {
        e.preventDefault();
        bufferRef.current = "";
        setBuffer("");
        return;
      }
      if (e.key.length !== 1 || !/^[a-z]$/i.test(e.key)) return;
      e.preventDefault();
      const next = (bufferRef.current + e.key.toLowerCase()).slice(0, 12);
      const list = wordsRef.current;
      const hit = list.find((w) => w.text === next);
      if (hit) {
        destroy(hit);
        bufferRef.current = "";
        setBuffer("");
        return;
      }
      const ok = list.some((w) => w.text.startsWith(next));
      bufferRef.current = ok ? next : "";
      setBuffer(ok ? next : "");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, destroy]);

  const laneStyle = (lane: number) => ({ left: `${lane * (100 / LANES)}%` });

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-rose-400">
          Strikes{" "}
          <b className="ml-1 text-sm tracking-widest text-ink">
            {"█".repeat(strikes)}
            {"·".repeat(MAX_STRIKES - strikes)}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-[0_0_60px_-24px_rgba(34,211,238,0.9)]">
        <div className="relative" style={{ height: BOARD_H }} aria-label="Falling words board">
          {Array.from({ length: LANES }, (_, i) => (
            <span
              key={i}
              style={{ left: `${i * (100 / LANES)}%` }}
              className="pointer-events-none absolute inset-y-0 w-px bg-line/70"
            />
          ))}

          {/* strike zone */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 border-t-2 border-rose-500/70 bg-rose-500/10" />

          {words.map((w) => (
            <div
              key={w.id}
              style={{ ...laneStyle(w.lane), top: w.y, width: `${100 / LANES}%` }}
              className="absolute px-1 text-center"
            >
              <span
                className={cn(
                  "inline-block rounded-md border px-2 py-1 font-mono text-xs transition sm:text-sm",
                  buffer && w.text.startsWith(buffer)
                    ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                    : "border-line bg-surface text-ink",
                )}
              >
                {w.text}
              </span>
            </div>
          ))}

          {pops.map((p) => (
            <span
              key={p.id}
              style={{ ...laneStyle(p.lane), top: p.y, width: `${100 / LANES}%` }}
              className="animate-pop pointer-events-none absolute text-center font-display text-sm font-bold text-warn"
            >
              {p.text}
            </span>
          ))}

          <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[10px] uppercase tracking-[0.3em] text-muted/70">
            type before they land
          </span>
        </div>

        {phase === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">TYPE STORM</p>
            <p className="mt-2 text-sm text-muted">
              Words rain down five lanes — type them before they land.
            </p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">
              Start typing
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              A–Z types · Space clears · 3 strikes ends the run
            </p>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">STORM WINS</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New high score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">Best {best ?? "—"}</p>
            <PrimaryButton onClick={start} tone="from-cyan-400 via-sky-500 to-blue-600">
              Run it back
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <div className="mt-2 rounded-xl border border-line bg-surface px-3 py-2 text-center font-mono text-lg">
        {buffer ? (
          <span className="text-cyan-400">{buffer}</span>
        ) : (
          <span className="text-muted">start typing…</span>
        )}
      </div>

    </div>
  );
}
