import type { LucideIcon } from "lucide-react";

export type InputType = "keyboard" | "mouse" | "touch";

export type CategorySlug = "arcade" | "puzzle" | "strategy" | "casual";

export interface Category {
  slug: CategorySlug;
  name: string;
  tagline: string;
  blurb: string;
  icon: LucideIcon;
  /** Tailwind gradient classes (literal — required for class detection). */
  gradient: string;
}

export interface GameControl {
  keys: string;
  action: string;
}

export interface GameScore {
  label: string;
  mode: "high" | "low";
  kind: "points" | "seconds" | "ms" | "moves";
}

export interface Game {
  slug: string;
  title: string;
  category: CategorySlug;
  tagline: string;
  description: string;
  cover: {
    emoji: string;
    /** Tailwind gradient classes (literal — required for class detection). */
    gradient: string;
  };
  input: InputType[];
  controls: GameControl[];
  tags: string[];
  featured?: boolean;
  /** Omitted when a game only tracks a session series (e.g. Tic-Tac-Toe). */
  score?: GameScore;
}
