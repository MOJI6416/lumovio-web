"use client";

import type { ReleaseQuality, SourceState, TitleSummary } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useSession } from "@/components/providers/Providers";
import { useTitleAvailability } from "@/hooks/useAvailability";
import { detectCapabilities, onUhdSmooth, uhdDecodesNow, uhdSmoothNow } from "@/lib/media/capabilities";
import { namesNumbering, reportNumbering } from "@/lib/media/numbering-evidence";
import { copyFileTracks, type RankedRelease, type ReleasePrefs, rankReleases, sameTitleResults, torrentQuery } from "@/lib/media/releases";
import { lineSpeed, subscribeLine } from "@/lib/media/line-speed";
import { filesVersion, subscribeFiles, withSharedFiles } from "@/lib/media/shared-files";
import { torrServerFor } from "@/lib/media/torrent-source";
import { failingTrackers as failingTrackers_, noFailingTrackers, subscribeTrackers } from "@/lib/media/tracker-adds";
import { keepThroughEmpty, type SearchAnswer } from "@/lib/media/torrserver";

/**
 * What release search ranks by: the profile's audio languages (the interface language when it set
 * none, said so where it shows), its studios and quality mode, and what this device and screen play.
 */
export function useReleasePrefs(): ReleasePrefs & { languagesFromProfile: boolean } {
  const { me, locale } = useSession();
  const p = me?.activeProfile;
  // MediaCapabilities' word on 4K HEVC (lib/media/capabilities): kept on the device after the first answer.
  const uhdSmooth = useSyncExternalStore(onUhdSmooth, uhdSmoothNow, () => null);
  const uhdDecodes = useSyncExternalStore(onUhdSmooth, uhdDecodesNow, () => null);
  // Trackers whose torrents this device's TorrServer couldn't add lately: their releases go after the others.
  const failingTrackers = useSyncExternalStore(subscribeTrackers, failingTrackers_, noFailingTrackers);
  return useMemo(() => {
    const own = p?.audioLanguages ?? [];
    const caps = typeof window !== "undefined" ? detectCapabilities() : null;
    return {
      languages: own.length ? own : [p?.uiLocale ?? locale],
      languagesFromProfile: own.length > 0,
      studios: p?.voiceStudios ?? [],
      quality: p?.releaseQuality ?? "auto",
      device: { hevc: Boolean(caps?.video.hevc), hdr: Boolean(caps?.hdr), uhd: (caps?.maxHeight ?? 0) >= 2160, dolbyVision: Boolean(caps?.dolbyVision), uhdSmooth, av1: caps ? caps.video.av1 : undefined, hevc10: caps?.video.hevc10, uhdDecodes },
      failingTrackers,
    };
  }, [p, locale, uhdSmooth, uhdDecodes, failingTrackers]);
}

/** The TorrServer this device may search on its own for the profile, if any; never for kids profiles. */
export function autoSearchSource(sources: SourceState[] | undefined, kids: boolean): SourceState | null {
  if (kids) return null;
  return sources?.find((s) => s.kind === "torrserver" && s.autoSearch && s.status !== "unreachable" && s.status !== "unauthorized") ?? null;
}

/** Out already: a film or series whose first date is not in the future (unknown counts as out). */
export function isOut(t: Pick<TitleSummary, "releaseDate">): boolean {
  return !t.releaseDate || t.releaseDate <= new Date().toISOString().slice(0, 10);
}

export interface TorrentLookup {
  connectionId: string;
  connectionName: string;
  /** Results TorrServer returned, before this title and dead releases were sorted out. */
  total: number;
  ranked: RankedRelease[];
  /** When the search ran (results are kept for 30 minutes and shown with their age). */
  at: number;
  /** When a later search came back empty and these results were kept (`keepThroughEmpty`). */
  emptyAt?: number;
}

/** The query cache key of a title's search on one connection, shared by the title page and the sources screen. */
export const lookupKey = (profileId: string | null, connectionId: string | null, titleId: string) => ["torrent-lookup", profileId, connectionId, titleId] as const;

export type LookupResult = SearchAnswer;

/**
 * The shared cache's word on a search's results that are this title (`lookupFiles`), waited for at most 3 s: the
 * search's answer goes on without it.
 */
export function sharedFilesOf(results: SearchAnswer["results"], d: Parameters<typeof sameTitleResults>[1], signal?: AbortSignal): Promise<void> {
  const within = typeof AbortSignal.any === "function" ? AbortSignal.any([AbortSignal.timeout(3000), ...(signal ? [signal] : [])]) : signal;
  // Loaded with the first search: pages that only rank (the home's shelf) don't carry it.
  return import("@/lib/media/release-files").then((m) => m.lookupFiles(sameTitleResults(results, d), within)).catch(() => undefined); // ui-lint-ignore swallowed-error: the cache is a help; a pick goes by the names without it
}

/**
 * One search of the profile's own TorrServer indexers for a title, from this device (Lumovio's
 * servers never search, store or relay torrents). Results stay in memory for 30 minutes; ranking
 * follows the profile's preferences, or `quality` for this viewing, without searching again.
 */
/**
 * A series' `season` and `episode` are the ones the viewing is for: a release whose name holds only other seasons (or
 * other episodes of that season) sinks and is never recommended (`rankReleases`).
 */
export function useTorrentLookup(d: TitleSummary, source: SourceState | null, enabled = true, quality?: ReleaseQuality, season: number | null = null, episode: number | null = null) {
  const { me } = useSession();
  const base = useReleasePrefs();
  // What this server's line gave the device's playbacks: "Auto" ranks by it (lib/media/line-speed).
  const lineBps = useSyncExternalStore(subscribeLine, () => lineSpeed(source?.id), () => null);
  const prefs = useMemo(() => ({ ...base, ...(quality ? { quality } : {}), lineBps }), [base, quality, lineBps]);
  // The tracks read in the title's copies (the page's own availability query, not another request): a result that is
  // a copy takes its studios from the file, as on the sources screen; any other, from the file some account's
  // TorrServer read (lib/media/release-files), asked with the search and again after a read ahead.
  const avail = useTitleAvailability(d.id);
  const shared = useSyncExternalStore(subscribeFiles, filesVersion, () => 0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `shared` is the version of what withSharedFiles reads
  const fileOf = useMemo(() => withSharedFiles(copyFileTracks(avail.data?.servers ?? [])), [avail.data, shared]);
  const select = useCallback(
    (r: LookupResult): TorrentLookup => ({
      connectionId: source?.id ?? "",
      connectionName: source?.name ?? "",
      total: r.results.length,
      ranked: rankReleases(r.results, d, prefs, d.kind === "tv" ? season : null, d.kind === "tv" ? episode : null, fileOf),
      at: r.at,
      emptyAt: r.emptyAt,
    }),
    [source, d, prefs, season, episode, fileOf],
  );
  const qc = useQueryClient();
  const key = lookupKey(me?.activeProfile?.id ?? null, source?.id ?? null, d.id);
  return useQuery({
    queryKey: key,
    enabled: enabled && source !== null && isOut(d),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
    // A refresh that comes back empty keeps the results already found (failing indexers answer so too).
    queryFn: async ({ signal }): Promise<LookupResult> => {
      const found = await (await torrServerFor(source!.id)).search(torrentQuery(d), signal);
      // What the names say about the seasons, for numbering the series as releases do.
      if (d.kind === "tv") reportNumbering(d.id, "names", namesNumbering(found.results, d));
      // What the shared cache knows of these files, before the first ranking: the card doesn't change a moment later.
      await sharedFilesOf(found.results, d, signal);
      return keepThroughEmpty(qc.getQueryData<LookupResult>(key), { ...found, at: Date.now() });
    },
    select,
  });
}
