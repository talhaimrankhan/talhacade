"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const SIZE = 8;
const CELLS = SIZE * SIZE;
const TURNS_EACH = 10;
const TOTAL_TURNS = TURNS_EACH * 2;
const FREE_MIN = 14;
const TONE = "from-blue-400 via-indigo-500 to-violet-600";

/** Common 3–6 letter words; both sides hunt for these on the shared board. */
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

type Owner = 0 | 1 | 2;

interface Tile {
  id: number;
  ch: string;
  owner: Owner;
}

interface Move {
  cells: number[];
  word: string;
}

type Phase = "idle" | "playing" | "over";

const rowOf = (i: number) => Math.floor(i / SIZE);
const colOf = (i: number) => i % SIZE;

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

function makeBoard(idBox: { n: number }): Tile[] {
  for (let attempt = 0; attempt < 24; attempt++) {
    const letters: string[] = Array<string>(CELLS).fill("");
    const picks = shuffle(BANK);
    let placed = 0;
    for (let i = 0; i < picks.length && placed < 9; i++) {
      const word = picks[i];
      for (let t = 0; t < 24 && placed < 9; t++) {
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

    const board: Tile[] = [];
    for (let i = 0; i < CELLS; i++) {
      idBox.n += 1;
      board.push({
        id: idBox.n,
        ch: letters[i] !== "" ? letters[i] : randomLetter(),
        owner: 0,
      });
    }
    if (findBestMove(board)) return board;
  }

  const fallback: Tile[] = [];
  for (let i = 0; i < CELLS; i++) {
    idBox.n += 1;
    fallback.push({ id: idBox.n, ch: randomLetter(), owner: 0 });
  }
  return fallback;
}

/** Cells of the straight span from start to end, or null if it is crooked. */
function lineCells(start: number, end: number): number[] | null {
  const sr = rowOf(start);
  const sc = colOf(start);
  const dr = Math.sign(rowOf(end) - sr);
  const dc = Math.sign(colOf(end) - sc);
  const straight =
    sr === rowOf(end) ||
    sc === colOf(end) ||
    Math.abs(rowOf(end) - sr) === Math.abs(colOf(end) - sc);
  if (!straight) return null;

  const len = Math.max(Math.abs(rowOf(end) - sr), Math.abs(colOf(end) - sc)) + 1;
  const cells: number[] = [];
  for (let k = 0; k < len; k++) {
    cells.push((sr + dr * k) * SIZE + (sc + dc * k));
  }
  return cells;
}

/** Longest straight run of free tiles that spells a bank word. */
function findBestMove(board: Tile[]): Move | null {
  let best: Move | null = null;
  for (let i = 0; i < board.length; i++) {
    if (board[i].owner !== 0) continue;
    const r0 = rowOf(i);
    const c0 = colOf(i);
    for (let d = 0; d < DIRS.length; d++) {
      const dr = DIRS[d][0];
      const dc = DIRS[d][1];
      const letters: string[] = [];
      const cells: number[] = [];
      let r = r0;
      let c = c0;
      while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c].owner === 0) {
        letters.push(board[r * SIZE + c].ch);
        cells.push(r * SIZE + c);
        if (letters.length >= 3) {
          const word = letters.join("");
          if (WORDS.has(word) && (!best || cells.length > best.cells.length)) {
            best = { cells: cells.slice(), word };
          }
        }
        r += dr;
        c += dc;
      }
    }
  }
  return best;
}

function freeCount(board: Tile[]): number {
  let free = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i].owner === 0) free += 1;
  }
  return free;
}

function claimTiles(board: Tile[], cells: number[], who: Owner): Tile[] {
  const claimed = new Set(cells);
  const next: Tile[] = [];
  for (let i = 0; i < board.length; i++) {
    const tile = board[i];
    next.push(claimed.has(i) ? { id: tile.id, ch: tile.ch, owner: who } : tile);
  }
  return next;
}

export default function LetterClaim() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [board, setBoard] = useState<Tile[]>(() => {
    const list: Tile[] = [];
    for (let i = 0; i < CELLS; i++) list.push({ id: i, ch: "", owner: 0 });
    return list;
  });
  const [sel, setSel] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [turn, setTurn] = useState(1);
  const [mine, setMine] = useState(0);
  const [foe, setFoe] = useState(0);
  const [last, setLast] = useState<{ word: string; who: Owner } | null>(null);
  const [notice, setNotice] = useState("");
  const [jitter, setJitter] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("letter-claim", "high");

  const boardRef = useRef<Tile[]>([]);
  const turnRef = useRef(1);
  const mineRef = useRef(0);
  const foeRef = useRef(0);
  const selRef = useRef<number | null>(null);
  const idBox = useRef({ n: 1000 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (let i = 0; i < timers.current.length; i++) clearTimeout(timers.current[i]);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const flash = useCallback((text: string) => {
    setNotice(text);
    timers.current.push(setTimeout(() => setNotice(""), 1000));
  }, []);

  const shake = useCallback(() => {
    const offsets = [-7, 7, -4, 4, 0];
    for (let i = 0; i < offsets.length; i++) {
      const dx = offsets[i];
      timers.current.push(setTimeout(() => setJitter(dx), i * 50));
    }
  }, []);

  const finish = useCallback(() => {
    setPhase("over");
    setNewBest(submit(mineRef.current));
  }, [submit]);

  const advanceTurn = useCallback(() => {
    const next = turnRef.current + 1;
    if (next > TOTAL_TURNS) {
      finish();
      return;
    }
    turnRef.current = next;
    setTurn(next);
  }, [finish]);

  const refill = useCallback(() => {
    const fresh = makeBoard(idBox.current);
    boardRef.current = fresh;
    selRef.current = null;
    setBoard(fresh);
    setSel(null);
    flash("Board refilled!");
  }, [flash]);

  const settle = useCallback(() => {
    const board = boardRef.current;
    if (freeCount(board) < FREE_MIN || !findBestMove(board)) {
      refill();
      return;
    }
    if (selRef.current !== null && board[selRef.current].owner !== 0) {
      selRef.current = null;
      setSel(null);
    }
  }, [refill]);

  const applyClaim = useCallback(
    (cells: number[], who: Owner, word: string): boolean => {
      const next = claimTiles(boardRef.current, cells, who);
      boardRef.current = next;
      setBoard(next);
      setLast({ word, who });
      if (who === 1) {
        mineRef.current += cells.length;
        setMine(mineRef.current);
      } else {
        foeRef.current += cells.length;
        setFoe(foeRef.current);
      }
      return true;
    },
    [],
  );

  const aiTurn = useCallback(() => {
    const move = findBestMove(boardRef.current);
    if (move) applyClaim(move.cells, 2, move.word);
    settle();
    advanceTurn();
  }, [applyClaim, settle, advanceTurn]);

  useEffect(() => {
    if (phase !== "playing" || turn % 2 === 1) return;
    const id = setTimeout(() => aiTurn(), 700);
    return () => clearTimeout(id);
  }, [phase, turn, aiTurn]);

  const start = useCallback(() => {
    clearTimers();
    const fresh = makeBoard(idBox.current);
    boardRef.current = fresh;
    turnRef.current = 1;
    mineRef.current = 0;
    foeRef.current = 0;
    selRef.current = null;
    setBoard(fresh);
    setTurn(1);
    setMine(0);
    setFoe(0);
    setSel(null);
    setHover(null);
    setLast(null);
    setNotice("");
    setJitter(0);
    setNewBest(false);
    setPhase("playing");
  }, [clearTimers]);

  const onCellTap = useCallback(
    (i: number) => {
      if (phase !== "playing" || turnRef.current % 2 === 0) return;
      const tile = boardRef.current[i];
      const startIdx = selRef.current;

      if (startIdx === null) {
        if (tile.owner !== 0) return;
        selRef.current = i;
        setSel(i);
        return;
      }
      if (i === startIdx) {
        selRef.current = null;
        setSel(null);
        return;
      }
      selRef.current = null;
      setSel(null);
      if (tile.owner !== 0) return;

      const cells = lineCells(startIdx, i);
      if (!cells || cells.length < 3) {
        shake();
        return;
      }
      const word = cells.map((k) => boardRef.current[k].ch).join("");
      const rev = [...word].reverse().join("");
      if (!WORDS.has(word) && !WORDS.has(rev)) {
        shake();
        return;
      }
      for (let k = 0; k < cells.length; k++) {
        if (boardRef.current[cells[k]].owner !== 0) {
          shake();
          return;
        }
      }
      applyClaim(cells, 1, word);
      settle();
      advanceTurn();
    },
    [phase, applyClaim, settle, advanceTurn, shake],
  );

  const onCellEnter = useCallback((i: number) => {
    setHover(i);
  }, []);

  const preview = sel !== null && hover !== null && hover !== sel ? lineCells(sel, hover) : null;
  const previewSet = new Set(preview ?? []);
  const previewWord = preview ? preview.map((i) => board[i].ch).join("") : "";
  const previewValid =
    preview !== null &&
    preview.length >= 3 &&
    preview.every((i) => board[i].owner === 0) &&
    (WORDS.has(previewWord) ||
      WORDS.has([...previewWord].reverse().join("")));

  const turnLabel = turn % 2 === 1 ? "Your turn" : "CPU thinking";

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={mine} best={best ?? "—"}>
        <span className="text-sky-300">
          You <b className="ml-1 text-sm text-ink">{mine}</b>
        </span>
        <span className="text-rose-400">
          CPU <b className="ml-1 text-sm text-ink">{foe}</b>
        </span>
        <span>
          Turn <b className="ml-1 text-sm text-ink">{Math.min(turn, TOTAL_TURNS)}/{TOTAL_TURNS}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-2.5 shadow-[0_0_60px_-24px_rgba(99,102,241,0.7)] sm:p-3">
        <div
          onPointerLeave={() => setHover(null)}
          className="grid grid-cols-8 gap-1 transition-transform duration-75 [touch-action:manipulation]"
          style={{ transform: `translateX(${jitter}px)` }}
        >
          {board.map((tile, i) => {
            const onSel = i === sel;
            const onPrev = previewSet.has(i);
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => onCellTap(i)}
                onPointerEnter={() => onCellEnter(i)}
                aria-label={`Tile ${i + 1}: ${tile.ch || "empty"}`}
                className={cn(
                  "grid aspect-square place-items-center rounded-lg font-display text-base font-bold transition sm:text-lg",
                  tile.owner === 1
                    ? "bg-indigo-500 text-black shadow-[0_0_12px_-4px_rgba(99,102,241,0.9)]"
                    : tile.owner === 2
                      ? "bg-rose-500/85 text-black"
                      : previewValid && onPrev
                        ? "bg-violet-400/70 text-black"
                        : onPrev
                          ? "bg-violet-500/25 text-ink"
                          : onSel
                            ? "bg-amber-400 text-black"
                            : "bg-[#1a1a30] text-ink/90 hover:bg-[#232344]",
                )}
              >
                {tile.ch || "·"}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex h-8 items-center justify-center">
          {notice ? (
            <p className="animate-pop font-display text-sm font-bold text-accent">{notice}</p>
          ) : last ? (
            <p className="font-mono text-xs uppercase tracking-widest text-muted">
              {last.who === 1 ? "You claimed" : "CPU claimed"}{" "}
              <b className="text-ink">{last.word}</b>
            </p>
          ) : (
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">{turnLabel}</p>
          )}
        </div>

        {phase === "idle" && (
          <Overlay>
            <p className="text-4xl">⚔️</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              CLAIM THE BOARD
            </p>
            <p className="mt-2 text-sm text-muted">
              Tap the ends of a straight run of three or more tiles that spells a real word.
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              Start the match
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-gradient">
              {mine > foe ? "BOARD YOURS" : mine < foe ? "CPU TAKES IT" : "DEAD EVEN"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best haul!
              </p>
            )}
            <p className="mt-3 font-mono text-3xl font-bold text-white">
              <span className="text-sky-300">{mine}</span>
              <span className="mx-2 text-muted">vs</span>
              <span className="text-rose-400">{foe}</span>
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Tiles claimed · best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone={TONE}>
              New match
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap a free tile, then the last tile of the run · ten turns each · most tiles wins
      </p>
    </div>
  );
}
