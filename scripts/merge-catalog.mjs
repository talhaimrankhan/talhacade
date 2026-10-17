#!/usr/bin/env node
/**
 * Merges catalog-entry JSON files into the site's two shared registries:
 *
 *   1. src/lib/catalog.ts      — the `games: Game[]` data array
 *   2. src/components/game-player.tsx — the dynamic-import `loaders` record
 *
 * Usage:
 *   node scripts/merge-catalog.mjs [--dry] [catalog-entries/*.json ...]
 *
 * With no paths given it merges every *.json in catalog-entries/.
 * --dry validates and prints the plan without writing anything.
 *
 * Each JSON file must be an array of Game objects (see src/lib/types.ts):
 *   { slug, title, category, tagline, description,
 *     cover: { emoji, gradient }, input: [...],
 *     controls: [{ keys, action }], tags: [...], score?: { label, mode, kind } }
 *
 * The game component itself must already exist at src/games/<slug>.tsx
 * (slugs starting with a digit use a `game-` prefix, like game-2048.tsx).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dry = process.argv.includes("--dry");
const args = process.argv.slice(2).filter((a) => a !== "--dry");

const CATEGORIES = new Set(["arcade", "puzzle", "strategy", "casual"]);
const INPUTS = new Set(["keyboard", "mouse", "touch"]);
const MODES = new Set(["high", "low"]);
const KINDS = new Set(["points", "seconds", "ms", "moves"]);
/** Gradient classes already in use across the catalog (warn-only). */
const GRADIENTS = new Set([
  "from-violet-500 via-purple-500 to-fuchsia-500",
  "from-cyan-400 via-sky-500 to-blue-600",
  "from-amber-400 via-orange-500 to-red-500",
  "from-pink-400 via-rose-500 to-red-400",
  "from-emerald-400 via-teal-500 to-cyan-600",
  "from-fuchsia-500 via-purple-500 to-indigo-600",
  "from-slate-400 via-zinc-500 to-neutral-700",
  "from-teal-400 via-emerald-500 to-green-600",
  "from-sky-400 via-blue-500 to-indigo-600",
  "from-yellow-400 via-amber-500 to-orange-600",
  "from-lime-400 via-emerald-500 to-teal-600",
  "from-rose-400 via-pink-500 to-fuchsia-600",
]);

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);

/* ------------------------------------------------------------------ */
/* Collect entries                                                     */
/* ------------------------------------------------------------------ */

let files = args;
if (files.length === 0) {
  const dir = join(root, "catalog-entries");
  files = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => join(dir, f))
    : [];
}
if (files.length === 0) {
  console.error("No catalog-entry JSON files found.");
  process.exit(1);
}

const entries = [];
for (const file of files) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    fail(`${file}: invalid JSON — ${e.message}`);
    continue;
  }
  if (!Array.isArray(data)) {
    fail(`${file}: expected a JSON array of game entries`);
    continue;
  }
  for (const entry of data) entries.push({ entry, from: file });
}

/* ------------------------------------------------------------------ */
/* Validate                                                            */
/* ------------------------------------------------------------------ */

const catalogSrc = readFileSync(join(root, "src/lib/catalog.ts"), "utf8");
const playerSrc = readFileSync(
  join(root, "src/components/game-player.tsx"),
  "utf8",
);
const existingSlugs = new Set(
  [...catalogSrc.matchAll(/^\s{4}slug: "([a-z0-9-]+)",$/gm)].map((m) => m[1]),
);
const seen = new Set();

const gameFile = (slug) =>
  join(root, "src/games", /^[0-9]/.test(slug) ? `game-${slug}.tsx` : `${slug}.tsx`);

for (const { entry, from } of entries) {
  const id = entry?.slug ?? "(missing slug)";
  if (typeof entry.slug !== "string" || !/^[a-z0-9-]+$/.test(entry.slug)) {
    fail(`${from}: bad or missing slug ${JSON.stringify(entry.slug)}`);
    continue;
  }
  if (existingSlugs.has(entry.slug)) fail(`${id}: slug already in catalog.ts`);
  if (seen.has(entry.slug)) fail(`${id}: duplicate slug across entry files`);
  seen.add(entry.slug);

  if (!CATEGORIES.has(entry.category)) fail(`${id}: bad category ${entry.category}`);
  for (const f of ["title", "tagline", "description"]) {
    if (typeof entry[f] !== "string" || !entry[f].trim()) fail(`${id}: missing ${f}`);
  }
  if (typeof entry.cover?.emoji !== "string") fail(`${id}: missing cover.emoji`);
  if (typeof entry.cover?.gradient !== "string") fail(`${id}: missing cover.gradient`);
  else if (!GRADIENTS.has(entry.cover.gradient))
    warnings.push(`${id}: gradient "${entry.cover.gradient}" not in the known palette`);

  if (!Array.isArray(entry.input) || entry.input.length === 0)
    fail(`${id}: input must be a non-empty array`);
  else for (const i of entry.input)
    if (!INPUTS.has(i)) fail(`${id}: bad input type "${i}"`);

  if (!Array.isArray(entry.controls) || entry.controls.length === 0)
    fail(`${id}: controls must be a non-empty array`);
  else for (const c of entry.controls) {
    if (typeof c?.keys !== "string" || typeof c?.action !== "string")
      fail(`${id}: control entries need { keys, action } strings`);
  }

  if (!Array.isArray(entry.tags) || entry.tags.length !== 3)
    warnings.push(`${id}: expected exactly 3 tags`);
  else if (entry.tags.some((t) => t !== t.toLowerCase()))
    warnings.push(`${id}: tags should be lowercase`);

  if (entry.score !== undefined) {
    if (!MODES.has(entry.score?.mode)) fail(`${id}: bad score.mode ${entry.score?.mode}`);
    if (!KINDS.has(entry.score?.kind)) fail(`${id}: bad score.kind ${entry.score?.kind}`);
    if (typeof entry.score?.label !== "string") fail(`${id}: missing score.label`);
  }

  if (!existsSync(gameFile(entry.slug)))
    fail(`${id}: game component not found at src/games/${/[0-9]/.test(entry.slug) ? `game-${entry.slug}` : entry.slug}.tsx`);
}

if (errors.length) {
  console.error(`\n✖ ${errors.length} validation error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
for (const w of warnings) console.warn(`  ⚠ ${w}`);

/* ------------------------------------------------------------------ */
/* Format + splice                                                     */
/* ------------------------------------------------------------------ */

const q = JSON.stringify; // strings (escapes quotes/newlines safely)

function formatEntry(g) {
  const L = ["  {"];
  L.push(`    slug: ${q(g.slug)},`);
  L.push(`    title: ${q(g.title)},`);
  L.push(`    category: ${q(g.category)},`);
  L.push(`    tagline: ${q(g.tagline)},`);
  L.push(`    description:`);
  L.push(`      ${q(g.description)},`);
  L.push(`    cover: { emoji: ${q(g.cover.emoji)}, gradient: ${q(g.cover.gradient)} },`);
  L.push(`    input: [${g.input.map(q).join(", ")}],`);
  L.push(`    controls: [`);
  for (const c of g.controls)
    L.push(`      { keys: ${q(c.keys)}, action: ${q(c.action)} },`);
  L.push(`    ],`);
  L.push(`    tags: [${g.tags.map(q).join(", ")}],`);
  if (g.score)
    L.push(
      `    score: { label: ${q(g.score.label)}, mode: ${q(g.score.mode)}, kind: ${q(g.score.kind)} },`,
    );
  L.push(`  },`);
  return L.join("\n");
}

const entriesText = entries.map(({ entry }) => formatEntry(entry)).join("\n");

const CATALOG_ANCHOR = "];\n\n/* ----------------------------------------------------------------- */\n/* Lookups";
if (catalogSrc.split(CATALOG_ANCHOR).length !== 2) {
  console.error("Could not find a unique insertion point in catalog.ts");
  process.exit(1);
}
const newCatalog = catalogSrc.replace(CATALOG_ANCHOR, `${entriesText}\n${CATALOG_ANCHOR}`);

const loaderLines = entries
  .map(({ entry }) => {
    const file = /^[0-9]/.test(entry.slug) ? `game-${entry.slug}` : entry.slug;
    return `  ${q(entry.slug)}: () => import("@/games/${file}"),`;
  })
  .join("\n");

const PLAYER_ANCHOR = "};\n\nfunction GameLoading() {";
if (playerSrc.split(PLAYER_ANCHOR).length !== 2) {
  console.error("Could not find a unique insertion point in game-player.tsx");
  process.exit(1);
}
const newPlayer = playerSrc.replace(
  PLAYER_ANCHOR,
  `${loaderLines}\n${PLAYER_ANCHOR}`,
);

/* ------------------------------------------------------------------ */
/* Report / write                                                      */
/* ------------------------------------------------------------------ */

const byCategory = {};
for (const { entry } of entries)
  byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;

console.log(`\n✔ ${entries.length} entries valid:`);
for (const [cat, n] of Object.entries(byCategory).sort())
  console.log(`  ${cat.padEnd(9)} ${n}`);
console.log(`  new slugs: ${[...seen].join(", ")}`);

if (dry) {
  console.log("\n(dry run — no files written)");
} else {
  writeFileSync(join(root, "src/lib/catalog.ts"), newCatalog);
  writeFileSync(join(root, "src/components/game-player.tsx"), newPlayer);
  console.log("\n✔ catalog.ts and game-player.tsx updated.");
}
