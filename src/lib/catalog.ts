import { BrainCircuit, Gamepad2, Puzzle, Sparkles } from "lucide-react";
import type { Category, CategorySlug, Game } from "./types";

export const site = {
  name: "Talhacade",
  /** Change this to your real domain after deploying. */
  url: "https://talhacade.netlify.app",
  tagline: "Free browser games. No signup, no downloads, no nonsense.",
  description:
    "Play the best browser-based games instantly — arcade, puzzle, strategy and casual. No accounts, no logins, no servers: every game runs entirely in your browser.",
};

export const categories: Category[] = [
  {
    slug: "arcade",
    name: "Arcade",
    tagline: "Reflexes in, high scores out",
    blurb:
      "Pick-up-and-play classics with one rule: beat your best score. Fast rounds, faster restarts.",
    icon: Gamepad2,
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
  },
  {
    slug: "puzzle",
    name: "Puzzle",
    tagline: "Brains before speed",
    blurb:
      "Pattern, logic and memory challenges that reward the player who slows down and thinks.",
    icon: Puzzle,
    gradient: "from-cyan-400 via-sky-500 to-blue-600",
  },
  {
    slug: "strategy",
    name: "Strategy",
    tagline: "Outthink the machine",
    blurb:
      "Head-to-head duels against unbeatable AI. Every move counts, no luck required.",
    icon: BrainCircuit,
    gradient: "from-amber-400 via-orange-500 to-red-500",
  },
  {
    slug: "casual",
    name: "Casual",
    tagline: "Quick, breezy, addictive",
    blurb:
      "Thirty-second bursts of fun for when you just need a break. Zero learning curve.",
    icon: Sparkles,
    gradient: "from-pink-400 via-rose-500 to-red-400",
  },
];

export const games: Game[] = [
  {
    slug: "snake",
    title: "Neon Snake",
    category: "arcade",
    tagline: "Eat. Grow. Don't crash.",
    description:
      "The all-time classic, recharged in neon. Devour the glowing orbs to grow your tail, keep the grid speed climbing and survive as long as your reflexes hold. One wrong turn and it's over.",
    cover: { emoji: "🐍", gradient: "from-emerald-400 via-teal-500 to-cyan-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Arrow keys / WASD", action: "Steer the snake" },
      { keys: "Swipe", action: "Steer on touch screens" },
      { keys: "Space / Enter", action: "Start or restart" },
    ],
    tags: ["classic", "endless", "high score"],
    featured: true,
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "breakout",
    title: "Neon Breakout",
    category: "arcade",
    tagline: "Smash every last brick.",
    description:
      "Bounce the ball, carve angles and clear the wall. Each cleared board returns faster and harder, so read the rebound, protect your three lives and chain your combos.",
    cover: { emoji: "☄️", gradient: "from-fuchsia-500 via-purple-500 to-indigo-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Mouse / finger", action: "Move the paddle" },
      { keys: "Click / tap", action: "Launch the ball" },
      { keys: "R", action: "Restart" },
    ],
    tags: ["bricks", "physics", "combo"],
    featured: true,
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "2048",
    title: "2048",
    category: "puzzle",
    tagline: "Slide, merge, repeat.",
    description:
      "Swipe the grid, merge matching tiles and chase the coveted 2048 tile. Sounds simple — until the board fills up and every move has to earn its place.",
    cover: { emoji: "🔢", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Arrow keys / WASD", action: "Slide every tile" },
      { keys: "Swipe", action: "Slide on touch screens" },
    ],
    tags: ["numbers", "sliding", "addictive"],
    featured: true,
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "minesweeper",
    title: "Minesweeper",
    category: "puzzle",
    tagline: "Every click is a gamble.",
    description:
      "Clear the field without detonating a single mine. Numbers tell you how many mines touch each square — read them right, flag the suspects and race the clock across three difficulties.",
    cover: { emoji: "💣", gradient: "from-slate-400 via-zinc-500 to-neutral-700" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Reveal a square" },
      { keys: "Right-click / flag mode", action: "Plant a flag" },
      { keys: "Flag mode toggle", action: "Flag with one finger on mobile" },
    ],
    tags: ["logic", "deduction", "timer"],
    score: { label: "Fastest clear", mode: "low", kind: "seconds" },
  },
  {
    slug: "memory",
    title: "Memory Flip",
    category: "puzzle",
    tagline: "Find every pair.",
    description:
      "Flip cards two at a time and lock in all eight matching pairs. Fewer moves wins — train your recall and clear the board in the fewest flips you can.",
    cover: { emoji: "🃏", gradient: "from-teal-400 via-emerald-500 to-green-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Flip a card" },
    ],
    tags: ["memory", "pairs", "focus"],
    score: { label: "Fewest moves", mode: "low", kind: "moves" },
  },
  {
    slug: "tictactoe",
    title: "Tic-Tac-Toe",
    category: "strategy",
    tagline: "Try to beat an unbeatable AI.",
    description:
      "The gridlock duel, upgraded: the CPU plays perfect minimax, so it can never lose. Force a draw, wait for a slip, and keep the series tally honest.",
    cover: { emoji: "⭕", gradient: "from-sky-400 via-blue-500 to-indigo-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Place your ❌" },
      { keys: "New round", action: "Clear the board" },
    ],
    tags: ["minimax", "duel", "classic"],
  },
  {
    slug: "connect4",
    title: "Connect Four",
    category: "strategy",
    tagline: "Four in a row beats all.",
    description:
      "Drop your discs and line up four before the CPU does. Its alpha-beta search reads seven columns deep — spot the fork it can't block and take the board.",
    cover: { emoji: "🔴", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click a column", action: "Drop your disc" },
      { keys: "Tap a column", action: "Drop on mobile" },
    ],
    tags: ["minimax", "grid", "duel"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "reaction",
    title: "Reflex Rush",
    category: "casual",
    tagline: "How fast are you, really?",
    description:
      "Wait for the signal… then hit it as fast as you can. Five rounds, averaged milliseconds, one honest answer about your reaction time. False starts get you sent back.",
    cover: { emoji: "⚡", gradient: "from-lime-400 via-emerald-500 to-teal-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "React the instant it turns green" },
    ],
    tags: ["reflex", "timing", "speed"],
    featured: true,
    score: { label: "Best average", mode: "low", kind: "ms" },
  },
  {
    slug: "whack-a-mole",
    title: "Whack-a-Mole",
    category: "casual",
    tagline: "Bonk fast. Avoid the bombs.",
    description:
      "Moles pop up, you smash them — but hit a bomb and it costs you. Thirty seconds on the clock, one target at a time, no mercy for hesitation.",
    cover: { emoji: "🔨", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Whack the mole" },
      { keys: "Avoid 💣", action: "Bomb hits subtract points" },
    ],
    tags: ["reflex", "arcade", "30 seconds"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
];

/* ----------------------------------------------------------------- */
/* Lookups                                                            */
/* ----------------------------------------------------------------- */

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getGame(slug: string): Game | undefined {
  return games.find((g) => g.slug === slug);
}

export function gamesInCategory(slug: CategorySlug): Game[] {
  return games.filter((g) => g.category === slug);
}

export function similarGames(game: Game, count = 3): Game[] {
  const sameCategory = gamesInCategory(game.category).filter(
    (g) => g.slug !== game.slug,
  );
  const rest = games.filter(
    (g) => g.category !== game.category && g.slug !== game.slug,
  );
  return [...sameCategory, ...rest].slice(0, count);
}

/** Formats a stored best score according to the game's score config. */
export function formatBest(value: number | null, game: Game): string {
  if (value === null) return "—";
  switch (game.score?.kind) {
    case "seconds":
      return `${value}s`;
    case "ms":
      return `${value} ms`;
    case "moves":
      return `${value} ${value === 1 ? "move" : "moves"}`;
    default:
      return value.toLocaleString();
  }
}
