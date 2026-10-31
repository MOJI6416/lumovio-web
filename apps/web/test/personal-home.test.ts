import type { CatalogRow, Recommendation, Recommendations, TitleSummary } from "@lumovio/contracts";
import { describe, expect, it } from "vitest";
import { interleave, personalShelves, withoutPersonal } from "../src/components/media/personal-home";

const title = (n: number, onServer = false): TitleSummary =>
  ({ id: `movie:${n}`, kind: "movie", tmdbId: n, title: `T${n}`, genreIds: [], posterPath: "/p.jpg", ...(onServer ? { onServer } : {}) }) as TitleSummary;
const rec = (n: number, onServer = false): Recommendation =>
  ({ title: title(n, onServer), reason: { source: "because", sharedGenres: [], alsoFrom: 0, sources: ["because"], parts: { match: 0, source: 0, quality: 0, fresh: 0, popular: 0 } } }) as Recommendation;
const recs = (over: Partial<Recommendations>): Recommendations => ({ state: "personal", items: [], shelves: [], seeds: [], mutedGenres: [], likedGenres: [], startDismissed: false, ...over });

describe("personal shelves on the home page", () => {
  const shelves = [
    { key: "for_you", kind: "for_you" as const, items: [1, 2, 3, 4].map((n) => rec(n, n === 2)) },
    { key: "because_1", kind: "because" as const, items: [5, 6, 7].map((n) => rec(n)) },
    { key: "fresh", kind: "fresh" as const, items: [8, 9].map((n) => rec(n)) },
  ];

  it("puts For you where it always was and the others between the catalog shelves; a shelf under three cards goes", () => {
    const p = personalShelves(recs({ shelves }), false);
    expect(p.lead.map((s) => s.key)).toEqual(["for_you"]);
    expect(p.later.map((s) => s.key)).toEqual(["because_1"]);
  });

  it("in Watch now keeps only titles with a copy, and nothing between the catalog shelves", () => {
    const p = personalShelves(recs({ shelves: [{ ...shelves[0]!, items: [1, 2, 3].map((n) => rec(n, true)) }, shelves[1]!] }), true);
    expect(p.lead[0]!.items).toHaveLength(3);
    expect(p.later).toEqual([]);
    expect(personalShelves(recs({ shelves }), true).lead).toEqual([]);
  });

  it("reads an API from before the shelves (For you only), and nothing for the starter state", () => {
    const old = { ...recs({ items: [1, 2, 3].map((n) => rec(n)) }), shelves: undefined } as unknown as Recommendations;
    expect(personalShelves(old, false).lead.map((s) => s.key)).toEqual(["for_you"]);
    expect(personalShelves(recs({ state: "start" }), false)).toEqual({ lead: [], later: [] });
  });

  it("drops a personal shelf's first cards from later catalog shelves that keep ten, never from a published list", () => {
    const row = (key: string, ids: number[]): CatalogRow => ({ key, titleKey: "rows.popular", href: null, items: ids.map((n) => title(n)) });
    const long = row("popular_tv", [1, 5, ...Array.from({ length: 12 }, (_, i) => 100 + i)]);
    const short = row("anime", [1, 2, 3, 100, 101]);
    const cinema = row("now_playing", [1, ...Array.from({ length: 12 }, (_, i) => 200 + i)]);
    const out = withoutPersonal([long, short, cinema], shelves);
    expect(out[0]!.items.map((t) => t.tmdbId)).not.toContain(1);
    expect(out[0]!.items).toHaveLength(12);
    expect(out[1]).toBe(short);
    expect(out[2]).toBe(cinema);
  });

  it("places one personal shelf after every two catalog shelves, the rest at the end", () => {
    expect(interleave(["a", "b", "c", "d", "e"], [1, 2, 3])).toEqual(["a", "b", 1, "c", "d", 2, "e", 3]);
  });
});
