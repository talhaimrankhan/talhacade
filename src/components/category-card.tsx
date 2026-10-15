import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { gamesInCategory } from "@/lib/catalog";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CategoryCard({ category }: { category: Category }) {
  const Icon = category.icon;
  const count = gamesInCategory(category.slug).length;

  return (
    <Link
      href={`/category/${category.slug}/`}
      className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-6 transition duration-300 hover:-translate-y-1.5 hover:border-primary/60 hover:shadow-[0_24px_54px_-26px_rgba(139,92,246,0.9)]"
    >
      <div
        aria-hidden
        className={cn(
          "absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-25 blur-2xl transition duration-500 group-hover:opacity-60",
          category.gradient,
        )}
      />
      <div
        className={cn(
          "inline-grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br shadow-lg",
          category.gradient,
        )}
      >
        <Icon className="h-6 w-6 text-white" aria-hidden />
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold tracking-wide">
          {category.name}
        </h3>
        <span className="text-xs uppercase tracking-widest text-muted">
          {count} {count === 1 ? "game" : "games"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{category.blurb}</p>

      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition group-hover:gap-2.5">
        Browse
        <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
    </Link>
  );
}
