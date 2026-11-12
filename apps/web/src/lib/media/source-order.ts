import type { Availability, TitleAvailability } from "@lumovio/contracts";
import { canDirectPlay, detectCapabilities, type PlaybackCapabilities } from "./capabilities";

export type Source = { server: Availability };

/** Player start order: files this browser plays untouched, then unknown files, then transcodes. */
export function sourceRank(caps: PlaybackCapabilities, s: Source): number {
  const q = s.server.quality;
  // Nothing known of the file itself (a series' entry with only its languages): unknown, not a transcode.
  if (!q || (!q.container && !q.videoCodec)) return 2;
  return canDirectPlay(caps, { container: q.container ?? null, videoCodec: q.videoCodec ?? null, audioCodec: q.audioCodecs?.[0] ?? null }).ok ? 0 : 3;
}

/** What a copy says of its audio: its languages, and whether it credits a studio. Null when it says nothing. */
export type CopyAudio = (s: Availability) => { languages: string[]; credits: (studio: string) => boolean } | null;

/**
 * Its server's scan only (Jellyfin, Plex — `audioLanguages`). Reading a TorrServer copy's release name takes the
 * release-name parser (`copy-audio`), which a page passes in when it has it loaded: this module stays light enough for
 * a title's first load.
 */
export const scanAudio: CopyAudio = (s) => (s.kind !== "torrserver" && s.quality?.audioLanguages?.length ? { languages: s.quality.audioLanguages, credits: () => false } : null);

/**
 * How a copy's audio stands to the profile's audio languages, in their order: the index of the first of them it has, then
 * — one more — not known (no languages said: older scans, a torrent's file name), then — one more again — none of them.
 * A known language never sinks below an unknown one. With no languages asked, all are alike.
 */
export function languageRank(s: Source, languages: readonly string[], audioOf: CopyAudio = scanAudio): number {
  if (languages.length === 0) return 1;
  const own = audioOf(s.server)?.languages;
  if (!own?.length) return languages.length;
  const i = languages.findIndex((l) => own.includes(l));
  return i >= 0 ? i : languages.length + 1;
}

/** The profile's studio a copy credits, by their order ("1 — LostFilm, 2 — HDRezka", "Dubbing"); past the last when none. */
export function studioRank(s: Source, studios: readonly string[], audioOf: CopyAudio = scanAudio): number {
  const audio = audioOf(s.server);
  const i = audio ? studios.findIndex((x) => audio.credits(x)) : -1;
  return i >= 0 ? i : studios.length;
}

/**
 * Every copy in the order the title page offers and the player tries them (stable otherwise), as the release search
 * ranks: the profile's audio languages in their order, then its studios in theirs — a TorrServer copy's by its release
 * name and file — then files this browser plays untouched. No copies need no look at the browser: a guest's answer
 * (no servers) is known while the server renders the page, where there is no browser to look at.
 */
export function orderedSources(a: TitleAvailability, caps?: PlaybackCapabilities, languages: readonly string[] = [], studios: readonly string[] = [], audioOf: CopyAudio = scanAudio): Source[] {
  if (a.servers.length === 0) return [];
  const c = caps ?? detectCapabilities();
  return a.servers
    .map((server, i) => ({ s: { server }, i, l: languageRank({ server }, languages, audioOf), st: studioRank({ server }, studios, audioOf), r: sourceRank(c, { server }) }))
    .sort((x, y) => x.l - y.l || x.st - y.st || x.r - y.r || x.i - y.i)
    .map((x) => x.s);
}
