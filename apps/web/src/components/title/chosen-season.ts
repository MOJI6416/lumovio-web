"use client";

import type { SeasonDetails, TitleDetails, TitleLibraryState } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { isOut, startEpisode } from "./core";

/*
 * The season a person picked in a series' "Episodes" (SeasonBrowser), per title in this tab: "Where to watch" and its
 * "Watch" follow it (the owner, 2026-11-08: "I changed the season, pressed Watch, and the old one played"). The hero's
 * "Continue" stays where the profile is, and says which episode that is.
 */
const chosen = new Map<string, number>();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function chooseSeason(titleId: string, season: number): void {
  chosen.set(titleId, season);
  for (const l of listeners) l();
}

/**
 * The episode "Where to watch" starts: `startEpisode` (where the profile is), unless another season was picked in
 * "Episodes" — then that season's first aired episode not watched yet, else its first.
 */
export function useWatchStart(d: Pick<TitleDetails, "id" | "kind" | "tmdbId" | "seasons" | "nextEpisode">, lib: TitleLibraryState | null | undefined): { season: number; episode: number } | null {
  const locale = useLocale();
  const picked = useSyncExternalStore(subscribe, () => chosen.get(d.id) ?? null, () => null);
  const start = d.kind === "tv" ? startEpisode(d, lib?.progress) : null;
  const other = start !== null && picked !== null && picked !== start.season;
  // The same query as the season browser's (cached by it).
  const q = useQuery({
    queryKey: ["season", d.tmdbId, picked ?? 0, locale],
    queryFn: () => api<SeasonDetails>(`/api/catalog/tv/${d.tmdbId}/season/${picked}`),
    enabled: other,
    staleTime: 30 * 60_000,
  });
  return other ? firstToWatch(picked, q.data?.episodes ?? [], lib?.watchedEpisodes ?? []) : start;
}

/** A season's first aired episode not watched yet (`watched`: "s2e3"), else its first. */
export function firstToWatch(season: number, episodes: { episodeNumber: number; airDate: string | null }[], watched: readonly string[]): { season: number; episode: number } {
  const seen = new Set(watched);
  const next = episodes.find((e) => isOut(e.airDate) && !seen.has(`s${season}e${e.episodeNumber}`)) ?? episodes[0];
  return { season, episode: next?.episodeNumber ?? 1 };
}

/** The player's address for a start: where the profile is resumes (`watchHref`); another episode starts from its beginning. */
export const startHref = (d: Pick<TitleDetails, "kind" | "tmdbId">, ep: { season: number; episode: number } | null, resume: string) =>
  ep && !resume.includes(`?s=${ep.season}&e=${ep.episode}`) ? `/watch/${d.kind}/${d.tmdbId}?s=${ep.season}&e=${ep.episode}` : resume;
