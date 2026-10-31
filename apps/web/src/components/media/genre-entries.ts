import type { Genre } from "@lumovio/contracts";

/**
 * TMDB's series genres that join two film genres ("Action & Adventure", "Sci-Fi & Fantasy", "War & Politics"): one
 * list of genres for the person (SET-04) — choosing "Action" chooses the series' "Action & Adventure" too.
 */
const SERIES_TWIN: Record<number, number[]> = { 28: [10759], 12: [10759], 878: [10765], 14: [10765], 10752: [10768] };
const JOINED = new Set([10759, 10765, 10768]);

export interface GenreEntry {
  id: number;
  name: string;
  /** The ids it stands for: its own and its series twin. */
  ids: number[];
}

/** Film genres first (with their series twins), then the genres only series have (Reality, Talk…), by name. */
export function genreEntries(movie: Genre[], tv: Genre[], locale: string): GenreEntry[] {
  // TMDB writes film genres in lower case in some languages.
  const cap = (name: string) => name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  const byId = new Map<number, GenreEntry>();
  for (const g of movie) byId.set(g.id, { id: g.id, name: cap(g.name), ids: [g.id, ...(SERIES_TWIN[g.id] ?? [])] });
  for (const g of tv) if (!byId.has(g.id) && !JOINED.has(g.id)) byId.set(g.id, { id: g.id, name: cap(g.name), ids: [g.id] });
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, locale));
}

/**
 * `selected` with `entry` switched: on adds its ids; off takes them away, except a series twin another chosen film
 * genre still needs ("Adventure" for "Action & Adventure").
 */
export function toggleGenre(selected: ReadonlySet<number>, entry: GenreEntry, all: GenreEntry[]): number[] {
  const on = entry.ids.some((id) => selected.has(id));
  if (!on) return [...new Set([...selected, ...entry.ids])];
  const next = new Set([...selected].filter((id) => !entry.ids.includes(id)));
  for (const other of all) if (other !== entry && selected.has(other.id)) for (const id of other.ids) next.add(id);
  return [...next];
}
