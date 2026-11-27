import { titleHref } from "./slug";

/*
 * The site's older addresses, on TMDB's ids — `/title/movie/603-the-matrix`, `/person/6384`, `/watch/tv/1396?s=1&e=2`,
 * the same under `/tvui` — kept in bookmarks, search engines, shared links and QR codes. Each answers for good with
 * the address on the title's or person's own code, the query (the episode, the copy, the dubbing…) unchanged: the
 * proxy with a 301 (`/api/v2/codes` names the code), and the page itself when the proxy couldn't ask.
 */

export interface LegacyAddress {
  /** The older key `/api/v2/codes` takes: `movie:603`, `tv:1396`, `person:6384`. */
  key: string;
  /** A title's page: its canonical address carries its name in the page's language. */
  named: boolean;
  /**
   * The same address on the code (without the locale, `/tvui` and the query); a title's with `name` — the one its page
   * shows (its canonical address), else with the older address's slug.
   */
  to: (code: string, name?: string | null) => string;
}

const TITLE = /^\/title\/(movie|tv)\/(\d+)(-[^/]*)?\/?$/;
const PERSON = /^\/person\/(\d+)(?:-[^/]*)?\/?$/;
const WATCH = /^\/watch\/(movie|tv)\/(\d+)\/?$/;

/** The older address a path (without the locale and `/tvui`) is, or null. The title's slug stays: it is its name. */
export function legacyAddress(path: string): LegacyAddress | null {
  let m = TITLE.exec(path);
  if (m) {
    const slug = m[3] ?? "";
    const kind = m[1] as "movie" | "tv";
    return { key: `${kind}:${m[2]}`, named: true, to: (code, name) => (name ? titleHref({ code, kind, tmdbId: 0 }, name) : `/title/${code}${slug}`) };
  }
  m = PERSON.exec(path);
  if (m) return { key: `person:${m[1]}`, named: false, to: (code) => `/person/${code}` };
  m = WATCH.exec(path);
  if (m) return { key: `${m[1]}:${m[2]}`, named: false, to: (code) => `/watch/${code}` };
  return null;
}

/** A page's query as the address had it (`?s=1&e=2`), or "". */
export function queryOf(search: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams(Object.entries(search).flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x])))).toString();
  return q ? `?${q}` : "";
}
