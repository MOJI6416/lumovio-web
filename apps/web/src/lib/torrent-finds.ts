import type { TorrentFind, TorrentFindBest } from "@lumovio/contracts";
import { api } from "@/lib/api";
import { RESOLUTION_LABEL, type RankedRelease, rangeOf, voiceOptions } from "@/lib/media/releases";

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

/**
 * The part of a ranked release that is kept, with every picture version its audio option was found in (TS5: the
 * profile's studio's, else its language's releases — 1080p · 4K SDR · 4K HDR), from the search's ranked releases.
 */
export function findOf(best: RankedRelease | undefined, ranked: RankedRelease[] = []): TorrentFindBest | null {
  if (!best) return null;
  const options = voiceOptions(ranked);
  const option = options.find((o) => o.best === best && (!best.studio || o.studio === best.studio)) ?? options.find((o) => o.best === best);
  const versions = option?.versions.map((v) => ({ resolution: v.resolution, range: v.range })) ?? [{ resolution: best.info.resolution, range: rangeOf(best.info) }];
  return { language: best.language, voice: best.info.voice, studio: best.studio ?? best.info.studios[0] ?? null, resolution: best.info.resolution, pictures: versions.slice(0, 8) };
}

/** Reports one search, so the profile's other devices see it and leave the title alone for 12 hours. */
export const reportFind = (titleId: string, best: RankedRelease | undefined, ranked: RankedRelease[] = []) =>
  api<TorrentFind>("/api/library/torrent-finds", { method: "POST", json: { titleId, best: findOf(best, ranked) } });

/**
 * A stored find's picture versions in words — "1080p, 4K SDR, 4K HDR" (TS5) — or its best release's resolution for a
 * find kept before versions were; versions the names don't give a resolution for are left out.
 */
export function findPictureText(b: TorrentFindBest): string | null {
  const range = { hdr: "HDR", dv: "Dolby Vision", sdr: "SDR" } as const;
  const versions = b.pictures?.length ? b.pictures : b.resolution ? [{ resolution: b.resolution, range: null }] : [];
  const words = versions
    .filter((p) => p.resolution !== null)
    .map((p) => [RESOLUTION_LABEL[p.resolution!], p.range && !(p.range === "sdr" && p.resolution !== 2160) ? range[p.range] : null].filter(Boolean).join(" "));
  return words.length ? [...new Set(words)].join(", ") : null;
}

/** Finds this browser kept itself before they moved to Lumovio (2026-10-24): removed on sight. */
export function dropLocalFinds(profileId: string) {
  try {
    localStorage.removeItem(`lumovio.torrent-finds.v1:${profileId}`);
  } catch {
    // Nothing to remove.
  }
}
