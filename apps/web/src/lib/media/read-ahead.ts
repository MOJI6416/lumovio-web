import { MediaNetError } from "./net";
import { mayRemove, registerRead } from "./read-lock";
import { DAILY, noteTrackerRead, planReads, type ReadContext, trackerReadsToday } from "./read-plan";
import { lookupFiles, nameKey, shareFile } from "./release-files";
import type { RankedRelease, ReleasePrefs } from "./releases";
import { torrServerFor } from "./torrent-source";
import { isExtra, isVideoFile, matchEpisode, pickMovieFile, type TsFile, type TsSearchResult, trackersOf } from "./torrserver";
import { noteAdd } from "./tracker-adds";

/*
 * Reading what a release's file holds before anyone chooses it: the account's own TorrServer adds the release for a
 * moment without naming or saving it, reads its file's first kilobytes (TorrServer's ffprobe for a file that isn't
 * Matroska) and takes it off again; what it read goes to the shared cache (`release-files`) and this device's probes, so
 * the pick, the labels and a later start of that file know it. Lumovio has no TorrServer of its own.
 *
 * Out of the way of watching: it starts once the page has been idle `IDLE_MS`; one read at a time in the app, each within
 * `READ_TIMEOUT_MS`; never while the server plays or loads a torrent that isn't a read's (TorrServer's "preload" and
 * "working"), and never on the player's page; an add on the server stops it at once (`read-lock`); the first failure
 * ends the round. Which releases, in what order, and how many a day per server and per tracker is the plan's (`read-plan`). A release already on the server is read where it is
 * and stays; only a torrent the read itself brought is taken off — also after a closed tab, on the next round.
 */
export const IDLE_MS = 2000;
export const READ_TIMEOUT_MS = 30_000;

/** What a read ahead is for: the title page's search on one server, for the episode it ranks for. */
export interface ReadJob {
  connectionId: string;
  titleId: string;
  movie: boolean;
  year: number | null;
  season: number | null;
  episode: number | null;
}

/** Which releases to read, in order, of a ranking (`rankReleases`); `known`: the cache or a copy already tells its file. */
export type ReadPlanner = (ranked: RankedRelease[], known: (r: TsSearchResult) => boolean, ctx: ReadContext) => TsSearchResult[];

/** Reads started today through one TorrServer on this device (the plan's `DAILY`); `add` counts more. */
export function readsToday(connectionId: string, add = 0): number {
  const key = `lumovio.readAhead.${connectionId}`;
  const day = new Date().toISOString().slice(0, 10);
  try {
    const [d, n] = (localStorage.getItem(key) ?? "").split(":");
    const count = (d === day ? Number(n) || 0 : 0) + add;
    if (add) localStorage.setItem(key, `${day}:${count}`);
    return count;
  } catch {
    // No storage, no count: nothing is read.
    return DAILY;
  }
}

/** Torrents a read added and hasn't taken off yet ("<connectionId>:<hash>"): a tab closed in the middle leaves one. */
const LEFT_KEY = "lumovio.readAhead.left";
function leftOver(entry: string, add: boolean | null = null): string[] {
  try {
    const list = (JSON.parse(localStorage.getItem(LEFT_KEY) ?? "[]") as string[]).filter((x) => typeof x === "string");
    if (add === null) return list;
    const next = add ? [...new Set([...list, entry])] : list.filter((x) => x !== entry);
    localStorage.setItem(LEFT_KEY, JSON.stringify(next.slice(-50)));
    return next;
  } catch {
    return [];
  }
}

/** Hashes a read in this tab holds now: their torrents working is the read's, not a player's. */
const reading = new Set<string>();

export type ReadOutcome =
  /** Read; `there`: the torrent was on the server and stays. */
  | { kind: "read"; hash: string; there: boolean; ms: number }
  /** The server plays or loads something: not now. */
  | { kind: "busy" }
  /** No file to read (a pack without the episode, no video). */
  | { kind: "nofile" }
  /** The server didn't add it, or didn't read it in time. */
  | { kind: "failed" };

/** The file a read looks at: the film, else the wanted episode, else the pack's first episode (a season's files share their tracks). */
function fileFor(files: TsFile[], title: string, job: ReadJob): TsFile | null {
  if (job.movie) {
    const f = pickMovieFile(files, job.year);
    return f.status === "match" ? f.file : (f.candidates[0] ?? null);
  }
  if (job.season !== null && job.episode !== null) {
    const f = matchEpisode(files, title, job.season, job.episode);
    if (f.status === "match") return f.file;
  }
  return files.filter((f) => isVideoFile(f.path) && !isExtra(f.path)).sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))[0] ?? null;
}

/** Whether a torrent's size is the result's (indexers round sizes): within 1 %, unknown counts. */
const sizeFits = (a: number | null | undefined, b: number | null | undefined) => !a || !b || Math.abs(a - b) <= Math.max(1 << 20, 0.01 * Math.max(a, b));

/** One release read through the account's TorrServer (see the module's rules). */
export async function readRelease(job: ReadJob, r: TsSearchResult, signal: AbortSignal, quiet: Set<string> = new Set()): Promise<ReadOutcome> {
  const t0 = performance.now();
  const deadline = Date.now() + READ_TIMEOUT_MS;
  const left = () => Math.max(1000, deadline - Date.now());
  const ts = await torrServerFor(job.connectionId);
  const list = await ts.list();
  if (!Array.isArray(list)) return { kind: "failed" };
  if (list.some((t) => (t.stat === 2 || t.stat === 3) && !reading.has(t.hash.toLowerCase()))) return { kind: "busy" };
  // Already on the server — by its hash, or by its name with its size: read where it is, never added again.
  const name = nameKey(r.title);
  const there = list.find((t) => r.hash && t.hash.toLowerCase() === r.hash.toLowerCase()) ?? list.find((t) => nameKey(t.title ?? "") === name && sizeFits(t.torrent_size, r.size));
  const before = new Set(list.map((t) => t.hash.toLowerCase()));
  let hash = there?.hash.toLowerCase() ?? null;
  if (!hash) {
    try {
      hash = (await ts.quietAdd(r.link, left()))?.hash?.toLowerCase() || null;
    } catch (e) {
      // The tracker gave the server no torrent (TorrServer's 400): as an add from it would fail ("Watch" then tries
      // another release). Another error is the server's own, not the tracker's.
      if (e instanceof MediaNetError && e.code === "http" && e.status === 400) noteAdd(trackersOf(r), false);
      // Too slow: it may have come after all — the one torrent the server has now that it didn't.
      if (e instanceof MediaNetError && e.code === "timeout") {
        const brought = ((await ts.list().catch(() => [])) ?? []).filter((t) => !before.has(t.hash.toLowerCase()) && !t.title);
        if (brought.length === 1) await ts.remove(brought[0]!.hash).catch(() => undefined); // ui-lint-ignore swallowed-error: a torrent that came late and was never saved; the next round looks again
      }
      return { kind: "failed" };
    }
    if (!hash) return { kind: "failed" };
    noteAdd(trackersOf(r), true);
  }
  const ours = !before.has(hash);
  const entry = `${job.connectionId}:${hash}`;
  if (ours) {
    quiet.add(hash);
    leftOver(entry, true);
  }
  reading.add(hash);
  try {
    const { files } = await ts.files(hash, true, left(), signal);
    const file = fileFor(files, r.title, job);
    if (!file) return { kind: "nofile" };
    signal.throwIfAborted();
    const probe = await ts.readProbe(hash, file, signal, left());
    if (!probe?.streams?.length) return { kind: "failed" };
    // This device's starts of that file go without a probe; every account's picks know it.
    void import("./probe-memory").then((m) => m.rememberProbe(`${hash}:${file.id}`, probe));
    await shareFile(hash, file.id, probe, [
      { title: r.title, size: r.size },
      { title: there?.title, size: there?.torrent_size },
    ]);
    return { kind: "read", hash, there: !ours, ms: Math.round(performance.now() - t0) };
  } catch {
    return { kind: "failed" };
  } finally {
    reading.delete(hash);
    if (ours) {
      if (await mayRemove(job.connectionId, hash)) await ts.remove(hash).catch(() => undefined); // ui-lint-ignore swallowed-error: a torrent the read brought and never saved; the next round takes it off
      quiet.delete(hash);
      leftOver(entry, false);
    }
  }
}

/** Torrents an earlier read left (a closed tab): off the server, unless something named it since or it plays. */
async function takeOffLeftovers(connectionId: string) {
  const mine = leftOver("").filter((x) => x.startsWith(`${connectionId}:`));
  if (mine.length === 0) return;
  const ts = await torrServerFor(connectionId);
  const list = await ts.list();
  if (!Array.isArray(list)) return;
  for (const entry of mine) {
    const hash = entry.slice(connectionId.length + 1);
    const t = list.find((x) => x.hash.toLowerCase() === hash);
    // Named since ("Watch" took it) or gone: nothing to do. Working: another tab's read may hold it — the next round.
    if (t && !t.title) {
      if (t.stat === 2 || t.stat === 3 || !(await mayRemove(connectionId, hash))) continue;
      const removed = await ts.remove(hash).then(
        () => true,
        () => false,
      );
      if (!removed) continue;
    }
    leftOver(entry, false);
  }
}

/** One read at a time in the app. */
let busy = false;
/** Releases a read was started for in this tab: never read twice. */
const tried = new Set<string>();
/** Reads started per title in this tab. */
const forTitle = new Map<string, number>();

/**
 * Reads the releases `plan` picks of the current ranking (`ranking()`, asked again after every read: a read can change
 * it), by the module's rules. `onRead`: a read's facts are in the cache now. Returns the cancel for when the page goes.
 */
export function readAhead(
  job: ReadJob,
  ranking: () => { ranked: RankedRelease[]; known: (r: TsSearchResult) => boolean; prefs: ReleasePrefs; shown?: readonly TsSearchResult[] } | null,
  onRead: (r: TsSearchResult) => void,
  plan: ReadPlanner = planReads,
): () => void {
  const ctrl = new AbortController();
  const held = registerRead(job.connectionId, () => ctrl.abort());
  const run = async () => {
    if (busy || ctrl.signal.aborted) return;
    busy = true;
    try {
      await takeOffLeftovers(job.connectionId).catch(() => undefined); // ui-lint-ignore swallowed-error: a read ahead is quiet; the next round looks again
      // Every release is read once at most (`tried`): the plan runs out.
      while (!ctrl.signal.aborted) {
        const now = ranking();
        if (!now || readsToday(job.connectionId) >= DAILY) return;
        // `shown`: the rows a list shows (the sources screen), for a plan that reads what is in sight.
        const ctx: ReadContext & { shown?: readonly TsSearchResult[] } = { readsToday: readsToday(job.connectionId), prefs: now.prefs, readsForTitle: forTitle.get(job.titleId) ?? 0, trackerReadsToday: trackerReadsToday(job.connectionId), shown: now.shown };
        const next = plan(now.ranked, now.known, ctx).find((r) => !tried.has(r.link));
        if (!next) return;
        tried.add(next.link);
        readsToday(job.connectionId, 1);
        noteTrackerRead(job.connectionId, next);
        forTitle.set(job.titleId, (forTitle.get(job.titleId) ?? 0) + 1);
        const out = await readRelease(job, next, ctrl.signal, held.quiet).catch((): ReadOutcome => ({ kind: "failed" }));
        if (out.kind === "read") {
          await lookupFiles([next], ctrl.signal, true).catch(() => undefined); // ui-lint-ignore swallowed-error: the read is kept; this tab sees it on its next search
          if (!ctrl.signal.aborted) onRead(next);
          // The page ranks again before the next plan.
          await new Promise((ok) => setTimeout(ok, 500));
        } else if (out.kind !== "nofile") return;
      }
    } finally {
      busy = false;
      held.end();
    }
  };
  const idle = (cb: () => void) => (typeof requestIdleCallback === "function" ? requestIdleCallback(cb, { timeout: 5000 }) : window.setTimeout(cb, 0));
  const timer = window.setTimeout(() => idle(() => void run()), IDLE_MS);
  return () => {
    window.clearTimeout(timer);
    ctrl.abort();
  };
}
