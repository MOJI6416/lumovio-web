"use client";

import type { MediaKind, TitleExternal } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ScoreMark, useScoreLabel } from "@/components/media/ScoreBadge";
import { type RatingItem, RatingLogo, sourceName, useRatingMeta, useRatingValue } from "./ratings";

/** "Critics liked it more", "Early score", "Few ratings" or "Backed by one source" (score method v3). */
export function useScoreNotes() {
  const t = useTranslations("score");
  return (score: NonNullable<TitleExternal["score"]>): string[] =>
    [
      score.divergence ? t(score.divergence === "critics_higher" ? "criticsHigher" : "audienceHigher") : null,
      score.early ? t("early") : null,
      score.confidence === "low" ? (score.sources === 1 ? t("oneSource") : t("few")) : null,
    ].filter((x): x is string => Boolean(x));
}

/**
 * Every rating of a title with where it comes from (TTL-10, 2.5): the source's logo and name, its value as it writes
 * it, the votes or reviews behind it, its date and who delivered it — each a link to the source's page. The Lumovio
 * Score first, as Lumovio's own number, with what it means in one line.
 */
export function RatingList({ items, score, kind, scoreLink }: { items: RatingItem[]; score: TitleExternal["score"]; kind: MediaKind; scoreLink?: ReactNode }) {
  const t = useTranslations("score");
  const value = useRatingValue();
  const meta = useRatingMeta();
  const notes = useScoreNotes();
  const label = useScoreLabel();
  return (
    <ul className="flex flex-col divide-y divide-line">
      {score && (
        <li className="flex items-start gap-3 py-3 first:pt-0">
          <ScoreMark className="mt-0.5 size-5" />
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-title text-text-1">{t("name")}</span>
              <span className="text-title tabular-nums text-text-1">{score.score}</span>
            </p>
            <p className="mt-0.5 text-body-s text-text-2">{[label(score.score, kind, score.confidence), ...notes(score)].join(" ")}</p>
            {scoreLink}
          </div>
        </li>
      )}
      {items.map((r) => {
        const body = (
          <>
            <span className="mt-0.5 inline-flex h-5 w-6 shrink-0 items-center justify-center [&>*]:max-h-5">
              <RatingLogo source={r.source} score={r.score} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-title text-text-1">{sourceName(r.source)}</span>
                <span className="text-title tabular-nums text-text-1">{value(r)}</span>
              </span>
              {meta(r).length > 0 && <span className="mt-0.5 block text-body-s text-text-2">{meta(r).join(" · ")}</span>}
            </span>
          </>
        );
        return (
          <li key={r.source} className="py-3 last:pb-0">
            {r.url ? (
              <a href={r.url} target="_blank" rel="noreferrer noopener" className="-mx-2 flex items-start gap-3 rounded-sm px-2 py-1 transition-colors duration-fast ease-fast hover:bg-surface-3">
                {body}
              </a>
            ) : (
              <span className="flex items-start gap-3">{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
