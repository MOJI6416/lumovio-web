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

/**
 * How a copy's audio stands to the profile's audio languages, by what its server says of its tracks (Jellyfin's and
 * Plex's scans): 0 — one of them, 2 — none of them, 1 — not known (no languages stored: TorrServer copies, whose order
 * is the person's last choice, and older scans). A known language never sinks below an unknown one.
 */
export function languageRank(s: Source, languages: readonly string[]): number {
  const own = s.server.quality?.audioLanguages;
  if (!own?.length || languages.length === 0) return 1;
  return own.some((l) => languages.includes(l)) ? 0 : 2;
}

/**
 * Every copy in the order the player tries them (stable otherwise): one in the profile's audio language first, as the
 * release search ranks language above all, then files this browser plays untouched. No copies need no look at the
 * browser: a guest's answer (no servers) is known while the server renders the page, where there is no browser to look at.
 */
export function orderedSources(a: TitleAvailability, caps?: PlaybackCapabilities, languages: readonly string[] = []): Source[] {
  if (a.servers.length === 0) return [];
  const c = caps ?? detectCapabilities();
  return a.servers
    .map((server, i) => ({ s: { server }, i, l: languageRank({ server }, languages), r: sourceRank(c, { server }) }))
    .sort((x, y) => x.l - y.l || x.r - y.r || x.i - y.i)
    .map((x) => x.s);
}
