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
import { useCardMark, useRatingText } from "./PosterCard";
import { useDismissed } from "./shelf-context";

/**
 * Top 10 card (design-system 7.12, sizes 5.4): the rank as an outlined numeral beside the poster, and under the poster
 * the same name and metadata as a PosterCard. One Top 10 shelf per page (HOME-14).
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
  return (
    <div className="group/card relative grid w-full min-w-0 select-none grid-cols-[38%_62%] items-start" {...press.handlers}>
      <svg aria-hidden viewBox="0 0 120 180" preserveAspectRatio="xMaxYMax meet" className="aspect-2/3 w-full">
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
            sizes="(min-width: 1536px) 164px, (min-width: 1280px) 154px, (min-width: 768px) 129px, 104px"
            priority={priority}
            placeholder={title.kind}
            badge={title.onServer ? t("onServerBadge") : null}
            mark={mark}
          />
          <CardMeta title={title.title} meta={[title.year, rating]} wide={[kindLabel]} />
        </Link>
        <div className={cn("pointer-events-none absolute inset-x-0 top-0", artBox("poster"))}>
          <CardMore title={title} openSignal={press.signal} className="absolute end-1.5 bottom-2.5 max-sm:end-0 max-sm:bottom-1" />
        </div>
      </div>
    </div>
  );
}
