"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const SIZE = 6;
const CELLS = SIZE * SIZE;
const RUN_SECONDS = 90;
const MAX_PATH = 10;
const TONE = "from-fuchsia-500 via-purple-500 to-indigo-600";

/** ~500 common words (3–6 letters); the pool is seeded straight from this. */
const BANK = (
  "ACE ACT ADD AGE AGO AID AIM AIR ALL AND ANT ANY APE ARC ARM ART ASH ASK ATE AWE BAD BAG " +
  "BAN BAR BAT BAY BED BEE BET BID BIG BIN BIT BOW BOX BOY BUN BUS BUT BUY CAB CAN CAP CAR " +
  "CAT COD COP COW CRY CUB CUP CUT DAM DAY DEN DEW DID DIE DIG DIM DIP DOG DOT DRY DUB DUE " +
  "DUG DYE EAR EAT EEL EGG ELF ELM END ERA EVE EYE FAN FAR FAT FED FEE FEW FIG FIN FIR FIT " +
  "FIX FLY FOE FOG FOR FOX FUN FUR GAG GAP GAS GEL GEM GET GIN GOD GOT GUM GUN GUY HAD HAM " +
  "HAS HAT HEN HER HID HIM HIP HIS HIT HOG HOP HOT HOW HUB HUE HUG HUM HUT ICE ILL INK ION " +
  "IVY JAB JAM JAW JET JOB JOG JOY KEY KID KIN KIT LAB LAD LAG LAP LAW LAY LED LEG LET LID " +
  "LIE LIP LOG LOT LOW MAD MAN MAP MAR MAT MAY MEN MET MID MIX MOB MOP MUD MUG NAG NAP NET " +
  "NEW NOD NOR NOT NOW NUT OAK OAR ODD OFF OLD ONE OPT ORB ORE OUR OUT OWL PAD PAN PAR PAT " +
  "PAW PAY PEA PEG PEN PET PIG PIN PIT POD POP POT PRO PRY PUB PUN PUP PUT RAG RAM RAN RAP " +
  "RAT RAW RAY RED RIB RID RIG RIM RIP ROB ROD ROT ROW RUE RUG RUN RYE SAD SAG SAP SAT SAW " +
  "SAY SEA SET SEW SHE SHY SIN SIP SIR SIT SIX SKI SKY SLY SOB SON SOY SPA SPY SUM SUN TAB " +
  "TAG TAN TAP TAR TAX TEA TEN THE TIE TIN TIP TOE TON TOO TOP TOW TOY TRY TUB TUG TWO USE " +
  "VAN VAT VET VIA VIE WAR WAS WAX WAY WEB WET WHO WHY WIN WIT WOE WON WOW YAK YAM YAP YES " +
  "YET YOU ZIP ZOO APPLE BEACH BREAD BRICK BRING BRUSH CABLE CAMEL CANDY CARRY CHAIR CHARM " +
  "CHASE CHEAP CHECK CHEST CHIEF CHILD CHUNK CLEAN CLEAR CLIMB CLOCK CLOUD COAST CORAL COUNT " +
  "COURT COVER CRAFT CRANE CRASH CREAM CREEK CRISP CROWN DANCE DIARY DREAM DRINK DRIVE EAGLE " +
  "EARTH FAIRY FIELD FLAME FLOOR FRAME FRESH FRUIT GHOST GIANT GLASS GLOBE GLOVE GRACE GRAIN " +
  "GRASS GREEN GRILL GUARD HONEY HORSE HOUSE HUMAN IDEAL IMAGE IVORY JELLY JUICE KNIGHT " +
  "LADDER LEMON LIGHT LIZARD MAGIC MANGO MELON MERCY METER MIRROR MONEY MONTH MOUSE MUSIC " +
  "NIGHT NOISE OCEAN OLIVE ORBIT ORGAN PAINT PAPER PARTY PASTA PEACH PEARL PIANO PILLOW " +
  "PLANE PLATE QUEST QUICK QUIET RADIO RAISE RIVER ROAST ROBOT ROUND ROUTE ROYAL SCALE SCENE " +
  "SCORE SHELL SHORE SIGHT SKILL SMILE SNAKE SOLAR SOUND SPACE SPARK SPICE STONE STORM STORY " +
  "SUGAR TABLE TIGER TOAST TOKEN TOWER TRAIN TREAT TRIAL TRUNK TURTLE UNION VALID VALUE " +
  "VIDEO WATER WHEAT WHEEL WORLD YEAST ZEBRA ANCHOR BASKET BEAVER BERRY BLANK BLOOM BONUS " +
  "BRANCH BREEZE BRIDGE BROOM BUCKET BUNNY BUTTON CACTUS CAMERA CANDLE CARPET CELERY CHERRY " +
  "CLIFF CLOVER COBRA COMET COPPER CORNER COTTON CRADLE DOLPHIN DONUT DRAGON ENGINE FABLE " +
  "FEATHER FINGER FLASK FLUTE FROST FUTURE GARDEN GARNET GATEWAY GECKO GINGER GLIDER HAMMER " +
  "HARVEST HARBOR HOLLOW IGLOO ISLAND JACKET JAGUAR JUNGLE KETTLE KIWI LANTERN LEAFY LIBRARY " +
  "LION LYNX MARBLE MEADOW MEDAL MONKEY MOON NATURE NINJA NOODLE OTTER PANDA PEBBLE PENCIL " +
  "PENGUIN PEPPER PHOENIX PIRATE PIZZA PLAZA POCKET POLAR POND PORCH POSSUM PRISM PUPPY QUEEN " +
  "QUARTZ RABBIT RACCOON RAINY ROCKET RUBBER SAFARI SCARF SCOUT SHADOW SHIP SIEGE SKATES " +
  "SKULL SLEIGH SLOTH SPIDER SPONGE SQUID STAMP STAPLE STOVE STRAW SUMMER SUNSET SWAMP " +
  "SWEATER TEMPLE THUNDER TOFU TOMATO TORCH TOWEL TRACTOR TROPHY ULTRA VALLEY VELVET WALNUT " +
  "WALRUS WINTER WIZARD ZIGZAG"
)
  .trim()
  .split(/\s+/);

const WORDS = new Set(BANK);

/** Common-letter weighted pool so refills keep producing real words. */
const POOL =
  "EEEEEEEEEEEEAAAAAAAAIIIIIIIIOOOOOOONNNNNNRRRRRRTTTTTLLLLSSSSUUUUDDDDGGG" +
  "BBBBCCCCMMMMPPPPFFFFHHHHVVVVWWWWYYYYKKKXXXJJQQZZ";

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [-1, -1],
];

interface Tile {
  id: number;
  ch: string;
}

type Phase = "idle" | "playing" | "over";

const BLANK: Tile[] = (() => {
  const list: Tile[] = [];
  for (let i = 0; i < CELLS; i++) list.push({ id: i, ch: "" });
  return list;
})();

const EMPTY_PATH: number[] = [];

function shuffle<T>(list: T[]): T[] {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function randomLetter(): string {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

/** Drops a few real words into the empty grid so the opening board is rich. */
function seedWords(letters: string[]): void {
  const picks = shuffle(BANK);
  let placed = 0;
  for (let i = 0; i < picks.length && placed < 7; i++) {
    const word = picks[i];
    for (let attempt = 0; attempt < 24; attempt++) {
      const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      const er = r + dir[0] * (word.length - 1);
      const ec = c + dir[1] * (word.length - 1);
      if (er < 0 || er >= SIZE || ec < 0 || ec >= SIZE) continue;
      let ok = true;
      for (let k = 0; k < word.length; k++) {
        const cell = (r + dir[0] * k) * SIZE + (c + dir[1] * k);
        if (letters[cell] !== "" && letters[cell] !== word[k]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let k = 0; k < word.length; k++) {
        letters[(r + dir[0] * k) * SIZE + (c + dir[1] * k)] = word[k];
      }
      placed += 1;
      break;
    }
  }
}

function makeBoard(idBox: { n: number }): Tile[] {
  const letters: string[] = Array<string>(CELLS).fill("");
  seedWords(letters);
  const board: Tile[] = [];
  for (let i = 0; i < CELLS; i++) {
    idBox.n += 1;
    board.push({
      id: idBox.n,
      ch: letters[i] !== "" ? letters[i] : randomLetter(),
    });
  }
  return board;
}

function adjacent(a: number, b: number): boolean {
  const dr = Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE));
  const dc = Math.abs((a % SIZE) - (b % SIZE));
  return dr <= 1 && dc <= 1 && dr + dc > 0;
}

/** Empties the wiped cells (tiles keep their ids so they can fall). */
function blankCells(board: Tile[], cells: number[]): Tile[] {
  const wiped = new Set(cells);
  const next: Tile[] = [];
  for (let i = 0; i < board.length; i++) {
    const tile = board[i];
    next.push(wiped.has(i) ? { id: tile.id, ch: "" } : tile);
  }
  return next;
}

/** Tiles fall to the bottom of their column, gaps refill from the top. */
function collapse(board: Tile[], idBox: { n: number }): Tile[] {
  const next: (Tile | null)[] = [];
  for (let i = 0; i < board.length; i++) next.push(board[i].ch === "" ? null : board[i]);
  for (let c = 0; c < SIZE; c++) {
    const stack: Tile[] = [];
    for (let r = SIZE - 1; r >= 0; r--) {
      const tile = next[r * SIZE + c];
      if (tile) stack.push(tile);
    }
    for (let r = SIZE - 1; r >= 0; r--) {
      const k = SIZE - 1 - r;
      if (k < stack.length) {
        next[r * SIZE + c] = stack[k];
      } else {
        idBox.n += 1;
        next[r * SIZE + c] = { id: idBox.n, ch: randomLetter() };
      }
    }
  }
  return next as Tile[];
}

function basePoints(len: number): number {
  if (len === 3) return 10;
  if (len === 4) return 25;
  if (len === 5) return 50;
  return 100;
}

export default function WordWipe() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [board, setBoard] = useState<Tile[]>(BLANK);
  const [path, setPath] = useState<number[]>(EMPTY_PATH);
  const [badPath, setBadPath] = useState<number[]>(EMPTY_PATH);
  const [score, setScore] = useState(0);
  const [mult, setMult] = useState(1);
  const [timeLeft, setTimeLeft] = useState(RUN_SECONDS);
  const [gain, setGain] = useState<{ word: string; pts: number } | null>(null);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("word-wipe", "high");

  const boardRef = useRef<Tile[]>(BLANK);
  const pathRef = useRef<number[]>(EMPTY_PATH);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const timeRef = useRef(RUN_SECONDS);
  const idBox = useRef({ n: 0 });
  const dragging = useRef(false);
  const busy = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (let i = 0; i < timers.current.length; i++) clearTimeout(timers.current[i]);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      timeRef.current -= 1;
      setTimeLeft(timeRef.current);
      if (timeRef.current <= 0) {
        setPhase("over");
        setNewBest(submit(scoreRef.current));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, submit]);

  const start = useCallback(() => {
    clearTimers();
    const fresh = makeBoard(idBox.current);
    boardRef.current = fresh;
    pathRef.current = EMPTY_PATH;
    scoreRef.current = 0;
    streakRef.current = 0;
    timeRef.current = RUN_SECONDS;
    busy.current = false;
    setBoard(fresh);
    setPath(EMPTY_PATH);
    setBadPath(EMPTY_PATH);
    setScore(0);
    setMult(1);
    setTimeLeft(RUN_SECONDS);
    setGain(null);
    setNewBest(false);
    setPhase("playing");
  }, [clearTimers]);

  const resolve = useCallback(() => {
    const sel = pathRef.current;
    pathRef.current = EMPTY_PATH;
    setPath(EMPTY_PATH);
    if (phase !== "playing" || sel.length === 0) return;

    if (sel.length >= 3) {
      const word = sel.map((i) => boardRef.current[i].ch).join("");
      const rev = [...word].reverse().join("");
      if (WORDS.has(word) || WORDS.has(rev)) {
        streakRef.current += 1;
        const nextMult = Math.min(5, 1 + Math.floor(streakRef.current / 2));
        const pts = basePoints(word.length) * nextMult;
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setMult(nextMult);
        setGain({ word, pts });
        const blanked = blankCells(boardRef.current, sel);
        boardRef.current = blanked;
        setBoard(blanked);
        busy.current = true;
        timers.current.push(
          setTimeout(() => {
            const settled = collapse(boardRef.current, idBox.current);
            boardRef.current = settled;
            busy.current = false;
            setBoard(settled);
          }, 150),
        );
        return;
      }
    }

    if (sel.length >= 3) {
      streakRef.current = 0;
      setMult(1);
      setBadPath(sel);
      timers.current.push(setTimeout(() => setBadPath(EMPTY_PATH), 460));
    }
  }, [phase]);

  const cellFromPoint = (x: number, y: number): number | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cell = rect.width / SIZE;
    const r = Math.floor((y - rect.top) / cell);
    const c = Math.floor((x - rect.left) / cell);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
    return r * SIZE + c;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== "playing" || busy.current) return;
    const i = cellFromPoint(e.clientX, e.clientY);
    if (i === null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    pathRef.current = [i];
    setPath([i]);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const i = cellFromPoint(e.clientX, e.clientY);
    if (i === null) return;
    const cur = pathRef.current;
    if (cur.length === 0) return;
    const tail = cur.length - 1;
    if (cur[tail] === i) return;
    const at = cur.indexOf(i);
    if (at === tail - 1) {
      const next = cur.slice(0, tail);
      pathRef.current = next;
      setPath(next);
      return;
    }
    if (at >= 0) return;
    if (!adjacent(cur[tail], i) || cur.length >= MAX_PATH) return;
    const next = cur.concat(i);
    pathRef.current = next;
    setPath(next);
  };

  const endDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    resolve();
  }, [resolve]);

  const pathSet = new Set(path);
  const badSet = new Set(badPath);
  const head = path.length > 0 ? path[0] : -1;
  const tail = path.length > 0 ? path[path.length - 1] : -1;
  const spelled = path.map((i) => board[i].ch).join("");

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-fuchsia-300">
          ×<b className="ml-1 text-sm text-ink">{mult}</b>
        </span>
        <span className={timeLeft <= 10 ? "text-rose-400" : ""}>
          Time{" "}
          <b className="ml-1 text-sm text-ink tabular-nums">{Math.max(0, timeLeft)}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-2.5 shadow-[0_0_60px_-22px_rgba(217,70,239,0.75)] sm:p-3">
        <div
          ref={gridRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="application"
          aria-label="Letter pool. Press and drag across neighbouring letters to spell a word."
          className="grid grid-cols-6 gap-1.5 [touch-action:none] select-none"
        >
          {board.map((tile, i) => {
            const onPath = pathSet.has(i);
            const onBad = badSet.has(i);
            const isEnd = i === head || i === tail;
            return (
              <div
                key={tile.id}
                aria-hidden
                className={cn(
                  "animate-pop grid aspect-square place-items-center rounded-xl font-display text-xl font-bold sm:text-2xl",
                  onBad
                    ? "bg-rose-500 text-white"
                    : onPath
                      ? isEnd
                        ? "bg-fuchsia-400 text-black"
                        : "bg-fuchsia-500/45 text-ink"
                      : "bg-[#1a1a30] text-ink/90",
                )}
              >
                {tile.ch || "·"}
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex h-8 items-center justify-center">
          {gain ? (
            <p key={gain.pts + gain.word} className="animate-pop font-display text-sm font-bold text-fuchsia-300">
              {gain.word} <span className="text-warn">+{gain.pts}</span>
            </p>
          ) : (
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
              {spelled || "drag to spell"}
            </p>
          )}
        </div>

        {phase === "idle" && (
          <Overlay>
            <p className="text-4xl">🧹</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient-hot">
              WIPE THE POOL
            </p>
            <p className="mt-2 text-sm text-muted">
              Drag across touching letters — release on a real word of three or more to clear it.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start wiping
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">TIME&apos;S UP</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Wipe again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Drag through touching tiles · miss and the combo resets · chain clean wipes up to ×5
      </p>
    </div>
  );
}
