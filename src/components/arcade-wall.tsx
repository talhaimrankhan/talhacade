import Link from "next/link";
import { gamesBySlugs, wallSlugs } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * Two columns of game tiles scrolling in opposite directions (pure CSS).
 * Hovering the wall pauses it so tiles can be clicked. Respects
 * prefers-reduced-motion via the global animation toggle.
 */

function Column({ slugs, direction }: { slugs: readonly string[]; direction: "up" | "down" }) {
  const tiles = gamesBySlugs(slugs);
  // Duplicate the set so the -50% keyframe loops seamlessly.
  const loop = [...tiles, ...tiles];

  return (
    <div className="w-1/2 overflow-hidden">
      <div
        className={cn(
          "flex flex-col",
          direction === "up" ? "animate-wall-up" : "animate-wall-down",
        )}
      >
        {loop.map((game, i) => (
          <Link
            key={`${game.slug}-${i}`}
            href={`/games/${game.slug}/`}
            className="group mb-3 block overflow-hidden rounded-xl border border-line bg-surface shadow-[0_18px_44px_-26px_rgba(0,0,0,0.95)] transition duration-300 hover:-translate-y-1 hover:border-primary/60"
          >
            <div
              className={cn(
                "scanlines relative grid h-24 place-items-center bg-gradient-to-br",
                game.cover.gradient,
              )}
            >
              <span className="text-4xl drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)] transition duration-300 group-hover:scale-110">
                {game.cover.emoji}
              </span>
            </div>
            <div className="truncate px-3 py-2 font-display text-xs font-semibold tracking-wide">
              {game.title}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ArcadeWall() {
  return (
    <div
      className="arcade-wall flex h-[460px] gap-3"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent, black 14%, black 86%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent, black 14%, black 86%, transparent)",
      }}
    >
      <Column slugs={wallSlugs.slice(0, 5)} direction="up" />
      <Column slugs={wallSlugs.slice(5, 10)} direction="down" />
    </div>
  );
}
