import type { ReleaseFileFacts } from "@lumovio/contracts";
import type { TsSearchResult } from "./torrserver";

/*
 * What this tab was told about search results' files by the shared cache (`release-files` asks it), by a result's link:
 * the file's facts, or null when no device has read it. Small on purpose: rankings everywhere read it, the asking is
 * loaded only when a search runs.
 */

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

/** The cache's answers for results (by link). */
export function tell(answers: Iterable<[string, ReleaseFileFacts | null]>) {
  for (const [link, facts] of answers) told.set(link, facts);
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
