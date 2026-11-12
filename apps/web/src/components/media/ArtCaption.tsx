import { Fragment, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { MetaLine } from "./CardMeta";

const real = (p: ReactNode) => p !== null && p !== undefined && p !== false && p !== "";

/**
 * A frame's name and one line on its foot, on a scrim: a landscape card's backdrop has
 * no lettering of its own, so its name stands on it, as Apple TV's "Up next" does — a poster, which carries its title,
 * keeps its name under the art (PosterCard). Room for "More" only where a mouse shows it. It is Artwork's `overlay`:
 * inside the frame, under its badge and progress bar, so it rises with the art on hover and focus as one layer — a
 * caption scaled on its own left a hairline of undimmed picture along the foot. The scrim runs to the frame's edge, the
 * bar lies on it and the text keeps clear of it. The line never cuts a part: what doesn't fit is left out whole
 * (MetaLine), a shelf's fact takes two lines. `lead` stands before the line (the ▶ of a card that plays at once).
 * Decorative: the card's link carries its whole name.
 */
export function ArtCaption({
  title,
  titleLang,
  meta,
  lead,
  wrap = false,
  aboveBar = false,
}: {
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
    <div aria-hidden className="stage pointer-events-none absolute inset-0 flex items-end in-data-[tv=1]:hidden">
      <div
        className={cn(
          "w-full bg-linear-to-t from-stage via-stage/75 to-transparent px-2 pt-10 sm:px-2.5 pointer-fine:pe-11",
          aboveBar ? "pb-3 sm:pb-3.5" : "pb-2 sm:pb-2.5",
        )}
      >
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
