import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-3xl place-items-center px-4 py-24 text-center sm:px-6">
      <p className="font-mono text-7xl font-bold text-gradient sm:text-9xl">404</p>
      <h1 className="mt-6 font-display text-2xl font-bold sm:text-3xl">
        This level doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        The page you&apos;re after fell off the map. Head back to the arcade and
        pick a game that does exist.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-95"
        >
          Back to the arcade
        </Link>
        <Link
          href="/#games"
          className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-bold text-ink transition hover:border-primary/50 active:scale-95"
        >
          Browse games
        </Link>
      </div>
    </div>
  );
}
