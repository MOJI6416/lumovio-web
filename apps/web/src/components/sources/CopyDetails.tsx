"use client";

import type { Availability } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { useCopyText } from "./copy-text";
import { Facts } from "./Facts";
import { QualityLine } from "./QualityBadges";
import { formatSize } from "./release-text";

/**
 * A copy's details: its marks and what is heard, its release's full name, the server, picture, audio and
 * size — the same dialog as "Release details" (centred, a bottom sheet on a phone). The title page's and the sources
 * screen's "Copy details"; a TV reads the same rows (tvui/sources/TvSources).
 */
export function CopyDetails({ copy: s, all, originalLanguage, onClose }: { copy: Availability | null; all: Availability[]; originalLanguage: string | null; onClose: () => void }) {
  const tp = useTranslations("titlePage");
  const text = useCopyText();
  const facts = useCopyFacts();
  const rows = s ? facts(s, all) : [];
  // Under the heading: the copy's marks and what is heard (QualityLine); the facts below say everything in words.
  const q = s ? text.quality(s, all, originalLanguage) : null;
  return (
    <Dialog size="lg" open={s !== null} onOpenChange={(o) => !o && onClose()} title={tp("copyDetails")} description={q ? <QualityLine marks={q.marks} words={q.words} /> : undefined}>
      <Facts rows={rows} />
    </Dialog>
  );
}

/** A copy's known facts: the release's name, the server, picture, audio and size — here and on a TV. */
export function useCopyFacts() {
  const tp = useTranslations("titlePage");
  const locale = useLocale();
  const text = useCopyText();
  return (s: Availability, all: Availability[]): [string, string][] => {
    const q = s.quality;
    const rows: [string, string | null | undefined][] = [
      [tp("detailName"), text.releaseName(s, all) ?? s.label],
      [tp("detailServer"), `${s.connectionName} · ${text.kindLabel(s)}`],
      [tp("detailPicture"), [q?.resolution, q?.hdr, q?.videoCodec?.toUpperCase(), q?.container?.toUpperCase()].filter(Boolean).join(" · ") || null],
      // "atmos" is the scan's mark for a Dolby Atmos track (lib/media/jellyfin), said by its name after the codecs.
      [tp("detailAudio"), [q?.audioCodecs?.filter((c) => c !== "atmos").map((c) => c.toUpperCase()).join(", "), q?.audioCodecs?.includes("atmos") ? "Dolby Atmos" : null].filter(Boolean).join(" · ") || null],
      [tp("detailSize"), formatSize(q?.sizeBytes ?? null, locale)],
    ];
    return rows.filter((r): r is [string, string] => Boolean(r[1]));
  };
}
