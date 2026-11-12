import type { SourceState } from "@lumovio/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { asTorrentList, invalidateAvailability, type ManagedTorrent, managedTorrents, removeTorrents } from "./torrent-manage";
import { torrServerFor } from "./torrent-source";

/**
 * The clean-up: nothing piles up on the person's
 * TorrServer. The API says which indexed torrents are done with — watched, never started, left — by every profile of the
 * account; this device removes those of them that are surely Lumovio's (`claimedAt`) and that
 * the server isn't playing, and Lumovio's torrents linked to nothing a week after it brought them. The server's other
 * torrents of titles go the same way only when the person turned it on (`ConnectionSettings.sweepAll`); one linked to
 * nothing is never Lumovio's to judge. Removal is torrent-manage's: `rem`, then the server's list decides.
 */

const UNLINKED_AFTER_MS = 7 * 86_400_000;

/**
 * The hashes to remove from this server's list: idle ones the API calls done with — Lumovio's, or any when `any` — and
 * Lumovio's linked to nothing a week after it brought them.
 */
export function sweepPick(
  torrents: readonly Pick<ManagedTorrent, "hash" | "claimedAt" | "active">[],
  verdict: { stale: ReadonlySet<string>; indexed: ReadonlySet<string>; any: boolean },
  now: number,
): string[] {
  return torrents
    .filter((t) => !t.active)
    .filter((t) =>
      verdict.stale.has(t.hash)
        ? verdict.any || t.claimedAt !== null
        : !verdict.indexed.has(t.hash) && t.claimedAt !== null && now - t.claimedAt >= UNLINKED_AFTER_MS,
    )
    .map((t) => t.hash);
}

/** One server's clean-up (one read of its list); the hashes it removed. */
export async function sweepServer(connectionId: string, now = Date.now()): Promise<string[]> {
  const v = await api<{ stale: string[]; indexed: string[]; any: boolean }>(`/api/connections/${connectionId}/index/sweep`);
  const ts = await torrServerFor(connectionId);
  const list = asTorrentList(await ts.list());
  const pick = sweepPick(managedTorrents(list, []), { stale: new Set(v.stale), indexed: new Set(v.indexed), any: v.any }, now);
  if (pick.length === 0) return [];
  return (await removeTorrents(connectionId, pick)).filter((r) => r.status === "removed").map((r) => r.hash);
}

/**
 * Every TorrServer the profile plays from, but one known to be out of reach or refusing the password. The time goes
 * into `storageKey` first, so a server that fails isn't asked again on every page. What it removed is no longer said
 * to be on the server (a page still showing it would ask the server for it by hash, and TorrServer would add it back).
 */
export async function sweepProfile(storageKey: string, qc: QueryClient): Promise<void> {
  try {
    localStorage.setItem(storageKey, String(Date.now()));
  } catch {
    return;
  }
  const { sources } = await api<{ sources: SourceState[] }>("/api/availability/sources");
  let removed = 0;
  for (const s of sources) {
    if (s.kind !== "torrserver" || s.status === "unreachable" || s.status === "unauthorized") continue;
    // A server that can't be cleaned now is tried again in 12 hours; there is nothing to say.
    removed += (await sweepServer(s.id).catch(() => [])).length;
  }
  if (removed > 0) invalidateAvailability(qc);
}
