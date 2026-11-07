"use client";

import { startTransition, useReducer } from "react";
import { LoadMore } from "@/components/ui/LoadMore";

/** Cards or rows drawn at a time, as in a list (LIB-14): a 7 000-title Watchlist isn't drawn all at once. */
export const SHOW_PAGE = 60;

/**
 * How many were shown, per tab and its filters and sort (`key`): kept for the visit, so Back from a title finds as many
 * drawn as were left (8.4: the position survives Back), and a new filter or sort starts from the first 60 again.
 */
const shownFor = new Map<string, number>();

/**
 * The number to draw for `key` and "Show more", which draws the next `SHOW_PAGE` as a transition: React draws them in
 * slices, so the click doesn't become one long task (INP). The rows or cards already shown are memoised by the caller.
 */
export function useShowMore(key: string) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const limit = shownFor.get(key) ?? SHOW_PAGE;
  const more = () => {
    shownFor.set(key, limit + SHOW_PAGE);
    startTransition(redraw);
  };
  return { limit, more };
}

/** "Show more" under the grid, centred (8.4), with "Showing 60 of 7 088" under it; nothing once all are shown (ui/LoadMore). */
export function ShowMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  return <LoadMore onMore={onMore} shown={shown} total={total} />;
}
