import { Fragment, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { type ArtShape, artBox } from "./Artwork";
import { MetaLine } from "./CardMeta";

const real = (p: ReactNode) => p !== null && p !== undefined && p !== false && p !== "";

/**
 * A frame's name and one line on its foot, on a scrim (design-system 7.12, 2026-11-06): a landscape card's backdrop has
 * no lettering of its own, so its name stands on it, as Apple TV's "Up next" does — a poster, which carries its title,
 * keeps its name under the art (PosterCard). Room for "More" only where a mouse shows it, and the layer rises with the
 * art on hover and focus (Artwork's 1.04), or the scrim would stay behind the picture. Over a progress bar it leaves the
 * bar in view. The line never cuts a part: what doesn't fit is left out whole (MetaLine), a shelf's fact takes two
 * lines. `lead` stands before the line (the ▶ of a card that plays at once). Decorative: the card's link carries its
 * whole name.
 */
export function ArtCaption({
  shape,
  title,
  titleLang,
  meta,
  lead,
  wrap = false,
  aboveBar = false,
}: {
  shape: ArtShape;
  title: string;
  titleLang?: string;
  meta: ReactNode[];
  lead?: ReactNode;
  /** A shelf's fact or a subtitle takes two lines; the rating and year one. */
  wrap?: boolean;
  /** The art shows a progress bar along its bottom. */
  aboveBar?: boolean;
}) {
  const parts = meta.filter(real);
  return (
    <div
      aria-hidden
      className={cn(
        "stage pointer-events-none absolute inset-x-0 top-0 flex items-end overflow-hidden rounded-sm in-data-[tv=1]:hidden",
        "transition-[scale] duration-base ease-base pointer-fine:group-hover/card:scale-[1.04] group-focus-visible/link:scale-[1.04] motion-reduce:scale-100!",
        aboveBar && "pb-1",
        artBox(shape),
      )}
    >
      <div className="w-full bg-linear-to-t from-stage via-stage/75 to-transparent px-2 pt-10 pb-2 sm:px-2.5 sm:pb-2.5 pointer-fine:pe-11">
        <p className="line-clamp-2 break-words text-body-s font-semibold text-text-1" lang={titleLang}>
          {title}
        </p>
        {wrap ? (
          parts.length > 0 && (
            <p className="mt-0.5 line-clamp-2 text-caption text-text-2">
              {lead}
              {parts.map((p, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed order of parts
                <Fragment key={i}>
                  {i > 0 && " · "}
                  {p}
                </Fragment>
              ))}
            </p>
          )
        ) : (
          <MetaLine parts={parts} lead={lead} className="mt-0.5 text-caption text-text-2" />
        )}
      </div>
    </div>
  );
}
