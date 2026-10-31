import type { CatalogSearch, RecommendationReason, RecommendationShelf } from "@lumovio/contracts";
import { describe, expect, it } from "vitest";
import { reasonLine, shelfTitle } from "../src/components/media/recommendation-copy";
import { keepShelf, SHELF_COPY, shelfHeading, shelfHref } from "../src/components/media/shelf-copy";
import { layoutFix } from "../src/components/search/search-helpers";
import ru from "../messages/ru.json";

// The re-audit's findings on shelves, personal picks and search (2026-10-29): CAT-11, HOME-16, HOME-17, SRCH-16.

/** The `rows` translator over the Russian messages, as next-intl formats a simple `{name}`. */
const rows = ru.rows as Record<string, string>;
const t = ((key: string, values: Record<string, string | number> = {}) =>
  (rows[key] ?? `rows.${key}`).replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""))) as never;
const tr = (key: string) => {
  const [ns, k] = key.split(".");
  return (ru as unknown as Record<string, Record<string, string>>)[ns!]![k!] ?? key;
};

describe("a shelf's “All” page keeps its name (CAT-11)", () => {
  it("marks every shelf with an “All” page, a genre shelf too, and nothing without one", () => {
    expect(shelfHref("kids_top", "/browse/movie?genres=10751&sort=rating")).toBe("/browse/movie?genres=10751&sort=rating&shelf=kids_top");
    expect(shelfHref("anime", "/browse/tv?anime=1")).toBe("/browse/tv?anime=1&shelf=anime");
    expect(shelfHref("genre_18", "/browse/movie?genres=18")).toBe("/browse/movie?genres=18&shelf=genre_18");
    expect(shelfHref("trending", null)).toBeNull();
  });

  it("names the page by the shelf and says what it holds", () => {
    expect(shelfHeading("kids_top", tr, [], "ru")).toEqual({ title: "Лучшее семейное", description: "Семейные фильмы с самыми высокими оценками" });
    expect(shelfHeading("anime", tr, [], "ru")).toEqual({ title: "Аниме-сериалы", description: "Японские анимационные сериалы" });
    expect(shelfHeading("popular_tv", tr, [], "ru")?.description).toBe(rows.popularSeriesNote);
    expect(shelfHeading("genre_18", tr, [{ id: 18, name: "драма" }], "ru")).toEqual({ title: "Драма" });
    expect(shelfHeading("genre_99", tr, [{ id: 18, name: "Драма" }], "ru")).toBeNull();
    expect(shelfHeading("nonsense", tr, [], "ru")).toBeNull();
    expect(shelfHeading(null, tr, [], "ru")).toBeNull();
  });

  it("has words for every shelf it names", () => {
    for (const [key, c] of Object.entries(SHELF_COPY))
      for (const k of [c.title, c.why, c.note, c.about].filter((x): x is string => Boolean(x))) expect(tr(k), `${key}: ${k}`).not.toBe(k);
  });

  it("drops the name when a condition of the shelf changes or goes, keeps it under a filter added on top", () => {
    const at = new URLSearchParams("genres=10751&sort=rating&shelf=kids_top");
    expect(keepShelf(at, new URLSearchParams("genres=10751&sort=rating&shelf=kids_top&yearFrom=2000")).get("shelf")).toBe("kids_top");
    expect(keepShelf(at, new URLSearchParams("genres=10751&sort=release_desc&shelf=kids_top")).get("shelf")).toBeNull();
    expect(keepShelf(at, new URLSearchParams("sort=rating&shelf=kids_top")).get("shelf")).toBeNull();
    expect(keepShelf(at, new URLSearchParams("genres=10751,16&sort=rating&shelf=kids_top")).get("shelf")).toBeNull();
  });
});

describe("personal shelves and their lines (HOME-16, HOME-17)", () => {
  const because = (signal: NonNullable<RecommendationShelf["seed"]>["signal"]): RecommendationShelf => ({
    key: "because_1",
    kind: "because",
    seed: { titleId: "tv:1", title: "Фриерен", signal, rating: null },
    items: [],
  });

  it("names a “Because …” shelf by what the profile did with the title", () => {
    expect(shelfTitle(t, because("watched"))).toBe("Потому что вы смотрели «Фриерен»");
    expect(shelfTitle(t, because("rewatched"))).toBe("Потому что вы смотрели «Фриерен»");
    expect(shelfTitle(t, because("progress"))).toBe("Потому что вы смотрите «Фриерен»");
    expect(shelfTitle(t, because("like"))).toBe("Потому что вам понравилось «Фриерен»");
    expect(shelfTitle(t, because("rating"))).toBe("Потому что вы оценили «Фриерен»");
    expect(shelfTitle(t, because("favorite"))).toBe("Потому что «Фриерен» в избранном");
  });

  it("says a genre one way, and a new title as new", () => {
    const byId = new Map([[18, "драма"]]);
    const reason = (source: RecommendationReason["source"]): RecommendationReason => ({ source, sharedGenres: [18], alsoFrom: 0, sources: [source], parts: { match: 0, source: 0, quality: 0, fresh: 0, popular: 0 } });
    expect(reasonLine(t, reason("genre"), byId)).toBe("Ваш жанр: драма");
    expect(reasonLine(t, reason("taste"), byId)).toBe("Ваш жанр: драма");
    expect(reasonLine(t, reason("fresh"), byId)).toBe("Новинка: драма");
    expect(reasonLine(t, { ...reason("fresh"), sharedGenres: [] }, byId)).toBe("Новинка в ваших жанрах");
  });
});

describe("“Search for «…»” on the other layout (SRCH-16)", () => {
  const answer = (over: Partial<CatalogSearch>, n = 1): CatalogSearch => ({
    titles: { page: 1, totalPages: 1, totalResults: n, results: Array.from({ length: n }, (_, i) => ({ id: `movie:${i}` }) as never) },
    people: [],
    ...over,
  });

  it("is offered only when the other layout names a title", () => {
    expect(layoutFix("dune", answer({ clear: true }))).toBe("dune");
    // TMDB's search without the index says nothing of how clear: as before.
    expect(layoutFix("dune", answer({}))).toBe("dune");
    // "щкщзхъжэ" → "orop[];'": a typo of "Ороль…" at best.
    expect(layoutFix("orop[];'", answer({ clear: false }))).toBeNull();
    expect(layoutFix("orop[];'", answer({ clear: true }, 0))).toBeNull();
    // "дюна" → "l.yf", which the search reads back as "дюна".
    expect(layoutFix("l.yf", answer({ clear: true, interpreted: "дюна" }))).toBeNull();
    expect(layoutFix(null, answer({ clear: true }))).toBeNull();
    expect(layoutFix("dune", undefined)).toBeNull();
  });
});
