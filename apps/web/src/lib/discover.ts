// Types only: a value from @lumovio/contracts brings its zod schemas into every page's first load (bundle budget).
import type { IndexSort, MediaKind, Mood } from "@lumovio/contracts";

export const SORTS = ["popularity", "rating", "release_desc", "release_asc", "title", "votes", "imdb", "imdb_votes", "lumovio", "rt", "metacritic"] as const;

/** Sorts on Lumovio's own catalog index, offered only where `GET /api/catalog/sorts` says so, and the score each one is. */
export const INDEX_SORTS: Record<IndexSort, string> = { imdb: "IMDb", imdb_votes: "IMDb", lumovio: "Lumovio", rt: "Rotten Tomatoes", metacritic: "Metacritic" };
export const isIndexSort = (s: string): s is IndexSort => s in INDEX_SORTS;

/** A mood's name (a chip, a smart list's condition): its shelf's heading, rows.*. */
export const MOOD_NAME: Record<Mood, "moodFeelGood" | "moodMindBending" | "moodEdgeOfSeat"> = {
  feel_good: "moodFeelGood",
  mind_bending: "moodMindBending",
  edge_of_seat: "moodEdgeOfSeat",
};

export interface BrowseState {
  sort: (typeof SORTS)[number];
  genres: number[];
  yearFrom: string;
  yearTo: string;
  ratingMin: string;
  language: string;
  anime: boolean;
  /** Excluded genre ids. */
  without: number[];
  /** Films: maximum runtime in minutes. */
  runtimeMax: string;
  /** Series: "scripted" (no news, talk, reality) or "mini". */
  type: string;
  /** Series: "ended" or "returning". */
  status: string;
  /** Series: at most this many episodes, all already out. */
  episodesMax: string;
  votesMin: string;
  votesMax: string;
  /** Films: leave out TV specials (TMDB keyword "tv special"), so every pick stands on its own. */
  noSpecials: boolean;
  /** At most this many IMDb votes ("Underrated"; Lumovio's catalog index only). */
  imdbVotesMax: string;
  /** "critics_higher": the Lumovio Score's critics 80+, audiences 20+ points lower (catalog index only). */
  opinions: "" | "critics_higher";
  /** Films: a mood shelf's conditions (MOODS). */
  mood: "" | Mood;
}

/** TMDB keyword "tv special" (also excluded by the API's under-the-radar shelf). */
const TV_SPECIAL_KEYWORD = 264598;

const ids = (v: string | null | undefined) => v?.split(",").filter(Boolean).map(Number).filter(Number.isFinite) ?? [];
const num = (v: string | null | undefined) => (v && /^\d+$/.test(v) ? v : "");

/** Filters from the URL; shared by the server page (first page SSR) and the client grid. */
export function browseState(get: (k: string) => string | null | undefined, anime: boolean): BrowseState {
  const sort = get("sort");
  // A range written backwards ("from 2020 to 2010", an old link) means the same years, not an empty grid.
  const [yearFrom, yearTo] = [num(get("yearFrom")), num(get("yearTo"))].sort((a, b) => (a && b ? Number(a) - Number(b) : 0));
  return {
    sort: SORTS.includes(sort as BrowseState["sort"]) ? (sort as BrowseState["sort"]) : "popularity",
    genres: ids(get("genres")),
    yearFrom: yearFrom ?? "",
    yearTo: yearTo ?? "",
    ratingMin: get("ratingMin") ?? "",
    language: get("language") ?? "",
    anime: anime || get("anime") === "1",
    without: ids(get("without")),
    runtimeMax: num(get("runtimeMax")),
    type: ["scripted", "mini"].includes(get("type") ?? "") ? (get("type") as string) : "",
    status: ["ended", "returning"].includes(get("status") ?? "") ? (get("status") as string) : "",
    episodesMax: num(get("episodesMax")),
    votesMin: num(get("votesMin")),
    votesMax: num(get("votesMax")),
    noSpecials: get("nospecials") === "1",
    imdbVotesMax: num(get("imdbVotesMax")),
    opinions: get("opinions") === "critics_higher" ? "critics_higher" : "",
    mood: Object.hasOwn(MOOD_NAME, get("mood") ?? "") ? (get("mood") as Mood) : "",
  };
}

/** The exact /api/catalog/discover query for a state — also the React Query key, so SSR data is reused. */
export function discoverQuery(kind: MediaKind, s: BrowseState): string {
  const sp = new URLSearchParams({ kind, sort: s.sort });
  if (s.genres.length) sp.set("genres", s.genres.join(","));
  if (s.yearFrom) sp.set("yearFrom", s.yearFrom);
  if (s.yearTo) sp.set("yearTo", s.yearTo);
  if (s.ratingMin) sp.set("ratingMin", s.ratingMin);
  if (s.language) sp.set("language", s.language);
  if (s.anime) sp.set("anime", "true");
  if (s.without.length) sp.set("withoutGenres", s.without.join(","));
  if (s.votesMin) sp.set("votesMin", s.votesMin);
  if (s.votesMax) sp.set("votesMax", s.votesMax);
  if (kind === "movie" && s.runtimeMax) sp.set("runtimeMax", s.runtimeMax);
  if (kind === "movie" && s.noSpecials) sp.set("withoutKeywords", String(TV_SPECIAL_KEYWORD));
  if (kind === "tv" && s.type) sp.set("tvType", s.type);
  if (kind === "tv" && s.status) sp.set("tvStatus", s.status);
  if (kind === "tv" && s.episodesMax) sp.set("episodesMax", s.episodesMax);
  if (s.imdbVotesMax) sp.set("imdbVotesMax", s.imdbVotesMax);
  if (s.opinions) sp.set("opinions", s.opinions);
  if (kind === "movie" && s.mood) sp.set("mood", s.mood);
  return sp.toString();
}

/** The filters of a state without its sort: what `GET /api/catalog/sorts` is asked about. */
export function filtersQuery(kind: MediaKind, s: BrowseState): string {
  const sp = new URLSearchParams(discoverQuery(kind, s));
  sp.delete("sort");
  return sp.toString();
}

/** A section page shows its landing unless the URL asks for the grid (filters, sort or "view all"). */
export function wantsGrid(get: (k: string) => string | null | undefined): boolean {
  return ["genres", "sort", "yearFrom", "yearTo", "ratingMin", "language", "view", "kind", "without", "runtimeMax", "type", "status", "votesMin", "votesMax", "nospecials", "episodesMax", "imdbVotesMax", "opinions", "mood"].some((k) =>
    Boolean(get(k)),
  );
}
