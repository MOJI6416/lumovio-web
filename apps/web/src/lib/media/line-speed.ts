/**
 * How fast this device gets a TorrServer's streams: what its playbacks showed, kept per server in this browser. A
 * playback tells it by the seconds of picture that arrive per second while the browser still fetches ahead, times the
 * file's bytes per second (`watchLine`). Kept: the best of each of the last five playbacks within 30 days, and the
 * server's speed is the best of those — the line is at least what it once gave, and one thin swarm doesn't pull it down.
 * "Auto" ranks a release whose bitrate this doesn't carry after one it does (`ReleasePrefs.lineBps`).
 */

const KEY = "lumovio.line-speed";
const KEEP = 5;
const MONTH = 30 * 86_400_000;
type Kept = Record<string, { at: number; bps: number }[]>;

const listeners = new Set<() => void>();

function read(): Kept {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return v && typeof v === "object" ? (v as Kept) : {};
  } catch {
    return {};
  }
}

/** A playback of this server's stream got up to `bps` bytes per second. */
export function noteLine(connectionId: string, bps: number, now = Date.now()) {
  if (!(bps > 0)) return;
  const kept = read();
  kept[connectionId] = [...(kept[connectionId] ?? []).filter((x) => now - x.at < MONTH), { at: now, bps: Math.round(bps) }].slice(-KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    // Without storage "Auto" simply doesn't know the line.
  }
  for (const l of listeners) l();
}

/** The best this device got from this server lately (bytes per second), or null when no playback told it. */
export function lineSpeed(connectionId: string | null | undefined, now = Date.now()): number | null {
  if (!connectionId) return null;
  const fresh = (read()[connectionId] ?? []).filter((x) => now - x.at < MONTH);
  return fresh.length ? Math.max(...fresh.map((x) => x.bps)) : null;
}

export function subscribeLine(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Where the media is fetched to: the end of the buffered range around the playhead, in seconds, or null without one. */
function bufferedEnd(v: HTMLVideoElement): number | null {
  for (let i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime + 0.5 && v.buffered.end(i) >= v.currentTime - 0.5) return v.buffered.end(i);
  return null;
}

/**
 * Watches a playing file's buffer once a second: while the browser fetches and nothing seeks, the picture seconds that
 * arrive per second times `bytesPerSec` (the file's size over its duration) is what the line gave. The best 2-second
 * window is told once — when the buffer has run 25 s ahead (the line carries it), or after 60 s. A buffer that ran 25 s
 * ahead within a second or two counts the time it took (the line gave at least that).
 */
export function watchLine(v: HTMLVideoElement, bytesPerSec: number, onBest: (bps: number) => void): () => void {
  const samples: { t: number; end: number }[] = [];
  let best = 0;
  let told = false;
  const tell = () => {
    if (told) return;
    told = true;
    if (best > 0) onBest(best);
  };
  const start = performance.now();
  const id = setInterval(() => {
    const t = performance.now();
    const end = bufferedEnd(v);
    const ahead = end === null ? 0 : end - v.currentTime;
    const prev = samples[samples.length - 1];
    // A seek, a buffer that shrank, or none shown yet (what came before the file's header was read would count as one
    // second): the run of samples starts again.
    if (end === null || v.seeking || (prev && end < prev.end)) samples.length = 0;
    if (end !== null && !v.seeking) samples.push({ t, end });
    if (end !== null && (samples.length >= 3 || (ahead >= 25 && samples.length >= 2))) {
      const a = samples[Math.max(0, samples.length - 3)]!;
      const rate = ((end - a.end) / ((t - a.t) / 1000)) * bytesPerSec;
      if (rate > best) best = rate;
    }
    if (ahead >= 25 || t - start > 60_000) {
      clearInterval(id);
      tell();
    }
  }, 1000);
  return () => {
    clearInterval(id);
    tell();
  };
}
