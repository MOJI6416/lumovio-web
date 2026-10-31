"use client";

import type { SeriesStatus } from "@lumovio/contracts";
import { useSearchParams } from "next/navigation";

/**
 * A page's filters and sort in the address (8.4, 8.7), changed without a server round trip: the native History API
 * keeps `useSearchParams` in step (Next.js), so a chip answers at once instead of re-rendering the page on the server
 * (LIB-10), and Back from a title still finds them in the URL.
 */
export function useUrlState() {
  const params = useSearchParams();
  const set = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const qs = sp.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };
  return { params, set };
}

/** The library's filters: kept when another tab is opened (LIB-10); the sort belongs to its tab. */
export const FILTER_KEYS = ["show", "max", "status", "avail", "unwatched"] as const;

export interface LibraryFilters {
  show: "movie" | "tv" | null;
  max: number | null;
  /** Series by status, as in the catalog; only with "Series" chosen. */
  status: SeriesStatus | null;
  onServers: boolean;
  unwatched: boolean;
}

export function readFilters(params: URLSearchParams | { get: (k: string) => string | null }): LibraryFilters {
  const show = params.get("show");
  const max = Number(params.get("max"));
  const status = params.get("status");
  return {
    show: show === "movie" || show === "tv" ? show : null,
    max: Number.isInteger(max) && max > 0 ? max : null,
    status: show === "tv" && (status === "ended" || status === "returning") ? status : null,
    onServers: params.get("avail") === "1",
    unwatched: params.get("unwatched") === "1",
  };
}

/** A sort from the address, if it is one the tab knows. */
export function readSort<S extends string>(params: { get: (k: string) => string | null }, sorts: readonly S[], fallback: S): S {
  const s = params.get("sort");
  return sorts.includes(s as S) ? (s as S) : fallback;
}

/** The rating a card shows (Lumovio Score → IMDb → TMDB, 7.12) on one 0–10 scale, for "By rating". */
export function cardRating(t: { lumovioScore?: { score: number } | null; imdbRating?: number | null; tmdbRating?: number | null }): number {
  if (t.lumovioScore) return t.lumovioScore.score / 10;
  return t.imdbRating ?? t.tmdbRating ?? -1;
}
