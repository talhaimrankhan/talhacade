"use client";

import { useEffect } from "react";
import { recordPlayed } from "@/lib/achievements";
import { useRecent } from "@/lib/storage";

/** Silently remembers which games this browser has opened. */
export function RecentTracker({ slug }: { slug: string }) {
  const { record } = useRecent();

  useEffect(() => {
    record(slug);
    recordPlayed(slug);
  }, [slug, record]);

  return null;
}
