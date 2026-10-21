"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const BANK = (
  "ace act add age ago aid aim air ale all ant any ape arc arm art ask ate axe bad bag ban bar bat bay bed bee bet big bin bit " +
  "boa bog bow box boy bud bug bun bus buy cab can cap car cat cod cop cow cry cub cup cut dad dam day den dew dig dim din dip " +
  "dog dot dry dub due dug dye ear eat ebb eel egg ego elf elk elm end era eve eye fan far fat fax fed fee few fig fin fir fit " +
  "fix flu fly fog for fox fry fun fur gap gas gem get gig gin goo got gum gun gut guy gym had ham has hat hay hem hen her hid " +
  "him hip his hit hoe hog hop hot how hub hue hug hum hut ice icy imp ink inn ion its ivy jab jam jar jaw jay jet jig job " +
  "jog jot joy jug jut keg key kid kin kit lab lad lag lap law lax lay led leg let lid lie lip lit lob log lot low lug mad man " +
  "map mar mat may men met mid mix mob mod mop mow mud mug net new nil nip nod nor not now nun nut oak oar oat odd ode off oft " +
  "oil old one opt orb ore our out owe owl own pad pal pan par pat paw pay pea peg pen per pet pew pie pig pin pit ply pod pop " +
  "pot pro pry pub pug pun pup put rag ram ran rap rat raw ray red rib rid rig rim rip rob rod roe rot row rub rue rug rum run " +
  "rut rye sad sag sap sat saw say sea see set sew she shy sin sip sir sit six ski sky sly sob sod son sop sow soy spa spy sty " +
  "sub sue sum sun sup tab tad tag tan tap tar tax tea ten the tie tin tip toe ton too top tot tow toy try tub tug two urn use " +
  "van vat vet via vie vow wad wag war was wax way web wed wee wet who why wig win wit woe won woo wow wry yak yam yap yaw yea " +
  "yes yet yew yip you zap zip zoo " +
  "able acre aged aide airy ally also alto amid ante apex arch area arid army atom auto away back bait bake bald bale balm band " +
  "bang bank bark barn base bash bask bath bead beak beam bean bear beat beef been beer bell belt bend bias bird bite bled blew " +
  "blip blob bloc blow blue blur boar boat body boil bold bolt bond bone book boom boot bore born boss both bout bowl brag brew " +
  "brim brow bulb bulk bull bump bunk burn bury bush bust busy buzz cage cake calf call calm came camp cane cape card care cart " +
  "case cash cast cell chap char chat chin chip chop clan clap claw clay clip clog clot club clue coal coat code coil coin cold " +
  "colt comb come cone cook cool cope copy cord core cork corn cost cove cozy crab crib crop crow cube curl cute dare dark dart " +
  "dash data date dawn deal dean dear deed deem deep desk dial dice dime dine dire disc dish dock does done doom door dose doze " +
  "draw drip drop dual duct dude duel duet dusk dust duty each earn easy echo edit else emit exam exit fade fail fair fake fall " +
  "fame fare fast fawn fear feat feed feel feet fell felt fend fern feud file fill film find fine fire firm fish fist five flag " +
  "flap flat flaw fled flee flew flip flow foam folk fond font food fool foot ford fore fork form fort foul four fowl free frog " +
  "from funk fuse fuss fuzz gain game gape gate gave gear gene germ gift gild gill gilt girl gist glad glee glen glue glum goal " +
  "goat goes golf gone gong good goof gore gown grab gram gray grew grid grim grin grip groan groom gross grove grow grub gulf " +
  "gull gulp gust guts hack hail hair hall halt hand hang hard hare harm harp hash hate haul have hawk haze head heal heat heed " +
  "heel heir held hell help herb herd here hero hide high hike hill hint hire hive hoax hold hole holy home hone hood hook hoop " +
  "hope horn hose host hour howl huge hull hump hung hunt hurl hurt hush husk hymn idea idle idol inch iris iron isle item jade " +
  "jail jazz jeep jeer jest jibe jilt jive job jog jot joy judo junk jury just jute keen keep kept kick kill kind king kink kiss " +
  "kite knee knew knit knob knot know lace lack lacy lady laid lair lake lamb lame lamp land lane laps lard lark lash last late " +
  "lawn lead leaf leak lean leap left lend lens lent levy liar lick lien life lift like limb lime limp line link lint lion list " +
  "live load loaf loan lobe lock loft logo lone long look loom loop loot lord lore lose loss lost loud love luck lull lump lung " +
  "lure lurk lush lust lute made maid mail main make male mall malt mane many mare mark mash mask mass mast mate maze mead meal " +
  "mean meat meek meet meld melt memo mend menu mere mesh mess mice mild mile milk mill mime mind mine mint mire miss mist mite " +
  "moan moat mock mode mold mole molt monk mood moon moor moot mope more morn moss most moth move mown much muck mule mull mush " +
  "musk must mute mutt myth nail name nape navy near neat neck need neon nest news next nice nick nine node none noon norm nose " +
  "note noun numb oath obey oboe odds odor ogre oily okay omen omit once only onus ooze open opts oral orbs ores ours oust outs " +
  "oval oven over owed pace pack pact page paid pail pain pair pale palm pane pang pans pant park part pass past pate path pave " +
  "pawn peak peal pear peas peat peck peek peel peer pelt perk pest pick pier pies pigs pike pile pill pine pink pint pipe pity " +
  "plan play plea plod plot plow ploy plug plum plus poem poet poke pole poll polo pond pony pool poor pope pork port pose posh " +
  "post pots pour pout pray prey prim prod prop prow puck puff pull pulp pump punk punt pure push putt quit race rack raft rage " +
  "raid rail rain rake ramp rang rank rant rare rash rate rave read real ream reap rear redo reed reef reek reel rein rely rent " +
  "rest rice rich ride rift rime ring riot ripe rise risk rite road roam roar robe rock rode role roll roof rook room root rope " +
  "rose rosy rote rout rove ruby rude ruin rule rung runs runt rush rust sack safe saga sage said sail sake sale salt same sand " +
  "sane sang sank sash save scab scan scar seal seam sear seas sect seed seek seem seen self sell send sent sets shed shin ship " +
  "shoe shop shot show shun shut sick side sift sigh sign silk sill silo silt sing sink sire site size skid skim skin skip slab " +
  "slam slap sled slew slid slim slip slit slob slog slot slow slug slum slur smog snap snip snob snow snub snug soak soap soar " +
  "sock soda sofa soft soil sold sole solo some song soon soot sore sort soul soup sour sown span spar sped spin spit spot spun " +
  "spur stab stag star stay stem step stew stir stop stun sunk sure surf swab swam swan swap sway swim tack tact tail take tale " +
  "talk tall tame tang tank tape tarn tart task taut taxi teal team tear teas teem teen tell tend tent term tern test text than " +
  "that thaw thee them then they thin this thud thug thus tick tide tidy tied tier tile till tilt time tine tint tiny tire toad " +
  "toed toga toil told toll tomb tome tone tons took tool torn tote tour tout town tram trap tray tree trek trim trio trip trod " +
  "trot true tuba tube tuck tuft tuna tune turf turn tusk twin type ugly undo unit unto upon urge used user vain vale vane vans " +
  "vase vast veal veer veil vein vend vent verb very vest veto vial vibe vice view vile vine visa void volt vote vows wade waft " +
  "wage wail wait wake walk wall wand wane want ward ware warm warn warp wart wary wash wasp wave wavy waxy ways weak wean " +
  "wear webs weds weed week weep weld well welt went wept were west what when whip whir whiz wick wide wife wild will wilt wily " +
  "wimp wind wine wing wink wire wise wish wisp with woes woke wolf wood wool word wore work worm worn wove wrap wren yank yarn " +
  "year yell yelp yoga yoke yolk your zeal zero zest zinc zone zoom " +
  "watch clock gloomy flower phone give dull keen shake lake make wake cake fake sake bake " +
  "light night right sight might fight eight tight bright flight blight plight sound pound round bound found ground wound hound " +
  "flame frame blame shame claim whale shale frail trail snail shore store score snore chart start smart flash slash smash trash " +
  "crash clash brake flake shake stake snake blood food good mood wood brood hood stood bleed breed speed click quick thick trick " +
  "brick block flock stock trust crust brush crush flush smell swell creep sheep steep sleep cheek creek drunk trunk"
).split(" ");

const BANK_SET = new Set(BANK.filter((w) => /^[a-z]+$/.test(w)));

/** Curated ladders: [start, target, par steps]. Pars verified by BFS. */
const PAIRS: [string, string, number][] = [
  ["cat", "dog", 4], ["head", "tail", 5], ["warm", "cold", 4], ["dark", "pale", 4],
  ["fast", "slow", 6], ["love", "hate", 4], ["day", "sun", 4], ["moon", "star", 6],
  ["rise", "fall", 6], ["sail", "swim", 4], ["book", "read", 5], ["hand", "foot", 5],
  ["head", "heel", 2], ["king", "lord", 5], ["hair", "mane", 5], ["ship", "boat", 5],
  ["coin", "cash", 5], ["run", "jog", 3], ["big", "fat", 3], ["pet", "dog", 3],
  ["six", "ten", 3], ["leg", "arm", 5], ["sea", "bay", 4], ["sky", "air", 5],
  ["eat", "sip", 3], ["ink", "pen", 5], ["find", "seek", 4], ["keep", "hold", 5],
  ["cool", "warm", 5], ["vast", "wide", 5], ["kind", "rude", 5], ["wise", "sage", 4],
  ["year", "week", 3], ["sand", "salt", 3], ["man", "boy", 3], ["dark", "dusk", 4],
  ["give", "take", 4], ["fire", "burn", 4], ["wind", "rain", 5], ["wild", "tame", 5],
  ["thin", "lean", 5], ["calm", "cool", 5], ["work", "toil", 5], ["read", "scan", 4],
  ["walk", "pace", 4], ["wake", "rise", 4], ["lend", "loan", 3], ["rice", "corn", 5],
  ["loud", "soft", 5], ["lamb", "calf", 6], ["bake", "boil", 6], ["pass", "fail", 6],
];

/** Neighbors differ by exactly one letter — precomputed once at load. */
const NEIGHBORS: Map<string, string[]> = (() => {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const map = new Map<string, string[]>();
  for (const word of BANK) {
    if (!BANK_SET.has(word)) continue;
    if (map.has(word)) continue;
    const out: string[] = [];
    for (let i = 0; i < word.length; i++) {
      for (const c of chars) {
        if (c === word[i]) continue;
        const cand = word.slice(0, i) + c + word.slice(i + 1);
        if (BANK_SET.has(cand)) out.push(cand);
      }
    }
    map.set(word, out);
  }
  return map;
})();

/** BFS distances from a word to every reachable same-length word. */
function distancesFrom(start: string): Map<string, number> {
  const dist = new Map<string, number>([[start, 0]]);
  const queue: string[] = [start];
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    const nexts = NEIGHBORS.get(cur) ?? [];
    for (let i = 0; i < nexts.length; i++) {
      const nb = nexts[i];
      if (dist.has(nb)) continue;
      dist.set(nb, (dist.get(cur) ?? 0) + 1);
      queue.push(nb);
    }
  }
  return dist;
}

function diffCount(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

type Status = "idle" | "playing" | "over";

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

export default function WordLadder({ gameId = "word-ladder" }: { gameId?: string }) {
  const { best, submit } = useBestScore(gameId, "low");

  const [status, setStatus] = useState<Status>("idle");
  const [pair, setPair] = useState<[string, string, number]>(PAIRS[0]);
  const [ladder, setLadder] = useState<string[]>([PAIRS[0][0]]);
  const [typed, setTyped] = useState("");
  const [toast, setToast] = useState("");
  const [shake, setShake] = useState(false);
  const [hintsLeft, setHintsLeft] = useState(2);
  const [newBest, setNewBest] = useState(false);

  const toastTimer = useRef<number | null>(null);
  const shakeTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    },
    [],
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }, []);

  const flashShake = useCallback(() => {
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    setShake(true);
    shakeTimer.current = window.setTimeout(() => setShake(false), 420);
  }, []);

  const reject = useCallback(
    (msg: string) => {
      showToast(msg);
      flashShake();
      setTyped("");
    },
    [showToast, flashShake],
  );

  const start = useCallback(() => {
    const next = shuffle(PAIRS)[0];
    setPair(next);
    setLadder([next[0]]);
    setTyped("");
    setToast("");
    setShake(false);
    setHintsLeft(2);
    setStatus("playing");
    setNewBest(false);
  }, []);

  const submitStep = useCallback(() => {
    if (status !== "playing") return;
    const word = typed.toLowerCase().trim();
    setTyped("");
    if (word.length === 0) return;
    const [start, target, par] = pair;
    if (word.length !== start.length) {
      reject(`Steps must be ${start.length} letters long.`);
      return;
    }
    const top = ladder[ladder.length - 1];
    if (diffCount(word, top) !== 1) {
      reject("Change exactly one letter.");
      return;
    }
    if (!BANK_SET.has(word)) {
      reject("Not in the word list.");
      return;
    }
    if (ladder.includes(word)) {
      reject("You already used that word.");
      return;
    }

    const next = [...ladder, word];
    setLadder(next);
    if (word === target) {
      const steps = next.length - 1;
      setStatus("over");
      setNewBest(submit(steps));
      if (steps < par) showToast(`${par - steps} under par!`);
    }
  }, [status, typed, pair, ladder, reject, submit, showToast]);

  const press = useCallback(
    (key: string) => {
      if (status !== "playing") return;
      if (key === "enter") submitStep();
      else if (key === "back") setTyped((t) => t.slice(0, -1));
      else if (typed.length < 10) setTyped((t) => t + key);
    },
    [status, typed.length, submitStep],
  );

  useEffect(() => {
    if (status !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitStep();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setTyped((t) => t.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        setTyped((t) => (t.length < 10 ? t + e.key.toLowerCase() : t));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, submitStep]);

  const takeHint = useCallback(() => {
    if (status !== "playing" || hintsLeft <= 0) return;
    const top = ladder[ladder.length - 1];
    const target = pair[1];
    const dist = distancesFrom(top);
    let bestWord: string | null = null;
    let bestDist = Infinity;
    const options = NEIGHBORS.get(top) ?? [];
    for (let i = 0; i < options.length; i++) {
      const nb = options[i];
      if (ladder.includes(nb)) continue;
      const d = dist.get(nb);
      if (d === undefined || d >= bestDist) continue;
      bestDist = d;
      bestWord = nb;
    }
    setHintsLeft((n) => n - 1);
    if (bestWord) {
      setTyped(bestWord);
      showToast(`Try ${bestWord.toUpperCase()} — ${bestDist} from ${target.toUpperCase()}.`);
    }
  }, [status, hintsLeft, ladder, pair, showToast]);

  const [startWord, targetWord, par] = pair;
  const steps = ladder.length - 1;
  const stars = steps < par ? par - steps : 0;

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={steps} best={best === null ? "—" : `${best}`}>
        <span>
          Par <b className="ml-1 text-sm text-ink">{par}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(244,114,182,0.45)] sm:p-5">
        <div className="flex items-center justify-center gap-3">
          <span className="rounded-lg border border-line bg-[#131322] px-3 py-1.5 font-display text-lg font-bold uppercase tracking-wider text-ink">
            {startWord}
          </span>
          <span className="text-xs text-muted">→</span>
          <span className="rounded-lg border border-warn/50 bg-warn/10 px-3 py-1.5 font-display text-lg font-bold uppercase tracking-wider text-warn">
            {targetWord}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {ladder.map((word, i) => (
            <span key={`${word}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-xs text-muted">↑</span>}
              <span
                className={cn(
                  "rounded-lg border px-2.5 py-1 font-display text-sm font-bold uppercase tracking-wider",
                  word === targetWord
                    ? "border-emerald-400 bg-emerald-500/15 text-emerald-300"
                    : i === ladder.length - 1
                      ? "border-primary/60 bg-primary/15 text-ink"
                      : "border-line bg-[#131322] text-muted",
                )}
              >
                {word}
              </span>
            </span>
          ))}
        </div>

        <div
          className={cn(
            "mt-4 flex min-h-12 items-center justify-center rounded-xl border border-line bg-[#0e0e1c] px-3 py-2 transition-transform duration-75",
            shake && "-translate-x-2",
          )}
        >
          {typed.length === 0 ? (
            <span className="text-sm text-muted">
              Change one letter of {ladder[ladder.length - 1].toUpperCase()}…
            </span>
          ) : (
            <span className="font-display text-xl font-bold tracking-widest text-white">{typed}</span>
          )}
        </div>

        <div className="mt-3 min-h-6 text-center">
          {toast && (
            <p className="animate-pop inline-block rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
              <span>{toast}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 select-none">
          {KEYS.map((row, r) => (
            <div key={r} className="flex justify-center gap-1">
              {r === 2 && (
                <button
                  type="button"
                  onPointerDown={() => press("back")}
                  className="rounded-lg border border-line bg-surface px-2.5 py-2 text-xs text-muted transition hover:bg-surface-2"
                >
                  ⌫
                </button>
              )}
              {row.split("").map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onPointerDown={() => press(ch)}
                  className="h-9 w-8 rounded-lg border border-line bg-surface text-sm font-display text-ink transition hover:border-primary/60 hover:bg-surface-2 active:scale-95 sm:w-9"
                >
                  {ch}
                </button>
              ))}
              {r === 2 && (
                <button
                  type="button"
                  onPointerDown={() => press("enter")}
                  className="rounded-lg border border-primary/50 bg-primary/15 px-2.5 py-2 text-xs font-bold text-ink transition hover:bg-primary/25"
                >
                  ⏎
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={takeHint}
            disabled={status !== "playing" || hintsLeft <= 0}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2 disabled:opacity-40"
          >
            Hint ({hintsLeft})
          </button>
          <button
            type="button"
            onClick={start}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2"
          >
            New ladder
          </button>
        </div>

        {status === "idle" && (
          <Overlay>
            <p className="text-4xl">🪜</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              CLIMB WORD TO WORD
            </p>
            <p className="mt-2 text-sm text-muted">
              Change exactly one letter per step — every rung must be a real word. Beat par for stars.
            </p>
            <PrimaryButton onClick={start} tone="from-rose-400 via-pink-500 to-fuchsia-600">
              Start climb
            </PrimaryButton>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="text-4xl">🏆</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              LADDER COMPLETE
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fewest steps!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">{steps}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              steps · par {par}
              {stars > 0 ? ` · ${"★".repeat(Math.min(3, stars))} under par` : ""}
            </p>
            <PrimaryButton onClick={start} tone="from-rose-400 via-pink-500 to-fuchsia-600">
              New ladder
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        One letter changes per step · Enter to climb · hint fills a smart rung
      </p>
    </div>
  );
}
