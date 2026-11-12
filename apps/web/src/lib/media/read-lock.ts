/*
 * Read aheads (`read-ahead`) and adds share a TorrServer: an add stops the reads on its server at once — it never waits
 * for them — and a torrent a read added for a moment stays on the server when the add takes it (the person pressed
 * "Watch" on the very release being read). A read takes its torrent off only once no add on that server needs it.
 */

interface Read {
  connectionId: string;
  stop: () => void;
  /** Hashes it added and will take off again. */
  quiet: Set<string>;
}

const reads = new Set<Read>();
const adopted = new Set<string>();
const adding = new Map<string, Set<Promise<unknown>>>();

/** A read ahead starting on a server; `stop` ends it. Returns its handle; `end` when it is over. */
export function registerRead(connectionId: string, stop: () => void): { quiet: Set<string>; end: () => void } {
  const read: Read = { connectionId, stop, quiet: new Set() };
  reads.add(read);
  return { quiet: read.quiet, end: () => reads.delete(read) };
}

/**
 * Runs an add on a server (`run` gets the hashes reads added for a moment — they weren't there before it — and
 * `adopt` for the hash it took, which then stays): the reads there stop first.
 */
export function whileAdding<T>(connectionId: string, run: (quiet: ReadonlySet<string>, adopt: (hash: string) => void) => Promise<T>): Promise<T> {
  const quiet = new Set<string>();
  for (const r of reads)
    if (r.connectionId === connectionId) {
      r.stop();
      for (const h of r.quiet) quiet.add(h);
    }
  const p = run(quiet, (hash) => adopted.add(`${connectionId}:${hash.toLowerCase()}`));
  const set = adding.get(connectionId) ?? new Set();
  adding.set(connectionId, set.add(p));
  void p.then(
    () => set.delete(p),
    () => set.delete(p),
  );
  return p;
}

/** Whether a read may take its torrent off: once the adds running on its server are over, and none took it. */
export async function mayRemove(connectionId: string, hash: string): Promise<boolean> {
  await Promise.allSettled([...(adding.get(connectionId) ?? [])]);
  return !adopted.has(`${connectionId}:${hash.toLowerCase()}`);
}
