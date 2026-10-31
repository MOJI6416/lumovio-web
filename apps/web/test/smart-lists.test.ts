import { describe, expect, it } from "vitest";
import { editListId, libraryHref, libraryRules, rulesHref } from "../src/components/library/rules-url";
import { readFilters } from "../src/components/library/url-state";
import { browseState, discoverQuery } from "../src/lib/discover";
import { catalogHref, catalogRules } from "../src/lib/discover-rules";

// Package F: a smart list keeps the catalog grid's conditions as data and opens the grid with them again ("Edit
// conditions", "All in the catalog"), and keeps a collection tab's filters the same way.

const stateOf = (href: string, anime = false) => {
  const sp = new URL(href, "http://x").searchParams;
  return browseState((k) => sp.get(k), anime);
};

describe("a smart list's catalog conditions", () => {
  it("are the very query the grid asks", () => {
    for (const [kind, href, anime] of [
      ["movie", "/browse/movie?genres=878,12&runtimeMax=100&sort=imdb&yearFrom=2010&yearTo=2020&ratingMin=7&without=27&nospecials=1&votesMin=500", false],
      ["tv", "/browse/tv?type=mini&status=ended&episodesMax=10&language=ko&sort=release_desc", false],
      ["tv", "/anime?genres=10759&sort=lumovio", true],
      ["movie", "/anime?kind=movie&genres=14", true],
    ] as const) {
      const s = stateOf(href, anime);
      const q = catalogRules(kind, s);
      // Sent as JSON, read by the API's DiscoverQuery: the same parameters, the same values.
      const sent = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)]));
      const asked = new URLSearchParams(discoverQuery(kind, s));
      expect(Object.fromEntries([...sent].sort()), href).toEqual(Object.fromEntries([...asked].sort()));
    }
    expect(catalogRules("movie", stateOf("/browse/movie?runtimeMax=100&yearFrom=2010"))).toEqual({ kind: "movie", sort: "popularity", runtimeMax: 100, yearFrom: 2010 });
  });

  it("open the grid with the same conditions, and the grid reads them back", () => {
    for (const [kind, href, anime] of [
      ["movie", "/browse/movie?genres=878&runtimeMax=100&sort=imdb&yearFrom=2010&yearTo=2020&ratingMin=7.5&without=27&nospecials=1", false],
      ["tv", "/browse/tv?type=scripted&status=returning&episodesMax=24&votesMax=900", false],
      ["tv", "/anime?genres=16&sort=rt", true],
      ["movie", "/anime?kind=movie&genres=14", true],
    ] as const) {
      const q = catalogRules(kind, stateOf(href, anime));
      const back = catalogHref(q);
      expect(back.startsWith(anime ? "/anime?" : `/browse/${kind}?`), back).toBe(true);
      expect(new URL(back, "http://x").searchParams.get("view")).toBe("all");
      expect(catalogRules(kind, stateOf(back, anime)), back).toEqual(q);
    }
    expect(catalogHref({ kind: "tv", sort: "popularity" }, "6f1f1f0f-0a01-4d0e-9d55-7b0f7f8e6a7c")).toBe(
      "/browse/tv?view=all&editList=6f1f1f0f-0a01-4d0e-9d55-7b0f7f8e6a7c",
    );
  });
});

describe("a smart list's library conditions", () => {
  it("are a collection tab's filters, and open that tab with them", () => {
    const r = libraryRules(["favorites"], { show: "movie", max: 100, status: null, onServers: true, unwatched: false });
    expect(r).toEqual({ from: "library", lists: ["favorites"], show: "movie", max: 100, status: null, onServers: true, unwatched: false });
    expect(libraryHref(r, "6f1f1f0f-0a01-4d0e-9d55-7b0f7f8e6a7c")).toBe("/library?tab=favorites&show=movie&max=100&avail=1&editList=6f1f1f0f-0a01-4d0e-9d55-7b0f7f8e6a7c");
    expect(rulesHref({ ...r, lists: ["watchlist", "favorites"], show: null, max: null, onServers: false, unwatched: true })).toBe("/library?tab=watchlist&unwatched=1");
    // Series by status, as in the catalog: back in the tab's address, read only with "Series" chosen.
    const ended = libraryRules(["watchlist"], { show: "tv", max: null, status: "ended", onServers: false, unwatched: false });
    expect(libraryHref(ended)).toBe("/library?tab=watchlist&show=tv&status=ended");
    expect(readFilters(new URLSearchParams("show=tv&status=returning")).status).toBe("returning");
    expect(readFilters(new URLSearchParams("show=movie&status=ended")).status).toBeNull();
    expect(readFilters(new URLSearchParams("status=ended")).status).toBeNull();
  });

  it("are edited only for a list id in the address", () => {
    expect(editListId(new URLSearchParams("editList=6f1f1f0f-0a01-4d0e-9d55-7b0f7f8e6a7c"))).toBe("6f1f1f0f-0a01-4d0e-9d55-7b0f7f8e6a7c");
    expect(editListId(new URLSearchParams("editList=../admin"))).toBeNull();
    expect(editListId(new URLSearchParams(""))).toBeNull();
  });
});
