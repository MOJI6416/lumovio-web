import type { CatalogRulesQuery, MediaKind } from "@lumovio/contracts";
import { type BrowseState, discoverQuery } from "./discover";

/*
 * A smart list's catalog conditions (package F) and the grid's address for them. Apart from ./discover so the catalog
 * grid's first load doesn't carry them: they are used by the "Save as list" dialog and a smart list's page.
 */

/** TMDB keyword "tv special" (the grid's "No TV specials", ./discover). */
const TV_SPECIAL_KEYWORD = 264598;

/**
 * A smart list's catalog conditions from the grid's state: the very query the grid asks
 * (`discoverQuery`), as data — what the list is filled by and what its chips say.
 */
export function catalogRules(kind: MediaKind, s: BrowseState): CatalogRulesQuery {
  const sp = new URLSearchParams(discoverQuery(kind, s));
  const out: Record<string, string | number | boolean> = { kind, sort: s.sort };
  for (const [k, v] of sp) {
    if (k === "kind" || k === "sort") continue;
    out[k] = k === "anime" ? true : NUMERIC.has(k) ? Number(v) : v;
  }
  return out as CatalogRulesQuery;
}

const NUMERIC = new Set(["yearFrom", "yearTo", "ratingMin", "votesMin", "votesMax", "runtimeMax", "episodesMax"]);

/**
 * The catalog grid with a smart list's conditions ("View all", "Edit conditions" with `editList`): the address
 * `browseState` reads them back from, so the grid shows exactly what the list is filled by.
 */
export function catalogHref(q: CatalogRulesQuery, editList?: string): string {
  const sp = new URLSearchParams();
  if (q.anime && q.kind === "movie") sp.set("kind", "movie");
  if (q.sort !== "popularity") sp.set("sort", q.sort);
  const keys: [keyof CatalogRulesQuery, string][] = [
    ["genres", "genres"],
    ["yearFrom", "yearFrom"],
    ["yearTo", "yearTo"],
    ["ratingMin", "ratingMin"],
    ["language", "language"],
    ["withoutGenres", "without"],
    ["votesMin", "votesMin"],
    ["votesMax", "votesMax"],
    ["runtimeMax", "runtimeMax"],
    ["tvType", "type"],
    ["tvStatus", "status"],
    ["episodesMax", "episodesMax"],
  ];
  for (const [k, param] of keys) if (q[k] !== undefined && q[k] !== "") sp.set(param, String(q[k]));
  if (q.withoutKeywords?.split(",").includes(String(TV_SPECIAL_KEYWORD))) sp.set("nospecials", "1");
  // The grid, not the section's landing.
  sp.set("view", "all");
  if (editList) sp.set("editList", editList);
  return `${q.anime ? "/anime" : `/browse/${q.kind}`}?${sp}`;
}
