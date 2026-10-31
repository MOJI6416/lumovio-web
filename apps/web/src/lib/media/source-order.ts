import type { Availability, TitleAvailability } from "@lumovio/contracts";
import { canDirectPlay, detectCapabilities, type PlaybackCapabilities } from "./capabilities";

export type Source = { server: Availability };

/** Player start order: files this browser plays untouched, then unknown files, then transcodes. */
export function sourceRank(caps: PlaybackCapabilities, s: Source): number {
  const q = s.server.quality;
  if (!q) return 2;
  return canDirectPlay(caps, { container: q.container ?? null, videoCodec: q.videoCodec ?? null, audioCodec: q.audioCodecs?.[0] ?? null }).ok ? 0 : 3;
}

/**
 * Every copy in the order the player tries them (stable within a rank). No copies need no look at the browser: a
 * guest's answer (no servers) is known while the server renders the page, where there is no browser to look at.
 */
export function orderedSources(a: TitleAvailability, caps?: PlaybackCapabilities): Source[] {
  if (a.servers.length === 0) return [];
  const c = caps ?? detectCapabilities();
  return a.servers
    .map((server, i) => ({ s: { server }, i, r: sourceRank(c, { server }) }))
    .sort((x, y) => x.r - y.r || x.i - y.i)
    .map((x) => x.s);
}
