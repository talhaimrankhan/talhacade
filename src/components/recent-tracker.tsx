"use client";

import { useEffect } from "react";
import { useRecent } from "@/lib/storage";

/** Silently remembers which games this browser has opened. */
export function RecentTracker({ slug }: { slug: string }) {
  const { record } = useRecent();

  useEffect(() => {
    record(slug);
  }, [slug, record]);

  return null;
}
