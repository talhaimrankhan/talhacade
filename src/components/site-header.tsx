import { Gamepad2 } from "lucide-react";
import Link from "next/link";
import { FavoritesLink } from "@/components/favorites-link";
import { RandomButton } from "@/components/random-button";

const navLink =
  "rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-ink";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-[0_0_26px_-6px_rgba(139,92,246,0.9)] transition group-hover:scale-105">
            <Gamepad2 className="h-5 w-5 text-white" aria-hidden />
          </span>
          <span className="font-display text-lg font-bold tracking-wider">
            <span className="text-ink">TALHA</span>
            <span className="text-gradient">CADE</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/" className={`${navLink} hidden sm:block`}>
            Home
          </Link>
          <Link href="/games/" className={`${navLink} hidden sm:block`}>
            Games
          </Link>
          <Link href="/#categories" className={`${navLink} hidden sm:block`}>
            Categories
          </Link>
          <FavoritesLink />
          <RandomButton />
        </nav>
      </div>
    </header>
  );
}
