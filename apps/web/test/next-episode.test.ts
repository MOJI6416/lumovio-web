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
