import type { TitleSummary } from "@lumovio/contracts";
import { clsx } from "clsx";
import { useLocale } from "next-intl";
import { BRAND_NAMES, BrandMark } from "./BrandMark";
import { ScoreBadge } from "./ScoreBadge";

type Rated = Pick<TitleSummary, "imdbRating" | "tmdbRating" | "lumovioScore" | "sortScore">;

// One formatter per locale and style: a shelf page draws hundreds of cards, and a new Intl.NumberFormat each cost
// ~100 ms of a phone's render.
const formatters = new Map<string, Intl.NumberFormat>();
const formatter = (locale: string, style: "one" | "percent") => {
  const key = `${locale} ${style}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, style === "one" ? { minimumFractionDigits: 1, maximumFractionDigits: 1 } : { style: "percent" });
    formatters.set(key, f);
  }
  return f;
};

/**
 * The one score of a card: in a grid sorted by a score (IMDb's, Rotten Tomatoes', Metacritic's) that score, so the card
 * says what the order is by; else the Lumovio Score (null here: it draws itself, ScoreBadge), else IMDb's, else
 * TMDB's. Decimals in the locale's style (7,8 in ru/uk, 7.8 in en); the Tomatometer in per cent, also in the
 * locale's style ("84%", "84 %" in fr and de, "%84" in tr, as the title page's ratings say it), the Metascore as a number
 * of 100.
 */
function cardScore(t: Rated, locale: string): { brand: "imdb" | "rotten_tomatoes" | "metacritic" | "tmdb"; value: string; rotten?: boolean } | null {
  const one = (v: number) => formatter(locale, "one").format(v);
  const s = t.sortScore;
  if (s?.source === "rotten_tomatoes") return { brand: s.source, value: formatter(locale, "percent").format(s.value / 100), rotten: s.value < 60 };
  if (s?.source === "metacritic") return { brand: s.source, value: String(s.value) };
  if (t.lumovioScore && !s) return null;
  const imdb = s?.value ?? t.imdbRating;
  if (imdb) return { brand: "imdb", value: one(imdb) };
  return t.tmdbRating ? { brand: "tmdb", value: one(t.tmdbRating) } : null;
}

/**
 * The one rating of a card or a billboard line: always with its source, never a bare star that reads as
 * the profile's own rating — the Lumovio Score with Lumovio's mark (sent only at medium or high confidence), a
 * service's score with its logo, TMDB's community score with the word "TMDB" (cardScore above).
 */
export function CardRating({ title, className }: { title: Rated & Pick<TitleSummary, "kind">; className?: string }) {
  const s = cardScore(title, useLocale());
  const score = title.lumovioScore;
  if (!s) return score ? <ScoreBadge score={score.score} kind={title.kind} confidence={score.confidence} className={clsx("shrink-0", className)} /> : null;
  return (
    // The value sits on the baseline of the text around it ("2026 · ★ 7,8 · Film"), the logo centred on the line.
    <span className={clsx("inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap font-semibold tabular-nums", className)}>
      {s.brand === "tmdb" ? "TMDB " : <BrandMark brand={s.brand} rotten={s.rotten} className="self-center" />}
      {s.value}
    </span>
  );
}

/** What CardRating shows, in words for a card's accessible name ("IMDb 7,8", "Rotten Tomatoes 93%"). */
export function ratingText(t: Rated, locale: string): string | null {
  const s = cardScore(t, locale);
  if (s) return `${BRAND_NAMES[s.brand]} ${s.value}`;
  return t.lumovioScore ? `Lumovio Score ${t.lumovioScore.score}` : null;
}
