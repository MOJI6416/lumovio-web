"use client";

import type { Availability } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { parseRelease } from "@/lib/media/releases";
import { formatSize, useReleaseText } from "./release-text";

const KIND_LABEL: Record<Availability["kind"], string> = { jellyfin: "Jellyfin", plex: "Plex", torrserver: "TorrServer" };

/**
 * A copy on the profile's server in words (design-system 7.15, PLR-05): its version — "1080p · Blu-ray · Russian ·
 * dubbed" — from the server's quality data or, for a TorrServer copy, from its release's name; never the server's own
 * name or a raw file name. A file bound to a film or an episode takes the name of its torrent's release when its own
 * label doesn't tell (`all`: every copy of the title, the torrent's own entry among them). The same words the title
 * page uses for its copies (components/title/Availability: copyTitle, copyMeta).
 */
export function useCopyText() {
  const t = useTranslations("titlePage");
  const locale = useLocale();
  const text = useReleaseText();

  const releaseName = (s: Availability, all: Availability[]): string | null => {
    if (s.kind !== "torrserver") return null;
    const hash = s.externalId.split(":")[0]!.toLowerCase();
    const own = all.find((x) => x.connectionId === s.connectionId && x.externalId.toLowerCase() === hash)?.label ?? null;
    // A bound file's label is its file name (a series) or what the torrent was added as: the release says more.
    const told = (name: string | null) => {
      if (!name) return false;
      const info = parseRelease(name);
      return info.resolution !== null || info.source !== null || info.tracks.length > 0;
    };
    return told(s.label) ? s.label : told(own) ? own : (s.label ?? own);
  };

  return {
    /** The copy's version: "1080p · HDR10 · HEVC" from the server, or the release's picture and audio. */
    version: (s: Availability, all: Availability[] = [], originalLanguage: string | null = null): string => {
      const known = [s.quality?.resolution, s.quality?.hdr, s.quality?.videoCodec?.toUpperCase()].filter(Boolean).join(" · ");
      if (known) return known;
      const name = releaseName(s, all);
      if (name) {
        const info = parseRelease(name, null, originalLanguage);
        const words = [info.resolution !== null || info.source !== null ? text.picture(info) : null, text.audio({ info, language: null })].filter(Boolean).join(" · ");
        if (words) return words;
      }
      return KIND_LABEL[s.kind];
    },
    /** Where it is and how big: "On «torr» · TorrServer · 9.6 GB". */
    meta: (s: Availability, title: string) =>
      [t("onServer", { server: s.connectionName }), KIND_LABEL[s.kind], formatSize(s.quality?.sizeBytes ?? null, locale), s.kind !== "torrserver" && s.label && s.label !== title ? s.label : null]
        .filter(Boolean)
        .join(" · "),
    /** The release's full name, for the copy's details. */
    releaseName,
    kindLabel: (s: Availability) => KIND_LABEL[s.kind],
  };
}
