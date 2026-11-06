"use client";

import type { MediaKind } from "@lumovio/contracts";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { ScoreMark } from "@/components/media/ScoreBadge";
import { RatingChip } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link, usePathname } from "@/i18n/navigation";
import { heroItems, heroScore, RATINGS_ANCHOR, RatingLogo, ratingItems, sourceName, useRatingValue, useTitleExternal } from "./ratings";

/** Brings "Ratings" into view when it is already drawn (Details open); otherwise it scrolls itself there on arrival. */
function toRatings() {
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => document.getElementById(RATINGS_ANCHOR)?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" }));
}

/**
 * The hero's ratings (owner's decision 1.3, 7.14 item 3, 7.22): one quiet line — the Lumovio Score when it is sure
 * enough for a card (medium or high), IMDb (TMDB without it) and the critics' score (Rotten Tomatoes, else
 * Metacritic) — that is itself the way to every rating: it brings "Ratings" up on the page, as the line under the actions
 * brings "Where to watch" (`replace`, Back leaves the title). It replaced the "All ratings" popover (2026-11-06).
 */
export function HeroRatings({ kind, tmdbId, tmdbRating, tmdbVotes }: { kind: MediaKind; tmdbId: number; tmdbRating: number | null; tmdbVotes: number | null }) {
  const t = useTranslations("titlePage");
  const ts = useTranslations("score");
  const tr = useTranslations("ratings");
  const pathname = usePathname();
  const q = useTitleExternal(kind, tmdbId);
  const value = useRatingValue();
  const items = ratingItems(q.data, kind, tmdbId, tmdbRating, tmdbVotes);
  const score = heroScore(q.data?.score);
  // A title rated only by Letterboxd or Trakt still gets its line, with the first source it has.
  const chips = heroItems(items);
  if (chips.length === 0 && items[0]) chips.push(items[0]);

  if (q.isPending)
    return (
      // The line's height when it arrives: 44 px on a phone (5.6).
      <div className="flex h-8 items-center gap-4 max-sm:h-11" aria-busy>
        <Skeleton shape="xs" className="h-5 w-16" />
        <Skeleton shape="xs" className="h-5 w-16" />
        <span className="sr-only">{tr("loading")}</span>
      </div>
    );
  if (!score && chips.length === 0) return null;

  return (
    <Link
      href={`${pathname}#${RATINGS_ANCHOR}`}
      replace
      scroll={false}
      onClick={toRatings}
      data-hero-ratings
      className="group -mx-2 inline-flex min-h-8 max-w-full flex-wrap items-center gap-x-5 gap-y-2 rounded-sm px-2 py-1 max-sm:min-h-11"
    >
      {score && <RatingChip logo={<ScoreMark className="size-4" />} source={ts("name")} value={String(score.score)} />}
      {chips.map((r) => (
        <RatingChip key={r.source} logo={<RatingLogo source={r.source} score={r.score} />} source={sourceName(r.source)} value={value(r)} />
      ))}
      <span className="sr-only">{t("allRatings")}</span>
      <ChevronRight aria-hidden className="-ms-3 size-4 shrink-0 text-text-2 transition-transform duration-fast ease-fast group-hover:translate-x-0.5 group-hover:text-text-1 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
    </Link>
  );
}
