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
  "about above actor acute admit adopt adult after again agent agree ahead alarm album alert alive allow alone along amber " +
  "among anger angle angry apple apply argue arise armor army arrow aside asset avoid awake award aware basic beach beard beast " +
  "begin below bench birth black blade blame bland blank blast blaze bleak bleed blend bless blind blink block blond blood bloom " +
  "blown bluff blunt blush board boast bonus bound brain brass brave bread break breed brick bring broad broke brood brook broom " +
  "brown brush build built bunch burnt burst cabin cable cache candy canoe caper carry carve cause chain chair chalk champ chaos " +
  "charm chart chase cheap cheat check cheek cheer chess chest chief child chili chill china chunk churn cider claim clamp clang " +
  "clash clasp class clean clear clerk cliff climb cling cloak clock clone close cloth cloud clown coach cocoa colon color comet " +
  "comic coral couch cough could count court cover crack craft crane crash crawl crazy creed creek crest cried crisp cross crowd " +
  "crude cruel crumb crush crust curly curve daily dairy daisy dance dandy dealt death debit debut decay decoy delay delta demon " +
  "dense depot depth diary dirty ditch dizzy dodge doing donor doubt dough dozen draft drain drama drank drape drawn dream dress " +
  "dried drift drill drink drive drone drool droop drove drown drunk dryer dummy dusty dwarf dwell dying eager eagle early earth " +
  "eight elder elect elite elope elude email empty enemy enjoy enter entry equal equip erase erupt essay ether event every evoke " +
  "exact exalt excel exert exile exist expel extra fable faced faint fairy faith false fancy fatal fault favor feast fence ferry " +
  "fetch fever fiber field fiery fifty fight final finch first fixed flaky flame flank flare flash flask fleet flesh flick fling " +
  "flint float flock flood floor flora floss flour flown fluid flung flush flute focal focus folks force forge forgo forth forty " +
  "forum found frame frank fraud freak freed fresh fried front frost froth frown froze fruit fully funky funny furry fussy fuzzy " +
  "gadget galaxy gamble garage garden garlic garnet gaudy gauge genie genre ghost giant giddy gifts given giver glade glare glass " +
  "glaze gleam glean glide glint gloat globe gloom glory gloss glove gnome going goods goose gorge gourd grace grade grain grand " +
  "grant grape graph grasp grass grate grave gravy graze great greed green greet grief grill grind gripe groan groom grope gross " +
  "group grout grove growl grown gruel gruff grunt guard guess guest guide guild guilt gully gummy gusty gypsy habit hairy halve " +
  "handy happy hardy harsh haste hasty hatch haunt haven havoc hazel head heal heap hear heart heat hazy hedge hefty heist hello " +
  "hence herd hero hiding highly hinge hint hoard hobby hoist holly honey honor horde horse hotel hound house hover human humid " +
  "humor hunch hurry husky ideal idiom igloo image imply inane inbox incur index inert infer ingot inlet inner input intro irate " +
  "irony issue ivory jelly jewel joint joker jolly joust judge juice juicy jumbo kayak keen keeps khaki kiosk kitty knack kneel " +
  "knife knock knoll known koala label labor laden ladle lager lance lanky lapel lapse large larva latch later latte laugh layer " +
  "leach leaky lean leap learn lease leash least leave ledge legal lemon level lever light liked lilac limbo limit linen liner " +
  "liter lithe liver llama loads loan lobby local locked lodge lofty logic login loose lorry loser loved lover lower loyal lucid " +
  "lucky lunar lunch lunge lurch lurid lyric macro madam magic magma maize major maker mango mania manic maple march marsh match " +
  "maxim maybe mayor meant medal media medic melon mercy merge merry messy metal meter midst mighty mimic mince miner minor minus " +
  "mirth miser mixer modal model modem moist molar moldy money month moody moral moron motel motion motor motto mound mount mourn " +
  "mouse mouth moved mover movie mower muddy mummy munch mural murky mushy music musky musty muted nacho nadir naive naked nanny " +
  "nasal nasty naval navel needy nerdy nerve never newly niche night ninja noble nobly noise noisy nomad north notch novel nudge " +
  "nurse nylon oasis ocean often olive omega onion onset opera optic orbit order organ other otter ounce outer ovary overt oxide " +
  "ozone paced pagan paint palsy panel panic pansy pants papal paper parch parka parry parse party pasta patch patio patty pause " +
  "paved payer peace peach pearl pecan pedal penal pence penny peony perch peril perky pesky pesto petal petty phase phone photo " +
  "piano picky piece piety pilot pinch pinky pinto pipe pity pixel pizza place plaid plain plait plane plank plant plate plaza " +
  "plead pleat plus poem poet point poise poker polar polka polyp pooch poppy porch pouch pound power prank prawn press price " +
  "prick pride prime print prior prism privy prize probe prone prong proof prose proud prove prowl prune psalm pudgy puffy pulse " +
  "punch pupil puppy puree purge purse pushy putty quack quail quake qualm quart quash quasi queen quell query quest queue quick " +
  "quiet quill quilt quirk quite quota quote rabbi racer radar radio rainy raise rally ramen ranch range rapid ratio ratty raven " +
  "razor reach react ready realm rebel refer regal rehab reign relax relay relic remit renal renew repay repel reply rerun reset " +
  "resin retro reuse revel rhino rhyme rider ridge rifle right rigid rinse ripen risen risky rival roast robin robot rocky rodeo " +
  "rogue roomy roost rotor rouge rough round rouse route rover rowdy royal ruddy rumor rural sadly safer saint salad salon salsa " +
  "salty sandy sassy satin sauce saucy sauna saved savor savvy scald scale scalp scaly scamp scant scare scarf scary scene scent " +
  "scoff scold scoop scoot scope score scorn scour scout scowl scrap screw scrub scrum scuba sedan seedy seize sense serve seven " +
  "sever sewer shade shady shaft shake shaky shale shall shame shape shard share shark sharp shave shawl shear sheen sheep sheer " +
  "sheet shelf shell shied shift shine shiny shire shirt shoal shock shone shook shoot shore short shout shove shown showy shred " +
  "shrub shrug shuck shunt shush sigma silky silly since sinew singe siren sixth sixty sized skate skier skiff skill skimp skirt " +
  "skulk skull skunk slack slain slang slant slash slate sleek sleep sleet slept slice slick slide slime slimy sling slink sloop " +
  "slope slosh sloth slump slung slurp slush small smart smash smear smell smelt smile smirk smite smoke smoky snack snail snake " +
  "snare snarl sneak sneer snide sniff snipe snoop snore snort snout snowy snuck soapy sober solar solid solve sonar sonic sooty " +
  "sorry sound south space spade spare spark spasm spawn speak spear speck speed spell spend spent spice spicy spied spike spiky " +
  "spill spilt spine spiny spire spite splat split spoil spoke spoof spook spool spoon spore sport spout spray spree sprig spurn " +
  "spurt squad squat squid stack staff stage staid stain stair stake stale stalk stall stamp stand stank stare stark start stash " +
  "state stave steak steal steam steed steel steep steer stein stern stick stiff still stilt sting stink stint stock stoic stoke " +
  "stole stomp stone stony stood stool stoop store stork storm story stout stove strap straw stray strip strut stuck study stuff " +
  "stump stung stunk stunt style suave sugar suite sulky sunny surly sushi swami swamp swank swarm swath swear sweat sweep sweet " +
  "swell swept swift swill swine swing swipe swirl swish swoop sword swore sworn swung table taboo tacit tacky taken taker tally " +
  "talon tamer tango tangy taper tapir tardy tarot taste tasty taunt tawny teach tease teddy teeth tempo tenet tenor tense tenth " +
  "tepid terse thank theft their theme there these thick thief thigh thing think third thong thorn those three threw throb throw " +
  "thumb thump tiara tibia tidal tiger tight timid tipsy tired title toast today token tonal tonic tooth topaz topic torch torso " +
  "total totem touch tough towel tower toxic toxin trace track tract trade trail train trait tramp trash treat trend triad trial " +
  "tribe trick tried trite troll troop trout trove truck truly trump trunk truss trust truth tulip tummy tumor tune tunic turbo " +
  "turf turn tutor twang tweak tweet twice twine twirl twist tying udder ulcer ultra umbra uncle uncut under undue unfit unify " +
  "union unite unity unlit until unwed upper upset urban urged usage usual usurp utile utter vague valet valid value valve vapor " +
  "vault vegan venom venue verge verse vicar video vigil vigor villa vinyl viola viper viral virus visit visor vista vital vivid " +
  "vocal vodka vogue voice wager wagon waist waive waltz warp wart wary wash wasp wave wavy waxy weak wean wear weed week weep " +
  "weld well welt went wept were west what when whip whir whiz whom wick wide widow width wield wight will wily wince winch " +
  "windy wiper wired wispy witch witty woken woman women woody wooer wooly wordy world worry worse worst worth would wound woven " +
  "wrath wreak wreck wrist write wrong wrote wrung yacht yeast yield yodel yokel young yours youth yucky yummy zebra zesty zinc"
).split(" ");

const BANK_SET = new Set(BANK);

/** Friendly starting words — each leaves a useful hand-off letter. */
const STARTERS = [
  "apple", "beach", "clock", "dream", "flame", "grape", "heart", "lemon",
  "magic", "ocean", "piano", "queen", "river", "smile", "stone", "tiger",
  "whale", "world", "cloud", "music", "plant", "spark", "bread", "chair",
];

const MAX_HEARTS = 3;
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

export default function WordLink({ gameId = "word-link" }: { gameId?: string }) {
  const { best, submit } = useBestScore(gameId, "high");

  const [status, setStatus] = useState<Status>("idle");
  const [chain, setChain] = useState<string[]>(["apple"]);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [typed, setTyped] = useState("");
  const [toast, setToast] = useState("");
  const [shake, setShake] = useState(false);
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
    toastTimer.current = window.setTimeout(() => setToast(""), 2000);
  }, []);

  const flashShake = useCallback(() => {
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    setShake(true);
    shakeTimer.current = window.setTimeout(() => setShake(false), 420);
  }, []);

  const start = useCallback(() => {
    setChain([shuffle(STARTERS)[0]]);
    setHearts(MAX_HEARTS);
    setTyped("");
    setToast("");
    setShake(false);
    setStatus("playing");
    setNewBest(false);
  }, []);

  const loseHeart = useCallback(
    (msg: string, left: number) => {
      showToast(msg);
      flashShake();
      if (left <= 0) {
        setStatus("over");
        setNewBest(submit(chain.length));
      }
    },
    [showToast, flashShake, chain.length, submit],
  );

  const submitWord = useCallback(() => {
    if (status !== "playing") return;
    const word = typed.toLowerCase().trim();
    setTyped("");
    if (word.length === 0) return;
    if (word.length < 3) {
      showToast("Words need at least 3 letters.");
      return;
    }

    const prev = chain[chain.length - 1];
    const need = prev[prev.length - 1];
    if (word[0] !== need) {
      loseHeart(`Must start with ${need.toUpperCase()}.`, hearts - 1);
      setHearts(hearts - 1);
      return;
    }
    if (chain.includes(word)) {
      loseHeart("That word is already in your chain.", hearts - 1);
      setHearts(hearts - 1);
      return;
    }
    if (!BANK_SET.has(word)) {
      loseHeart("Not in the word list.", hearts - 1);
      setHearts(hearts - 1);
      return;
    }

    setChain((c) => [...c, word]);
  }, [status, typed, chain, hearts, showToast, loseHeart]);

  const press = useCallback(
    (key: string) => {
      if (status !== "playing") return;
      if (key === "enter") submitWord();
      else if (key === "back") setTyped((t) => t.slice(0, -1));
      else if (typed.length < 12) setTyped((t) => t + key);
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
        setTyped((t) => (t.length < 12 ? t + e.key.toLowerCase() : t));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, submitWord]);

  const prev = chain[chain.length - 1];
  const need = prev[prev.length - 1];

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={chain.length} best={best ?? "—"}>
        <span className="text-rose-400" aria-label={`${hearts} hearts left`}>
          {"♥".repeat(hearts)}
          <span className="text-line">{"♥".repeat(MAX_HEARTS - hearts)}</span>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(45,212,191,0.45)] sm:p-5">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {chain.map((w, i) => (
            <span key={`${w}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-xs text-muted">→</span>}
              <span
                className={cn(
                  "rounded-lg border px-2 py-1 font-display text-sm font-bold uppercase tracking-wider",
                  i === chain.length - 1
                    ? "border-primary/60 bg-primary/15 text-ink"
                    : "border-line bg-[#131322] text-muted",
                )}
              >
                {w}
              </span>
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">next word starts with</span>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 font-display text-2xl font-bold text-black shadow-[0_0_20px_rgba(52,211,153,0.5)]">
            {need.toUpperCase()}
          </span>
        </div>

        <div
          className={cn(
            "mt-4 flex min-h-12 items-center justify-center rounded-xl border border-line bg-[#0e0e1c] px-3 py-2 transition-transform duration-75",
            shake && "-translate-x-2",
          )}
        >
          {typed.length === 0 ? (
            <span className="text-sm text-muted">Chain a word off the {need.toUpperCase()}…</span>
          ) : (
            <span className="font-display text-xl font-bold tracking-widest text-white">{typed}</span>
          )}
        </div>

        <div className="mt-3 min-h-6 text-center">
          {toast && (
            <p className="animate-pop inline-block rounded-full bg-rose-500/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-rose-400">
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
            onClick={start}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink transition hover:border-primary/60 hover:bg-surface-2"
          >
            New chain
          </button>
        </div>

        {status === "idle" && (
          <Overlay>
            <p className="text-4xl">🔗</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              BUILD THE LONGEST CHAIN
            </p>
            <p className="mt-2 text-sm text-muted">
              Each word starts with the last letter of the one before. Three slips and the run is over.
            </p>
            <PrimaryButton onClick={start} tone="from-emerald-400 via-teal-500 to-cyan-600">
              Start chaining
            </PrimaryButton>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="text-4xl">💔</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              CHAIN BROKEN
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New longest chain!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">{chain.length}</p>
            <p className="text-xs uppercase tracking-widest text-muted">Best {best ?? "—"} words linked</p>
            <PrimaryButton onClick={start} tone="from-emerald-400 via-teal-500 to-cyan-600">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Type a word starting with {need.toUpperCase()} · Enter to bank it · no repeats
      </p>
    </div>
  );
}
