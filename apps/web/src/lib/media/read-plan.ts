import { type RankedRelease, type ReleasePrefs, swarmOf } from "./releases";
import type { TsSearchResult } from "./torrserver";

/*
 * Which releases to read ahead, and how many: their file's audio tracks tell the studios a name hides ("6x MVO",
 * "многоголосый"), so the pick knows them before anything plays. A read costs the person's TorrServer a quiet add, the
 * file's first kilobytes (0.1–2 MB from peers, a few seconds) and the torrent taken off again; a release found as a
 * .torrent link also costs one download on its tracker, which some trackers count against a daily quota. So a read is
 * spent only where its answer can change what the profile is offered, and within a day's budget.
 *
 * What a read can change: for each version on offer — the profile's language and the picture (`pictureKey`), 1080p and
 * sharper — whether the profile's first studio is in it. A version that already has a release crediting that studio is settled; in one
 * that hasn't, its best releases that hide their studios are read, `PER_VERSION` of them, the versions in rank order
 * (the one "Watch" starts first). A profile without studios has nothing a read would change.
 */

/** Reads of one version that hide studios, at most: more of the same version mostly repeat its tracks. */
export const PER_VERSION = 2;
/** Reads one title gets in a tab, at most. */
export const PER_TITLE = 10;
/** Reads a day through one TorrServer on this device. */
export const DAILY = 120;
/**
 * .torrent downloads a day from one tracker for reads (a magnet costs the tracker nothing): what is left of a quota
 * nobody announced stays the person's, for the releases they watch.
 */
export const TRACKER_DAILY = 50;

/** Trackers with a daily quota of .torrent downloads (Kinozal): read only from a magnet, never from their quota. */
const QUOTA = /kinozal/i;

export interface ReadContext {
  /** Reads started today through this TorrServer on this device. */
  readsToday: number;
  prefs: ReleasePrefs;
  /** Reads this title got in this tab so far. */
  readsForTitle?: number;
  /** Reads today that downloaded a .torrent from this tracker. */
  trackerReadsToday?: (tracker: string) => number;
}

/** A name whose translation names no studio ("MVO", "6x MVO", "многоголосый"): its file tells them. */
export function hidesStudios(x: Pick<RankedRelease, "info">): boolean {
  return x.info.tracks.some((t) => !t.original && t.voice !== null && t.studio === null && t.credit === null) || (x.info.voice !== null && x.info.studios.length === 0 && x.info.tracks.length === 0);
}

/** Whether adding the release takes a .torrent download from its tracker: no origin of it is a magnet. */
export const costsDownload = (r: Pick<TsSearchResult, "link" | "origins">) => ![r.link, ...(r.origins ?? []).map((o) => o.link)].some((l) => l.startsWith("magnet:"));

const trackersKey = (connectionId: string) => `lumovio.readAhead.trackers.${connectionId}`;
const today = () => new Date().toISOString().slice(0, 10);

function trackerCounts(connectionId: string): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(trackersKey(connectionId)) ?? "null") as { day?: string; counts?: Record<string, number> } | null;
    return v?.day === today() && v.counts && typeof v.counts === "object" ? v.counts : {};
  } catch {
    return {};
  }
}

/** For `ReadContext.trackerReadsToday`: the reads today that downloaded a .torrent from a tracker, through this TorrServer. */
export const trackerReadsToday = (connectionId: string) => {
  const counts = trackerCounts(connectionId);
  return (tracker: string) => counts[tracker] ?? 0;
};

/** A read is starting: its .torrent download, if it takes one, counts for its tracker today (kept on this device). */
export function noteTrackerRead(connectionId: string, r: Pick<TsSearchResult, "link" | "origins" | "tracker">) {
  if (!costsDownload(r) || !r.tracker) return;
  const counts = trackerCounts(connectionId);
  counts[r.tracker] = (counts[r.tracker] ?? 0) + 1;
  try {
    localStorage.setItem(trackersKey(connectionId), JSON.stringify({ day: today(), counts }));
  } catch {
    // Without storage the day's budget holds in the plan alone.
  }
}

/** The releases to read, in order: see the module's rules. `known`: the shared cache or a copy's file already tells its tracks. */
export function planReads(ranked: RankedRelease[], known: (r: TsSearchResult) => boolean, ctx: ReadContext): TsSearchResult[] {
  const first = ctx.prefs.studios[0];
  const left = Math.min(DAILY - ctx.readsToday, PER_TITLE - (ctx.readsForTitle ?? 0));
  if (!first || left <= 0) return [];
  const spent = new Map<string, number>();
  const affordable = (r: TsSearchResult) => {
    if (!costsDownload(r)) return true;
    const tracker = r.tracker ?? "";
    if (QUOTA.test(tracker)) return false;
    const n = spent.get(tracker) ?? ctx.trackerReadsToday?.(tracker) ?? 0;
    if (n >= TRACKER_DAILY) return false;
    spent.set(tracker, n + 1);
    return true;
  };
  // Versions on offer, in rank order of their best release: the profile's language and the picture. Only the sharp ones:
  // 1080p and 4K, or the title's best resolution where it has neither (a 720p or a picture the name doesn't state
  // beside a 1080p is hardly what anyone switches to).
  const shown = ranked.filter((x) => !x.dead && !x.info.cam && x.holds !== false && x.language !== null);
  const sharpest = Math.max(0, ...shown.map((x) => x.info.resolution ?? 0));
  const floor = Math.min(1080, sharpest);
  const versions = new Map<string, RankedRelease[]>();
  for (const x of shown) {
    if ((x.info.resolution ?? 0) < floor || (x.info.resolution === null && sharpest > 0)) continue;
    const key = `${x.language}|${x.picture}`;
    versions.set(key, [...(versions.get(key) ?? []), x]);
  }
  // A release that can't be the one that plays settles nothing: almost dead, unplayable here, on a failing tracker.
  const playable = (x: RankedRelease) => x.fit !== "poor" && swarmOf(x.result.seeders) > 0 && !x.unreachable;
  const out: TsSearchResult[] = [];
  for (const releases of versions.values()) {
    if (releases.some((x) => x.studio === first && playable(x))) continue;
    let taken = 0;
    for (const x of releases) {
      if (taken >= PER_VERSION || out.length >= left) break;
      // An almost dead one gives nothing in time; one on a failing tracker gives no torrent here.
      if (!playable(x) || !hidesStudios(x) || known(x.result) || !affordable(x.result)) continue;
      out.push(x.result);
      taken++;
    }
    if (out.length >= left) break;
  }
  return out;
}
