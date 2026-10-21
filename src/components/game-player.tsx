"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

interface GameProps {
  /** Stable id used for persisting the player's best score. */
  gameId: string;
}

/**
 * Games are client-only (`ssr: false`): canvases, random boards and timers
 * have no business in the prerendered HTML — and random initial state would
 * otherwise cause hydration mismatches. Each game ships as its own chunk.
 */
const loaders: Record<string, () => Promise<{ default: ComponentType<GameProps> }>> = {
  snake: () => import("@/games/snake"),
  breakout: () => import("@/games/breakout"),
  "2048": () => import("@/games/game-2048"),
  minesweeper: () => import("@/games/minesweeper"),
  memory: () => import("@/games/memory"),
  tictactoe: () => import("@/games/tictactoe"),
  connect4: () => import("@/games/connect4"),
  reaction: () => import("@/games/reaction"),
  "whack-a-mole": () => import("@/games/whack-a-mole"),
  "tower-steps": () => import("@/games/tower-steps"),
  "word-guess": () => import("@/games/word-guess"),
  "code-breaker": () => import("@/games/code-breaker"),
  "gem-swap": () => import("@/games/gem-swap"),
  "word-hunt": () => import("@/games/word-hunt"),
  "block-blast": () => import("@/games/block-blast"),
  "dot-chaser": () => import("@/games/dot-chaser"),
  "neon-blocks": () => import("@/games/neon-blocks"),
  "star-invaders": () => import("@/games/star-invaders"),
  "flap-nova": () => import("@/games/flap-nova"),
  "pixel-runner": () => import("@/games/pixel-runner"),
  "sky-hopper": () => import("@/games/sky-hopper"),
  "sudoku": () => import("@/games/sudoku"),
  "tile-mahjong": () => import("@/games/tile-mahjong"),
  "nonogram": () => import("@/games/nonogram"),
  "sliding-15": () => import("@/games/sliding-15"),
  "box-push": () => import("@/games/box-push"),
  "lights-out": () => import("@/games/lights-out"),
  "air-hockey": () => import("@/games/air-hockey"),
  "guess-beast": () => import("@/games/guess-beast"),
  "tube-sort": () => import("@/games/tube-sort"),
  "cast-and-catch": () => import("@/games/cast-and-catch"),
  "neon-diner": () => import("@/games/neon-diner"),
  "pixel-painter": () => import("@/games/pixel-painter"),
  "ultimate-tictactoe": () => import("@/games/ultimate-tictactoe"),
  "hex-wars": () => import("@/games/hex-wars"),
  "neon-tower-defense": () => import("@/games/neon-tower-defense"),
  "tank-duel": () => import("@/games/tank-duel"),
  "dungeon-dash": () => import("@/games/dungeon-dash"),
  "mancala": () => import("@/games/mancala"),
  "solitaire": () => import("@/games/solitaire"),
  "neon-clicker": () => import("@/games/neon-clicker"),
  "color-echo": () => import("@/games/color-echo"),
  "type-storm": () => import("@/games/type-storm"),
  "quick-quiz": () => import("@/games/quick-quiz"),
  "beat-tap": () => import("@/games/beat-tap"),
  "traffic-hop": () => import("@/games/traffic-hop"),
  "asteroid-belt": () => import("@/games/asteroid-belt"),
  "volley-pong": () => import("@/games/volley-pong"),
  "city-defender": () => import("@/games/city-defender"),
  "cave-pilot": () => import("@/games/cave-pilot"),
  "knife-frenzy": () => import("@/games/knife-frenzy"),
  "blackjack": () => import("@/games/blackjack"),
  "dice-kings": () => import("@/games/dice-kings"),
  "neon-pool": () => import("@/games/neon-pool"),
  "paper-toss": () => import("@/games/paper-toss"),
  "bullseye-darts": () => import("@/games/bullseye-darts"),
  "hangman": () => import("@/games/hangman"),
  "chess": () => import("@/games/chess"),
  "checkers": () => import("@/games/checkers"),
  "reversi": () => import("@/games/reversi"),
  "gomoku": () => import("@/games/gomoku"),
  "battleship": () => import("@/games/battleship"),
  "dots-boxes": () => import("@/games/dots-boxes"),
  "nim": () => import("@/games/nim"),
  "flag-hunt": () => import("@/games/flag-hunt"),
  "quoridor": () => import("@/games/quoridor"),
  "arcane-deck": () => import("@/games/arcane-deck"),
  "liars-dice": () => import("@/games/liars-dice"),
  "conquest": () => import("@/games/conquest"),
  "fruit-merge": () => import("@/games/fruit-merge"),
  "flow-link": () => import("@/games/flow-link"),
  "traffic-jam": () => import("@/games/traffic-jam"),
  "connections": () => import("@/games/connections"),
  "path-painter": () => import("@/games/path-painter"),
  "fruit-blitz": () => import("@/games/fruit-blitz"),
  "cross-the-grid": () => import("@/games/cross-the-grid"),
  "neon-pinball": () => import("@/games/neon-pinball"),
  "orb-cascade": () => import("@/games/orb-cascade"),
  "drift-dash": () => import("@/games/drift-dash"),
  "helix-fall": () => import("@/games/helix-fall"),
  "highway-rush": () => import("@/games/highway-rush"),
  "circuit-sprint": () => import("@/games/circuit-sprint"),
  "hill-climber": () => import("@/games/hill-climber"),
  "moto-trial": () => import("@/games/moto-trial"),
  "parking-master": () => import("@/games/parking-master"),
  "slope-descent": () => import("@/games/slope-descent"),
  "rally-sprint": () => import("@/games/rally-sprint"),
  "formula-lap": () => import("@/games/formula-lap"),
  "bus-route": () => import("@/games/bus-route"),
  "night-outrun": () => import("@/games/night-outrun"),
  "drag-sprint": () => import("@/games/drag-sprint"),
  "derby-arena": () => import("@/games/derby-arena"),
  "monster-ramp": () => import("@/games/monster-ramp"),
  "snow-sled": () => import("@/games/snow-sled"),
  "boat-slalom": () => import("@/games/boat-slalom"),
  "gymkhana-drift": () => import("@/games/gymkhana-drift"),
  "wheelie-master": () => import("@/games/wheelie-master"),
  "traction-truck": () => import("@/games/traction-truck"),
  "rocket-sled": () => import("@/games/rocket-sled"),
  "fuel-run": () => import("@/games/fuel-run"),
  "zombie-siege": () => import("@/games/zombie-siege"),
  "quick-draw": () => import("@/games/quick-draw"),
  "target-rush": () => import("@/games/target-rush"),
  "clay-shoot": () => import("@/games/clay-shoot"),
  "sniper-range": () => import("@/games/sniper-range"),
  "jet-strike": () => import("@/games/jet-strike"),
  "heli-assault": () => import("@/games/heli-assault"),
  "ricochet": () => import("@/games/ricochet"),
  "slime-arena": () => import("@/games/slime-arena"),
  "ghost-hunter": () => import("@/games/ghost-hunter"),
  "balloon-burst": () => import("@/games/balloon-burst"),
  "bubble-storm": () => import("@/games/bubble-storm"),
  "pest-zap": () => import("@/games/pest-zap"),
  "sub-hunt": () => import("@/games/sub-hunt"),
  "stand-and-deliver": () => import("@/games/stand-and-deliver"),
  "nest-defense": () => import("@/games/nest-defense"),
  "drone-strike": () => import("@/games/drone-strike"),
  "acorn-arc": () => import("@/games/acorn-arc"),
  "high-noon": () => import("@/games/high-noon"),
  "snowball-siege": () => import("@/games/snowball-siege"),
  "penalty-shootout": () => import("@/games/penalty-shootout"),
  "keeper-wars": () => import("@/games/keeper-wars"),
  "hoop-rush": () => import("@/games/hoop-rush"),
  "putt-master": () => import("@/games/putt-master"),
  "bowling-blitz": () => import("@/games/bowling-blitz"),
  "archery-world": () => import("@/games/archery-world"),
  "tennis-volley": () => import("@/games/tennis-volley"),
  "chin-check": () => import("@/games/chin-check"),
  "field-goal": () => import("@/games/field-goal"),
  "cricket-slogger": () => import("@/games/cricket-slogger"),
  "ski-jump": () => import("@/games/ski-jump"),
  "skate-trick": () => import("@/games/skate-trick"),
  "track-dash": () => import("@/games/track-dash"),
  "volley-king": () => import("@/games/volley-king"),
  "stone-curl": () => import("@/games/stone-curl"),
  "juggle-kings": () => import("@/games/juggle-kings"),
  "sumo-showdown": () => import("@/games/sumo-showdown"),
  "disc-golf": () => import("@/games/disc-golf"),
  "fencing-bout": () => import("@/games/fencing-bout"),
  "dodgeball": () => import("@/games/dodgeball"),
  "word-scramble": () => import("@/games/word-scramble"),
  "spelling-bee": () => import("@/games/spelling-bee"),
  "quad-guess": () => import("@/games/quad-guess"),
  "crossword-mini": () => import("@/games/crossword-mini"),
  "word-link": () => import("@/games/word-link"),
  "code-words": () => import("@/games/code-words"),
  "word-ladder": () => import("@/games/word-ladder"),
  "fill-ins": () => import("@/games/fill-ins"),
  "acrostic-reveal": () => import("@/games/acrostic-reveal"),
  "vowel-drop": () => import("@/games/vowel-drop"),
  "rhyme-chime": () => import("@/games/rhyme-chime"),
  "word-fit": () => import("@/games/word-fit"),
  "letter-grid": () => import("@/games/letter-grid"),
  "crossword-race": () => import("@/games/crossword-race"),
  "word-wipe": () => import("@/games/word-wipe"),
  "twenty-questions": () => import("@/games/twenty-questions"),
  "typo-hunt": () => import("@/games/typo-hunt"),
  "letter-claim": () => import("@/games/letter-claim"),
  "rebus-riddle": () => import("@/games/rebus-riddle"),
  "sentence-sort": () => import("@/games/sentence-sort"),
};

function GameLoading() {
  return (
    <div className="grid min-h-[440px] place-items-center">
      <div className="text-center">
        <span
          className="inline-block h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <p className="mt-4 text-[11px] uppercase tracking-[0.3em] text-muted">
          Loading game…
        </p>
      </div>
    </div>
  );
}

/** Created once at module scope so component identities stay stable. */
const registry: Record<string, ComponentType<GameProps> | null> = {};
for (const [slug, loader] of Object.entries(loaders)) {
  registry[slug] = dynamic(loader, { ssr: false, loading: GameLoading });
}

export function GamePlayer({ slug }: { slug: string }) {
  const Game = registry[slug] ?? null;

  if (!Game) {
    return (
      <div className="grid min-h-[360px] place-items-center text-center">
        <div>
          <p className="text-4xl">🕹️</p>
          <p className="mt-3 text-sm text-muted">
            This game failed to load. Pick another one from the homepage.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[480px] items-center justify-center p-3 sm:p-6">
      <Game gameId={slug} />
    </div>
  );
}
