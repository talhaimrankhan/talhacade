"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const CX = 130;
const CY = 130;
const R_BULL_IN = 7;
const R_BULL_OUT = 16;
const R_TREBLE_IN = 60;
const R_TREBLE_OUT = 70;
const R_DOUBLE_IN = 88;
const R_OUTER = 100;
const START_SCORE = 301;
const LEGS_TO_WIN = 2;
const PLAYER_SCATTER = 10;
const CPU_SCATTER = 26;

/** Clock order: 20 sits at the top, then 1, 18, 4 … clockwise. */
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

type Pt = { x: number; y: number };
type Phase = "idle" | "player" | "cpu" | "over";
interface Mark {
  id: number;
  x: number;
  y: number;
  who: "you" | "cpu";
}
interface Hit {
  pts: number;
  label: string;
}

function polar(n: number, r: number): Pt {
  const a = ((ORDER.indexOf(n) * 18 - 90) * Math.PI) / 180;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

function scorePoint(x: number, y: number): Hit {
  const r = Math.hypot(x, y);
  if (r > R_OUTER) return { pts: 0, label: "Miss" };
  if (r <= R_BULL_IN) return { pts: 50, label: "Bullseye" };
  if (r <= R_BULL_OUT) return { pts: 25, label: "Bull" };
  let deg = (Math.atan2(y, x) * 180) / Math.PI;
  deg = (deg + 90 + 360) % 360;
  const num = ORDER[Math.floor(deg / 18) % 20];
  if (r <= R_TREBLE_IN) return { pts: num, label: `${num}` };
  if (r <= R_TREBLE_OUT) return { pts: num * 3, label: `T${num}` };
  if (r <= R_DOUBLE_IN) return { pts: num, label: `${num}` };
  return { pts: num * 2, label: `D${num}` };
}

/** Annular sector path for one board segment. */
function sector(r0: number, r1: number, i: number): string {
  const step = Math.PI / 10;
  const base = -Math.PI / 2 + i * step;
  const a0 = base - step / 2;
  const a1 = base + step / 2;
  const p = (r: number, a: number) =>
    `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`;
  if (r0 === 0) return `M ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} Z`;
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
}

function checkoutHint(rem: number): string | null {
  if (rem < 2 || rem > 170) return null;
  if (rem % 2 === 0 && rem <= 40) return `D${rem / 2}`;
  if (rem <= 20) return `S${rem}`;
  if (rem === 50) return "Bull";
  const firsts = [
    60, 50, 40, 32, 34, 36, 38, 44, 48, 30, 28, 26, 24, 22, 20, 18, 16, 14,
    12, 10, 8, 6, 4, 2, 59, 57, 55, 53, 51, 49, 47, 45, 43, 41, 39, 37, 35,
    33, 31, 29, 27, 25, 23, 21, 19, 17, 15, 13, 11, 9, 7, 5, 3,
  ];
  for (const f of firsts) {
    const rest = rem - f;
    if (rest >= 2 && rest <= 40 && rest % 2 === 0) return `${f} + D${rest / 2}`;
  }
  const rest = rem - 120;
  if (rest >= 2 && rest <= 40 && rest % 2 === 0) return `60 + 60 + D${rest / 2}`;
  return null;
}

/** Where the CPU aims: sensible target, never maths it cannot check out. */
function cpuTarget(rem: number): Pt {
  if (rem === 50) return { x: 0, y: 0 };
  if (rem === 25) return { x: R_BULL_OUT - 4, y: 0 };
  if (rem <= 40 && rem % 2 === 0) return polar(rem / 2, R_DOUBLE_IN + 6);
  if (rem <= 20) return polar(rem, R_TREBLE_IN - 20);
  return polar(20, (R_TREBLE_IN + R_TREBLE_OUT) / 2);
}

function scatter(p: Pt, spread: number): Pt {
  return {
    x: p.x + (Math.random() - 0.5) * spread,
    y: p.y + (Math.random() - 0.5) * spread,
  };
}

export default function BullseyeDarts({ gameId }: { gameId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [youRem, setYouRem] = useState(START_SCORE);
  const [cpuRem, setCpuRem] = useState(START_SCORE);
  const [legsYou, setLegsYou] = useState(0);
  const [legsCpu, setLegsCpu] = useState(0);
  const [dartsLeft, setDartsLeft] = useState(3);
  const [cpuDarts, setCpuDarts] = useState(0);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [log, setLog] = useState("Three darts a turn — first to two legs");
  const [matchWinner, setMatchWinner] = useState<"you" | "cpu">("you");
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const remRef = useRef({ you: START_SCORE, cpu: START_SCORE });
  const markId = useRef(0);

  const addMark = useCallback((p: Pt, who: "you" | "cpu") => {
    markId.current += 1;
    const id = markId.current;
    setMarks((prev) => [...prev, { id, x: p.x, y: p.y, who }]);
  }, []);

  /** Returns "ok" | "bust" | "win" and keeps ref + state in sync. */
  const applyScore = useCallback((who: "you" | "cpu", hit: Hit) => {
    const cur = remRef.current[who];
    const next = cur - hit.pts;
    if (next < 0) return "bust" as const;
    remRef.current[who] = next;
    if (who === "you") setYouRem(next);
    else setCpuRem(next);
    return next === 0 ? ("win" as const) : ("ok" as const);
  }, []);

  const resetScores = useCallback(() => {
    remRef.current = { you: START_SCORE, cpu: START_SCORE };
    setYouRem(START_SCORE);
    setCpuRem(START_SCORE);
    setMarks([]);
    setDartsLeft(3);
    setCpuDarts(0);
  }, []);

  const winLeg = useCallback(
    (who: "you" | "cpu") => {
      const legs = (who === "you" ? legsYou : legsCpu) + 1;
      if (who === "you") setLegsYou(legs);
      else setLegsCpu(legs);

      if (legs >= LEGS_TO_WIN) {
        if (who === "you") setNewBest(submit(legs));
        setMatchWinner(who);
        setPhase("over");
        return;
      }
      const other = who === "you" ? legsCpu : legsYou;
      resetScores();
      setLog(
        `Leg to ${who === "you" ? "you" : "CPU"} — ${legs}–${other}. Fresh 301, you throw first.`,
      );
      setPhase("player");
    },
    [legsYou, legsCpu, resetScores, submit],
  );

  const start = useCallback(() => {
    remRef.current = { you: START_SCORE, cpu: START_SCORE };
    setYouRem(START_SCORE);
    setCpuRem(START_SCORE);
    setLegsYou(0);
    setLegsCpu(0);
    setMarks([]);
    setDartsLeft(3);
    setCpuDarts(0);
    setNewBest(false);
    setLog("First dart — click anywhere on the board");
    setPhase("player");
  }, []);

  /* ------------------------------ player ------------------------------ */

  const playerThrow = (e: React.PointerEvent<SVGSVGElement>) => {
    if (phase !== "player") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = 260 / rect.width;
    const p = {
      x: (e.clientX - rect.left) * scale - CX,
      y: (e.clientY - rect.top) * scale - CY,
    };
    const land = scatter(p, PLAYER_SCATTER);
    const hit = scorePoint(land.x, land.y);
    addMark(land, "you");
    const res = applyScore("you", hit);

    if (res === "win") {
      setLog(`You hit ${hit.label} — leg!`);
      winLeg("you");
      return;
    }
    if (res === "bust") {
      setLog(`You hit ${hit.label} (${hit.pts}) — bust on ${youRem}, turn over`);
      setPhase("cpu");
      setCpuDarts(0);
      setMarks([]);
      return;
    }

    const left = dartsLeft - 1;
    setDartsLeft(left);
    if (left === 0) {
      setLog(`You hit ${hit.label} — turn done, CPU steps up`);
      setPhase("cpu");
      setCpuDarts(0);
      setMarks([]);
    } else {
      setLog(`You hit ${hit.label} for ${hit.pts} — ${remRef.current.you} left, ${left} dart${left === 1 ? "" : "s"} to go`);
    }
  };

  /* ------------------------------ CPU ------------------------------ */

  const cpuThrow = useCallback(() => {
    const target = cpuTarget(remRef.current.cpu);
    const land = scatter(target, CPU_SCATTER);
    const hit = scorePoint(land.x, land.y);
    addMark(land, "cpu");
    const res = applyScore("cpu", hit);

    if (res === "win") {
      setLog(`CPU checks out ${hit.label} — leg!`);
      winLeg("cpu");
      return;
    }
    if (res === "bust") {
      setLog(`CPU hits ${hit.label} and busts — back to you on ${remRef.current.you}`);
      setDartsLeft(3);
      setMarks([]);
      setPhase("player");
      return;
    }
    const n = cpuDarts + 1;
    setCpuDarts(n);
    if (n >= 3) {
      setLog(`CPU hits ${hit.label} — ${remRef.current.cpu} left. Your throw`);
      setDartsLeft(3);
      setMarks([]);
      setPhase("player");
    } else {
      setLog(`CPU hits ${hit.label} for ${hit.pts} — ${remRef.current.cpu} left`);
    }
  }, [cpuDarts, addMark, applyScore, winLeg]);

  // one CPU dart every ~900ms until the turn ends
  useEffect(() => {
    if (phase !== "cpu") return;
    const timer = setTimeout(() => cpuThrow(), 900);
    return () => clearTimeout(timer);
  }, [phase, cpuThrow]);

  /* ------------------------------ view ------------------------------ */

  const hint = checkoutHint(youRem);
  const cpuHint = checkoutHint(cpuRem);

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={legsYou} best={best ?? "—"}>
        <span className="text-rose-400">
          CPU <b className="ml-1 text-sm text-ink">{legsCpu}</b>
        </span>
        <span className="text-cyan-400">
          Darts{" "}
          <b className="ml-1 text-sm text-ink">
            {"●".repeat(Math.max(0, dartsLeft)) || "—"}
          </b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(244,114,182,0.7)]">
        <svg
          viewBox="0 0 260 260"
          onPointerDown={playerThrow}
          aria-label="Dartboard — click to throw a dart"
          className={`block w-full touch-none select-none ${
            phase === "player" ? "cursor-crosshair" : "cursor-default"
          }`}
        >
          <defs>
            <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx={CX} cy={CY} r={112} fill="#0b0b16" />
          <circle cx={CX} cy={CY} r={R_OUTER + 4} fill="none" stroke="#22d3ee" strokeWidth="2" opacity="0.55" filter="url(#glow)" />

          {/* outer singles + doubles + trebles + inner singles */}
          {ORDER.map((_, i) => (
            <path key={`outer-${i}`} d={sector(R_DOUBLE_IN, R_OUTER, i)} fill={i % 2 === 0 ? "#dc2626" : "#16a34a"} />
          ))}
          {ORDER.map((_, i) => (
            <path key={`os-${i}`} d={sector(R_TREBLE_OUT, R_DOUBLE_IN, i)} fill={i % 2 === 0 ? "#111827" : "#e5e7eb"} />
          ))}
          {ORDER.map((_, i) => (
            <path key={`treble-${i}`} d={sector(R_TREBLE_IN, R_TREBLE_OUT, i)} fill={i % 2 === 0 ? "#dc2626" : "#16a34a"} />
          ))}
          {ORDER.map((_, i) => (
            <path key={`inner-${i}`} d={sector(R_BULL_OUT, R_TREBLE_IN, i)} fill={i % 2 === 0 ? "#111827" : "#e5e7eb"} />
          ))}
          <circle cx={CX} cy={CY} r={R_BULL_OUT} fill="#16a34a" />
          <circle cx={CX} cy={CY} r={R_BULL_IN} fill="#dc2626" />

          {/* wire lines between segments */}
          {ORDER.map((_, i) => {
            const a = ((i * 18 - 99) * Math.PI) / 180;
            return (
              <line
                key={`wire-${i}`}
                x1={CX + R_BULL_OUT * Math.cos(a)}
                y1={CY + R_BULL_OUT * Math.sin(a)}
                x2={CX + R_OUTER * Math.cos(a)}
                y2={CY + R_OUTER * Math.sin(a)}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="0.7"
              />
            );
          })}

          {ORDER.map((n) => {
            const p = polar(n, 110);
            return (
              <text
                key={`n-${n}`}
                x={CX + p.x}
                y={CY + p.y}
                fill="#e5e7eb"
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="ui-monospace, monospace"
              >
                {n}
              </text>
            );
          })}

          {marks.map((m) => (
            <g key={m.id}>
              <circle
                cx={CX + m.x}
                cy={CY + m.y}
                r="5"
                fill={m.who === "you" ? "#22d3ee" : "#fb7185"}
                stroke="#0b0b16"
                strokeWidth="1.5"
              />
              <path
                d={`M ${CX + m.x - 3} ${CY + m.y} L ${CX + m.x + 3} ${CY + m.y} M ${CX + m.x} ${CY + m.y - 3} L ${CX + m.x} ${CY + m.y + 3}`}
                stroke="#0b0b16"
                strokeWidth="1"
              />
            </g>
          ))}
        </svg>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-cyan-300">
            You <b className="ml-1 text-lg text-ink">{youRem}</b>
            <span className="block text-[10px] text-muted">
              {hint ? `Checkout ${hint}` : youRem > 170 ? "No checkout yet" : "Setup shot"}
            </span>
          </div>
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-rose-300">
            CPU <b className="ml-1 text-lg text-ink">{cpuRem}</b>
            <span className="block text-[10px] text-muted">
              {cpuHint ? `Checkout ${cpuHint}` : cpuRem > 170 ? "No checkout yet" : "Setup shot"}
            </span>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-muted">
          {phase === "player"
            ? "Your throw — click the board"
            : phase === "cpu"
              ? "CPU is at the oche…"
              : "Legs run to two — straight out, no doubles required"}
        </p>
        <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-widest text-warn">
          {log}
        </p>

        {phase === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              BULLSEYE DARTS
            </p>
            <p className="mt-2 text-sm text-muted">
              301 straight out — three darts a turn, first to two legs.
            </p>
            <p className="mt-1 text-xs text-muted">
              A scatter decides where each dart truly lands.
            </p>
            <PrimaryButton onClick={start} tone="from-rose-400 via-pink-500 to-fuchsia-600">
              Step to the oche
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {matchWinner === "you" ? "MATCH WON" : "MATCH LOST"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {legsYou}–{legsCpu}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Legs · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-rose-400 via-pink-500 to-fuchsia-600">
              New match
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Click to throw · land exactly on your remaining score to win the leg
      </p>
    </div>
  );
}
