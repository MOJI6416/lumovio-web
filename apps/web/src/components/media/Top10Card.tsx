"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";
import { Link } from "@/i18n/navigation";
import { posterSrcSet, tmdbImage } from "@/lib/images";
import { titleHref } from "@/lib/slug";
import { Artwork, artBox } from "./Artwork";
import { ArtCaption } from "./ArtCaption";
import { CardMeta } from "./CardMeta";
import { CardMore, useLongPress } from "./CardMore";
import { CardRating } from "./CardRating";
import { POSTER_SIZES, TOP10_COLS } from "./card-sizes";
import { useCardMark, useRatingText } from "./PosterCard";
import { useDismissed } from "./shelf-context";

/**
 * Top 10 card (design-system 7.12, sizes 5.4): the rank as an outlined numeral standing on the poster's foot line, beside
 * a poster of a poster card's width with the same name and line on it (ArtCaption), so the shelf is the same row of
 * posters as every other. One Top 10 shelf per page (HOME-14).
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
    <div className={cn("group/card relative grid w-full min-w-0 select-none items-end", TOP10_COLS)} {...press.handlers}>
      <svg aria-hidden viewBox="0 0 120 180" preserveAspectRatio="xMaxYMax meet" className="aspect-2/3 w-full self-end">
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
          {/* As every card of a shelf: the name and line on the poster (ArtCaption), the caption only in the site's TV mode. */}
          {/* Without a poster the name stands under the placeholder, as a PosterCard's does. */}
          <CardMeta title={title.title} meta={meta} wide={[kindLabel]} className={title.posterPath ? "hidden in-data-[tv=1]:block" : undefined} />
          {title.posterPath && <ArtCaption shape="poster" title={title.title} meta={meta} />}
        </Link>
        <div className={cn("pointer-events-none absolute inset-x-0 top-0", artBox("poster"))}>
          <CardMore title={title} openSignal={press.signal} className="absolute end-1.5 bottom-2.5 max-sm:end-0 max-sm:bottom-1" />
        </div>
      </div>
    </div>
  );
}
