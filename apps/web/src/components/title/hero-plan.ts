import type { QualityMark } from "@/components/sources/QualityBadges";
import type { WatchState } from "@/lib/watch-state";

/*
 * The title hero's main button and its one line of availability, as data: what to
 * show, not how. TitleActions draws it; the rules are tested on their own (test/hero-plan.test.ts).
 */

/** What this device knows about the profile's TorrServer search for the title (./TorrentProbe). */
export type TorrentState =
  /** No TorrServer this profile may use here (or a guest, a kids profile, a title not out yet). */
  | { state: "none" }
  /** A TorrServer without automatic search: a source is found on the sources screen. */
  | { state: "manual"; name: string }
  | { state: "searching"; name: string }
  /** `marks` — the release's quality marks (QualityBadges); `summary` — the rest in words: "Ukrainian · dub (Le Doyen)". */
  | { state: "found"; name: string; summary: string; marks?: QualityMark[] }
  | { state: "nothing"; name: string }
  | { state: "failed"; name: string };

export interface PlanInput {
  signedIn: boolean;
  kids: boolean;
  watch: WatchState;
  /** Part-way through it (more than 30 s, not finished). */
  resume: boolean;
  /**
   * The copy the player starts with, when the profile's servers have one; `marks` — its quality marks (QualityBadges);
   * `heard` — a TorrServer copy's audio by its release name, said as a found release's is.
   */
  copy: { server: string; resolution: string | null; marks?: QualityMark[]; heard?: string | null; torrServer?: boolean; others: number } | null;
  torrent: TorrentState;
  trailer: boolean;
  /** Legal streaming services for the region, subscriptions and free ones first. */
  offers: string[];
  /** Not out yet: its release date (or that none is announced) is the line, and nothing is searched. */
  notOut?: boolean;
}

export type Primary =
  | { kind: "loading" }
  /** "Continue" where the profile stopped. */
  | { kind: "resume" }
  /** "Watch" from the profile's own copy. */
  | { kind: "watch" }
  /** "Watch" the recommended TorrServer release: added to the server, then the player. */
  | { kind: "watchRelease" }
  /** "Watch" while the search runs, or "Find a source" for a TorrServer without automatic search: the sources screen. */
  | { kind: "sources"; label: "watch" | "find" }
  | { kind: "trailer" }
  /** No primary: "Watchlist" takes its place. */
  | null;

export type Summary =
  /** Not out yet: when it comes out. */
  | { kind: "upcoming" }
  | { kind: "copy"; server: string; resolution: string | null; marks?: QualityMark[]; heard?: string | null; torrServer?: boolean; others: number }
  | { kind: "release"; name: string; summary: string; marks?: QualityMark[] }
  | { kind: "searching"; name: string }
  | { kind: "manual"; name: string }
  | { kind: "nothingFound"; offers: string[] }
  /** The TorrServer didn't answer the search: said as "Where to watch" says it, not as "nothing found". */
  | { kind: "searchFailed"; name: string; offers: string[] }
  | { kind: "offers"; offers: string[] }
  | { kind: "noServers" }
  | { kind: "notOnServers" }
  | { kind: "indexing"; names: string[] }
  | { kind: "unreachable"; names: string[] }
  | { kind: "error" }
  | { kind: "guest" }
  | null;

export interface Plan {
  primary: Primary;
  summary: Summary;
}

export function heroPlan(i: PlanInput): Plan {
  const w = i.watch;
  // Not out yet: the trailer, else "Watchlist", and the date, known without waiting for the servers — unless a copy is
  // somehow there already.
  if (i.notOut && w.kind !== "playable") return { primary: i.trailer ? { kind: "trailer" } : null, summary: { kind: "upcoming" } };
  if (w.kind === "loading") return { primary: { kind: "loading" }, summary: null };
  const t = i.torrent;
  const releaseAhead = t.state === "found" || t.state === "searching" || t.state === "manual";

  // The main button: progress, a copy, a release, the trailer — in that order; "Watch" never opens an empty
  // screen: while the search runs it opens the sources screen, which searches itself.
  let primary: Primary;
  if (i.resume && (w.kind === "playable" || releaseAhead)) primary = { kind: "resume" };
  else if (w.kind === "playable") primary = { kind: "watch" };
  else if (t.state === "found") primary = { kind: "watchRelease" };
  else if (t.state === "searching") primary = { kind: "sources", label: "watch" };
  else if (i.trailer) primary = { kind: "trailer" };
  else if (t.state === "manual") primary = { kind: "sources", label: "find" };
  else primary = null;

  // The one line under the actions: where it plays from, or why nothing does and what the next step is.
  let summary: Summary;
  if (w.kind === "playable" && i.copy) summary = { kind: "copy", ...i.copy };
  else if (t.state === "found") summary = { kind: "release", name: t.name, summary: t.summary, marks: t.marks };
  else if (t.state === "searching") summary = { kind: "searching", name: t.name };
  // A failed check or a server that didn't answer is said before anything else: a copy may well be there.
  else if (w.kind === "error") summary = { kind: "error" };
  else if (w.kind === "unreachable") summary = { kind: "unreachable", names: w.names };
  else if (t.state === "manual") summary = { kind: "manual", name: t.name };
  else if (t.state === "failed") summary = { kind: "searchFailed", name: t.name, offers: i.offers };
  else if (t.state === "nothing") summary = { kind: "nothingFound", offers: i.offers };
  else if (i.offers.length > 0) summary = { kind: "offers", offers: i.offers };
  else if (w.kind === "guest") summary = { kind: "guest" };
  else if (w.kind === "indexing") summary = { kind: "indexing", names: w.names };
  // A kids profile has no servers to connect: nothing to say rather than an adult's to-do.
  else if (w.kind === "noServers") summary = i.kids ? null : { kind: "noServers" };
  else if (w.kind === "notInLibrary") summary = { kind: "notOnServers" };
  else summary = null;
  return { primary, summary };
}
