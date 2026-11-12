"use client";

import type { Genre, ListRules } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Tag } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { api } from "@/lib/api";
import { MOOD_NAME } from "@/lib/discover";
import { formatRuntime, languageName } from "@/lib/format";

const SORT_KEY = {
  popularity: "sortPopularity",
  rating: "sortRating",
  release_desc: "sortNewest",
  release_asc: "sortOldest",
  title: "sortTitle",
  votes: "sortVotes",
  imdb: "sortImdb",
  imdb_votes: "sortImdbVotes",
  lumovio: "sortLumovio",
  rt: "sortRt",
  metacritic: "sortMetacritic",
} as const;

/** TMDB keyword "tv special" (the grid's "No TV specials"). */
const TV_SPECIAL_KEYWORD = "264598";

/**
 * A smart list's conditions in words, in the catalog's and the library's own words: the section, genres,
 * years, rating, length… and the sort that picks the first hundred; the personal ones last. The genres' names load
 * with the section's list of genres (`known` — the ones a page already has; a name not known yet isn't shown as a number).
 */
export function useRuleWords(rules: ListRules, known?: Genre[]): string[] {
  const t = useTranslations("library");
  const tb = useTranslations("browse");
  const tr = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  const q = rules.from === "catalog" ? rules.query : null;
  const genres = useQuery({
    queryKey: ["catalog-genres", q?.kind],
    queryFn: () => api<{ genres: Genre[] }>(`/api/catalog/genres/${q!.kind}`),
    enabled: Boolean(q && (q.genres || q.withoutGenres)),
    staleTime: 24 * 3600_000,
  });
  const minutes = (m: number) => formatRuntime(m, (k, v) => tr(k as "common.minutes", v)) ?? "";
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  const names = (ids: string | undefined) =>
    (ids ?? "")
      .split(",")
      .filter(Boolean)
      .map((id) => (genres.data?.genres ?? known)?.find((g) => String(g.id) === id)?.name)
      .filter((n): n is string => Boolean(n));
  const personal = [rules.onServers && t("filterOnServers"), rules.unwatched && t("rulesUnwatched")];

  if (rules.from === "library") {
    return [
      ...rules.lists.map((list) => t("rulesFromList", { list })),
      rules.show === "movie" ? t("filterMovies") : rules.show === "tv" ? t("filterSeries") : null,
      rules.max ? t("filterRuntimeMax", { time: minutes(rules.max) }) : null,
      rules.status ? (rules.status === "ended" ? tb("statusEnded") : tb("statusReturning")) : null,
      ...personal,
    ].filter((w): w is string => Boolean(w));
  }

  const query = rules.query;
  const years =
    query.yearFrom && query.yearTo
      ? query.yearFrom === query.yearTo
        ? String(query.yearFrom)
        : `${query.yearFrom}–${query.yearTo}`
      : query.yearFrom
        ? t("rulesYearFrom", { year: String(query.yearFrom) })
        : query.yearTo
          ? t("rulesYearTo", { year: String(query.yearTo) })
          : null;
  return [
    ...(query.anime ? [tb("titleAnime"), query.kind === "movie" ? tb("titleMovies") : null] : [query.kind === "movie" ? tb("titleMovies") : tb("titleSeries")]),
    ...names(query.genres).map(cap),
    ...names(query.withoutGenres).map((genre) => tb("without", { genre })),
    years,
    query.ratingMin ? `${tb("minRating")} ${format.number(query.ratingMin)}` : null,
    query.language ? `${tb("originalLanguage")}: ${languageName(query.language, locale) ?? query.language}` : null,
    query.runtimeMax ? tb("runtimeMax", { time: minutes(query.runtimeMax) }) : null,
    query.tvType ? (query.tvType === "mini" ? tb("typeMini") : tb("typeScripted")) : null,
    query.tvStatus ? (query.tvStatus === "ended" ? tb("statusEnded") : tb("statusReturning")) : null,
    query.episodesMax ? tb("episodesMax", { count: query.episodesMax }) : null,
    query.votesMin ? tb("votesMin", { count: query.votesMin }) : null,
    query.votesMax ? tb("votesMax", { count: query.votesMax }) : null,
    query.withoutKeywords?.split(",").includes(TV_SPECIAL_KEYWORD) ? tb("noSpecials") : null,
    query.imdbVotesMax ? tb("imdbVotesMax", { count: query.imdbVotesMax }) : null,
    query.opinions ? tb("criticsHigher") : null,
    query.mood ? tb("mood", { name: tr(`rows.${MOOD_NAME[query.mood]}`) }) : null,
    tb(SORT_KEY[query.sort]),
    ...personal,
  ].filter((w): w is string => Boolean(w));
}

/** The conditions as neutral labels (Tag: they say something about the list, none is a control). */
export function RuleTags({ rules, label, known, className }: { rules: ListRules; label: string; known?: Genre[]; className?: string }) {
  const words = useRuleWords(rules, known);
  return (
    <ul aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {words.map((w) => (
        <li key={w}>
          <Tag>{w}</Tag>
        </li>
      ))}
    </ul>
  );
}
