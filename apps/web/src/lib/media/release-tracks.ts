import type { ReleaseKey, ReleaseTracksFound, ReleaseTracksRead } from "@lumovio/contracts";
import { api } from "@/lib/api";
import { fileTracks, type RankedRelease, type ReleaseTrack } from "./releases";
import type { TsSearchResult } from "./torrserver";

/*
 * Releases' audio tracks read from their files, kept on our side for everyone (design-system 7.15 «Чтение дорожек
 * заранее»): only "<language>|<kind>, <studio>" per track and the languages of forced subtitles — what the pick needs.
 * The file is read by the account's own TorrServer (the player, or `read-ahead`), never by our servers.
 */

/** A file's tracks ("<tag>|<title>", as the player reads them) in the shared cache's words: "ru|mvo, LostFilm", "en|original". */
export function compactTracks(list: readonly string[], originalLanguage: string | null): string[] {
  const clean = (s: string) =>
    s
      .replace(/[^\p{L}\p{N} .,'&+()!-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
  return fileTracks(list, originalLanguage)
    .slice(0, 32)
    .map((t: ReleaseTrack) => `${(t.language ?? "").slice(0, 3)}|${clean(t.original ? "original" : [t.voice, t.studio ?? t.credit].filter(Boolean).join(", "))}`);
}

export const keyOf = (r: Pick<TsSearchResult, "tracker" | "title" | "hash">): ReleaseKey => ({ tracker: r.tracker?.slice(0, 60) ?? null, title: r.title.slice(0, 250), hash: r.hash });

/** What the shared cache knows for these results, by release name. */
export async function lookupTracks(results: readonly TsSearchResult[]): Promise<Map<string, string[]>> {
  const keys = results.slice(0, 100).map(keyOf);
  if (keys.length === 0) return new Map();
  const { found } = await api<ReleaseTracksFound>("/api/releases/tracks/lookup", { method: "POST", json: { keys } });
  return new Map(found.map((f) => [f.title, f.tracks]));
}

export const saveTracks = (read: ReleaseTracksRead) => api("/api/releases/tracks", { method: "POST", json: read });

/**
 * Whether a release's name hides its studios — the one reason to read its file ahead: a translation counted or named
 * without a studio ("6x MVO", "многоголосый", "Dub", Kinozal's names), and no file read for it yet.
 */
export function hidesStudios(x: Pick<RankedRelease, "info">): boolean {
  return x.info.tracks.some((t) => !t.original && t.voice !== null && t.studio === null && t.credit === null) || (x.info.voice !== null && x.info.studios.length === 0 && x.info.tracks.length === 0);
}

/**
 * Trackers that count the account's .torrent downloads per day (Kinozal: a few a day for most accounts): a read ahead
 * through Jackett would spend the downloads the person needs to watch — on 2026-11-08 the owner's adds started failing
 * with 400 ("Found '<'": Kinozal's page instead of the file) once reads had taken them. A magnet costs nothing.
 */
const QUOTA_TRACKERS = /kinozal/i;

/** Whether reading a release ahead would download its .torrent from a tracker with a daily quota, or one that refused today. */
export function spendsQuota(r: Pick<RankedRelease["result"], "link" | "tracker" | "origins">, refused: ReadonlySet<string> = new Set()): boolean {
  if (r.link.startsWith("magnet:")) return false;
  const tracker = (r.tracker ?? "").toLowerCase();
  return QUOTA_TRACKERS.test(tracker) || refused.has(tracker);
}

/**
 * The releases to read ahead, in order (the owner, 2026-11-08): names that hide their studios ("MVO" without one)
 * first, then the rest; in each, the best picture first, then the most seeders. Only alive ones that hold the episode,
 * play here and aren't in the shared cache yet (`known`, by name). `readAhead` reads `MAX_READS` of them at most.
 */
export function readOrder(ranked: RankedRelease[], known: { has(title: string): boolean }, refused: ReadonlySet<string> = new Set()): RankedRelease["result"][] {
  return ranked
    .filter((x) => !x.dead && !x.info.cam && x.holds !== false && x.fit !== "poor" && !known.has(x.result.title) && !spendsQuota(x.result, refused))
    .sort((a, b) => Number(hidesStudios(b)) - Number(hidesStudios(a)) || (b.info.resolution ?? 0) - (a.info.resolution ?? 0) || (b.result.seeders ?? -1) - (a.result.seeders ?? -1))
    .map((x) => x.result);
}

/** Trackers that refused a read's .torrent today on this device (a quota or a dead session): not read again today. */
export function refusedToday(add?: string | null): Set<string> {
  const key = "lumovio.readAhead.refused";
  const day = new Date().toISOString().slice(0, 10);
  try {
    const [d, list] = (localStorage.getItem(key) ?? "").split("|");
    const set = new Set(d === day && list ? list.split(",") : []);
    if (add) localStorage.setItem(key, `${day}|${[...set.add(add.toLowerCase())].join(",")}`);
    return set;
  } catch {
    return new Set();
  }
}
