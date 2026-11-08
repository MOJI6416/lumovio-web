import { describe, expect, it } from "vitest";
import { startHref } from "@/components/title/chosen-season";
import { sourcesHref, watchHref } from "@/components/title/core";
import { tvShellPath } from "@/lib/tv";

// Every way onto the sources screen builds an address the site has (the owner, 2026-11-08: "Another source" → "Find"
// led to a page that doesn't exist): /watch/<kind>/<id> with ?pick=1, a series' ?s=&e=, and on a TV the same under /tvui.
const film = { kind: "movie" as const, tmdbId: 872585, seasons: [], nextEpisode: null };
const series = { kind: "tv" as const, tmdbId: 71446, seasons: [{ seasonNumber: 1, name: "", episodeCount: 13, airDate: "2017-05-02", posterPath: null, overview: null }, { seasonNumber: 2, name: "", episodeCount: 9, airDate: "2017-10-16", posterPath: null, overview: null }], nextEpisode: null };
const page = /^\/watch\/(movie|tv)\/\d+(\?(s=\d+&e=\d+&)?pick=1(&[a-z]+=[^&]*)*)$/;

describe("addresses of the sources screen", () => {
  it("from a title: Find a source, Another release, All releases — film and series", () => {
    expect(sourcesHref(watchHref(film, undefined), "&find=1")).toBe("/watch/movie/872585?pick=1&find=1");
    expect(sourcesHref(watchHref(series, undefined), "&find=1")).toBe("/watch/tv/71446?s=1&e=1&pick=1&find=1");
    expect(sourcesHref(startHref(series, { season: 2, episode: 1 }, watchHref(series, undefined)), "&voice=ru%7Cdub")).toBe("/watch/tv/71446?s=2&e=1&pick=1&voice=ru%7Cdub");
    for (const href of [sourcesHref(watchHref(film, undefined)), sourcesHref(watchHref(series, undefined), "&find=1")]) expect(href).toMatch(page);
  });

  it("on a TV: the same screen under the TV shell", () => {
    expect(tvShellPath("/watch/tv/71446?s=1&e=1&pick=1")).toBe("/tvui/watch/tv/71446?s=1&e=1&pick=1");
    expect(tvShellPath("/watch/movie/872585?pick=1&find=1")).toBe("/tvui/watch/movie/872585?pick=1&find=1");
  });
});
