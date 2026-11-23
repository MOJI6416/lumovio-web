import type { EpisodeSummary, SeasonSummary } from "@lumovio/contracts";
import { describe, expect, it } from "vitest";
import { showWatched } from "../src/components/title/core";

const season = (n: number, episodeCount: number) => ({ seasonNumber: n, episodeCount }) as SeasonSummary;
const last = (seasonNumber: number, episodeNumber: number) => ({ seasonNumber, episodeNumber }) as EpisodeSummary;
const keys = (...pairs: [number, number][]) => pairs.flatMap(([s, n]) => Array.from({ length: n }, (_, i) => `s${s}e${i + 1}`));

describe("a whole series watched", () => {
  const ended = { seasons: [season(0, 3), season(1, 2), season(2, 3)], lastEpisode: last(2, 3) };

  it("is every aired episode of the regular seasons, specials aside", () => {
    expect(showWatched(ended, keys([1, 2], [2, 3]))).toBe(true);
    expect(showWatched(ended, keys([1, 2], [2, 2]))).toBe(false);
    expect(showWatched(ended, [])).toBe(false);
  });

  it("counts a season on air only up to its last aired episode", () => {
    const onAir = { seasons: [season(1, 2), season(2, 8), season(3, 10)], lastEpisode: last(2, 4) };
    expect(showWatched(onAir, keys([1, 2], [2, 4]))).toBe(true);
    expect(showWatched(onAir, keys([1, 2], [2, 3]))).toBe(false);
  });

  it("takes the seasons whole when the last aired episode isn't known, and nothing aired is never watched", () => {
    expect(showWatched({ seasons: [season(1, 2)], lastEpisode: null }, keys([1, 2]))).toBe(true);
    expect(showWatched({ seasons: [season(1, 0)], lastEpisode: null }, [])).toBe(false);
  });
});
