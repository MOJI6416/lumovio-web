import type { AiFilters, HistoryEntry } from "@lumovio/contracts";
import { describe, expect, it } from "vitest";
import { episodesOf, groupHistory } from "../src/components/library/history";
import { catalogHref, departmentKey, otherLayout } from "../src/components/search/search-helpers";

const title = (id: string, kind: "movie" | "tv" = "movie") => ({ id, kind, tmdbId: 1, title: id }) as HistoryEntry["title"];
const entry = (id: string, t: string, watchedAt: string, season: number | null = null, episode: number | null = null): HistoryEntry => ({
  id,
  title: title(t, season === null ? "movie" : "tv"),
  season,
  episode,
  episodeName: null,
  watchedAt,
  source: "manual",
});

describe("history rows", () => {
  it("one row per title and day: a rewatch and a show's episodes are grouped", () => {
    const days = groupHistory([
      entry("a", "movie:1", "2026-10-24T20:00:00"),
      entry("b", "tv:2", "2026-10-24T19:00:00", 1, 5),
      entry("c", "movie:1", "2026-10-24T12:00:00"),
      entry("d", "tv:2", "2026-10-24T11:00:00", 1, 4),
      entry("e", "movie:1", "2026-10-20T12:00:00"),
    ]);
    expect(days.map((d) => [d.day, d.groups.map((g) => `${g.title.id}×${g.entries.length}`)])).toEqual([
      ["2026-10-24", ["movie:1×2", "tv:2×2"]],
      ["2026-10-20", ["movie:1×1"]],
    ]);
  });

  it("says the episodes as 2.3 does: one, a range, or how many", () => {
    expect(episodesOf([entry("a", "tv:2", "x", 1, 4)])).toEqual({ kind: "one", season: 1, episode: 4 });
    expect(episodesOf([entry("a", "tv:2", "x", 1, 6), entry("b", "tv:2", "x", 1, 4), entry("c", "tv:2", "x", 1, 5)])).toEqual({ kind: "range", season: 1, from: 4, to: 6 });
    expect(episodesOf([entry("a", "tv:2", "x", 1, 4), entry("b", "tv:2", "x", 2, 1)])).toEqual({ kind: "many", count: 2 });
    expect(episodesOf([entry("a", "movie:1", "x")])).toEqual({ kind: "none" });
  });
});

describe("search helpers", () => {
  it("finds the same keys on the other keyboard layout", () => {
    expect(otherLayout("l.yf")).toBe("дюна");
    expect(otherLayout("штеукыеуддфк")).toBe("interstellar");
    expect(otherLayout("дюна 2")).toBe("l.yf 2");
    expect(otherLayout("x")).toBeNull();
    expect(otherLayout("дюна dune")).toBeNull();
  });

  it("names a person's department in words, not TMDB's English", () => {
    expect(departmentKey("Acting")).toBe("person.dept0");
    expect(departmentKey("Directing")).toBe("person.dept1");
    expect(departmentKey("Something new")).toBeNull();
    expect(departmentKey(null)).toBeNull();
  });

  it("opens AI conditions in the catalog with the catalog's own filters", () => {
    const f: AiFilters = {
      kind: "tv",
      genres: [18],
      anyGenres: [35],
      excludeGenres: [27],
      yearFrom: 2016,
      yearTo: null,
      ratingMin: 7,
      language: null,
      runtimeMax: 60,
      anime: false,
      keywords: [],
      similarTo: [],
      preferShort: false,
      sort: "rating",
      tvType: "mini",
      tvStatus: "ended",
    };
    const u = new URL(catalogHref(f), "http://x");
    expect(u.pathname).toBe("/browse/tv");
    expect(Object.fromEntries(u.searchParams)).toEqual({ view: "all", genres: "18", without: "27", yearFrom: "2016", ratingMin: "7", type: "mini", status: "ended", sort: "rating" });
    expect(catalogHref({ ...f, anime: true, kind: "movie", tvType: null, tvStatus: null })).toMatch(/^\/anime\?view=all&kind=movie/);
  });
});
