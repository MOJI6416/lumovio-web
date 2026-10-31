import type { CatalogRow, RecommendationShelf, TitleSummary } from "@lumovio/contracts";
import { describe, expect, it } from "vitest";
import { cardRow, cardShelf, forCard } from "../src/components/media/card-data";
import { orderedSources } from "../src/lib/media/source-order";

const title = (over: Partial<TitleSummary> = {}): TitleSummary => ({
  id: "movie:1",
  kind: "movie",
  tmdbId: 1,
  title: "Дюна",
  originalTitle: "Dune",
  year: 2021,
  releaseDate: "2021-09-15",
  posterPath: "/p.jpg",
  backdropPath: "/b.jpg",
  overview: "Наследник знаменитого дома Атрейдесов…",
  tmdbRating: 7.8,
  tmdbVotes: 12000,
  genreIds: [878],
  originalLanguage: "en",
  isAnime: false,
  ...over,
});

describe("cards carry what they show (a lighter page)", () => {
  it("drops only the overview, which no card shows", () => {
    const t = title({ imdbRating: 8, onServer: true });
    expect(forCard(t)).toEqual({ ...t, overview: null });
    // Nothing to drop: the same object, no copy.
    const bare = title({ overview: null });
    expect(forCard(bare)).toBe(bare);
  });

  it("applies to every card of a shelf and of a personal shelf", () => {
    const row: CatalogRow = { key: "popular", titleKey: "rows.popular", items: [title(), title({ id: "movie:2", tmdbId: 2 })], href: null };
    expect(cardRow(row).items.map((x) => x.overview)).toEqual([null, null]);
    const shelf = { key: "for_you", kind: "for_you", items: [{ title: title() }] } as unknown as RecommendationShelf;
    expect(cardShelf(shelf).items[0]!.title.overview).toBeNull();
  });
});

describe("source order on the server", () => {
  it("needs no browser when there are no copies (a guest's title page renders on the server)", () => {
    // `document` doesn't exist here, as on the server: ordering nothing must not look at the browser.
    expect(orderedSources({ servers: [], connections: 0, sources: [] })).toEqual([]);
  });
});
