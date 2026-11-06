"use client";

import type { ReleaseQuality } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { StatusBadge, Tag } from "@/components/ui/Badge";
import { formatDate, formatSize } from "@/lib/format";
import { QualityLine, qualityMarks } from "./QualityBadges";
import {
  audioMatch,
  type HdrFormat,
  kindOf,
  namedTracks,
  type PackInfo,
  type PictureSource,
  RESOLUTION_LABEL,
  type Range,
  type RankedRelease,
  type ReleaseInfo,
  type ReleaseTrack,
  type VoiceOption,
} from "@/lib/media/releases";
import { editionOf } from "@/lib/media/editions";
import type { TsSearchResult } from "@/lib/media/torrserver";

/*
 * A TorrServer release in words, one way for every place that lists releases: "Where to watch" on the title page, the
 * title hero's line, the sources screen before the player (design-system 7.15, SRC-01, SRC-09).
 */

export const RESOLUTION = RESOLUTION_LABEL;
export const HDR_LABEL: Record<HdrFormat, string> = { hdr: "HDR", hdr10: "HDR10", "hdr10+": "HDR10+", dv: "Dolby Vision", hlg: "HLG" };
export const SOURCE_LABEL: Record<PictureSource, string> = { remux: "Remux", bluray: "Blu-ray", webdl: "WEB-DL", webrip: "WEBRip", hdtv: "HDTV", dvd: "DVD" };
const RANGE_LABEL: Record<Range, string> = { hdr: "HDR", dv: "Dolby Vision", sdr: "SDR" };
export const QUALITY_MODES: ReleaseQuality[] = ["auto", "best", "small"];

/** The one size formatter (lib/format, L10N-09), kept importable from here for the release screens. */
export { formatSize };

/** A release in a few words: language, translation and studio, picture, seeders, tracker. */
export function useReleaseText() {
  const t = useTranslations("title");
  const locale = useLocale();
  const names = new Intl.DisplayNames([locale], { type: "language" });
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  const language = (code: string) => names.of(code) ?? code;
  /** One track's translation: "dubbed (Pifagor)", "multi-voice", "LostFilm" when the name gives no kind. */
  const track = (tr: ReleaseTrack) => {
    const who = tr.studio ?? tr.credit;
    if (!tr.voice) return who ?? "";
    return who ? `${t(`voice_${tr.voice}`)} (${who})` : t(`voice_${tr.voice}`);
  };
  /**
   * "Ukrainian · dubbed (Le Doyen)": the audio of one language as the name lists it, each track with its own kind and
   * studio — the profile's language the release has (`x.language`), else its first track's; never every studio under
   * one language (SRC-05). `only`: that studio's track. At most three tracks, then "+ N more"; the other languages are
   * `otherLanguages`.
   */
  const audio = (x: Pick<RankedRelease, "info" | "language">, only?: string | null) => {
    const named = namedTracks(x.info);
    const picked = only ? named.find((tr) => tr.studio === only) : undefined;
    const lang = picked?.language ?? x.language ?? named[0]?.language ?? x.info.languages[0] ?? null;
    const mine = picked ? [picked] : named.filter((tr) => tr.language === lang || (tr.language === null && lang === null));
    if (mine.length === 0 && named.length === 0) {
      // A name that pairs nothing: its languages and its best kind, as before tracks were read.
      const studios = only ? [only] : x.info.studios;
      const pair = (s: string) => {
        const kind = kindOf(x.info, s);
        return kind ? `${t(`voice_${kind}`)} (${s})` : s;
      };
      const voice = studios.length ? studios.map(pair).join(" + ") : x.info.voice ? t(`voice_${x.info.voice}`) : null;
      return [lang ? cap(language(lang)) : null, voice].filter(Boolean).join(" · ");
    }
    const shown = mine.slice(0, 3).map(track);
    if (mine.length > 3) shown.push(t("tsMoreTracks", { count: mine.length - 3 }));
    return [lang ? cap(language(lang)) : null, shown.join(" + ") || null].filter(Boolean).join(" · ");
  };
  /** "Also Russian, English (original)": the languages of the tracks `audio` leaves out, or null. */
  const otherLanguages = (x: Pick<RankedRelease, "info" | "language">) => {
    const named = namedTracks(x.info);
    const lang = x.language ?? named[0]?.language ?? x.info.languages[0] ?? null;
    const others = [...new Set(x.info.tracks.filter((tr) => tr.language && tr.language !== lang).map((tr) => tr.language!))];
    if (others.length === 0) return null;
    const original = new Set(x.info.tracks.filter((tr) => tr.original).map((tr) => tr.language));
    return t("tsAlsoLanguages", { languages: others.map((l) => (original.has(l) ? t("tsOriginalLanguage", { language: language(l) }) : language(l))).join(", ") });
  };
  /** Every track, grouped by language: "Russian: dubbed, multi-voice (Jaskier)" — for a release's details. */
  const allTracks = (x: Pick<RankedRelease, "info">) => {
    const by = new Map<string, string[]>();
    for (const tr of x.info.tracks) {
      const key = tr.language ?? "";
      const words = tr.original ? t("tsOriginal") : track(tr);
      if (!words) continue;
      by.set(key, [...(by.get(key) ?? []), words]);
    }
    return [...by.entries()].map(([l, words]) => `${l ? cap(language(l)) : t("tsLanguageUnknown")}: ${words.join(", ")}`);
  };
  /** "4K · HDR10 · Dolby Vision · HEVC · WEB-DL": what the name says about the picture, nothing guessed. */
  const picture = (info: ReleaseInfo) =>
    [
      info.resolution ? RESOLUTION[info.resolution] : t("tsNoResolution"),
      ...info.hdrFormats.map((f) => HDR_LABEL[f]),
      info.sdr && info.hdrFormats.length === 0 ? "SDR" : null,
      info.codec ? (info.codec === "hevc" ? "HEVC" : info.codec === "avc" ? "AVC" : "AV1") : null,
      info.source ? SOURCE_LABEL[info.source] : null,
    ]
      .filter(Boolean)
      .join(" · ");
  /**
   * The picture in words beside its marks (QualityBadges, 7.15), never what they say: the resolution only where they
   * can't tell it ("720p" under HD, "SD", "quality not stated"), then the source ("Blu-ray"). Null when nothing is left.
   */
  const besideMarks = (info: ReleaseInfo) =>
    [info.resolution === 2160 || info.resolution === 1080 ? null : info.resolution ? RESOLUTION[info.resolution] : t("tsNoResolution"), info.source ? SOURCE_LABEL[info.source] : null]
      .filter(Boolean)
      .join(" · ") || null;
  /** A picture version's chip: "1080p", "4K SDR", "4K HDR", "4K" when the name says nothing about the range. */
  const version = (resolution: ReleaseInfo["resolution"], range: Range | null) =>
    [resolution ? RESOLUTION[resolution] : t("tsNoResolution"), range && !(range === "sdr" && resolution !== 2160) ? RANGE_LABEL[range] : null].filter(Boolean).join(" ");
  const option = (o: Pick<VoiceOption, "studio" | "voice" | "language">) => o.studio ?? (o.voice ? cap(t(`voice_${o.voice}`)) : o.language ? cap(language(o.language)) : t("tsVoiceUnnamed"));
  return {
    cap,
    language,
    audio,
    otherLanguages,
    allTracks,
    picture,
    besideMarks,
    version,
    option,
    describe: (x: RankedRelease, withSeeders = true) =>
      [
        audio(x),
        picture(x.info),
        formatSize(x.result.size, locale),
        withSeeders && x.result.seeders !== null ? t("tsSeeders", { count: x.result.seeders }) : null,
        withSeeders ? x.result.tracker : null,
      ]
        .filter(Boolean)
        .join(" · "),
  };
}

/** A release's marks (QualityBadges, 7.15): its resolution, one HDR format, Dolby Atmos, as its name says them. */
export const releaseMarks = (info: Pick<ReleaseInfo, "resolution" | "hdrFormats" | "atmos">) => qualityMarks({ resolution: info.resolution, hdrFormats: info.hdrFormats, atmos: info.atmos });

/**
 * A release as its marks, then in words what they don't say ("720p", the source) and `rest` — what is heard, or where
 * and how much (QualityLine): one line for every place a release is listed or detailed.
 */
export function ReleaseLine({ info, rest = [] }: { info: ReleaseInfo; rest?: readonly (string | null | undefined)[] }) {
  const text = useReleaseText();
  return <QualityLine marks={releaseMarks(info)} words={[text.besideMarks(info), ...rest]} />;
}

/** The label that says what a release's audio has to do with the profile: its studio, or only its language (7.4 Tag). */
export function AudioMatchBadge({ x }: { x: RankedRelease }) {
  const t = useTranslations("title");
  const text = useReleaseText();
  const m = audioMatch(x);
  if (!m) return null;
  return <Tag>{m.kind === "studio" ? t("tsYourVoice", { studio: m.studio }) : t("tsYourLanguage", { language: text.cap(text.language(m.language)) })}</Tag>;
}

const CODEC: Record<NonNullable<ReleaseInfo["codec"]>, string> = { hevc: "HEVC", avc: "AVC", av1: "AV1" };

/** "Seasons 1–2 · Episodes 1–47 of 47", "TV-2", "Season 2 · Episode 3": what the name states, or "". */
export function packWords(t: ReturnType<typeof useTranslations>, p: PackInfo): string {
  const s = p.seasons;
  const e = p.episodes;
  return [
    s ? (p.cours ? `TV-${s.from}${s.to !== s.from ? `–${s.to}` : ""}` : t(s.from === s.to ? "packSeason" : "packSeasons", s)) : null,
    e ? (e.from === e.to ? t("packEpisode", { from: e.from }) : e.of ? t("packEpisodesOf", { from: e.from, to: e.to, of: e.of }) : t("packEpisodes", { from: e.from, to: e.to })) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** More than one episode by its name (a season or an episode range): its size is the whole pack's, not an episode's. */
export const isPack = (p: PackInfo) => (p.episodes ? p.episodes.to > p.episodes.from : p.seasons !== null);


/**
 * The one label besides "Recommended" on a release's row (7.15): what matters most first — a cinema recording, the
 * wrong season, no seeders, a format this device may not play, already on the server — else its audio's match.
 */
export function ReleaseTag({ x, linked, season }: { x: RankedRelease; linked: boolean; season: number | null }) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  return x.info.cam ? (
    <StatusBadge status="warning">{t("camTag")}</StatusBadge>
  ) : x.holds === false ? (
    <Tag>{t("packOtherSeason", { season: season ?? 0 })}</Tag>
  ) : x.dead ? (
    <Tag>{t("noSeeders")}</Tag>
  ) : x.fit === "poor" ? (
    <StatusBadge status="warning">{tt(x.info.codec === "hevc" ? "tsFitHevcShort" : "tsFitDvShort")}</StatusBadge>
  ) : linked ? (
    <Tag>{t("alreadyAdded")}</Tag>
  ) : (
    <AudioMatchBadge x={x} />
  );
}

/**
 * Everything the release name and the indexer say about one release (7.15 details), each fact on its own and "not
 * stated" where the name says nothing — nothing is filled in; every audio track under its language. What this device
 * can do is its own reading; the file itself is checked when it is prepared. `tv`: a series — its pack's seasons, and
 * a pack's size said as the whole pack's. The cut of the film ("Extended") when the name says it.
 */
export function useReleaseFacts() {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const locale = useLocale();
  const text = useReleaseText();
  return (r: TsSearchResult, x: RankedRelease | undefined, tv: boolean): [string, string][] => {
    const none = t("notStated");
    const rows: [string, string][] = [];
    if (x) {
      const tracks = text.allTracks(x);
      rows.push(
        [t("detailPicture"), x.info.resolution ? RESOLUTION[x.info.resolution]! : none],
        [t("detailRange"), x.info.hdrFormats.length ? x.info.hdrFormats.map((f) => HDR_LABEL[f]).join(" + ") : x.info.sdr ? "SDR" : none],
        [t("detailCodec"), x.info.codec ? CODEC[x.info.codec] : none],
        [t("detailSource"), x.info.cam ? t("camSource") : x.info.source ? SOURCE_LABEL[x.info.source] : none],
        [t("detailVoices"), tracks.length ? tracks.join("\n") : none],
        ...(tv ? [[t("detailPack"), packWords(t, x.info.pack) || none] as [string, string]] : []),
      );
    }
    const size = formatSize(r.size, locale);
    const seeders = r.seeders === null ? t("seedersUnknown") : `${r.seeders} / ${r.peers ?? "?"}`;
    rows.push(
      [t("detailSize"), size ? (tv && x && isPack(x.info.pack) ? t("packWhole", { size }) : size) : none],
      // The same torrent from several indexers: one swarm, so the highest number, and each indexer's own.
      [t("detailSeeders"), r.origins && r.seeders !== null ? `${seeders} · ${t("seedersHighest")}` : seeders],
      [t("detailTracker"), r.origins ? r.origins.map((o) => `${o.tracker ?? "?"} (${o.seeders ?? "?"}/${o.peers ?? "?"})`).join(", ") : (r.tracker ?? none)],
      [t("detailPublished"), formatDate(r.published, locale) ?? none],
    );
    // The cut, only when the name says it (theatrical, extended, the director's — lib/media/editions).
    const cut = editionOf(r.title);
    if (cut) rows.splice(x ? 4 : 0, 0, [t("detailEdition"), tt(`edition_${cut}`)]);
    if (x) rows.push([t("detailDevice"), x.fit === "poor" ? tt(x.info.codec === "hevc" ? "tsFitHevc" : "tsFitDv") : x.fit === "unknown" ? tt("tsFitUnknown") : t("fitOk")]);
    rows.push([t("detailName"), r.title]);
    return rows;
  };
}
