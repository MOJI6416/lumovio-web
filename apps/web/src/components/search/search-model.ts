import type { CatalogRow, CatalogSearch, Genre, PersonSummary, TitleSummary } from "@lumovio/contracts";
import { capitalize } from "@/lib/format";

/*
 * One search for the header, the search page and the TV: the same query rules, the
 * same groups of an answer and the same start without a query; each platform only lays them out its own way.
 * A plain module (types only from the contracts, no React), so server pages use it too.
 */

/** A query searches from this many letters, after this pause in typing (a TV's remote types slower). */
export const MIN_CHARS = 2;
export const DEBOUNCE_MS = 250;
export const TV_DEBOUNCE_MS = 400;
/** The API's limit for a query: a field stops there instead of a 400 and "Search failed". */
export const QUERY_MAX = 200;

export type SearchKind = "movie" | "tv";

export const searchUrl = (q: string, page = 1, kind?: SearchKind) =>
  `/api/catalog/search?q=${encodeURIComponent(q)}${page > 1 ? `&page=${page}` : ""}${kind ? `&kind=${kind}` : ""}`;

/** The answer's best match: the person when the query reads as a name, else the first title when the query names it. */
export type BestMatch = { type: "title"; title: TitleSummary } | { type: "person"; person: PersonSummary };
export type GroupKey = "movie" | "tv" | "people";

export interface SearchGroups {
  best: BestMatch | null;
  movie: TitleSummary[];
  tv: TitleSummary[];
  people: PersonSummary[];
  /** The groups that have something, in the order to show them. */
  order: GroupKey[];
}

/**
 * The answer as groups: the best match, then films, series and people. A person is the best match when the query reads
 * as a name (`peopleFirst`), the first title when a title is named like the query (`clear`, not a loose resemblance);
 * otherwise there is none. The best match isn't repeated in its group. Films and series follow in the order of their
 * first result; people come first for a name, last otherwise.
 */
export function groupResults(r: Pick<CatalogSearch, "titles" | "people" | "peopleFirst" | "clear">): SearchGroups {
  const titles = r.titles.results;
  const personFirst = r.peopleFirst === true && r.people.length > 0;
  const best: BestMatch | null = personFirst
    ? { type: "person", person: r.people[0]! }
    : titles[0] && r.clear !== false
      ? { type: "title", title: titles[0] }
      : null;
  const rest = best?.type === "title" ? titles.slice(1) : titles;
  const people = best?.type === "person" ? r.people.slice(1) : r.people;
  const movie = rest.filter((t) => t.kind === "movie");
  const tv = rest.filter((t) => t.kind === "tv");
  const kinds: GroupKey[] = (rest[0] ?? titles[0])?.kind === "tv" ? ["tv", "movie"] : ["movie", "tv"];
  const size = { movie: movie.length, tv: tv.length, people: people.length };
  const order = (personFirst ? (["people", ...kinds] as GroupKey[]) : ([...kinds, "people"] as GroupKey[])).filter((k) => size[k] > 0);
  return { best, movie, tv, people, order };
}

/** Nothing of the answer at all. */
export const isEmpty = (r: Pick<CatalogSearch, "titles" | "people">) => r.titles.results.length === 0 && r.people.length === 0;

/**
 * A query that reads as a description rather than a name — three words or more, and no title is named like it
 * ("комедия про путешествия во времени"): "Search by description" goes first then.
 */
export function looksDescriptive(q: string, clear: boolean | undefined): boolean {
  if (clear === true) return false;
  return q.trim().split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length >= 3;
}

/** TMDB's film genres of the "Genres" tiles, in this order; a kids profile isn't offered the last three. */
const GENRES = [28, 35, 18, 878, 12, 14, 16, 10751, 99, 27, 53, 80];
const NOT_FOR_KIDS = new Set([27, 53, 80]);

export interface GenreTile {
  id: number;
  name: string;
  href: string;
  /** A backdrop of a popular film of the genre (TMDB path), or none. */
  art: string | null;
}

/**
 * The genre tiles of a search without a query: each opens the catalog's films of that genre; its picture is a backdrop
 * of the most popular title of the home page's shelves in that genre, a different one for each tile (films first).
 */
export function genreTiles(rows: Pick<CatalogRow, "items">[], genres: Genre[], locale: string): GenreTile[] {
  const seen = new Set<string>();
  const pool: TitleSummary[] = [];
  for (const r of rows)
    for (const t of r.items)
      if (t.backdropPath && !seen.has(t.id)) {
        seen.add(t.id);
        pool.push(t);
      }
  pool.sort((a, b) => Number(b.kind === "movie") - Number(a.kind === "movie"));
  const used = new Set<string>();
  return GENRES.flatMap((id) => {
    const g = genres.find((x) => x.id === id);
    if (!g) return [];
    const t = pool.find((x) => x.genreIds.includes(id) && !used.has(x.id));
    if (t) used.add(t.id);
    return [{ id, name: capitalize(g.name, locale), href: `/browse/movie?genres=${id}`, art: t?.backdropPath ?? null }];
  });
}

/** The tiles a profile is offered: a kids profile goes without horror, thrillers and crime. */
export const tilesFor = (tiles: GenreTile[], kids: boolean) => (kids ? tiles.filter((t) => !NOT_FOR_KIDS.has(t.id)) : tiles);

/** The popular titles of a search without a query: the home page's first shelf. */
export const popularOf = (rows: Pick<CatalogRow, "items">[] | undefined, n = 18): TitleSummary[] => rows?.[0]?.items.slice(0, n) ?? [];
