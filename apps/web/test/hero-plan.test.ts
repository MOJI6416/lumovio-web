import { describe, expect, it } from "vitest";
import { titleCore, watchHref } from "../src/components/title/core";
import { heroPlan, type PlanInput } from "../src/components/title/hero-plan";

const base: PlanInput = {
  signedIn: true,
  kids: false,
  watch: { kind: "notInLibrary", servers: 2 },
  resume: false,
  copy: null,
  torrent: { state: "none" },
  trailer: true,
  offers: [],
};
const plan = (over: Partial<PlanInput>) => heroPlan({ ...base, ...over });

describe("the title's main button (design-system 8.2, TTL-01)", () => {
  it("waits for availability, then continues where the profile stopped", () => {
    expect(plan({ watch: { kind: "loading" } }).primary).toEqual({ kind: "loading" });
    expect(plan({ watch: { kind: "playable", copies: 1 }, resume: true }).primary).toEqual({ kind: "resume" });
  });

  it("plays the profile's copy, and says where from", () => {
    const p = plan({ watch: { kind: "playable", copies: 2 }, copy: { server: "Home", resolution: "1080p", others: 1 } });
    expect(p.primary).toEqual({ kind: "watch" });
    expect(p.summary).toEqual({ kind: "copy", server: "Home", resolution: "1080p", others: 1 });
  });

  it("plays the recommended release over the trailer, and never offers 'Watch' for nothing", () => {
    expect(plan({ torrent: { state: "found", name: "torr", summary: "1080p" } }).primary).toEqual({ kind: "watchRelease" });
    // While the search runs, "Watch" opens the sources screen (it searches itself).
    expect(plan({ torrent: { state: "searching", name: "torr" } }).primary).toEqual({ kind: "sources", label: "watch" });
    // Nothing found: the trailer, and the line says so instead of suggesting the TorrServer (TTL-06).
    const none = plan({ torrent: { state: "nothing", name: "torr" }, offers: ["Kinopoisk"] });
    expect(none.primary).toEqual({ kind: "trailer" });
    expect(none.summary).toEqual({ kind: "nothingFound", offers: ["Kinopoisk"] });
  });

  it("without automatic search: the trailer, else 'Find a source'", () => {
    expect(plan({ torrent: { state: "manual", name: "torr" } }).primary).toEqual({ kind: "trailer" });
    expect(plan({ torrent: { state: "manual", name: "torr" }, trailer: false }).primary).toEqual({ kind: "sources", label: "find" });
  });

  it("has no primary when there is nothing to play and no trailer (Watchlist takes its place)", () => {
    expect(plan({ trailer: false }).primary).toBeNull();
  });

  it("tells a guest what they can do, not to connect a server (TTL-13)", () => {
    expect(plan({ signedIn: false, watch: { kind: "guest" } }).summary).toEqual({ kind: "guest" });
    expect(plan({ signedIn: false, watch: { kind: "guest" }, offers: ["Netflix"] }).summary).toEqual({ kind: "offers", offers: ["Netflix"] });
  });

  it("says a failed check before anything else, and nothing to a kids profile without servers", () => {
    expect(plan({ watch: { kind: "error" }, offers: ["Netflix"] }).summary).toEqual({ kind: "error" });
    expect(plan({ watch: { kind: "noServers" }, kids: true }).summary).toBeNull();
    expect(plan({ watch: { kind: "noServers" } }).summary).toEqual({ kind: "noServers" });
  });
});

describe("where Watch goes", () => {
  const show = { kind: "tv" as const, tmdbId: 1396, seasons: [0, 1, 2].map((n) => ({ seasonNumber: n, name: "", episodeCount: 7, airDate: null, posterPath: null, overview: null })) };
  it("starts a series at its first regular episode, the next one after a finished episode, or where it stopped", () => {
    expect(watchHref(show, null)).toBe("/watch/tv/1396?s=1&e=1");
    const p = { titleId: "tv:1396", season: 2, episode: 3, positionSec: 600, durationSec: 2900, fraction: 0.2, completed: false, updatedAt: "", source: "" };
    expect(watchHref(show, p)).toBe("/watch/tv/1396?s=2&e=3");
    expect(watchHref(show, { ...p, completed: true })).toBe("/watch/tv/1396?s=2&e=4");
    expect(watchHref({ kind: "movie", tmdbId: 5, seasons: [] }, p)).toBe("/watch/movie/5");
  });
  it("sends the client a cut of the details", () => {
    const core = titleCore(
      {
        id: "movie:1", kind: "movie", tmdbId: 1, title: "A", originalTitle: null, year: 2020, releaseDate: null, posterPath: null, backdropPath: null, overview: "long",
        tmdbRating: null, tmdbVotes: null, genreIds: [], originalLanguage: "en", isAnime: false, tagline: null, runtime: 90, status: "Released", genres: [], countries: [],
        spokenLanguages: [], certification: null, homepage: null, externalIds: { imdb: null, tvdb: null, wikidata: null }, cast: [], crew: [], creators: [],
        videos: [{ key: "t", site: "YouTube", name: "T", type: "Trailer", official: true, language: "en" }], related: [], relatedOther: [], collection: null, seasons: [],
        nextEpisode: null, lastEpisode: null, numberOfSeasons: null, numberOfEpisodes: null, networks: [], keywords: [], watchProviders: null, logo: null, altBackdrop: null,
      },
      "ru",
    );
    expect(core.trailer?.key).toBe("t");
    expect(core.overview).toBeNull();
    expect("cast" in core).toBe(false);
  });
});
