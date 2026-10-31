import type { ExternalRating, MediaKind, RatingProvider, TitleExternal } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { BRAND_NAMES, type Brand, BrandMark } from "@/components/media/BrandMark";
import { ScoreMark } from "@/components/media/ScoreBadge";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

/*
 * A title's ratings, one way for the hero's chips, "All ratings" and the Details tab (design-system 1.3, 7.14 item 3,
 * TTL-10, X-20): every source's own score with its logo, how many votes stand behind it, when and by whom it was
 * delivered. The Lumovio Score is Lumovio's own derived number and never stands for any service's score.
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

export type RatingItem = Omit<ExternalRating, "source" | "via"> & { source: ExternalRating["source"] | "tmdb"; via: RatingProvider | "tmdb" };

/** The sources' scores plus TMDB's own, which the details already carry. */
export function ratingItems(data: TitleExternal | undefined, kind: MediaKind, tmdbId: number, tmdbRating: number | null, tmdbVotes: number | null): RatingItem[] {
  const items: RatingItem[] = [...(data?.ratings ?? [])];
  if (tmdbRating && tmdbRating > 0) {
    items.push({ source: "tmdb", via: "tmdb", score: Math.round(tmdbRating * 10), display: tmdbRating.toFixed(1), count: tmdbVotes, asOf: null, fetchedAt: null, url: `https://www.themoviedb.org/${kind}/${tmdbId}` });
  }
  return items;
}

/** Up to three in the hero (owner's decision 1.3): IMDb (TMDB without it) and the critics' score; the Lumovio Score is separate. */
export function heroItems(items: RatingItem[]): RatingItem[] {
  const audience = items.find((r) => r.source === "imdb") ?? items.find((r) => r.source === "tmdb");
  const critics = items.find((r) => r.source === "rotten_tomatoes") ?? items.find((r) => r.source === "metacritic");
  return [audience, critics].filter((r): r is RatingItem => Boolean(r));
}

const OUT_OF_10 = new Set(["imdb", "tmdb", "tvmaze", "myanimelist"]);

/** A whole per cent in the locale's way (2.3): "83%" in en, "83 %" in fr and de, "%83" in tr. */
export const percent = (n: number, locale: string) => new Intl.NumberFormat(locale, { style: "percent" }).format(n / 100);

/** The value as its source writes it, with the locale's decimal sign and per cent (2.3): "8,0", "83 %", "74", "3,9/5". */
export function useRatingValue() {
  const locale = useLocale();
  const one = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const decimal = one.formatToParts(1.5).find((p) => p.type === "decimal")?.value ?? ".";
  return (r: Pick<RatingItem, "source" | "display">): string => {
    if (OUT_OF_10.has(r.source)) {
      const n = Number.parseFloat(r.display);
      return Number.isFinite(n) ? one.format(n) : r.display;
    }
    if (r.source === "metacritic") return r.display.replace(/[/]100$/, "");
    // "83%" → "83 %" in fr/de, "%83" in tr.
    const pct = /^(\d+)%$/.exec(r.display);
    if (pct) return percent(Number(pct[1]), locale);
    // "3.9/5" → "3,9/5" in ru/uk.
    return r.display.replace(/(\d)\.(\d)/, `$1${decimal}$2`);
  };
}

/** The logo of a source, 16 px tall in a chip. */
export function RatingLogo({ source, score }: { source: RatingItem["source"] | "lumovio"; score?: number }): ReactNode {
  if (source === "lumovio") return <ScoreMark className="size-4" />;
  return <BrandMark brand={source as Brand} rotten={source === "rotten_tomatoes" && (score ?? 100) < 60} />;
}

export const sourceName = (source: RatingItem["source"]) => BRAND_NAMES[source as Brand];

/** "1.2M votes · as of 24 Oct 2026 · via MDBList": what stands behind a score and who delivered it. */
export function useRatingMeta() {
  const t = useTranslations("ratings");
  const locale = useLocale();
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  return (r: Pick<RatingItem, "source" | "count" | "asOf" | "fetchedAt" | "via">): string[] =>
    [
      r.count ? (r.source === "rotten_tomatoes" || r.source === "metacritic" ? t("reviews", { count: compact.format(r.count) }) : t("votes", { count: compact.format(r.count) })) : null,
      r.asOf
        ? t("asOf", { date: formatDate(r.asOf, locale, { dateStyle: "medium" }) ?? r.asOf })
        : r.fetchedAt
          ? t("fetched", { date: formatDate(r.fetchedAt, locale, { dateStyle: "medium" }) ?? r.fetchedAt })
          : null,
      r.via !== r.source && r.via !== "tmdb" ? t("via", { provider: CREDIT_NAMES[r.via] }) : null,
    ].filter((x): x is string => Boolean(x));
}

/** Who the scores come from, for the "i" and the foot of "All ratings". */
export const creditLine = (data: TitleExternal | undefined) => [...(data?.credits ?? []).map((c) => CREDIT_NAMES[c]), "TMDB"].join(" · ");
