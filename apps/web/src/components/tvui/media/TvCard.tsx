import type { TitleSummary } from "@lumovio/contracts";
import { Film, Tv } from "lucide-react";
import { memo } from "react";
import { cn } from "@/components/ui/cn";
import { Link } from "@/i18n/navigation";
import { posterSrcSet, tmdbImage } from "@/lib/images";
import { titleHref } from "@/lib/slug";
import { useHoldForMore } from "./hold";

/*
 * TV cards (design-system 7.12 TV variant, 10.3): one stop of the remote each — a link to the title (or to what it
 * plays) with nothing nested to stop on; the focused card grows with the lime ring (`tv-focus`). Its name is the
 * link's name; what a card can't show (description, why it's here) is said by the screen's spotlight.
 */

export type TvCardShape = "poster" | "wide";

const SHAPE: Record<TvCardShape, string> = {
  poster: "w-38 aspect-2/3",
  wide: "w-72 aspect-video",
};
/** In a grid the card fills its column. */
const FLUID: Record<TvCardShape, string> = {
  poster: "w-full aspect-2/3",
  wide: "w-full aspect-video",
};

export function TvArt({
  src,
  srcSet,
  sizes,
  kind,
  className,
}: {
  src: string | null;
  srcSet?: string;
  sizes?: string;
  kind: "movie" | "tv";
  className?: string;
}) {
  const Icon = kind === "tv" ? Tv : Film;
  return src ? (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("size-full object-cover", className)}
    />
  ) : (
    <span className={cn("grid size-full place-items-center bg-surface-2 text-text-3", className)}>
      <Icon aria-hidden className="size-10" />
    </span>
  );
}

/**
 * Memoised: a screen re-renders its spotlight or the line over its grid on every step of the focus, and hundreds of
 * cards with the same props must not render again for it (measured on the owner's TCL TV, 2026-10-30).
 */
export const TvCard = memo(function TvCard({
  title,
  shape = "poster",
  href,
  label,
  index,
  progress,
  rank,
  initial,
  fluid,
  onMore,
}: {
  title: TitleSummary;
  shape?: TvCardShape;
  /** Where OK goes: the title's page by default. */
  href?: string;
  /** The link's name when it isn't just the title ("Continue «X», season 1, episode 4"). */
  label?: string;
  /** Position in its shelf, for the screen's spotlight. */
  index: number;
  /** 0–1: a progress bar along the bottom (Continue watching). */
  progress?: number;
  /** A Top 10's place, over the art's top corner (7.4, 6.5). */
  rank?: number;
  initial?: boolean;
  fluid?: boolean;
  /** A card with "More" (removing it from Continue watching, the history, a list): held OK opens it (./hold). */
  onMore?: (index: number) => void;
}) {
  const hold = useHoldForMore(onMore ? () => onMore(index) : undefined);
  const wide = shape === "wide";
  const src = wide ? tmdbImage(title.backdropPath, "w780") : tmdbImage(title.posterPath, "w342");
  return (
    <Link
      prefetch={false}
      href={href ?? titleHref(title.kind, title.tmdbId, title.title)}
      data-key={title.id}
      data-index={index}
      data-tv-initial={initial || undefined}
      aria-label={label ?? title.title}
      {...hold}
      className={cn(
        "tv-focus relative block shrink-0 overflow-hidden rounded-sm bg-surface-2",
        (fluid ? FLUID : SHAPE)[shape],
      )}
    >
      <TvArt
        src={src}
        srcSet={wide ? undefined : posterSrcSet(title.posterPath)}
        sizes={wide ? undefined : "12vw"}
        kind={title.kind}
      />
      {wide && (
        // A wide card shows the name: a backdrop alone doesn't say what it is.
        <span
          className={cn(
            "stage absolute inset-x-0 bottom-0 bg-linear-to-t from-stage/90 to-transparent px-4 pt-10 text-start text-title text-text-1",
            progress === undefined ? "pb-3" : "pb-6",
          )}
        >
          <span className="line-clamp-1">{title.title}</span>
        </span>
      )}
      {rank !== undefined && (
        <span className="stage absolute start-2 top-2 block text-display font-extrabold text-text-1 tabular-nums [-webkit-text-stroke:0.125rem_var(--bg-stage)]">
          {rank}
        </span>
      )}
      {progress !== undefined && (
        <span
          aria-hidden
          className="absolute inset-x-3 bottom-2 h-1.5 overflow-hidden rounded-full bg-text-1/30"
        >
          <span
            className="block h-full rounded-full bg-progress"
            style={{ width: `${Math.round(Math.min(1, Math.max(0.03, progress)) * 100)}%` }}
          />
        </span>
      )}
    </Link>
  );
});
