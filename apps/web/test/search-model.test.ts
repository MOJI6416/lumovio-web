import type { CatalogSearch, PersonSummary, TitleSummary } from "@lumovio/contracts";
import { describe, expect, it } from "vitest";
import { genreTiles, groupResults, isEmpty, looksDescriptive, tilesFor } from "../src/components/search/search-model";

// The search's one logic for the header, the page and the TV.

const title = (id: number, kind: "movie" | "tv", extra: Partial<TitleSummary> = {}): TitleSummary => ({
  id: `${kind}:${id}`,
  kind,
  tmdbId: id,
  title: `T${id}`,
  originalTitle: null,
  year: 2000,
  releaseDate: null,
  posterPath: null,
  backdropPath: `/b${id}.jpg`,
  overview: null,
  tmdbRating: null,
  tmdbVotes: null,
  genreIds: [],
  originalLanguage: "en",
  isAnime: false,
  ...extra,
});
const person = (id: number): PersonSummary => ({ id, name: `P${id}`, profilePath: null, knownFor: "Acting" });
const answer = (titles: TitleSummary[], people: PersonSummary[] = [], extra: Partial<CatalogSearch> = {}): CatalogSearch => ({
  titles: { page: 1, totalPages: 1, totalResults: titles.length, results: titles },
  people,
  ...extra,
});

describe("groupResults", () => {
  it("a title named like the query is the best match, not repeated in its group; films and series in their order", () => {
    const g = groupResults(answer([title(1, "movie"), title(2, "tv"), title(3, "movie")], [person(9)], { clear: true, peopleFirst: false }));
    expect(g.best).toEqual({ type: "title", title: title(1, "movie") });
    expect(g.movie.map((x) => x.id)).toEqual(["movie:3"]);
    expect(g.tv.map((x) => x.id)).toEqual(["tv:2"]);
    // The first result after the best match is a series: series come first; people last for a title's name.
    expect(g.order).toEqual(["tv", "movie", "people"]);
  });

  it("a query that reads as a name makes the person the best match, the other people first", () => {
    const g = groupResults(answer([title(1, "movie")], [person(7), person(8)], { clear: false, peopleFirst: true }));
    expect(g.best).toEqual({ type: "person", person: person(7) });
    expect(g.people).toEqual([person(8)]);
    expect(g.order).toEqual(["people", "movie"]);
  });

  it("a loose resemblance has no best match", () => {
    const g = groupResults(answer([title(1, "movie"), title(2, "movie")], [], { clear: false }));
    expect(g.best).toBeNull();
    expect(g.movie).toHaveLength(2);
    expect(g.order).toEqual(["movie"]);
  });

  it("an answer without `clear` (TMDB's own search) still takes its first title", () => {
    expect(groupResults(answer([title(1, "tv")])).best?.type).toBe("title");
  });

  it("nothing at all is empty", () => {
    expect(isEmpty(answer([]))).toBe(true);
    expect(isEmpty(answer([], [person(1)]))).toBe(false);
  });
});

describe("looksDescriptive", () => {
  it("three words that name no title read as a description", () => {
    expect(looksDescriptive("комедия про путешествия во времени", false)).toBe(true);
    expect(looksDescriptive("комедия про путешествия во времени", undefined)).toBe(true);
  });
  it("a title's long name, a short query or digits are not", () => {
    expect(looksDescriptive("властелин колец братство кольца", true)).toBe(false);
    expect(looksDescriptive("звёздные войны", false)).toBe(false);
    expect(looksDescriptive("1 2 3", false)).toBe(false);
  });
});

describe("genreTiles", () => {
  const genres = [
    { id: 28, name: "боевик" },
    { id: 35, name: "комедия" },
    { id: 27, name: "ужасы" },
  ];
  it("each tile takes a different popular title's backdrop, films first, names capitalised", () => {
    const rows = [{ items: [title(1, "tv", { genreIds: [28] }), title(2, "movie", { genreIds: [28, 35] }), title(3, "movie", { genreIds: [35] })] }];
    const tiles = genreTiles(rows, genres, "ru");
    expect(tiles.map((t) => [t.id, t.name, t.art])).toEqual([
      [28, "Боевик", "/b2.jpg"],
      [35, "Комедия", "/b3.jpg"],
      [27, "Ужасы", null],
    ]);
    expect(tiles[0]?.href).toBe("/browse/movie?genres=28");
  });
  it("a kids profile goes without horror", () => {
    const tiles = genreTiles([], genres, "ru");
    expect(tilesFor(tiles, true).map((t) => t.id)).toEqual([28, 35]);
    expect(tilesFor(tiles, false)).toHaveLength(3);
  });
});
