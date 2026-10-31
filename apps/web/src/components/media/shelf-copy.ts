/*
 * What the shelves of the home page and the catalog sections say about themselves (design-system 2.5, 7.13): `why` —
 * what the shelf is for, in plain words; `note` — how it was picked and from which source. Both go into the shelf's
 * "i" (the first as the text, the second under it), not under the heading (HOME-07, X-25). Every shelf with an "All"
 * page names that page (`title`), so the grid keeps the shelf's name and says what it is (`about`, `why` or `note`) instead
 * of "All films" or the conditions as chips (CAT-05, CAT-11); a genre shelf's page is named by its genre.
 */

export interface ShelfCopy {
  /** The heading's message key (rows.*), for the shelf's "All" page. */
  title?: string;
  why?: string;
  note?: string;
  /** What the "All" page holds, for a shelf whose name says it all on the shelf itself (no "i" there). */
  about?: string;
}

export const SHELF_COPY: Record<string, ShelfCopy> = {
  trending: { note: "rows.top10Note" },
  now_playing: { note: "rows.inTheatersNote" },
  upcoming: { note: "rows.upcomingNote" },
  top_movies: { title: "rows.topRatedMovies", note: "rows.topRatedMoviesNote" },
  popular_tv: { title: "rows.popularSeries", note: "rows.popularSeriesNote" },
  anime: { title: "rows.anime", about: "rows.animeWhy" },
  anime_movies: { title: "rows.animeMovies", about: "rows.animeMoviesWhy" },
  docs: { title: "rows.documentaries", about: "rows.documentariesWhy" },
  kids_movies: { title: "rows.kidsMovies", about: "rows.kidsMoviesWhy" },
  kids_animation: { title: "rows.animation", about: "rows.animationWhy" },
  kids_tv: { title: "rows.kidsTv", about: "rows.kidsTvWhy" },
  kids_top: { title: "rows.topRatedFamily", about: "rows.topRatedFamilyWhy" },
  on_air: { note: "rows.onTheAirNote" },
  one_evening: { title: "rows.oneEvening", why: "rows.oneEveningWhy", note: "rows.oneEveningNote" },
  miniseries: { title: "rows.miniseries", why: "rows.miniseriesWhy", note: "rows.miniseriesNote" },
  hidden_scifi: { title: "rows.hiddenSciFi", why: "rows.hiddenSciFiWhy", note: "rows.hiddenSciFiNote" },
  top: { title: "rows.topRated", note: "rows.topRatedNote" },
  digital: { note: "rows.newInDigitalNote" },
  new_seasons: { note: "rows.newSeasonsNote" },
  new_series: { note: "rows.newSeriesNote" },
  finished: { title: "rows.finishedSeries", note: "rows.finishedSeriesNote" },
  weekend: { title: "rows.weekendMiniseries", why: "rows.weekendMiniseriesWhy", note: "rows.weekendMiniseriesNote" },
  airing: { note: "rows.airingAnimeNote" },
  anime_finished: { title: "rows.finishedAnime", note: "rows.finishedAnimeNote" },
};

const GENRE_SHELF = /^genre_(\d+)$/;

/** The "All" address of a shelf, marked with the shelf when its page keeps the shelf's name (CAT-05, CAT-11). */
export function shelfHref(key: string, href: string | null): string | null {
  if (!href || !(SHELF_COPY[key]?.title || GENRE_SHELF.test(key))) return href;
  return `${href}${href.includes("?") ? "&" : "?"}shelf=${key}`;
}

/**
 * The grid's next address with the shelf's name kept only while the shelf's own conditions are (CAT-11): a filter or sort
 * of the current address changed or removed drops `shelf`; one added on top narrows the shelf and keeps it.
 */
export function keepShelf(current: URLSearchParams, next: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(next.toString());
  for (const [k, v] of current) if (k !== "shelf" && k !== "view" && out.get(k) !== v) out.delete("shelf");
  return out;
}

/**
 * The heading of a shelf's "All" page (`shelf` in its address): the shelf's name and what it is — a genre shelf by its
 * genre's name alone, the genre being all it is. Null for an address without a known shelf.
 */
export function shelfHeading(
  key: string | null,
  t: (k: string) => string,
  genres: { id: number; name: string }[],
  locale: string,
): { title: string; description?: string } | null {
  const genre = key ? GENRE_SHELF.exec(key) : null;
  if (genre) {
    // TMDB names genres in lower case in ru/uk ("драма"); a heading starts with a capital, as the shelf's does.
    const name = genres.find((g) => g.id === Number(genre[1]))?.name;
    return name ? { title: name.charAt(0).toLocaleUpperCase(locale) + name.slice(1) } : null;
  }
  const c = key ? SHELF_COPY[key] : undefined;
  if (!c?.title) return null;
  const about = c.about ?? c.why ?? c.note;
  return { title: t(c.title), description: about ? t(about) : undefined };
}

/** The "i" texts of a shelf: what it is (or how it was picked, when that is all there is) and the rules. */
export function shelfInfo(key: string, t: (k: string) => string): { note?: string; rules?: string } {
  const c = SHELF_COPY[key];
  if (!c) return {};
  const first = c.why ?? c.note;
  return { note: first ? t(first) : undefined, rules: c.why && c.note ? t(c.note) : undefined };
}
