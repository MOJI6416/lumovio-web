import type { ExternalRating, MediaKind, RatingProvider, TitleExternal } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { BRAND_NAMES, type Brand, BrandMark } from "@/components/media/BrandMark";
import { ScoreMark } from "@/components/media/ScoreBadge";
import { api } from "@/lib/api";

/*
 * A title's ratings, one language for the hero, the Details tab and the TV:
 * every source's own score with its logo, its scale and the votes behind it, split into critics and audience. The
 * Lumovio Score is Lumovio's own derived number and never stands for any service's score.
 */

export const CREDIT_NAMES: Record<RatingProvider, string> = {
  imdb: "IMDb",
  mdblist: "MDBList",
  omdb: "OMDb",
  wikidata: "Wikidata",
  tvmaze: "TVmaze",
  anilist: "AniList",
};

export function useTitleExternal(kind: MediaKind, tmdbId: number) {
  return useQuery({
    queryKey: ["title-external", kind, tmdbId],
    queryFn: () => api<TitleExternal>(`/api/catalog/title/${kind}/${tmdbId}/external`),
    staleTime: 3_600_000,
    retry: 1,
  });
}

/** The "Ratings" section in Details, which the hero's ratings line opens (`?tab=details#ratings`). */
export const RATINGS_ANCHOR = "ratings";
/** "How it's calculated" for the Lumovio Score: a link to it opens the shares (`#lumovio-score`). */
export const SCORE_ANCHOR = "lumovio-score";

export type RatingItem =Omit<ExternalRating, "source" | "via"> & { source: ExternalRating["source"] | "tmdb"; via: RatingProvider | "tmdb" };
export type TitleScore = NonNullable<TitleExternal["score"]>;

/** The sources' scores plus TMDB's own, which the details already carry. */
export function ratingItems(data: TitleExternal | undefined, kind: MediaKind, tmdbId: number, tmdbRating: number | null, tmdbVotes: number | null): RatingItem[] {
  const items: RatingItem[] = [...(data?.ratings ?? [])];
  if (tmdbRating && tmdbRating > 0) {
    items.push({ source: "tmdb", via: "tmdb", score: Math.round(tmdbRating * 10), display: tmdbRating.toFixed(1), count: tmdbVotes, asOf: null, fetchedAt: null, url: `https://www.themoviedb.org/${kind}/${tmdbId}` });
  }
  return items;
}

/** Up to three in the hero: IMDb (TMDB without it) and the critics' score; the Lumovio Score is separate. */
export function heroItems(items: RatingItem[]): RatingItem[] {
  const audience = items.find((r) => r.source === "imdb") ?? items.find((r) => r.source === "tmdb");
  const critics = items.find((r) => r.source === "rotten_tomatoes") ?? items.find((r) => r.source === "metacritic");
  return [audience, critics].filter((r): r is RatingItem => Boolean(r));
}

/** The Lumovio Score where it stands on its own — the hero, the TV: as on cards, only at medium or high confidence. */
export const heroScore = (score: TitleScore | null | undefined) => (score && score.confidence !== "low" ? score : null);

/** Critics publish reviews (Tomatometer, Metascore); everyone else counts the audience's votes. */
export const ratingGroup = (source: RatingItem["source"]): "critics" | "audience" => (source === "rotten_tomatoes" || source === "metacritic" ? "critics" : "audience");

/** The scale a source scores on, written after its number ("/10"); null for a per cent, which says it by itself. */
const SCALE: Partial<Record<RatingItem["source"], 5 | 10 | 100>> = { imdb: 10, tmdb: 10, tvmaze: 10, myanimelist: 10, letterboxd: 5, metacritic: 100 };
export const ratingScale = (source: RatingItem["source"]) => SCALE[source] ?? null;

/** A whole per cent in the locale's way: "83%" in en, "83 %" in fr and de, "%83" in tr. */
export const percent = (n: number, locale: string) => new Intl.NumberFormat(locale, { style: "percent" }).format(n / 100);

/** The number as its source writes it, without its scale, with the locale's decimal sign and per cent: "8,0", "83 %", "74", "3,9". */
export function useRatingValue() {
  const locale = useLocale();
  const one = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (r: Pick<RatingItem, "source" | "display">): string => {
    const of = SCALE[r.source];
    const n = Number.parseFloat(r.display);
    if (of && Number.isFinite(n)) return of === 100 ? String(Math.round(n)) : one.format(n);
    // "83%" → "83 %" in fr/de, "%83" in tr.
    const pct = /^(\d+)%$/.exec(r.display);
    return pct ? percent(Number(pct[1]), locale) : r.display;
  };
}

/** The logo of a source, sized to the text around it; a Tomatometer or Popcornmeter under 60 is the rotten / spilled one. */
export function RatingLogo({ source, score }: { source: RatingItem["source"] | "lumovio"; score?: number }): ReactNode {
  if (source === "lumovio") return <ScoreMark className="size-4" />;
  return <BrandMark brand={source as Brand} rotten={(source === "rotten_tomatoes" || source === "rotten_tomatoes_audience") && (score ?? 100) < 60} />;
}

export const sourceName = (source: RatingItem["source"]) => BRAND_NAMES[source as Brand];

/** The votes or reviews behind a score: short for the column ("804 тыс."), whole for a screen reader ("оценок: 804 тыс."). */
export function useRatingCount() {
  const t = useTranslations("ratings");
  const locale = useLocale();
  // Two significant figures at most, as a column wants them: "804 тыс.", "3,7 млн", "62".
  const compact = new Intl.NumberFormat(locale, { notation: "compact" });
  return (r: Pick<RatingItem, "source" | "count">) => {
    if (!r.count) return null;
    const short = compact.format(r.count);
    return { short, full: ratingGroup(r.source) === "critics" ? t("reviews", { count: short }) : t("votes", { count: short }) };
  };
}

/** What makes a Lumovio Score less sure, said on its panel: "Early score", "Few ratings", "Backed by one source" (method v3). */
export function useScoreNotes() {
  const t = useTranslations("score");
  return (score: TitleScore): string[] =>
    [score.early ? t("early") : null, score.confidence === "low" ? (score.sources === 1 ? t("oneSource") : t("few")) : null].filter((x): x is string => Boolean(x));
}

/** Who the scores come from, for the foot of "Ratings". */
export const creditLine = (data: TitleExternal | undefined) => [...(data?.credits ?? []).map((c) => CREDIT_NAMES[c]), "TMDB"].join(" · ");
