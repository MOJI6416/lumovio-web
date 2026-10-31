import type { TorrentFind, TorrentFindBest } from "@lumovio/contracts";
import { api } from "@/lib/api";
import type { RankedRelease } from "@/lib/media/releases";

/**
 * What a TorrServer search found for a title, kept on Lumovio for the profile so all its devices see
 * it: the best release's language, translation, studio and picture — no links, hashes or trackers.
 * The search itself still runs on a device, through the profile's own TorrServer.
 */
export type TorrentFinds = Record<string, TorrentFind>;

/** A title is searched again after this long, whichever of the profile's devices searched it last. */
export const RECHECK_MS = 12 * 3600_000;

export const findsKey = (profileId: string | null) => ["torrent-finds", profileId] as const;

export const fetchFinds = () => api<{ finds: TorrentFinds }>("/api/library/torrent-finds");

/** The part of a ranked release that is kept. */
export function findOf(best: RankedRelease | undefined): TorrentFindBest | null {
  if (!best) return null;
  return { language: best.language, voice: best.info.voice, studio: best.studio ?? best.info.studios[0] ?? null, resolution: best.info.resolution };
}

/** Reports one search, so the profile's other devices see it and leave the title alone for 12 hours. */
export const reportFind = (titleId: string, best: RankedRelease | undefined) =>
  api<TorrentFind>("/api/library/torrent-finds", { method: "POST", json: { titleId, best: findOf(best) } });

/** Finds this browser kept itself before they moved to Lumovio (2026-10-24): removed on sight. */
export function dropLocalFinds(profileId: string) {
  try {
    localStorage.removeItem(`lumovio.torrent-finds.v1:${profileId}`);
  } catch {
    // Nothing to remove.
  }
}
