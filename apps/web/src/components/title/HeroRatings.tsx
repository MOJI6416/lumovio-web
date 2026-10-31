"use client";

import type { MediaKind } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { ScoreMark } from "@/components/media/ScoreBadge";
import { RatingChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { lazyControl, useLazySwap, useStandIn } from "@/components/ui/lazy-swap";
import { Skeleton } from "@/components/ui/Skeleton";
import { heroItems, RatingLogo, ratingItems, sourceName, useRatingValue, useTitleExternal } from "./ratings";

const allModule = lazyControl(() => import("./AllRatings"));

/**
 * The hero's ratings (owner's decision 1.3, 7.14 item 3, TTL-10): at most three RatingChips — the Lumovio Score when it
 * is on, IMDb (TMDB without it) and the critics' score (Rotten Tomatoes, else Metacritic) — and "All ratings", a
 * popover with every source and where each comes from. One row; the line "Ratings: Wikidata · IMDb…" moved into it.
 */
export function HeroRatings({ kind, tmdbId, tmdbRating, tmdbVotes, title }: { kind: MediaKind; tmdbId: number; tmdbRating: number | null; tmdbVotes: number | null; title: string }) {
  const t = useTranslations("titlePage");
  const ts = useTranslations("score");
  const tr = useTranslations("ratings");
  const q = useTitleExternal(kind, tmdbId);
  const value = useRatingValue();
  const light = useRef<HTMLButtonElement>(null);
  const all = useLazySwap(allModule, light);
  const allIn = useStandIn(all);
  const items = ratingItems(q.data, kind, tmdbId, tmdbRating, tmdbVotes);
  const chips = heroItems(items);
  const score = q.data?.score ?? null;

  if (q.isPending)
    return (
      // The row's height when it arrives: "All ratings" is a small button, 44 px on a phone (7.1).
      <div className="flex h-8 items-center gap-4 max-sm:h-11" aria-busy>
        <Skeleton shape="xs" className="h-5 w-16" />
        <Skeleton shape="xs" className="h-5 w-16" />
        <span className="sr-only">{tr("loading")}</span>
      </div>
    );
  if (!score && items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {score && (
          <li>
            <RatingChip logo={<ScoreMark className="size-4" />} source={ts("name")} value={String(score.score)} />
          </li>
        )}
        {chips.map((r) => (
          <li key={r.source}>
            <RatingChip logo={<RatingLogo source={r.source} score={r.score} />} source={sourceName(r.source)} value={value(r)} />
          </li>
        ))}
      </ul>
      {allIn.full ? (
        <allIn.full.AllRatings kind={kind} tmdbId={tmdbId} tmdbRating={tmdbRating} tmdbVotes={tmdbVotes} title={title} initialOpen={all.start.open} focusTrigger={all.start.focus} />
      ) : (
        <Button ref={light} variant="tertiary" size="sm" aria-haspopup="dialog" aria-expanded={false} className="-ms-3" {...allIn.handlers}>
          {t("allRatings")}
        </Button>
      )}
    </div>
  );
}
