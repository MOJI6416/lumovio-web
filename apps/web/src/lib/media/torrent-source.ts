import type { TitleSummary } from "@lumovio/contracts";
import { api } from "@/lib/api";
import { tmdbImage } from "@/lib/images";
import { getCredentials } from "./clients";
import { MediaNetError } from "./net";
import { type TsSearchResult, torrServerClient } from "./torrserver";

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
 */
export async function addTorrentSource(connectionId: string, d: Pick<TitleSummary, "id" | "title" | "year" | "posterPath">, season: number | null, r: TsSearchResult) {
  const ts = await torrServerFor(connectionId);
  const before = await hashesOn(ts);
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
 * Takes back a torrent an add brought (`existed: false`) when the person left before it played —
 * "←" during the add: off the server and out of the index. Never one that was there before. Best effort:
 * a failure leaves Lumovio's own marked torrent, which the server's list offers to clear.
 */
export async function takeBack(connectionId: string, hash: string) {
  const ts = await torrServerFor(connectionId);
  await ts.remove(hash);
  await api(`/api/connections/${connectionId}/index/forget`, { method: "POST", json: { hashes: [hash] } });
}
