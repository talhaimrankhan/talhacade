import { CategoriesGrid } from "@/components/categories-grid";
import { GamesSection } from "@/components/games-section";
import { RecentlyPlayed } from "@/components/recently-played";
import { publishedCategories, games, site } from "@/lib/catalog";
import { Cookie, MonitorSmartphone, Timer } from "lucide-react";
import Link from "next/link";

const showcasePositions = [
  "left-[4%] top-[6%] -rotate-6 animate-float",
  "right-[2%] top-[30%] rotate-[5deg] animate-float-slow",
  "left-[12%] bottom-[4%] rotate-3 animate-float",
];

const features = [
  {
    icon: Timer,
    title: "Zero load times",
    text: "Every game boots instantly in a canvas tab. No installs, no launchers, no waiting rooms.",
  },
  {
    icon: Cookie,
    title: "Nothing on our servers",
    text: "Scores, favorites and history live in your browser's storage — and nowhere else, ever.",
  },
  {
    icon: MonitorSmartphone,
    title: "Plays anywhere",
    text: "Keyboard, mouse or touchscreen — every game is labeled for how you're playing today.",
  },
];

export default function HomePage() {
  const showcase = games.filter((g) => g.featured).slice(0, 3);

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-2 lg:pb-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-400">
              No signup · No downloads · No servers
            </span>

            <h1 className="mt-7 font-display text-4xl font-bold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">
              THE ARCADE
              <br />
              THAT NEVER ASKS
              <br />
              <span className="text-gradient">FOR A LOGIN.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              {site.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#games"
                className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-[0_0_34px_-10px_rgba(139,92,246,0.95)] transition hover:brightness-110 active:scale-95 sm:text-base"
              >
                Start playing
              </a>
              <Link
                href="/#categories"
                className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-bold text-ink transition hover:border-primary/50 hover:bg-surface-2 active:scale-95 sm:text-base"
              >
                Browse categories
              </Link>
            </div>

            <dl className="mt-11 grid max-w-md grid-cols-3 gap-5">
              {[
                { value: games.length, label: "Games" },
                { value: publishedCategories.length, label: "Genres" },
                { value: 0, label: "Accounts" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="font-display text-3xl font-bold text-gradient sm:text-4xl">
                    {stat.value}
                  </dd>
                  <dd className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* floating showcase */}
          <div className="relative hidden h-[440px] lg:block">
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-violet-600/40 to-cyan-500/30 blur-3xl"
            />
            {showcase.map((game, i) => (
              <Link
                key={game.slug}
                href={`/games/${game.slug}/`}
                className={`group absolute w-60 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_28px_70px_-30px_rgba(0,0,0,0.9)] transition hover:-translate-y-2 hover:border-primary/60 ${showcasePositions[i]}`}
              >
                <div
                  className={`scanlines relative grid h-32 place-items-center bg-gradient-to-br ${game.cover.gradient}`}
                >
                  <span className="text-5xl drop-shadow-[0_8px_18px_rgba(0,0,0,0.5)] transition group-hover:scale-125">
                    {game.cover.emoji}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="font-display text-sm font-semibold tracking-wide">
                    {game.title}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent opacity-0 transition group-hover:opacity-100">
                    Play →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- recent ---------------- */}
      <div className="pt-6">
        <RecentlyPlayed />
      </div>

      {/* ---------------- categories ---------------- */}
      <section id="categories" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              Pick your poison
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
              Browse by category
            </h2>
          </div>
        </div>
        <CategoriesGrid />
      </section>

      {/* ---------------- all games ---------------- */}
      <section id="games" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-8 sm:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              The collection
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
              Hit play, that&apos;s it
            </h2>
          </div>
          <p className="text-sm text-muted">
            Every title runs the moment you click — no login wall, ever.
          </p>
        </div>
        <GamesSection />
      </section>

      {/* ---------------- why strip ---------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="panel p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500/25 to-cyan-500/25 text-primary">
                <feature.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {feature.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
