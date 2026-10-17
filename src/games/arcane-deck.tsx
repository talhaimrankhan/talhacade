"use client";

import { useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

const MAX_HP = 60;
const HAND_SIZE = 5;

interface CardDef {
  key: string;
  name: string;
  cost: number;
  dmg?: number;
  block?: number;
  draw?: number;
  heal?: number;
  energy?: number;
  charge?: number;
  exhaust?: boolean;
  kind: "attack" | "skill";
  text: string;
}

const CARDS: Record<string, CardDef> = {
  strike: { key: "strike", name: "Strike", cost: 1, dmg: 5, kind: "attack", text: "Deal 5 damage." },
  guard: { key: "guard", name: "Guard", cost: 1, block: 5, kind: "skill", text: "Gain 5 block." },
  heavy: { key: "heavy", name: "Heavy Blow", cost: 2, dmg: 9, kind: "attack", text: "Deal 9 damage." },
  jab: { key: "jab", name: "Quick Jab", cost: 0, dmg: 2, draw: 1, kind: "attack", text: "Deal 2. Draw 1." },
  mend: { key: "mend", name: "Mend", cost: 1, heal: 7, kind: "skill", text: "Heal 7 HP." },
  fortify: { key: "fortify", name: "Fortify", cost: 1, block: 8, kind: "skill", text: "Gain 8 block." },
  rally: { key: "rally", name: "Rally", cost: 0, energy: 1, exhaust: true, kind: "skill", text: "+1 energy. Exhaust." },
  cleave: { key: "cleave", name: "Cleave", cost: 1, dmg: 6, kind: "attack", text: "Deal 6 damage." },
  siphon: { key: "siphon", name: "Siphon", cost: 1, dmg: 4, heal: 4, kind: "attack", text: "Deal 4. Heal 4." },
  charge: { key: "charge", name: "Charge", cost: 1, charge: 5, kind: "skill", text: "Next attack +5." },
  wall: { key: "wall", name: "Shield Wall", cost: 2, block: 10, kind: "skill", text: "Gain 10 block." },
  zap: { key: "zap", name: "Zap", cost: 0, dmg: 3, kind: "attack", text: "Deal 3 damage." },
};

const STARTER = ["strike", "strike", "strike", "strike", "strike", "guard", "guard", "guard", "guard"];
const POOL = ["heavy", "jab", "mend", "fortify", "rally", "cleave", "siphon", "charge", "wall", "zap"];

const ATTACK_TONE = "from-rose-400 via-pink-500 to-fuchsia-600";
const SKILL_TONE = "from-sky-400 via-blue-500 to-indigo-600";

interface Encounter {
  name: string;
  emoji: string;
  hp: number;
  min: number;
  max: number;
}

const ENCOUNTERS: Encounter[] = [
  { name: "Slime", emoji: "🟢", hp: 14, min: 4, max: 6 },
  { name: "Bandit", emoji: "🗡️", hp: 20, min: 5, max: 8 },
  { name: "Golem", emoji: "🗿", hp: 30, min: 7, max: 10 },
  { name: "Wraith", emoji: "👻", hp: 24, min: 6, max: 9 },
  { name: "Bandit", emoji: "🗡️", hp: 20, min: 5, max: 8 },
  { name: "Sentinel", emoji: "⚔️", hp: 48, min: 8, max: 12 },
];

interface RunState {
  hp: number;
  energy: number;
  block: number;
  charge: number;
  deck: string[];
  hand: string[];
  discard: string[];
  exhaust: string[];
  enemyHp: number;
  intent: number;
  stage: number;
  phase: "fight" | "reward" | "dead" | "done";
  rewards: string[];
  note: string;
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function rollIntent(e: Encounter): number {
  return e.min + Math.floor(Math.random() * (e.max - e.min + 1));
}

/** Fills the hand to `size`, reshuffling the discard pile when needed. */
function drawTo(run: RunState, size = HAND_SIZE): RunState {
  let deck = [...run.deck];
  let discard = [...run.discard];
  const hand = [...run.hand];
  while (hand.length < size) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      deck = shuffle(discard);
      discard = [];
    }
    hand.push(deck.pop()!);
  }
  return { ...run, deck, discard, hand };
}

function freshRun(): RunState {
  const e = ENCOUNTERS[0];
  const base: RunState = {
    hp: MAX_HP,
    energy: 3,
    block: 0,
    charge: 0,
    deck: shuffle(STARTER),
    hand: [],
    discard: [],
    exhaust: [],
    enemyHp: e.hp,
    intent: rollIntent(e),
    stage: 0,
    phase: "fight",
    rewards: [],
    note: "The Slime blocks the path.",
  };
  return drawTo(base);
}

export default function ArcaneDeck({ gameId }: { gameId: string }) {
  const [run, setRun] = useState<RunState>(() => freshRun());
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");
  const enemy = ENCOUNTERS[run.stage];

  const play = (key: string) => {
    if (run.phase !== "fight") return;
    const def = CARDS[key];
    if (!def || run.energy < def.cost) return;
    const idx = run.hand.indexOf(key);
    if (idx < 0) return;

    const hand = run.hand.slice();
    hand.splice(idx, 1);
    let enemyHp = run.enemyHp;
    let hp = run.hp;
    let block = run.block;
    let charge = run.charge;
    let energy = run.energy - def.cost;
    let note = `${def.name} played.`;

    if (def.dmg) {
      let dmg = def.dmg;
      if (charge > 0) {
        dmg += charge;
        charge = 0;
      }
      enemyHp = Math.max(0, enemyHp - dmg);
      note = `You hit ${enemy.name} for ${dmg}.`;
    }
    if (def.block) block += def.block;
    if (def.heal) hp = Math.min(MAX_HP, hp + def.heal);
    if (def.energy) energy += def.energy;
    if (def.charge) charge += def.charge;

    const pile = def.exhaust ? run.exhaust : run.discard;
    const next: RunState = {
      ...run,
      hp,
      block,
      charge,
      energy,
      enemyHp,
      hand,
      exhaust: def.exhaust ? [...pile, key] : run.exhaust,
      discard: def.exhaust ? run.discard : [...pile, key],
      note,
    };
    const drawn = def.draw
      ? drawTo(next, next.hand.length + def.draw)
      : next;

    if (drawn.enemyHp <= 0) {
      if (drawn.stage === ENCOUNTERS.length - 1) {
        setRun({
          ...drawn,
          phase: "done",
          hand: [],
          discard: [...drawn.discard, ...drawn.hand],
          note: "The Sentinel crumbles — run complete!",
        });
        setNewBest(submit(ENCOUNTERS.length));
        return;
      }
      const rewards = shuffle(POOL).slice(0, 3);
      setRun({
        ...drawn,
        phase: "reward",
        rewards,
        hp: Math.min(MAX_HP, drawn.hp + 8),
        hand: [],
        discard: [...drawn.discard, ...drawn.hand],
        note: "Victory! Heal 8 and pick a card.",
      });
      return;
    }
    setRun(drawn);
  };

  const endTurn = () => {
    if (run.phase !== "fight") return;
    const dmg = run.intent;
    const absorbed = Math.min(run.block, dmg);
    const hp = run.hp - (dmg - absorbed);
    const spent: RunState = {
      ...run,
      block: 0,
      energy: 3,
      discard: [...run.discard, ...run.hand],
      hand: [],
      note: `${enemy.name} hits for ${dmg}${absorbed ? ` (${absorbed} blocked)` : ""}.`,
    };
    if (hp <= 0) {
      setRun({ ...spent, hp: 0, phase: "dead" });
      setNewBest(submit(run.stage));
      return;
    }
    setRun(
      drawTo({ ...spent, hp, intent: rollIntent(enemy) }),
    );
  };

  const pickReward = (key: string) => {
    const stage = run.stage + 1;
    const next = ENCOUNTERS[stage];
    const base: RunState = {
      ...run,
      deck: [...run.deck, key],
      stage,
      phase: "fight",
      rewards: [],
      block: 0,
      energy: 3,
      intent: rollIntent(next),
      enemyHp: next.hp,
      note: `${next.name} blocks the way.`,
    };
    setRun(drawTo(base));
  };

  const restart = () => {
    setRun(freshRun());
    setNewBest(false);
  };

  const enemyPct = Math.max(0, (run.enemyHp / enemy.hp) * 100);
  return (
    <div className="w-full max-w-[520px]">
      {/* enemy */}
      <div className="mb-3 rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(168,85,247,0.8)]">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{enemy.emoji}</span>
          <div className="flex-1">
            <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-wider">
              <span className="text-ink">
                {enemy.name}
                {enemy.name === "Sentinel" && (
                  <span className="ml-1.5 text-warn">BOSS</span>
                )}
              </span>
              <span className="text-muted">
                {run.enemyHp}/{enemy.hp}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#1a1a2e]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-400 via-pink-500 to-fuchsia-600 transition-all"
                style={{ width: `${enemyPct}%` }}
              />
            </div>
          </div>
          <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 font-mono text-[11px] text-rose-300">
            ⚔️ {enemy.min}–{enemy.max}
          </span>
        </div>
      </div>

      {/* player */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 font-mono text-xs uppercase tracking-wider">
        <span className="text-cyan-300">
          ❤️ <b className="text-sm text-ink">{run.hp}</b>
        </span>
        <span className="text-muted">
          🛡️ <b className="text-sm text-ink">{run.block}</b>
        </span>
        <span className="text-warn">
          ⚡ <b className="text-sm text-ink">{run.energy}</b>/3
        </span>
        {run.charge > 0 && (
          <span className="text-success">
            🔥+<b className="text-sm text-ink">{run.charge}</b>
          </span>
        )}
        <span className="ml-auto text-muted">
          Deck {run.deck.length} · Discard {run.discard.length} · Encounter{" "}
          {run.stage + 1}/6
        </span>
      </div>

      {/* hand */}
      <div className="relative rounded-2xl border border-line bg-surface-2 p-3">
        <div className="flex flex-wrap gap-2">
          {run.hand.map((key, i) => {
            const def = CARDS[key];
            const playable =
              run.phase === "fight" && run.energy >= def.cost;
            return (
              <button
                key={`${key}-${i}`}
                type="button"
                onClick={() => play(key)}
                disabled={!playable}
                aria-label={`Play ${def.name}, costs ${def.cost} energy. ${def.text}`}
                className={cn(
                  "relative w-28 rounded-xl border bg-[#12121f] p-2 pt-3 text-left transition active:scale-95",
                  def.kind === "attack"
                    ? "border-rose-500/40 hover:border-rose-400"
                    : "border-sky-500/40 hover:border-sky-400",
                  playable
                    ? "shadow-[0_0_20px_-10px_rgba(255,255,255,0.5)] hover:brightness-125"
                    : "opacity-45",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-x-2.5 top-1 h-1 rounded-full bg-gradient-to-r",
                    def.kind === "attack" ? ATTACK_TONE : SKILL_TONE,
                  )}
                />
                <span className="flex items-center justify-between">
                  <span className="font-display text-[11px] font-bold text-ink">
                    {def.name}
                  </span>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-warn/20 font-mono text-[10px] font-bold text-warn">
                    {def.cost}
                  </span>
                </span>
                <span className="mt-1 block font-mono text-[10px] leading-tight text-muted">
                  {def.text}
                </span>
              </button>
            );
          })}
          {run.hand.length === 0 && run.phase === "fight" && (
            <p className="px-2 py-6 text-xs text-muted">Hand empty…</p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">{run.note}</p>
          <button
            type="button"
            onClick={endTurn}
            disabled={run.phase !== "fight"}
            className={cn(
              "shrink-0 rounded-full px-5 py-2 text-xs font-bold transition active:scale-95",
              run.phase === "fight"
                ? "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 text-black hover:brightness-110"
                : "cursor-not-allowed border border-line text-muted",
            )}
          >
            End turn
          </button>
        </div>

        {run.phase === "reward" && (
          <Overlay>
            <p className="font-display text-xl font-bold text-white">
              Pick a card
            </p>
            <p className="mt-1 text-xs uppercase tracking-widest text-muted">
              +8 HP · rewards are permanent
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {run.rewards.map((key) => {
                const def = CARDS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickReward(key)}
                    aria-label={`Take ${def.name}. ${def.text}`}
                    className={cn(
                      "relative w-28 rounded-xl border bg-[#12121f] p-2 pt-3 text-left transition hover:brightness-125 active:scale-95",
                      def.kind === "attack"
                        ? "border-rose-500/40"
                        : "border-sky-500/40",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute inset-x-2.5 top-1 h-1 rounded-full bg-gradient-to-r",
                        def.kind === "attack" ? ATTACK_TONE : SKILL_TONE,
                      )}
                    />
                    <span className="flex items-center justify-between">
                      <span className="font-display text-[11px] font-bold text-ink">
                        {def.name}
                      </span>
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-warn/20 font-mono text-[10px] font-bold text-warn">
                        {def.cost}
                      </span>
                    </span>
                    <span className="mt-1 block font-mono text-[10px] leading-tight text-muted">
                      {def.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </Overlay>
        )}

        {(run.phase === "dead" || run.phase === "done") && (
          <Overlay>
            <p className="text-3xl">{run.phase === "done" ? "👑" : "💀"}</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              {run.phase === "done" ? "RUN COMPLETE" : "YOU FELL"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ Furthest run — new best!
              </p>
            )}
            <p className="mt-2 font-mono text-sm text-white">
              Furthest run{" "}
              {run.phase === "done" ? ENCOUNTERS.length : run.stage} · Best{" "}
              {best ?? 0}
            </p>
            <PrimaryButton
              onClick={restart}
              tone="from-violet-500 via-purple-500 to-fuchsia-500"
            >
              New run
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Click a card to play · End turn passes to the enemy · beat 6 encounters
      </p>
    </div>
  );
}
