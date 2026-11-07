import type { CatalogRow, Recommendations, RecommendationShelf } from "@lumovio/contracts";

/** Cards a shelf shows before scrolling (the API's VISIBLE): what counts as "on screen" for later shelves. */
const VISIBLE = 6;
/** A later catalog shelf keeps its repeats rather than fall under this many cards (as the API composes them). */
const MIN_LEFT = 10;
/** Shelves that keep a published list or follow series one may be watching: never thinned. */
const KEEP = new Set(["now_playing", "upcoming", "top_movies", "on_air", "new_seasons", "airing", "digital"]);

/**
 * The profile's personal shelves for the home page (HOME-04): `lead` — the next parts of its film series and "For
 * you", shown where "For you" always was; `later` — "Because you watched", a person's titles and new titles in its
 * genres, placed between the catalog shelves. Shelves under three cards are dropped (Row).
 */
export function personalShelves(recs: Recommendations | null): { lead: RecommendationShelf[]; later: RecommendationShelf[] } {
  if (!recs || recs.state !== "personal") return { lead: [], later: [] };
  // An API from before the shelves (a deploy rolling out) sends "For you" only.
  const all: RecommendationShelf[] = recs.shelves ?? [{ key: "for_you", kind: "for_you", items: recs.items }];
  const shelves = all.filter((s) => s.items.length >= 3);
  return {
    lead: shelves.filter((s) => s.kind === "franchise" || s.kind === "for_you"),
    later: shelves.filter((s) => s.kind !== "franchise" && s.kind !== "for_you"),
  };
}

/**
 * The catalog shelves after the personal ones without repeating what those show in their first cards — a title is on
 * one shelf of the page where it can be — unless a shelf would fall under MIN_LEFT; published lists keep their order.
 */
export function withoutPersonal(rows: CatalogRow[], personal: RecommendationShelf[]): CatalogRow[] {
  const shown = new Set(personal.flatMap((s) => s.items.slice(0, VISIBLE).map((i) => i.title.id)));
  if (shown.size === 0) return rows;
  return rows.map((r) => {
    if (KEEP.has(r.key)) return r;
    const fresh = r.items.filter((t) => !shown.has(t.id));
    return fresh.length >= MIN_LEFT && fresh.length < r.items.length ? { ...r, items: fresh } : r;
  });
}

/** `extra` placed among `rows`: one after every `every` rows, the rest at the end. */
export function interleave<A, B>(rows: A[], extra: B[], every = 2): (A | B)[] {
  const out: (A | B)[] = [];
  let e = 0;
  rows.forEach((r, i) => {
    out.push(r);
    if ((i + 1) % every === 0 && e < extra.length) out.push(extra[e++]!);
  });
  return [...out, ...extra.slice(e)];
}
