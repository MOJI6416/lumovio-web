import { describe, expect, it } from "vitest";
import { episodeOf, keepThroughEmpty, matchEpisode, normalizeTorznab, pickMovieFile, seasonOfText, type TsFile, trackersOf, chapterSegments } from "../src/lib/media/torrserver";

const GB = 1024 ** 3;
const files = (paths: string[], size = GB): TsFile[] => paths.map((path, i) => ({ id: i + 1, path, length: size }));

describe("TorrServer search results (T2a)", () => {
  // The shape MatriX.147 returned on 2026-10-23 for Jackett's RuTracker / Kinozal / NoNaMe / Toloka results:
  // Magnet is an empty string, the .torrent comes as a Jackett /dl/ link.
  const linkOnly = {
    Title: "Interstellar [2014, UHD BDRip 2160p]",
    Name: "Interstellar [2014, UHD BDRip 2160p]",
    Magnet: "",
    Link: "https://jackett.example/dl/rutracker/?jackett_apikey=x&path=abc",
    Hash: "",
    Tracker: "RuTracker.org",
    Size: "41.4 GCiB",
    Seed: 312,
    Peer: 332,
  };
  const withMagnet = { Title: "Interstellar 2014 1080p", Magnet: "magnet:?xt=urn:btih:ABCDEF0123456789ABCDEF0123456789ABCDEF01&dn=x", Link: "", Tracker: "Mazepa", Seed: 5 };

  it("keeps results that only have a .torrent link (they were all dropped before)", () => {
    const { results, skipped } = normalizeTorznab([linkOnly, withMagnet]);
    expect(results.map((r) => r.tracker)).toEqual(["RuTracker.org", "Mazepa"]);
    expect(results[0]!.link).toBe(linkOnly.Link);
    expect(results[1]!.link).toBe(withMagnet.Magnet);
    expect(results[1]!.hash).toBe("abcdef0123456789abcdef0123456789abcdef01");
    expect(skipped).toBe(0);
  });

  it("works with no Mazepa at all, counts unusable entries, and treats null as an empty answer", () => {
    const { results, skipped } = normalizeTorznab([linkOnly, { Title: "No link", Magnet: "", Link: "" }, { Title: "", Link: "https://x/dl/1" }]);
    expect(results).toHaveLength(1);
    expect(skipped).toBe(2);
    expect(normalizeTorznab(null)).toEqual({ results: [], skipped: 0 });
  });

  it("keeps the same release once per hash but never merges different trackers' links", () => {
    const { results } = normalizeTorznab([withMagnet, { ...withMagnet, Tracker: "Other" }, linkOnly, { ...linkOnly, Link: "https://jackett.example/dl/kinozal/?path=z", Tracker: "Kinozal" }]);
    expect(results.map((r) => r.tracker)).toEqual(["Mazepa", "RuTracker.org", "Kinozal"]);
  });

  it("lists one torrent from several indexers once, with each origin, and never sums its seeders (TS5)", () => {
    const kinozal = { Title: "Interstellar (2014) 1080p", Magnet: "", Link: "https://jackett.example/dl/kinozal/?path=k", Hash: "ABCDEF0123456789ABCDEF0123456789ABCDEF01", Tracker: "Kinozal", Seed: 9, Peer: 3 };
    const { results } = normalizeTorznab([withMagnet, linkOnly, kinozal]);
    expect(results).toHaveLength(2);
    const one = results[0]!;
    expect(one.link).toBe(withMagnet.Magnet);
    expect(one.origins?.map((o) => [o.tracker, o.link, o.seeders])).toEqual([
      ["Mazepa", withMagnet.Magnet, 5],
      ["Kinozal", kinozal.Link, 9],
    ]);
    // One swarm: the highest number reported, not 14.
    expect([one.seeders, one.peers]).toEqual([9, 3]);
    expect(trackersOf(one)).toEqual(["Mazepa", "Kinozal"]);
    // Without a hash nothing is the same release, however alike the names.
    expect(results[1]!.origins).toBeUndefined();
    expect(trackersOf(results[1]!)).toEqual(["RuTracker.org"]);
  });

  it("keeps the results shown when a refresh comes back empty, and says when (TS5)", () => {
    const earlier = { results: normalizeTorznab([linkOnly]).results, skipped: 0, at: 1000 };
    expect(keepThroughEmpty(earlier, { results: [], skipped: 0, at: 2000 })).toEqual({ ...earlier, emptyAt: 2000 });
    const fresh = { results: normalizeTorznab([withMagnet]).results, skipped: 0, at: 3000 };
    expect(keepThroughEmpty(earlier, fresh)).toBe(fresh);
    // Nothing was found before either: the empty answer is the answer.
    const empty = { results: [], skipped: 1, at: 4000 };
    expect(keepThroughEmpty({ results: [], skipped: 0, at: 1 }, empty)).toBe(empty);
    expect(keepThroughEmpty(null, empty)).toBe(empty);
  });
});

describe("seasons and episodes in torrent names (T1)", () => {
  it("reads one season from a release title, and none from a range", () => {
    expect(seasonOfText("Во все тяжкие / Breaking Bad / Сезон: 2 / Серии: 1-13 из 13 [2009, WEB-DL 1080p]")).toBe(2);
    expect(seasonOfText("Breaking.Bad.S03.1080p")).toBe(3);
    expect(seasonOfText("Season 4")).toBe(4);
    expect(seasonOfText("2 сезон")).toBe(2);
    expect(seasonOfText("Сезон 1-5")).toBeNull();
    expect(seasonOfText("Breaking.Bad.S01-S05.Complete")).toBeNull();
    expect(seasonOfText("Interstellar 2014 DTS 5.1")).toBeNull();
  });

  it("takes the season from the file, its folder or the release, and leaves it unknown otherwise", () => {
    expect(episodeOf("Breaking Bad/Сезон 2/03. Грилованный.mkv")).toEqual({ season: 2, episode: 3 });
    expect(episodeOf("Breaking Bad - Серия 5.mkv", 1)).toEqual({ season: 1, episode: 5 });
    expect(episodeOf("05.mkv")).toEqual({ season: null, episode: 5 });
    expect(episodeOf("Show/Season 1/Show.S02E05.mkv")).toEqual({ season: 2, episode: 5 });
    expect(episodeOf("Movie 1920x1080.mkv")).toBeNull();
  });

  it("plays S2E3 from a season-2 pack and does not play its neighbour for S1E3", () => {
    const pack = files(["BB S2/01.mkv", "BB S2/02.mkv", "BB S2/03.mkv", "BB S2/04.mkv"]);
    expect(matchEpisode(pack, "Breaking Bad / Сезон: 2", 2, 3)).toMatchObject({ status: "match", file: { path: "BB S2/03.mkv" } });
    expect(matchEpisode(pack, "Breaking Bad / Сезон: 2", 1, 3).status).toBe("none");
    expect(matchEpisode(pack, "Breaking Bad / Сезон: 2", 2, 9).status).toBe("none");
  });

  it("finds S1E2 and S2E3 in a multi-season torrent and never falls back to the first file", () => {
    const all = files(["Show/Season 1/Show.S01E01.mkv", "Show/Season 1/Show.S01E02.mkv", "Show/Season 2/Show.S02E01.mkv", "Show/Season 2/Show.S02E03.mkv", "Show/Season 2/Sample/Show.S02E03.sample.mkv"]);
    expect(matchEpisode(all, "Show S01-S02", 1, 2)).toMatchObject({ status: "match", file: { path: "Show/Season 1/Show.S01E02.mkv" } });
    expect(matchEpisode(all, "Show S01-S02", 2, 3)).toMatchObject({ status: "match", file: { path: "Show/Season 2/Show.S02E03.mkv" } });
    const missing = matchEpisode(all, "Show S01-S02", 2, 2);
    expect(missing.status).toBe("none");
  });

  it("asks when the season is not stated anywhere, with the fitting file first", () => {
    const r = matchEpisode(files(["Frieren/01.mkv", "Frieren/02.mkv", "Frieren/03.mkv"]), "Frieren [WEB-DL 1080p]", 1, 3);
    expect(r.status).toBe("ambiguous");
    if (r.status !== "match") expect(r.candidates[0]).toMatchObject({ path: "Frieren/03.mkv", probable: true });
  });

  it("asks when two copies of the same episode are in one torrent", () => {
    expect(matchEpisode(files(["S01E02.720p.mkv", "S01E02.1080p.mkv"]), "Show", 1, 2).status).toBe("ambiguous");
  });
});

describe("the film's file", () => {
  it("does not take a sample just because it is an MP4", () => {
    const r = pickMovieFile([
      { id: 1, path: "Film/Film.2019.2160p.mkv", length: 20 * GB },
      { id: 2, path: "Film/Sample/film-sample.mp4", length: 0.05 * GB },
    ]);
    expect(r).toMatchObject({ status: "match", file: { id: 1 } });
  });

  it("asks when two different big videos are in one torrent (two cuts, two parts)", () => {
    expect(pickMovieFile(files(["Film/CD1.avi", "Film/CD2.avi"], 0.7 * GB)).status).toBe("ambiguous");
  });

  it("asks about a trilogy with the film's own year first", () => {
    const pack = files(["Trilogy/The.Matrix.Reloaded.2003.mkv", "Trilogy/The.Matrix.1999.mkv", "Trilogy/The.Matrix.Revolutions.2003.mkv"], 11 * GB);
    const r = pickMovieFile(pack, 1999);
    expect(r.status).toBe("ambiguous");
    expect(r.status === "ambiguous" && r.candidates.map((f) => f.id)).toEqual([2, 1, 3]);
    expect(pickMovieFile(pack).status === "ambiguous" && pickMovieFile(pack).candidates.map((f) => f.id)).toEqual([1, 2, 3]);
  });

  it("reports a torrent without a video", () => {
    expect(pickMovieFile(files(["readme.txt"])).status).toBe("none");
  });
});

describe("skip segments from a file's chapters", () => {
  it("takes chapters named intro, recap or credits, in Russian, Ukrainian or English; nothing else", () => {
    const ch = (title: string, start: number, end: number) => ({ start_time: String(start), end_time: String(end), tags: { title } });
    expect(
      chapterSegments([ch("Intro", 0, 15), ch("Chapter 1", 15, 75), ch("Титры", 75, 90), ch("Ранее", 0, 2), ch("Заставка", 120, 150), ch("Opening Song", 0, 90)]),
    ).toEqual([
      { kind: "intro", start: 0, end: 15 },
      { kind: "outro", start: 75, end: 90 },
      { kind: "intro", start: 120, end: 150 },
    ]);
    expect(chapterSegments(undefined)).toEqual([]);
    expect(chapterSegments([{ tags: { title: "Intro" } }])).toEqual([]);
  });
});
