"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

type Suit = "♠" | "♥" | "♦" | "♣";

interface Card {
  r: string;
  s: Suit;
  v: number;
}

type Phase = "bet" | "player" | "dealer" | "done" | "fresh";

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: [string, number][] = [
  ["A", 11],
  ["2", 2],
  ["3", 3],
  ["4", 4],
  ["5", 5],
  ["6", 6],
  ["7", 7],
  ["8", 8],
  ["9", 9],
  ["10", 10],
  ["J", 10],
  ["Q", 10],
  ["K", 10],
];
const CHIPS = [10, 50, 100];
const MIN_BANK = 10;

function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const [r, v] of RANKS) deck.push({ r, s, v });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

/** Best total at or under 21 — aces drop from 11 to 1 when needed. */
function handTotal(cards: Card[]): number {
  let t = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.r === "A") {
      aces += 1;
      t += 11;
    } else {
      t += c.v;
    }
  }
  while (t > 21 && aces > 0) {
    t -= 10;
    aces -= 1;
  }
  return t;
}

function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21;
}

function CardFace({ card, hidden }: { card: Card; hidden?: boolean }) {
  if (hidden) {
    return (
      <div className="grid h-[84px] w-[58px] place-items-center rounded-lg border border-white/15 bg-[#12121f] shadow-md">
        <div className="h-[70px] w-[44px] rounded border border-white/40 bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 shadow-inner" />
      </div>
    );
  }
  const red = card.s === "♥" || card.s === "♦";
  const tone = red ? "text-rose-500" : "text-slate-900";
  return (
    <div className="flex h-[84px] w-[58px] flex-col justify-between rounded-lg border border-black/10 bg-white px-1.5 py-1 shadow-md">
      <span className={`font-display text-sm font-bold leading-none ${tone}`}>
        {card.r}
      </span>
      <span className={`text-center text-xl leading-none ${tone}`}>
        {card.s}
      </span>
      <span
        className={`self-end font-display text-sm font-bold leading-none rotate-180 ${tone}`}
      >
        {card.r}
      </span>
    </div>
  );
}

export default function Blackjack({ gameId }: { gameId: string }) {
  const [bank, setBank] = useStored(`bank:${gameId}`, 100);
  const { best, submit } = useBestScore(gameId, "high");

  const [phase, setPhase] = useState<Phase>("bet");
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [reveal, setReveal] = useState(false);
  const [chip, setChip] = useState(10);
  const [wager, setWager] = useState(10);
  const [message, setMessage] = useState("Pick a chip and deal");
  const [newBest, setNewBest] = useState(false);
  const [deckLeft, setDeckLeft] = useState(52);
  const deck = useRef<Card[]>([]);

  const draw = useCallback((): Card => {
    if (deck.current.length < 15) deck.current = freshDeck();
    const card = deck.current.pop();
    setDeckLeft(deck.current.length);
    return card ?? freshDeck()[0];
  }, []);

  /** Settles a hand: bank moves once, best score is reported once. */
  const settle = useCallback(
    (delta: number, msg: string) => {
      const next = Math.max(0, bank + delta);
      setBank(next);
      setNewBest(submit(next));
      setMessage(msg);
      setPhase(next < MIN_BANK ? "fresh" : "done");
    },
    [bank, setBank, submit],
  );

  const bet = Math.min(chip, bank);

  const deal = () => {
    if (phase !== "bet" || bet < MIN_BANK) return;
    const p = [draw(), draw()];
    const d = [draw(), draw()];
    setPlayer(p);
    setDealer(d);
    setReveal(false);
    setWager(bet);
    setMessage(`Your move — sitting on ${handTotal(p)}`);

    const pBJ = isBlackjack(p);
    const dBJ = isBlackjack(d);
    if (pBJ || dBJ) {
      setReveal(true);
      if (pBJ && dBJ) {
        setMessage("Both blackjack — push, bet returned");
        setPhase("done");
      } else if (pBJ) {
        settle(Math.round(bet * 1.5), "Blackjack! Pays 3:2");
      } else {
        settle(-bet, "Dealer blackjack — house takes it");
      }
      return;
    }
    setPhase("player");
  };

  const hit = () => {
    if (phase !== "player") return;
    const next = [...player, draw()];
    setPlayer(next);
    const t = handTotal(next);
    if (t > 21) {
      setReveal(true);
      settle(-wager, `Bust on ${t} — dealer wins`);
    } else if (t === 21) {
      setReveal(true);
      setPhase("dealer");
      setMessage("Twenty-one — dealer plays it out");
    } else {
      setMessage(`You are on ${t}`);
    }
  };

  const stand = () => {
    if (phase !== "player") return;
    setReveal(true);
    setPhase("dealer");
    setMessage("Dealer draws to seventeen");
  };

  const double = () => {
    if (phase !== "player" || player.length !== 2 || bank < wager * 2) return;
    const w = wager * 2;
    setWager(w);
    const next = [...player, draw()];
    setPlayer(next);
    setReveal(true);
    const t = handTotal(next);
    if (t > 21) settle(-w, `Doubled to ${t} — bust!`);
    else setPhase("dealer");
  };

  // Dealer draws to 17 (stands on every 17) — one card per timer tick.
  useEffect(() => {
    if (phase !== "dealer") return;
    let cancelled = false;
    const hand = dealer;
    const t = handTotal(hand);

    const timer = setTimeout(
      () => {
        if (cancelled) return;
        if (t < 17) {
          setDealer([...hand, draw()]);
        } else {
          const d = t;
          const p = handTotal(player);
          if (p > d) settle(wager, `Dealer ${d} — you win ${wager}`);
          else if (p < d) settle(-wager, `Dealer ${d} — house wins`);
          else settle(0, `Both on ${p} — push, bet returned`);
        }
      },
      t < 17 ? 620 : 520,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, dealer, player, wager, draw, settle]);

  const freshStake = () => {
    setBank(100);
    setChip(10);
    setMessage("Fresh stake on the table");
    setPhase("bet");
  };

  const nextHand = () => {
    setMessage("Pick a chip and deal");
    setPhase("bet");
  };

  const dealerTotal = reveal ? handTotal(dealer) : handTotal(dealer.slice(0, 1));

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={bank} best={best ?? "—"}>
        <span className="text-cyan-400">
          Bet{" "}
          <b className="ml-1 text-sm text-ink">
            {phase === "bet" ? bet : wager}
          </b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(251,191,36,0.7)]">
        {/* dealer */}
        <div className="min-h-[124px]">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted">
            Dealer{" "}
            <b className="ml-1 text-sm text-ink">
              {dealer.length ? dealerTotal : "—"}
            </b>
          </p>
          <div className="flex flex-wrap gap-2">
            {dealer.map((c, i) => (
              <CardFace key={`${i}-${c.r}${c.s}`} card={c} hidden={!reveal && i === 1} />
            ))}
            {dealer.length === 0 && (
              <p className="text-xs text-muted">Waiting for a hand…</p>
            )}
          </div>
        </div>

        {/* player */}
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted">
            You{" "}
            <b className="ml-1 text-sm text-cyan-400">
              {player.length ? handTotal(player) : "—"}
            </b>
          </p>
          <div className="flex min-h-[86px] flex-wrap gap-2">
            {player.map((c, i) => (
              <CardFace key={`${i}-${c.r}${c.s}`} card={c} />
            ))}
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-muted">{message}</p>

        {/* controls */}
        {phase === "bet" && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChip(c)}
                aria-label={`Bet ${c} coins`}
                disabled={bank < c}
                className={`rounded-full border px-4 py-1.5 font-mono text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-30 ${
                  chip === c
                    ? "border-warn bg-warn/15 text-warn"
                    : "border-line bg-surface text-ink hover:border-warn/50"
                }`}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setChip(bank)}
              aria-label="Bet the whole bank"
              className={`rounded-full border px-4 py-1.5 font-mono text-sm font-bold transition ${
                chip >= bank
                  ? "border-warn bg-warn/15 text-warn"
                  : "border-line bg-surface text-ink hover:border-warn/50"
              }`}
            >
              Max
            </button>
            <button
              type="button"
              onClick={deal}
              className="rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 px-6 py-1.5 font-display text-sm font-bold text-black transition hover:brightness-110 active:scale-95"
            >
              Deal
            </button>
          </div>
        )}

        {phase === "player" && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={hit}
              className="rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-600 px-6 py-2 font-display text-sm font-bold text-black transition hover:brightness-110 active:scale-95"
            >
              Hit
            </button>
            <button
              type="button"
              onClick={stand}
              className="rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 px-6 py-2 font-display text-sm font-bold text-black transition hover:brightness-110 active:scale-95"
            >
              Stand
            </button>
            <button
              type="button"
              onClick={double}
              disabled={player.length !== 2 || bank < wager * 2}
              className="rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 px-6 py-2 font-display text-sm font-bold text-black transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Double ({wager * 2})
            </button>
          </div>
        )}

        {(phase === "player" || phase === "dealer") && (
          <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted">
            Deck {deckLeft} cards · reshuffles under 15
          </p>
        )}

        {phase === "done" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {message.toUpperCase()}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New richest bank!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {bank}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={nextHand}
              tone="from-amber-400 via-orange-500 to-red-500"
            >
              Next hand
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "fresh" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              FRESH STAKE
            </p>
            <p className="mt-2 text-sm text-muted">
              The house spots you 100 coins to get back in the game.
            </p>
            <p className="mt-3 font-mono text-4xl font-bold text-white">100</p>
            <PrimaryButton
              onClick={freshStake}
              tone="from-amber-400 via-orange-500 to-red-500"
            >
              Take the stake
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Blackjack pays 3:2 · dealer draws to 17 · doubles only on your first two
        cards
      </p>
    </div>
  );
}
