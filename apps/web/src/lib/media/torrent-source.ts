import type { TitleSummary } from "@lumovio/contracts";
import { api } from "@/lib/api";
import { tmdbImage } from "@/lib/images";
import { getCredentials } from "./clients";
import { type TsSearchResult, torrServerClient } from "./torrserver";

/** A TorrServer client for a connection the active profile may use (credentials stay in memory). */
export async function torrServerFor(connectionId: string) {
  const c = await getCredentials(connectionId);
  if (c.auth.kind !== "torrserver") throw new Error("Not a TorrServer");
  return torrServerClient(c.baseUrl, c.auth, { connectionId: c.id });
}

/**
 * Adds a search result to the TorrServer and registers it in the availability index, so every device
 * of the account sees it. TorrServer keeps one copy per hash, so adding one already there creates no
 * duplicate. Null when TorrServer did not add it. A torrent several indexers returned is tried through
 * each one's link in turn (one indexer's link can be out of date); the last failure is the one thrown.
 *
 * It is saved under the release's own name (SRC-06): two versions of one film stay apart on the server, in "Added
 * torrents" and in the copies; the film it was added for goes into the torrent's data with its id.
 */
export async function addTorrentSource(connectionId: string, d: Pick<TitleSummary, "id" | "title" | "year" | "posterPath">, season: number | null, r: TsSearchResult) {
  const ts = await torrServerFor(connectionId);
  const links = r.origins?.map((o) => o.link) ?? [r.link];
  // What is there already: a torrent the server had before this add is never marked to be swept as unplayed.
  const before = await ts.list().then(
    (list) => new Set(list.map((t) => t.hash.toLowerCase())),
    () => null,
  );
  const known = r.hash ? before?.has(r.hash.toLowerCase()) : false;
  const data = { titleId: d.id, season, title: `${d.title}${d.year ? ` (${d.year})` : ""}`, ...(before && !known ? { addedAt: Date.now(), played: false } : {}) };
  let tor: Awaited<ReturnType<typeof ts.add>> | null = null;
  for (const [i, link] of links.entries()) {
    try {
      tor = await ts.add(link, r.title.slice(0, 250), data, tmdbImage(d.posterPath, "w342"));
      if (tor?.hash) break;
    } catch (e) {
      if (i === links.length - 1) throw e;
    }
  }
  if (!tor?.hash) return null;
  const hash = tor.hash.toLowerCase();
  // It was there before (an indexer gives no hash to check first): its mark goes back to one that is never swept.
  if (before?.has(hash) && "played" in data) {
    const { addedAt: _a, played: _p, ...plain } = data;
    await ts.set(hash, tor.title || r.title.slice(0, 250), tor.poster ?? "", JSON.stringify({ lumovio: plain })).catch(() => {}); // ui-lint-ignore swallowed-error: only the sweep mark is wrong then; the add itself succeeded
  }
  // What Lumovio added before and never played goes now (UNPLAYED_MINUTES), off the way of this viewing.
  void import("./torrent-manage").then((m) => m.sweepUnplayed(connectionId, hash)).catch(() => {}); // ui-lint-ignore swallowed-error: the sweep is housekeeping in the background; the next add tries again
  const label = r.title.slice(0, 190);
  await api(`/api/connections/${connectionId}/index`, {
    method: "POST",
    json: { mode: "merge", entries: [{ titleId: d.id, externalId: hash, season: null, episode: null, label, quality: null }] },
  });
  return { hash, label };
}
