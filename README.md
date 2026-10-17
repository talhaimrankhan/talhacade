# Talhacade 🎮

> **Talhacade** — *tal-HA-cade, rhymes with arcade.* Made by Talha.

A modern, gamer-aesthetic portal for browser games — **no logins, no accounts, no
servers**. Every score, favorite and "recently played" entry lives only in the
visitor's own browser (localStorage). The whole site prerenders to static HTML
and deploys anywhere static files are welcome (Vercel, Netlify, S3, GitHub Pages…).

Built with Next.js 16 (App Router, static export) + TypeScript + Tailwind CSS v4
+ Framer Motion.

## ✨ What's inside

| Genre     | Games                                                            |
| --------- | ---------------------------------------------------------------- |
| Arcade    | Neon Snake, Neon Breakout                                        |
| Puzzle    | 2048, Minesweeper (3 difficulties), Memory Flip                  |
| Strategy  | Tic-Tac-Toe (minimax), Connect Four (alpha-beta, 5 deep)         |
| Casual    | Reflex Rush (5-round reaction test), Whack-a-Mole                |

Site features:

- **Home** — hero with floating showcase cards, category grid, filterable game
  grid (Framer Motion), a "Jump back in" strip fed by localStorage, trust strip.
- **`/category/[slug]/`** — genre listing pages (prerendered, SEO-friendly).
- **`/games/[slug]/`** — game pages with in-page arcade chrome, high-score chip,
  favorite toggle, controls reference and similar-game recommendations.
- **`/favorites/`** — everything you've hearted (empty state included).
- **`sitemap.xml` + `robots.txt`** generated at build time.
- Persistent best scores per game (high-is-better or low-is-better per game),
  cross-tab sync via `storage` events.

## 🧱 Structure

```
src/
├── app/                    # Routes (all statically prerendered)
│   ├── page.tsx            # Home
│   ├── category/[slug]/    # Genre pages (generateStaticParams)
│   ├── games/[slug]/       # Game pages (generateStaticParams)
│   ├── favorites/          # localStorage-backed favorites list
│   ├── sitemap.ts robots.ts
│   └── not-found.tsx       # Styled 404
├── components/             # Header, footer, cards, game player shell…
├── games/                  # 80 games — pure client components
│   └── parts.tsx           # Shared overlay / HUD / CTA primitives
└── lib/
    ├── catalog.ts          # Categories + games data (the single source of truth)
    ├── types.ts            # Game / Category / score types
    ├── storage.ts          # useSyncExternalStore localStorage hooks
    └── utils.ts            # cn() helper
```

## 🚀 Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # static output in out/
npm run lint
```

## 🕹 Adding a game

1. Create `src/games/my-game.tsx` — a client component that accepts
   `{ gameId: string }` and reports scores through `useBestScore(gameId, mode)`
   from `@/lib/storage`:

   ```tsx
   "use client";
   import { useBestScore } from "@/lib/storage";

   export default function MyGame({ gameId }: { gameId: string }) {
     const { best, submit } = useBestScore(gameId, "high"); // "low" for times/moves
     // …on game over: setNewBest(submit(finalScore));
   }
   ```

2. Register it in `src/components/game-player.tsx` (one loader line — each game
   ships as its own lazy chunk, rendered client-only with `ssr: false`).
3. Add its entry to `games[]` in `src/lib/catalog.ts` (title, category,
   description, controls, cover emoji + gradient, `score` config).
4. Done — home grid, category page, sitemap, game page and similar-games all
   pick it up from the catalog.

> Batch additions: drop a JSON array of `Game` entries (same shape as
> `games[]`) into `catalog-entries/` and run
> `node scripts/merge-catalog.mjs` — it validates slugs/schema/files and
> splices both the catalog entries and the loader lines for you (`--dry` to
> preview).

> Games must render deterministic markup if SSR'd; random-initial-state games
> are fine because the player shell loads them with `ssr: false`.

## 🌐 Deploy

**Vercel** — import the repo, done. `next.config.ts` sets `output: "export"`, so
the build emits the static `out/` directory automatically.

**Netlify** — build command `npm run build`, publish directory `out`, and set
`NETLIFY_NEXT_PLUGIN_SKIP=true` (tells Netlify's Next.js runtime to leave a
pure static export alone).

**Remember to set your real domain** in `src/lib/catalog.ts` (`site.url`) — it
feeds `metadataBase`, Open Graph URLs, `sitemap.xml` and `robots.txt`.

## 📝 Notes

- No backend, no auth, no analytics, no cookies — by design.
- Clearing browser storage resets scores, favorites, recent games and series.
- Mobile: every game declares its input methods (`keyboard` / `mouse` / `touch`)
  in the catalog and the cards display them.
