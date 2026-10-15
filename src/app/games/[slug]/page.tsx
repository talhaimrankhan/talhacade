import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FavoriteButton } from "@/components/favorite-button";
import { GameCard } from "@/components/game-card";
import { GamePlayer } from "@/components/game-player";
import { RecentTracker } from "@/components/recent-tracker";
import { ScoreChip } from "@/components/score-chip";
import { getCategory, getGame, games, similarGames } from "@/lib/catalog";

export function generateStaticParams() {
  return games.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/games/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) return { title: "Game not found" };

  return {
    title: `${game.title} — Play Free in Your Browser`,
    description: `${game.tagline} ${game.description}`.slice(0, 158),
    openGraph: {
      title: `${game.title} · Talhacade`,
      description: game.tagline,
      type: "website",
    },
  };
}

const inputLabels: Record<string, string> = {
  keyboard: "Keyboard",
  mouse: "Mouse",
  touch: "Touch",
};

export default async function GamePage({
  params,
}: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();

  const category = getCategory(game.category);
  const similar = similarGames(game, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <RecentTracker slug={game.slug} />

      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/" className="transition hover:text-accent">
          Home
        </Link>
        <span className="mx-2 opacity-50">/</span>
        <Link
          href={`/category/${game.category}/`}
          className="transition hover:text-accent"
        >
          {category?.name}
        </Link>
        <span className="mx-2 opacity-50">/</span>
        <span className="text-ink">{game.title}</span>
      </nav>

      {/* title row */}
      <header className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-3xl ${game.cover.gradient} shadow-[0_0_36px_-12px_rgba(139,92,246,0.9)]`}
            aria-hidden
          >
            {game.cover.emoji}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">
                {game.title}
              </h1>
              <Link
                href={`/category/${game.category}/`}
                className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted transition hover:border-primary/50 hover:text-ink"
              >
                {category?.name}
              </Link>
            </div>
            <p className="mt-1 text-sm text-muted">{game.tagline}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ScoreChip slug={game.slug} />
          <FavoriteButton slug={game.slug} title={game.title} />
        </div>
      </header>

      {/* game frame */}
      <div className="mt-7 rounded-3xl border border-line bg-surface/70 p-3 shadow-[0_36px_90px_-46px_rgba(139,92,246,0.95)] backdrop-blur sm:p-4">
        <div className="mb-3 flex items-center justify-between px-2">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-rose-500/80" />
            <span className="h-3 w-3 rounded-full bg-warn/80" />
            <span className="h-3 w-3 rounded-full bg-success/80" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
            talhacade // {game.slug}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-[#0b0b16]">
          <GamePlayer slug={game.slug} />
        </div>
      </div>

      {/* details */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="panel p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">About this game</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
            {game.description}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {game.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-muted"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="font-display text-lg font-semibold">Controls</h2>
          <ul className="mt-4 space-y-3">
            {game.controls.map((control) => (
              <li key={control.keys} className="flex items-start gap-3">
                <kbd className="mt-0.5 shrink-0 rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] font-semibold text-ink">
                  {control.keys}
                </kbd>
                <span className="text-sm text-muted">{control.action}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-[11px] uppercase tracking-widest text-muted">
              Works with
            </p>
            <p className="mt-1.5 text-sm text-ink">
              {game.input.map((i) => inputLabels[i]).join(" · ")}
            </p>
          </div>
        </div>
      </div>

      {/* similar */}
      <section className="mt-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              Keep playing
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">
              You might also like
            </h2>
          </div>
          <Link
            href="/#games"
            className="text-sm text-muted transition hover:text-accent"
          >
            All games →
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {similar.map((g) => (
            <GameCard key={g.slug} slug={g.slug} />
          ))}
        </div>
      </section>
    </div>
  );
}
