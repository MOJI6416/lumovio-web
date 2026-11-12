import { describe, expect, it } from "vitest";
import { type MatchTitle, markedTitle, matchRelease, releaseTitle } from "../src/lib/media/torrent-link";

const film = (tmdbId: number, title: string, originalTitle: string, year: number): MatchTitle => ({ id: `movie:${tmdbId}`, kind: "movie", tmdbId, title, originalTitle, year, posterPath: null });
const show = (tmdbId: number, title: string, originalTitle: string, year: number): MatchTitle => ({ id: `tv:${tmdbId}`, kind: "tv", tmdbId, title, originalTitle, year, posterPath: null });

const DUNE_1984 = film(841, "Дюна", "Dune", 1984);
const DUNE_2021 = film(438631, "Дюна", "Dune", 2021);
const DUNE_TWO = film(693134, "Дюна: Часть вторая", "Dune: Part Two", 2024);
const JJK = show(95479, "Магическая битва", "呪術廻戦", 2020);

/** Torrents already on a TorrServer, matched to titles. */
describe("releaseTitle", () => {
  it("takes the title words before the year, picture or season", () => {
    expect(releaseTitle("Дюна / Dune (Дени Вильнёв / Denis Villeneuve) [2021, США, фантастика, BDRip 1080p] Dub")).toMatchObject({ query: "Дюна", alt: "Dune", years: [2021], kind: null });
    expect(releaseTitle("Dune.Part.Two.2024.2160p.WEB-DL.DV.HDR.mkv")).toMatchObject({ query: "Dune Part Two", alt: null, years: [2024] });
    expect(releaseTitle("Breaking.Bad.S01-S05.Complete.1080p")).toMatchObject({ query: "Breaking Bad", kind: "tv" });
    expect(releaseTitle("Магическая битва / Jujutsu Kaisen [TV] [1-47 из 47] [2020, WEBRip 1080p]")).toMatchObject({ query: "Магическая битва", alt: "Jujutsu Kaisen", kind: "tv" });
  });

  it("keeps a title that starts with a number", () => {
    expect(releaseTitle("1917 (2019) BDRip 1080p").query).toBe("1917");
    expect(releaseTitle("2001: A Space Odyssey (1968) 2160p").query).toBe("2001: A Space Odyssey");
  });
});

describe("markedTitle", () => {
  it("reads Lumovio's own mark and Lampa's TMDB card", () => {
    expect(markedTitle(JSON.stringify({ lumovio: { titleId: "movie:438631", season: null, title: "Дюна (2021)" } }))).toBe("movie:438631");
    expect(markedTitle(JSON.stringify({ lampa: true, movie: { id: 1399, name: "Game of Thrones", first_air_date: "2011-04-17" } }))).toBe("tv:1399");
    expect(markedTitle(JSON.stringify({ lampa: true, movie: { id: 27205, title: "Inception", release_date: "2010-07-15" } }))).toBe("movie:27205");
  });

  it("names nothing for other data", () => {
    expect(markedTitle(undefined)).toBeNull();
    expect(markedTitle("not json")).toBeNull();
    expect(markedTitle(JSON.stringify({ lampa: true, movie: { id: "x" } }))).toBeNull();
    expect(markedTitle(JSON.stringify({ lampa: true, movie: { id: 5, source: "kinopoisk" } }))).toBeNull();
  });
});

describe("matchRelease", () => {
  it("is sure of one title whose name and year fit", () => {
    const m = matchRelease("Дюна / Dune (2021) WEB-DL 1080p | MVO", [DUNE_1984, DUNE_2021, DUNE_TWO]);
    expect(m.status).toBe("sure");
    expect(m.title?.id).toBe("movie:438631");
  });

  it("tells a sequel from the film its name begins with by the year", () => {
    expect(matchRelease("Дюна: Часть вторая / Dune: Part Two (2024) WEB-DL 1080p | D", [DUNE_2021, DUNE_TWO]).title?.id).toBe("movie:693134");
    expect(matchRelease("Dune.Part.Two.2024.2160p.WEB-DL.mkv", [DUNE_2021, DUNE_TWO]).title?.id).toBe("movie:693134");
  });

  it("leaves a name without a year, or with several fitting titles, to the person", () => {
    const m = matchRelease("Dune 1080p BDRip", [DUNE_1984, DUNE_2021]);
    expect(m.status).toBe("unsure");
    expect(m.candidates.map((c) => c.id)).toEqual(["movie:841", "movie:438631"]);
  });

  it("never takes a title the name doesn't have", () => {
    const m = matchRelease("Fixture Film A (2019) 1080p", [DUNE_2021]);
    expect(m.status).toBe("none");
  });

  it("matches a series by its other name and a pack's seasons, films left out", () => {
    const m = matchRelease("Магическая битва / Jujutsu Kaisen [TV-1,2] [1-47 из 47] WEB-DL 1080p", [film(1, "Магическая битва 0", "Jujutsu Kaisen 0", 2021), JJK]);
    expect(m.status).toBe("unsure");
    expect(m.candidates.map((c) => c.id)).toEqual(["tv:95479"]);
    expect(matchRelease("Магическая битва / Jujutsu Kaisen [TV] [1-47 из 47] [2020, WEBRip 1080p]", [JJK]).status).toBe("sure");
  });

  it("is sure of a stored id", () => {
    expect(matchRelease("anything at all", [], DUNE_2021)).toMatchObject({ status: "sure", by: "mark", title: DUNE_2021 });
  });
});
