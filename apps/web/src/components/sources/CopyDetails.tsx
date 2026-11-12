"use client";

import type { Availability } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { useCopyText } from "./copy-text";
import { Facts } from "./Facts";
import { QualityLine } from "./QualityBadges";
import { formatSize, useReleaseText } from "./release-text";

/**
 * A copy's details: its marks and what is heard, the server, picture, every audio track, size and its release's
 * full name — the same dialog as "Release details" (centred, a bottom sheet on a phone). The title page's and the sources
 * screen's "Copy details"; a TV reads the same rows (tvui/sources/TvSources).
 */
export function CopyDetails({ copy: s, all, originalLanguage, onClose }: { copy: Availability | null; all: Availability[]; originalLanguage: string | null; onClose: () => void }) {
  const tp = useTranslations("titlePage");
  const text = useCopyText();
  const facts = useCopyFacts();
  const rows = s ? facts(s, all, originalLanguage) : [];
  // Under the heading: the copy's marks and what is heard (QualityLine); the facts below say everything in words.
  const q = s ? text.quality(s, all, originalLanguage) : null;
  return (
    <Dialog size="lg" open={s !== null} onOpenChange={(o) => !o && onClose()} title={tp("copyDetails")} description={q ? <QualityLine marks={q.marks} words={q.words} /> : undefined}>
      <Facts rows={rows} />
    </Dialog>
  );
}

/**
 * A copy's known facts: the release's name, the server, picture, audio and size — here and on a TV. A TorrServer copy,
 * which its server doesn't scan, says its picture and every audio track as its release's name and file tell them, in
 * full, as a release's details do.
 */
export function useCopyFacts() {
  const tp = useTranslations("titlePage");
  const tpl = useTranslations("player");
  const locale = useLocale();
  const text = useCopyText();
  const words = useReleaseText();
  return (s: Availability, all: Availability[], originalLanguage: string | null = null): [string, string][] => {
    const q = s.quality;
    const info = s.kind === "torrserver" ? text.info(s, all, originalLanguage) : null;
    const tracks = info ? words.allTracks({ info }) : [];
    const rows: [string, string | null | undefined][] = [
      [tp("detailServer"), `${s.connectionName} · ${text.kindLabel(s)}`],
      [tp("detailPicture"), [q?.resolution, q?.hdr, q?.videoCodec?.toUpperCase(), q?.container?.toUpperCase()].filter(Boolean).join(" · ") || (info && (info.resolution || info.source || info.hdrFormats.length) ? words.picture(info) : null)],
      [tpl("detailVoices"), tracks.length ? tracks.join("\n") : null],
      // "atmos" is the scan's mark for a Dolby Atmos track (lib/media/jellyfin), said by its name after the codecs.
      [tp("detailAudio"), [q?.audioCodecs?.filter((c) => c !== "atmos").map((c) => c.toUpperCase()).join(", "), q?.audioCodecs?.includes("atmos") ? "Dolby Atmos" : null].filter(Boolean).join(" · ") || null],
      [tp("detailSize"), formatSize(q?.sizeBytes ?? null, locale)],
      // The full name last, as in a release's details.
      [tp("detailName"), text.releaseName(s, all) ?? s.label],
    ];
    return rows.filter((r): r is [string, string] => Boolean(r[1]));
  };
}
