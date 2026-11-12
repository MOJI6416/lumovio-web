import { describe, expect, it } from "vitest";
import {
  audioMatch,
  bestOf,
  copyFileTracks,
  creditsStudio,
  DUBBING,
  fileTracks,
  holdsSeason,
  endedIn,
  isSameTitle,
  sameTitleResults,
  packOf,
  parseRelease,
  pictureReasons,
  profileNameTrack,
  profileTrack,
  type ReleasePrefs,
  rankReleases,
  releaseDomId,
  torrentQuery,
  voiceOptions,
  voiceTrack,
  voiceWish,
  wishNameTrack,
  withFileTracks,
} from "../src/lib/media/releases";
import type { TsSearchResult } from "../src/lib/media/torrserver";

const device = { hevc: false, hdr: false, uhd: false, dolbyVision: false };
const prefsOf = (p: Partial<ReleasePrefs> & { hevc?: boolean }): ReleasePrefs => ({
  languages: p.languages ?? ["ru"],
  studios: p.studios ?? [],
  quality: p.quality ?? "auto",
  device: { ...device, ...(p.hevc !== undefined ? { hevc: p.hevc } : {}), ...p.device },
});

/**
 * The audio of "Dexter: Resurrection / S1E1-10 of 10 [2025, WEB-DL 1080p] 7 x MVO (HDrezka Studio, NewStudio, TVShows,
 * Novamedia, LostFilm, WStudio, LE-Production) + 2 x MVO Ukr + Original" as TorrServer's ffprobe read its first file
 * (on a real server): HDrezka Studio is the default, LostFilm the fifth, HDrezka again as its "18+" cut.
 */
const dexter = [
  { index: 1, title: "MVO [HDrezka Studio]", language: "rus", default: true },
  { index: 2, title: "MVO [NewStudio] 18+", language: "rus" },
  { index: 3, title: "MVO [TVShows]", language: "rus" },
  { index: 4, title: "MVO [Novamedia]", language: "rus" },
  { index: 5, title: "MVO [LostFilm]", language: "rus" },
  { index: 6, title: "MVO [HDrezka Studio] 18+", language: "rus" },
  { index: 7, title: "MVO [WStudio] 18+", language: "rus" },
  { index: 8, title: "MVO [LE-Production]", language: "rus" },
  { index: 9, title: "MVO [Sunnysiders]", language: "ukr" },
  { index: 10, title: "MVO [DniproFilm]", language: "ukr" },
  { index: 11, title: "Original", language: "eng" },
];

describe("parseRelease", () => {
  it("reads a RuTracker name: picture, dubbing first, Russian implied, original English, subtitles ignored", () => {
    const r = parseRelease(
      "Интерстеллар / Interstellar (Кристофер Нолан / Christopher Nolan) [2014, США, фантастика, драма, BDRip 1080p] Dub + MVO + AVO + Original Eng + Sub (Rus, Eng)",
      "RuTracker.org",
      "en",
    );
    expect(r).toMatchObject({ resolution: 1080, voice: "dub", cam: false, hevc: false });
    expect(r.languages.sort()).toEqual(["en", "ru"]);
  });

  it("reads single-letter translation lists only as a list", () => {
    const nnm = parseRelease("Интерстеллар / Interstellar (2014) UHD BDRemux 2160p | 4K | HDR | Dolby Vision | D, P, A | IMAX Edition", "NoNaMe-Club");
    expect(nnm).toMatchObject({ resolution: 2160, hdr: true, voice: "dub", languages: ["ru"] });
    expect(parseRelease("A Quiet Place (2018) BDRip 720p", "RuTor").voice).toBeNull();
    expect(parseRelease("Interstellar (2014) WEB-DL 1080p | P2", "RuTracker.org").voice).toBe("dvo");
  });

  it("reads Kinozal's Cyrillic abbreviations", () => {
    expect(parseRelease("Интерстеллар / Interstellar / 2014 / ДБ, ПМ, АП, СТ / BDRip (1080p)", "Kinozal")).toMatchObject({ voice: "dub", languages: ["ru"], resolution: 1080 });
  });

  it("takes a Ukrainian tracker's release as Ukrainian, and the audio list apart from the subtitles", () => {
    const r = parseRelease("Інтерстеллар / Interstellar (2014) Ukr/Eng | Sub Ukr/Eng [BDRip 1080p]", "Toloka");
    expect(r.languages.sort()).toEqual(["en", "uk"]);
  });

  it("does not call a Ukrainian dub on a Russian tracker Russian", () => {
    const r = parseRelease("Інтерстеллар / Interstellar (2014) BDRip 1080p | Dub (Ukr) + Original", "RuTracker.org", "en");
    expect(r.languages.sort()).toEqual(["en", "uk"]);
    expect(r.voice).toBe("dub");
  });

  it("flags cinema recordings, HEVC and HDR", () => {
    expect(parseRelease("Дюна: Часть вторая / Dune: Part Two (2024) CAMRip | Звук с TS", "RuTor").cam).toBe(true);
    const scene = parseRelease("Interstellar.2014.2160p.UHD.BluRay.x265.10bit.HDR.DTS-HD.MA.5.1-SWTYBLZ", "RuTor");
    expect(scene).toMatchObject({ resolution: 2160, hevc: true, hdr: true, voice: null, languages: [] });
  });

  it("takes a credited studio as a track in its language", () => {
    expect(parseRelease("Магическая битва / Jujutsu Kaisen [TV] [1-47 из 47] [2020, WEBRip 1080p] [AniLibria]", "AniLibria", "ja")).toMatchObject({ languages: ["ru"], studios: ["AniLibria"] });
    expect(parseRelease("Магічна битва / Jujutsu Kaisen [S01-02] 1080p | Amanogawa", null, "ja").languages).toEqual(["uk"]);
  });

  it("does not take subtitle languages for audio", () => {
    const r = parseRelease("Фрирен, провожающая в последний путь / Sousou no Frieren [TV] [1-28 из 28] [JAP+Sub Rus]", "AnimeLayer", "ja");
    expect(r.languages).toEqual(["ja"]);
  });
});

describe("isSameTitle", () => {
  const names = ["Interstellar", "Интерстеллар"];
  it("accepts the title in either language and in scene names", () => {
    expect(isSameTitle("Интерстеллар / Interstellar (2014) BDRip 1080p", names, 2014, "movie")).toBe(true);
    expect(isSameTitle("Interstellar.2014.1080p.BluRay.x264", names, 2014, "movie")).toBe(true);
  });
  it("rejects another film that contains the words, extras, and other years", () => {
    expect(isSameTitle("Наука Интерстеллара / The Science of Interstellar (2015)", names, 2014, "movie")).toBe(false);
    expect(isSameTitle("Interstellar (2014) OST", names, 2014, "movie")).toBe(false);
    expect(isSameTitle("Дюна: Часть вторая / Dune: Part Two (2024) WEB-DL", ["Dune", "Дюна"], 2021, "movie")).toBe(false);
    expect(isSameTitle("Дюна / Dune (2021) BDRip", ["Dune", "Дюна"], 2021, "movie")).toBe(true);
  });
  it("does not require a year for series", () => {
    expect(isSameTitle("Фрирен, провожающая в последний путь / Sousou no Frieren [TV] [1-28 из 28]", ["葬送のフリーレン", "Фрирен, провожающая в последний путь"], 2023, "tv")).toBe(true);
  });
  // From a real search: ten releases of the 2024 film passed as the 2024 series.
  it("does not take another title whose name goes on from a series' title (The Penguin Lessons for The Penguin)", () => {
    const penguin = ["The Penguin", "Пингвин"];
    for (const r of [
      "The Penguin Lessons 2024 DUB, MVO, Sub BDRip 1080p - RUSSIAN",
      "The Penguin Lessons [2024, WEB-DL-AVC] MVO (TVShows) + Sub Eng, Fra + Original Eng",
      "Школа мистера Пингвина / The Penguin Lessons (2024) WEB-DL [H.264/1080p] [MVO]",
      "The.Penguin.Lessons.2024.1080p.WEB-DL",
    ])
      expect(isSameTitle(r, penguin, 2024, "tv")).toBe(false);
    for (const r of [
      "The Penguin / S1E1-8 of 8 [2024, BDRip 1080p] 6 x MVO (HDRezka Studio, Syncmer, LostFilm)",
      "The Penguin (S1) (2024) WEB-DL 4K 2160p H.265 DV HDR 3xUkr/Eng | Sub Ukr/Eng (S1)",
      "The.Penguin.S01.1080p.WEB-DL",
      "The Penguin 2024 WEB-DL 1080p",
      "The Penguin WEB-DL 1080p MVO",
      "The Penguin Complete",
      "The Penguin. All seasons (2024) BDRip-AVC Ukr/Eng",
      "Пингвин (1 сезон: 1-8 серии из 8) / The Penguin / 2024 / ПМ (LostFilm) / WEB-DL (1080p)",
      "The Penguin LostFilm",
    ])
      expect(isSameTitle(r, penguin, 2024, "tv")).toBe(true);
    // A subtitle after a colon is the same series, as before; a film's own name is judged by its year, as before.
    expect(isSameTitle("Arcane: League of Legends / S2E1-9 of 9 [2024, WEB-DL 1080p]", ["Arcane", "Аркейн"], 2021, "tv")).toBe(true);
    expect(isSameTitle("The Penguin Lessons 2024 WEB-DL", ["The Penguin Lessons"], 2024, "movie")).toBe(true);
    expect(isSameTitle("House M.D. (S1-8) (2004-2012) BDRip 1080p", ["House", "Доктор Хаус"], 2004, "tv")).toBe(true);
  });
  // The same searches: titles that start alike, with seasons in the name too.
  it("does not take a longer title with seasons, a same-name film before the series, or a later show after it ended", () => {
    expect(isSameTitle("House of the Dragon / S3E1-8 of 8 [2026, WEB-DL 1080p]", ["House"], 2004, "tv", 2011)).toBe(false);
    expect(isSameTitle("Lost in Space (S1) (2018) WEB-DL 1080p", ["Lost"], 2004, "tv", 2010)).toBe(false);
    expect(isSameTitle("Lost - S5 - rus 720p HDTV (LostFilm)", ["Lost"], 2004, "tv", 2010)).toBe(true);
    expect(isSameTitle("Fargo [1996, UHD BDRemux 2160p, HDR10, Dolby Vision]", ["Fargo"], 2014, "tv", 2023)).toBe(false);
    expect(isSameTitle("Fargo - S1-5E1-51 - 2014-2024  MVO (LostFilm) WEBDL 1080p - RUSSIAN", ["Fargo"], 2014, "tv", 2023)).toBe(true);
    expect(isSameTitle("Сёгун / Shogun  / S1E1-3 of 3 (1980) BDRip [H.264/1080p]", ["Shōgun", "Сёгун"], 2024, "tv")).toBe(false);
    expect(isSameTitle("Dexter: New Blood / S1E1-10 of 10 [2021, WEB-DL 1080p]", ["Dexter"], 2006, "tv", 2013)).toBe(false);
    expect(isSameTitle("Dexter / S1E1-96 of 96 [2006-2013, WEB-DL 1080p]", ["Dexter"], 2006, "tv", 2013)).toBe(true);
    // A series going on has no end: its new seasons are dated after the last one TMDB knows.
    expect(isSameTitle("The Boys - S5E1-8 - 2026  DUB, Sub WEBDL 1080p - RUSSIAN", ["The Boys"], 2019, "tv")).toBe(true);
    // A frame size is no year.
    expect(isSameTitle("Fargo - S2 - 1920x1080 WEBDL", ["Fargo"], 2014, "tv", 2023)).toBe(true);
  });
  it("knows a later show in its undated names once its dated ones told it, and keeps a subtitle dated within the series", () => {
    const dexter = { title: "Декстер", originalTitle: "Dexter", kind: "tv" as const, year: 2006, status: "Ended", seasons: [{ seasonNumber: 1, airDate: "2006-10-01" }, { seasonNumber: 8, airDate: "2013-06-30" }] } as const;
    const kept = sameTitleResults(
      ["Dexter: New Blood / S1E1-10 of 10 [2021, WEB-DL 1080p]", "Dexter: New Blood - S1 - rus 1080p WEBDL (LostFilm)", "Dexter - S1 - rus 720p WEBDL (LostFilm)", "Dexter / S1E1-12 of 12 [2006, BDRemux 1080p]"].map((title) => ({ title })),
      { ...dexter, seasons: [...dexter.seasons] },
    ).map((r) => r.title);
    expect(kept).toEqual(["Dexter - S1 - rus 720p WEBDL (LostFilm)", "Dexter / S1E1-12 of 12 [2006, BDRemux 1080p]"]);
    const arcane = sameTitleResults(
      ["Arcane: League of Legends / S2E1-9 of 9 [2024, WEB-DL 1080p]", "Arcane: League of Legends - S2 - rus 1080p WEBDL (LostFilm)"].map((title) => ({ title })),
      { title: "Аркейн", originalTitle: "Arcane", kind: "tv", year: 2021, status: "Ended", seasons: [{ seasonNumber: 1, airDate: "2021-11-06" }, { seasonNumber: 2, airDate: "2024-11-09" }] as never },
    );
    expect(arcane).toHaveLength(2);
    expect(endedIn({ kind: "tv", status: "Returning Series", seasons: [{ seasonNumber: 1, airDate: "2019-07-26" }] })).toBeNull();
  });
});

describe("torrentQuery", () => {
  it("uses the original title and a film's year, or the localized title for another script", () => {
    expect(torrentQuery({ title: "Интерстеллар", originalTitle: "Interstellar", kind: "movie", year: 2014 })).toBe("Interstellar 2014");
    expect(torrentQuery({ title: "Фрирен, провожающая в последний путь", originalTitle: "葬送のフリーレン", kind: "tv", year: 2023 })).toBe("Фрирен, провожающая в последний путь");
  });
});

describe("the profile's order of studios: 1 — LostFilm, 2 — HDRezka (Dexter: Resurrection)", () => {
  const show = { title: "Декстер: Воскрешение", originalTitle: "Dexter: Resurrection", kind: "tv" as const, year: 2025, originalLanguage: "en" };
  const r = (title: string, seeders: number | null = 20, tracker: string | null = "RuTracker.org", size: number | null = null): TsSearchResult => ({
    title,
    link: `magnet:?xt=urn:btih:${title.length}${seeders}${tracker}`,
    hash: null,
    size,
    seeders,
    peers: null,
    tracker,
    published: null,
  });
  const order = prefsOf({ studios: ["LostFilm", "HDrezka Studio"], hevc: true });

  it("reads both studios as trackers write them, each a Russian track of its own", () => {
    for (const [name, tracker] of [
      ["Dexter: Resurrection - S1 - rus 1080p WEBDL (LostFilm)", "LostFilm.tv"],
      ["Dexter.Resurrection.S01E01.1080p.rus.LostFilm.TV.mkv", null],
      ["Декстер: Воскрешение / Dexter: Resurrection / S1E1-10 of 10 (2025) WEB-DL  LostFilm", "NoNaMe ClubL"],
      ["Dexter: Resurrection - S1E1-10 - 2025  MVO (Lostfilm) WEBDL 1080p - RUSSIAN", "Kinozal"],
    ] as const)
      expect(parseRelease(name, tracker, "en").tracks.filter((t) => t.studio === "LostFilm").map((t) => t.language), name).toEqual(["ru"]);
    for (const name of ["Dexter: Resurrection / S2E1 of 10 [2026, WEB-DL 1080p] MVO (HDRezka Studio) + Original", "S2E1 [2026] MVO (HDrezka) + Original", "(S2E1- из 10) HDrezka (обновляемая)", "P (Rezka)"])
      expect(parseRelease(name, "RuTracker.org", "en").studios, name).toEqual(["HDrezka Studio"]);
    const both = parseRelease("Dexter: Resurrection / S1E1-10 of 10 [2025, WEB-DL 1080p] MVO (LostFilm, HDRezka) + Original", "RuTracker.org", "en");
    expect(both.tracks.filter((t) => !t.original).map((t) => [t.voice, t.studio, t.language])).toEqual([
      ["mvo", "LostFilm", "ru"],
      ["mvo", "HDrezka Studio", "ru"],
    ]);
    // A release listing HDRezka first is still the profile's first studio's.
    const many = rankReleases([r("Dexter: Resurrection / S1E1-10 of 10 [2025, WEB-DL 1080p] 7 x MVO (HDrezka Studio, NewStudio, TVShows, Novamedia, LostFilm, WStudio, LE-Production) + 2 x MVO Ukr + Original")], show, order);
    expect(many[0]!.studio).toBe("LostFilm");
  });

  it("puts the first studio above the second, and a release with both counts as the first's", () => {
    const ranked = rankReleases(
      [
        r("Dexter: Resurrection / S2E1 of 10 [2026, WEB-DL 1080p] MVO (HDRezka Studio) + Original", 300),
        r("Dexter: Resurrection / S2E1 of 10 [2026, WEB-DL 1080p] MVO (LostFilm) + Original", 5),
        r("Dexter: Resurrection / S2E1 of 10 [2026, WEB-DL 1080p] MVO (NewStudio) + Original", 900),
      ],
      show,
      order,
    );
    expect(ranked.map((x) => x.studio)).toEqual(["LostFilm", "HDrezka Studio", null]);
    expect(rankReleases(ranked.map((x) => x.result).reverse(), show, prefsOf({ studios: ["HDrezka Studio", "LostFilm"] })).map((x) => x.studio)).toEqual(["HDrezka Studio", "LostFilm", null]);
  });

  it("tells a studio's releases apart by the picture, not by the kind its name writes or leaves out", () => {
    const ranked = rankReleases(
      [r("Dexter: Resurrection / S2E1 of 10 [2026, WEB-DL 720p] MVO (LostFilm) + Original"), r("Dexter: Resurrection - S2E1 - Risky Business - rus 1080p WEBDL (LostFilm)", 20, "LostFilm.tv")],
      show,
      order,
      2,
    );
    expect(ranked[0]!.info.resolution).toBe(1080);
    expect(ranked[0]!.result.tracker).toBe("LostFilm.tv");
  });

  it("holds the order at any comparable picture: a 1080p LostFilm beats a 4K HDRezka, an SD one loses to a 720p", () => {
    const uhd = r("Dexter: Resurrection / S1E1-10 of 10 [2025, HDR10, WEB-DL 2160p] MVO (HDRezka Studio) + Original", 200);
    const fhd = r("Dexter: Resurrection / S1E1-10 of 10 [2025, WEB-DL 1080p] MVO (LostFilm) + Original", 10);
    expect(rankReleases([uhd, fhd], show, prefsOf({ studios: ["LostFilm", "HDrezka Studio"], hevc: true, device: { hevc: true, hdr: true, uhd: true, dolbyVision: false } }))[0]!.result).toBe(fhd);
    const sd = r("Dexter: Resurrection / S1E1-10 of 10 [2025, WEBRip] MVO (LostFilm) + Original", 50);
    const unstated = r("Dexter: Resurrection / S1E1-10 of 10 [2025, WEB-DL] MVO (LostFilm) + Original", 50);
    const hd = r("Dexter: Resurrection / S1E1-10 of 10 [2025, WEB-DL 720p] MVO (HDRezka Studio) + Original", 5);
    expect(rankReleases([sd, unstated, hd], show, order)[0]!.result).toBe(hd);
    expect(rankReleases([sd, hd], show, order).map((x) => [x.studio, x.floor])).toEqual([
      ["HDrezka Studio", 2],
      ["LostFilm", 1],
    ]);
    // "Smaller file" asks for no quality: the order alone decides.
    expect(rankReleases([sd, hd], show, prefsOf({ studios: ["LostFilm", "HDrezka Studio"], quality: "small" }))[0]!.studio).toBe("LostFilm");
  });
});

describe("rankReleases", () => {
  const r = (title: string, seeders: number | null, tracker = "RuTracker.org"): TsSearchResult => ({ title, link: `magnet:?xt=urn:btih:${title.length}${seeders}`, hash: null, size: null, seeders, peers: null, tracker, published: null });
  const film = { title: "Интерстеллар", originalTitle: "Interstellar", kind: "movie" as const, year: 2014, originalLanguage: "en" };

  it("puts the profile's first language first, then translation, playable picture and seeders; dead ones last, other titles out", () => {
    const ranked = rankReleases(
      [
        r("Интерстеллар / Interstellar (2014) BDRip 1080p | Dub + Original", 100),
        r("Інтерстеллар / Interstellar (2014) [BDRip 1080p] Ukr", 10, "Toloka"),
        r("Интерстеллар / Interstellar (2014) UHD BDRemux 2160p HEVC | D", 300),
        r("Интерстеллар / Interstellar (2014) CAMRip | D", 500),
        r("Інтерстеллар / Interstellar (2014) WEB-DL 720p Ukr", 0, "Toloka"),
        r("Наука Интерстеллара / The Science of Interstellar (2015) | D", 50),
      ],
      film,
      prefsOf({ languages: ["uk", "ru"], hevc: false }),
    );
    expect(ranked.map((x) => [x.result.seeders, x.language])).toEqual([
      [10, "uk"],
      [100, "ru"],
      [300, "ru"],
      [500, "ru"],
      [0, "uk"],
    ]);
    expect(ranked.at(-1)!.dead).toBe(true);
    expect(bestOf(ranked)!.result.seeders).toBe(10);
  });

  it("puts a preferred studio above an unnamed dub, but not above a language the profile prefers more", () => {
    const show = { title: "Медленные лошади", originalTitle: "Slow Horses", kind: "tv" as const, year: 2022, originalLanguage: "en" };
    const results = [
      r("Медленные лошади / Slow Horses [S01] (2022) WEB-DL 1080p | Dub", 200),
      r("Медленные лошади / Slow Horses [S01] (2022) WEB-DL 1080p | MVO (LostFilm)", 20, "LostFilm"),
      r("Повільні коні / Slow Horses [S01] (2022) WEB-DL 1080p | Ukr", 5, "Toloka"),
    ];
    const ru = rankReleases(results, show, prefsOf({ languages: ["ru"], studios: ["LostFilm"], hevc: true }));
    expect(ru[0]!.studio).toBe("LostFilm");
    expect(ru[0]!.info.studios).toEqual(["LostFilm"]);
    const uk = rankReleases(results, show, prefsOf({ languages: ["uk", "ru"], studios: ["LostFilm"], hevc: true }));
    expect(uk.map((x) => x.language)).toEqual(["uk", "ru", "ru"]);
    expect(uk[1]!.studio).toBe("LostFilm");
  });
});

describe("creditsStudio", () => {
  it("knows trackers' spellings and matches any other studio as written", () => {
    expect(creditsStudio("Слово пацана (2023) WEB-DL 1080p | P (HDRezka)", "HDrezka Studio")).toBe(true);
    expect(creditsStudio("Інтерстеллар (2014) | Dub (1+1)", "1+1")).toBe(true);
    expect(creditsStudio("Show S01 | MVO (Ozz)", "Ozz")).toBe(true);
    expect(creditsStudio("Нарезка лучших моментов", "HDrezka Studio")).toBe(false);
  });
});

describe("voiceOptions", () => {
  const r = (title: string, seeders: number, tracker = "RuTracker.org"): TsSearchResult => ({ title, link: `magnet:?xt=urn:btih:${title.length}${seeders}`, hash: null, size: null, seeders, peers: null, tracker, published: null });
  const film = { title: "Дюна", originalTitle: "Dune", kind: "movie" as const, year: 2021, originalLanguage: "en" };
  it("offers each credited studio once, then unnamed translations, best release first; no cinema recordings", () => {
    const ranked = rankReleases(
      [
        r("Дюна / Dune [2021, BDRip 1080p] Dub (Пифагор) + MVO (HDrezka Studio) + Original Eng", 312),
        r("Дюна / Dune (2021) UHD BDRemux 2160p | D | Лицензия", 154, "NoNaMe-Club"),
        r("Дюна / Dune / 2021 / ПМ (LostFilm), СТ / WEB-DL (1080p)", 88, "Kinozal"),
        r("Дюна / Dune (2021) WEB-DL 720p | MVO (HDrezka)", 30),
        r("Дюна / Dune (2021) CAMRip | Звук с TS", 500),
      ],
      film,
      prefsOf({ languages: ["ru"], studios: ["LostFilm"], hevc: false }),
    );
    const options = voiceOptions(ranked);
    // In each release's own order: Пифагор's dub is listed before HDrezka's voice-over.
    expect(options.map((o) => o.studio ?? o.voice)).toEqual(["LostFilm", "Пифагор", "HDrezka Studio", "dub"]);
    expect(options.find((o) => o.studio === "HDrezka Studio")!.best.result.seeders).toBe(312);
  });
});

describe("picture versions and quality modes", () => {
  const GB = 1024 ** 3;
  const r = (title: string, seeders: number | null, size: number | null = null, tracker = "RuTracker.org"): TsSearchResult => ({
    title,
    link: `magnet:?xt=urn:btih:${title.length}-${seeders}-${size}`,
    hash: null,
    size,
    seeders,
    peers: null,
    tracker,
    published: null,
  });
  const film = { title: "Дюна", originalTitle: "Dune", kind: "movie" as const, year: 2021, originalLanguage: "en" };
  const hdrezka = [
    r("Дюна / Dune (2021) WEB-DL 1080p | MVO (HDrezka Studio)", 100, 8 * GB),
    r("Дюна / Dune (2021) WEB-DL 2160p | HEVC | SDR | MVO (HDrezka Studio)", 10, 22 * GB),
    r("Дюна / Dune (2021) UHD BDRemux 2160p | HEVC | HDR10 | Dolby Vision | MVO (HDrezka Studio)", 6, 61 * GB),
  ];

  it("reads HDR formats, source and codec, and says nothing it doesn't know", () => {
    expect(parseRelease("Dune (2021) UHD BDRemux 2160p | HDR10+ | Dolby Vision | HEVC", null)).toMatchObject({ hdrFormats: ["hdr10+", "dv"], source: "remux", codec: "hevc", sdr: false });
    expect(parseRelease("Dune.2021.2160p.WEB-DL.DDP5.1.HDR.H.265", null)).toMatchObject({ hdrFormats: ["hdr"], source: "webdl", codec: "hevc" });
    expect(parseRelease("Dune.2021.2160p.WEB-DL.SDR.x264", null)).toMatchObject({ hdrFormats: [], sdr: true, codec: "avc" });
    expect(parseRelease("Дюна / Dune (2021) BDRip 1080p", null)).toMatchObject({ hdrFormats: [], sdr: false, source: "bluray", codec: null });
    expect(parseRelease("Dune (2021) WEB-DLRip 720p", null).source).toBe("webrip");
  });

  it("reads Dolby Atmos only as a word of its own or DD+ Atmos's short form", () => {
    expect(parseRelease("Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.DV.HDR10.HEVC.TrueHD.7.1.Atmos", null).atmos).toBe(true);
    expect(parseRelease("Dune.Part.Two.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.H.265", null).atmos).toBe(true);
    expect(parseRelease("Dune.Part.Two.2024.1080p.AMZN.WEB-DL.DDPA5.1.H.264", null).atmos).toBe(true);
    expect(parseRelease("Дюна 2 / Dune: Part Two (2024) UHD BDRemux 2160p | Dolby Atmos | D, P", "RuTracker.org").atmos).toBe(true);
    expect(parseRelease("Atmosphere.2019.1080p.WEB-DL.DDP5.1.H.264", null).atmos).toBe(false);
    expect(parseRelease("Dune.2021.2160p.WEB-DL.DDP5.1.HDR.H.265", null).atmos).toBe(false);
  });

  it("reads subtitles that can be turned on, in the trackers' spellings, never burnt-in ones or a title's word", () => {
    expect(parseRelease("Интерстеллар / Interstellar (2014) BDRip 1080p | Dub + Original Eng + Sub (Rus, Eng)", "RuTracker.org").subtitles).toBe(true);
    expect(parseRelease("Dune.2021.1080p.BluRay.x264 Eng Subs", null).subtitles).toBe(true);
    expect(parseRelease("Дюна (2021) WEB-DL 1080p | Субтитры: укр, англ", "Toloka.to").subtitles).toBe(true);
    expect(parseRelease("Frieren [TV-1] [1080p] [SUB]", null).subtitles).toBe(true);
    expect(parseRelease("Oppenheimer.2023.2160p.UHD.BluRay.REMUX.HDR.HEVC.Atmos-SDH", null).subtitles).toBe(true);
    expect(parseRelease("Naruto [Hardsub] 720p", null).subtitles).toBe(false);
    expect(parseRelease("Subway Surfers (2012) 1080p", null).subtitles).toBe(false);
    expect(parseRelease("Дюна / Dune (2021) BDRip 1080p | D, P, A", "RuTracker.org").subtitles).toBe(false);
  });

  it("keeps every quality of one studio: 1080p, 4K SDR and 4K HDR are versions, not one release", () => {
    const options = voiceOptions(rankReleases(hdrezka, film, prefsOf({ hevc: true })));
    expect(options).toHaveLength(1);
    expect(options[0]!.versions.map((v) => [v.key, v.count])).toEqual([
      ["1080", 1],
      ["2160-sdr", 1],
      ["2160-hdr", 1],
    ]);
  });

  it("'best' takes a playable 4K over a 1080p with ten times the seeders", () => {
    const ranked = rankReleases(hdrezka.slice(0, 2), film, prefsOf({ hevc: true, quality: "best" }));
    expect(ranked[0]!.info.resolution).toBe(2160);
    expect(pictureReasons(ranked[0]!, ranked, prefsOf({ hevc: true, quality: "best" }))).toEqual(["best"]);
  });

  it("'auto' explains itself: 1080p on a screen without 4K, 4K where screen and decoder have it", () => {
    const fhd = prefsOf({ hevc: true });
    const onFhd = rankReleases(hdrezka.slice(0, 2), film, fhd);
    expect(onFhd[0]!.info.resolution).toBe(1080);
    expect(pictureReasons(onFhd[0]!, onFhd, fhd)).toEqual(["noUhdScreen"]);
    const uhd = prefsOf({ device: { hevc: true, hdr: false, uhd: true, dolbyVision: false } });
    const onUhd = rankReleases(hdrezka.slice(0, 2), film, uhd);
    expect(onUhd[0]!.info.resolution).toBe(2160);
    expect(pictureReasons(onUhd[0]!, onUhd, uhd)).toEqual(["uhdHere"]);
    const noHevc = prefsOf({ device: { hevc: false, hdr: false, uhd: true, dolbyVision: false } });
    const without = rankReleases(hdrezka.slice(0, 2), film, noHevc);
    expect(without[0]!.info.resolution).toBe(1080);
    expect(without[1]!.fit).toBe("poor");
    expect(pictureReasons(without[0]!, without, noHevc)).toEqual(["noHevc"]);
  });

  it("'auto' keeps 1080p first where the browser says 4K HEVC stutters, and says so; unknown changes nothing", () => {
    const stutters = prefsOf({ device: { hevc: true, hdr: false, uhd: true, dolbyVision: false, uhdSmooth: false } });
    const ranked = rankReleases(hdrezka.slice(0, 2), film, stutters);
    expect(ranked[0]!.info.resolution).toBe(1080);
    expect(ranked[1]!.fit).toBe("ok");
    expect(pictureReasons(ranked[0]!, ranked, stutters)).toEqual(["uhdNotSmooth"]);
    // "Best" still takes 4K: the person asked for it.
    expect(rankReleases(hdrezka.slice(0, 2), film, { ...stutters, quality: "best" })[0]!.info.resolution).toBe(2160);
    for (const uhdSmooth of [true, null]) {
      const p = prefsOf({ device: { hevc: true, hdr: false, uhd: true, dolbyVision: false, uhdSmooth } });
      const first = rankReleases(hdrezka.slice(0, 2), film, p)[0]!;
      expect(first.info.resolution).toBe(2160);
      expect(pictureReasons(first, rankReleases(hdrezka.slice(0, 2), film, p), p)).toEqual(["uhdHere"]);
    }
  });

  it("gives HDR no bonus on an SDR screen, and the HDR version on an HDR one", () => {
    const four = hdrezka.slice(1);
    const sdr = prefsOf({ device: { hevc: true, hdr: false, uhd: true, dolbyVision: false } });
    const onSdr = rankReleases(four, film, sdr);
    expect(onSdr[0]!.picture).toBe("2160-sdr");
    expect(pictureReasons(onSdr[0]!, onSdr, sdr)).toEqual(["uhdHere", "sdrScreen"]);
    const hdr = prefsOf({ device: { hevc: true, hdr: true, uhd: true, dolbyVision: false } });
    expect(rankReleases(four, film, hdr)[0]!.picture).toBe("2160-hdr");
  });

  it("marks Dolby Vision alone as poor where it can't decode, and never prefers it there", () => {
    const dv = r("Dune.2021.2160p.WEB-DL.DV.HEVC | MVO (HDrezka Studio)", 300, 18 * GB);
    const hdr = prefsOf({ device: { hevc: true, hdr: true, uhd: true, dolbyVision: false } });
    const ranked = rankReleases([dv, hdrezka[2]!], film, hdr);
    expect(ranked.map((x) => [x.picture, x.fit])).toEqual([
      ["2160-hdr", "ok"],
      ["2160-dv", "poor"],
    ]);
  });

  it("'small' takes the smallest known size; unknown sizes come last", () => {
    const small = prefsOf({ hevc: true, quality: "small" });
    const ranked = rankReleases([...hdrezka, r("Дюна / Dune (2021) WEB-DL 720p | MVO (HDrezka Studio)", 50, null)], film, small);
    expect(ranked.map((x) => x.result.size)).toEqual([8 * GB, 22 * GB, 61 * GB, null]);
    expect(pictureReasons(ranked[0]!, ranked, small)).toEqual(["smallest"]);
  });

  it("calls a release 'your dubbing' only for the profile's studio, 'your language' for a language alone", () => {
    const ranked = rankReleases(
      [r("Дюна / Dune (2021) WEB-DL 1080p | MVO (LostFilm)", 20), r("Дюна / Dune (2021) WEB-DL 1080p | Dub", 200)],
      film,
      prefsOf({ studios: ["LostFilm"] }),
    );
    expect(audioMatch(ranked[0]!)).toEqual({ kind: "studio", studio: "LostFilm" });
    expect(audioMatch(ranked[1]!)).toEqual({ kind: "language", language: "ru" });
    // Without studios in the profile a language match stays a language match.
    expect(audioMatch(rankReleases([r("Дюна / Dune (2021) WEB-DL 1080p | MVO (LostFilm)", 20)], film, prefsOf({}))[0]!)).toEqual({ kind: "language", language: "ru" });
  });

  it("keeps releases without seeders listed but never recommends them; unknown seeders are not zero", () => {
    const ranked = rankReleases([r("Дюна / Dune (2021) WEB-DL 2160p | MVO (HDrezka Studio)", 0), r("Дюна / Dune (2021) WEB-DL 1080p | Dub", null)], film, prefsOf({ quality: "best", hevc: true }));
    expect(ranked.map((x) => x.dead)).toEqual([false, true]);
    expect(bestOf(ranked)!.result.seeders).toBeNull();
    expect(voiceOptions(ranked).map((o) => o.key)).toEqual(["ru|dub"]);
    expect(bestOf(rankReleases([r("Дюна / Dune (2021) WEB-DL 1080p | Dub", 0)], film, prefsOf({})))).toBeUndefined();
  });

  it("offers releases that name no translation as an option of their language", () => {
    const ranked = rankReleases([r("Дюна / Dune (2021) [BDRip 1080p] Ukr", 10, null, "Toloka"), r("Dune.2021.1080p.BluRay.x264", 40, null, "RuTor")], film, prefsOf({ languages: ["uk"] }));
    expect(voiceOptions(ranked).map((o) => o.key)).toEqual(["uk|", "|"]);
  });
});

describe("the chosen dubbing's track", () => {
  const tracks = [
    { index: 1, title: "Dub (Пифагор)", language: "rus" },
    { index: 2, title: "MVO (HDrezka Studio)", language: "rus" },
    { index: 3, title: "Original", language: "eng" },
  ];
  it("reads an option key into a studio and language; a kind of translation has no studio", () => {
    expect(voiceWish("ru|HDrezka Studio")).toEqual({ studio: "HDrezka Studio", language: "ru" });
    expect(voiceWish("ru|dub")).toEqual({ studio: null, language: "ru", dub: true });
    expect(voiceWish("|")).toEqual({ studio: null, language: null });
    expect(voiceWish(null)).toBeNull();
  });
  it("finds the one track crediting the studio, by trackers' spellings too", () => {
    expect(voiceTrack(tracks, { studio: "HDrezka Studio", language: "ru" })).toBe(2);
    expect(voiceTrack([{ index: 4, title: "P (HDRezka)", language: null }, ...tracks.slice(0, 1)], { studio: "HDrezka Studio", language: null })).toBe(4);
    expect(voiceTrack(tracks, { studio: "Пифагор", language: "ru" })).toBe(1);
  });
  it("guesses nothing when no track credits it; a single track is that track", () => {
    expect(voiceTrack(tracks, { studio: "LostFilm", language: "ru" })).toBeNull();
    expect(voiceTrack([{ index: 1, title: null, language: "rus" }, { index: 2, title: null, language: "rus" }], { studio: "LostFilm", language: "ru" })).toBeNull();
    expect(voiceTrack([{ index: 1, title: "LostFilm", language: "rus" }, { index: 2, title: "LostFilm", language: "ukr" }], { studio: "LostFilm", language: "uk" })).toBe(2);
    expect(voiceTrack([{ index: 1, title: null, language: null }], { studio: "LostFilm", language: "ru" })).toBe(1);
  });
  it("takes several tracks of one studio in one language as its versions ('18+'): the default among them, else the first", () => {
    expect(voiceTrack([{ index: 1, title: "LostFilm", language: "rus" }, { index: 2, title: "LostFilm", language: "rus" }], { studio: "LostFilm", language: "ru" })).toBe(1);
    expect(voiceTrack(dexter, { studio: "HDrezka Studio", language: "ru" })).toBe(1);
    expect(voiceTrack(dexter.map((t) => ({ ...t, default: t.index === 6 })), { studio: "HDrezka Studio", language: "ru" })).toBe(6);
    expect(voiceTrack(dexter, { studio: "LostFilm", language: "ru" })).toBe(5);
  });
  it("finds a studio on a file whose tracks credit none (LostFilm's own: 'RUS', 'ENG') by the wished language", () => {
    const own = [
      { index: 1, title: "RUS", language: null, default: true },
      { index: 2, title: "ENG", language: null },
    ];
    expect(voiceTrack(own, { studio: "LostFilm", language: "ru" })).toBe(1);
    expect(voiceTrack(own, { studio: "LostFilm", language: "uk" })).toBeNull();
    // A file that credits other studios says nothing of one it doesn't credit.
    expect(voiceTrack([{ index: 1, title: "MVO [NewStudio]", language: "rus" }, ...own.slice(1)], { studio: "LostFilm", language: "ru" })).toBeNull();
  });
});

describe("each studio's own kind of translation", () => {
  it("pairs a kind with the studio it stands before, and leaves an unpaired studio without one", () => {
    const multi = parseRelease("Дюна / Dune [2021, BDRip 1080p] Dub (Пифагор) + MVO (HDrezka Studio) + Original Eng", "RuTracker.org", "en");
    expect(multi.voice).toBe("dub");
    expect(multi.studioVoices).toEqual({ Пифагор: "dub", "HDrezka Studio": "mvo" });
    expect(parseRelease("Дюна / Dune / 2021 / ПМ (LostFilm), СТ / WEB-DL (1080p)", "Kinozal").studioVoices).toEqual({ LostFilm: "mvo" });
    expect(parseRelease("Слово пацана (2023) WEB-DL 1080p | P (HDRezka)", "RuTracker.org").studioVoices).toEqual({ "HDrezka Studio": "mvo" });
    expect(parseRelease("Дюна (2021) BDRip 1080p Ukr/Eng | Дубляж Le Doyen", "Toloka").studioVoices).toEqual({});
  });
  it("never gives one studio another's kind", () => {
    const film = { title: "Дюна", originalTitle: "Dune", kind: "movie" as const, year: 2021, originalLanguage: "en" };
    const r = (title: string): TsSearchResult => ({ title, link: `magnet:?xt=urn:btih:${title.length}`, hash: null, size: null, seeders: 10, peers: null, tracker: "RuTracker.org", published: null });
    const options = voiceOptions(rankReleases([r("Дюна / Dune (2021) BDRip 1080p | Dub (Пифагор) + MVO (HDrezka Studio)")], film, prefsOf({})));
    expect(options.map((o) => [o.studio, o.voice])).toEqual([
      ["Пифагор", "dub"],
      ["HDrezka Studio", "mvo"],
    ]);
    // Nothing links the dub to either studio: an unnamed dub, and the two studios without a kind.
    const unpaired = voiceOptions(rankReleases([r("Дюна / Dune (2021) BDRip 1080p | Dub | LostFilm, HDrezka")], film, prefsOf({})));
    expect(unpaired.map((o) => [o.studio, o.voice])).toEqual([
      [null, "dub"],
      ["LostFilm", null],
      ["HDrezka Studio", null],
    ]);
  });
});

describe("season packs by the name", () => {
  it("reads seasons, episode ranges and totals as trackers write them, and nothing that isn't there", () => {
    expect(packOf("Во все тяжкие / Breaking Bad / Сезон: 2 / Серии: 1-13 из 13 [2009, WEB-DL 1080p]")).toEqual({ seasons: { from: 2, to: 2 }, cours: false, episodes: { from: 1, to: 13, of: 13 } });
    expect(packOf("Breaking.Bad.S01-S05.Complete.1080p")).toEqual({ seasons: { from: 1, to: 5 }, cours: false, episodes: null });
    expect(packOf("Arcane S02E01-09 2160p")).toEqual({ seasons: { from: 2, to: 2 }, cours: false, episodes: { from: 1, to: 9, of: null, bySeason: true } });
    expect(packOf("Arcane.S02E03.1080p.WEB-DL")).toEqual({ seasons: { from: 2, to: 2 }, cours: false, episodes: { from: 3, to: 3, of: null, bySeason: true } });
    expect(packOf("Сёгун / Shogun [1-3 сезоны] WEB-DL 1080p")).toEqual({ seasons: { from: 1, to: 3 }, cours: false, episodes: null });
    expect(packOf("Магічна битва / Jujutsu Kaisen [S01-02] 1080p Ukr | Amanogawa").seasons).toEqual({ from: 1, to: 2 });
    // Anime cours are not TMDB's seasons; episode numbers run across them.
    expect(packOf("Магическая битва / Jujutsu Kaisen [TV-1,2] [1-47 из 47] WEB-DL 1080p")).toEqual({ seasons: { from: 1, to: 2 }, cours: true, episodes: { from: 1, to: 47, of: 47 } });
    expect(packOf("Серии 1-8 из XX").episodes).toEqual({ from: 1, to: 8, of: null });
    expect(packOf("Дюна / Dune (2021) HDTV 1080p | DTS 5.1 | 2021-2024")).toEqual({ seasons: null, cours: false, episodes: null });
    expect(packOf("TVShows | 1080p").seasons).toBeNull();
  });

  it("reads a whole series' pack as its seasons, and the total after an S…E range (numbering leftovers)", () => {
    // Before: "S1-8E1-73" was season 1 alone, so the release was sunk as "other seasons" for season 2 and on.
    expect(packOf("Бумажный дом / La Casa de Papel / S1-8E1-73 [2017-2021, WEB-DL 1080p] MVO (LostFilm)")).toEqual({
      seasons: { from: 1, to: 8 },
      cours: false,
      episodes: { from: 1, to: 73, of: null, bySeason: true },
    });
    expect(packOf("Lost.S01E01-S06E18.1080p.BluRay")).toEqual({ seasons: { from: 1, to: 6 }, cours: false, episodes: { from: 1, to: 18, of: null, bySeason: true } });
    expect(packOf("Show S01-S03E01-E36 of 36 WEB-DL").episodes).toEqual({ from: 1, to: 36, of: 36, bySeason: true });
    expect(holdsSeason(packOf("La Casa de Papel S1-8E1-73"), 5)).toBe(true);
    // "of 10" right after the range: the season's length (it was read only without an S…E mark).
    expect(packOf("La casa de papel / Money Heist / S5E1-5 of 10 [2021, HDR, WEBRip 2160p]")).toEqual({
      seasons: { from: 5, to: 5 },
      cours: false,
      episodes: { from: 1, to: 5, of: 10, bySeason: true },
    });
    expect(packOf("Сёгун / Shogun / S01E01-08 из 10 [2024]").episodes).toEqual({ from: 1, to: 8, of: 10, bySeason: true });
    expect(packOf("Arcane.S02E03.of.9.1080p").episodes).toEqual({ from: 3, to: 3, of: 9, bySeason: true });
    // A number later in the name isn't a total.
    expect(packOf("Arcane S02E01-09 2160p 10bit").episodes).toEqual({ from: 1, to: 9, of: null, bySeason: true });
  });

  it("says a pack lacks a season only when it names other seasons, never for anime cours or episode numbers", () => {
    expect(holdsSeason(packOf("Breaking.Bad.S03.1080p"), 1)).toBe(false);
    expect(holdsSeason(packOf("Breaking.Bad.S01-S05"), 3)).toBe(true);
    expect(holdsSeason(packOf("Jujutsu Kaisen [TV-2] [25-47 из 47]"), 1)).toBeNull();
    expect(holdsSeason(packOf("Breaking Bad 1080p"), 1)).toBeNull();
  });

  it("reads season × episode as trackers write it, never a frame size (season 2 once offered season 4)", () => {
    expect(packOf("Ведьмак / The Witcher [04x01-08 из 08] (2025) WEB-DL 1080p | LostFilm")).toEqual({
      seasons: { from: 4, to: 4 },
      cours: false,
      episodes: { from: 1, to: 8, of: 8, bySeason: true },
    });
    expect(packOf("The Bear 2x05 720p").seasons).toEqual({ from: 2, to: 2 });
    expect(holdsSeason(packOf("Ведьмак / The Witcher [04x01-08 из 08] (2025)"), 2)).toBe(false);
    expect(packOf("Movie 1920x1080 BDRip").seasons).toBeNull();
    expect(packOf("Show [S02] 720x576 DVDRip").seasons).toEqual({ from: 2, to: 2 });
    for (const [name, season] of [
      ["Ведьмак / The Witcher / Сезон: 2 / Серии: 1-8 из 8 (2021) WEB-DLRip", 2],
      ["Ведьмак (2 сезон) / The Witcher (2021) WEB-DL 1080p", 2],
      ["Ведьмак / The Witcher [S02] (2021) WEB-DL 1080p", 2],
      ["The.Witcher.S04.2160p.NF.WEB-DL", 4],
      ["Ведьмак / The Witcher (4-й сезон) 2025", 4],
    ] as const) {
      expect(packOf(name).seasons, name).toEqual({ from: season, to: season });
    }
  });

  it("hears a Russian track in a torrent with no tracker by the trackers' own words", () => {
    const name = "12 angry men [1957, BDRemux 1080p] [DEU Transfer] Dub + 2x MVO ( SomeWax) + AVO + VO + Sub (Rus, Eng) + Original (Eng)";
    expect(parseRelease(name, null, "en").languages.sort()).toEqual(["en", "ru"]);
    // Its translations are Russian tracks, so the label leads with them, not with the original.
    expect(parseRelease(name, null, "en").tracks.filter((t) => !t.original).every((t) => t.language === "ru")).toBe(true);
    // A Ukrainian-only translation stays Ukrainian; an English scene name's "Dubbed" says nothing about Russian.
    expect(parseRelease("Film 2020 1080p MVO (Ukr) + Original Eng", null, "en").languages).not.toContain("ru");
    expect(parseRelease("Naruto.S01.Dubbed.1080p.WEB-DL", null, "ja").languages).not.toContain("ru");
    // With a tracker the tracker decides, as before.
    expect(parseRelease("Film 2020 1080p MVO + Original Eng", "Toloka", "en").languages).toContain("uk");
  });

  it("sinks a release holding other seasons below the rest and never recommends it", () => {
    const show = { title: "Во все тяжкие", originalTitle: "Breaking Bad", kind: "tv" as const, year: 2008, originalLanguage: "en" };
    const rel = (title: string, seeders: number): TsSearchResult => ({ title, link: `magnet:?xt=urn:btih:${title}`, hash: null, size: null, seeders, peers: null, tracker: "RuTracker.org", published: null });
    const s3 = rel("Во все тяжкие / Breaking Bad / Сезон: 3 / WEB-DL 1080p | MVO", 500);
    const s1 = rel("Во все тяжкие / Breaking Bad / Сезон: 1 / WEB-DL 720p | MVO", 20);
    const ranked = rankReleases([s3, s1], show, prefsOf({}), 1);
    expect(ranked.map((x) => [x.result, x.holds])).toEqual([
      [s1, true],
      [s3, false],
    ]);
    expect(bestOf(rankReleases([s3], show, prefsOf({}), 1))).toBeUndefined();
    // No episode asked for (the title page): the name decides nothing.
    expect(rankReleases([s3, s1], show, prefsOf({}))[0]!.result).toBe(s3);
  });
});

describe("audio tracks, each in its own language", () => {
  // The release from a real Dune search (its tail past "AV…" restored as
  // RuTracker writes it): a Russian dub and voice-overs, one Ukrainian dub, the original.
  const DUNE = "Дюна / Dune: Part One (Дени Вильнёв / Denis Villeneuve) [2021, США, Канада, фантастика, BDRip 1080p] Dub + MVO (Jaskier) + MVO (HDRezka Studio) + DVO (Pazl Voice) + AVO (Гаврилов) + Dub Ukr + Original Eng + Sub (Rus, Ukr, Eng)";
  const film = { title: "Дюна", originalTitle: "Dune", kind: "movie" as const, year: 2021, originalLanguage: "en" };
  const r = (title: string, seeders = 10, tracker = "RuTracker.org"): TsSearchResult => ({ title, link: `magnet:?xt=urn:btih:${title.length}${seeders}`, hash: null, size: null, seeders, peers: null, tracker, published: null });

  it("links each studio to its own language, and a language written next to a kind to that kind", () => {
    const info = parseRelease(DUNE, "RuTracker.org", "en");
    expect(info.tracks.map((t) => [t.language, t.voice, t.studio ?? t.credit, t.original])).toEqual([
      ["ru", "dub", null, false],
      ["ru", "mvo", "Jaskier", false],
      ["ru", "mvo", "HDrezka Studio", false],
      ["ru", "dvo", "Pazl Voice", false],
      ["ru", "avo", "Гаврилов", false],
      ["uk", "dub", null, false],
      ["en", null, null, true],
    ]);
    // Subtitles never make an audio track.
    expect(info.tracks.filter((t) => t.language === "uk")).toHaveLength(1);
  });

  it("reads the trackers' other ways of writing a track's language", () => {
    expect(parseRelease("Інтерстеллар / Interstellar (2014) BDRip 1080p | Dub (Ukr) + Original", "RuTracker.org", "en").tracks.map((t) => [t.language, t.voice, t.original])).toEqual([
      ["uk", "dub", false],
      ["en", null, true],
    ]);
    expect(parseRelease("Дюна (2021) BDRip 1080p Ukr/Eng | Дубляж Le Doyen", "Toloka", "en").tracks.map((t) => [t.language, t.voice, t.studio, t.original])).toEqual([
      ["en", null, null, true],
      ["uk", "dub", "Le Doyen", false],
    ]);
    expect(parseRelease("Interstellar (2014) UHD BDRemux 2160p | D, P, A", "NoNaMe-Club").tracks.map((t) => t.voice)).toEqual(["dub", "mvo", "avo"]);
    // One studio and one kind with nothing else: that studio's kind, as before tracks were read.
    expect(parseRelease("Дюна / Dune (2021) WEB-DL 1080p | MVO | LostFilm", "RuTracker.org").tracks).toEqual([{ language: "ru", voice: "mvo", studio: "LostFilm", credit: null, original: false }]);
    expect(parseRelease("Dune.2021.2160p.WEB-DL.DDP5.1.HDR.H.265", null).tracks).toEqual([]);
  });

  it("offers a studio in its own language, so the same name in two languages is two options of their languages", () => {
    const ranked = rankReleases([r(DUNE, 255), r("Дюна / Dune (2021) WEB-DL 2160p | MVO (HDrezka Studio) + Dub (Ukr)", 40)], film, prefsOf({ languages: ["uk"] }));
    const options = voiceOptions(ranked);
    // A two-voice track with no studio is no option of its own: it is Russian, "ru|".
    expect(options.map((o) => o.key)).toEqual(["ru|dub", "ru|Jaskier", "ru|HDrezka Studio", "ru|", "ru|Гаврилов", "uk|dub"]);
    // HDrezka is Russian in both releases: one option, never a Ukrainian one.
    expect(options.filter((o) => o.studio === "HDrezka Studio").map((o) => [o.language, o.versions.length])).toEqual([["ru", 2]]);
    expect(options.find((o) => o.key === "uk|dub")!.versions.map((v) => v.key)).toEqual(["1080", "2160"]);
  });

  it("ranks the profile's language by its own tracks: a Ukrainian dub counts as a dub for a Ukrainian profile", () => {
    const voOnly = r("Дюна / Dune (2021) WEB-DL 1080p | Dub + AVO (Ukr)", 300);
    const dub = r("Дюна / Dune (2021) WEB-DL 1080p | MVO + Dub (Ukr)", 20);
    expect(rankReleases([voOnly, dub], film, prefsOf({ languages: ["uk"] })).map((x) => x.result)).toEqual([dub, voOnly]);
  });
});

describe("a dubbing chosen by its language alone", () => {
  const tracks = [
    { index: 1, title: "Dub", language: "rus" },
    { index: 2, title: "Dub", language: "ukr" },
    { index: 3, title: "Original", language: "eng" },
  ];
  it("plays a track in that language, and guesses nothing when none is", () => {
    expect(voiceTrack(tracks, { studio: null, language: "uk" })).toBe(2);
    expect(voiceTrack(tracks, { studio: null, language: "ja" })).toBeNull();
    expect(voiceTrack(tracks, { studio: null, language: null })).toBeNull();
    expect(voiceWish("uk|dub")).toEqual({ studio: null, language: "uk", dub: true });
  });
  it("of several in that language: the profile's first studio's, else the default, else the first", () => {
    const more = [...tracks, { index: 4, title: "MVO [Sunnysiders]", language: "ukr" }, { index: 5, title: "MVO [DniproFilm]", language: "ukr", default: false }];
    expect(voiceTrack(more, { studio: null, language: "uk" })).toBe(2);
    expect(voiceTrack(more.map((t) => ({ ...t, default: t.index === 4 })), { studio: null, language: "uk" })).toBe(4);
    expect(voiceTrack(more, { studio: null, language: "uk" }, ["DniproFilm"])).toBe(5);
    // "Russian · multi-voice" from a release whose file starts with HDRezka: the profile's LostFilm among the Russian tracks.
    expect(voiceTrack(dexter, { studio: null, language: "ru" }, ["LostFilm", "HDrezka Studio"])).toBe(5);
    expect(voiceTrack(dexter, { studio: null, language: "ru" })).toBe(1);
  });
});

describe("a file's tracks read as a release's (fileTracks, withFileTracks)", () => {
  it("reads each title's kind, studio or other name and language, the original by its tag", () => {
    const tracks = fileTracks(["rus|Дубляж, Movie Dubbing", "rus|Дубляж, Dragon Studio", "rus|MVO, LostFilm", "rus|MVO [HDrezka Studio] 18+", "und|AVO, Ю. Сербин", "|RUS", "ukr|Дубляж, Postmodern", "eng|Original"], "en");
    expect(tracks.map((t) => [t.language, t.voice, t.studio, t.credit, t.original])).toEqual([
      ["ru", "dub", "Movie Dubbing", null, false],
      ["ru", "dub", null, "Dragon Studio", false],
      ["ru", "mvo", "LostFilm", null, false],
      ["ru", "mvo", "HDrezka Studio", null, false],
      ["ru", "avo", "Сербин", null, false],
      ["ru", null, null, null, false],
      ["uk", "dub", "Postmodern", null, false],
      ["en", null, null, null, true],
    ]);
  });
  it("gives a name that counts its voice-overs ('6x MVO') the studios its file names, and keeps the name's otherwise", () => {
    const info = parseRelease("F1 / F1: The Movie [2025, WEB-DL 2160p, HDR10, Dolby Vision] 3x Dub (Movie Dubbing, Jaskier, RHS) + 6x MVO + AVO + VO + Dub (Ukr) + Original (Eng)", "RuTracker.org", "en");
    expect(info.studios).not.toContain("LostFilm");
    const read = withFileTracks(info, ["rus|MVO, LostFilm", "rus|MVO, HDRezka Studio", "eng|Original"], "en");
    expect(read.studios).toEqual(expect.arrayContaining(["LostFilm", "HDrezka Studio"]));
    expect(profileNameTrack(read, { languages: ["ru"], studios: ["LostFilm"] })).toMatchObject({ studio: "LostFilm" });
    expect(withFileTracks(info, null)).toBe(info);
    expect(withFileTracks(info, [])).toBe(info);
  });
});

describe("the track the profile hears when nothing was chosen (profileTrack)", () => {
  const order = { languages: ["ru"], studios: ["LostFilm", "HDrezka Studio"] };
  it("plays the profile's first studio, not the file's default: 1 — LostFilm, 2 — HDRezka on Dexter: Resurrection", () => {
    expect(profileTrack(dexter, order)).toBe(5);
    expect(profileTrack(dexter, { languages: ["ru"], studios: ["HDrezka Studio", "LostFilm"] })).toBe(1);
    // A studio typed by hand is matched by its spellings.
    expect(profileTrack(dexter, { languages: ["ru"], studios: ["Novamedia"] })).toBe(4);
  });
  it("goes by the profile's languages first, as 'Where to watch' offers audio", () => {
    // Ukrainian first: a Ukrainian track (none of the studios is Ukrainian), the first one as none is the default.
    expect(profileTrack(dexter, { languages: ["uk", "ru"], studios: ["LostFilm"] })).toBe(9);
    expect(profileTrack(dexter, { languages: ["en"], studios: ["LostFilm"] })).toBe(11);
    // A language the file doesn't have: the next one, then the studios anywhere.
    expect(profileTrack(dexter, { languages: ["de", "ru"], studios: ["LostFilm"] })).toBe(5);
    expect(profileTrack(dexter, { languages: [], studios: ["LostFilm"] })).toBe(5);
  });
  it("keeps the file's default when it is the language's own track, and finds nothing when the profile says nothing", () => {
    expect(profileTrack(dexter, { languages: ["ru"], studios: [] })).toBe(1);
    expect(profileTrack(dexter, { languages: ["ja"], studios: [] })).toBeNull();
    expect(profileTrack(dexter, { languages: [], studios: [] })).toBeNull();
    expect(profileTrack([], order)).toBeNull();
  });
  it("reads an untagged track's language from its title or its studio", () => {
    const untagged = [
      { index: 1, title: "MVO [HDrezka Studio]", language: null, default: true },
      { index: 2, title: "MVO [LostFilm]", language: "und" },
      { index: 3, title: "Eng", language: null },
    ];
    expect(profileTrack(untagged, order)).toBe(2);
    expect(profileTrack(untagged, { languages: ["en"], studios: [] })).toBe(3);
  });
  it("says which track of a release's name a copy plays (profileNameTrack)", () => {
    const info = parseRelease(
      "Dexter: Resurrection / S1E1-10 of 10 [2025, WEB-DL 1080p] 7 x MVO (HDrezka Studio, NewStudio, TVShows, Novamedia, LostFilm, WStudio, LE-Production) + 2 x MVO Ukr + Original + Sub (Rus, Eng)",
      "RuTracker.org",
      "en",
    );
    expect(profileNameTrack(info, order)).toMatchObject({ studio: "LostFilm", language: "ru" });
    expect(profileNameTrack(info, { languages: ["ru"], studios: [] })).toMatchObject({ studio: "HDrezka Studio" });
    expect(profileNameTrack(info, { languages: ["uk", "ru"], studios: ["LostFilm"] })).toMatchObject({ language: "uk", voice: "mvo" });
    expect(profileNameTrack(info, { languages: ["ja"], studios: [] })).toBeNull();
  });
});

describe("releaseDomId", () => {
  it("names a release in the page without its link's key, the same each time, apart from the others", () => {
    const link = "http://jackett:9117/dl/rutracker/?jackett_apikey=abcdef0123456789abcdef0123456789&path=Q2ZESjhP&file=Dune";
    const id = releaseDomId(link);
    expect(id).toBe(releaseDomId(link));
    expect(id).toMatch(/^[0-9a-z]{1,7}$/);
    expect(id).not.toContain("abcdef");
    expect(releaseDomId(link.replace("file=Dune", "file=Dune2"))).not.toBe(id);
  });
});

describe("copyFileTracks", () => {
  const copy = (externalId: string, label: string | null, audioTracks?: string[]) => ({ kind: "torrserver" as const, externalId, label, quality: audioTracks ? ({ audioTracks } as never) : null });
  it("gives a search result the tracks read in the copy it is — by hash, or by the name the copy was saved under", () => {
    const hash = "a".repeat(40);
    const of = copyFileTracks([copy(hash, "Dune.2021.1080p", ["ru|LostFilm", "en|"]), copy(`${hash}:1`, null), copy("b".repeat(40), "Other")])!;
    expect(of({ hash: hash.toUpperCase(), title: "whatever" })).toEqual(["ru|LostFilm", "en|"]);
    expect(of({ hash: null, title: "Dune.2021.1080p" })).toEqual(["ru|LostFilm", "en|"]);
    expect(of({ hash: null, title: "Other" })).toBeNull();
  });

  it("is null when no copy's tracks were read, and leaves Jellyfin and Plex out", () => {
    expect(copyFileTracks([copy("c".repeat(40), "X")])).toBeNull();
    expect(copyFileTracks([{ kind: "jellyfin", externalId: "j1", label: "X", quality: { audioTracks: ["ru|"] } as never }])).toBeNull();
  });
});

describe("wishNameTrack", () => {
  const info = parseRelease("Дюна: Часть вторая / Dune: Part Two (2024) WEB-DL 1080p | Dub (Movie Dubbing) + Dub (Red Head Sound) + MVO (LostFilm) + Original Eng");
  it("names the one track a language alone or its dub starts, as the player picks the file's", () => {
    expect(wishNameTrack(info, voiceWish("ru|dub"), [])).toMatchObject({ voice: "dub", studio: "Movie Dubbing" });
    expect(wishNameTrack(info, voiceWish("ru|"), ["LostFilm"])).toMatchObject({ studio: "LostFilm" });
    expect(wishNameTrack(info, voiceWish("ru|dub"), ["LostFilm"])).toMatchObject({ voice: "dub" });
  });

  it("leaves a studio's choice to its studio, and says nothing without a choice", () => {
    expect(wishNameTrack(info, voiceWish("ru|LostFilm"), [])).toBeNull();
    expect(wishNameTrack(info, null, [])).toBeNull();
  });
});

// One studio's track, named with its kind in one release and without it in another.
describe("a studio's kind of translation, from the names of one search", () => {
  const tlou = { title: "Одни из нас", originalTitle: "The Last of Us", kind: "tv" as const, year: 2023, originalLanguage: "en" };
  const r = (title: string, seeders: number) => ({ title, link: `magnet:?xt=urn:btih:${title.length.toString(16).padStart(40, "0")}${seeders}`, hash: null, size: 20e9, seeders, peers: 1, tracker: "RuTracker.org", published: null });
  const uhd = r("The Last of Us / S1E1-9 of 9 [2023, SDR, WEB-DL 2160p] Dub (Red Head Sound) + MVO (HDrezka)", 13);
  const hd = r("Одни из нас / The Last of Us / S1E1-9 of 9 (2023) WEB-DL [H.264/1080p] RHS", 4);

  it("gives a name that credits the studio alone the kind the others pair it with", () => {
    const ranked = rankReleases([uhd, hd], tlou, prefsOf({}), 1, 1);
    expect(ranked.find((x) => x.result === hd)?.info.tracks[0]).toMatchObject({ studio: "Red Head Sound", voice: "dub" });
  });

  it("never lends another language's kind to the profile's track: a Ukrainian release stays first for \"uk, ru\"", () => {
    const both = r("Одни из нас / The Last of Us / S1E1-9 of 9 (2023) WEB-DL [H.265/2160p] [4K, HDR10, 10-bit] RHS, Цікава Ідея", 20);
    const ukr = { ...r("The Last of Us (S1) (2023) BDRip 1080p H.265 3Ukr/Eng | Sub 2Ukr/Eng (S1)", 32), tracker: "Toloka" };
    const ranked = rankReleases([uhd, both, ukr], tlou, prefsOf({ languages: ["uk", "ru"], hevc: true }), 1, 1);
    expect(ranked[0]!.result).toBe(ukr);
  });

  it("so the picture decides between them: 1080p H.264 on a PC without HEVC, not 4K above it for its word Dub", () => {
    expect(rankReleases([uhd, hd], tlou, prefsOf({ hevc: false }), 1, 1)[0]!.result).toBe(hd);
    // And the profile's "Dubbing" counts it as a dub.
    expect(rankReleases([uhd, hd], tlou, prefsOf({ hevc: false, studios: [DUBBING] }), 1, 1).find((x) => x.result === hd)?.studio).toBe(DUBBING);
  });
});

describe("the resolution a name states", () => {
  it("takes the lines it writes over the words 4K and UHD", () => {
    expect(parseRelease("Oppenheimer (2023) UHD-BDRip 1080p H.265 HDR Ukr/Eng [IMAX Edition]").resolution).toBe(1080);
    expect(parseRelease("Oppenheimer [2023, UHD BDRemux 2160p, HDR10, Dolby Vision]").resolution).toBe(2160);
    expect(parseRelease("Dune (2021) WEB-DL 4K HDR").resolution).toBe(2160);
    expect(parseRelease("Dune (2021) UHD BDRemux HDR").resolution).toBe(2160);
  });
});

describe("a film's releases, not broadcasts", () => {
  it("leaves out races and other broadcasts that only share a short name (F1)", () => {
    const names = ["F1", "F1: The Movie"];
    expect(isSameTitle("S2025 / 19 / - / / F1 TV [17-19.10.2025, 1, WEB-DL/1080p/50fps, MKV/H.264, RUS/ENG]", names, 2025, "movie")).toBe(false);
    expect(isSameTitle("1 | S2025 | 01-06 | F1 TV WEB-DL 1080p 50fps Ukr/Eng", names, 2025, "movie")).toBe(false);
    expect(isSameTitle("Formula 2 2025 / 12 / / F1 TV [20.09.2025-21.09.2025, WEB-DL/1080p/50fps, MKV/H.264]", names, 2025, "movie")).toBe(false);
    expect(isSameTitle("F1: / F1: The Movie (2025) BDRemux 1080p Ukr/Eng | Sub Ukr/Eng", names, 2025, "movie")).toBe(true);
    expect(isSameTitle("F1 [2025, WEB-DL 2160p, HDR10, Dolby Vision] Dub (Red Head Sound)", names, 2025, "movie")).toBe(true);
  });
});
