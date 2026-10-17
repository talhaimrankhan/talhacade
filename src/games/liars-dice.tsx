"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

const FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const CHALLENGE_THRESHOLD = 0.25;

interface Bid {
  qty: number;
  face: number;
}

interface Series {
  you: number;
  cpu: number;
}

interface Reveal {
  count: number;
  total: number;
  face: number;
  qty: number;
  truth: boolean;
  loser: "you" | "cpu";
}

type Phase = "bid" | "reveal";
type RoundFlag = "none" | "round" | "match";

function rollCup(n: number): number[] {
  return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
}

function legalRaise(bid: Bid | null, next: Bid, total: number): boolean {
  if (next.qty < 1 || next.qty > total) return false;
  if (!bid) return true;
  return next.qty > bid.qty || (next.qty === bid.qty && next.face > bid.face);
}

function comb(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - i + 1)) / i;
  return r;
}

/** P(at least k faces of `face` in n unknown dice). */
function binomAtLeast(n: number, p: number, k: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let total = 0;
  for (let i = k; i <= n; i++) {
    total += comb(n, i) * p ** i * (1 - p) ** (n - i);
  }
  return total;
}

/**
 * The CPU knows its own cup and estimates yours from it: challenge when the
 * bid looks too true-to-be-cheap, otherwise raise its most common face —
 * with an occasional bluff.
 */
function cpuRespond(
  bid: Bid,
  cpuDice: number[],
  playerDice: number[],
): "challenge" | Bid {
  const total = cpuDice.length + playerDice.length;
  const own = cpuDice.filter((d) => d === bid.face).length;
  const p = Math.max(0.03, own / cpuDice.length);
  const need = bid.qty - own;
  const pTrue = binomAtLeast(playerDice.length, p, Math.max(0, need));
  if (pTrue < CHALLENGE_THRESHOLD) return "challenge";

  const counts = [1, 2, 3, 4, 5, 6].map(
    (f) => cpuDice.filter((d) => d === f).length,
  );
  let bestFace = 1;
  for (let f = 2; f <= 6; f++) {
    if (counts[f - 1] > counts[bestFace - 1]) bestFace = f;
  }
  let face = bestFace;
  if (Math.random() < 0.2) face = Math.min(6, face + 1); // bluff
  const qty = Math.min(total, counts[bestFace - 1] + 1);

  const candidate: Bid = { qty, face };
  if (legalRaise(bid, candidate, total)) return candidate;
  if (qty <= bid.qty && bid.qty + 1 <= total) {
    return { qty: bid.qty + 1, face: bestFace };
  }
  if (bid.face < 6 && bid.qty <= total) {
    return { qty: bid.qty, face: bid.face + 1 };
  }
  return "challenge";
}

export default function LiarsDice({ gameId }: { gameId: string }) {
  const [youDice, setYouDice] = useState<number[]>(() => rollCup(5));
  const [cpuDice, setCpuDice] = useState<number[]>(() => rollCup(5));
  const [bid, setBid] = useState<Bid | null>(null);
  const [lastBidder, setLastBidder] = useState<"you" | "cpu" | null>(null);
  const [turn, setTurn] = useState<"you" | "cpu">("you");
  const [phase, setPhase] = useState<Phase>("bid");
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [flag, setFlag] = useState<RoundFlag>("none");
  const [matchYou, setMatchYou] = useState(0);
  const [matchCpu, setMatchCpu] = useState(0);
  const [qtySel, setQtySel] = useState(1);
  const [faceSel, setFaceSel] = useState(2);
  const [message, setMessage] = useState("Your bid — quantity and face.");
  const [newBest, setNewBest] = useState(false);
  const [series, setSeries] = useStored<Series>(`series:${gameId}`, {
    you: 0,
    cpu: 0,
  });
  const { best, submit } = useBestScore(gameId, "high");
  const cpuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seriesRef = useRef<Series>(series);
  useEffect(() => {
    seriesRef.current = series;
  }, [series]);

  useEffect(
    () => () => {
      if (cpuTimer.current) clearTimeout(cpuTimer.current);
    },
    [],
  );

  const startRound = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setYouDice(rollCup(5));
    setCpuDice(rollCup(5));
    setBid(null);
    setLastBidder(null);
    setTurn("you");
    setPhase("bid");
    setReveal(null);
    setFlag("none");
    setMessage("Fresh cups — your bid.");
  }, []);

  const newMatch = useCallback(() => {
    setMatchYou(0);
    setMatchCpu(0);
    setNewBest(false);
    startRound();
  }, [startRound]);

  const resolveChallenge = (judged: Bid, challenger: "you" | "cpu") => {
    const all = [...youDice, ...cpuDice];
    const count = all.filter((d) => d === judged.face).length;
    const truth = count >= judged.qty;
    const loser: "you" | "cpu" = truth
      ? challenger
      : challenger === "you"
        ? "cpu"
        : "you";
    const youNext = loser === "you" ? youDice.slice(0, -1) : youDice;
    const cpuNext = loser === "cpu" ? cpuDice.slice(0, -1) : cpuDice;

    let nextFlag: RoundFlag = "none";
    if (youNext.length === 0 || cpuNext.length === 0) {
      const roundWinner: "you" | "cpu" = youNext.length > 0 ? "you" : "cpu";
      if (roundWinner === "you") {
        const updated = {
          ...seriesRef.current,
          you: seriesRef.current.you + 1,
        };
        seriesRef.current = updated;
        setSeries(updated);
        setNewBest(submit(updated.you));
      } else {
        const updated = {
          ...seriesRef.current,
          cpu: seriesRef.current.cpu + 1,
        };
        seriesRef.current = updated;
        setSeries(updated);
      }
      const tally = roundWinner === "you" ? matchYou + 1 : matchCpu + 1;
      if (roundWinner === "you") setMatchYou(tally);
      else setMatchCpu(tally);
      nextFlag = tally >= 2 ? "match" : "round";
    }

    setYouDice(youNext);
    setCpuDice(cpuNext);
    setReveal({
      count,
      total: all.length,
      face: judged.face,
      qty: judged.qty,
      truth,
      loser,
    });
    setFlag(nextFlag);
    setPhase("reveal");
    setMessage(
      truth
        ? `The bid was TRUE — ${loser === "you" ? "you lose" : "CPU loses"} a die.`
        : `A lie! ${loser === "you" ? "You lose" : "CPU loses"} a die.`,
    );
  };

  const playerRaise = () => {
    if (phase !== "bid" || turn !== "you") return;
    const total = youDice.length + cpuDice.length;
    const next: Bid = { qty: Math.min(qtySel, total), face: faceSel };
    if (!legalRaise(bid, next, total)) return;
    setBid(next);
    setLastBidder("you");
    setTurn("cpu");
    setMessage(`You bid ${next.qty}×${FACES[next.face - 1]}. CPU ponders…`);
    cpuTimer.current = setTimeout(() => {
      const resp = cpuRespond(next, cpuDice, youDice);
      if (resp === "challenge") {
        resolveChallenge(next, "cpu");
        return;
      }
      setBid(resp);
      setLastBidder("cpu");
      setTurn("you");
      setMessage(`CPU bids ${resp.qty}×${FACES[resp.face - 1]} — raise or call?`);
    }, 620);
  };

  const playerChallenge = () => {
    if (phase !== "bid" || turn !== "you" || !bid || lastBidder !== "cpu") return;
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    resolveChallenge(bid, "you");
  };

  const afterReveal = () => {
    if (flag === "match") {
      newMatch();
      return;
    }
    startRound();
  };

  const totalDice = youDice.length + cpuDice.length;
  const qty = Math.min(qtySel, totalDice);
  const canRaise =
    phase === "bid" && turn === "you" && legalRaise(bid, { qty, face: faceSel }, totalDice);
  const canChallenge =
    phase === "bid" && turn === "you" && bid !== null && lastBidder === "cpu";

  return (
    <div className="w-full max-w-[440px]">
      <div className="mb-3 grid grid-cols-3 gap-2 font-mono text-xs uppercase tracking-wider">
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-center text-cyan-300">
          You <b className="ml-1 text-sm text-ink">{series.you}</b>
        </div>
        <div className="rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-muted">
          Match <b className="ml-1 text-sm text-ink">{matchYou}–{matchCpu}</b>
        </div>
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-center text-rose-300">
          CPU <b className="ml-1 text-sm text-ink">{series.cpu}</b>
        </div>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(251,191,36,0.7)]">
        {/* your cup */}
        <div className="mb-2 flex items-center gap-2">
          <span className="w-12 font-mono text-[10px] uppercase tracking-widest text-cyan-300">
            You
          </span>
          <div className="flex flex-1 flex-wrap gap-1 text-2xl">
            {youDice.map((d, i) => (
              <span key={`y-${i}`} className="text-ink" aria-label={`your die ${d}`}>
                {FACES[d - 1]}
              </span>
            ))}
          </div>
          <span className="font-mono text-xs text-muted">×{youDice.length}</span>
        </div>

        {/* cpu cup */}
        <div className="flex items-center gap-2">
          <span className="w-12 font-mono text-[10px] uppercase tracking-widest text-rose-300">
            CPU
          </span>
          <div className="flex flex-1 flex-wrap gap-1 text-2xl">
            {phase === "reveal"
              ? cpuDice.map((d, i) => (
                  <span key={`c-${i}`} className="text-ink">
                    {FACES[d - 1]}
                  </span>
                ))
              : cpuDice.map((_, i) => (
                  <span
                    key={`c-${i}`}
                    className="opacity-60"
                    aria-label="the CPU's hidden die"
                  >
                    🂠
                  </span>
                ))}
          </div>
          <span className="font-mono text-xs text-muted">×{cpuDice.length}</span>
        </div>

        {/* standing bid */}
        <div className="mt-3 rounded-xl border border-line bg-[#101020] px-3 py-2 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Standing bid {totalDice} dice in play
          </p>
          <p className="font-display text-3xl font-bold text-warn">
            {bid ? `${bid.qty}×${FACES[bid.face - 1]}` : "—"}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
            {turn === "cpu" ? "CPU is thinking…" : message}
          </p>
        </div>

        {flag !== "none" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {flag === "match"
                ? matchYou >= 2
                  ? "Match won! 🎉"
                  : "Match lost 🤖"
                : reveal && reveal.loser === "you"
                  ? "One die down"
                  : "They're out of dice!"}
            </p>
            {flag === "match" && newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ Most rounds won — new best!
              </p>
            )}
            <p className="mt-2 text-xs uppercase tracking-widest text-muted">
              All-time rounds {best ?? 0} · Series {series.you}–{series.cpu}
            </p>
            <PrimaryButton
              onClick={afterReveal}
              tone="from-amber-400 via-orange-500 to-red-500"
            >
              {flag === "match" ? "New match" : "Next round"}
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "reveal" && flag === "none" && (
          <div className="mt-3 rounded-xl border border-line bg-[#101020] px-3 py-2 text-center">
            <p className="font-mono text-xs text-ink">
              {reveal?.qty}×{reveal ? FACES[reveal.face - 1] : ""} appeared{" "}
              {reveal?.count} time{reveal?.count === 1 ? "" : "s"} in{" "}
              {reveal?.total} dice
            </p>
            <p className="mt-0.5 text-xs uppercase tracking-widest text-muted">
              {message}
            </p>
          </div>
        )}

        {phase === "bid" && (
          <div className="mt-3 rounded-xl border border-line bg-[#101020] p-2.5">
            <div className="flex items-center gap-2">
              <span className="w-14 font-mono text-[10px] uppercase tracking-widest text-muted">
                Qty
              </span>
              <div className="flex flex-1 flex-wrap gap-1">
                {Array.from({ length: totalDice }, (_, i) => i + 1).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQtySel(q)}
                    aria-label={`Bid quantity ${q}`}
                    aria-pressed={qty === q}
                    className={cn(
                      "h-7 w-7 rounded-lg border font-mono text-xs font-bold transition",
                      qty === q
                        ? "border-warn bg-warn/20 text-warn"
                        : "border-line text-muted hover:text-ink",
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="w-14 font-mono text-[10px] uppercase tracking-widest text-muted">
                Face
              </span>
              <div className="flex flex-1 flex-wrap gap-1 text-xl">
                {FACES.map((f, i) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFaceSel(i + 1)}
                    aria-label={`Bid face ${i + 1}`}
                    aria-pressed={faceSel === i + 1}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-lg border transition",
                      faceSel === i + 1
                        ? "border-warn bg-warn/20 text-warn"
                        : "border-line text-muted hover:text-ink",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={playerRaise}
                disabled={!canRaise}
                className={cn(
                  "flex-1 rounded-full px-4 py-2 text-xs font-bold transition active:scale-95",
                  canRaise
                    ? "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 text-black hover:brightness-110"
                    : "cursor-not-allowed border border-line text-muted",
                )}
              >
                Raise — {qty}×{FACES[faceSel - 1]}
              </button>
              <button
                type="button"
                onClick={playerChallenge}
                disabled={!canChallenge}
                className={cn(
                  "flex-1 rounded-full px-4 py-2 text-xs font-bold transition active:scale-95",
                  canChallenge
                    ? "bg-gradient-to-r from-rose-400 via-pink-500 to-fuchsia-600 text-black hover:brightness-110"
                    : "cursor-not-allowed border border-line text-muted",
                )}
              >
                Challenge!
              </button>
            </div>
          </div>
        )}

        {phase === "reveal" && flag === "none" && (
          <PrimaryButton onClick={afterReveal} tone="from-teal-400 via-emerald-500 to-green-600">
            Continue
          </PrimaryButton>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Your cup is open · the CPU&apos;s is not · no wilds — a ⚀ is just a ⚀
      </p>
    </div>
  );
}
