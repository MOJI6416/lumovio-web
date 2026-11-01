import { describe, expect, it } from "vitest";
import { audioMatch, bestOf, creditsStudio, holdsSeason, isSameTitle, packOf, parseRelease, pictureReasons, type ReleasePrefs, rankReleases, torrentQuery, voiceOptions, voiceTrack, voiceWish } from "../src/lib/media/releases";
import type { TsSearchResult } from "../src/lib/media/torrserver";

const device = { hevc: false, hdr: false, uhd: false, dolbyVision: false };
const prefsOf = (p: Partial<ReleasePrefs> & { hevc?: boolean }): ReleasePrefs => ({
  languages: p.languages ?? ["ru"],
  studios: p.studios ?? [],
  quality: p.quality ?? "auto",
  device: { ...device, ...(p.hevc !== undefined ? { hevc: p.hevc } : {}), ...p.device },
});

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
});

describe("torrentQuery", () => {
  it("uses the original title and a film's year, or the localized title for another script", () => {
    expect(torrentQuery({ title: "Интерстеллар", originalTitle: "Interstellar", kind: "movie", year: 2014 })).toBe("Interstellar 2014");
    expect(torrentQuery({ title: "Фрирен, провожающая в последний путь", originalTitle: "葬送のフリーレン", kind: "tv", year: 2023 })).toBe("Фрирен, провожающая в последний путь");
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

describe("picture versions and quality modes (TS1–TS3)", () => {
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

describe("the chosen dubbing's track (TS5)", () => {
  const tracks = [
    { index: 1, title: "Dub (Пифагор)", language: "rus" },
    { index: 2, title: "MVO (HDrezka Studio)", language: "rus" },
    { index: 3, title: "Original", language: "eng" },
  ];
  it("reads an option key into a studio and language; a kind of translation has no studio", () => {
    expect(voiceWish("ru|HDrezka Studio")).toEqual({ studio: "HDrezka Studio", language: "ru" });
    expect(voiceWish("ru|dub")).toEqual({ studio: null, language: "ru" });
    expect(voiceWish("|")).toEqual({ studio: null, language: null });
    expect(voiceWish(null)).toBeNull();
  });
  it("finds the one track crediting the studio, by trackers' spellings too", () => {
    expect(voiceTrack(tracks, { studio: "HDrezka Studio", language: "ru" })).toBe(2);
    expect(voiceTrack([{ index: 4, title: "P (HDRezka)", language: null }, ...tracks.slice(0, 1)], { studio: "HDrezka Studio", language: null })).toBe(4);
    expect(voiceTrack(tracks, { studio: "Пифагор", language: "ru" })).toBe(1);
  });
  it("guesses nothing when no track or several tracks credit it; a single track is that track", () => {
    expect(voiceTrack(tracks, { studio: "LostFilm", language: "ru" })).toBeNull();
    expect(voiceTrack([{ index: 1, title: null, language: "rus" }, { index: 2, title: null, language: "rus" }], { studio: "LostFilm", language: "ru" })).toBeNull();
    expect(voiceTrack([{ index: 1, title: "LostFilm", language: "rus" }, { index: 2, title: "LostFilm", language: "ukr" }], { studio: "LostFilm", language: "uk" })).toBe(2);
    expect(voiceTrack([{ index: 1, title: "LostFilm", language: "rus" }, { index: 2, title: "LostFilm", language: "rus" }], { studio: "LostFilm", language: "ru" })).toBeNull();
    expect(voiceTrack([{ index: 1, title: null, language: null }], { studio: "LostFilm", language: "ru" })).toBe(1);
  });
});

describe("each studio's own kind of translation (TS5)", () => {
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

describe("season packs by the name (TS5)", () => {
  it("reads seasons, episode ranges and totals as trackers write them, and nothing that isn't there", () => {
    expect(packOf("Во все тяжкие / Breaking Bad / Сезон: 2 / Серии: 1-13 из 13 [2009, WEB-DL 1080p]")).toEqual({ seasons: { from: 2, to: 2 }, cours: false, episodes: { from: 1, to: 13, of: 13 } });
    expect(packOf("Breaking.Bad.S01-S05.Complete.1080p")).toEqual({ seasons: { from: 1, to: 5 }, cours: false, episodes: null });
    expect(packOf("Arcane S02E01-09 2160p")).toEqual({ seasons: { from: 2, to: 2 }, cours: false, episodes: { from: 1, to: 9, of: null } });
    expect(packOf("Arcane.S02E03.1080p.WEB-DL")).toEqual({ seasons: { from: 2, to: 2 }, cours: false, episodes: { from: 3, to: 3, of: null } });
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
      episodes: { from: 1, to: 73, of: null },
    });
    expect(packOf("Lost.S01E01-S06E18.1080p.BluRay")).toEqual({ seasons: { from: 1, to: 6 }, cours: false, episodes: { from: 1, to: 18, of: null } });
    expect(packOf("Show S01-S03E01-E36 of 36 WEB-DL").episodes).toEqual({ from: 1, to: 36, of: 36 });
    expect(holdsSeason(packOf("La Casa de Papel S1-8E1-73"), 5)).toBe(true);
    // "of 10" right after the range: the season's length (it was read only without an S…E mark).
    expect(packOf("La casa de papel / Money Heist / S5E1-5 of 10 [2021, HDR, WEBRip 2160p]")).toEqual({
      seasons: { from: 5, to: 5 },
      cours: false,
      episodes: { from: 1, to: 5, of: 10 },
    });
    expect(packOf("Сёгун / Shogun / S01E01-08 из 10 [2024]").episodes).toEqual({ from: 1, to: 8, of: 10 });
    expect(packOf("Arcane.S02E03.of.9.1080p").episodes).toEqual({ from: 3, to: 3, of: 9 });
    // A number later in the name isn't a total.
    expect(packOf("Arcane S02E01-09 2160p 10bit").episodes).toEqual({ from: 1, to: 9, of: null });
  });

  it("says a pack lacks a season only when it names other seasons, never for anime cours or episode numbers", () => {
    expect(holdsSeason(packOf("Breaking.Bad.S03.1080p"), 1)).toBe(false);
    expect(holdsSeason(packOf("Breaking.Bad.S01-S05"), 3)).toBe(true);
    expect(holdsSeason(packOf("Jujutsu Kaisen [TV-2] [25-47 из 47]"), 1)).toBeNull();
    expect(holdsSeason(packOf("Breaking Bad 1080p"), 1)).toBeNull();
  });

  it("reads season × episode as trackers write it, never a frame size (owner, 2026-10-31: season 2 offered season 4)", () => {
    expect(packOf("Ведьмак / The Witcher [04x01-08 из 08] (2025) WEB-DL 1080p | LostFilm")).toEqual({
      seasons: { from: 4, to: 4 },
      cours: false,
      episodes: { from: 1, to: 8, of: 8 },
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

describe("audio tracks, each in its own language (SRC-04, SRC-05)", () => {
  // The release from the audit's real Dune search (plb-p7-real-dune-filters-crop; its tail past "AV…" restored as
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
    expect(options.map((o) => o.key)).toEqual(["ru|dub", "ru|Jaskier", "ru|HDrezka Studio", "ru|dvo", "ru|Гаврилов", "uk|dub"]);
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
  it("plays the one track tagged with that language, and guesses nothing when several or none are", () => {
    const tracks = [
      { index: 1, title: "Dub", language: "rus" },
      { index: 2, title: "Dub", language: "ukr" },
      { index: 3, title: "Original", language: "eng" },
    ];
    expect(voiceTrack(tracks, { studio: null, language: "uk" })).toBe(2);
    expect(voiceTrack(tracks, { studio: null, language: "ja" })).toBeNull();
    expect(voiceTrack([...tracks, { index: 4, title: "MVO", language: "ukr" }], { studio: null, language: "uk" })).toBeNull();
    expect(voiceTrack(tracks, { studio: null, language: null })).toBeNull();
    expect(voiceWish("uk|dub")).toEqual({ studio: null, language: "uk" });
  });
});
