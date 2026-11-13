import type { InputVideoTrack } from "mediabunny";

/*
 * Where a rebuild of a Matroska file begins. Mediabunny finds the key frame before a time from two hints: the file's cue
 * points (its index of key frames) and the clusters it has already read, whichever is closer. Clusters are often half a
 * second long while key frames are ten seconds apart, so after one run the closest cluster read is usually not a key
 * frame's: the lookup then steps back through the clusters it remembers — one, two, four, eight — and past the first
 * of them lands on the start of the file, reading everything from there up to the time asked. A second run inside the
 * group of pictures the first one began in (another audio track a few seconds after the start, a restart at the same
 * place, a seek back to it) read gigabytes before its first frame.
 */

interface CuePoint {
  time: number;
  clusterPosition: number;
}
interface CachedCluster {
  elementStartPos: number;
  startTimestamp: number;
}
interface MatroskaTrack {
  cuePoints: CuePoint[];
  clusterPositionCache: CachedCluster[];
  segment: { timestampFactor: number };
}
type Backing = { internalTrack?: Partial<MatroskaTrack>; getKeyPacket?: (timestamp: number, options: unknown) => Promise<unknown> };

/** The last cue point at or before `at` (the file's own time units), or null. */
function cueBefore(cues: readonly CuePoint[], at: number): CuePoint | null {
  let lo = 0;
  let hi = cues.length - 1;
  let found: CuePoint | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid]!.time <= at) {
      found = cues[mid]!;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/**
 * Makes every key frame lookup on `track` start at the cue point before the time, as the first one does: the clusters
 * remembered between that cue point and the time are forgotten first (they are read again on the way, and remembered
 * again). A file without cue points keeps Mediabunny's own way: what it remembers is all it has. Pinned to Mediabunny
 * 1.62.1's Matroska reader; with other internals, or another container, the track stays as it was.
 */
export function keyLookupFromCues(track: InputVideoTrack) {
  const backing = (track as unknown as { _backing?: Backing })._backing;
  const it = backing?.internalTrack;
  const lookup = backing?.getKeyPacket;
  if (!backing || typeof lookup !== "function" || !Array.isArray(it?.cuePoints) || !Array.isArray(it.clusterPositionCache) || !it.segment?.timestampFactor) return;
  const t = it as MatroskaTrack;
  backing.getKeyPacket = function (timestamp, options) {
    const at = timestamp * t.segment.timestampFactor;
    const cue = cueBefore(t.cuePoints, at);
    if (cue) {
      const cache = t.clusterPositionCache;
      for (let i = cache.length - 1; i >= 0; i--) if (cache[i]!.elementStartPos > cue.clusterPosition && cache[i]!.startTimestamp <= at) cache.splice(i, 1);
    }
    return lookup.call(this, timestamp, options);
  };
}
