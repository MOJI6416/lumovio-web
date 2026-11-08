import { isVideoFile, matchEpisode, pickMovieFile, type TsFile, type TsSearchResult } from "./torrserver";
import { saveTracks } from "./release-tracks";
import { torrServerFor } from "./torrent-source";

/*
 * Reading a release's audio tracks before it is chosen (design-system 7.15 «Чтение дорожек заранее», the owner's
 * decision 2026-11-08). The account's own TorrServer adds the release for a moment without saving it, ffprobe reads its
 * file's header, and the release is removed; the tracks go to the shared cache. Lumovio has no TorrServer of its own.
 *
 * For a profile with studios (`useTorrentLookup`), in `readOrder`: names that hide their studios first, then the best
 * pictures. The rules that keep it out of the way (the owner, 2026-11-08): it starts when the page has been idle
 * `IDLE_MS` (requestIdleCallback); at most `MAX_READS` releases per title in a tab, `AT_ONCE` at a time across the app,
 * `DAILY_READS` a day per TorrServer on this device, each within `READ_TIMEOUT_MS`; never while the server streams to a
 * player (a torrent working that isn't a read's); the first failure ends the round (a slow server or a dead swarm is
 * not asked again); leaving the page cancels it, and a
 * release already on the server is read where it is, never added again (an add would rewrite it) nor removed. One the
 * name didn't give away (a Jackett result has no hash) comes out of the read as it went in: its title, poster and data
 * put back, and only a hash the server didn't have before the read is removed after it.
 */
export const IDLE_MS = 2000;
export const MAX_READS = 5;
export const AT_ONCE = 2;
export const DAILY_READS = 40;
export const READ_TIMEOUT_MS = 30_000;

const tried = new Set<string>();
/** Reads started per title in this tab: `MAX_READS` for a title, however often its ranking changes. */
const readsOf = new Map<string, number>();
/** Hashes this tab read: their torrents working (now, or still, after a read) is the reads', not a player's. */
const reading = new Set<string>();
let running = 0;

/** Reads started today on this device through one TorrServer (`DAILY_READS`), kept in localStorage by day. */
export function readsToday(connectionId: string, add = 0): number {
  const key = `lumovio.readAhead.${connectionId}`;
  const day = new Date().toISOString().slice(0, 10);
  try {
    const [d, n] = (localStorage.getItem(key) ?? "").split(":");
    const count = (d === day ? Number(n) || 0 : 0) + add;
    if (add) localStorage.setItem(key, `${day}:${count}`);
    return count;
  } catch {
    return add ? 0 : DAILY_READS;
  }
}

const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();

export interface ReadAheadJob {
  titleId: string;
  connectionId: string;
  releases: TsSearchResult[];
  originalLanguage: string | null;
  movie: boolean;
  year: number | null;
  season: number | null;
  episode: number | null;
  onRead: () => void;
}

/** The file a read looks at: the film, else the wanted episode, else the first episode file of a pack. */
function fileFor(files: TsFile[], title: string, job: ReadAheadJob): TsFile | null {
  if (job.movie) {
    const f = pickMovieFile(files, job.year);
    return f.status === "match" ? f.file : (f.candidates[0] ?? null);
  }
  if (job.season !== null && job.episode !== null) {
    const f = matchEpisode(files, title, job.season, job.episode);
    if (f.status === "match") return f.file;
  }
  return files.filter((f) => isVideoFile(f.path)).sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))[0] ?? null;
}

/** One release's tracks through the account's TorrServer, or null (already there, no file, too slow, cancelled). */
export async function readOne(job: ReadAheadJob, r: TsSearchResult, signal: AbortSignal): Promise<{ hash: string; list: string[]; forced: string[] } | null> {
  const ts = await torrServerFor(job.connectionId);
  const list = await ts.list();
  const name = norm(r.title);
  // Already on the server (the same name or hash): read as it is — never added again, which would rewrite it.
  const there = list.find((t) => norm(t.title) === name || norm((t as { name?: string }).name) === name || (r.hash && t.hash.toLowerCase() === r.hash.toLowerCase()));
  // The server streams to a player now (TorrServer's "working", 3, on a torrent no read of ours holds): not now.
  if (list.some((t) => t.stat === 3 && !reading.has(t.hash.toLowerCase()))) return null;
  const before = new Map(list.map((t) => [t.hash.toLowerCase(), t]));
  const deadline = Date.now() + READ_TIMEOUT_MS;
  const left = () => Math.max(1000, deadline - Date.now());
  const hash = there ? there.hash.toLowerCase() : (await ts.peek(r.origins?.[0]?.link ?? r.link, r.title.slice(0, 250)))?.hash?.toLowerCase();
  if (!hash) return null;
  reading.add(hash);
  // The peek hit a torrent the server had (TorrServer keeps one per hash, and the add rewrote its name and data).
  const had = there ? null : before.get(hash);
  if (had) await ts.set(had.hash, had.title, had.poster ?? "", had.data ?? "").catch(() => {}); // ui-lint-ignore swallowed-error: the read goes on; the torrent itself stays on the server either way
  try {
    const t = await ts.stat(hash, left(), signal);
    const file = fileFor(t.file_stats ?? [], r.title, job);
    if (!file || signal.aborted) return null;
    const probe = await ts.ffprobe(hash, file.id, left(), signal);
    const streams = probe?.streams ?? [];
    const audio = streams.filter((s) => s.codec_type === "audio").map((s) => `${s.tags?.language ?? ""}|${s.tags?.title ?? ""}`);
    const forced = [...new Set(streams.filter((s) => s.codec_type === "subtitle" && s.disposition?.forced && s.tags?.language).map((s) => s.tags!.language!.slice(0, 3).toLowerCase()))];
    return audio.length ? { hash, list: audio, forced } : null;
  } finally {
    // What was there before this read stays; what the read added goes.
    if (!before.has(hash)) await ts.remove(hash).catch(() => {}); // ui-lint-ignore swallowed-error: a read added it for a moment; a failed removal leaves only a torrent TorrServer never saved
  }
}

/** Reads the releases in order (see the module's rules); returns a cancel for when the page goes. */
export function readAhead(job: ReadAheadJob): () => void {
  const ctrl = new AbortController();
  const queue = [...job.releases];
  // One lane of reads; `AT_ONCE` lanes share the queue, and the first failure in either ends the round.
  const lane = async () => {
    const { compactTracks } = await import("./release-tracks");
    for (let r = queue.shift(); r; r = queue.shift()) {
      if (ctrl.signal.aborted || running >= AT_ONCE || (readsOf.get(job.titleId) ?? 0) >= MAX_READS || readsToday(job.connectionId) >= DAILY_READS) return;
      if (tried.has(r.link)) continue;
      tried.add(r.link);
      running++;
      readsOf.set(job.titleId, (readsOf.get(job.titleId) ?? 0) + 1);
      readsToday(job.connectionId, 1);
      try {
        const read = await readOne(job, r, ctrl.signal).catch(() => null); // ui-lint-ignore swallowed-error: a read ahead is quiet: a failure ends the round, nobody asked for it
        if (!read) return ctrl.abort();
        await saveTracks({ tracker: r.tracker?.slice(0, 60) ?? null, title: r.title.slice(0, 250), hash: read.hash, tracks: compactTracks(read.list, job.originalLanguage), forced: read.forced, via: "probe" }).catch(() => {}); // ui-lint-ignore swallowed-error: the shared cache is a help; the pick works without it
        if (!ctrl.signal.aborted) job.onRead();
      } finally {
        running--;
      }
    }
  };
  const run = () => Promise.all(Array.from({ length: AT_ONCE }, lane));
  const idle = (cb: () => void) => (typeof requestIdleCallback === "function" ? requestIdleCallback(cb, { timeout: 5000 }) : window.setTimeout(cb, 0));
  const timer = window.setTimeout(() => idle(() => void run()), IDLE_MS);
  return () => {
    ctrl.abort();
    window.clearTimeout(timer);
  };
}
