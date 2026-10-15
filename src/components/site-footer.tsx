import { categories, site } from "@/lib/catalog";
import { Gamepad2 } from "lucide-react";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line/70 bg-surface/40 backdrop-blur">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500">
              <Gamepad2 className="h-4 w-4 text-white" aria-hidden />
            </span>
            <span className="font-display text-base font-bold tracking-wider">
              <span className="text-ink">NEON</span>
              <span className="text-gradient">ARCADE</span>
            </span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            {site.tagline} Every game loads straight into your browser — no
            accounts, no downloads, no waiting rooms. Just hit play.
          </p>
        </div>

        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted">
            Categories
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/category/${category.slug}/`}
                  className="text-muted transition hover:text-accent"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted">
            Your data
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            No accounts. No cookies. No tracking. High scores, favorites and
            recent games live only in this browser&apos;s storage — clear them
            any time from your browser settings.
          </p>
        </div>
      </div>

      <div className="border-t border-line/70 py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} {site.name} · Built for players, not
        profiles.
      </div>
    </footer>
  );
}
