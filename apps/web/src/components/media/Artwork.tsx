"use client";

import { BookmarkCheck, Check, Film, type LucideIcon, Tv, User } from "lucide-react";
import type { ReactNode } from "react";
import { MediaBadge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";

// Art already shown in this visit. Drawn again — Back to a page, a shelf drawn anew — it is requested at once (eager), not
// after layout (lazy): a lazy image left an empty frame where it had just been, which flickered after iOS's swipe back
// (owner, 2026-10-30). Decoding stays async: the browser keeps the decoded image, and a sync decode of a screenful held
// the first paint back — the whole screen blinked instead. The server's HTML and hydration keep lazy (the set starts empty).
const seen = new Set<string>();

export type ArtShape = "poster" | "landscape" | "person";
/** The one personal mark a card shows (7.12): "Watched" outranks "Watchlist". */
export type PersonalMark = "watched" | "watchlist" | null;

const SHAPE: Record<ArtShape, string> = {
  poster: "aspect-2/3 rounded-sm",
  landscape: "aspect-video rounded-sm",
  person: "aspect-square rounded-full",
};

/** The artwork's box without the image: what a card lays over its artwork (the "More" button) is placed in it. */
export const artBox = (shape: ArtShape) => SHAPE[shape];

const PLACEHOLDER: Record<"movie" | "tv" | "person", LucideIcon> = { movie: Film, tv: Tv, person: User };

/**
 * A card's artwork (design-system 7.12, 6.5): the image in its shape, or a --surface-2 placeholder with the type's icon
 * (never a broken image or "no image" text); at most one MediaBadge top-start ("4K", "New episode", "On your server"),
 * one personal mark top-end (6.4: "Watched" a filled circle with a check, "Watchlist" BookmarkCheck), the watch
 * progress as a bar along the bottom. Dates and other facts of a shelf go in the line under the card (CardMeta).
 *
 * Inside a card (`group/card` on the card, `group/link` on its link): with a mouse the artwork rises (scale 1.04,
 * 200 ms) with a --line-2 ring; keyboard focus on the link draws the focus ring around the artwork, with the dark halo
 * for light frames (6.6). Nothing moves with reduced motion.
 */
export function Artwork({
  shape,
  src,
  srcSet,
  sizes,
  alt = "",
  priority,
  placeholder,
  badge,
  mark,
  progress,
  blurred,
  className,
}: {
  shape: ArtShape;
  src: string | null;
  srcSet?: string;
  sizes?: string;
  /** Empty when the card's link already names the title. */
  alt?: string;
  priority?: boolean;
  /** Which icon stands in for a missing image. */
  placeholder: "movie" | "tv" | "person";
  badge?: ReactNode;
  /** Named by the card's link for screen readers. */
  mark?: PersonalMark;
  /** 0–1; shown between 1 % and 98 %. */
  progress?: number | null;
  /** Only the image blurred, a spoiler not yet shown (ui/Spoiler, 7.21); the badge, mark and progress stay sharp. */
  blurred?: boolean;
  className?: string;
}) {
  const Placeholder = PLACEHOLDER[placeholder];
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-surface-2 ring-line-2 transition-[scale,box-shadow] duration-base ease-base",
        "pointer-fine:group-hover/card:scale-[1.04] pointer-fine:group-hover/card:ring-2",
        "group-focus-visible/link:scale-[1.04] group-focus-visible/link:shadow-(--focus-halo) group-focus-visible/link:outline-(length:--focus-width) group-focus-visible/link:outline-offset-2 group-focus-visible/link:outline-focus",
        "motion-reduce:scale-100!",
        SHAPE[shape],
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={priority || seen.has(src) ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0) seen.add(src);
          }}
          onLoad={() => seen.add(src)}
          className={cn(
            "size-full object-cover transition-[filter,scale] duration-base ease-base motion-reduce:transition-none",
            blurred && "scale-110 blur-lg",
          )}
        />
      ) : (
        <div className="grid size-full place-items-center text-text-3">
          <Placeholder aria-hidden className="size-8" />
        </div>
      )}
      {badge && <MediaBadge className="absolute start-1.5 top-1.5 max-w-[calc(100%-0.75rem)]">{badge}</MediaBadge>}
      {mark === "watched" && (
        // A dark ring keeps the white disk visible on a light frame.
        <span aria-hidden className="stage absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-text-1 text-stage! ring-2 ring-stage/60">
          <Check className="size-4" strokeWidth={3} />
        </span>
      )}
      {mark === "watchlist" && (
        <span aria-hidden className="stage absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-stage/70 text-text-1 backdrop-blur-md in-data-[tv=1]:backdrop-blur-none">
          <BookmarkCheck className="size-4" />
        </span>
      )}
      {progress != null && progress > 0.01 && progress < 0.98 && (
        <div aria-hidden className="stage absolute inset-x-0 bottom-0 h-1 bg-text-1/25">
          <div className="h-full bg-progress" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
