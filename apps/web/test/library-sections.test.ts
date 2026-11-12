import { describe, expect, it } from "vitest";
import { groupHistory } from "../src/components/library/history";
import { librarySection } from "../src/components/library/sections";

describe("library sections", () => {
  it("opens a collection's page by its tab, anything else is the library's screen", () => {
    expect(librarySection("watchlist")).toBe("watchlist");
    expect(librarySection("lists")).toBe("lists");
    // The old default tab and unknown ones are the screen of shelves.
    expect(librarySection("overview")).toBeNull();
    expect(librarySection("nope")).toBeNull();
    expect(librarySection(undefined)).toBeNull();
    expect(librarySection(["watchlist", "lists"])).toBeNull();
  });

  it("keeps one card per title and day, newest day first, for the history's months", () => {
    const title = (id: string) => ({ id, kind: "movie", tmdbId: 1, title: id }) as never;
    const at = (iso: string, id: string, n: string) => ({ id: n, title: title(id), season: null, episode: null, episodeName: null, watchedAt: iso, source: "manual" });
    const days = groupHistory([
      at("2026-11-05T20:00:00", "movie:1", "a"),
      at("2026-11-05T18:00:00", "movie:1", "b"),
      at("2026-11-05T17:00:00", "movie:2", "c"),
      at("2026-10-30T20:00:00", "movie:1", "d"),
    ]);
    expect(days.map((d) => d.day)).toEqual(["2026-11-05", "2026-10-30"]);
    expect(days[0]!.groups.map((g) => [g.title.id, g.entries.length])).toEqual([
      ["movie:1", 2],
      ["movie:2", 1],
    ]);
  });
});
