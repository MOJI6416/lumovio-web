import { isVideoFile, matchEpisode, pickMovieFile, type TsFile, type TsSearchResult } from "./torrserver";
import { saveTracks } from "./release-tracks";
import { torrServerFor } from "./torrent-source";

/*
 * Reading a release's audio tracks before it is chosen (design-system 7.15 «Чтение дорожек заранее», the owner's
 * decision 2026-11-08). The account's own TorrServer adds the release for a moment without saving it, ffprobe reads its
 * file's header, and the release is removed; the tracks go to the shared cache. Lumovio has no TorrServer of its own.
 *
 * Only on suspicion (`useTorrentLookup`): a name that hides its studios, one of the best pictures found, a profile with
 * studios. The rules that keep it out of the way: it starts when the page has been idle `IDLE_MS` (requestIdleCallback),
 * at most `MAX_READS` releases per page view, one at a time across the whole app, each within `READ_TIMEOUT_MS`; the
 * first failure ends the round (a slow server or a dead swarm is not asked again); leaving the page cancels it, and a
 * release already on the server is never added again (an add would rewrite it).
 */
export const IDLE_MS = 2000;
export const MAX_READS = 2;
export const READ_TIMEOUT_MS = 30_000;

const tried = new Set<string>();
let busy = false;

const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();

export interface ReadAheadJob {
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
async function readOne(job: ReadAheadJob, r: TsSearchResult, signal: AbortSignal): Promise<{ hash: string; list: string[]; forced: string[] } | null> {
  const ts = await torrServerFor(job.connectionId);
  const list = await ts.list();
  const name = norm(r.title);
  if (list.some((t) => norm(t.title) === name || norm((t as { name?: string }).name) === name || (r.hash && t.hash.toLowerCase() === r.hash.toLowerCase()))) return null;
  const before = new Set(list.map((t) => t.hash.toLowerCase()));
  const deadline = Date.now() + READ_TIMEOUT_MS;
  const left = () => Math.max(1000, deadline - Date.now());
  const added = await ts.peek(r.origins?.[0]?.link ?? r.link, r.title.slice(0, 250));
  const hash = added?.hash?.toLowerCase();
  if (!hash) return null;
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
  const run = async () => {
    const { compactTracks } = await import("./release-tracks");
    let reads = 0;
    for (const r of job.releases) {
      if (ctrl.signal.aborted || busy || reads >= MAX_READS) return;
      if (tried.has(r.link)) continue;
      tried.add(r.link);
      busy = true;
      reads++;
      try {
        const read = await readOne(job, r, ctrl.signal).catch(() => null); // ui-lint-ignore swallowed-error: a read ahead is quiet: a failure ends the round, nobody asked for it
        if (!read) return;
        await saveTracks({ tracker: r.tracker?.slice(0, 60) ?? null, title: r.title.slice(0, 250), hash: read.hash, tracks: compactTracks(read.list, job.originalLanguage), forced: read.forced, via: "probe" }).catch(() => {}); // ui-lint-ignore swallowed-error: the shared cache is a help; the pick works without it
        if (!ctrl.signal.aborted) job.onRead();
      } finally {
        busy = false;
      }
    }
  };
  const idle = (cb: () => void) => (typeof requestIdleCallback === "function" ? requestIdleCallback(cb, { timeout: 5000 }) : window.setTimeout(cb, 0));
  const timer = window.setTimeout(() => idle(() => void run()), IDLE_MS);
  return () => {
    ctrl.abort();
    window.clearTimeout(timer);
  };
}
