"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";
import { Link } from "@/i18n/navigation";
import { posterSrcSet, tmdbImage } from "@/lib/images";
import { titleHref } from "@/lib/slug";
import { Artwork, artBox } from "./Artwork";
import { CardMeta } from "./CardMeta";
import { CardMore, useLongPress } from "./CardMore";
import { CardRating } from "./CardRating";
import { POSTER_SIZES, TOP10_COLS, TOP10_RANK_H } from "./card-sizes";
import { useCardMark, useRatingText } from "./PosterCard";
import { useDismissed } from "./shelf-context";

/**
 * Top 10 card (design-system 7.12, sizes 5.4): the rank as an outlined numeral standing on the poster's foot line, beside
 * a poster of a poster card's width with the same name and line under it as a PosterCard, so the shelf is the same row
 * of posters as every other. One Top 10 shelf per page (HOME-14).
 */
export function Top10Card({ title, rank, priority }: { title: TitleSummary; rank: number; priority?: boolean }) {
  const t = useTranslations("rows");
  const tc = useTranslations("common");
  const tl = useTranslations("title");
  const { mark } = useCardMark(title);
  const ratingText = useRatingText();
  const press = useLongPress();
  if (useDismissed(title.id)) return null;
  const kindLabel = title.isAnime ? tc("anime") : title.kind === "movie" ? tc("movie") : tc("series");
  const rating = title.lumovioScore || title.imdbRating || title.tmdbRating ? <CardRating title={title} /> : null;
  // The rating first, as every card's line (PosterCard).
  const meta = [rating, title.year];
  return (
    <div className={cn("group/card relative grid w-full min-w-0 select-none items-start", TOP10_COLS)} {...press.handlers}>
      {/* As tall as the poster beside it, the numeral at its foot: it stands on the poster's line, not the caption's. */}
      <svg aria-hidden viewBox="0 0 120 180" preserveAspectRatio="xMaxYMax meet" className={cn("w-full", TOP10_RANK_H)}>
        <text
          x="118"
          y="172"
          textAnchor="end"
          fontSize={rank >= 10 ? 130 : 182}
          fontWeight={900}
          letterSpacing={rank >= 10 ? -12 : 0}
          fill="var(--bg)"
          stroke="var(--text-3)"
          strokeWidth={4}
          paintOrder="stroke"
          style={{ fontFamily: "inherit" }}
        >
          {rank}
        </text>
      </svg>
      <div className="relative min-w-0">
        <Link
          href={titleHref(title.kind, title.tmdbId, title.title)}
          className="group/link block rounded-sm [-webkit-touch-callout:none] focus-visible:outline-none"
          data-title-id={title.id}
          data-on-server={title.onServer ? "" : undefined}
          draggable={false}
          aria-label={[
            `${t("top10Rank", { rank })}: ${title.title}${title.year ? ` (${title.year})` : ""}`,
            kindLabel,
            ratingText(title),
            title.onServer ? t("onServer") : null,
            mark === "watched" ? tl("watched") : mark === "watchlist" ? tl("watchlistRemove") : null,
          ]
            .filter(Boolean)
            .join(", ")}
        >
          <Artwork
            shape="poster"
            src={tmdbImage(title.posterPath, "w342")}
            srcSet={posterSrcSet(title.posterPath)}
            sizes={POSTER_SIZES}
            priority={priority}
            placeholder={title.kind}
            badge={title.onServer ? t("onServerBadge") : null}
            mark={mark}
          />
          {/* The name and line under the poster, as a PosterCard's. */}
          <CardMeta title={title.title} meta={meta} wide={[kindLabel]} />
        </Link>
        <div className={cn("pointer-events-none absolute inset-x-0 top-0", artBox("poster"))}>
          <CardMore title={title} openSignal={press.signal} className="absolute end-1.5 bottom-2.5 max-sm:end-0 max-sm:bottom-1" />
        </div>
      </div>
    </div>
  );
}
