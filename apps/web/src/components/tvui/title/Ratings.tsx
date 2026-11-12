"use client";

import type { MediaKind } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import { ScoreMark } from "@/components/media/ScoreBadge";
import {
  heroItems,
  heroScore,
  RatingLogo,
  ratingItems,
  sourceName,
  useRatingValue,
  useTitleExternal,
} from "@/components/title/ratings";
import { RatingChip } from "@/components/ui/Badge";

/** The title's main ratings on a TV: the same two or three chips as the site's hero, nothing to press. */
export function Ratings({
  kind,
  tmdbId,
  tmdbRating,
  tmdbVotes,
}: {
  kind: MediaKind;
  tmdbId: number;
  tmdbRating: number | null;
  tmdbVotes: number | null;
}) {
  const ts = useTranslations("score");
  const q = useTitleExternal(kind, tmdbId);
  const value = useRatingValue();
  const items = heroItems(ratingItems(q.data, kind, tmdbId, tmdbRating, tmdbVotes));
  // As on cards and the site's hero: a low-confidence Lumovio Score only in Details.
  const score = heroScore(q.data?.score);
  if (q.isPending) return <div aria-hidden className="h-8" />;
  if (!score && items.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-body [&_svg]:size-5">
      {score && (
        <li>
          <RatingChip
            logo={<ScoreMark className="size-5" />}
            source={ts("name")}
            value={String(score.score)}
          />
        </li>
      )}
      {items.map((r) => (
        <li key={r.source}>
          <RatingChip
            logo={<RatingLogo source={r.source} score={r.score} />}
            source={sourceName(r.source)}
            value={value(r)}
          />
        </li>
      ))}
    </ul>
  );
}
