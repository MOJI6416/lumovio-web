import { describe, expect, it } from "vitest";
import { legacyAddress, queryOf } from "../src/lib/legacy-address";
import { isCode, parseCodeSlug, parseSlugId } from "../src/lib/address-read";
import { personHref, titleHref, watchHref } from "../src/lib/slug";

const matrix = { code: "ewzsjd5z", kind: "movie" as const, tmdbId: 603, title: "Матрица" };

describe("addresses on codes", () => {
  it("builds a title's address from its code and its name", () => {
    expect(titleHref(matrix)).toBe("/title/ewzsjd5z-матрица");
    expect(titleHref(matrix, "The Matrix")).toBe("/title/ewzsjd5z-the-matrix");
    expect(titleHref({ ...matrix, title: null })).toBe("/title/ewzsjd5z");
  });

  it("links TMDB's id where an answer has no code (the site moves it)", () => {
    expect(titleHref({ kind: "tv", tmdbId: 1396, title: "Breaking Bad" })).toBe("/title/tv/1396-breaking-bad");
    expect(personHref({ id: 6384 })).toBe("/person/6384");
    expect(watchHref({ kind: "tv", tmdbId: 1396 }, { s: 1, e: 2 })).toBe("/watch/tv/1396?s=1&e=2");
  });

  it("gives a person the code alone", () => {
    expect(personHref({ code: "k2m4n6p8", id: 6384 })).toBe("/person/k2m4n6p8");
  });

  it("puts the player's query in the order given, without empty values", () => {
    expect(watchHref(matrix)).toBe("/watch/ewzsjd5z");
    expect(watchHref(matrix, { s: 2, e: 3, voice: "ru|LostFilm", pick: null, quality: "" })).toBe("/watch/ewzsjd5z?s=2&e=3&voice=ru%7CLostFilm");
    expect(watchHref(matrix, { s: 0, e: 0 })).toBe("/watch/ewzsjd5z?s=0&e=0");
  });

  it("reads a code, never a number, at the start of an address's part", () => {
    expect(parseCodeSlug("ewzsjd5z-матрица")).toBe("ewzsjd5z");
    expect(parseCodeSlug(encodeURIComponent("ewzsjd5z-матрица"))).toBe("ewzsjd5z");
    expect(parseCodeSlug("ewzsjd5z")).toBe("ewzsjd5z");
    expect(parseCodeSlug("603-the-matrix")).toBeNull();
    expect(parseCodeSlug("12345678")).toBeNull();
    // i, l, o and u are not in the alphabet; a code is 8 symbols, not more.
    expect(parseCodeSlug("ewzsjdlz")).toBeNull();
    expect(parseCodeSlug("ewzsjd5zz")).toBeNull();
    expect(isCode("ewzsjd5z")).toBe(true);
    expect(isCode("1wzsjd5z")).toBe(false);
  });

  it("reads TMDB's id of an older address only, never from a code", () => {
    expect(parseSlugId("603-the-matrix")).toBe(603);
    expect(parseSlugId("6384")).toBe(6384);
    expect(parseSlugId("ewzsjd5z-matrix")).toBeNull();
    expect(parseSlugId("e603wzsj")).toBeNull();
    expect(parseSlugId("603abc")).toBeNull();
  });
});

describe("older addresses", () => {
  it("names the key and the address on the code, keeping the title's slug", () => {
    const t = legacyAddress("/title/movie/603-the-matrix")!;
    expect(t.key).toBe("movie:603");
    expect(t.to("ewzsjd5z")).toBe("/title/ewzsjd5z-the-matrix");
    expect(legacyAddress("/title/tv/1396")!.to("q2w3e4r5")).toBe("/title/q2w3e4r5");
    expect(legacyAddress("/person/6384-keanu-reeves")!.key).toBe("person:6384");
    expect(legacyAddress("/person/6384")!.to("k2m4n6p8")).toBe("/person/k2m4n6p8");
    expect(legacyAddress("/watch/tv/1396")!.key).toBe("tv:1396");
    expect(legacyAddress("/watch/tv/1396/")!.to("q2w3e4r5")).toBe("/watch/q2w3e4r5");
  });

  it("leaves the new addresses and the others alone", () => {
    expect(legacyAddress("/title/ewzsjd5z-the-matrix")).toBeNull();
    expect(legacyAddress("/person/k2m4n6p8")).toBeNull();
    expect(legacyAddress("/watch/ewzsjd5z")).toBeNull();
    expect(legacyAddress("/title/book/603")).toBeNull();
    expect(legacyAddress("/browse/movie")).toBeNull();
  });

  it("keeps every parameter of the player's query", () => {
    const all = { s: "1", e: "2", source: "c1:abc", voice: "ru|LostFilm", audio: "1", quality: "best", picture: "hdr", edition: "dc", t: "120", cast: "x", pick: "1", added: "1", brought: "1" };
    expect(queryOf(all)).toBe("?s=1&e=2&source=c1%3Aabc&voice=ru%7CLostFilm&audio=1&quality=best&picture=hdr&edition=dc&t=120&cast=x&pick=1&added=1&brought=1");
    expect(queryOf({ tab: ["a", "b"], x: undefined })).toBe("?tab=a&tab=b");
    expect(queryOf({})).toBe("");
  });
});
