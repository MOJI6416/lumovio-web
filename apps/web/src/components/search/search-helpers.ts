import type { AiFilters, CatalogSearch } from "@lumovio/contracts";

/** TMDB's `known_for_department` in the order of the `person.dept{n}` messages (the person page uses the same words). */
const DEPTS = ["Acting", "Directing", "Writing", "Production", "Sound", "Camera", "Editing", "Art", "Visual Effects", "Costume & Make-Up", "Lighting", "Crew"];

/** The message key of a person's department, or null for one TMDB adds later (then nothing is shown: SRCH-06). */
export function departmentKey(dept: string | null | undefined): `person.dept${number}` | null {
  const i = dept ? DEPTS.indexOf(dept) : -1;
  return i >= 0 ? `person.dept${i}` : null;
}

const EN = "`qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const RU = "ёйцукенгшщзхъфывапролджэячсмитьбю";

/**
 * The same keys on the other keyboard layout ("l.yf" → "дюна", "вгту" → "dune"): the commonest "typo" of a search in
 * Russian (SRCH-08). Null when the text isn't all on one layout or nothing changes.
 */
export function otherLayout(text: string): string | null {
  const lower = text.toLowerCase();
  const letters = [...lower].filter((c) => c !== " " && !/\d/.test(c));
  if (letters.length < 2) return null;
  const from = letters.every((c) => EN.includes(c)) ? EN : letters.every((c) => RU.includes(c)) ? RU : null;
  if (!from) return null;
  const to = from === EN ? RU : EN;
  const out = [...lower].map((c) => (from.includes(c) ? to[from.indexOf(c)]! : c)).join("");
  return out !== lower ? out : null;
}

/**
 * "Search for «…»" on the other keyboard layout, for a query that found nothing (SRCH-08, SRCH-16): only when the other
 * layout really names something — a title named so (`clear`; not a loose resemblance or TMDB's raw answer) and not the
 * typed query read back from that layout ("дюна" → "l.yf" → "дюна", for a kids profile that may open none of it).
 */
export function layoutFix(alt: string | null, answer: CatalogSearch | undefined): string | null {
  if (!alt || !answer || answer.titles.results.length === 0) return null;
  return answer.clear !== false && !answer.interpreted ? alt : null;
}

/**
 * The same conditions as a catalog address (lib/discover, `browseState`): the catalog's own filter schema, so "Open in
 * the catalog" shows the hard conditions there. Moods ("any of"), keywords and "like …" have no catalog filter.
 */
export function catalogHref(f: AiFilters): string {
  const sp = new URLSearchParams({ view: "all" });
  if (f.anime) sp.set("kind", f.kind);
  if (f.genres.length) sp.set("genres", f.genres.join(","));
  if (f.excludeGenres.length) sp.set("without", f.excludeGenres.join(","));
  if (f.yearFrom) sp.set("yearFrom", String(f.yearFrom));
  if (f.yearTo) sp.set("yearTo", String(f.yearTo));
  if (f.ratingMin !== null) sp.set("ratingMin", String(f.ratingMin));
  if (f.language) sp.set("language", f.language);
  if (f.kind === "movie" && f.runtimeMax) sp.set("runtimeMax", String(f.runtimeMax));
  if (f.kind === "tv" && f.tvType) sp.set("type", f.tvType);
  if (f.kind === "tv" && f.tvStatus) sp.set("status", f.tvStatus);
  if (f.sort !== "popularity") sp.set("sort", f.sort);
  return `${f.anime ? "/anime" : `/browse/${f.kind}`}?${sp}`;
}
