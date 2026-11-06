import { cn } from "@/components/ui/cn";

/** What a copy's picture and sound are, as marks (design-system 7.4): the same set and order everywhere. */
export type QualityMark = "4k" | "hd" | "dv" | "hdr10plus" | "hdr10" | "hdr" | "atmos";

const LABEL: Record<QualityMark, string> = {
  "4k": "4K",
  hd: "HD",
  dv: "Vision",
  hdr10plus: "HDR10+",
  hdr10: "HDR10",
  hdr: "HDR",
  atmos: "Atmos",
};
/** Read out in full: the Dolby marks show the double-D and one word. */
const NAME: Partial<Record<QualityMark, string>> = { dv: "Dolby Vision", atmos: "Dolby Atmos" };

/**
 * The marks of a copy from what its server or its release name says: the resolution (4K from 2160, HD from 720 and
 * 1080), one HDR format (Dolby Vision over HDR10+ over HDR10 over any other HDR) and Dolby Atmos.
 */
export function qualityMarks(q: {
  resolution?: number | string | null;
  /** The server's word: Jellyfin's VideoRangeType ("DOVI", "HDR10Plus", "HDR10", "HLG") or VideoRange ("HDR"). */
  hdr?: string | null;
  /** A release name's formats (lib/media/releases `hdrFormats`). */
  hdrFormats?: readonly string[];
  /** Audio codecs or names to look for Atmos in. */
  audio?: readonly (string | null | undefined)[];
}): QualityMark[] {
  const marks: QualityMark[] = [];
  const r = typeof q.resolution === "number" ? q.resolution : Number.parseInt(String(q.resolution ?? "").replace(/^4k$/i, "2160"), 10);
  if (r >= 2000 || /4k|uhd/i.test(String(q.resolution ?? ""))) marks.push("4k");
  else if (r >= 720) marks.push("hd");
  const formats = [...(q.hdrFormats ?? []), q.hdr ?? ""].join(" ").toLowerCase();
  if (/dovi|dolby\s*vision|\bdv\b/.test(formats)) marks.push("dv");
  else if (/hdr10\+|hdr10plus/.test(formats)) marks.push("hdr10plus");
  else if (/hdr10/.test(formats)) marks.push("hdr10");
  else if (/hdr|hlg/.test(formats)) marks.push("hdr");
  if ((q.audio ?? []).some((a) => a && /atmos/i.test(a))) marks.push("atmos");
  return marks;
}

/** Dolby's double-D, drawn in the text's colour. */
function DolbyMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 12" className="h-[0.7em] w-auto shrink-0" fill="currentColor">
      <path d="M11 0H6.5a6 6 0 0 0 0 12H11z" />
      <path d="M13 0h4.5a6 6 0 0 1 0 12H13z" />
    </svg>
  );
}

/**
 * The marks as Apple TV draws them (owner, 2026-11-06): small outlined boxes in the secondary text colour, bold
 * capitals, one look for every mark; Dolby's with its double-D. Inline, so it sits in a line of text.
 */
export function QualityBadges({ marks, className }: { marks: readonly QualityMark[]; className?: string }) {
  if (marks.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5 align-middle", className)}>
      {marks.map((m) => (
        <span
          key={m}
          role="img"
          aria-label={NAME[m] ?? LABEL[m]}
          className="inline-flex h-5 items-center gap-1 rounded-xs border border-text-3 px-1.5 text-caption leading-none font-bold tracking-wide text-text-2"
        >
          {(m === "dv" || m === "atmos") && <DolbyMark />}
          {LABEL[m]}
        </span>
      ))}
    </span>
  );
}
