import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameCard } from "@/components/game-card";
import { publishedCategories, getCategory, gamesInCategory } from "@/lib/catalog";

export function generateStaticParams() {
  return publishedCategories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return { title: "Category not found" };

  const count = gamesInCategory(category.slug).length;
  return {
    title: `${category.name} Games`,
    description: `${category.blurb} Play ${count} free ${category.name.toLowerCase()} ${count === 1 ? "game" : "games"} instantly in your browser — no signup, no downloads.`,
  };
}

export default async function CategoryPage({
  params,
}: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const list = gamesInCategory(category.slug);
  const Icon = category.icon;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/" className="transition hover:text-accent">
          Home
        </Link>
        <span className="mx-2 opacity-50">/</span>
        <span className="text-ink">{category.name}</span>
      </nav>

      <header className="mt-6 flex items-start gap-5">
        <span
          className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${category.gradient} shadow-[0_0_40px_-12px_rgba(139,92,246,0.9)]`}
        >
          <Icon className="h-8 w-8 text-white" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            {list.length} {list.length === 1 ? "game" : "games"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
            {category.name} Games
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            {category.blurb} {category.tagline} — play instantly, scores stay in
            your browser.
          </p>
        </div>
      </header>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((game) => (
          <GameCard key={game.slug} slug={game.slug} />
        ))}
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-muted">
          Looking for a different vibe?
        </p>
        <Link
          href="/#categories"
          className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-95"
        >
          See all {publishedCategories.length} categories
        </Link>
      </div>
    </div>
  );
}
