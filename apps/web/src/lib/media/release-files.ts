import type { ReleaseFileFacts, ReleaseFileProbe, ReleaseFileRead, ReleaseFilesFound } from "@lumovio/contracts";
import { api } from "@/lib/api";
import type { FileProbe, TsSearchResult } from "./torrserver";

/*
 * Releases' files as some account's TorrServer read them, kept by Lumovio for every account: the audio tracks a name
 * like "6x MVO" doesn't name, the subtitles, the picture. The files are read by the account's own TorrServer — the player
 * when it prepares a file, or a read ahead (`read-ahead`) — never by Lumovio's servers. A release reaches them only as
 * SHA-256 digests of its info hash and of its name, with the size it was found with: never the hash, the name, a
 * link or a tracker. A search result has no hash; it is looked up by its name and size.
 */

/** Raised when the way a file is read changes what a read says: a newer reader's read replaces an older one's. */
export const READER_VERSION = 1;

/** A release's name as the cache keys it: case, spacing and the dots and underscores of scene names don't make another release. */
export const nameKey = (title: string) => title.toLowerCase().replace(/[._]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 250);

async function digest(text: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const bytes = new Uint8Array(await subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
const torrentDigest = (hash: string) => digest(`btih:${hash.toLowerCase()}`);
const nameDigest = (title: string) => digest(`name:${nameKey(title)}`);

/** What this tab was told, by a result's link: the file's facts, or null when no device has read it. */
const told = new Map<string, ReleaseFileFacts | null>();
let version = 0;
const listeners = new Set<() => void>();

/** For `useSyncExternalStore`: rankings that use the cache rank again when it tells more. */
export function subscribeFiles(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export const filesVersion = () => version;

/** What the cache said about a result's file: its facts, null when no device has read it, undefined when not asked. */
export const sharedFileOf = (r: Pick<TsSearchResult, "link">): ReleaseFileFacts | null | undefined => told.get(r.link);

/**
 * Asks the cache about the results this tab hasn't asked about yet (100 at most). `again`: these results are asked
 * again whatever was told (a read ahead just read one).
 */
export async function lookupFiles(results: readonly TsSearchResult[], signal?: AbortSignal, again = false): Promise<void> {
  const ask = results.filter((r) => again || !told.has(r.link)).slice(0, 100);
  if (ask.length === 0) return;
  const releases = await Promise.all(ask.map(async (r) => ({ name: await nameDigest(r.title), size: r.size === null ? null : Math.max(0, Math.round(r.size)), torrent: r.hash ? await torrentDigest(r.hash) : null })));
  // No SubtleCrypto (a page not served securely): the cache can't be asked without sending the names themselves.
  if (releases.some((x) => x.name === null)) return;
  const { files } = await api<ReleaseFilesFound>("/api/releases/files/lookup", { method: "POST", json: { releases }, signal });
  for (const [i, r] of ask.entries()) told.set(r.link, files[i] ?? null);
  version++;
  for (const l of listeners) l();
}

/**
 * The audio tracks a ranking takes from files (`rankReleases`' `fileOf`): the profile's own copies' (`copy`, the
 * player read them in the account's index), else the shared cache's for the result.
 */
export function withSharedFiles(copy: ((r: TsSearchResult) => readonly string[] | null) | null): (r: TsSearchResult) => readonly string[] | null {
  return (r) => copy?.(r) ?? told.get(r.link)?.audio ?? null;
}

const cut = (s: string | undefined, n: number) => (s === undefined ? undefined : s.slice(0, n));
const int = (n: number | undefined, max: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : undefined);

/** A probe as the cache takes it: every stream and chapter, each field within the cache's bounds. Null without streams. */
export function shareableProbe(p: FileProbe): ReleaseFileProbe | null {
  const streams = (p.streams ?? [])
    .filter((s) => Number.isInteger(s.index) && s.index >= 0 && s.index <= 1024)
    .slice(0, 128)
    .map((s) => ({
      index: s.index,
      codec_type: (s.codec_type ?? "").slice(0, 16),
      codec_name: (s.codec_name ?? "").slice(0, 40),
      tags: s.tags ? { language: cut(s.tags.language, 16), title: cut(s.tags.title, 200) } : undefined,
      disposition: { default: s.disposition?.default ? 1 : 0 },
      bits_per_raw_sample: cut(s.bits_per_raw_sample, 4),
      pix_fmt: cut(s.pix_fmt, 32),
      width: int(s.width, 16384),
      height: int(s.height, 16384),
      side_data_list: s.side_data_list?.slice(0, 8).map((x) => ({ side_data_type: cut(x.side_data_type, 80), dv_profile: int(x.dv_profile, 20) })),
      color_transfer: cut(s.color_transfer, 32),
      channels: int(s.channels, 64),
    }));
  if (streams.length === 0) return null;
  return {
    format: p.format ? { format_name: cut(p.format.format_name, 60), duration: cut(p.format.duration, 24), bit_rate: cut(p.format.bit_rate, 24) } : undefined,
    streams,
    chapters: p.chapters?.slice(0, 300).map((c) => ({ start_time: (c.start_time ?? "0").slice(0, 24), end_time: (c.end_time ?? c.start_time ?? "0").slice(0, 24), tags: c.tags?.title ? { title: c.tags.title.slice(0, 200) } : undefined })),
  };
}

/** Files this device has shared ("<hash>:<file>"), the last `SHARED_MAX`: each is sent once. */
const SHARED_KEY = "lumovio.sharedFiles.v1";
const SHARED_MAX = 200;
function sharedBefore(key: string, add = false): boolean {
  try {
    const list = JSON.parse(localStorage.getItem(SHARED_KEY) ?? "[]") as string[];
    const had = Array.isArray(list) && list.includes(key);
    if (add && !had) localStorage.setItem(SHARED_KEY, JSON.stringify([...(Array.isArray(list) ? list : []), key].slice(-SHARED_MAX)));
    return had;
  } catch {
    return false;
  }
}

/**
 * Shares what a file holds (a read of it through the account's TorrServer) with every account: by the digest of its
 * torrent's hash, with the names (and sizes) the torrent was found or saved under. Once per file on this device.
 */
export async function shareFile(hash: string, file: number, probe: FileProbe, names: { title: string | null | undefined; size: number | null | undefined }[]): Promise<void> {
  const key = `${hash.toLowerCase()}:${file}`;
  if (sharedBefore(key)) return;
  const p = shareableProbe(probe);
  const torrent = p ? await torrentDigest(hash) : null;
  if (!p || !torrent) return;
  const named = new Map<string, number | null>();
  for (const n of names) {
    const title = n.title?.trim();
    const d = title ? await nameDigest(title) : null;
    if (d && !named.has(d)) named.set(d, typeof n.size === "number" && n.size >= 0 ? Math.round(n.size) : null);
  }
  const read: ReleaseFileRead = { torrent, file, probe: p, names: [...named].slice(0, 4).map(([name, size]) => ({ name, size })), v: READER_VERSION };
  await api("/api/releases/files", { method: "POST", json: read });
  sharedBefore(key, true);
}
