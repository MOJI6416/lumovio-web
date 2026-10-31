"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCardFact } from "@/hooks/useCardFact";
import { useLibraryState } from "@/hooks/useLibraryState";
import { Link } from "@/i18n/navigation";
import { latinLang } from "@/lib/format";
import { posterSrcSet, tmdbImage } from "@/lib/images";
import { titleHref } from "@/lib/slug";
import { Artwork, artBox, type PersonalMark } from "./Artwork";
import { CardMeta } from "./CardMeta";
import { CardMore, type MoreVisibility, useLongPress } from "./CardMore";
import type { CardMenuExtra } from "./CardMenu";
import { CardRating, ratingText } from "./CardRating";
import { POSTER_SIZES } from "./card-sizes";
import { useDismissed } from "./shelf-context";

/** The card's one personal mark (7.12): "Watched" outranks "Watchlist". */
export function useCardMark(title: Pick<TitleSummary, "id" | "kind">, enabled = true) {
  const { data: state } = useLibraryState(title.id, enabled);
  const watched = state ? state.watchedCount > 0 || Boolean(state.progress?.completed && title.kind === "movie") : false;
  const mark: PersonalMark = watched ? "watched" : state?.inWatchlist ? "watchlist" : null;
  return { state, mark };
}

/** The rating in words for a card's accessible name ("IMDb 7,8"), as CardRating draws it. */
export function useRatingText() {
  const locale = useLocale();
  return (t: Pick<TitleSummary, "imdbRating" | "tmdbRating" | "lumovioScore" | "sortScore">) => ratingText(t, locale);
}

/**
 * Poster card (design-system 7.12, sizes 5.4): the poster with at most one badge ("On your server") and one personal
 * mark, the name in up to two lines and one line of metadata under it — the same in shelves, catalog grids, search,
 * lists and filmographies. The metadata is what the shelf chose it by ("Added 22 Oct", "In digital since 13 Oct"), or
 * the year, the card's one rating and the type. "More" (8.1) on the artwork; a long press on a touch screen opens it
 * too. The width comes from the shelf or grid around it (./card-sizes).
 */
export function PosterCard({
  title,
  priority,
  className,
  subtitle,
  fact: factProp,
  badge,
  progress,
  showState = true,
  more = true,
  moreVisibility,
  children,
}: {
  title: TitleSummary;
  priority?: boolean;
  /** Placement only. */
  className?: string;
  /** The whole metadata line, in place of the year, rating and type (a role in a filmography, "Added by Anna"). */
  subtitle?: string;
  /** Why a client-side shelf has the card ("Dub · 1080p"), in place of the shelf's own fact. */
  fact?: string;
  /** The one badge on the artwork, in place of "On your server" (a rating in the Ratings tab). */
  badge?: ReactNode;
  progress?: number | null;
  /** The personal mark and progress from the profile's library (off where they mean nothing: someone else's page). */
  showState?: boolean;
  /** The "More" menu; off where the card's own control does the job, or `CardMenuExtra` to add to it. */
  more?: boolean | CardMenuExtra;
  moreVisibility?: MoreVisibility;
  /** A control of the shelf laid over the artwork's top-end corner ("Like" in the starter). */
  children?: ReactNode;
  /** @deprecated The name is always shown now (7.12); kept for callers until they are migrated. */
  caption?: boolean;
}) {
  const t = useTranslations("common");
  const tl = useTranslations("title");
  const tr = useTranslations("rows");
  const { state, mark } = useCardMark(title, showState);
  const ratingLabel = useRatingText();
  const locale = useLocale();
  const kindLabel = title.isAnime ? t("anime") : title.kind === "movie" ? t("movie") : t("series");
  const fraction = progress ?? (showState ? (state?.progress?.fraction ?? null) : null);
  // Present only where the shelf chose the title by it (a release, a season, a length), so the card shows why it is here.
  const shelfFact = useCardFact(title);
  const fact = factProp ?? shelfFact;
  const press = useLongPress();
  if (useDismissed(title.id)) return null;
  const rating = title.sortScore || title.lumovioScore || title.imdbRating || title.tmdbRating ? <CardRating title={title} /> : null;
  // A shelf's fact is why the card is here: it takes the line alone, never cut for a rating (HOME-06, X-38).
  const meta = subtitle ? [subtitle] : fact ? [fact] : [title.year, rating];

  return (
    <div className={cn("group/card relative w-full min-w-0 select-none", className)} {...press.handlers}>
      <Link
        href={titleHref(title.kind, title.tmdbId, title.title)}
        className="group/link block rounded-sm [-webkit-touch-callout:none] focus-visible:outline-none"
        data-title-id={title.id}
        data-on-server={title.onServer ? "" : undefined}
        draggable={false}
        // The marks on the artwork are named here: an icon alone (or a title= hint) names nothing (audit X-21).
        aria-label={[
          `${title.title}${title.year ? ` (${title.year})` : ""}`,
          kindLabel,
          subtitle,
          fact,
          ratingLabel(title),
          title.onServer ? tr("onServer") : null,
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
          badge={badge ?? (title.onServer ? tr("onServerBadge") : null)}
          mark={showState && !children ? mark : null}
          progress={fraction}
        />
        {/* A name the catalog has only in Latin letters on a ru/uk page is marked as such (8.11, L10N-11). */}
        <CardMeta title={title.title} titleLang={latinLang(title.title, locale)} meta={meta} wide={subtitle || fact ? [] : [kindLabel]} wrap={Boolean(subtitle || fact)} />
      </Link>
      {(more || children) && (
        // The artwork's box over it, for what sits on the artwork but is not part of the link.
        <div className={cn("pointer-events-none absolute inset-x-0 top-0", artBox("poster"))}>
          {children && <div className="pointer-events-auto absolute end-1.5 top-1.5 max-sm:end-0 max-sm:top-0">{children}</div>}
          {more && (
            <CardMore
              title={title}
              visibility={moreVisibility}
              openSignal={press.signal}
              extra={typeof more === "object" ? more : undefined}
              className="absolute end-1.5 bottom-2.5 max-sm:end-0 max-sm:bottom-1"
            />
          )}
        </div>
      )}
    </div>
  );
}

export function PosterCardSkeleton() {
  return (
    <div className="w-full">
      <Skeleton className="aspect-2/3 w-full" />
      <Skeleton shape="xs" className="mt-2 h-4 w-4/5" />
      <Skeleton shape="xs" className="mt-1.5 h-3.5 w-3/5" />
    </div>
  );
}
