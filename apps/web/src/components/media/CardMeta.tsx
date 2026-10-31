import { Fragment, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * The text under a card's artwork (design-system 7.12): the name, always visible, in up to two lines (`title` 15/600),
 * and one line of metadata (`body-s`, --text-2) — "2021 · IMDb 7,8 · Film", or what the shelf chose it by ("Added
 * 22 Oct", "Season 3 · episode 16 · 22 min left"). `meta` parts are joined with " · " (2.2), empty ones left out;
 * `wide` parts follow from a tablet up (a phone's 112 px card has room for the year and the rating only).
 * A fact (`wrap`) too long for a narrow card takes a second line rather than being cut ("Added 22 O…" says nothing,
 * X-38). `align="center"` under a person's round photo. `titleLang` marks a name in another language than the page's
 * (a video's own title, 8.11).
 */
export function CardMeta({
  title,
  titleLang,
  meta = [],
  wide = [],
  wrap = false,
  align = "start",
  className,
}: {
  title: string;
  titleLang?: string;
  meta?: ReactNode[];
  wide?: ReactNode[];
  wrap?: boolean;
  align?: "start" | "center";
  className?: string;
}) {
  const real = (p: ReactNode) => p !== null && p !== undefined && p !== false && p !== "";
  const parts = meta.filter(real);
  const more = wide.filter(real);
  return (
    <div className={cn("mt-2 min-w-0", align === "center" && "text-center", className)}>
      {/* break-words: a word longer than the card ("Раскрепощённый") breaks instead of running out of it. */}
      <p className="line-clamp-2 break-words text-title text-text-1" lang={titleLang}>
        {title}
      </p>
      {parts.length + more.length > 0 && (
        // On TV the line is `body`: `body-s` would be under the 20 px a TV needs (4.2, 10.3).
        <p className={cn("mt-0.5 text-body-s text-text-2 in-data-[tv=1]:text-body", wrap ? "line-clamp-2" : "truncate")}>
          {parts.map((p, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed order of parts
            <Fragment key={i}>
              {i > 0 && " · "}
              {p}
            </Fragment>
          ))}
          {more.map((p, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed order of parts
            <span key={i} className="max-md:hidden">
              {parts.length + i > 0 && " · "}
              {p}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
