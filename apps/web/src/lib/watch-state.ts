import type { Availability, TitleAvailability } from "@lumovio/contracts";

/**
 * What the main action of a title can honestly promise. Derived from the profile's library index;
 * the player is opened only when there is something to play.
 */
export type WatchState =
  | { kind: "loading" }
  /** The availability request failed: nothing is known, not "nothing is there". */
  | { kind: "error" }
  | { kind: "playable"; copies: number }
  | { kind: "guest" }
  | { kind: "noServers" }
  /** Some connections could not be reached on the last check, so a copy may exist there. */
  | { kind: "unreachable"; names: string[] }
  /** Some connections have not uploaded their first library index yet. */
  | { kind: "indexing"; names: string[] }
  | { kind: "notInLibrary"; servers: number };

/**
 * Copies of the title itself. A torrent file bound to one episode is how the player finds that
 * episode, not another copy of the series, so it is left out of counts and source names.
 */
export function titleCopies(a: TitleAvailability, holds: CopyFilter | null = null): TitleAvailability {
  return { ...a, servers: a.servers.filter((s) => s.season === null && (!holds || holds(s))) };
}

/**
 * Which copies count for what the page is for: a series' season (`holdsByName` in lib/media/packs — a season-1 pack is no
 * copy of season 2). Passed in, so this module stays small for every card that asks.
 */
export type CopyFilter = (s: Pick<Availability, "kind" | "label">) => boolean;

/** `holds`: which copies count (`titleCopies`). */
export function watchState(avail: TitleAvailability | undefined, opts: { signedIn: boolean; failed?: boolean; holds?: CopyFilter | null }): WatchState {
  if (!avail) return opts.failed ? { kind: "error" } : { kind: "loading" };
  const a = titleCopies(avail, opts.holds ?? null);
  if (a.servers.length > 0) return { kind: "playable", copies: a.servers.length };
  if (!opts.signedIn) return { kind: "guest" };
  if (a.connections === 0) return { kind: "noServers" };
  const down = a.sources.filter((s) => s.status === "unreachable" || s.status === "unauthorized");
  if (down.length > 0) return { kind: "unreachable", names: down.map((s) => s.name) };
  const pending = a.sources.filter((s) => !s.indexed);
  if (pending.length > 0) return { kind: "indexing", names: pending.map((s) => s.name) };
  return { kind: "notInLibrary", servers: a.connections };
}
