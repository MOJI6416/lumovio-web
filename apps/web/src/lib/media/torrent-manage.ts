import type { ConnectionTorrentIndex, TorrentIndexEntry } from "@lumovio/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MediaNetError } from "./net";
import { parseRelease } from "./releases";
import { markedTitle } from "./torrent-link";
import { torrServerFor } from "./torrent-source";
import type { TsTorrent } from "./torrserver";

/**
 * Managing what is added to a TorrServer (TS7): its own list, read from this device like all other
 * TorrServer traffic, next to what Lumovio's availability index links to each torrent; real removal by
 * hash, checked against the server's list before the index changes. Lumovio's servers never contact
 * the TorrServer.
 */

/** A list entry as MatriX gives it: `title` is what the torrent was added as, `name` the torrent's own name. */
type ListedTorrent = TsTorrent & { name?: string; timestamp?: number };

const HASH = /^[a-f0-9]{40}$/i;

/**
 * The server's full list. Anything but a list of torrents with hashes is a failed read — never an
 * empty server — so it can't make Lumovio forget what is there.
 */
export function asTorrentList(raw: unknown): ListedTorrent[] {
  if (!Array.isArray(raw)) throw new Error("TorrServer didn't answer with a torrent list");
  for (const t of raw) if (typeof t?.hash !== "string" || !HASH.test(t.hash)) throw new Error("TorrServer's list has an entry without a hash");
  return raw as ListedTorrent[];
}

export interface ManagedTorrent {
  hash: string;
  /** The torrent's own name, else what it was added as. */
  name: string;
  /** Content size: the files' total, not the disk or cache space the server uses. */
  sizeBytes: number | null;
  /** TorrServer is fetching or streaming it right now (stat 1–3): someone may be watching. */
  active: boolean;
  /** Added through Lumovio (it leaves its mark in the torrent's data). */
  fromLumovio: boolean;
  /** The film or series it was added for in Lumovio, as written then ("Дюна (2021)"); null when it doesn't say. */
  addedFor: string | null;
  /** The title its own data names (Lumovio's mark, Lampa's card): a sure match while it isn't linked (`torrent-link`). */
  mark: string | null;
  /** What Lumovio's index links to this torrent on this server: a film, or episodes, of any title. */
  links: TorrentIndexEntry["links"];
  /** Picture and audio as far as the release name tells. */
  release: { resolution: number | null; hdr: boolean; voice: string | null; studios: string[]; languages: string[] };
  addedAt: number | null;
}

/**
 * Lumovio's mark in a torrent's data: `{ lumovio: { titleId, season, title } }` (`title` since SRC-06); since 2026-11-08
 * also `addedAt` (ms) and `played` — false from the add until a player first gets the file (`markPlayed`).
 */
export function lumovioData(data: string | undefined): { titleId?: string; title?: string; addedAt?: number; played?: boolean } | null {
  try {
    const mark = data ? JSON.parse(data)?.lumovio : null;
    return mark && typeof mark === "object" ? mark : null;
  } catch {
    return null;
  }
}

/** The server's list joined with the index, newest first. A torrent Lumovio doesn't know stays, under its own name. */
export function managedTorrents(list: ListedTorrent[], index: TorrentIndexEntry[]): ManagedTorrent[] {
  const links = new Map(index.map((t) => [t.hash, t.links]));
  return list
    .map((t) => {
      const hash = t.hash.toLowerCase();
      const own = links.get(hash) ?? [];
      // The release name: the torrent's own, or the search result it was added from (kept as the label).
      const releaseName = t.name || own.find((l) => !l.externalId.includes(":"))?.label || t.title || "";
      const files = t.file_stats?.reduce((s, f) => s + (f.length || 0), 0) ?? 0;
      const info = parseRelease(releaseName);
      const mark = lumovioData(t.data);
      return {
        hash,
        name: t.name || t.title || hash,
        sizeBytes: t.torrent_size && t.torrent_size > 0 ? t.torrent_size : files > 0 ? files : null,
        active: t.stat === 1 || t.stat === 2 || t.stat === 3,
        fromLumovio: mark !== null,
        // Before SRC-06 a torrent was added under the film's name: that name is what it was added for.
        addedFor: typeof mark?.title === "string" ? mark.title : mark && t.title ? t.title : null,
        mark: markedTitle(t.data),
        links: own,
        release: { resolution: info.resolution, hdr: info.hdr, voice: info.voice, studios: info.studios, languages: info.languages },
        addedAt: typeof t.timestamp === "number" && t.timestamp > 0 ? t.timestamp : null,
      };
    })
    .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
}

/**
 * How long a torrent Lumovio added may wait for its first playback: one that never reached a player in this time (no
 * metadata, no peers) is taken off the server at the next add (`sweepUnplayed`).
 */
export const UNPLAYED_MINUTES = 30;

/**
 * Torrents Lumovio added that never reached a player within `UNPLAYED_MINUTES`: their mark says `played: false` with
 * the time of the add. Torrents without that mark — added in TorrServer's own interface or by another app, added by
 * Lumovio before the mark existed, or already there when Lumovio added them — are never in it.
 */
export function unplayedHashes(list: ListedTorrent[], now = Date.now()): string[] {
  return list
    .filter((t) => {
      const mark = lumovioData(t.data);
      return mark?.played === false && typeof mark.addedAt === "number" && now - mark.addedAt > UNPLAYED_MINUTES * 60_000;
    })
    .map((t) => t.hash.toLowerCase());
}

/** Takes off this TorrServer (and the index) what Lumovio added and never played (`unplayedHashes`), but `keep`. */
export async function sweepUnplayed(connectionId: string, keep: string | null = null): Promise<string[]> {
  const ts = await torrServerFor(connectionId);
  const hashes = unplayedHashes(asTorrentList(await ts.list())).filter((h) => h !== keep);
  if (hashes.length > 0) await removeTorrents(connectionId, hashes);
  return hashes;
}

/** The torrent reached a player: its mark says so, and it is no longer swept. Only a mark that says `played: false` is touched. */
export async function markPlayed(connectionId: string, hash: string): Promise<void> {
  const ts = await torrServerFor(connectionId);
  const t = await ts.get(hash);
  const mark = lumovioData(t?.data);
  if (!t || mark?.played !== false) return;
  await ts.set(hash, t.title, t.poster ?? "", JSON.stringify({ lumovio: { ...mark, played: true } }));
}

/** Hashes the index links on this server that its full list doesn't have (removed in TorrServer's own UI, say). */
export function staleHashes(index: TorrentIndexEntry[], list: ListedTorrent[]): string[] {
  const present = new Set(list.map((t) => t.hash.toLowerCase()));
  return index.map((t) => t.hash).filter((h) => !present.has(h));
}

/** What removing a torrent takes away in Lumovio: one film, or a series' episodes (a season pack: all of them). */
export function removalScope(t: Pick<ManagedTorrent, "links">): { titles: string[]; episodes: number; films: number } {
  const titles = [...new Set(t.links.map((l) => l.titleId))];
  const episodes = new Set(t.links.filter((l) => l.season !== null).map((l) => `${l.titleId}:${l.season}:${l.episode}`)).size;
  const films = titles.filter((id) => id.startsWith("movie:")).length;
  return { titles, episodes, films };
}

/** What the profile has watched of a title, as `/api/library/state` says it. */
export type WatchedState = { watchedCount: number; watchedEpisodes: string[] };

/**
 * "Watched in this profile" (TS7 filter): every film the torrent is linked to watched to the end in this profile, and
 * every episode its files are bound to. A series' torrent whose files aren't bound to episodes yet tells nothing, so it
 * isn't counted; nor is one not linked at all. It helps make a list to remove — it says nothing of other profiles.
 */
export function watchedInProfile(t: Pick<ManagedTorrent, "links">, states: ReadonlyMap<string, WatchedState>): boolean {
  if (t.links.length === 0) return false;
  for (const id of new Set(t.links.map((l) => l.titleId))) {
    const s = states.get(id);
    if (!s) return false;
    if (id.startsWith("movie:")) {
      if (s.watchedCount === 0) return false;
      continue;
    }
    const eps = t.links.filter((l) => l.titleId === id && l.season !== null && l.episode !== null);
    if (eps.length === 0 || !eps.every((l) => s.watchedEpisodes.includes(`s${l.season}e${l.episode}`))) return false;
  }
  return true;
}

export type RemovalStatus =
  /** Gone from the server (its list was checked) and from Lumovio's index. */
  | "removed"
  /** Gone from the server, but Lumovio's index still links it: retry the reconciliation (never re-add). */
  | "index_pending"
  /** The server still lists it: it refused, failed, or is read-only (MatriX answers 200 then). */
  | "still_there"
  /** The server couldn't be asked, or its list couldn't be read afterwards: nothing is known. */
  | "unknown";

export interface RemovalResult {
  hash: string;
  status: RemovalStatus;
  /** Index entries removed (the torrent and its bound films/episodes); 0 until the index changed. */
  links: number;
  error: unknown;
}

const NO_SERVER: ReadonlySet<string> = new Set(["timeout", "unreachable", "cors", "mixed_content", "local_network", "tls", "auth"]);

/**
 * Removal against any server and index (the real ones are wired up by `removeTorrents`). One `rem` at
 * a time; once the server is clearly out of reach the rest aren't sent. Then the full list decides,
 * whatever `rem` answered; only hashes it no longer has leave the index.
 */
export async function removeVia(
  server: { remove(hash: string): Promise<void>; list(): Promise<unknown> },
  forget: (hashes: string[]) => Promise<Record<string, number>>,
  hashes: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<RemovalResult[]> {
  const wanted = [...new Set(hashes.map((h) => h.toLowerCase()))];
  const sent = new Map<string, unknown>();
  let offline: unknown = null;
  for (const [i, hash] of wanted.entries()) {
    if (offline) {
      sent.set(hash, offline);
      continue;
    }
    try {
      await server.remove(hash);
      sent.set(hash, null);
    } catch (e) {
      sent.set(hash, e);
      if (e instanceof MediaNetError && NO_SERVER.has(e.code)) offline = e;
    }
    onProgress?.(i + 1, wanted.length);
  }
  let present: Set<string>;
  try {
    present = new Set(asTorrentList(await server.list()).map((t) => t.hash.toLowerCase()));
  } catch (e) {
    return wanted.map((hash) => ({ hash, status: "unknown", links: 0, error: sent.get(hash) ?? e }));
  }
  const gone = wanted.filter((h) => !present.has(h));
  const done = gone.length > 0 ? await forgetOnly(forget, gone) : [];
  return wanted.map((hash) => done.find((r) => r.hash === hash) ?? { hash, status: "still_there", links: 0, error: sent.get(hash) ?? null });
}

async function forgetOnly(forget: (hashes: string[]) => Promise<Record<string, number>>, hashes: string[]): Promise<RemovalResult[]> {
  const out: RemovalResult[] = [];
  for (let i = 0; i < hashes.length; i += 200) {
    const chunk = hashes.slice(i, i + 200);
    try {
      const removed = await forget(chunk);
      out.push(...chunk.map((hash) => ({ hash, status: "removed" as const, links: removed[hash] ?? 0, error: null })));
    } catch (e) {
      out.push(...chunk.map((hash) => ({ hash, status: "index_pending" as const, links: 0, error: e })));
    }
  }
  return out;
}

const forgetOnServer = (connectionId: string) => async (hashes: string[]) =>
  (await api<{ removed: Record<string, number> }>(`/api/connections/${connectionId}/index/forget`, { method: "POST", json: { hashes } })).removed;

/**
 * Removes these torrents (by hash) from this TorrServer — never `wipe`, never another server — then,
 * for the ones its list no longer has, every link in Lumovio's index: the torrent and each film or
 * episode bound to it. One result per hash. Call `invalidateAvailability` afterwards.
 */
export async function removeTorrents(connectionId: string, hashes: string[], onProgress?: (done: number, total: number) => void): Promise<RemovalResult[]> {
  const ts = await torrServerFor(connectionId);
  return removeVia(ts, forgetOnServer(connectionId), hashes, onProgress);
}

/**
 * Drops index links of torrents already gone from the server (a retry after `index_pending`, or
 * hashes a full list no longer has). Never touches the server, so nothing is added back.
 */
export function forgetTorrents(connectionId: string, hashes: string[]): Promise<RemovalResult[]> {
  return forgetOnly(forgetOnServer(connectionId), [...new Set(hashes.map((h) => h.toLowerCase()))]);
}

/**
 * Whether a torrent is still on a TorrServer, by the server's full list (SRC-03): "gone" only from a list that holds
 * other torrents but not this one — an empty or unreadable list proves nothing (TS7), so it is "unknown".
 */
export function presenceIn(raw: unknown, hash: string): "present" | "gone" | "unknown" {
  let list: ListedTorrent[];
  try {
    list = asTorrentList(raw);
  } catch {
    return "unknown";
  }
  if (list.some((t) => t.hash.toLowerCase() === hash.toLowerCase())) return "present";
  return list.length > 0 ? "gone" : "unknown";
}

/** `presenceIn` on the real server: a source that failed to start is checked before it is called removed. */
export async function torrentPresence(connectionId: string, hash: string): Promise<"present" | "gone" | "unknown"> {
  try {
    return presenceIn(await (await torrServerFor(connectionId)).list(), hash);
  } catch {
    return "unknown";
  }
}

export interface TorrentManagerData {
  torrents: ManagedTorrent[];
  titles: ConnectionTorrentIndex["titles"];
  /** Set when the index couldn't be loaded: the list still shows, nothing is reconciled. */
  indexError: unknown;
  /** Links of torrents the server no longer has that were just removed from the index (or failed to be). */
  reconciled: RemovalResult[];
  /** The server's list is empty but the index links torrents to it: forgetting them waits for the person. */
  emptyServer: string[];
  readAt: number;
}

/**
 * The manager's data. The index is read before the server's list, so a torrent another device adds
 * meanwhile is never mistaken for a missing one. A full, non-empty list reconciles: links of hashes it
 * doesn't have go. A failed list throws (never an empty server); an empty one is left to the person.
 */
export async function loadTorrentManager(connectionId: string): Promise<TorrentManagerData> {
  let index: ConnectionTorrentIndex | null = null;
  let indexError: unknown = null;
  try {
    index = await api<ConnectionTorrentIndex>(`/api/connections/${connectionId}/index/torrents`);
  } catch (e) {
    indexError = e;
  }
  const list = asTorrentList(await (await torrServerFor(connectionId)).list());
  const stale = index ? staleHashes(index.torrents, list) : [];
  const reconciled = stale.length > 0 && list.length > 0 ? await forgetTorrents(connectionId, stale) : [];
  return {
    torrents: managedTorrents(list, index?.torrents ?? []),
    titles: index?.titles ?? {},
    indexError,
    reconciled,
    emptyServer: list.length === 0 ? stale : [],
    readAt: Date.now(),
  };
}

/**
 * Everything that says a title is on the profile's servers: title pages, players, shelves, "watch now",
 * the servers' counts. Not the manager itself: it reads its list again on its own, as reading reconciles.
 */
export function invalidateAvailability(qc: QueryClient) {
  for (const key of ["availability", "playable", "on-servers", "connections"]) void qc.invalidateQueries({ queryKey: [key] });
}
