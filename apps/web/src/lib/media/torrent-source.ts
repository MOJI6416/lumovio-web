import type { TitleSummary } from "@lumovio/contracts";
import { api } from "@/lib/api";
import { tmdbImage } from "@/lib/images";
import { getCredentials } from "./clients";
import { MediaNetError } from "./net";
import { whileAdding } from "./read-lock";
import { type TsSearchResult, torrServerClient } from "./torrserver";
import { noteAdd } from "./tracker-adds";

/** A TorrServer client for a connection the active profile may use (credentials stay in memory). */
export async function torrServerFor(connectionId: string) {
  const c = await getCredentials(connectionId);
  if (c.auth.kind !== "torrserver") throw new Error("Not a TorrServer");
  return torrServerClient(c.baseUrl, c.auth, { connectionId: c.id });
}

type TsClient = Awaited<ReturnType<typeof torrServerFor>>;

/** The hashes on the server now. Anything but a list is a failed read: nothing is added without knowing what is there. */
async function hashesOn(ts: TsClient): Promise<Set<string>> {
  const list: unknown = await ts.list();
  if (!Array.isArray(list)) throw new Error("TorrServer didn't answer with a torrent list");
  return new Set(list.map((t: { hash?: unknown }) => String(t?.hash ?? "").toLowerCase()));
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Adds a search result to the TorrServer and registers it in the availability index, so every device
 * of the account sees it. TorrServer keeps one copy per hash, so adding one already there creates no
 * duplicate. Null when TorrServer did not add it. A torrent several indexers returned is tried through
 * each one's link in turn (one indexer's link can be out of date); the last failure is the one thrown.
 *
 * A torrent already on the server — the person's own, added in Lampa or by hand, or added before — is only linked to the
 * title: Lumovio never renames it or puts its mark on it. Search results carry no hash
 * (Jackett's links don't), so the add is quiet first (nothing named, nothing saved), and the server's list from before it
 * tells whether the torrent is new. Only a new one is saved under the release's own name (two versions of one
 * film stay apart on the server, in "Added torrents" and in the copies), with the poster and Lumovio's mark — the film it
 * was added for, with its id. `existed`: it was on the server before.
 *
 * A slow tracker can keep the server fetching the .torrent past the wait: it may still have added it, and then it is the
 * one torrent its list has that it didn't have before. An index that can't be written after a few tries takes back a
 * torrent this add brought (it would be on the server linked to nothing); one that was there stays as it was.
 *
 * Read aheads on the server stop first (`read-lock`); a torrent one of them added for a moment is new to the add, and the
 * one the add takes stays on the server.
 */
export function addTorrentSource(connectionId: string, d: Pick<TitleSummary, "id" | "title" | "year" | "posterPath">, season: number | null, r: TsSearchResult) {
  return whileAdding(connectionId, (quiet, adopt) => addNow(connectionId, d, season, r, quiet, adopt));
}

async function addNow(connectionId: string, d: Pick<TitleSummary, "id" | "title" | "year" | "posterPath">, season: number | null, r: TsSearchResult, quiet: ReadonlySet<string>, adopt: (hash: string) => void) {
  const ts = await torrServerFor(connectionId);
  const before = await hashesOn(ts);
  for (const h of quiet) before.delete(h);
  const links = r.origins?.map((o) => o.link) ?? [r.link];
  let hash: string | null = null;
  for (const [i, link] of links.entries()) {
    try {
      hash = (await ts.quietAdd(link))?.hash?.toLowerCase() || null;
    } catch (e) {
      if (e instanceof MediaNetError && e.code === "timeout") {
        const brought = [...(await hashesOn(ts))].filter((h) => !before.has(h));
        if (brought.length === 1) hash = brought[0]!;
      }
      if (!hash && i === links.length - 1) throw e;
    }
    if (hash) break;
  }
  if (!hash) return null;
  adopt(hash);
  const existed = before.has(hash);
  // `added`: the mark of a torrent this add brought — only such a one is surely Lumovio's (in older versions
  // an add also marked the person's torrent it rewrote), so only it is cleared by itself (torrent-sweep).
  if (!existed) await ts.claim(hash, r.title.slice(0, 250), { titleId: d.id, season, title: `${d.title}${d.year ? ` (${d.year})` : ""}`, added: Date.now() }, tmdbImage(d.posterPath, "w342"));
  const label = r.title.slice(0, 190);
  for (let attempt = 1; ; attempt++) {
    try {
      await api(`/api/connections/${connectionId}/index`, {
        method: "POST",
        json: { mode: "merge", entries: [{ titleId: d.id, externalId: hash, season: null, episode: null, label, quality: null }] },
      });
      break;
    } catch (e) {
      if (attempt < 3) {
        await pause(attempt * 1000);
        continue;
      }
      if (!existed) await ts.remove(hash).catch(() => undefined); // ui-lint-ignore swallowed-error: the index's error is the one shown; a failed take-back leaves Lumovio's own marked torrent the manager lists
      throw e;
    }
  }
  return { hash, label, existed };
}

/**
 * The first of `results` that the server adds (`addTorrentSource`), in their order: a release whose torrent TorrServer
 * couldn't fetch through its indexer — the server answered with an error, or took too long and brought nothing — is
 * passed for the next one, and its trackers are remembered as failing on this device (`tracker-adds`); one that adds
 * clears them. A failure of the server itself (out of reach, a refused password, a blocked address) ends it at once:
 * the tracker isn't to blame. Null when the last one gave no torrent either; the last such error is thrown.
 */
export async function addFirstWorking(connectionId: string, d: Pick<TitleSummary, "id" | "title" | "year" | "posterPath">, season: number | null, results: readonly TsSearchResult[]) {
  let failure: unknown = null;
  for (const r of results) {
    const trackers = r.origins?.map((o) => o.tracker) ?? [r.tracker];
    try {
      const added = await addTorrentSource(connectionId, d, season, r);
      if (added) {
        noteAdd(trackers, true);
        return { ...added, result: r };
      }
      noteAdd(trackers, false);
    } catch (e) {
      if (!(e instanceof MediaNetError && (e.code === "http" || e.code === "timeout"))) throw e;
      noteAdd(trackers, false);
      failure = e;
    }
  }
  if (failure) throw failure;
  return null;
}

/**
 * Takes back a torrent an add brought (`existed: false`) when the person left before it played —
 * "←" during the add: off the server and out of the index. Never one that was there before. Best effort:
 * a failure leaves Lumovio's own marked torrent, which the server's list offers to clear.
 */
export async function takeBack(connectionId: string, hash: string) {
  const ts = await torrServerFor(connectionId);
  await ts.remove(hash);
  await api(`/api/connections/${connectionId}/index/forget`, { method: "POST", json: { hashes: [hash] } });
}
