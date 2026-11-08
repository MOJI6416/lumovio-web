import { describe, expect, it } from "vitest";
import { pickRelease } from "../src/lib/media/release-pick";
import { bestOf, holdsSeason, isSameTitle, packOf, type ReleasePrefs, rankReleases } from "../src/lib/media/releases";
import type { TsSearchResult } from "../src/lib/media/torrserver";

// The audit's "broken" picks (tmp/torr/torr-audit-report.md, T2–T5).
const device = { hevc: true, hdr: false, uhd: false, dolbyVision: false };
const prefs = (languages: string[]): ReleasePrefs => ({ languages, studios: [], quality: "auto", device });
let n = 0;
const result = (title: string, seeders = 50): TsSearchResult => ({
  title,
  link: `magnet:?xt=urn:btih:${(++n).toString(16).padStart(40, "0")}`,
  hash: null,
  size: 10e9,
  seeders,
  peers: 1,
  tracker: "RuTracker.org",
  published: null,
});

describe("T2: a series is not its spin-off", () => {
  const dexter = ["Dexter", "Декстер"];
  it("takes the series' own releases", () => {
    expect(isSameTitle("Декстер / Dexter / Сезон: 1 / Серии: 1-12 из 12 [2006, США, WEB-DL 1080p] MVO (LostFilm)", dexter, 2006, "tv")).toBe(true);
    expect(isSameTitle("Dexter.S01.1080p.BluRay.x264-ROVERS", dexter, 2006, "tv")).toBe(true);
    expect(isSameTitle("Dexter - S01E01 - 720p", dexter, 2006, "tv")).toBe(true);
    expect(isSameTitle("The Office US S01 1080p", ["The Office"], 2005, "tv")).toBe(true);
    expect(isSameTitle("1923 S01 2160p", ["1923"], 2022, "tv")).toBe(true);
    expect(isSameTitle("1917 BDRip 1080p", ["1917"], 2019, "movie")).toBe(true);
  });
  it("refuses another series that starts with its name, or one dated before it began", () => {
    expect(isSameTitle("Dexter: Original Sin S01 2160p LostFilm", dexter, 2006, "tv")).toBe(false);
    expect(isSameTitle("Декстер: Первородный грех / Dexter: Original Sin / Сезон: 1 [2024, WEB-DL]", dexter, 2006, "tv", 2014)).toBe(false);
    expect(isSameTitle("House of the Dragon S02 1080p", ["House", "Доктор Хаус"], 2004, "tv")).toBe(false);
    expect(isSameTitle("Doctor Who (1963) Season 1", ["Doctor Who"], 2005, "tv")).toBe(false);
    // Dated after the series ended (its seasons' premieres say until when it ran).
    expect(isSameTitle("Dexter: New Blood [2021, WEB-DL 1080p]", dexter, 2006, "tv", 2014)).toBe(false);
    expect(isSameTitle("Doctor Who 2005 S01", ["Doctor Who"], 1963, "tv", 1990)).toBe(false);
  });
  it("takes a subtitle of the series' own name when the release is dated within its run", () => {
    const arcane = ["Arcane", "Аркейн"];
    expect(isSameTitle("Arcane: League of Legends / S2E1-9 of 9 (Pascal Charrue) [2024, WEB-DL 1080p] Dub", arcane, 2021, "tv", 2025)).toBe(true);
    expect(isSameTitle("Arcane: League of Legends - S1E1-9 - 2021  DUB, Sub WEBDL 1080p - RUSSIAN", arcane, 2021, "tv", 2025)).toBe(true);
    expect(isSameTitle("Arcane League of Legends S01 1080p", arcane, 2021, "tv", 2025)).toBe(false);
  });
});

describe("T3: the original track in the profile's language is an audio option", () => {
  const oppenheimer = { title: "Оппенгеймер", originalTitle: "Oppenheimer", kind: "movie" as const, year: 2023, originalLanguage: "en" };
  it("plays English for an English profile, not the Russian dub", () => {
    const ranked = rankReleases([result("Оппенгеймер / Oppenheimer (2023) WEB-DL 1080p | D, P, A | Original Eng")], oppenheimer, prefs(["en"]));
    const pick = pickRelease(ranked, prefs(["en"]));
    expect(pick.option?.key).toBe("en|");
    expect(pick.chosen).toBe(ranked[0]);
  });
  it("leaves a Russian profile on its dubbing", () => {
    const ranked = rankReleases([result("Оппенгеймер / Oppenheimer (2023) WEB-DL 1080p | D, P, A | Original Eng")], oppenheimer, prefs(["ru"]));
    expect(pickRelease(ranked, prefs(["ru"])).option?.language).toBe("ru");
  });
});

describe("T4: a cinema recording is never recommended", () => {
  const fresh = { title: "Новинка", originalTitle: "Fresh Film", kind: "movie" as const, year: 2026, originalLanguage: "en" };
  it("picks nothing when only those were found", () => {
    const ranked = rankReleases([result("Новинка / Fresh Film (2026) CAMRip"), result("Fresh Film 2026 HDTS 1080p")], fresh, prefs(["ru"]));
    expect(ranked.length).toBe(2);
    expect(bestOf(ranked)).toBeUndefined();
    expect(pickRelease(ranked, prefs(["ru"])).chosen).toBeUndefined();
  });
});

describe("T5: a season's pack holds only its episodes", () => {
  it("knows episodes 1–8 of 10 lack the 9th", () => {
    const pack = packOf("Шоу / Show / Сезон: 2 / Серии: 1-8 из 10 [2026, WEB-DL 1080p]");
    expect(holdsSeason(pack, 2, 9)).toBe(false);
    expect(holdsSeason(pack, 2, 8)).toBe(true);
    expect(holdsSeason(packOf("Show S02E01-08 1080p"), 2, 9)).toBe(false);
    // A whole season (no episodes in the name) and an open range still might.
    expect(holdsSeason(packOf("Show Season 2 1080p"), 2, 9)).toBe(true);
  });
  it("puts the episode itself above the pack that lacks it", () => {
    const show = { title: "Шоу", originalTitle: "Show", kind: "tv" as const, year: 2025, originalLanguage: "en" };
    const pack = result("Шоу / Show / Сезон: 2 / Серии: 1-8 из 10 [2026, WEB-DL 1080p] MVO", 500);
    const single = result("Show S02E09 1080p WEB-DL", 5);
    const ranked = rankReleases([pack, single], show, prefs(["en", "ru"]), 2, 9);
    expect(ranked[0]?.result).toBe(single);
  });
});

describe("item 5: the short list folds releases a person can't tell apart", () => {
  const f1 = { title: "F1", originalTitle: "F1", kind: "movie" as const, year: 2025, originalLanguage: "en" };
  it("keeps one of each audio, picture and source, the first in the list's order", async () => {
    const { foldReleases } = await import("../src/lib/media/release-pick");
    const ranked = rankReleases(
      [
        result("F1 (2025) WEB-DL 1080p | Дубляж", 90),
        result("F1 / F1 (2025) WEB-DL 1080p | Дубляж", 40),
        result("F1 (2025) WEB-DL 1080p | Дубляж", 10),
        result("F1 (2025) WEB-DL 2160p | Дубляж", 30),
        result("F1 (2025) BDRip 1080p | Дубляж", 20),
        result("F1 (2025) WEB-DL 1080p | MVO (LostFilm)", 20),
      ],
      f1,
      prefs(["ru"]),
    );
    const folded = foldReleases(ranked);
    expect(folded.length).toBe(4);
    // The 1080p WEB-DL dubs with 40 and 10 seeders fold into the one with 90.
    expect(folded.map((x) => x.result.seeders).sort((a, b) => (b ?? 0) - (a ?? 0))).toEqual([90, 30, 20, 20]);
  });
});

describe("the profile's «Дубляж» is the dubbing option, not a studio's dub (owner, Бумажный дом)", () => {
  const show = { title: "Бумажный дом", originalTitle: "La casa de papel", kind: "tv" as const, year: 2017, originalLanguage: "es" };
  const name = (rest: string) => `Бумажный дом / La casa de papel / Сезон: 5 / Серии: 1-10 из 10 [2021, WEB-DL 2160p] ${rest}`;
  it("picks Дубляж, then LostFilm, over Пифагор that the profile doesn't list", () => {
    const p = { ...prefs(["ru"]), studios: ["Dub", "LostFilm"] };
    const ranked = rankReleases([result(name("Dub (Пифагор)"), 300), result(name("Dub"), 40), result(name("MVO (LostFilm)"), 90), result(name("MVO (TVShows)"), 20)], show, p, 5, 1);
    const pick = pickRelease(ranked, p);
    expect(pick.options.map((o) => o.studio ?? o.voice)).toEqual(["dub", expect.anything(), expect.anything(), expect.anything()]);
    expect(pick.option?.studio).toBeNull();
    expect(pick.option?.voice).toBe("dub");
  });
});

describe("720p and 1080p are not one HD (the owner, 2026-11-08)", () => {
  it("writes the resolution beside the HD mark, never beside 4K's", async () => {
    const { resolutionWord, resolutionBesideMarks } = await import("../src/components/sources/QualityBadges");
    expect([2160, 1080, 720, 480, null].map(resolutionWord)).toEqual([null, "1080p", "720p", "SD", null]);
    expect(["1080p", "720p", "4K", "2160p", "576p"].map(resolutionBesideMarks)).toEqual(["1080p", "720p", null, null, "576p"]);
  });
});
