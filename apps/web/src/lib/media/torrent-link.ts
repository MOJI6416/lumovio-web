import type { TitleSummary } from "@lumovio/contracts";
import { api } from "@/lib/api";
import { isSameTitle, packOf } from "./releases";

/*
 * Linking torrents already on a TorrServer to titles: torrents added in TorrServer's own UI or another app,
 * or unlinked earlier. The device reads the server's
 * list as always; Lumovio's API is asked only for catalog titles — by the words of a release's name or a title id the
 * torrent's own data names — never with a hash, a link or the whole name. A title is proposed with certainty only by
 * a stored id or by a name that fits exactly one title with its year; anything less is the person's choice, and
 * nothing is linked without them.
 */

/** A title as `/api/catalog/match` gives it. */
export type MatchTitle = Pick<TitleSummary, "id" | "kind" | "tmdbId" | "title" | "originalTitle" | "year" | "posterPath">;

export interface ReleaseTitle {
  /** The title words to search the catalog by: the name's first part, before its year, season, picture… */
  query: string;
  /** Another part of the name ("Дюна / Dune …" → "Dune"), searched when the first finds nothing. */
  alt: string | null;
  /** Every year the name states. */
  years: number[];
  /** "tv" when the name speaks of seasons or episodes; null when it doesn't say. */
  kind: "movie" | "tv" | null;
}

// Where a title ends in a release name: a bracket, a year, a season or episode, a picture or source word.
const TITLE_END =
  /[[(|]|(?<![\p{L}\d])(?:19|20)\d{2}(?![\p{L}\d])|(?<![\p{L}\d])s\d{1,2}(?:\s?e\d{1,4})?(?![\p{L}\d])|(?<![\p{L}\d])(?:сезон\p{L}*|season|seasons|серии|серия|серія|серії|episodes?|tv-\d|2160p|1080p|720p|480p|4k|uhd|web-?dl|webrip|bdrip|blu-?ray|bdremux|remux|hdtv|hdrip|dvdrip|camrip|hevc|x26[45]|h\.?26[45])(?![\p{L}\d])/giu;

const SERIES = /(?<![\p{L}\d])(?:сериал\p{L}*|серіал\p{L}*|series|mini-?series|tv-\d|сезон\p{L}*|season)(?![\p{L}\d])/iu;

const clean = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:,.]+|[\s\-–—:,.]+$/g, "")
    .trim();

/** What a release name says about its title, for finding it in the catalog. */
export function releaseTitle(name: string): ReleaseTitle {
  const t = name
    .replace(/\.(mkv|mp4|m4v|avi|ts|webm|mov)$/i, "")
    .replace(/(?<=[\p{L}\d])[._](?=[\p{L}\d])/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  // The first end marker that leaves something before it ("1917 (2019)": not the 1917 the title starts with).
  let end = t.length;
  for (const m of t.matchAll(TITLE_END)) {
    if (clean(t.slice(0, m.index)).length > 0) {
      end = m.index;
      break;
    }
  }
  const parts = t
    .slice(0, end)
    .split(/\s+\/\s+|\s*\|\s*/)
    .map(clean)
    .filter((p) => p.length > 0);
  const years = [...name.matchAll(/(?<![\p{L}\d])((?:19|20)\d{2})(?![\p{L}\d])/gu)].map((m) => Number(m[1])).filter((y) => y <= new Date().getFullYear() + 2);
  const pack = packOf(name);
  return {
    query: parts[0] ?? clean(t.slice(0, 80)),
    alt: parts.find((p, i) => i > 0 && p.toLowerCase() !== parts[0]!.toLowerCase()) ?? null,
    years,
    kind: pack.seasons || pack.episodes || SERIES.test(name) ? "tv" : null,
  };
}

/**
 * The title a torrent's own data names: Lumovio's mark (`{ lumovio: { titleId } }`, kept when the torrent was added
 * from Lumovio) or Lampa's (`{ lampa: true, movie: { id, name | title } }`, TMDB's id). Null otherwise.
 */
export function markedTitle(data: string | undefined): string | null {
  let parsed: unknown;
  try {
    parsed = data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const own = (parsed as { lumovio?: { titleId?: unknown } }).lumovio?.titleId;
  if (typeof own === "string" && /^(movie|tv):\d+$/.test(own)) return own;
  const movie = (parsed as { lampa?: unknown; movie?: { id?: unknown; name?: unknown; first_air_date?: unknown; number_of_seasons?: unknown; source?: unknown } }).movie;
  if ((parsed as { lampa?: unknown }).lampa && movie && typeof movie.id === "number" && movie.id > 0 && (movie.source === undefined || movie.source === "tmdb" || movie.source === "cub")) {
    const tv = typeof movie.name === "string" || typeof movie.first_air_date === "string" || typeof movie.number_of_seasons === "number";
    return `${tv ? "tv" : "movie"}:${movie.id}`;
  }
  return null;
}

/** Punctuation other than the name's own separators ("/", "|") left out: "Dune.Prophecy" and "Dune: Prophecy" are one. */
const plain = (s: string) => s.replace(/[^\p{L}\p{N}\s/|'’]+/gu, " ").replace(/\s+/g, " ");

/** Whether a release name is this title (`isSameTitle`, with and without punctuation), year or not. */
function sameTitle(name: string, c: MatchTitle): boolean {
  const names = [c.originalTitle ?? "", c.title];
  // The year is judged apart (`yearFits`): here a series' name may carry any season's year.
  return isSameTitle(name, names, null, c.kind) || isSameTitle(plain(name), names.map(plain), null, c.kind);
}

/** A film's year within one of the name's; a series' first year at most one after one of them (a later season's year). */
function yearFits(c: MatchTitle, years: number[]): boolean {
  if (!c.year) return false;
  return c.kind === "movie" ? years.some((y) => Math.abs(y - c.year!) <= 1) : years.some((y) => y >= c.year! - 1);
}

export type TorrentMatch =
  /** One title, by a stored id or by its name and year: proposed for "Link all" (the person still confirms). */
  | { status: "sure"; title: MatchTitle; by: "mark" | "name"; candidates: MatchTitle[] }
  /** Titles that fit the name, none for certain: the person chooses. */
  | { status: "unsure"; title: null; candidates: MatchTitle[] }
  /** Nothing fits: the person searches. */
  | { status: "none"; title: null; candidates: MatchTitle[] };

/**
 * A torrent's title among the catalog's candidates for its name. Sure only when exactly one candidate has the name
 * and its year matches a year the name states; several, or one without a year to confirm it, is the person's choice;
 * a candidate never stands in for a name it doesn't have.
 */
export function matchRelease(name: string, candidates: MatchTitle[], marked: MatchTitle | null = null): TorrentMatch {
  if (marked) return { status: "sure", title: marked, by: "mark", candidates: [marked] };
  const info = releaseTitle(name);
  const pool = candidates.filter((c) => !info.kind || c.kind === info.kind);
  const same = pool.filter((c) => sameTitle(name, c));
  const fitting = info.years.length ? same.filter((c) => yearFits(c, info.years)) : [];
  if (fitting.length === 1) return { status: "sure", title: fitting[0]!, by: "name", candidates: [fitting[0]!, ...same.filter((c) => c !== fitting[0])] };
  if (same.length > 0) return { status: "unsure", title: null, candidates: fitting.length > 1 ? fitting : same };
  return { status: "none", title: null, candidates: pool.slice(0, 5) };
}

const CHUNK = 40;

/** The catalog's titles for each item (`/api/catalog/match`), in chunks. */
export async function catalogMatch(items: { key: string; query?: string; titleId?: string; kind?: "movie" | "tv" }[]): Promise<Record<string, MatchTitle[]>> {
  const out: Record<string, MatchTitle[]> = {};
  for (let i = 0; i < items.length; i += CHUNK) {
    const { results } = await api<{ results: Record<string, MatchTitle[]> }>("/api/catalog/match", { method: "POST", json: { items: items.slice(i, i + CHUNK) } });
    Object.assign(out, results);
  }
  return out;
}

/**
 * Titles for torrents not linked in Lumovio: one request per 40 names (a name searched once however many torrents
 * share it; its other part when the first finds nothing), the marked titles fetched by id. Keyed by hash.
 */
export async function matchTorrents(torrents: { hash: string; name: string; mark: string | null }[]): Promise<Record<string, TorrentMatch>> {
  const names = new Map<string, ReleaseTitle>();
  for (const t of torrents) if (!t.mark) names.set(t.name, releaseTitle(t.name));
  const queries = [...new Set([...names.values()].map((r) => r.query).filter((q) => q.length >= 2))];
  const marks = [...new Set(torrents.flatMap((t) => (t.mark ? [t.mark] : [])))];
  const first = await catalogMatch([...queries.map((q) => ({ key: `q:${q}`, query: q })), ...marks.map((m) => ({ key: `id:${m}`, titleId: m }))]);
  const out: Record<string, TorrentMatch> = {};
  const pending: { hash: string; name: string; alt: string }[] = [];
  for (const t of torrents) {
    const marked = t.mark ? (first[`id:${t.mark}`]?.[0] ?? null) : null;
    const info = names.get(t.name);
    const m = matchRelease(t.name, info ? (first[`q:${info.query}`] ?? []) : [], marked);
    out[t.hash] = m;
    if (m.status !== "sure" && info?.alt && info.alt.length >= 2) pending.push({ hash: t.hash, name: t.name, alt: info.alt });
  }
  if (pending.length > 0) {
    const second = await catalogMatch([...new Set(pending.map((p) => p.alt))].map((q) => ({ key: `q:${q}`, query: q })));
    for (const p of pending) {
      const m = matchRelease(p.name, [...(out[p.hash]?.candidates ?? []), ...(second[`q:${p.alt}`] ?? [])].filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i));
      if (m.status !== "none" || out[p.hash]?.status === "none") out[p.hash] = m;
    }
  }
  return out;
}

/**
 * Links torrents to titles in Lumovio's index as the title's TorrServer copies — what adding one from search does
 * (`addTorrentSource`): the torrent's own entry under its release name; a film's or an episode's file is found and
 * bound when it is played. An explicit choice: it lifts an earlier "unlink" of that torrent from that title.
 */
export async function linkTorrents(connectionId: string, links: { hash: string; titleId: string; label: string }[]): Promise<number> {
  if (links.length === 0) return 0;
  const entries = links.map((l) => ({ titleId: l.titleId, externalId: l.hash.toLowerCase(), season: null, episode: null, label: l.label.slice(0, 190), quality: null }));
  const r = await api<{ stored: number }>(`/api/connections/${connectionId}/index`, { method: "POST", json: { mode: "merge", entries } });
  return r.stored;
}

/** "Дюна (2021)". */
export const titleName = (c: Pick<MatchTitle, "title" | "year">) => `${c.title}${c.year ? ` (${c.year})` : ""}`;
