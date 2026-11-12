import { Fragment, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

const real = (p: ReactNode) => p !== null && p !== undefined && p !== false && p !== "";

/**
 * A card's line of parts joined with " · " that never cuts a part: a part that doesn't fit on the
 * line is left out whole, so a narrow card shows "IMDb 7,2" and drops the year rather than "2026 · IM…" (the phone's
 * Top 10 card cut its rating). The parts come in order of importance — the rating first, as the billboard's line says
 * it; the first part alone too long for the line ends with "…". `wide` parts follow from a tablet up. `lead` stands
 * before the first part (the ▶ of a card that plays).
 */
export function MetaLine({ parts, wide = [], lead, className }: { parts: ReactNode[]; wide?: ReactNode[]; lead?: ReactNode; className?: string }) {
  const shown = parts.filter(real);
  const more = wide.filter(real);
  if (!shown.length && !more.length) return null;
  return (
    // One line high: what wraps is hidden. The parts sit on one baseline, as the rating's value does (CardRating).
    <p className={cn("flex max-h-[1lh] flex-wrap items-baseline overflow-hidden", className)}>
      {/* The first part, alone wider than the line (a person's long role), ends with "…" instead of being clipped; the
          lead goes with it. The " · " belongs to the part after it, so a part left out takes its dot along. */}
      {[...shown.map((p) => ({ p, wide: false })), ...more.map((p) => ({ p, wide: true }))].map(({ p, wide: w }, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed order of parts
        <span key={i} className={cn("whitespace-nowrap", i === 0 && "max-w-full truncate", w && "max-md:hidden")}>
          {i === 0 && lead}
          {i > 0 && <>&nbsp;·&nbsp;</>}
          {p}
        </span>
      ))}
    </p>
  );
}

/**
 * The text under a card's artwork: the name, always visible, in up to two lines (`title` 15/600),
 * and one line of metadata (`body-s`, --text-2) — "IMDb 7,8 · 2021 · Film", or what the shelf chose it by ("Added
 * 22 Oct", "Season 3 · episode 16 · 22 min left"). `meta` parts are joined with " · ", empty ones left out, and
 * one that doesn't fit is left out whole (MetaLine); `wide` parts follow from a tablet up. A fact (`wrap`) too long for a
 * narrow card takes up to three lines rather than being cut ("Added 22 O…" says nothing). `align="center"` under a
 * person's round photo. `titleLang` marks a name in another language than the page's (a video's own title).
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
  const parts = meta.filter(real);
  // On TV the line is `body`: `body-s` would be under the 20 px a TV needs.
  const line = "mt-0.5 text-body-s text-text-2 in-data-[tv=1]:text-body";
  return (
    <div className={cn("mt-2 min-w-0", align === "center" && "text-center", className)}>
      {/* break-words: a word longer than the card ("Раскрепощённый") breaks instead of running out of it. */}
      <p className="line-clamp-2 break-words text-title text-text-1" lang={titleLang}>
        {title}
      </p>
      {wrap ? (
        parts.length > 0 && (
          // Up to three lines under the art: a phone's 112 px card needs them for "Director: Christopher Nolan".
          <p className={cn(line, "line-clamp-3")}>
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
        <MetaLine parts={parts} wide={wide} className={cn(line, align === "center" && "justify-center")} />
      )}
    </div>
  );
}
