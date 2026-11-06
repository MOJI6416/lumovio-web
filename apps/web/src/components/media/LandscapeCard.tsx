"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { useCardFact } from "@/hooks/useCardFact";
import { Link } from "@/i18n/navigation";
import { tmdbImage } from "@/lib/images";
import { titleHref } from "@/lib/slug";
import { ArtCaption } from "./ArtCaption";
import { Artwork, artBox } from "./Artwork";
import { CardMeta } from "./CardMeta";
import { CardMore, type MoreVisibility, useLongPress } from "./CardMore";
import type { CardMenuExtra } from "./CardMenu";
import { CardRating } from "./CardRating";
import { LANDSCAPE_SIZES } from "./card-sizes";
import { useCardMark, useRatingText } from "./PosterCard";
import { useDismissed, useShelf } from "./shelf-context";

/**
 * Landscape card (design-system 7.12, sizes 5.4): a 16:9 frame with the same badge, mark and progress as a poster, the
 * name and one line of metadata — on the frame's foot in a shelf (ArtCaption), under it elsewhere. "Continue watching"
 * and "Next episode" give it the episode and the time left ("Season 3 · episode 16 · 22 min left") and a link straight
 * to the player, with ▶ before the line (`plays`: a press starts playing, not the title page); series shelves give it
 * nothing and it shows the rating, the year and the type, or the shelf's fact.
 */
export function LandscapeCard({
  title,
  href,
  meta: metaProp,
  label,
  plays = false,
  progress,
  priority,
  showState = true,
  more = true,
  moreVisibility,
  className,
}: {
  title: TitleSummary;
  /** Where the card goes (the player for "Continue watching"); the title page by default. */
  href?: string;
  /** The metadata line's parts, in place of the year, rating and type. */
  meta?: ReactNode[];
  /** The accessible name, in place of the name, year and type. */
  label?: string;
  /** The card's link starts playing (the player, not the title page): ▶ before the line. */
  plays?: boolean;
  progress?: number | null;
  priority?: boolean;
  /** The personal mark and progress from the library ("Continue watching" brings its own progress). */
  showState?: boolean;
  more?: boolean | CardMenuExtra;
  moreVisibility?: MoreVisibility;
  className?: string;
}) {
  const t = useTranslations("common");
  const tl = useTranslations("title");
  const tr = useTranslations("rows");
  const { state, mark } = useCardMark(title, showState);
  const ratingText = useRatingText();
  const fact = useCardFact(title);
  const press = useLongPress();
  const inShelf = Boolean(useShelf());
  if (useDismissed(title.id)) return null;
  const kindLabel = title.isAnime ? t("anime") : title.kind === "movie" ? t("movie") : t("series");
  const rating = title.lumovioScore || title.imdbRating || title.tmdbRating ? <CardRating title={title} /> : null;
  // A shelf's fact is why the card is here: it takes the line alone, never cut for a rating (HOME-06, X-38).
  const meta = metaProp ?? (fact ? [fact] : [rating, title.year, kindLabel]);
  const img = title.backdropPath ?? title.posterPath;
  const bare = inShelf && Boolean(img);
  const shownProgress = progress !== undefined ? progress : showState ? (state?.progress?.fraction ?? null) : null;

  return (
    <div className={cn("group/card relative w-full min-w-0 select-none", className)} {...press.handlers}>
      <Link
        href={href ?? titleHref(title.kind, title.tmdbId, title.title)}
        className="group/link block rounded-sm [-webkit-touch-callout:none] focus-visible:outline-none"
        data-title-id={title.id}
        data-on-server={title.onServer ? "" : undefined}
        draggable={false}
        aria-label={
          label ??
          [
            `${title.title}${title.year ? ` (${title.year})` : ""}`,
            kindLabel,
            fact,
            ratingText(title),
            title.onServer ? tr("onServer") : null,
            mark === "watched" ? tl("watched") : mark === "watchlist" ? tl("watchlistRemove") : null,
          ]
            .filter(Boolean)
            .join(", ")
        }
      >
        <Artwork
          shape="landscape"
          src={tmdbImage(img, "w780")}
          sizes={LANDSCAPE_SIZES}
          priority={priority}
          placeholder={title.kind}
          badge={title.onServer ? tr("onServerBadge") : null}
          mark={showState ? mark : null}
          progress={shownProgress}
        />
        {/* In a shelf the name and line stand on the art, as every card of a shelf (ArtCaption); a backdrop has no title. */}
        <CardMeta title={title.title} meta={meta} wrap={!metaProp && Boolean(fact)} className={bare ? "hidden in-data-[tv=1]:block" : undefined} />
        {bare && (
          <ArtCaption
            shape="landscape"
            title={title.title}
            meta={meta}
            lead={plays ? <Play aria-hidden className="me-1 inline size-3 fill-current align-[-0.125em]" /> : undefined}
            wrap={!metaProp && Boolean(fact)}
            aboveBar={shownProgress != null}
          />
        )}
      </Link>
      {more && (
        <div className={cn("pointer-events-none absolute inset-x-0 top-0", artBox("landscape"))}>
          <CardMore
            title={title}
            visibility={moreVisibility}
            openSignal={press.signal}
            extra={typeof more === "object" ? more : undefined}
            className="absolute end-1.5 bottom-2.5 max-sm:end-0 max-sm:bottom-1"
          />
        </div>
      )}
    </div>
  );
}
