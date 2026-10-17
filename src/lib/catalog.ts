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
