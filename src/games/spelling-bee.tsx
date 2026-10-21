"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

/**
 * Every accepted word lives here. Validation at round start filters this
 * bank down to the words the current hive can spell — so guessing is
 * instant and needs no dictionary service.
 */
const BANK = (
  "ace act add age ago aid ail aim air ale all and ant any ape apt arc are arm art ash ask ate awe axe " +
  "bad bag ban bar bat bay bed bee beg bet bid big bin bit boa bog bow box boy bra bud bug bun bus but buy " +
  "cab can cap car cat cob cod cog cop cot cow cry cub cue cup cut dad dam day den dew did dig dim din dip " +
  "dog dot dry dub dud due dug duo dye ear eat ebb eel egg ego elf elk elm end era erg eve ewe eye fan far " +
  "fat fax fed fee few fig fin fir fit fix flu fly fog for fox fry fun fur gag gap gas gel gem get gig gin " +
  "gnu goo got gum gun gut guy gym had hag ham has hat hay hem hen her hew hex hid him hip his hit hoe hog " +
  "hop hot how hub hue hug hum hut ice icy ilk imp ink inn ion ire irk its ivy jab jam jar jaw jay jet jig " +
  "job jog jot joy jug jut keg key kid kin kit lab lad lag lap law lax lay led leg let lid lie lip lit lob " +
  "log lot low lug mad man map mar mat maw may men met mid mix mob mod mop mow mud mug net new nib nil nip " +
  "nod nor not now nun nut oak oar oat odd ode off oft oil old one opt orb ore our out owe owl own pad pal " +
  "pan par pat paw pay pea peg pen pep per pet pew pie pig pin pit ply pod pop pot pro pry pub pug pun pup " +
  "put rag ram ran rap rat raw ray red rib rid rig rim rip rob rod roe rot row rub rue rug rum run rut rye " +
  "sad sag sap sat saw say sea see set sew she shy sin sip sir sit six ski sky sly sob sod son sop sow soy " +
  "spa spy sty sub sue sum sun sup tab tad tag tan tap tar tax tea ten the tie tin tip toe ton too top tot " +
  "tow toy try tub tug tux two urn use van vat vet via vie vow wad wag war was wax way web wed wee wet who " +
  "why wig win wit woe wok won woo wow wry yak yam yap yaw yea yes yet yew yip you zap zip zoo " +
  "able ache acid acre agent alarm album alert alien alive alley allow alone amber amble amount angel angle " +
  "ankle apple apply arena argue arise armor arrow aside asset atlas attic audio audit avoid awake award " +
  "aware awful bacon badge badly bagel baker ballad ballet banana banner barber barely barrel basin basis " +
  "batch bath beach beacon beam bean bear beat become before begin behalf behave behind belief belong berry " +
  "beside birch birth bishop bitter blank blast blaze bleed blend bless blind blink bliss block blond blood " +
  "bloom blown bluff blush board boast bonus boost booth bound brain branch brass brave bread break breed " +
  "brick bride brief bring broad broke brook broom brown brush buddy budget buffet bundle bunker burden " +
  "bureau burial burly butter buyer cabin cable cactus camel cameo canal candle candy canoe canon caper " +
  "cargo carol carry carve cash castle cave cedar cement census chain chair chalk champ chant chaos charm " +
  "chart chase cheap cheat check cheek cheer chess chest chick chief child chill choir choke chord chorus " +
  "chrome chunk cider cigar civic civil claim clamp clash clasp class clean clear clerk click cliff climb " +
  "cling cloak clock clone close cloth cloud clout clown coach coast cobra cocoa colon color comet comic " +
  "comma coral couch cough could count court cover crack craft crane crash crawl crazy cream creed creek " +
  "crest cried crime crisp cross crowd crown crude cruel crumb crush crust crypt cubic cumin curb cure curl " +
  "curry curse curve cycle daily dairy daisy dance dandy dealt death debit debut decal decay decoy delay " +
  "delta deluxe demon denim dense depot depth derby deter devil diary diesel diet dime dizzy dodge donor " +
  "donut doubt dough dowel dozen draft drain drama drank drape drawl drawn dread dream dress dried drift " +
  "drill drink drive drone drool droop drove drown drunk dryer duck duel duet duke dull dumb dune dusk dust " +
  "duty dwarf dwell dying eager eagle early earth easel eaten eater ebony edict eight elbow elder elect " +
  "elite elope elude email empty enact ended endow enemy enjoy enter entry equal equip erase error erupt " +
  "essay evade event every evict evoke exact exalt excel exert exile exist expel extra fable faced faint " +
  "fairy faith false fancy fatal fault favor feast fence ferry fetch fever fiber field fiend fiery fifth " +
  "fifty fight file fine finch finer first fish fist five flag flap flat flaw flea fled flee flew flex flip " +
  "flit flood floor flora floss flour flown fluid flung flush flute flyer foamy focal focus foggy force " +
  "forge forgo forth forty forum found frame frank fraud freak freed fresh fried frill frisk front frost " +
  "froth frown froze fruit fudge fully fungi funky funny furry fuzzy gadget galaxy gallop gamble garage " +
  "garbage garden garlic garnet gather gaudy gavel gaze gecko genie genre ghost giant giddy girth given " +
  "giver glade gland glare glass glaze gleam glean glide glint gloat globe gloom glory gloss glove glow " +
  "glue gnat goal goat gold golf gone gong good gooey goofy goose gorge gouge gourd grace grade grain " +
  "grand grant grape graph grasp grass grate grave gravy graze great greed green greet grief grill grind " +
  "gripe groan groom grope gross group grout grove growl grown gruel gruff grunt guard guess guest guide " +
  "guild guilt guise gulch gully gummy gusto gusty gypsy habit hairy halve handy happy hardy harem harsh " +
  "haste hasty hatch haunt haven havoc hazel head heal heap hear heart heat hefty heist hello hence herd " +
  "hero hidden hiking hind hinge hint hippo hitch hoard hobby hoist holly honey honor horde horse hotel " +
  "hound house hover human humid humor hunch hurry husky hutch hyena ideal idiom idler igloo image imbue " +
  "impel imply inane inbox incur index inert infer ingot inlet inner input intro irate irony islet issue " +
  "ivory jaunt jeans jelly jewel joint joker jolly judge juice juicy jumbo juror kayak keep kept khaki " +
  "kiosk kite kiwi knee kneel knife knit knob knock knot known koala label labor laden ladle lager lance " +
  "lanky lapel lapse large larva latch later latex latte laugh layer leach leak lean leap learn lease " +
  "leash least leave ledge legal lemur lemon level lever light liken lilac limbo limit linen liner lingo " +
  "liver llama loaf loan lobby local lodge lofty logic login loose lorry loser lotus louse loved lover " +
  "lower loyal lucid lucky lumpy lunar lunch lunge lurch lurid lyric macro madam magic magma maize major " +
  "maker mambo mamma mango mania manic maple march marry marsh mason match maxim maybe mayor mealy meaty " +
  "medal media medic melon mercy merge merry messy metal meter micro midst might mimic mince miner minor " +
  "minus mirth miser mixed mixer modal model modem moist molar moldy money month moody moral moron morph " +
  "mossy motel motion muddy muffle mummy munch mural murky mushy music musky musty muted nacho nadir " +
  "naive naked nanny nasal nasty naval navel needy nerdy nerve never newer newly niche niece night ninja " +
  "ninth noble nobly noise noisy nomad north notch noted novel nudge nurse nutty nylon nymph oasis occur " +
  "ocean often olive omega onion onset opera optic orbit order organ other otter ought ounce outdo outer " +
  "oval over oxid ozone paced paint pale palsy panel panic pansy pants papal paper parka parry parse " +
  "party pasta paste patch patio patty pause paved payer peace peach pearl pecan pedal penal pence penny " +
  "peony perch peril perky pesky pesto petal petty phase phone photo piano picky piece piety piggy pilot " +
  "pinch piney pinky pipe pity pixel pizza place plaid plain plait plane plank plant plate plaza plead " +
  "pleat plus poem poet point poise poker polar polka polyp pooch poppy porch pouch pound power prank " +
  "prawn press price prick pride pried prime print prior prism privy prize probe prone prong proof prose " +
  "proud prove prowl prune psalm pudgy puffy pulse punch pupil puppy puree purge purse pushy putty quack " +
  "quail quake qualm quart quash quasi queen quell query quest queue quick quiet quill quilt quirk quite " +
  "quota quote rabbi racer radar radio rainy raise rally ramen ranch range rapid ratty raven razor reach " +
  "react ready realm rebel recur refer regal rehab reign relax relay relic remit renal renew repay repel " +
  "reply rerun reset resin retro reuse revel rhino rhyme rider ridge rifle right rigid rigor rinse ripen " +
  "riser risen risky rival river roach roast robin robot rocky rodeo rogue roomy roost rotor rouge rough " +
  "round rouse route rover rowdy royal ruddy ruler rumor rural sadly safer saint salad salon salsa salty " +
  "sandy sassy satin sauce saucy sauna saved savor savvy scald scale scalp scaly scamp scant scare scarf " +
  "scary scene scent scoff scold scoop scoot scope score scorn scour scout scowl scrap screw scrum scuba " +
  "sedan seedy seize sense serve seven sever sewer shade shady shaft shake shaky shale shall shame shape " +
  "shard share shark sharp shave shawl shear sheen sheep sheer sheet shelf shell shied shift shine shiny " +
  "shire shirt shoal shock shone shook shoot shore short shout shove shown showy shred shrub shrug shuck " +
  "shunt shush siege sieve sight sigma silky silly since sinew singe siren sixth sixty sized skate skier " +
  "skiff skill skimp skirt skulk skull skunk slack slain slang slant slash slate sleek sleep sleet slept " +
  "slice slick slide slime slimy sling slink sloop slope slosh sloth slump slung slurp slush small smart " +
  "smash smear smell smelt smile smirk smite smoke smoky snack snail snake snare snarl sneak sneer snide " +
  "sniff snipe snoop snore snort snout snowy snuck soapy sober solar solid solve sonar sonic sooty sorry " +
  "sound south space spade spare spark spasm spawn speak spear speck speed spell spend spent spice spicy " +
  "spied spike spiky spill spilt spine spiny spire spite splat split spoil spoke spoof spook spool spoon " +
  "spore sport spout spray spree sprig spurn spurt squad squat squid stack staff stage staid stain stair " +
  "stake stale stalk stall stamp stand stank stare stark start stash state stave steak steal steam steed " +
  "steel steep steer stein stern stick stiff still stilt sting stink stint stock stoic stoke stole stomp " +
  "stone stony stood stool stoop store stork storm story stout stove strap straw stray strip strut stuck " +
  "study stuff stump stung stunk stunt style suave sugar suite sulky sully sumac sunny surly sushi swami " +
  "swamp swank swarm swath swear sweat sweep sweet swell swept swift swill swine swing swipe swirl swish " +
  "swoop sword swore sworn swung table taboo tacit tacky taffy taken taker tally talon tamer tango tangy " +
  "taper tapir tardy tarot taste tasty taunt tawny teach tease teddy teeth tempo tenet tenor tense tenth " +
  "tepid terse thank theft their theme there these thick thief thigh thing think third thong thorn those " +
  "three threw throb throw thumb thump tiara tibia tidal tiger tight timer timid tipsy tired title toast " +
  "today token tonal tonic tooth topaz topic torch torso total totem touch tough towel tower toxic toxin " +
  "trace track tract trade trail train trait tramp trash treat trend triad trial tribe trick tried trite " +
  "troll troop trout trove truck truly trump trunk truss trust truth tulip tummy tumor tune tunic turbo " +
  "turf turn tutor twang tweak tweet twice twine twirl twist tying udder ulcer ultra umbra uncle uncut " +
  "under undue unfit unify union unite unity unlit until unwed upper upset urban urged usage usual usurp " +
  "utile utter vague valet valid value valve vapor vault vegan venom venue verge verse vicar video vigil " +
  "vigor villa vinyl viola viper viral virus visit visor vista vital vivid vocal vodka vogue voice waffle " +
  "wager wagon waist waive waltz warp wart wary wash wasp wave wavy waxy weak wean wear weed week weep " +
  "weld well welt went wept were west what when whim whip whir whiz whom wick wide widow width wield wight " +
  "will wily wince winch windy wiper wired wispy witch witty woken woman women woody wooer wooly wordy " +
  "world worry worse worst worth would wound woven wrath wreak wreck wrist write wrong wrote wrung yacht " +
  "yeast yield yodel yokel young yours youth yucky yummy zebra zesty " +
  "nectars lighter planter roasted entails careful gardens painter outside flaming hardest " +
  "silvery squared zealots peanuts " +
  "fling flail fail mail main nail gain film mangy glam malign llama maim flan limn gall " +
  "dots diets doses dotes edits sides sites tides toes ours outs oust douse outdid tossed studied " +
  "slate sale seal seat tale teas teals late lase lease azalea zest sleet steel slat slats salts " +
  "teases steals zealots " +
  "silver livery lively vies vise viler liver livre ivies riles sire seer eels sliver " +
  "gala final fain ling gaff"
).split(" ");

interface Hive {
  center: string;
  outer: string[];
}

/** Curated hives — each has at least one pangram inside BANK. */
const HIVES: Hive[] = [
  { center: "n", outer: ["c", "e", "t", "r", "a", "s"] },
  { center: "e", outer: ["l", "i", "g", "h", "t", "r"] },
  { center: "t", outer: ["p", "l", "a", "n", "e", "r"] },
  { center: "o", outer: ["r", "a", "s", "t", "e", "d"] },
  { center: "a", outer: ["e", "n", "t", "i", "l", "s"] },
  { center: "e", outer: ["c", "a", "r", "f", "u", "l"] },
  { center: "d", outer: ["g", "a", "r", "e", "n", "s"] },
  { center: "i", outer: ["p", "a", "n", "t", "e", "r"] },
  { center: "u", outer: ["o", "t", "s", "i", "d", "e"] },
  { center: "g", outer: ["f", "l", "a", "m", "i", "n"] },
  { center: "s", outer: ["h", "a", "r", "d", "e", "t"] },
  { center: "i", outer: ["s", "l", "v", "e", "r", "y"] },
  { center: "e", outer: ["s", "q", "u", "a", "r", "d"] },
  { center: "o", outer: ["z", "e", "a", "l", "t", "s"] },
  { center: "p", outer: ["e", "a", "n", "u", "t", "s"] },
];

const BANK_SET = new Set(BANK);

function pointsFor(word: string): number {
  if (word.length >= 7) return 8;
  if (word.length === 6) return 4;
  if (word.length === 5) return 2;
  return 1;
}

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

/** All bank words the hive can legally spell, precomputed once per round. */
function solveHive(hive: Hive): string[] {
  const allowed = new Set([hive.center, ...hive.outer]);
  const out: string[] = [];
  for (let i = 0; i < BANK.length; i++) {
    const w = BANK[i];
    if (w.length < 3 || w.length > 7) continue;
    if (!w.includes(hive.center)) continue;
    let ok = true;
    for (let k = 0; k < w.length; k++) {
      if (!allowed.has(w[k])) {
        ok = false;
        break;
      }
    }
    if (ok && BANK_SET.has(w)) out.push(w);
  }
  return out.sort();
}

/** Hives rich enough to be worth playing — filtered once at module load. */
const PLAYABLE = HIVES.filter((h) => solveHive(h).length >= 14);

type Status = "idle" | "playing" | "over";

export default function SpellingBee({ gameId = "spelling-bee" }: { gameId?: string }) {
  const { best, submit } = useBestScore(gameId, "high");

  const [status, setStatus] = useState<Status>("idle");
  const [hive, setHive] = useState<Hive>(HIVES[0]);
  const [valid, setValid] = useState<string[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [toast, setToast] = useState("");
  const [newBest, setNewBest] = useState(false);

  const toastTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const score = found.reduce((sum, w) => sum + pointsFor(w), 0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1800);
  }, []);

  const finish = useCallback(
    (list: string[]) => {
      const total = list.reduce((sum, w) => sum + pointsFor(w), 0);
      setStatus("over");
      setNewBest(submit(total));
    },
    [submit],
  );

  const start = useCallback(() => {
    const chosen = shuffle(PLAYABLE)[0];
    setHive(chosen);
    setValid(solveHive(chosen));
    setFound([]);
    setTyped("");
    setToast("");
    setStatus("playing");
    setNewBest(false);
  }, []);

  const submitWord = useCallback(() => {
    if (status !== "playing") return;
    const word = typed.toLowerCase();
    setTyped("");
    if (word.length < 3) {
      showToast("Words need at least 3 letters.");
      return;
    }
    if (!word.includes(hive.center)) {
      showToast(`Every word needs the center ${hive.center.toUpperCase()}.`);
      return;
    }
    const allowed = new Set([hive.center, ...hive.outer]);
    for (let i = 0; i < word.length; i++) {
      if (!allowed.has(word[i])) {
        showToast("Only hive letters count.");
        return;
      }
    }
    if (found.includes(word)) {
      showToast("Already found that one!");
      return;
    }
    if (!valid.includes(word)) {
      showToast("Not in this hive word list.");
      return;
    }

    const next = [...found, word];
    setFound(next);
    showToast(`+${pointsFor(word)} · ${word.toUpperCase()}`);
    if (next.length >= valid.length) finish(next);
  }, [status, typed, hive, found, valid, showToast, finish]);

  const press = useCallback(
    (key: string) => {
      if (status !== "playing") return;
      if (key === "enter") submitWord();
      else if (key === "back") setTyped((t) => t.slice(0, -1));
      else if (typed.length < 14) setTyped((t) => t + key);
    },
    [status, typed.length, submitWord],
  );

  useEffect(() => {
    if (status !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitWord();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setTyped((t) => t.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        setTyped((t) => (t.length < 14 ? t + e.key.toLowerCase() : t));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, submitWord]);

  const giveUp = useCallback(() => {
    if (status !== "playing") return;
    finish(found);
  }, [status, found, finish]);

  const outerTop = hive.outer.slice(0, 2);
  const outerMid = [hive.outer[2], hive.outer[3]];
  const outerBottom = hive.outer.slice(4, 6);

  const letterBtn = (ch: string, center: boolean, key: string) => (
    <button
      key={key}
      type="button"
      onPointerDown={() => press(ch)}
      className={cn(
        "grid h-14 w-14 place-items-center rounded-full font-display text-lg font-bold transition active:scale-95 sm:h-16 sm:w-16 sm:text-xl",
        center
          ? "bg-gradient-to-br from-yellow-300 to-amber-500 text-black shadow-[0_0_20px_rgba(251,191,36,0.5)]"
          : "border border-line bg-surface text-ink hover:bg-surface-2",
      )}
    >
      {ch}
    </button>
  );

  return (
    <div className="w-full max-w-[520px]">
      <GameHud
        score={score}
        best={best ?? "—"}
      >
        <span>
          Found <b className="ml-1 text-sm text-ink">{found.length}/{valid.length || "—"}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(250,204,21,0.55)] sm:p-5">
        <div className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-[#0e0e1c] px-3 py-2">
          {typed.length === 0 ? (
            <span className="text-sm text-muted">Spell with the hive…</span>
          ) : (
            <span className="font-display text-xl font-bold uppercase tracking-widest text-white">
              {typed}
            </span>
          )}
        </div>

        <div className="relative mx-auto mt-4 h-56 w-56 select-none sm:h-64 sm:w-64">
          <div className="absolute inset-x-0 top-0 flex justify-center gap-2">
            {outerTop.map((ch) => letterBtn(ch, false, `t-${ch}`))}
          </div>
          <div className="absolute inset-x-0 top-[6.25rem] flex items-center justify-center gap-2 sm:top-[7rem]">
            {outerMid.map((ch) => letterBtn(ch, false, `m-${ch}`))}
            {letterBtn(hive.center, true, "center")}
            {outerMid.map((ch) => letterBtn(ch, false, `m2-${ch}`))}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2">
            {outerBottom.map((ch) => letterBtn(ch, false, `b-${ch}`))}
          </div>
        </div>

        <div className="mt-3 flex justify-center gap-2">
          <button
            type="button"
            onPointerDown={() => press("back")}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-xs text-muted transition hover:bg-surface-2"
          >
            ⌫ Delete
          </button>
          <button
            type="button"
            onPointerDown={() => press("enter")}
            className="rounded-lg border border-primary/50 bg-primary/15 px-4 py-2 text-xs font-bold text-ink transition hover:bg-primary/25"
          >
            ⏎ Enter
          </button>
        </div>

        <div className="relative mt-3 min-h-6 text-center">
          {toast && (
            <p className="animate-pop inline-block rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
              <span>{toast}</span>
            </p>
          )}
        </div>

        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {found.map((w) => (
            <span
              key={w}
              className={cn(
                "rounded-md border border-line bg-[#131322] px-2 py-1 text-xs text-ink",
                w.length >= 7 && "border-warn/50 text-warn",
              )}
            >
              {w}
            </span>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={giveUp}
            disabled={status !== "playing"}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2 disabled:opacity-40"
          >
            Bank out
          </button>
          <button
            type="button"
            onClick={start}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2"
          >
            New hive
          </button>
        </div>

        {status === "idle" && (
          <Overlay>
            <p className="text-4xl">🐝</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              MAKE WORDS FROM 7 LETTERS
            </p>
            <p className="mt-2 text-sm text-muted">
              Every word must use the gold center letter. Longer words score more — gold words use all seven.
            </p>
            <PrimaryButton onClick={start} tone="from-yellow-400 via-amber-500 to-orange-600">
              Open hive
            </PrimaryButton>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="text-4xl">🍯</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              {found.length >= valid.length ? "HIVE BANKED OUT" : "SESSION OVER"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · {found.length} words
            </p>
            <div className="mt-3 flex max-w-xs flex-wrap justify-center gap-1">
              {found.map((w) => (
                <span key={w} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted">
                  {w}
                </span>
              ))}
            </div>
            <PrimaryButton onClick={start} tone="from-yellow-400 via-amber-500 to-orange-600">
              New hive
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap letters to compose · Enter banks the word · 3 letters minimum
      </p>
    </div>
  );
}
