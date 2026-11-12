"use client";

import type { Availability } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "@/components/providers/Providers";
import { creditsStudio, parseRelease, profileNameTrack, withFileTracks } from "@/lib/media/releases";
import { copyMarks, type QualityMark, resolutionBesideMarks } from "./QualityBadges";
import { formatSize, releaseMarks, useReleaseText } from "./release-text";

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
  const profile = useSession().me?.activeProfile;
  const langs = profile?.audioLanguages ?? [];
  const studios = profile?.voiceStudios ?? [];

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

  /** A server's copy's audio languages in words, the profile's own first: "Russian, English". */
  const languagesOf = (s: Availability): string | null => {
    const own = s.quality?.audioLanguages ?? [];
    if (own.length === 0) return null;
    const sorted = [...own].sort((a, b) => rank(a) - rank(b));
    return sorted.slice(0, 3).map((l, i) => (i === 0 ? text.cap(text.language(l)) : text.language(l))).join(", ");
  };
  const rank = (l: string) => {
    const i = langs.indexOf(l);
    return i < 0 ? langs.length : i;
  };

  /**
   * The copy's version: "1080p · HDR10 · HEVC · Russian, English" from the server (the audio languages its scan read),
   * or the release's picture and audio.
   */
  const version = (s: Availability, all: Availability[] = [], originalLanguage: string | null = null): string => {
    const known = [s.quality?.resolution, s.quality?.hdr, s.quality?.videoCodec?.toUpperCase(), languagesOf(s)].filter(Boolean).join(" · ");
    if (known) return known;
    const name = releaseName(s, all);
    if (name) {
      const info = parseRelease(name, null, originalLanguage);
      const words = [info.resolution !== null || info.source !== null ? text.picture(info) : null, text.audio({ info, language: null })].filter(Boolean).join(" · ");
      if (words) return words;
    }
    return KIND_LABEL[s.kind];
  };
  /**
   * The copy's picture and sound as marks (QualityBadges): the server's quality data, or what its release's name says.
   */
  const marks = (s: Availability, all: Availability[] = [], originalLanguage: string | null = null): QualityMark[] => {
    const q = s.quality;
    if (q?.resolution || q?.hdr) return copyMarks(q);
    const name = releaseName(s, all);
    if (!name) return [];
    const info = parseRelease(name, null, originalLanguage);
    return releaseMarks(info);
  };
  /** The audio tracks the player read in a TorrServer copy's file (its own entry's, or its torrent's), when it was played. */
  const fileOf = (s: Availability, all: Availability[]) => {
    if (s.kind !== "torrserver") return null;
    if (s.quality?.audioTracks?.length) return s.quality.audioTracks;
    const hash = s.externalId.split(":")[0]!.toLowerCase();
    return all.find((x) => x.connectionId === s.connectionId && x.externalId.split(":")[0]!.toLowerCase() === hash && x.quality?.audioTracks?.length)?.quality?.audioTracks ?? null;
  };

  /**
   * What is heard, beside the marks: the server's audio languages, or the release's translation ("Dub (Pifagor)") — of
   * a TorrServer copy, the one track the player starts for this profile (`profileNameTrack`, as `profileTrack` picks the
   * file's, else the file's default — the name's first): "Russian · multi-voice (LostFilm)" from "7 x MVO (HDrezka
   * Studio, …, LostFilm)" for "1 — LostFilm", "Russian · dubbed" from "2x Dub + MVO + AVO" (36).
   */
  const sound = (s: Availability, all: Availability[] = [], originalLanguage: string | null = null): string | null => {
    const own = languagesOf(s);
    if (own) return own;
    const name = releaseName(s, all);
    if (!name) return null;
    const info = withFileTracks(parseRelease(name, null, originalLanguage), fileOf(s, all), originalLanguage);
    // None of the profile's: the file's default plays — a name lists the tracks in the file's order, its first (36).
    const heard = profileNameTrack(info, { languages: langs, studios }) ?? info.tracks[0] ?? null;
    return text.audio({ info, language: heard?.language ?? null }, heard) || null;
  };

  return {
    version,
    marks,
    sound,
    /**
     * The copy for a line of marks and words (QualityLine, 7.15): its marks, then what they don't say — "720p" under HD, a
     * release's source — and what is heard; its version in words when it has no marks.
     */
    quality: (s: Availability, all: Availability[] = [], originalLanguage: string | null = null): { marks: QualityMark[]; words: (string | null)[] } => {
      const m = marks(s, all, originalLanguage);
      if (m.length === 0) return { marks: m, words: [version(s, all, originalLanguage)] };
      const q = s.quality;
      const name = q?.resolution || q?.hdr ? null : releaseName(s, all);
      const beside = name ? text.besideMarks(parseRelease(name, null, originalLanguage)) : resolutionBesideMarks(q?.resolution);
      return { marks: m, words: [beside, sound(s, all, originalLanguage)] };
    },
    /** Where it is and how big: "On «Home» · Jellyfin · 9.6 GB", "Already on your TorrServer «torr» · 9.6 GB" (14). */
    meta: (s: Availability, title: string) =>
      [...(s.kind === "torrserver" ? [t("onTorrServer", { server: s.connectionName })] : [t("onServer", { server: s.connectionName }), KIND_LABEL[s.kind]]), formatSize(s.quality?.sizeBytes ?? null, locale), s.kind !== "torrserver" && s.label && s.label !== title ? s.label : null]
        .filter(Boolean)
        .join(" · "),
    /** The release's full name, for the copy's details. */
    releaseName,
    /**
     * What a copy's audio has to do with the profile, as a release's row says it (7.4 Tag, `audioMatch`): one of its
     * studios a TorrServer copy's release credits ("your dubbing"), else one of its audio languages — the server's
     * tracks for Jellyfin and Plex, the release name for TorrServer ("your language"). Null when nothing is known.
     */
    audioMatch: (s: Availability, all: Availability[] = [], originalLanguage: string | null = null): { kind: "studio"; studio: string } | { kind: "language"; language: string } | null => {
      if (s.kind !== "torrserver") {
        const l = langs.find((x) => s.quality?.audioLanguages?.includes(x));
        return l ? { kind: "language", language: l } : null;
      }
      const name = releaseName(s, all);
      if (!name) return null;
      const info = withFileTracks(parseRelease(name, null, originalLanguage), fileOf(s, all), originalLanguage);
      const studio = studios.find((x) => creditsStudio(name, x) || info.tracks.some((t) => t.studio !== null && creditsStudio(t.studio, x)));
      if (studio) return { kind: "studio", studio };
      const l = langs.find((x) => info.languages.includes(x));
      return l ? { kind: "language", language: l } : null;
    },
    kindLabel: (s: Availability) => KIND_LABEL[s.kind],
  };
}
