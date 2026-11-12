/**
 * Trackers whose torrents this device's TorrServer couldn't add lately: TorrServer fetches a found release's .torrent
 * through the indexer, and some trackers don't give it (their limits, a login the indexer lacks), whatever the release's
 * seeders. Such a tracker is "failing" for a week after a failed add, until an add from it goes through again; the
 * ranking puts its releases after the others (`ReleasePrefs.failingTrackers`). Kept in this browser only.
 */

const KEY = "lumovio.tracker-adds";
const WEEK = 7 * 86_400_000;
type Seen = Record<string, { failedAt?: number; addedAt?: number }>;

const listeners = new Set<() => void>();
const EMPTY: ReadonlySet<string> = new Set();
let snapshot: { raw: string | null; set: ReadonlySet<string> } | null = null;

function raw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(text: string | null): Seen {
  try {
    const v = text ? JSON.parse(text) : {};
    return v && typeof v === "object" ? (v as Seen) : {};
  } catch {
    return {};
  }
}

/** The failing ones in a record, at `now`. */
export function failingIn(seen: Seen, now: number): ReadonlySet<string> {
  const out = new Set<string>();
  for (const [tracker, s] of Object.entries(seen)) if (s.failedAt && now - s.failedAt < WEEK && (s.addedAt ?? 0) < s.failedAt) out.add(tracker);
  return out.size ? out : EMPTY;
}

/** An add from these trackers went through (`ok`) or TorrServer couldn't fetch its torrent. */
export function noteAdd(trackers: readonly (string | null)[], ok: boolean, now = Date.now()) {
  const named = trackers.filter((t): t is string => Boolean(t));
  if (named.length === 0) return;
  const seen = parse(raw());
  for (const t of named) seen[t] = { ...seen[t], ...(ok ? { addedAt: now } : { failedAt: now }) };
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    // Without storage the ranking simply doesn't learn it.
  }
  snapshot = null;
  for (const l of listeners) l();
}

/** For `useSyncExternalStore`: the failing trackers, the same set while nothing changed. */
export function failingTrackers(): ReadonlySet<string> {
  const text = raw();
  if (!snapshot || snapshot.raw !== text) snapshot = { raw: text, set: failingIn(parse(text), Date.now()) };
  return snapshot.set;
}

export const noFailingTrackers = (): ReadonlySet<string> => EMPTY;

export function subscribeTrackers(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
