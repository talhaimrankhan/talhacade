import { ArcadeWall } from "@/components/arcade-wall";
import { CategoriesGrid } from "@/components/categories-grid";
import { GamesSection } from "@/components/games-section";
import { JsonLd } from "@/components/json-ld";
import { RandomButton } from "@/components/random-button";
import { RecentlyPlayed } from "@/components/recently-played";
import { Shelf } from "@/components/shelf";
import {
  popularSlugs,
  publishedCategories,
  games,
  site,
  trendingSlugs,
} from "@/lib/catalog";
import { faqs } from "@/lib/faq";
import {
  Cookie,
  MonitorSmartphone,
  Plus,
  RotateCcw,
  ShieldCheck,
  Timer,
} from "lucide-react";
import Link from "next/link";

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
  {
    icon: RotateCcw,
    title: "One-click restarts",
    text: "Wiped out? You're back in the run instantly. No continue screens, no lives to buy.",
  },
  {
    icon: ShieldCheck,
    title: "No ads, no popups",
    text: "Nothing interrupts a run — no pre-roll, no overlay, no cookie banner marathon.",
  },
  {
    icon: Timer,
    title: "Free forever",
    text: `All ${games.length} games cost nothing to play, and that is not changing.`,
  },
];

export default function HomePage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <JsonLd data={faqLd} />
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
                href="/games/"
                className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-bold text-ink transition hover:border-primary/50 hover:bg-surface-2 active:scale-95 sm:text-base"
              >
                Browse all games
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

          {/* auto-scrolling arcade wall */}
          <div className="relative hidden lg:block">
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-violet-600/40 to-cyan-500/30 blur-3xl"
            />
            <ArcadeWall />
            <p className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-surface/90 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted backdrop-blur">
              {games.length} games and counting
            </p>
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

      {/* ---------------- curated shelves ---------------- */}
      <Shelf
        eyebrow="The heavy hitters"
        title="Popular right now"
        blurb="The evergreen picks players keep coming back to — beat a high score and see why."
        slugs={popularSlugs}
      />
      <Shelf
        eyebrow="Fresh spins"
        title="Trending this week"
        blurb="Newer arrivals that are getting a lot of plays — drift, siege, dunk and duel."
        slugs={trendingSlugs}
      />

      {/* ---------------- all games preview ---------------- */}
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

      {/* ---------------- why talhacade ---------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            Why Talhacade
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            Built like a real arcade, run like none other
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
            No accounts, no storefront, no algorithm. Just a wall of games that
            start the second you click them.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* ---------------- faq ---------------- */}
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Good questions
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
          The fine print, in plain words
        </h2>
        <div className="mt-7 space-y-3">
          {faqs.map((faq) => (
            <details key={faq.q} className="group panel p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-sm font-semibold [&::-webkit-details-marker]:hidden">
                {faq.q}
                <Plus
                  className="h-4 w-4 shrink-0 text-accent transition group-open:rotate-45"
                  aria-hidden
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------------- cta ---------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-6 pt-10 sm:px-6">
        <div className="panel relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600/15 via-surface to-cyan-500/10 p-8 text-center sm:p-12">
          <div
            aria-hidden
            className="absolute left-1/2 top-0 h-56 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/25 blur-3xl"
          />
          <h2 className="relative font-display text-2xl font-bold sm:text-3xl">
            Can&apos;t decide where to start?
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted sm:text-base">
            Let the arcade pick for you — one click, one random game, zero
            decisions.
          </p>
          <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
            <RandomButton />
            <Link
              href="/games/"
              className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-bold text-ink transition hover:border-primary/50 hover:bg-surface-2 active:scale-95"
            >
              Or browse all {games.length} games
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
