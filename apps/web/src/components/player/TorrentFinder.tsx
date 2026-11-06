"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import type { FinderProps } from "./finder";

export type { FinderPick, FinderStart } from "./finder";

/*
 * "Through TorrServer" on the sources screen (design-system 7.15 «Экран источников», S26; SRC-07…SRC-13): the
 * profile's own indexers searched through its own TorrServer, straight from this device (Lumovio's servers never
 * search, store or relay torrents). The screen itself is sources/ReleaseFinder, a chunk of its own: playing a copy
 * never loads it, and it is fetched while the page is idle, so "Another source" finds it ready.
 */
const load = () => import("@/components/sources/ReleaseFinder").then((m) => m.ReleaseFinder);
if (typeof window !== "undefined") {
  const go = () => void load();
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 2000);
}

/** The card's place while its code arrives: the same layout as the card, quiet. */
function Placeholder() {
  return (
    <div aria-hidden className="rounded-lg bg-surface-1 p-4 sm:p-6">
      <div className="flex items-start gap-4">
        <Skeleton shape="full" className="size-12 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:pt-0.5">
          <Skeleton className="h-5 w-3/5 max-w-80" />
          <Skeleton className="h-4 w-2/5 max-w-56" />
        </div>
      </div>
      <Skeleton shape="full" className="mt-5 h-12 w-40 max-sm:w-full" />
    </div>
  );
}

export const TorrentFinder = dynamic<FinderProps>(load, { ssr: false, loading: Placeholder });
