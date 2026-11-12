"use client";

import { BookmarkCheck, Check, Film, type LucideIcon, Tv, User } from "lucide-react";
import type { ReactNode } from "react";
import { MediaBadge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";

// Art already shown in this visit. Drawn again — Back to a page, a shelf drawn anew — it is requested at once (eager), not
// after layout (lazy): a lazy image left an empty frame where it had just been, which flickered after iOS's swipe
// back. Decoding stays async: the browser keeps the decoded image, and a sync decode of a screenful held
// the first paint back — the whole screen blinked instead. The server's HTML and hydration keep lazy (the set starts empty).
const seen = new Set<string>();

export type ArtShape = "poster" | "landscape" | "person";
/** The one personal mark a card shows: "Watched" outranks "Watchlist". */
export type PersonalMark = "watched" | "watchlist" | null;

const SHAPE: Record<ArtShape, string> = {
  poster: "aspect-2/3 rounded-sm",
  landscape: "aspect-video rounded-sm",
  person: "aspect-square rounded-full",
};

/** The artwork's box without the image: what a card lays over its artwork (the "More" button) is placed in it. */
export const artBox = (shape: ArtShape) => SHAPE[shape];

const PLACEHOLDER: Record<"movie" | "tv" | "person", LucideIcon> = { movie: Film, tv: Tv, person: User };

// Under a caption's scrim the picture fades out 1–2 px short of the frame's foot, and of its sides in the lower
// 2.5–4 rem, over an opaque band of the stage colour wherever it isn't whole. The frame's rounded clip anti-aliases
// each layer on its own: on an edge that falls between device pixels — a scaled screen, the hover's 1.04 — the picture
// showed through the dark scrim as a light hairline. The frame's own --surface-2 moves onto the image for the same
// reason (it would show there instead, light in the light theme).
// A mask counts only alpha: black is "shown". The picture: off the foot ∩ (off the sides ∪ above the lower band).
const ART_UNDER_CAPTION = {
  maskImage:
    "linear-gradient(to top, transparent 1px, black 2px), linear-gradient(to right, transparent 1px, black 2px calc(100% - 2px), transparent calc(100% - 1px)), linear-gradient(to top, transparent 2.5rem, black 4rem)",
  maskComposite: "intersect, add",
};
// The band, under it: the foot ∪ (the sides ∩ the lower band), hard-edged where the picture becomes whole.
const EDGE_BAND = {
  maskImage:
    "linear-gradient(to top, black 2px, transparent 2px), linear-gradient(to right, black 2px, transparent 2px calc(100% - 2px), black calc(100% - 2px)), linear-gradient(to top, black 4rem, transparent 4rem)",
  maskComposite: "add, intersect",
};

/**
 * A card's artwork: the image in its shape, or a --surface-2 placeholder with the type's icon
 * (never a broken image or "no image" text); at most one MediaBadge top-start ("4K", "New episode", "On your server"),
 * one personal mark top-end (one dark disk with a white sign — a check "Watched", BookmarkCheck "Watchlist"), the watch
 * progress as a bar along the bottom. Dates and other facts of a shelf go in the line under the card (CardMeta).
 *
 * Inside a card (`group/card` on the card, `group/link` on its link): with a mouse the artwork rises (scale 1.04,
 * 200 ms) with a --line-2 ring; keyboard focus on the link draws the focus ring around the artwork, with the dark halo
 * for light frames. Nothing moves with reduced motion.
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
  overlay,
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
  /** Laid on the image, under the badge, mark and progress, and scaled with it (a landscape card's ArtCaption). */
  overlay?: ReactNode;
  /** Only the image blurred, a spoiler not yet shown (ui/Spoiler); the badge, mark and progress stay sharp. */
  blurred?: boolean;
  className?: string;
}) {
  const Placeholder = PLACEHOLDER[placeholder];
  const underCaption = Boolean(overlay && src);
  return (
    <div
      className={cn(
        "relative overflow-hidden ring-line-2 transition-[scale,box-shadow] duration-base ease-base",
        !underCaption && "bg-surface-2",
        "pointer-fine:group-hover/card:scale-[1.04] pointer-fine:group-hover/card:ring-2",
        "group-focus-visible/link:scale-[1.04] group-focus-visible/link:shadow-(--focus-halo) group-focus-visible/link:outline-(length:--focus-width) group-focus-visible/link:outline-offset-2 group-focus-visible/link:outline-focus",
        "motion-reduce:scale-100!",
        SHAPE[shape],
        className,
      )}
    >
      {underCaption && <div aria-hidden className="absolute inset-0 bg-stage" style={EDGE_BAND} />}
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
          style={underCaption ? ART_UNDER_CAPTION : undefined}
          className={cn(
            "size-full object-cover transition-[filter,scale] duration-base ease-base motion-reduce:transition-none",
            underCaption && "relative bg-surface-2",
            blurred && "scale-110 blur-lg",
          )}
        />
      ) : (
        <div className="grid size-full place-items-center text-text-3">
          <Placeholder aria-hidden className="size-8" />
        </div>
      )}
      {overlay}
      {badge && <MediaBadge className="absolute start-1.5 top-1.5 max-w-[calc(100%-0.75rem)]">{badge}</MediaBadge>}
      {/* One mark, one look: the same dark disk with a white sign — a check for watched, a bookmark for the watchlist. */}
      {mark && (
        <span aria-hidden className="stage absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-stage/70 text-text-1 backdrop-blur-md in-data-[tv=1]:backdrop-blur-none">
          {mark === "watched" ? <Check className="size-4" strokeWidth={3} /> : <BookmarkCheck className="size-4" />}
        </span>
      )}
      {progressShown(progress) && (
        <div aria-hidden className="stage absolute inset-x-0 bottom-0 h-1 bg-text-1/25">
          <div className="h-full bg-progress" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

/** Whether a watch progress (0–1) is shown: between 1 % and 98 %. */
export const progressShown = (value: number | null | undefined): value is number =>
  value != null && value > 0.01 && value < 0.98;
