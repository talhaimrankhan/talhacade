import {
  BrainCircuit,
  Car,
  Crosshair,
  Gamepad2,
  Puzzle,
  Sparkles,
  Trophy,
  WholeWord,
} from "lucide-react";
import type { Category, CategorySlug, Game } from "./types";

export const site = {
  name: "Talhacade",
  /** Change this to your real domain after deploying. */
  url: "https://talhaimrankhan.github.io/talhacade",
  tagline: "Free browser games. No signup, no downloads, no nonsense.",
  description:
    "Play the best browser-based games instantly — racing, shooting, sports, word, arcade, puzzle, strategy and casual. No accounts, no logins, no servers: every game runs entirely in your browser.",
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
  {
    slug: "racing",
    name: "Racing",
    tagline: "Engines loud, brakes late",
    blurb:
      "Circuits, hills, highways and pure speed. Learn the track, stick the drift, shave the tenths.",
    icon: Car,
    gradient: "from-orange-500 via-red-500 to-rose-600",
  },
  {
    slug: "shooting",
    name: "Shooting",
    tagline: "Aim steady, breathe slow",
    blurb:
      "Twin-stick arenas, precision ranges and wave sieges. No gore, all glow — just you and the crosshair.",
    icon: Crosshair,
    gradient: "from-lime-400 via-green-500 to-emerald-600",
  },
  {
    slug: "sports",
    name: "Sports",
    tagline: "The beautiful games, miniaturised",
    blurb:
      "Penalties, putts, strikes and slam dunks. Twenty sports that fit inside a lunch break.",
    icon: Trophy,
    gradient: "from-sky-400 via-blue-500 to-indigo-600",
  },
  {
    slug: "word",
    name: "Word",
    tagline: "Vocabulary is a sport",
    blurb:
      "Scrambles, ciphers, chains and crosswords. Warm up your brain — or break it. Your call.",
    icon: WholeWord,
    gradient: "from-indigo-400 via-violet-500 to-purple-600",
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
  {
    slug: "tower-steps",
    title: "Tower Steps",
    category: "puzzle",
    tagline: "Outsmart the classic Tower of Hanoi.",
    description:
      "Three pegs, one rule: a big disc never sits on a small one. Move the whole tower to the far peg in the optimal 2ⁿ−1 moves — or grind it down move by move and chase the fewest-moves record from 3 discs all the way to 8.",
    cover: { emoji: "🗼", gradient: "from-sky-400 via-blue-500 to-indigo-600" },
    input: ["mouse", "touch", "keyboard"],
    controls: [
      { keys: "Click / tap", action: "Pick up a disc, then place it" },
      { keys: "1 2 3", action: "Select a peg" },
      { keys: "Z", action: "Undo the last move" },
      { keys: "R", action: "Restart the tower" },
    ],
    tags: ["classic", "logic", "hanoi"],
    score: { label: "Fewest moves", mode: "low", kind: "moves" },
  },
  {
    slug: "word-guess",
    title: "Word Guess",
    category: "puzzle",
    tagline: "Crack the word in six tries.",
    description:
      "Type any five-letter word and read the board: green is dead-on, yellow is elsewhere, grey is dead. Letters repeat and the grid knows it — thread six guesses into a winning streak and watch it climb.",
    cover: { emoji: "🔤", gradient: "from-emerald-400 via-teal-500 to-cyan-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "A–Z keys / on-screen keyboard", action: "Type a guess" },
      { keys: "Enter", action: "Submit the row" },
      { keys: "Backspace", action: "Delete a letter" },
      { keys: "New word", action: "Start another round" },
    ],
    tags: ["word", "daily", "logic"],
    score: { label: "Win streak", mode: "high", kind: "points" },
  },
  {
    slug: "code-breaker",
    title: "Code Breaker",
    category: "puzzle",
    tagline: "Crack the hidden colour code.",
    description:
      "A secret code of coloured pegs hides under the cover. Every guess earns black pegs for perfect hits and white pegs for right-colour-wrong-slot — shuffled, so nothing is given away for free. Solve it fast: fewest guesses wins each difficulty.",
    cover: { emoji: "🔑", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Set a guess slot's colour" },
      { keys: "Submit", action: "Check the guess" },
      { keys: "Easy / Hard", action: "Switch code length and palette" },
    ],
    tags: ["logic", "code", "classic"],
    score: { label: "Fewest guesses", mode: "low", kind: "moves" },
  },
  {
    slug: "gem-swap",
    title: "Gem Swap",
    category: "puzzle",
    tagline: "Swap gems, chain cascades, score big.",
    description:
      "Line up three or more gems and watch them shatter — then hold on as the board drops and refills into cascades that multiply every payout. You get 30 moves: burn them stacking combos into one huge score.",
    cover: { emoji: "💎", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Tap, then tap", action: "Swap two adjacent gems" },
      { keys: "Drag", action: "Slide a gem onto its neighbour" },
    ],
    tags: ["match3", "casual", "cascade"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "word-hunt",
    title: "Word Hunt",
    category: "puzzle",
    tagline: "Hunt words hiding in plain sight.",
    description:
      "Ten themed words are buried in a 12×12 grid — forwards, backwards and every diagonal in between. Drag across each span before the clock gets the better of you, and burn one of your three hints only when you're truly stuck.",
    cover: { emoji: "🔍", gradient: "from-violet-500 via-purple-500 to-fuchsia-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Drag", action: "Select a word span" },
      { keys: "Hint", action: "Reveal a starting letter" },
      { keys: "New puzzle", action: "Fresh grid, new theme" },
    ],
    tags: ["words", "search", "chill"],
    score: { label: "Fastest clear", mode: "low", kind: "seconds" },
  },
  {
    slug: "block-blast",
    title: "Block Blast",
    category: "puzzle",
    tagline: "Fit the pieces. Clear the board.",
    description:
      "Drop fixed-shape blocks onto the 8×8 board and fill whole rows and columns to blast them off. Clearing lines together doubles the bonus and builds a streak — but the tray always refills, and one piece that fits nowhere ends the run.",
    cover: { emoji: "🧱", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Pick a piece, then place it" },
      { keys: "New game", action: "Fresh board and tray" },
    ],
    tags: ["blocks", "puzzle", "endless"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "dot-chaser",
    title: "Dot Chaser",
    category: "arcade",
    tagline: "Clear the maze. Outrun everyone.",
    description:
      "Sweep the maze clean while four ghosts hunt you down — a chaser, an ambusher and two wildcards. Grab a power pellet and the hunt flips for six glorious seconds. Every level comes back faster.",
    cover: { emoji: "👻", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Arrows / WASD", action: "Steer" },
      { keys: "Swipe", action: "Steer on touch" },
      { keys: "Space / Enter", action: "Start or restart" },
    ],
    tags: ["maze", "chase", "classic"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "neon-blocks",
    title: "Neon Blocks",
    category: "arcade",
    tagline: "Stack clean. Clear lines.",
    description:
      "Drop neon tiles into a 10×20 well and burn full lines before the stack tops out. Ghost previews, a hold slot and wall-kick rotations keep you in control. Every ten lines the well speeds up.",
    cover: { emoji: "🧊", gradient: "from-cyan-400 via-sky-500 to-blue-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "← / →", action: "Move" },
      { keys: "↑ / X", action: "Rotate" },
      { keys: "↓", action: "Soft drop" },
      { keys: "Space", action: "Hard drop" },
      { keys: "C / Shift", action: "Hold piece" },
      { keys: "On-screen buttons", action: "Full touch control" },
    ],
    tags: ["blocks", "stacking", "classic"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "star-invaders",
    title: "Star Invaders",
    category: "arcade",
    tagline: "The formation is marching down.",
    description:
      "A 55-strong alien formation marches, steps down and speeds up as it thins. You get one bullet in the air, two destructible shields and three lives. Clear the wave and the next one comes faster.",
    cover: { emoji: "👾", gradient: "from-violet-500 via-purple-500 to-fuchsia-500" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "← / →", action: "Move ship" },
      { keys: "Drag", action: "Move ship on touch" },
      { keys: "Space / tap", action: "Fire" },
    ],
    tags: ["shooter", "waves", "space"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "flap-nova",
    title: "Flap Nova",
    category: "arcade",
    tagline: "One button. Endless sky.",
    description:
      "Tap to flap, thread the gaps and let momentum do the rest. Every pipe you pass tightens the sky a little more. How far can one thumb carry you?",
    cover: { emoji: "🐦", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Flap" },
      { keys: "Space", action: "Flap / start" },
    ],
    tags: ["one button", "timing", "endless"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "pixel-runner",
    title: "Pixel Runner",
    category: "arcade",
    tagline: "Never stop running.",
    description:
      "Your runner never stops, so you'd better keep up. Hurdle the cacti, duck the flyers and ride the speed as it climbs with every meter. Double cacti arrive in clusters just to test you.",
    cover: { emoji: "🏃", gradient: "from-fuchsia-500 via-purple-500 to-indigo-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Space / ↑ / tap", action: "Jump" },
      { keys: "↓ / swipe down", action: "Duck" },
    ],
    tags: ["runner", "endless", "reflex"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "sky-hopper",
    title: "Sky Hopper",
    category: "arcade",
    tagline: "Bounce higher. Never look down.",
    description:
      "The bounce auto-fires, so all you steer is the arc. Ride moving pads, crumbling ledges and spring coils past patrolling spikeballs. Height is the only score that matters.",
    cover: { emoji: "🎈", gradient: "from-lime-400 via-emerald-500 to-teal-600" },
    input: ["keyboard", "mouse", "touch"],
    controls: [
      { keys: "← / →", action: "Steer" },
      { keys: "Pointer / touch position", action: "Steer" },
      { keys: "Space", action: "Start" },
    ],
    tags: ["bouncing", "vertical", "endless"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "sudoku",
    title: "Sudoku",
    category: "puzzle",
    tagline: "Every row, one of each.",
    description:
      "Nine boxes, nine digits, zero repeats — take on easy, medium or hard grids generated fresh every round. Pencil in corner notes, watch conflicting digits glow red, and race the clock for your fastest clear at each difficulty.",
    cover: { emoji: "🧮", gradient: "from-violet-500 via-purple-500 to-fuchsia-500" },
    input: ["mouse", "touch", "keyboard"],
    controls: [
      { keys: "Click / tap", action: "Select cell" },
      { keys: "1–9", action: "Fill" },
      { keys: "N", action: "Toggle pencil mode" },
      { keys: "Backspace", action: "Clear" },
    ],
    tags: ["numbers", "logic", "daily"],
    score: { label: "Fastest clear", mode: "low", kind: "seconds" },
  },
  {
    slug: "tile-mahjong",
    title: "Tile Mahjong",
    category: "puzzle",
    tagline: "Match pairs. Clear the mountain.",
    description:
      "Match open tiles two at a time and strip the three-layer pyramid layer by layer. Every board is dealt so a solvable path exists — but a careless pick can still trap you, so spend a hint or a shuffle and finish the climb.",
    cover: { emoji: "🀄", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Select / match tile" },
      { keys: "Hint", action: "Reveal a pair" },
      { keys: "Shuffle", action: "Mix remaining tiles" },
    ],
    tags: ["tiles", "matching", "relaxing"],
    score: { label: "Fastest clear", mode: "low", kind: "seconds" },
  },
  {
    slug: "nonogram",
    title: "Nonogram",
    category: "puzzle",
    tagline: "Numbers paint the hidden picture.",
    description:
      "Edge clues tell you how many squares to fill in each line — but never which ones. Deduce the hidden picture one row at a time, mark the dead cells with ✕, and solve all thirteen patterns as fast as you can.",
    cover: { emoji: "🎨", gradient: "from-pink-400 via-rose-500 to-red-400" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Fill cell" },
      { keys: "Right-click / mark mode", action: "Mark X" },
      { keys: "New puzzle", action: "Next pattern" },
    ],
    tags: ["logic", "picross", "deduction"],
    score: { label: "Fastest clear", mode: "low", kind: "seconds" },
  },
  {
    slug: "sliding-15",
    title: "Sliding 15",
    category: "puzzle",
    tagline: "Fifteen tiles, one empty space.",
    description:
      "The granddaddy of sliding puzzles — shuffle, slide, repeat until fifteen tiles sit in perfect order. Every board starts from 200 legal moves, so it's always solvable. The only question is how few moves it takes you.",
    cover: { emoji: "🔟", gradient: "from-sky-400 via-blue-500 to-indigo-600" },
    input: ["mouse", "touch", "keyboard"],
    controls: [
      { keys: "Click / tap", action: "Slide tile" },
      { keys: "Arrows", action: "Slide tiles" },
      { keys: "R", action: "New game" },
    ],
    tags: ["sliding", "numbers", "classic"],
    score: { label: "Fewest moves", mode: "low", kind: "moves" },
  },
  {
    slug: "box-push",
    title: "Box Push",
    category: "puzzle",
    tagline: "Push every crate onto a dot.",
    description:
      "Ten hand-built sokoban levels stand between you and perfect crate management. Crates only push one way, walls never move, and one careless shove can trap a box for good — but unlimited undo has your back. Clear all ten to call yourself a mover.",
    cover: { emoji: "📦", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Arrows / WASD", action: "Move / push" },
      { keys: "Swipe", action: "Move on touch" },
      { keys: "Z", action: "Undo" },
      { keys: "R", action: "Restart level" },
    ],
    tags: ["sokoban", "logic", "levels"],
    score: { label: "Levels cleared", mode: "high", kind: "points" },
  },
  {
    slug: "lights-out",
    title: "Lights Out",
    category: "puzzle",
    tagline: "Flip pluses. Kill every light.",
    description:
      "Each tap flips a glowing cell and its neighbours — switch off all twenty-five to win. Every scramble comes from real moves, so a solution always exists; the clock just asks how quickly you can find it.",
    cover: { emoji: "💡", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Toggle the plus-shape" },
      { keys: "New game", action: "Fresh scramble" },
    ],
    tags: ["logic", "grid", "quick"],
    score: { label: "Fastest clear", mode: "low", kind: "seconds" },
  },
  {
    slug: "air-hockey",
    title: "Air Hockey",
    category: "casual",
    tagline: "First to seven takes it.",
    description:
      "Drag your mallet around the vertical rink and bury the puck past a CPU that never stops chasing. Wall bounces stay fast, the striker answers with a wicked angle, and the first to seven goals walks away. Defend your half, read the rebounds, win the match.",
    cover: { emoji: "🏒", gradient: "from-cyan-400 via-sky-500 to-blue-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Move pointer", action: "Drive the mallet" },
      { keys: "New match", action: "Restart" },
    ],
    tags: ["physics", "duel", "sports"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "guess-beast",
    title: "Guess Beast",
    category: "casual",
    tagline: "Outsmart the mind-reading beast.",
    description:
      "Think of any animal in the bestiary, then answer yes, no or not sure while the AI hunts it down with the smartest question left. It only dares a guess once two beasts remain — miss twice and the round is yours. Answer honestly and see how few questions it really needs.",
    cover: { emoji: "🤔", gradient: "from-fuchsia-500 via-purple-500 to-indigo-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Yes / No / Not sure", action: "Answer the AI" },
      { keys: "New game", action: "Think of another animal" },
    ],
    tags: ["logic", "guessing", "ai"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "tube-sort",
    title: "Tube Sort",
    category: "casual",
    tagline: "Sort every ball into place.",
    description:
      "Lift the top ball from one tube and drop it into another, stacking colours until every tube holds a single hue. Each level adds another colour, two spare tubes and a little more chaos. Every board is solvable — get stuck, reset, and keep sorting.",
    cover: { emoji: "🧪", gradient: "from-emerald-400 via-teal-500 to-cyan-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Pick up / drop ball" },
      { keys: "Restart", action: "Reset level" },
    ],
    tags: ["sorting", "puzzle", "chill"],
    score: { label: "Levels cleared", mode: "high", kind: "points" },
  },
  {
    slug: "cast-and-catch",
    title: "Cast & Catch",
    category: "casual",
    tagline: "Drop the line. Land the catch.",
    description:
      "Hold to swing the depth marker, aim with your pointer and release so the hook stops right on a passing fish. Land shallow fish for a quick ten or time the abyss for a shark worth 150. Three casts per run — make every one of them count.",
    cover: { emoji: "🎣", gradient: "from-sky-400 via-blue-500 to-indigo-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Hold", action: "Charge the depth bar" },
      { keys: "Release", action: "Drop the line" },
      { keys: "Move pointer", action: "Aim the hook left or right" },
      { keys: "New run", action: "Reset haul" },
    ],
    tags: ["timing", "fishing", "chill"],
    score: { label: "Biggest haul", mode: "high", kind: "points" },
  },
  {
    slug: "neon-diner",
    title: "Neon Diner",
    category: "casual",
    tagline: "Cook fast. Serve faster.",
    description:
      "Tap a station to prep an item, watch the cook ring fill, then tap the matching order before its patience bar drains. Every serve pays per item plus a tip for speed, and each wave of five customers arrives hungrier than the last. Three walkouts and the kitchen closes.",
    cover: { emoji: "🍕", gradient: "from-pink-400 via-rose-500 to-red-400" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click station", action: "Prep an item" },
      { keys: "Click order", action: "Serve it (if ready)" },
    ],
    tags: ["cooking", "timemanagement", "waves"],
    score: { label: "Best shift", mode: "high", kind: "points" },
  },
  {
    slug: "pixel-painter",
    title: "Pixel Painter",
    category: "casual",
    tagline: "Fill the grid, one colour.",
    description:
      "Pick a colour chip, then tap every cell showing that number until a heart, rocket or grinning skull appears pixel by pixel. Six hand-built artworks, a live palette count that drops as you paint, and a celebration for every finished piece. Relax, fill in, collect them all.",
    cover: { emoji: "🖌️", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap chip", action: "Select colour" },
      { keys: "Click / tap cell", action: "Paint it" },
      { keys: "Next artwork", action: "Switch pattern" },
    ],
    tags: ["pixel", "art", "chill"],
  },
  {
    slug: "ultimate-tictactoe",
    title: "Ultimate Tic-Tac-Toe",
    category: "strategy",
    tagline: "Nine boards. One perfect plan.",
    description:
      "Win a mini-board to claim it, then take three in a row on the meta grid. Every cell you play sends the CPU to a matching board, so every move is also a command. Its alpha-beta search reads two plies of meta strategy — can you out-fork it?",
    cover: { emoji: "✳️", gradient: "from-violet-500 via-purple-500 to-fuchsia-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Place mark in the allowed board" },
      { keys: "New match", action: "Restart" },
    ],
    tags: ["minimax", "meta", "duel"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "hex-wars",
    title: "Hex Wars",
    category: "strategy",
    tagline: "Link your edges before theirs.",
    description:
      "You connect left to right, the CPU connects top to bottom, and both of you share one tight 9×9 hex grid. Every stone either extends your chain or severs theirs, and the first unbroken link wins the round. Read the board, close the gaps, finish your line.",
    cover: { emoji: "⬡", gradient: "from-cyan-400 via-sky-500 to-blue-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Place stone" },
      { keys: "New match", action: "Restart" },
    ],
    tags: ["minimax", "connection", "abstract"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "neon-tower-defense",
    title: "Neon Tower Defense",
    category: "strategy",
    tagline: "Build. Upgrade. Hold the line.",
    description:
      "Thread the serpentine lane with Pulse, Mortar and Rail towers, then survive twelve escalating waves. Kills pay coins, every tower upgrades to level 3, and each tank you leak costs lives. Preview the next wave, flip on ×2 speed, and prove you can hold until wave 12.",
    cover: { emoji: "🏰", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Build or select tower" },
      { keys: "Start wave", action: "Begin next wave" },
      { keys: "Speed", action: "Toggle ×2" },
    ],
    tags: ["defense", "towers", "waves"],
    score: { label: "Waves survived", mode: "high", kind: "points" },
  },
  {
    slug: "tank-duel",
    title: "Tank Duel",
    category: "strategy",
    tagline: "One shot. One wind. One winner.",
    description:
      "Set your angle, hold to charge and lob shells across a crumbling hilly battlefield. Wind shifts every round, craters rewrite the terrain, and a direct hit lands 35 damage. The CPU calibrates from every shot it fires — correct your aim faster than it does.",
    cover: { emoji: "💥", gradient: "from-pink-400 via-rose-500 to-red-400" },
    input: ["mouse", "touch", "keyboard"],
    controls: [
      { keys: "Angle slider / Arrow keys", action: "Set angle" },
      { keys: "Hold fire / Space", action: "Charge power" },
      { keys: "Release", action: "Shoot" },
    ],
    tags: ["artillery", "physics", "duel"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "dungeon-dash",
    title: "Dungeon Dash",
    category: "strategy",
    tagline: "Descend until the dungeon wins.",
    description:
      "Push through procedurally carved floors, bump-to-attack rats, skeletons and ogres, and chug potions the moment you find them. Fog hides everything beyond your sight while the message log records every swing. Each stairwell drops you deeper — how far before the dungeon keeps you?",
    cover: { emoji: "⚔️", gradient: "from-slate-400 via-zinc-500 to-neutral-700" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Arrows / WASD", action: "Move & attack" },
      { keys: "Swipe", action: "Move on touch" },
      { keys: "On-screen D-pad", action: "Touch movement" },
    ],
    tags: ["roguelike", "turn-based", "dungeon"],
    score: { label: "Deepest floor", mode: "high", kind: "points" },
  },
  {
    slug: "mancala",
    title: "Mancala",
    category: "strategy",
    tagline: "Sow smart. Capture everything.",
    description:
      "Pick a pit and sweep your stones counterclockwise, landing in your store to earn another turn. Drop into an empty pit of your own and you swallow the opposite pile whole. The CPU searches six moves deep — starve it out before it starves you.",
    cover: { emoji: "🕳️", gradient: "from-emerald-400 via-teal-500 to-cyan-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap pit", action: "Sow stones" },
      { keys: "New game", action: "Restart" },
    ],
    tags: ["minimax", "sowing", "classic"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "solitaire",
    title: "Solitaire",
    category: "casual",
    tagline: "Classic patience, reimagined.",
    description:
      "Deal, drag and stack your way through a full Klondike round — draw one, build down in alternating colours and file every suit home. Tap-to-move works everywhere drag does, and unlimited undo means a bad move is never final. Beat the clock and the fastest win is yours to keep.",
    cover: { emoji: "♠️", gradient: "from-sky-400 via-blue-500 to-indigo-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Select or drag cards" },
      { keys: "Double-click", action: "Auto-move to foundation" },
      { keys: "Stock", action: "Deal a card" },
      { keys: "Undo", action: "Take back" },
    ],
    tags: ["cards", "classic", "chill"],
    score: { label: "Fastest win", mode: "low", kind: "seconds" },
  },
  {
    slug: "neon-clicker",
    title: "Neon Clicker",
    category: "casual",
    tagline: "Tap. Upgrade. Watch it grow.",
    description:
      "One cookie at a time, then a million a second. Tap the orb, spend your haul on cursors, drills and reactors, and let the bakery keep baking while you're away. Every machine costs more than the last, so buy early and compound hard.",
    cover: { emoji: "🍪", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Earn cookies" },
      { keys: "Buy", action: "Purchase upgrade" },
      { keys: "Reset", action: "Wipe save" },
    ],
    tags: ["idle", "clicker", "upgrades"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "color-echo",
    title: "Color Echo",
    category: "casual",
    tagline: "Repeat the pattern before it fades.",
    description:
      "Four pads, one growing chain, no second chances. Watch the colours flash, then repeat them back exactly — one wrong pad ends the run. Every five steps the flashes speed up, so recall has to keep pace with your nerve.",
    cover: { emoji: "🟠", gradient: "from-pink-400 via-rose-500 to-red-400" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap pad", action: "Repeat the sequence" },
    ],
    tags: ["memory", "sequence", "classic"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "type-storm",
    title: "Type Storm",
    category: "casual",
    tagline: "Type fast before the words land.",
    description:
      "Words rain down five lanes and only your keyboard stands in the way. Type a falling word to shred it for points, hit space to wipe a botched start, and never let one touch the floor. The storm quickens as your score climbs — three strikes and it wins.",
    cover: { emoji: "⌨️", gradient: "from-cyan-400 via-sky-500 to-blue-600" },
    input: ["keyboard"],
    controls: [
      { keys: "A–Z", action: "Type the words" },
      { keys: "Space", action: "Clear buffer" },
    ],
    tags: ["typing", "words", "endless"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "quick-quiz",
    title: "Quick Quiz",
    category: "casual",
    tagline: "Ten questions. Three lives. Go.",
    description:
      "Ten general-knowledge questions, fifteen seconds each, three lives in your pocket. Answer fast for time bonuses and chain correct answers for streak multipliers up to double. Survive all ten and walk away with the biggest total you can bank.",
    cover: { emoji: "❓", gradient: "from-violet-500 via-purple-500 to-fuchsia-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Pick an answer" },
      { keys: "Next", action: "Continue (auto-advances after reveal)" },
    ],
    tags: ["trivia", "quiz", "daily"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "beat-tap",
    title: "Beat Tap",
    category: "casual",
    tagline: "Hit the beat, chase the combo.",
    description:
      "Two tracks, four lanes and a hit window measured in milliseconds. Line your D, F, J and K taps up with the falling notes — perfect hits pay triple once your combo is rolling — and finish the song with your accuracy on the board.",
    cover: { emoji: "🎵", gradient: "from-emerald-400 via-teal-500 to-cyan-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "D F J K", action: "Hit lanes 1–4" },
      { keys: "Tap lane", action: "Hit on touch" },
      { keys: "Track / difficulty", action: "Choose song" },
    ],
    tags: ["rhythm", "timing", "music"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "traffic-hop",
    title: "Traffic Hop",
    category: "arcade",
    tagline: "Hop, ride, don't drown.",
    description:
      "You dart across four lanes of speeding traffic, then float the river on logs and turtles that dive without warning. Every home you bank restarts the 30-second clock and makes the next crossing faster and wider. You get three lives and five slots to fill.",
    cover: { emoji: "🐸", gradient: "from-lime-400 via-emerald-500 to-teal-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Arrow keys / WASD", action: "Hop" },
      { keys: "Swipe", action: "Hop on touch" },
      { keys: "Space", action: "Start / next crossing" },
    ],
    tags: ["crossing", "timing", "classic"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "asteroid-belt",
    title: "Asteroid Belt",
    category: "arcade",
    tagline: "Drift, split, repeat.",
    description:
      "You rotate, feather the thrust and let inertia — and the wrapping screen — do the rest. Split every rock twice: a shard pays five times the boulder it broke out of, and the saucer that strafes past is worth 200. Three lives, waves that only grow.",
    cover: { emoji: "☄️", gradient: "from-slate-400 via-zinc-500 to-neutral-700" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "← / →", action: "Rotate" },
      { keys: "↑", action: "Thrust" },
      { keys: "Space", action: "Fire" },
      { keys: "On-screen ◀ ▶ ⬆ 🔥 buttons", action: "Full touch control" },
    ],
    tags: ["space", "physics", "waves"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "volley-pong",
    title: "Volley Pong",
    category: "arcade",
    tagline: "First to seven wins.",
    description:
      "Your blade follows the mouse, your finger or the arrow keys, and the ball leaves at an angle set by where it lands on the paddle. Each return nudges the pace up while the CPU chases with capped speed and a little human error. Win seven points to take the match.",
    cover: { emoji: "🏓", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["mouse", "touch", "keyboard"],
    controls: [
      { keys: "Mouse / finger", action: "Move paddle" },
      { keys: "← / →", action: "Move paddle" },
      { keys: "Space", action: "Serve / start" },
      { keys: "Click / tap", action: "Serve on touch" },
    ],
    tags: ["duel", "paddle", "ai"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "city-defender",
    title: "City Defender",
    category: "arcade",
    tagline: "Six cities. Endless rain.",
    description:
      "You click ahead of each arcing warhead and your interceptor blooms into a blast that swallows anything around it. Chain the blooms for 25, 50, 75 points a hit, but every city you lose stays rubble for the whole run. The waves never stop accelerating — only a hit on the base ends it.",
    cover: { emoji: "🚀", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Fire interceptor at that point" },
    ],
    tags: ["defense", "aim", "waves"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "cave-pilot",
    title: "Cave Pilot",
    category: "arcade",
    tagline: "Hold on, the cave narrows.",
    description:
      "Hold the click, your finger or Space to climb, and release to let gravity pull the rotor down. The cave narrows and speeds up the whole way, leaving you one move in each direction. Distance flown is your score — there is nothing else out there.",
    cover: { emoji: "🚁", gradient: "from-cyan-400 via-sky-500 to-blue-600" },
    input: ["mouse", "touch", "keyboard"],
    controls: [
      { keys: "Hold click / tap", action: "Climb" },
      { keys: "Space", action: "Climb / start" },
    ],
    tags: ["one button", "endless", "precision"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "knife-frenzy",
    title: "Knife Frenzy",
    category: "arcade",
    tagline: "Land it or lose it.",
    description:
      "Tap to send a blade straight up into the spinning log; stick it clean and it stays in the wood. Clip a blade already there and the run is over, while apples on the rim pay a 250-point bonus. Every ten sticks speeds the log up and sometimes flips it the other way.",
    cover: { emoji: "🔪", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Throw knife" },
    ],
    tags: ["timing", "one button", "levels"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "blackjack",
    title: "Blackjack",
    category: "casual",
    tagline: "Beat the dealer to twenty-one.",
    description:
      "Stack chips, pick a wager and chase twenty-one while the dealer draws to seventeen. Double down on your first two cards, cash a blackjack at three-to-two and watch your bank climb. Run the stake to zero and the house hands you a fresh stake to start over.",
    cover: { emoji: "🃏", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Hit / Stand / Double", action: "Play the hand" },
      { keys: "Bet chips", action: "Set wager" },
      { keys: "Deal", action: "Start hand" },
    ],
    tags: ["cards", "vegas", "classic"],
    score: { label: "Richest bank", mode: "high", kind: "points" },
  },
  {
    slug: "dice-kings",
    title: "Dice Kings",
    category: "casual",
    tagline: "Roll big, fill every box.",
    description:
      "Five dice, three rolls a turn and thirteen boxes begging to be filled. Hold the keepers, chase full houses and long straights, and hunt the fifty-point yahtzee. Every box previews its live score — lock it before the dice turn on you.",
    cover: { emoji: "🎲", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Roll", action: "Roll unheld dice" },
      { keys: "Tap die", action: "Hold / release" },
      { keys: "Category", action: "Lock that score" },
    ],
    tags: ["dice", "scoring", "classic"],
    score: { label: "Best game", mode: "high", kind: "points" },
  },
  {
    slug: "neon-pool",
    title: "Neon Pool",
    category: "casual",
    tagline: "Sink the eight, own the table.",
    description:
      "Drag back from the cue ball, line up the guideline and slingshot your shot across a glowing table. The first ball you pot claims your group — clear it, then drop the eight without scratching early. The CPU plans geometric shots, so take your turn while you have one.",
    cover: { emoji: "🎱", gradient: "from-cyan-400 via-sky-500 to-blue-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Drag", action: "Aim & set power" },
      { keys: "Release", action: "Shoot" },
      { keys: "Place cue", action: "Ball in hand" },
    ],
    tags: ["pool", "physics", "duel"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "paper-toss",
    title: "Paper Toss",
    category: "casual",
    tagline: "Crumple it. Arc it. Sink it.",
    description:
      "Pull back on the paper ball, release, and let a locked 45° arc carry it across the room to the glowing bin. Every throw fights a fresh wind, and the bin drifts farther back with each make. Three misses ends the streak — how long can you keep it alive?",
    cover: { emoji: "🗑️", gradient: "from-slate-400 via-zinc-500 to-neutral-700" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Drag & release", action: "Set power and throw" },
    ],
    tags: ["aim", "physics", "streak"],
    score: { label: "Longest streak", mode: "high", kind: "points" },
  },
  {
    slug: "bullseye-darts",
    title: "Bullseye Darts",
    category: "casual",
    tagline: "301. Three darts. Checkout or bust.",
    description:
      "Step to the oche and click where you want the dart to land — a tight scatter decides where it really sticks. Trade three darts a turn with the CPU, mind your busts and take 301 down straight out. First to two legs walks away.",
    cover: { emoji: "🏹", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Throw a dart at that spot" },
    ],
    tags: ["darts", "aim", "classic"],
    score: { label: "Legs won", mode: "high", kind: "points" },
  },
  {
    slug: "hangman",
    title: "Hangman",
    category: "casual",
    tagline: "Guess the word before it's drawn.",
    description:
      "One word, six guesses and a gallows that grows with every miss. Pick from over two hundred words across Animals, Food, Countries, Movies, Sports and Nature, then work the keyboard one letter at a time. Solve it and the win streak climbs — miss six and it resets.",
    cover: { emoji: "🪢", gradient: "from-lime-400 via-emerald-500 to-teal-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "A–Z / keycaps", action: "Guess a letter" },
      { keys: "New word", action: "Next word" },
    ],
    tags: ["word", "classic", "guessing"],
    score: { label: "Win streak", mode: "high", kind: "points" },
  },
  {
    slug: "chess",
    title: "Chess",
    category: "strategy",
    tagline: "Checkmate the machine, move by move.",
    description:
      "You play White with the full rulebook on the table: castling, en passant, promotion, and never a move that leaves your king in check. The CPU answers with alpha-beta search plus a quiescence extension, so hiding a piece behind a bad trade does not work. Checkmate it and the series tally remembers every round.",
    cover: { emoji: "♟️", gradient: "from-slate-400 via-zinc-500 to-neutral-700" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Select & move piece" },
      { keys: "Undo", action: "Take back a turn" },
      { keys: "New game", action: "Restart" },
    ],
    tags: ["minimax", "classic", "duel"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "checkers",
    title: "Checkers",
    category: "strategy",
    tagline: "Jump everything. Crown everything. Win.",
    description:
      "You pick the opening jump, chain doubles across the board and race your men to the king row. Forced captures mean you cannot dodge a fight, and the CPU searches six plies deep with material and crowning in its evaluation. Clear its pieces or block every last move to take the round.",
    cover: { emoji: "⚫", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Select & move" },
      { keys: "New game", action: "Restart" },
    ],
    tags: ["minimax", "classic", "captures"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "reversi",
    title: "Reversi",
    category: "strategy",
    tagline: "Flank, flip, and flood the board.",
    description:
      "You place a disc and turn whole rows to your colour in one move. Legal plays light up as dots, corners are worth a fortune, and the CPU runs a depth-3 search weighted by position and mobility. Fill the board and whoever owns more discs wins the round.",
    cover: { emoji: "⚪", gradient: "from-emerald-400 via-teal-500 to-cyan-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Place disc & flip" },
      { keys: "New game", action: "Restart" },
    ],
    tags: ["minimax", "territory", "classic"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "gomoku",
    title: "Gomoku",
    category: "strategy",
    tagline: "Line up five before it does.",
    description:
      "You drop black-and-white stones on a 15x15 grid and race to five in a row, any direction. The CPU scores every empty cell against classic patterns - five, open four, closed four, open three - then blocks your immediate threat before it builds its own. Stack five and the round is yours.",
    cover: { emoji: "🔘", gradient: "from-fuchsia-500 via-purple-500 to-indigo-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Place stone" },
      { keys: "New game", action: "Restart" },
    ],
    tags: ["minimax", "grid", "duel"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "battleship",
    title: "Battleship",
    category: "strategy",
    tagline: "Hunt the fleet. Sink them all.",
    description:
      "You drop five ships onto your grid, flip their orientation, or let the randomiser do it, then trade shots across two 10x10 boards. The CPU hunts on a parity pattern, switches to target mode the moment it scores a hit and walks the line until your hull goes down. Sink all five enemy ships to bank a win.",
    cover: { emoji: "🚢", gradient: "from-cyan-400 via-sky-500 to-blue-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Place ship / fire" },
      { keys: "Randomize", action: "Auto-place fleet" },
      { keys: "Rotate", action: "Ship orientation" },
      { keys: "Start battle", action: "Begin the duel" },
      { keys: "New game", action: "Restart" },
    ],
    tags: ["naval", "hunt", "classic"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "dots-boxes",
    title: "Dots & Boxes",
    category: "strategy",
    tagline: "Close boxes. Steal chains. Outscore it.",
    description:
      "You draw lines between dots, and every box you close hands you another turn. The CPU refuses to feed you a chain: it plays a safe edge whenever one exists, and only opens a box when the board leaves it no choice. Twenty-five boxes on the grid - own more than half to win.",
    cover: { emoji: "🔲", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap edge", action: "Draw line" },
      { keys: "New game", action: "Restart" },
    ],
    tags: ["minimax", "grid", "duel"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "nim",
    title: "Nim",
    category: "strategy",
    tagline: "Take the last stick.",
    description:
      "Three rows of sticks, one ruthless rule: take the last one and you win. Read the nim-sum, force the CPU into a zero and grind it down. Flip to Perfect mode if you want to face math that never blinks.",
    cover: { emoji: "🪵", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Select sticks to take" },
      { keys: "Confirm", action: "Commit the take" },
      { keys: "Difficulty", action: "Perfect / Beatable" },
      { keys: "New game", action: "Restart" },
    ],
    tags: ["nim", "math", "duel"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "flag-hunt",
    title: "Flag Hunt",
    category: "strategy",
    tagline: "Hide your flag. Find theirs.",
    description:
      "Your flag is buried in a ranks-only army of bombs, miners and soldiers. Maneuver one square at a time, probe the enemy's cover and strike with the piece that fits. Capture their flag — or lose yours — and the whole match flips.",
    cover: { emoji: "🚩", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Move / attack (select then target)" },
      { keys: "Randomize", action: "Redeploy before start" },
      { keys: "Start", action: "Begin battle" },
    ],
    tags: ["hidden", "tactics", "duel"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "quoridor",
    title: "Quoridor",
    category: "strategy",
    tagline: "Walls up. Race on.",
    description:
      "Seven squares wide, eight walls each, one race: reach the far side first. Step around the CPU or slam a wall across its path — as long as nobody gets sealed in. Every wall reshapes both routes, so read the board before you build.",
    cover: { emoji: "🚧", gradient: "from-lime-400 via-emerald-500 to-teal-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Move one cell" },
      { keys: "Wall mode", action: "Place a wall" },
      { keys: "New game", action: "Restart" },
    ],
    tags: ["abstract", "paths", "duel"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "arcane-deck",
    title: "Arcane Deck",
    category: "strategy",
    tagline: "Draft. Fight. Deck. Repeat.",
    description:
      "Six encounters stand between you and the Sentinel, and your deck is all you get. Spend three energy a turn wisely, block what the enemy telegraphs and weave rewards into a machine. Fall, and your furthest run is the only score that survives.",
    cover: { emoji: "🎴", gradient: "from-fuchsia-500 via-purple-500 to-indigo-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap card", action: "Play card" },
      { keys: "End turn", action: "Draw & pass" },
      { keys: "Reward", action: "Pick a card" },
    ],
    tags: ["cards", "roguelike", "deck"],
    score: { label: "Furthest run", mode: "high", kind: "points" },
  },
  {
    slug: "liars-dice",
    title: "Liar's Dice",
    category: "strategy",
    tagline: "Bluff hard. Call harder.",
    description:
      "Five dice in your cup, five in the dark, and one bid on the table. Raise it, bluff it, or slam the table and call the lie. Win two rounds more than you lose and the match is yours.",
    cover: { emoji: "🫣", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Set bid quantity/face" },
      { keys: "Raise", action: "Commit bid" },
      { keys: "Challenge", action: "Call the bluff" },
    ],
    tags: ["bluff", "dice", "duel"],
    score: { label: "Rounds won", mode: "high", kind: "points" },
  },
  {
    slug: "conquest",
    title: "Conquest",
    category: "strategy",
    tagline: "Fourteen lands. One victor.",
    description:
      "Fourteen territories, two warlords, one map to swallow whole. Reinforce your borders, roll the attack dice and chain as many strikes as your nerve allows. Leave one army marching and the whole continent can turn.",
    cover: { emoji: "🏴", gradient: "from-slate-400 via-zinc-500 to-neutral-700" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Select territory / place troops" },
      { keys: "Attack", action: "Enter attack mode" },
      { keys: "Auto-place", action: "Spread reinforcements" },
      { keys: "End turn", action: "Pass to CPU" },
    ],
    tags: ["territory", "dice", "duel"],
    score: { label: "Games won", mode: "high", kind: "points" },
  },
  {
    slug: "fruit-merge",
    title: "Fruit Merge",
    category: "puzzle",
    tagline: "Drop fruit. Merge. Grow giants.",
    description:
      "Aim and drop fruit into the pit — touch two identical fruits and they fuse into a bigger one, chain reactions and all. Keep the pile under the line while you work your way up to the giant watermelon. One drop at a time, endless patience required.",
    cover: { emoji: "🍒", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Move / drag", action: "Aim the falling fruit" },
      { keys: "Click / tap", action: "Drop the fruit" },
      { keys: "Drop in", action: "Start a fresh pit" },
    ],
    tags: ["merge", "physics", "chill"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "flow-link",
    title: "Flow Link",
    category: "puzzle",
    tagline: "Connect every pair. Fill the board.",
    description:
      "Draw pipes between matching coloured dots until every pair is linked and no cell is left empty. Pipes can't cross, so the order you solve each colour in is the whole game — start with the easy 7×7 grids and step up to the tangled 10×10 boards.",
    cover: { emoji: "🔗", gradient: "from-cyan-400 via-sky-500 to-blue-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Drag from a dot", action: "Draw a pipe to its match" },
      { keys: "Drag over your pipe", action: "Retract and redraw it" },
      { keys: "Easy / Hard", action: "Switch board size and difficulty" },
      { keys: "New puzzle", action: "Deal the next grid" },
    ],
    tags: ["pipes", "logic", "spatial"],
    score: { label: "Fastest clear", mode: "low", kind: "seconds" },
  },
  {
    slug: "traffic-jam",
    title: "Traffic Jam",
    category: "puzzle",
    tagline: "Get the red car out.",
    description:
      "Cars are double-parked in a tight lot and only the red one matters — slide every vehicle along its own axis until the exit lane opens. Each tap is a move, so count them: harder lots reward you for solving them in fewer slides than you thought possible.",
    cover: { emoji: "🚌", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
    input: ["mouse", "touch", "keyboard"],
    controls: [
      { keys: "Click / tap", action: "Select a vehicle, then tap a free cell in line with it" },
      { keys: "Arrow keys", action: "Slide the selected vehicle" },
      { keys: "Next puzzle", action: "Load the next lot" },
    ],
    tags: ["sliding", "classic", "logic"],
    score: { label: "Puzzles solved", mode: "high", kind: "points" },
  },
  {
    slug: "connections",
    title: "Connections",
    category: "puzzle",
    tagline: "Find the four hidden groups.",
    description:
      "Sixteen words hide four secret categories — pick four you think belong together and check. Solve the obvious groups first, then stare down the decoys designed to straddle two categories; a wrong guess costs you one of only four allowed. Clear puzzles back-to-back to build a streak.",
    cover: { emoji: "🧩", gradient: "from-violet-500 via-purple-500 to-fuchsia-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Select a word" },
      { keys: "Check", action: "Test the selected four" },
      { keys: "New puzzle", action: "Deal the next grid" },
    ],
    tags: ["words", "categories", "daily"],
    score: { label: "Puzzle streak", mode: "high", kind: "points" },
  },
  {
    slug: "path-painter",
    title: "Path Painter",
    category: "puzzle",
    tagline: "Draw the track. Roll the ball.",
    description:
      "Sketch a road from the ball to the flag, then hit go and watch it roll along whatever you painted. Swerve around hazards, thread the gaps between walls, and scoop up stars on the way — every level clears, but only a clean line earns the full rating.",
    cover: { emoji: "✏️", gradient: "from-lime-400 via-emerald-500 to-teal-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Drag", action: "Paint the track from the ball onward" },
      { keys: "Clear path", action: "Erase and redraw" },
      { keys: "Next level", action: "Advance after clearing" },
    ],
    tags: ["drawing", "physics", "creative"],
    score: { label: "Levels cleared", mode: "high", kind: "points" },
  },
  {
    slug: "fruit-blitz",
    title: "Fruit Blitz",
    category: "arcade",
    tagline: "Slice fruit. Dodge bombs.",
    description:
      "Fruit launches out of the stand in parabolic arcs and you swipe straight through it for points. Stack three or more cuts in a single swipe to earn a combo bonus, but touch a bomb and you drop 25 points. Let three fruits fall unsliced and the stand closes for good.",
    cover: { emoji: "🍉", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Drag / swipe", action: "Slice" },
      { keys: "New run", action: "Restart" },
    ],
    tags: ["swipe", "combo", "endless"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "cross-the-grid",
    title: "Cross the Grid",
    category: "arcade",
    tagline: "Hop across. Don't look down.",
    description:
      "Hop one cell at a time across roads and rivers while the camera climbs along with you. Ride the drifting logs, dodge the speeding traffic and push one row further than your last run. Every row reached scores, and the lanes only get faster.",
    cover: { emoji: "🚦", gradient: "from-cyan-400 via-sky-500 to-blue-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "↑ / tap", action: "Hop forward" },
      { keys: "← / →", action: "Sidestep" },
      { keys: "↓", action: "Step back" },
      { keys: "Swipe", action: "Any direction" },
    ],
    tags: ["crossing", "hop", "reflex"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "neon-pinball",
    title: "Neon Pinball",
    category: "arcade",
    tagline: "Three balls. One glowing table.",
    description:
      "Charge the plunger, launch into five bumpers and keep the ball alive with two neon flippers. Chain bumper hits before the clock runs out to build a rolling multiplier on every point. Three balls stand between you and a new table record.",
    cover: { emoji: "🎯", gradient: "from-fuchsia-500 via-purple-500 to-indigo-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Z / M", action: "Flippers" },
      { keys: "Hold Space", action: "Charge plunger" },
      { keys: "Tap left / right", action: "Touch flippers" },
    ],
    tags: ["pinball", "physics", "table"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "orb-cascade",
    title: "Orb Cascade",
    category: "arcade",
    tagline: "Stop the chain before it lands.",
    description:
      "A creeping chain of coloured orbs is sliding toward the socket and your cannon is the only thing in its way. Slot your shot between matching neighbours to clear three or more, then watch the chain collapse into a cascade. Clear three waves and the escalation never stops.",
    cover: { emoji: "🔮", gradient: "from-violet-500 via-purple-500 to-fuchsia-500" },
    input: ["mouse", "keyboard"],
    controls: [
      { keys: "Mouse", action: "Aim" },
      { keys: "Click", action: "Shoot" },
      { keys: "S", action: "Swap next orb" },
    ],
    tags: ["shooter", "match", "chain"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "drift-dash",
    title: "Drift Dash",
    category: "arcade",
    tagline: "One button. Every corner.",
    description:
      "Your car never lifts off the gas — you only decide when to turn. Hit every corner inside the green window as the route unspools ahead of you, and the speed climbs each six cells. Brake too early, hesitate, or miss the bend and you crash.",
    cover: { emoji: "🚗", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["mouse", "touch", "keyboard"],
    controls: [
      { keys: "Click / tap / Space", action: "Turn at the corner" },
    ],
    tags: ["one button", "timing", "endless"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "helix-fall",
    title: "Helix Fall",
    category: "arcade",
    tagline: "Fall through the spinning tower.",
    description:
      "The ball bounces on the crown of an endless tower of rings while gravity does the thinking. Spin the whole stack left or right so every gap lines up under the falling ball before it lands. Touch one solid slab and the run is over.",
    cover: { emoji: "🌀", gradient: "from-sky-400 via-blue-500 to-indigo-600" },
    input: ["mouse", "touch", "keyboard"],
    controls: [
      { keys: "Tap left / right half", action: "Rotate tower" },
      { keys: "← / →", action: "Rotate tower" },
    ],
    tags: ["one button", "timing", "endless"],
    score: { label: "High score", mode: "high", kind: "points" },
  },
  {
    slug: "highway-rush",
    title: "Highway Rush",
    category: "racing",
    tagline: "Lane-hop at two hundred.",
    description:
      "An endless neon highway run where traffic never stops coming. Dodge between lanes, ride slipstreams for bonus points, and hold the combo alive as the speed keeps climbing.",
    cover: { emoji: "🛣️", gradient: "from-cyan-400 via-sky-500 to-blue-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "← / A", action: "Move left" },
      { keys: "→ / D", action: "Move right" },
      { keys: "Tap", action: "Steer (buttons)" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["endless", "dodge", "combo"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "circuit-sprint",
    title: "Circuit Sprint",
    category: "racing",
    tagline: "One lap. One clock. No mercy.",
    description:
      "A top-down circuit time trial with a car glued to the racing line. String clean laps together, shave tenths off the clock, and set the best lap on the board.",
    cover: { emoji: "🏁", gradient: "from-emerald-400 via-teal-500 to-cyan-600" },
    input: ["keyboard"],
    controls: [
      { keys: "← / A", action: "Steer left" },
      { keys: "→ / D", action: "Steer right" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["circuit", "time-trial", "laps"],
    score: { label: "Best lap", mode: "low", kind: "ms" },
  },
  {
    slug: "hill-climber",
    title: "Hill Climber",
    category: "racing",
    tagline: "Gas is a suggestion. Gravity is law.",
    description:
      "A physics-driven climb over endless rocky hills in a stubborn off-roader. Feather the throttle to keep the nose down, launch off crests for air time, and flip to restart.",
    cover: { emoji: "🏔️", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "→ / D", action: "Gas" },
      { keys: "← / A", action: "Brake" },
      { keys: "Tap halves", action: "Brake / gas" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["physics", "climb", "endless"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "moto-trial",
    title: "Moto Trial",
    category: "racing",
    tagline: "Balance is faster than brave.",
    description:
      "A side-view trials course across five seeded stages of ramps, gaps, and ledges. Land flat, chain checkpoints, and roll across the finish before the cumulative clock runs out.",
    cover: { emoji: "🏍️", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "→ / D", action: "Gas & lean forward" },
      { keys: "← / A", action: "Brake & lean back" },
      { keys: "Tap halves", action: "Brake / gas" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["trials", "physics", "balance"],
    score: { label: "Time", mode: "low", kind: "seconds" },
  },
  {
    slug: "parking-master",
    title: "Parking Master",
    category: "racing",
    tagline: "Three-point turns, zero-point patience.",
    description:
      "A twelve-lot parking puzzle where every wall, cone, and parked car is permanent. Slide into each bay to unlock the next lot and finish all twelve with the fewest moves.",
    cover: { emoji: "🅿️", gradient: "from-slate-400 via-zinc-500 to-neutral-700" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Arrows / WASD", action: "Drive" },
      { keys: "D-pad", action: "Drive (touch)" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["puzzle", "parking", "precision"],
    score: { label: "Moves", mode: "low", kind: "moves" },
  },
  {
    slug: "slope-descent",
    title: "Slope Descent",
    category: "racing",
    tagline: "The slope gets steeper. You get faster.",
    description:
      "A pseudo-3D plunge down an endless mountain slope that accelerates the longer it holds together. Thread gate gaps, sweep up orbs for score, and dodge the barrier before speed wins.",
    cover: { emoji: "🎱", gradient: "from-lime-400 via-green-500 to-emerald-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "← / A", action: "Slope left" },
      { keys: "→ / D", action: "Slope right" },
      { keys: "Tap halves", action: "Slope left / right" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["endless", "dodge", "speed"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "rally-sprint",
    title: "Rally Sprint",
    category: "racing",
    tagline: "Cut the apex. Beat the clock.",
    description:
      "A top-down rally championship across four seeded stages of dirt hairpins and gate splits. Run each stage under par time, then chase the best total across the whole rally.",
    cover: { emoji: "🚙", gradient: "from-teal-400 via-cyan-500 to-sky-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "↑ / W", action: "Throttle" },
      { keys: "↓ / S", action: "Brake" },
      { keys: "← → / A D", action: "Steer" },
      { keys: "◀ ▶ ▲", action: "Touch buttons" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["rally", "time-trial", "drift"],
    score: { label: "Time", mode: "low", kind: "seconds" },
  },
  {
    slug: "formula-lap",
    title: "Formula Lap",
    category: "racing",
    tagline: "One flying lap. Beat the ghost.",
    description:
      "A top-down formula car on a tight technical circuit, chasing a flying lap against the ghost of your own best run. Every corner is a tenth gained or lost, and the delta bar never lies.",
    cover: { emoji: "🏎️", gradient: "from-sky-400 via-blue-500 to-indigo-600" },
    input: ["keyboard"],
    controls: [
      { keys: "↑ / W", action: "Throttle" },
      { keys: "↓ / S", action: "Brake" },
      { keys: "← → / A D", action: "Steer" },
      { keys: "R", action: "Instant restart" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["circuit", "time-trial", "ghost"],
    score: { label: "Best lap", mode: "low", kind: "ms" },
  },
  {
    slug: "bus-route",
    title: "Bus Route",
    category: "racing",
    tagline: "Next stop. Then the next.",
    description:
      "A city driving run where the timetable is the enemy. Pull into each stop inside the green ring while the schedule bar drains, chain on-time drops to build the combo, and never let the traffic eat your last rides.",
    cover: { emoji: "🚌", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "↑ / W", action: "Accelerate" },
      { keys: "↓ / S", action: "Brake" },
      { keys: "← → / A D", action: "Steer" },
      { keys: "D-pad", action: "Touch controls" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["driving", "combo", "schedule"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "night-outrun",
    title: "Night Outrun",
    category: "racing",
    tagline: "Neon horizon, no headlights.",
    description:
      "An endless neon highway run where the traffic never lifts its lights. Thread the gaps at three hundred, graze bumpers for near-miss bonuses, and bank a bonus every kilometre the horizon keeps giving you.",
    cover: { emoji: "🌃", gradient: "from-fuchsia-500 via-purple-500 to-indigo-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "← → / A D", action: "Steer" },
      { keys: "Tap halves", action: "Steer left / right" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["endless", "dodge", "neon"],
    score: { label: "Distance", mode: "high", kind: "points" },
  },
  {
    slug: "drag-sprint",
    title: "Drag Sprint",
    category: "racing",
    tagline: "Launch perfect. Shift perfect.",
    description:
      "A quarter-mile bracket where the Christmas tree decides everything. Hold the revs in the green band, launch on the last amber, and shift through three passes to put the lowest elapsed time on the board.",
    cover: { emoji: "💨", gradient: "from-pink-400 via-rose-500 to-red-400" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Space (hold)", action: "Rev & launch" },
      { keys: "↑ / Space", action: "Shift up" },
      { keys: "Tap buttons", action: "Rev & shift (touch)" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["drag-racing", "timing", "bracket"],
    score: { label: "Best ET", mode: "low", kind: "seconds" },
  },
  {
    slug: "derby-arena",
    title: "Derby Arena",
    category: "racing",
    tagline: "Last engine running wins.",
    description:
      "A demolition derby in a concrete bowl. Line up the rams, burn the boost meter into a rival's flank, and keep your hull above zero while the arena empties around you — every round brings hungrier cars.",
    cover: { emoji: "💥", gradient: "from-stone-400 via-neutral-500 to-zinc-700" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "↑ / W", action: "Throttle" },
      { keys: "↓ / S", action: "Reverse" },
      { keys: "← → / A D", action: "Steer" },
      { keys: "Space", action: "Boost ram" },
      { keys: "D-pad + Boost", action: "Touch controls" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["demolition", "combat", "arena"],
    score: { label: "Wrecks", mode: "high", kind: "points" },
  },
  {
    slug: "monster-ramp",
    title: "Monster Ramp",
    category: "racing",
    tagline: "Crush, launch, repeat.",
    description:
      "A monster truck with two axles and no sympathy. Launch off the desert ramps, hold the nose level in the air, and land on the parked cars instead of on the roof — a bad landing angle ends the run.",
    cover: { emoji: "🛻", gradient: "from-orange-500 via-red-500 to-rose-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "→ / D", action: "Gas" },
      { keys: "← / A", action: "Brake & tilt back" },
      { keys: "Tap halves", action: "Brake / gas" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["off-road", "physics", "jumps"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "snow-sled",
    title: "Snow Sled",
    category: "racing",
    tagline: "Sled fast. Pine trees don't move.",
    description:
      "One rider, one sled, and a mountain that keeps getting faster. Weave the pines, dodge the rocks and camps, and hit every amber kicker straight — the chasms only close behind you, and they pay forty points a jump.",
    cover: { emoji: "🛷", gradient: "from-teal-400 via-emerald-500 to-green-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "← / A", action: "Steer left" },
      { keys: "→ / D", action: "Steer right" },
      { keys: "Tap halves", action: "Steer left / right" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["downhill", "dodge", "endless"],
    score: { label: "Distance", mode: "high", kind: "points" },
  },
  {
    slug: "boat-slalom",
    title: "Boat Slalom",
    category: "racing",
    tagline: "Thread the gates. Fight the current.",
    description:
      "A speedboat run down a slaloming river where the current shoves sideways on every stroke. Thread each green gate in order, eat the penalties for skipping one or clipping a buoy, and get four escalating stages across the line fast.",
    cover: { emoji: "🛥️", gradient: "from-cyan-400 via-sky-500 to-blue-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "← / A", action: "Steer left" },
      { keys: "→ / D", action: "Steer right" },
      { keys: "↑ / W / Space", action: "Throttle" },
      { keys: "Tap ◀ ▶ / GAS", action: "Touch steering & throttle" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["slalom", "gates", "timed"],
    score: { label: "Time", mode: "low", kind: "seconds" },
  },
  {
    slug: "gymkhana-drift",
    title: "Gymkhana Drift",
    category: "racing",
    tagline: "Hold the slide. Stack the multiplier.",
    description:
      "A cone-strewn arena where the car never lifts off the throttle and the handbrake is the only steering that matters. The longer the slide, the higher the multiplier, but every cone and wall knocks it back to ×1 — glow through the rings for triple pay.",
    cover: { emoji: "🚗", gradient: "from-lime-400 via-emerald-500 to-teal-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "← / A", action: "Steer left" },
      { keys: "→ / D", action: "Steer right" },
      { keys: "Space", action: "Handbrake drift (hold)" },
      { keys: "Tap ◀ ▶ / DRIFT", action: "Touch steering & handbrake" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["drift", "combo", "timed"],
    score: { label: "Drift points", mode: "high", kind: "points" },
  },
  {
    slug: "wheelie-master",
    title: "Wheelie Master",
    category: "racing",
    tagline: "Front wheel up. Dignity intact.",
    description:
      "An endless course where holding the throttle lifts the front wheel instead of the speed. Keep the nose inside the green band of the angle bar to climb the multiplier, wheelie the cars and gaps, and duck under the signs — scrape the tail and the run is over.",
    cover: { emoji: "🏍️", gradient: "from-emerald-400 via-teal-500 to-cyan-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Hold ↑ / W / Space", action: "Lift the front wheel" },
      { keys: "Hold the screen", action: "Wheelie (touch)" },
      { keys: "Space", action: "Start & retry" },
    ],
    tags: ["wheelie", "balance", "endless"],
    score: { label: "Points", mode: "high", kind: "points" },
  },
  {
    slug: "traction-truck",
    title: "Traction Truck",
    category: "racing",
    tagline: "Eight stages. One very tippy cab.",
    description:
      "A rock-crawling truck over eight handcrafted stages of boulders, ledges and greasy mud. Feather the throttle to keep the suspension honest, use every green flag as a checkpoint, and pay eight seconds every time the cab goes over.",
    cover: { emoji: "🛻", gradient: "from-slate-400 via-zinc-500 to-neutral-700" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "→ / D", action: "Gas" },
      { keys: "← / A", action: "Brake & reverse" },
      { keys: "Tap REV / GAS", action: "Touch throttle" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["offroad", "physics", "stages"],
    score: { label: "Time", mode: "low", kind: "seconds" },
  },
  {
    slug: "rocket-sled",
    title: "Rocket Sled",
    category: "racing",
    tagline: "Fuel is just a number.",
    description:
      "A side-view rocket sled tearing down a bumpy ice track on a booster tank that drains fast and only trickles back while coasting. Ramps launch it sky-high: land flat for a free fuel-and-speed bonus, nose-dive into the ice and the run is over.",
    cover: { emoji: "🚀", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Hold Space", action: "Fire the booster" },
      { keys: "Hold screen / BOOST", action: "Fire the booster (touch)" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["rocket", "air-time", "endless"],
    score: { label: "Distance", mode: "high", kind: "points" },
  },
  {
    slug: "fuel-run",
    title: "Fuel Run",
    category: "racing",
    tagline: "Gas station or grass. Choose.",
    description:
      "A top-down endless highway where the fuel gauge is the real opponent and the throttle keeps draining it. Weave through traffic, chain near-misses for bonus metres, and grab every glowing jerrycan and gas station before the engine sputters and dies.",
    cover: { emoji: "⛽", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "← → / A D", action: "Steer across lanes" },
      { keys: "↑ / W", action: "Gas" },
      { keys: "Space", action: "Boost (burns fuel)" },
      { keys: "Tap ◀ ▶ / GAS", action: "Touch steering & throttle" },
      { keys: "Space / Enter", action: "Start & retry" },
    ],
    tags: ["highway", "fuel", "near-miss"],
    score: { label: "Distance", mode: "high", kind: "points" },
  },
  {
    slug: "zombie-siege",
    title: "Zombie Siege",
    category: "shooting",
    tagline: "They keep coming. You keep shooting.",
    description:
      "A top-down twin-stick stand against endless glowing zombie blobs. Clear each wave, grab supply drops, and pick an upgrade before the next horde breaks through.",
    cover: { emoji: "🧟", gradient: "from-lime-400 via-green-500 to-emerald-600" },
    input: ["keyboard", "mouse"],
    controls: [
      { keys: "WASD / Arrows", action: "Move" },
      { keys: "Mouse", action: "Aim" },
      { keys: "Click / hold", action: "Fire" },
      { keys: "Space", action: "Fire (alt)" },
    ],
    tags: ["twin-stick", "survival", "waves"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "quick-draw",
    title: "Quick Draw",
    category: "shooting",
    tagline: "See it. Click it. Forget it.",
    description:
      "A reflex target wall where red bullseyes flash up and shrink away in seconds. Chain pops for a growing multiplier — but a vanished target costs one of three lives.",
    cover: { emoji: "🎯", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Mouse click", action: "Shoot target" },
      { keys: "Tap", action: "Shoot target" },
    ],
    tags: ["reflex", "targets", "accuracy"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "target-rush",
    title: "Target Rush",
    category: "shooting",
    tagline: "Carnival lights. Zero plush prizes.",
    description:
      "A neon shooting gallery with ducks, armored bots, and triple-pay stars sliding on rails. Six rounds per magazine, rising speed, and a combo that shatters on a miss.",
    cover: { emoji: "🎪", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Mouse", action: "Aim" },
      { keys: "Click", action: "Shoot" },
      { keys: "Click (empty)", action: "Reload" },
      { keys: "Tap", action: "Shoot" },
    ],
    tags: ["gallery", "combo", "carnival"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "clay-shoot",
    title: "Clay Shoot",
    category: "shooting",
    tagline: "Lead the shot. Mind the wind.",
    description:
      "Skeet shooting against arcing orange clay discs launched from twin towers. Wind pushes every disc off line — break all 50 clays across two rounds for the top score.",
    cover: { emoji: "🥏", gradient: "from-sky-400 via-blue-500 to-indigo-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Mouse", action: "Aim" },
      { keys: "Click", action: "Fire" },
      { keys: "Tap", action: "Fire" },
    ],
    tags: ["skeet", "physics", "wind"],
    score: { label: "Hits", mode: "high", kind: "points" },
  },
  {
    slug: "sniper-range",
    title: "Sniper Range",
    category: "shooting",
    tagline: "Breathe. Squeeze. Ping.",
    description:
      "A scope-down marksmanship range where robot droids pop up between 100 and 800 meters. Steady your breathing, read the wind flag, and clear every stage before the clock.",
    cover: { emoji: "🔭", gradient: "from-stone-400 via-neutral-500 to-zinc-700" },
    input: ["mouse"],
    controls: [
      { keys: "Mouse", action: "Aim" },
      { keys: "Click", action: "Fire" },
      { keys: "Q / E or wheel", action: "Zoom" },
    ],
    tags: ["sniper", "precision", "breathing"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "jet-strike",
    title: "Jet Strike",
    category: "shooting",
    tagline: "Climb the sky. Clear the wave.",
    description:
      "A vertical neon shmup with always-hot guns, weaving drone formations, homing missiles from elites, and a pattern-bullet boss every fifth wave. Spread, rapid, and shield drops keep you alive.",
    cover: { emoji: "✈️", gradient: "from-blue-400 via-indigo-500 to-violet-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Arrows / WASD", action: "Move" },
      { keys: "Space", action: "Start / restart" },
      { keys: "Drag", action: "Move (touch)" },
    ],
    tags: ["shmup", "vertical", "powerups"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "heli-assault",
    title: "Heli Assault",
    category: "shooting",
    tagline: "Rotor loud. Aim loud.",
    description:
      "A side-scrolling helicopter strike over a hostile neon ridge. Bomb telegraphed turrets and tanks, thread the spike fields, and grab hull repairs as the terrain speeds up.",
    cover: { emoji: "🚁", gradient: "from-teal-400 via-cyan-500 to-sky-600" },
    input: ["keyboard", "mouse", "touch"],
    controls: [
      { keys: "Arrows / WASD", action: "Fly" },
      { keys: "Space", action: "Drop bomb" },
      { keys: "Drag", action: "Fly (touch)" },
      { keys: "💣 button", action: "Drop bomb (touch)" },
    ],
    tags: ["helicopter", "side-scroll", "bombs"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "ricochet",
    title: "Ricochet",
    category: "shooting",
    tagline: "Bank the shot off the walls.",
    description:
      "A neon puzzle-shooter where every ball banks off walls, erodes shields of blocks, and teleports through linked portals across 25 hand-laid rooms. Three bounces max before the shot fizzles — clear each room with the fewest total shots.",
    cover: { emoji: "🎱", gradient: "from-violet-500 via-purple-500 to-fuchsia-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Drag", action: "Aim & charge" },
      { keys: "Release", action: "Fire" },
      { keys: "Drag + release", action: "Aim & fire (touch)" },
    ],
    tags: ["bank-shot", "puzzle", "portals"],
    score: { label: "Shots", mode: "low", kind: "moves" },
  },
  {
    slug: "slime-arena",
    title: "Slime Arena",
    category: "shooting",
    tagline: "Goo them before they goo you.",
    description:
      "A neon arena brawl against five rival slimes for the throne. First to 12 gooey kills takes the round — but every round the bots aim sharper, move faster, and want the crown back.",
    cover: { emoji: "🟢", gradient: "from-lime-400 via-emerald-500 to-teal-600" },
    input: ["keyboard", "mouse"],
    controls: [
      { keys: "WASD / Arrows", action: "Move" },
      { keys: "Mouse", action: "Aim" },
      { keys: "Click", action: "Fire" },
    ],
    tags: ["arena", "brawl", "bots"],
    score: { label: "Kills", mode: "high", kind: "points" },
  },
  {
    slug: "ghost-hunter",
    title: "Ghost Hunter",
    category: "shooting",
    tagline: "Shoot when they glow.",
    description:
      "A haunted-window gallery where ghosts slowly fade in and out of sight. Fire only while they are fully materialized — a shot into a fading ghost costs one of three hearts, and red wraiths soak up two clean hits.",
    cover: { emoji: "🦇", gradient: "from-indigo-400 via-violet-500 to-purple-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Mouse", action: "Aim" },
      { keys: "Click", action: "Shoot" },
      { keys: "Tap", action: "Shoot" },
    ],
    tags: ["targets", "timing", "combo"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "balloon-burst",
    title: "Balloon Burst",
    category: "shooting",
    tagline: "Six shots. Infinite balloons.",
    description:
      "A night-sky popping spree with a six-round magazine and a one-second reload. Pop everything before it drifts off the top — golden balloons pay 5× and slow time, and center hits pay a bonus.",
    cover: { emoji: "🎊", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Mouse", action: "Aim" },
      { keys: "Click", action: "Pop balloon" },
      { keys: "Tap", action: "Pop balloon" },
    ],
    tags: ["balloons", "reflex", "magazine"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "bubble-storm",
    title: "Bubble Storm",
    category: "shooting",
    tagline: "Match three. Drop thirty.",
    description:
      "A full bubble shooter with a bouncing aim preview, a ceiling grid, and five escalating levels. Match three or more to pop them, cut clusters loose for drop bonuses, and clear the board before the ceiling crosses the danger line.",
    cover: { emoji: "🫧", gradient: "from-cyan-400 via-sky-500 to-blue-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Mouse drag", action: "Aim (bounces previewed)" },
      { keys: "Release / click", action: "Shoot" },
      { keys: "Touch drag", action: "Aim & release to shoot" },
    ],
    tags: ["bubble-shooter", "match-3", "aiming"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "pest-zap",
    title: "Pest Zap",
    category: "shooting",
    tagline: "Zap fast. Watch the blue.",
    description:
      "A 60-second kitchen counter extermination blitz. Roaches pay 10, silverfish pay 25, and frying a blue butterfly costs a heart — chain fast zaps for rising multipliers across endless escalating waves.",
    cover: { emoji: "🪳", gradient: "from-emerald-400 via-teal-500 to-cyan-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Mouse click", action: "Zap" },
      { keys: "Tap", action: "Zap" },
    ],
    tags: ["reflex", "combo", "waves"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "sub-hunt",
    title: "Sub Hunt",
    category: "shooting",
    tagline: "Lead the shot. Hear the ping.",
    description:
      "A top-down submarine hunt in fog-wreathed waters. Ping sonar to reveal merchant tonnage and enemy destroyers with lead lines, then guide slow torpedoes into where the ships are going — and dodge the depth charges answering back.",
    cover: { emoji: "🚢", gradient: "from-slate-400 via-zinc-500 to-neutral-700" },
    input: ["keyboard", "mouse", "touch"],
    controls: [
      { keys: "WASD / Arrows", action: "Move" },
      { keys: "Space", action: "Sonar ping" },
      { keys: "Click / Enter", action: "Fire torpedo" },
      { keys: "Drag + buttons", action: "Move & fire (touch)" },
    ],
    tags: ["submarine", "sonar", "torpedoes"],
    score: { label: "Tonnage", mode: "high", kind: "points" },
  },
  {
    slug: "stand-and-deliver",
    title: "Stand & Deliver",
    category: "shooting",
    tagline: "Stand still. Let the bow sing.",
    description:
      "A neon room-crawler where standing still charges an auto-firing bow at the nearest rogue machine. Dodge with WASD or a drag, clear room after room of chasers, shooters and spinners, and pick one of three upgrades each time.",
    cover: { emoji: "🏹", gradient: "from-orange-500 via-red-500 to-rose-600" },
    input: ["keyboard", "mouse", "touch"],
    controls: [
      { keys: "WASD / Arrows", action: "Move" },
      { keys: "Stand still", action: "Charge & auto-fire" },
      { keys: "Drag", action: "Move (touch)" },
      { keys: "Space / Enter", action: "Start / retry" },
    ],
    tags: ["auto-shooter", "dungeon", "upgrades"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "nest-defense",
    title: "Nest Defense",
    category: "shooting",
    tagline: "Guard the eggs. Lead the swoop.",
    description:
      "A neon nest-defense gallery where dive-bombing pterodactyls snatch eggs from three nests at a time. Snap fast shots, lead the swoop, and claim a perk every five cleared waves before the last egg vanishes.",
    cover: { emoji: "🥚", gradient: "from-teal-400 via-emerald-500 to-green-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Mouse", action: "Aim" },
      { keys: "Click", action: "Shoot" },
      { keys: "Tap", action: "Shoot" },
    ],
    tags: ["defense", "waves", "perks"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "drone-strike",
    title: "Drone Strike",
    category: "shooting",
    tagline: "Red means rogue. Call it down.",
    description:
      "A live drone feed over neon city blocks: rogue red robots patrol beneath blue civilian drones. Call the shell, wait out the 0.8-second fall, scoop dropped cores for upgrades, and never splash a civilian.",
    cover: { emoji: "🛰️", gradient: "from-fuchsia-500 via-purple-500 to-indigo-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Mouse", action: "Aim" },
      { keys: "Click", action: "Call shell" },
      { keys: "Tap", action: "Call shell" },
    ],
    tags: ["artillery", "precision", "cores"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "acorn-arc",
    title: "Acorn Arc",
    category: "shooting",
    tagline: "Bank the acorn. Crack the hive.",
    description:
      "A slingshot physics puzzler across 20 wind-blown levels: pull an acorn back, read the bounce off glowing walls, and smash every hive node in three shots. Fewer acorns spent means more stars banked.",
    cover: { emoji: "🐿️", gradient: "from-lime-400 via-green-500 to-emerald-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Drag", action: "Aim & charge" },
      { keys: "Release", action: "Fling" },
      { keys: "Touch drag + release", action: "Aim & fling" },
    ],
    tags: ["slingshot", "physics", "bank-shots"],
    score: { label: "Stars", mode: "high", kind: "points" },
  },
  {
    slug: "high-noon",
    title: "High Noon",
    category: "shooting",
    tagline: "Wait for the glow. Then draw.",
    description:
      "A neon standoff against a twitching robo-outlaw whose badge dims on every fake flinch. Click before the blazing gold glow and it's a foul — first to five round wins takes the duel, and his trigger finger tightens with every duel won.",
    cover: { emoji: "🤠", gradient: "from-stone-400 via-neutral-500 to-zinc-700" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Mouse click", action: "Draw" },
      { keys: "Tap", action: "Draw" },
    ],
    tags: ["duel", "reaction", "reflex"],
    score: { label: "Duels", mode: "high", kind: "points" },
  },
  {
    slug: "snowball-siege",
    title: "Snowball Siege",
    category: "shooting",
    tagline: "Pack hard. Throw farther.",
    description:
      "An endless winter siege where snowmen and elf-bots waddle down the hill and volley back at your five-HP fort. Drag to arc throws along the trajectory dots, hide behind a barricade that crumbles after three hits, and let dropped coins auto-buy next-wave perks.",
    cover: { emoji: "⛄", gradient: "from-teal-400 via-cyan-500 to-sky-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Drag", action: "Aim & charge" },
      { keys: "Release", action: "Throw" },
      { keys: "Touch drag + release", action: "Aim & throw" },
    ],
    tags: ["siege", "waves", "arc-physics"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "penalty-shootout",
    title: "Penalty Shootout",
    category: "sports",
    tagline: "Pick a corner. Hope he doesn't.",
    description:
      "A five-round neon shootout played from both ends: he charges a hold-to-strike at the corners while a keeper that studies his habits guards the other side, then he dives to save theirs. First to three takes it, sudden death after five, and the streak of rounds won runs straight through.",
    cover: { emoji: "⚽", gradient: "from-lime-400 via-green-500 to-emerald-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Aim + hold", action: "Charge the strike" },
      { keys: "Release", action: "Shoot" },
      { keys: "← ↓ → / click a third", action: "Dive when keeping" },
      { keys: "Space / Enter", action: "Start / retry" },
    ],
    tags: ["penalty", "shootout", "streak"],
    score: { label: "Streak", mode: "high", kind: "points" },
  },
  {
    slug: "keeper-wars",
    title: "Keeper Wars",
    category: "sports",
    tagline: "Eleven metres. Zero excuses.",
    description:
      "An endless penalty war where he dives left, right or stands tall to smother strikes from runners who feint, stutter and disguise their lean. Every five saves the tier tightens — shorter run-ups, faster flights, later tells — and the run ends the moment one gets past him.",
    cover: { emoji: "🧤", gradient: "from-emerald-400 via-teal-500 to-cyan-600" },
    input: ["keyboard", "mouse", "touch"],
    controls: [
      { keys: "← / →", action: "Dive" },
      { keys: "Click / tap a side", action: "Dive" },
      { keys: "Space / Enter", action: "Start / retry" },
    ],
    tags: ["goalkeeper", "reflex", "streak"],
    score: { label: "Saves", mode: "high", kind: "points" },
  },
  {
    slug: "hoop-rush",
    title: "Hoop Rush",
    category: "sports",
    tagline: "Five spots. Ninety seconds.",
    description:
      "A ninety-second neon shootout across five court spots — paint, wings and corners that pay a bonus on top of every three-pointer. Swishes build the streak, five in a row hand five seconds back on the clock, and the swinging meter gets twitchier the longer he lasts.",
    cover: { emoji: "🏀", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click / tap", action: "Shoot" },
      { keys: "Green band", action: "Swish window" },
      { keys: "Space / Enter", action: "Start / retry" },
    ],
    tags: ["basketball", "timed", "streak"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "putt-master",
    title: "Putt Master",
    category: "sports",
    tagline: "Read the break. Trust the line.",
    description:
      "Nine hand-drawn neon greens with doglegs, water that costs a stroke, sand that grabs the ball and slope wells that drag it off line. He drags back to aim, releases to putt, banks off the rails when the direct line refuses, and the lowest total over nine holes wins.",
    cover: { emoji: "⛳", gradient: "from-teal-400 via-emerald-500 to-green-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Drag back", action: "Aim & power" },
      { keys: "Release", action: "Putt" },
      { keys: "Space / Enter", action: "Start / retry" },
    ],
    tags: ["golf", "putting", "precision"],
    score: { label: "Strokes", mode: "low", kind: "moves" },
  },
  {
    slug: "bowling-blitz",
    title: "Bowling Blitz",
    category: "sports",
    tagline: "Ten frames. Zero gutter gifts.",
    description:
      "A two-click neon alley where the first click sets aim and power and the second bends the hook into the pocket. Ten frames of classic strike-and-spare scoring run on real pin physics — bonus-counting fills, proper tenth-frame rules and a perfect 300 if everything carries.",
    cover: { emoji: "🎳", gradient: "from-sky-400 via-blue-500 to-indigo-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Click 1", action: "Aim & power" },
      { keys: "Click 2", action: "Set the hook" },
      { keys: "Space / Enter", action: "Start / retry" },
    ],
    tags: ["bowling", "physics", "classic"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "archery-world",
    title: "Archery World",
    category: "sports",
    tagline: "Hold still. The wind won't.",
    description:
      "Five ranges from 10 to 90 metres where a swaying crosshair, a gusting wind and scope magnification all fight the shot — hold the draw too long and the aim drifts. Six arrows per round for 300 possible points, with quick draws up close and long, steady holds once the scope drops in.",
    cover: { emoji: "🏹", gradient: "from-lime-400 via-emerald-500 to-teal-600" },
    input: ["mouse"],
    controls: [
      { keys: "Mouse", action: "Aim" },
      { keys: "Hold", action: "Draw" },
      { keys: "Release", action: "Loose" },
      { keys: "Space / Enter", action: "Start / retry" },
    ],
    tags: ["archery", "wind", "precision"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "tennis-volley",
    title: "Tennis Volley",
    category: "sports",
    tagline: "One more rally. Just one.",
    description:
      "Top-down singles where the swing fires automatically on contact and the direction he moves decides where the ball lands. Release for a floating lob, hold to flatten a drive, bank points in a row — but drop one point and the match is over, with the opponent sharpening every five.",
    cover: { emoji: "🎾", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["keyboard", "mouse"],
    controls: [
      { keys: "WASD / Arrows", action: "Move & aim" },
      { keys: "Hold", action: "Drive" },
      { keys: "Tap / release", action: "Lob" },
      { keys: "Space / Enter", action: "Start / retry" },
    ],
    tags: ["tennis", "rally", "reflex"],
    score: { label: "Streak", mode: "high", kind: "points" },
  },
  {
    slug: "chin-check",
    title: "Chin Check",
    category: "sports",
    tagline: "Trade punches and read your rival's tells",
    description:
      "Boxers trade leather in a first-to-three bout where every jab is telegraphed by a shoulder twitch. Counter the tells, manage stamina, and sweep the cards before the final bell.",
    cover: { emoji: "🥊", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
    input: ["keyboard", "mouse", "touch"],
    controls: [
      { keys: "A / ←", action: "Throw left hook" },
      { keys: "D / →", action: "Throw right hook" },
      { keys: "S / ↓", action: "Guard up" },
      { keys: "Space", action: "Peek for tells" },
    ],
    tags: ["boxing", "timing", "duel"],
    score: { label: "Wins", mode: "high", kind: "points" },
  },
  {
    slug: "field-goal",
    title: "Field Goal",
    category: "sports",
    tagline: "Split the uprights as the wind howls",
    description:
      "A kicker lines up strikes from twenty yards out to the bomb range, with crosswinds that shift every snap. Two taps set the aim and the power — pure leg, pure nerve.",
    cover: { emoji: "🏈", gradient: "from-orange-500 via-red-500 to-rose-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Tap / Click", action: "Set aim angle" },
      { keys: "Tap / Click", action: "Lock in power" },
    ],
    tags: ["football", "precision", "arcade"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "cricket-slogger",
    title: "Cricket Slogger",
    category: "sports",
    tagline: "Smash a 30-ball chase under lights",
    description:
      "Thirty balls, three wickets, seventy-one to win — a T20 chase that comes down to the last over. Pick the gaps, punish the short stuff, and time the swing through the sweet spot.",
    cover: { emoji: "🏏", gradient: "from-blue-400 via-indigo-500 to-violet-600" },
    input: ["keyboard", "mouse", "touch"],
    controls: [
      { keys: "Space / Click / Tap", action: "Swing the bat" },
      { keys: "← / →", action: "Crease angle" },
      { keys: "↑", action: "Sky the loft" },
    ],
    tags: ["cricket", "timing", "sports"],
    score: { label: "Runs", mode: "high", kind: "points" },
  },
  {
    slug: "ski-jump",
    title: "Ski Jump",
    category: "sports",
    tagline: "Lean in, fly long, stick the landing",
    description:
      "Five trips down the inrun, each one measured against a living ghost jumper. Nail the takeoff lean, ride the wind, and hold the telemark when the slope rushes up.",
    cover: { emoji: "⛷️", gradient: "from-teal-400 via-cyan-500 to-sky-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "↓ / Tap", action: "Tuck for speed" },
      { keys: "↑ / Tap", action: "Lean up at takeoff" },
      { keys: "← / →", action: "Balance the landing" },
    ],
    tags: ["winter", "physics", "distance"],
    score: { label: "Best jump", mode: "high", kind: "points" },
  },
  {
    slug: "skate-trick",
    title: "Skate Trick",
    category: "sports",
    tagline: "Link lip tricks on a concrete wave",
    description:
      "A skater pumps a backyard halfpipe, grinding the coping and chaining flips into one endless combo. Bail once and the run stalls — stay clean to unlock the biggest rotations.",
    cover: { emoji: "🛹", gradient: "from-violet-500 via-purple-500 to-fuchsia-500" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Space / Tap", action: "Pump and ollie" },
      { keys: "← / →", action: "Flip and grind" },
      { keys: "↓", action: "Grab / land" },
    ],
    tags: ["skate", "combos", "90s"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "track-dash",
    title: "Track Dash",
    category: "sports",
    tagline: "Hammer the keys in perfect stride rhythm",
    description:
      "One hundred metres against the clock, where alternating key taps translate into raw stride frequency. Ride the rhythm window to keep stamina high and chase down the ghost in the lane next door.",
    cover: { emoji: "🏃", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "← / →", action: "Alternate strides" },
      { keys: "↑ / ↓", action: "Touch sprint" },
      { keys: "Hold", action: "Drive through the tape" },
    ],
    tags: ["track", "reflex", "speed"],
    score: { label: "Time", mode: "low", kind: "ms" },
  },
  {
    slug: "volley-king",
    title: "Volley King",
    category: "sports",
    tagline: "Bump, set, spike — first to 21",
    description:
      "A beach court rallies to twenty-one with bump-set-spike combos the whole way. Patient digs set up the perfect apex, and a frozen spike at the top of the arc simply cannot be returned.",
    cover: { emoji: "🏐", gradient: "from-cyan-400 via-sky-500 to-blue-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Space / Tap", action: "Bump, set, then spike" },
      { keys: "← / →", action: "Shuffle under the ball" },
      { keys: "Time the tap", action: "Strike at the apex" },
    ],
    tags: ["volleyball", "timing", "streak"],
    score: { label: "Streak", mode: "high", kind: "points" },
  },
  {
    slug: "stone-curl",
    title: "Stone Curl",
    category: "sports",
    tagline: "Sweep like you mean it.",
    description:
      "Four ends of neon curling against a rival skip. Drag back from the hack to set line and weight, then sweep while the stone travels to hold speed and flatten the curl. Closest stones to the button score the end, hog-line violations kill throws, and ties go to extra ends.",
    cover: { emoji: "🥌", gradient: "from-stone-400 via-neutral-500 to-zinc-700" },
    input: ["mouse", "keyboard", "touch"],
    controls: [
      { keys: "Drag / Release", action: "Set line and weight, throw" },
      { keys: "Hold S / Hold screen", action: "Sweep the stone" },
      { keys: "Space", action: "Start and restart" },
    ],
    tags: ["curling", "precision", "ice"],
    score: { label: "Score", mode: "high", kind: "points" },
  },
  {
    slug: "juggle-kings",
    title: "Juggle Kings",
    category: "sports",
    tagline: "Feet, head, thighs. Never the ground.",
    description:
      "A sixty-second soccer juggling run where every touch counts and every drop ends it. Contacts in the sweet zone pop the ball up clean, sloppy edges kick it sideways, and alternating foot, thigh and head completes flair rotations. Every ten touches the pop drops a little lower.",
    cover: { emoji: "🦶", gradient: "from-lime-400 via-emerald-500 to-teal-600" },
    input: ["keyboard", "touch"],
    controls: [
      { keys: "Space / Tap", action: "Touch the ball on the way down" },
      { keys: "Timing", action: "Meet it in the sweet zone for a clean pop" },
      { keys: "Rhythm", action: "Rotate foot, thigh and head for flair" },
    ],
    tags: ["soccer", "juggling", "reflex"],
    score: { label: "Touches", mode: "high", kind: "points" },
  },
  {
    slug: "sumo-showdown",
    title: "Sumo Showdown",
    category: "sports",
    tagline: "Breathe. Feint. Launch.",
    description:
      "Best-of-five pushing duels in a sand ring, where charging builds power but drains stamina. Release to drive the rival toward the straw bales, feint with a backward aim, and tap back the instant he commits to a counter throw. Win matches to face stronger rivals and build a streak.",
    cover: { emoji: "🤼", gradient: "from-amber-400 via-orange-500 to-red-500" },
    input: ["keyboard", "mouse", "touch"],
    controls: [
      { keys: "Hold Space / Hold button", action: "Charge the push" },
      { keys: "← / →", action: "Aim back or forward" },
      { keys: "Tap ← as he pushes", action: "Counter throw" },
    ],
    tags: ["sumo", "timing", "duel"],
    score: { label: "Wins", mode: "high", kind: "points" },
  },
  {
    slug: "disc-golf",
    title: "Disc Golf",
    category: "sports",
    tagline: "Hyzer round the pines.",
    description:
      "Nine holes of top-down disc golf with real flight behaviour. Drag back from the disc to set line and power, spin the dial for hyzer or anhyzer, and trust the fade as the disc slows. Trees kick the line, rough eats glide, and wind moves every hole. Finish under par for the best round.",
    cover: { emoji: "🥏", gradient: "from-teal-400 via-emerald-500 to-green-600" },
    input: ["mouse", "touch"],
    controls: [
      { keys: "Drag / Release", action: "Aim and throw the disc" },
      { keys: "Spin dial / ← →", action: "Set hyzer or anhyzer" },
      { keys: "Read the wind", action: "Compensate for breeze each hole" },
    ],
    tags: ["disc-golf", "precision", "physics"],
    score: { label: "Throws", mode: "low", kind: "moves" },
  },
  {
    slug: "fencing-bout",
    title: "Fencing Bout",
    category: "sports",
    tagline: "Parry. Riposte. Point.",
    description:
      "A first-to-five touches fencing duel where every rival attack telegraphs itself in colour. Match the guard to the flash to parry, then tap to riposte for the point. His lunge beats an unprepared fencer, and as the bouts roll on he learns your favourite guard and starts feinting around it.",
    cover: { emoji: "🤺", gradient: "from-slate-400 via-zinc-500 to-neutral-700" },
    input: ["keyboard", "mouse", "touch"],
    controls: [
      { keys: "J", action: "High parry (cyan attack)" },
      { keys: "K", action: "Low parry (amber attack)" },
      { keys: "L", action: "Lunge — beats unprepared, counters his lunge" },
      { keys: "Tap / Space", action: "Riposte during the window" },
    ],
    tags: ["fencing", "parry", "duel"],
    score: { label: "Touches", mode: "high", kind: "points" },
  },
  {
    slug: "dodgeball",
    title: "Dodgeball",
    category: "sports",
    tagline: "Duck first. Throw second.",
    description:
      "A two-set dodgeball duel where a hot throwing streak is the score and his throws arrive on a telegraphed red arc. Step aside or hold duck to dodge, and duck with a ball in the air to snatch a catch for instant ammo. Headshots double the streak, and each win brings a faster rival.",
    cover: { emoji: "🤾", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
    input: ["keyboard", "mouse", "touch"],
    controls: [
      { keys: "← / →", action: "Step across your half" },
      { keys: "Space", action: "Duck — and catch incoming throws" },
      { keys: "Click / Tap / F", action: "Throw at the rival" },
    ],
    tags: ["dodgeball", "reflex", "streak"],
    score: { label: "Streak", mode: "high", kind: "points" },
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

/** Resolves a curated slug list to games, skipping any stale slugs. */
export function gamesBySlugs(slugs: readonly string[]): Game[] {
  return slugs
    .map((slug) => getGame(slug))
    .filter((game): game is Game => game !== undefined);
}

export function gamesInCategory(slug: CategorySlug): Game[] {
  return games.filter((g) => g.category === slug);
}

/** Categories with at least one published game — empty ones stay hidden until their games ship. */
export const publishedCategories = categories.filter(
  (c) => gamesInCategory(c.slug).length > 0,
);

/* ------------------------------------------------------------------ */
/* Curated homepage shelves (hand-ordered editor picks)                */
/* ------------------------------------------------------------------ */

/** Games tiled in the hero arcade wall — a spread across genres. */
export const wallSlugs = [
  "snake",
  "moto-trial",
  "2048",
  "zombie-siege",
  "hoop-rush",
  "breakout",
  "night-outrun",
  "bubble-storm",
  "ski-jump",
  "reaction",
] as const;

/** "Popular right now" shelf — evergreen heavy-hitters. */
export const popularSlugs = [
  "snake",
  "breakout",
  "2048",
  "highway-rush",
  "zombie-siege",
  "penalty-shootout",
  "bubble-storm",
  "night-outrun",
] as const;

/** "Trending now" shelf — newer titles worth a spin. */
export const trendingSlugs = [
  "moto-trial",
  "rally-sprint",
  "slime-arena",
  "hoop-rush",
  "bowling-blitz",
  "clay-shoot",
  "ski-jump",
  "derby-arena",
] as const;

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
