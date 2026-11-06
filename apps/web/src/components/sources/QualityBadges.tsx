import { cn } from "@/components/ui/cn";

/** What a copy's picture and sound are, as marks (design-system 7.15): Apple TV's set, in its order. */
export type QualityMark = "4k" | "hd" | "dv" | "hdr10plus" | "hdr" | "atmos";

/**
 * Each mark's file in `public/brands/quality/` (Apple TV's own, as tv.apple.com draws them: the plates in its type, and
 * Dolby's official stacked marks), its width to its height, and its name read out.
 */
const MARK: Record<QualityMark, { file: string; ratio: string; name: string }> = {
  "4k": { file: "4k", ratio: "26 / 15", name: "4K" },
  hd: { file: "hd", ratio: "26 / 15", name: "HD" },
  dv: { file: "dolby-vision", ratio: "52 / 22", name: "Dolby Vision" },
  hdr10plus: { file: "hdr10-plus", ratio: "54 / 15", name: "HDR10+" },
  hdr: { file: "hdr", ratio: "34 / 15", name: "HDR" },
  atmos: { file: "dolby-atmos", ratio: "52 / 22", name: "Dolby Atmos" },
};

/**
 * The marks of a copy from what its server or its release name says, as Apple TV gives them: the resolution (4K from
 * 2160, HD from 720 and 1080), one HDR format (Dolby Vision over HDR10+ over any other HDR — HDR10 and HLG are "HDR")
 * and Dolby Atmos.
 */
export function qualityMarks(q: {
  resolution?: number | string | null;
  /** The server's word: Jellyfin's VideoRangeType ("DOVI", "DOVIWithHDR10", "HDR10Plus", "HDR10", "HLG") or VideoRange ("HDR"). */
  hdr?: string | null;
  /** A release name's formats (lib/media/releases `hdrFormats`). */
  hdrFormats?: readonly string[];
  atmos?: boolean;
}): QualityMark[] {
  const marks: QualityMark[] = [];
  const r = typeof q.resolution === "number" ? q.resolution : Number.parseInt(String(q.resolution ?? "").replace(/^4k$/i, "2160"), 10);
  if (r >= 2000 || /4k|uhd/i.test(String(q.resolution ?? ""))) marks.push("4k");
  else if (r >= 720) marks.push("hd");
  const formats = [...(q.hdrFormats ?? []), q.hdr ?? ""].join(" ").toLowerCase();
  if (/dovi|dolby\s*vision|\bdv\b/.test(formats)) marks.push("dv");
  else if (/hdr10\+|hdr10plus/.test(formats)) marks.push("hdr10plus");
  else if (/hdr|hlg/.test(formats)) marks.push("hdr");
  if (q.atmos) marks.push("atmos");
  return marks;
}

/**
 * The marks as Apple TV's row of them (owner, 2026-11-06): its own files, one colour — the text's, through a mask —
 * and one height, the text's (1em), so they sit in a line of text and grow with it on TV. Read out by name.
 */
export function QualityBadges({ marks, className }: { marks: readonly QualityMark[]; className?: string }) {
  if (marks.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5 align-middle", className)}>
      {marks.map((m) => {
        const mask = `url(/brands/quality/${MARK[m].file}.svg)`;
        return (
          <span
            key={m}
            role="img"
            aria-label={MARK[m].name}
            className="inline-block h-[1em] shrink-0 bg-current forced-color-adjust-none"
            style={{
              aspectRatio: MARK[m].ratio,
              maskImage: mask,
              WebkitMaskImage: mask,
              maskSize: "100% 100%",
              WebkitMaskSize: "100% 100%",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
            }}
          />
        );
      })}
    </span>
  );
}
