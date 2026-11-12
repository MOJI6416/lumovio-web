"use client";

import { useSyncExternalStore } from "react";

/**
 * The season picked in a series' "Episodes" on its page, shared with the hero's "Watch" and "Where to watch" so all three
 * mean the same season (docs/torrserver-2026-11.md, 21). Only a pick by the person counts — opening on the season the
 * profile is in is no choice; it lives while the page does (`SeasonBrowser` forgets it when it unmounts).
 */
const chosen = new Map<string, number>();
const listeners = new Set<() => void>();

export function chooseSeason(titleId: string, season: number | null) {
  if (season === null) chosen.delete(titleId);
  else chosen.set(titleId, season);
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useChosenSeason(titleId: string): number | null {
  return useSyncExternalStore(
    subscribe,
    () => chosen.get(titleId) ?? null,
    () => null,
  );
}
