import type { LibraryIndexEntry } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** What a copy's picture, sound and subtitles are, as marks (design-system 7.15): Apple TV's set, in its order. */
export type QualityMark = "4k" | "hd" | "dv" | "hdr10plus" | "hdr" | "atmos" | "cc";

/**
 * Each mark's file in `public/brands/quality/` (Apple TV's own, as tv.apple.com draws them: the plates in its type, and
 * Dolby's official stacked marks), its width to its height, and its name read out.
 */
const MARK: Record<QualityMark, { file: string; ratio: string; name: string | null }> = {
  "4k": { file: "4k", ratio: "26 / 15", name: "4K" },
  hd: { file: "hd", ratio: "26 / 15", name: "HD" },
  dv: { file: "dolby-vision", ratio: "52 / 22", name: "Dolby Vision" },
  hdr10plus: { file: "hdr10-plus", ratio: "54 / 15", name: "HDR10+" },
  hdr: { file: "hdr", ratio: "34 / 15", name: "HDR" },
  atmos: { file: "dolby-atmos", ratio: "52 / 22", name: "Dolby Atmos" },
  // Apple's "CC" plate for subtitles that can be turned on; read out in the interface's language.
  cc: { file: "cc", ratio: "26 / 15", name: null },
};

/**
 * The marks of a copy from what its server or its release name says, as Apple TV gives them: the resolution (4K from
 * 2160, HD from 720 and 1080), one HDR format (Dolby Vision over HDR10+ over any other HDR — HDR10 and HLG are "HDR")
 * Dolby Atmos, and CC when there are subtitles to turn on.
 */
export function qualityMarks(q: {
  resolution?: number | string | null;
  /** The server's word: Jellyfin's VideoRangeType ("DOVI", "DOVIWithHDR10", "HDR10Plus", "HDR10", "HLG") or VideoRange ("HDR"). */
  hdr?: string | null;
  /** A release name's formats (lib/media/releases `hdrFormats`). */
  hdrFormats?: readonly string[];
  atmos?: boolean;
  cc?: boolean;
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
  if (q.cc) marks.push("cc");
  return marks;
}

/**
 * A copy's marks by its server's data: Jellyfin's VideoRangeType, the scan's "atmos" among the codecs for a Dolby Atmos
 * track (lib/media/jellyfin), its subtitle tracks.
 */
export const copyMarks = (q: NonNullable<LibraryIndexEntry["quality"]>) =>
  qualityMarks({ resolution: q.resolution, hdr: q.hdr, atmos: q.audioCodecs?.includes("atmos"), cc: (q.subtitleTracks ?? 0) > 0 });

/** A server's resolution in words where no mark says it ("720p", "576p"); 1080p and 4K have theirs (HD, 4K). */
export const resolutionBesideMarks = (resolution: string | null | undefined) => (resolution && !/^(1080|2160)|4k/i.test(resolution) ? resolution : null);

/**
 * The marks as Apple TV's row of them (owner, 2026-11-06): its own files, one colour — the text's, through a mask —
 * and one height, the text's (1em), so they sit in a line of text and grow with it on TV. Read out by name.
 */
export function QualityBadges({ marks, className }: { marks: readonly QualityMark[]; className?: string }) {
  const t = useTranslations("title");
  if (marks.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5 align-middle", className)}>
      {marks.map((m) => {
        const mask = `url(/brands/quality/${MARK[m].file}.svg)`;
        return (
          <span
            key={m}
            role="img"
            aria-label={MARK[m].name ?? t("markSubtitles")}
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

/**
 * A copy or a release as its marks, then in words what they don't say ("720p", the source, what is heard), inline so
 * the words wrap after the marks; with no marks, the words alone (`fallback` first, when given).
 */
export function QualityLine({ marks, words, fallback }: { marks: readonly QualityMark[]; words: readonly (string | null | undefined)[]; fallback?: string | null }) {
  const rest = words.filter(Boolean).join(" · ");
  if (marks.length === 0) return <>{[fallback, rest].filter(Boolean).join(" · ")}</>;
  return (
    <>
      <QualityBadges className={rest ? "me-2" : undefined} marks={marks} />
      {rest}
    </>
  );
}

/** Where a translated line takes a node of its own ("Through TorrServer «torr» · {summary}"): pass it as the value. */
export const SLOT = "\u0001";

/** A translated line with `SLOT` in it, the slot replaced by `node`. */
export function Slotted({ text, node }: { text: string; node: ReactNode }) {
  const at = text.indexOf(SLOT);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      {node}
      {text.slice(at + SLOT.length)}
    </>
  );
}
