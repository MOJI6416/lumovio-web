import { describe, expect, it } from "vitest";
import { episodeAfter, isOut, startEpisode } from "@/components/title/core";

const season = (seasonNumber: number, episodeCount: number, airDate: string | null) => ({ seasonNumber, name: `S${seasonNumber}`, episodeCount, airDate, posterPath: null, overview: null });
const ep = (seasonNumber: number, episodeNumber: number, airDate: string) => ({ id: 1, seasonNumber, episodeNumber, name: "", overview: null, airDate, runtime: null, stillPath: null, tmdbRating: null });
const done = (s: number, e: number) => ({ completed: true, positionSec: 3000, season: s, episode: e }) as never;
const past = "2020-01-01";
const future = "2999-01-01";

describe("the episode after the last finished (T1, P3)", () => {
  it("goes to the next season's first after a season's last", () => {
    const seasons = [season(0, 3, past), season(1, 10, past), season(2, 8, past)];
    expect(episodeAfter(seasons, 1, 10)).toEqual({ season: 2, episode: 1 });
    expect(episodeAfter(seasons, 1, 4)).toEqual({ season: 1, episode: 5 });
    expect(episodeAfter(seasons, 2, 8)).toBeNull();
    expect(episodeAfter(seasons, 0, 3)).toBeNull();
    expect(startEpisode({ seasons, nextEpisode: null }, done(1, 10))).toEqual({ season: 2, episode: 1 });
  });

  it("stays on the finished episode while the next season or episode is only announced", () => {
    // Season 2 announced for later; the series' next episode is S1E11 airing in the future.
    expect(startEpisode({ seasons: [season(1, 10, past), season(2, 8, future)], nextEpisode: null }, done(1, 10))).toEqual({ season: 1, episode: 10 });
    expect(startEpisode({ seasons: [season(1, 12, past)], nextEpisode: ep(1, 11, future) }, done(1, 10))).toEqual({ season: 1, episode: 10 });
    // Out today: taken.
    expect(startEpisode({ seasons: [season(1, 12, past)], nextEpisode: ep(1, 11, past) }, done(1, 10))).toEqual({ season: 1, episode: 11 });
  });

  it("counts an undated episode as not out", () => {
    expect(isOut(null)).toBe(false);
    expect(isOut("2026-11-08", "2026-11-08")).toBe(true);
    expect(isOut("2026-11-09", "2026-11-08")).toBe(false);
  });
});

describe("the season picked in Episodes leads Where to watch (the owner, 2026-11-08)", () => {
  it("starts the picked season's first aired unwatched episode, else its first", async () => {
    const { firstToWatch, startHref } = await import("@/components/title/chosen-season");
    const eps = [ep(2, 1, past), ep(2, 2, past), ep(2, 3, future)].map((e) => ({ episodeNumber: e.episodeNumber, airDate: e.airDate }));
    expect(firstToWatch(2, eps, ["s2e1"])).toEqual({ season: 2, episode: 2 });
    expect(firstToWatch(2, eps, ["s2e1", "s2e2"])).toEqual({ season: 2, episode: 1 });
    const d = { kind: "tv" as const, tmdbId: 71446 };
    // Where the profile is keeps its resume address; another season is a new start.
    expect(startHref(d, { season: 1, episode: 3 }, "/watch/tv/71446?s=1&e=3")).toBe("/watch/tv/71446?s=1&e=3");
    expect(startHref(d, { season: 2, episode: 2 }, "/watch/tv/71446?s=1&e=3")).toBe("/watch/tv/71446?s=2&e=2");
  });
});

describe("the next episode goes on in the same release (P4)", () => {
  it("starts a copy of the torrent the last episode played from, else the first source", async () => {
    const { startCandidate } = await import("@/lib/media/source-order");
    const c = (key: string) => ({ key });
    const torrent = (x: { key: string }) => (x.key.startsWith("ts1") ? x.key.split(":").slice(0, 2).join(":") : null);
    const jellyfin = c("jf:item-4");
    const other = c(`ts1:${"b".repeat(40)}`);
    const same = c(`ts1:${"a".repeat(40)}`);
    const list = [jellyfin, other, same];
    expect(startCandidate(list, torrent, null, `ts1:${"a".repeat(40)}`, false)).toEqual({ pick: same, exact: false });
    // The release doesn't hold the next episode (no candidate of it): the first source, as before.
    expect(startCandidate([jellyfin, other], torrent, null, `ts1:${"a".repeat(40)}`, false)).toEqual({ pick: jellyfin, exact: false });
    // A source asked for by name wins and is exact.
    expect(startCandidate(list, torrent, "jf:item-4", `ts1:${"a".repeat(40)}`, false)).toEqual({ pick: jellyfin, exact: true });
  });
});

describe("a copy of other seasons only is no copy of the episode (T10)", () => {
  it("is left out on the title and in the player alike", async () => {
    const { otherSeasonsOnly } = await import("@/lib/media/releases");
    const pack = (label: string) => ({ kind: "torrserver" as const, externalId: "a".repeat(40), label });
    expect(otherSeasonsOnly(pack("Бумажный дом / Сезон: 1 / Серии: 1-13 из 13"), 2, 1)).toBe(true);
    expect(otherSeasonsOnly(pack("Бумажный дом / Сезоны: 1-5"), 2, 1)).toBe(false);
    expect(otherSeasonsOnly(pack("Бумажный дом [2017-2021] LostFilm"), 2, 1)).toBe(false);
    expect(otherSeasonsOnly({ ...pack("S01"), externalId: `${"a".repeat(40)}:3` }, 2, 1)).toBe(false);
    expect(otherSeasonsOnly({ kind: "jellyfin" as const, externalId: "x", label: "S01" }, 2, 1)).toBe(false);
  });
});
