"use client";

import type { Availability } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { SidePanel } from "@/components/ui/Dialog";
import { useCopyText } from "./copy-text";
import { formatSize } from "./release-text";

/**
 * A copy's details (7.15): its version, its release's full name, the server, picture, audio and size — in a side
 * panel, a sheet on a phone. The sources screen's "Copy details"; the same rows as the title page's.
 */
export function CopyDetails({ copy: s, all, originalLanguage, onClose }: { copy: Availability | null; all: Availability[]; originalLanguage: string | null; onClose: () => void }) {
  const tp = useTranslations("titlePage");
  const text = useCopyText();
  const facts = useCopyFacts();
  const rows = s ? facts(s, all) : [];
  return (
    <SidePanel open={s !== null} onOpenChange={(o) => !o && onClose()} title={tp("copyDetails")} description={s ? text.version(s, all, originalLanguage) : undefined}>
      <dl className="flex flex-col gap-4">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-body-s text-text-2">{k}</dt>
            <dd className="mt-0.5 break-words text-body text-text-1">{v}</dd>
          </div>
        ))}
      </dl>
    </SidePanel>
  );
}

/** A copy's known facts (7.15 details): the release's name, the server, picture, audio and size — here and on a TV. */
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
      [tp("detailAudio"), q?.audioCodecs?.length ? q.audioCodecs.map((c) => c.toUpperCase()).join(", ") : null],
      [tp("detailSize"), formatSize(q?.sizeBytes ?? null, locale)],
    ];
    return rows.filter((r): r is [string, string] => Boolean(r[1]));
  };
}
