import { describe, expect, it } from "vitest";
import { ANY, editionOf, forProfile, NO_CHOICE, pickRelease } from "../src/lib/media/release-pick";
import { DUBBING, type ReleasePrefs, rankReleases, voiceOptions, voiceTrack, voiceWish } from "../src/lib/media/releases";
import type { TsSearchResult } from "../src/lib/media/torrserver";

const device = { hevc: true, hdr: false, uhd: false, dolbyVision: false };
const prefs = (p: Partial<ReleasePrefs> = {}): ReleasePrefs => ({ languages: p.languages ?? ["uk", "ru"], studios: p.studios ?? [], quality: p.quality ?? "auto", device: { ...device, ...p.device } });
let n = 0;
const result = (title: string, seeders = 50, size = 10e9, tracker = "RuTracker.org"): TsSearchResult => ({
  title,
  link: `magnet:?xt=urn:btih:${(++n).toString(16).padStart(40, "0")}`,
  hash: null,
  size,
  seeders,
  peers: 1,
  tracker,
  published: null,
});
const lotr = { title: "Властелин колец: Братство кольца", originalTitle: "The Lord of the Rings: The Fellowship of the Ring", kind: "movie" as const, year: 2001, originalLanguage: "en" };
const name = (rest: string) => `Властелин колец: Братство кольца / The Lord of the Rings: The Fellowship of the Ring (Питер Джексон) ${rest}`;

describe("editionOf", () => {
  it("reads the cut as trackers write it", () => {
    expect(editionOf(name("[2001, BDRemux 1080p] [Extended Edition] Dub + MVO"))).toBe("extended");
    expect(editionOf("Avatar (Extended Collectors Cut) [2009, BDRip 1080p]")).toBe("extended");
    expect(editionOf("Batman v Superman: Dawn of Justice (Ext. Cut) 2016 DUB")).toBe("extended");
    expect(editionOf("Бэтмен против Супермена [2016, BDRemux 1080p] [Ultimate Edition] Dub")).toBe("extended");
    expect(editionOf("Бэтмен против Супермена (2016) BDRip [H.265/1080p] [Расширенная версия]")).toBe("extended");
    expect(editionOf("Чужие (Режиссёрская версия) / Aliens (Director's Cut) 1986")).toBe("directors");
    expect(editionOf("Blade Runner (1982) [The Final Cut] UHD BDRemux 4K 2160p")).toBe("final");
    expect(editionOf("Бегущий по лезвию / Blade Runner (1982) BDRip 1080p [Финальная версия]")).toBe("final");
    expect(editionOf("Terminator 2 [1991, Telecine 2160p] [Театральная версия / Theatrical Cut] Dub")).toBe("theatrical");
    expect(editionOf("Blade Runner [1982, BDRemux 1080p] [International theatrical cut]")).toBe("theatrical");
    expect(editionOf("Dune: Part Two (2024) IMAX 4K")).toBe("imax");
    expect(editionOf("The Wolf of Wall Street (2013) Unrated BDRip")).toBe("unrated");
  });

  it("names no cut when the name names none, or two", () => {
    expect(editionOf(name("[2001, BDRip 1080p] Dub + MVO + Original"))).toBeNull();
    expect(editionOf("Aliens [1986, BDRip] [2-in-1: Theatrical & Director's Cut/Special Edition]")).toBeNull();
    expect(editionOf("Terminator 2 [1991, BDRip 1080p] [Special Edition] [Remastered 2017]")).toBeNull();
    expect(editionOf("Blade Runner [1982] [The Penultimate Cut 2020]")).toBeNull();
  });

  it("takes the cut over IMAX", () => {
    expect(editionOf("Batman v Superman [2016, WEB-DL 2160p, HDR10, Dolby Vision] [Extended] [IMAX] Dub")).toBe("extended");
  });
});

describe("forProfile", () => {
  it("puts the profile's languages first, then its studios, else the releases' order", () => {
    const ranked = rankReleases([result(name("[2001, WEB-DL 1080p] Dub + MVO (Jaskier) + Dub (Ukr) + Original Eng"))], lotr, prefs());
    const raw = voiceOptions(ranked);
    expect(raw[0]!.language).toBe("ru");
    const mine = forProfile(raw, { languages: ["uk", "ru"], studios: ["Jaskier"] });
    expect(mine.map((o) => o.key)).toEqual(["uk|dub", "ru|Jaskier", "ru|dub"]);
  });

  it("puts the profile's studios in their order, not in the order a release lists them", () => {
    const ranked = rankReleases([result(name("[2001, WEB-DL 1080p] MVO (HDrezka Studio, Jaskier, LostFilm) + Original Eng"))], lotr, prefs({ languages: ["ru"] }));
    const raw = voiceOptions(ranked);
    expect(raw.map((o) => o.studio)).toEqual(["HDrezka Studio", "Jaskier", "LostFilm"]);
    expect(forProfile(raw, { languages: ["ru"], studios: ["LostFilm", "HDrezka Studio"] }).map((o) => o.studio)).toEqual(["LostFilm", "HDrezka Studio", "Jaskier"]);
    expect(forProfile(raw, { languages: ["ru"], studios: ["Jaskier", "LostFilm"] }).map((o) => o.studio)).toEqual(["Jaskier", "LostFilm", "HDrezka Studio"]);
  });
});

describe("pickRelease with the profile's order of studios (1 — LostFilm, 2 — HDRezka)", () => {
  const dexter = { title: "Декстер: Воскрешение", originalTitle: "Dexter: Resurrection", kind: "tv" as const, year: 2025, originalLanguage: "en" };
  const both = result("Dexter: Resurrection / S1E1-10 of 10 [2025, WEB-DL 1080p] 7 x MVO (HDrezka Studio, NewStudio, TVShows, Novamedia, LostFilm, WStudio, LE-Production) + 2 x MVO Ukr + Original", 99);
  const order = prefs({ languages: ["ru"], studios: ["LostFilm", "HDrezka Studio"] });

  it("offers the first studio first even when the one release lists the second first, and picks that release", () => {
    const x = pickRelease(rankReleases([both], dexter, order), order);
    expect(x.options.slice(0, 2).map((o) => o.studio)).toEqual(["LostFilm", "HDrezka Studio"]);
    expect(x.option?.key).toBe("ru|LostFilm");
    expect(x.chosen?.result).toBe(both);
    const reversed = prefs({ languages: ["ru"], studios: ["HDrezka Studio", "LostFilm"] });
    expect(pickRelease(rankReleases([both], dexter, reversed), reversed).option?.key).toBe("ru|HDrezka Studio");
  });

  it("matches a studio typed by hand ('HDRezka') to the known one", () => {
    const typed = prefs({ languages: ["ru"], studios: ["HDRezka", "LostFilm"] });
    expect(pickRelease(rankReleases([both], dexter, typed), typed).option?.key).toBe("ru|HDrezka Studio");
  });

  it("starts the first studio's best release among separate ones, whatever their seeders", () => {
    const rezka = result("Dexter: Resurrection / S2E1 of 10 [2026, WEB-DL 1080p] MVO (HDRezka Studio) + Original + Sub (Rus, Eng)", 400);
    const lost = result("Dexter: Resurrection - S2E1 - Risky Business - rus 1080p WEBDL (LostFilm)", 3, 2e9, "LostFilm.tv");
    const x = pickRelease(rankReleases([rezka, lost], dexter, order, 2), order);
    expect(x.option?.key).toBe("ru|LostFilm");
    expect(x.chosen?.result).toBe(lost);
  });

  it("lets the second studio's HD win over the first studio's SD only", () => {
    const sd = result("Dexter: Resurrection / S1E1-10 of 10 [2025, WEBRip] MVO (LostFilm) + Original", 80);
    const rezka720 = result("Dexter: Resurrection / S1E1-10 of 10 [2025, WEB-DL 720p] MVO (HDRezka Studio) + Original", 8);
    expect(pickRelease(rankReleases([sd, rezka720], dexter, order), order).option?.key).toBe("ru|HDrezka Studio");
    const lost720 = result("Dexter: Resurrection / S1E1-10 of 10 [2025, WEB-DL 720p] MVO (LostFilm) + Original", 5);
    expect(pickRelease(rankReleases([sd, rezka720, lost720], dexter, order), order).chosen?.result).toBe(lost720);
  });

  // An almost dead release never wins over a live one, the profile's first studio's either.
  it("doesn't start the first studio's release when it is almost dead (one or two seeders) and another studio's is alive", () => {
    const lost = result("Dexter: Resurrection / S1E1-10 of 10 [2025, WEB-DL 1080p] MVO (LostFilm) + Original", 2);
    const rezka = result("Dexter: Resurrection / S1E1-10 of 10 [2025, WEB-DL 1080p] MVO (HDRezka Studio) + Original", 40);
    const x = pickRelease(rankReleases([lost, rezka], dexter, order), order);
    expect(x.option?.key).toBe("ru|HDrezka Studio");
    expect(x.options.map((o) => o.key)).toEqual(["ru|HDrezka Studio", "ru|LostFilm"]);
  });
});

describe("what plays by default: the whole pick on real TorrServer answers", () => {
  const GB = 1024 ** 3;
  const dune2 = { title: "Dune: Part Two", originalTitle: null, kind: "movie" as const, year: 2024, originalLanguage: "en" };
  const dexter = { title: "Декстер: Воскрешение", originalTitle: "Dexter: Resurrection", kind: "tv" as const, year: 2025, originalLanguage: "en" };
  const ru = (p: Partial<ReleasePrefs> = {}) => prefs({ languages: ["ru"], ...p });
  const remux = result("Dune: Part Two [2024, BDRemux 1080p] Dub (iTunes, RHS, HDrezka, Jaskier) + MVO (LostFilm, Jaskier, TVShows) + AVO + VO + Dub Ukr + Original Eng", 113, 34.4 * GB);
  const bdrip = result("Dune: Part Two [2024, BDRip 1080p] Dub (iTunes, RHS, HDrezka, Jaskier) + MVO (LostFilm, Jaskier, TVShows) + AVO + VO + Dub (Ukr) + Original (Eng)", 302, 20.7 * GB);
  const webdl = result("Dune: Part Two [2024, WEB-DL 1080p] Dub (iTunes, RHS, HDrezka, Jaskier) + MVO (LostFilm 5.1, TVShows, Jaskier) + AVO + Dub (Ukr) + Original (Eng)", 76, 21.1 * GB);

  it("'Auto' (what loads at your speed) starts an encode, not the untouched disc; 'Best' the disc", () => {
    expect(pickRelease(rankReleases([remux, webdl, bdrip], dune2, ru()), ru()).chosen?.result).toBe(bdrip);
    expect(pickRelease(rankReleases([remux, webdl], dune2, ru()), ru()).chosen?.result).toBe(webdl);
    expect(pickRelease(rankReleases([remux, webdl, bdrip], dune2, ru({ quality: "best" })), ru({ quality: "best" })).chosen?.result).toBe(remux);
  });

  it("sinks a swarm of one or two seeders below every live release, a sharper picture's too (4K with 2 below Full HD with 40)", () => {
    const weak = result("Dune: Part Two [2024, BDRip 1080p] Dub + Original (Eng)", 2, 14 * GB, "Kinozal");
    const healthy = result("Dune: Part Two [2024, WEB-DL 1080p] Dub + Original (Eng)", 40, 9 * GB, "Kinozal");
    expect(rankReleases([weak, healthy], dune2, ru())[0]!.result).toBe(healthy);
    // "4K with 2 peers is worse than Full HD with 20". Unknown seeders
    // are not weak.
    const uhd = { hevc: true, hdr: true, uhd: true, dolbyVision: false };
    const weak4k = result("Dune: Part Two [2024, BDRip 2160p, HDR10] HEVC Dub + Original (Eng)", 2, 30 * GB, "Kinozal");
    expect(rankReleases([healthy, weak4k], dune2, ru({ device: uhd }))[0]!.result).toBe(healthy);
    const live4k = result("Dune: Part Two [2024, BDRip 2160p, HDR10] HEVC Dub + Original (Eng)", 18, 30 * GB, "Kinozal");
    expect(rankReleases([healthy, live4k], dune2, ru({ device: uhd }))[0]!.result).toBe(live4k);
    // One picture: a thin swarm (under ten) after a live one before the source decides (The Penguin: Blu-ray with 8
    // seeders came before WEB-DL with 54).
    const thin = result("Dune: Part Two [2024, BDRip 1080p] Dub + Original (Eng)", 8, 14 * GB, "RuTracker.org");
    const live = result("Dune: Part Two [2024, WEB-DL 1080p] Dub + Original (Eng)", 54, 9 * GB, "RuTracker.org");
    expect(rankReleases([thin, live], dune2, ru())[0]!.result).toBe(live);
    expect(rankReleases([weak, result("Dune: Part Two [2024, WEB-DL 1080p] Dub + Original (Eng)", null, 9 * GB, "LostFilm.tv")], dune2, ru())[0]!.result.tracker).toBe("LostFilm.tv");
    // "Smaller file": the healthy one before the smaller one.
    const tiny = result("Dune: Part Two [2024, WEB-DL 720p] Dub + Original (Eng)", 1, 2 * GB, "Kinozal");
    expect(rankReleases([tiny, healthy], dune2, ru({ quality: "small" }))[0]!.result).toBe(healthy);
  });

  it("starts what this device plays: a studio's HEVC- or AV1-only release gives way to another studio's playable one", () => {
    const studios = ["LostFilm", "HDrezka Studio"];
    const lostHevc = result("Dune: Part Two [2024, WEB-DL 1080p] HEVC MVO (LostFilm) + Original (Eng)", 50, 6 * GB);
    const rezkaAvc = result("Dune: Part Two [2024, WEB-DL 1080p] H.264 MVO (HDrezka Studio) + Original (Eng)", 50, 8 * GB);
    const noHevc = ru({ studios, device: { hevc: false, hdr: false, uhd: false, dolbyVision: false } });
    expect(pickRelease(rankReleases([lostHevc, rezkaAvc], dune2, noHevc), noHevc).option?.studio).toBe("HDrezka Studio");
    const withHevc = ru({ studios });
    expect(pickRelease(rankReleases([lostHevc, rezkaAvc], dune2, withHevc), withHevc).option?.studio).toBe("LostFilm");
    const av1 = result("Начало / Inception (2010) BDRip [AV1/1080p] Dub", 16, 9 * GB, "NoNaMe ClubL");
    const inception = { ...dune2, title: "Inception", year: 2010 };
    const avc = result("Inception (2010) BDRip 720p Dub", 5, 4 * GB, "Kinozal");
    expect(rankReleases([av1, avc], inception, ru({ device: { hevc: true, hdr: false, uhd: false, dolbyVision: false, av1: false } }))[0]!.result).toBe(avc);
    expect(rankReleases([av1, avc], inception, ru({ device: { hevc: true, hdr: false, uhd: false, dolbyVision: false, av1: true } }))[0]!.result).toBe(av1);
  });

  it("never takes a series named like the film for it (Avatar 2009 vs Avatar: The Last Airbender by LostFilm)", () => {
    const avatar = { title: "Avatar", originalTitle: null, kind: "movie" as const, year: 2009, originalLanguage: "en" };
    const airbender = result("Avatar: The Last Airbender - S1 - rus 1080p WEBDL (LostFilm)", null, 21 * GB, "LostFilm.tv");
    const film = result("Аватар / Avatar (2009) BDRip 1080p | Dub", 40, 15 * GB, "RuTracker.org");
    const p = ru({ studios: ["LostFilm"] });
    expect(rankReleases([airbender, film], avatar, p).map((x) => x.result)).toEqual([film]);
  });

  it("holds the episode the viewing is for: an updating pack's first episode isn't the third", () => {
    const p = ru({ studios: ["LostFilm", "HDrezka Studio"] });
    const lost1 = result("Dexter: Resurrection - S2E1 - Risky Business - rus 1080p WEBDL (LostFilm)", null, 2 * GB, "LostFilm.tv");
    const kinozal1 = result("Dexter: Resurrection - S2E1 - 2026  MVO (LostFilm), Sub WEBDL 1080p - RUSSIAN", 13, 3 * GB, "Kinozal");
    const updating = result("Декстер: Воскрешение / Dexter: Resurrection (2026) WEB-DL [H.264/1080p] (S2E1- из 10) HDrezka (обновляемая)", 32, 6 * GB, "NoNaMe ClubL");
    const third = pickRelease(rankReleases([lost1, kinozal1, updating], dexter, p, 2, 3), p);
    expect(third.option?.studio).toBe("HDrezka Studio");
    expect(third.chosen?.result).toBe(updating);
    // The first episode: LostFilm, the release with counted seeders before the one whose indexer counts none.
    const first = pickRelease(rankReleases([lost1, kinozal1, updating], dexter, p, 2, 1), p);
    expect(first.option?.studio).toBe("LostFilm");
    expect(first.chosen?.result).toBe(kinozal1);
  });

  it("starts a season pack before a single episode of the same picture", () => {
    const one = result("Dexter: Resurrection / S1E1 of 10 [2025, WEB-DL 1080p] MVO (TVShows) + Original", 90, 2 * GB);
    const pack = result("Dexter: Resurrection / S1E1-10 of 10 [2025, WEB-DL 1080p] MVO (TVShows) + Original", 20, 20 * GB);
    expect(rankReleases([one, pack], dexter, ru(), 1, 1)[0]!.result).toBe(pack);
  });

  it("starts the cut viewers seed most, among the cuts at the best floor; a tie goes to the theatrical one", () => {
    const blade = { title: "Blade Runner", originalTitle: null, kind: "movie" as const, year: 1982, originalLanguage: "en" };
    const final4k = result("Blade Runner [1982, UHD BDRemux 2160p, HDR10, Dolby Vision] [The Final Cut] Dub + Original", 144, 66 * GB);
    const final1080 = result("Blade Runner [1982, BDRip 1080p] [The Final Cut] Dub + Original", 61, 20 * GB);
    const theatrical = result("Blade Runner [1982, BDRip 1080p] [Theatrical Cut] Dub + Original", 22, 21 * GB);
    const x = pickRelease(rankReleases([theatrical, final1080, final4k], blade, ru()), ru());
    expect(x.edition).toBe("final");
    expect(x.chosen?.result).toBe(final1080);
    // A cut seeded more but only in SD never wins over an HD one.
    const sdFinal = result("Blade Runner [1982, DVDRip] [The Final Cut] Dub + Original", 900, 2 * GB);
    expect(pickRelease(rankReleases([theatrical, sdFinal], blade, ru()), ru()).chosen?.result).toBe(theatrical);
    // As many seeders: the film as released.
    const ext = result(name("[2001, BDRip 1080p] [Extended Edition] Dub + Original Eng"), 20, 15 * GB);
    const th = result(name("[2001, BDRip 1080p] [Theatrical Cut] Dub + Original Eng"), 20, 12 * GB);
    expect(pickRelease(rankReleases([ext, th], lotr, ru()), ru()).edition).toBe("theatrical");
    // The sources screen's "any cut" card starts the same release as "Where to watch".
    expect(pickRelease(rankReleases([theatrical, final1080, final4k], blade, ru()), ru(), { voice: ANY, edition: ANY, picture: null }).chosen?.result).toBe(final1080);
  });
});

describe("a release whose name counts its voice-overs without naming them, its file read (F1)", () => {
  const GB = 1024 ** 3;
  const f1 = { title: "F1", originalTitle: null, kind: "movie" as const, year: 2025, originalLanguage: "en" };
  const uhd = result("F1 / F1: The Movie [2025, WEB-DL 2160p, HDR10, Dolby Vision] [Hybrid] 3x Dub (Movie Dubbing, Jaskier, RHS) + 6x MVO + AVO + VO + Dub (Ukr) + Original (Eng) + Sub (Rus, Ukr, Eng)", 28, 34.8 * GB);
  const fhd = result("F1 / F1: The Movie [2025, WEB-DL 1080p] Dub (Movie Dubbing, RHS, Jaskier) + MVO (Jaskier, TVShows, HDrezka, LostFilm) + AVO + VO + Dub (Ukr) + Original (Eng)", 124, 26.4 * GB);
  // The 4K file as a real TorrServer's ffprobe read it.
  const file = ["rus|Дубляж, Movie Dubbing", "rus|Дубляж, Jaskier", "rus|Дубляж, Red Head Sound", "rus|Дубляж, Dragon Studio", "rus|MVO, Jaskier", "rus|MVO, TVShows", "rus|MVO, HDRezka Studio", "rus|MVO, LostFilm", "rus|MVO, LE-Production", "rus|AVO, Ю. Сербин", "rus|VO, М. Яроцкий", "ukr|Дубляж, Postmodern", "eng|Original"];
  const tv = prefs({ languages: ["ru"], studios: ["LostFilm", "HDrezka Studio"], device: { hevc: true, hdr: true, uhd: true, dolbyVision: true } });

  it("knows LostFilm only in 1080p by the names alone", () => {
    const x = pickRelease(rankReleases([uhd, fhd], f1, tv), tv);
    expect(x.option?.studio).toBe("LostFilm");
    expect(x.options.find((o) => o.studio === "LostFilm")?.versions.map((v) => v.key)).toEqual(["1080"]);
    expect(x.chosen?.result).toBe(fhd);
  });

  it("knows LostFilm in 4K once the 4K file's tracks were read, and starts it on a 4K screen", () => {
    const ranked = rankReleases([uhd, fhd], f1, tv, null, null, (r) => (r === uhd ? file : null));
    const x = pickRelease(ranked, tv);
    expect(x.option?.studio).toBe("LostFilm");
    expect(x.options.find((o) => o.studio === "LostFilm")?.versions.map((v) => v.key)).toEqual(["1080", "2160-hdr"]);
    expect(x.chosen?.result).toBe(uhd);
    expect(ranked.find((r) => r.result === uhd)?.studio).toBe("LostFilm");
  });
});

describe("pickRelease", () => {
  const releases = [
    result(name("[2001, BDRemux 2160p, HDR10] [Extended Edition] Dub (Ukr) + Original Eng"), 80, 90e9),
    result(name("[2001, BDRip 1080p] [Extended Edition] Dub (Ukr) + Original Eng"), 40, 20e9),
    result(name("[2001, BDRip 1080p] [Theatrical Cut] Dub (Ukr) + Original Eng"), 30, 15e9),
    result(name("[2001, WEB-DL 1080p] Dub (Ukr) + Original Eng"), 20, 12e9),
    result(name("[2001, BDRip 1080p] [Theatrical Cut] Dub + MVO + Original Eng"), 90, 14e9),
  ];
  const p = prefs({ languages: ["uk"] });
  const ranked = rankReleases(releases, lotr, p);

  it("recommends the profile's audio, the most seeded cut and the mode's picture", () => {
    const x = pickRelease(ranked, p, NO_CHOICE);
    expect(x.option?.key).toBe("uk|dub");
    // Extended: 80 + 40 seeders, theatrical 30 + 20; the pill offers the other.
    expect(x.editions.map((e) => e.key)).toEqual(["extended", "theatrical"]);
    expect(x.edition).toBe("extended");
    expect(x.chosen?.result.title).toContain("BDRip 1080p] [Extended");
    expect(pickRelease(ranked, p, { voice: null, edition: "theatrical", picture: null }).chosen?.result.title).toContain("BDRip 1080p] [Theatrical");
    expect(x.versions.map((v) => v.key)).toEqual(["1080", "2160-hdr"]);
    expect(x.editions[0]!.resolutions).toEqual([2160, 1080]);
  });

  it("counts a release that names no cut as the theatrical one", () => {
    const x = pickRelease(ranked, p, { voice: null, edition: "theatrical", picture: null });
    expect(x.pool).toHaveLength(2);
    expect(x.pool.every((r) => !/Extended/.test(r.result.title))).toBe(true);
  });

  it("follows a picture chosen by hand, and the mode's pick again when it is not there", () => {
    expect(pickRelease(ranked, p, { voice: null, edition: "extended", picture: "2160-hdr" }).chosen?.result.title).toContain("2160p");
    expect(pickRelease(ranked, p, { voice: null, edition: "theatrical", picture: "2160-hdr" }).chosen?.result.title).toContain("1080p");
  });

  it("offers no cut when the audio's releases name none", () => {
    const plain = rankReleases([result(name("[2001, BDRip 1080p] Dub (Ukr)")), result(name("[2001, BDRip 720p] Dub (Ukr)"))], lotr, p);
    const x = pickRelease(plain, p);
    expect(x.editions).toEqual([]);
    expect(x.edition).toBeNull();
    expect(x.chosen?.info.resolution).toBe(1080);
  });

  it("says the cut when every release of the audio is the same one", () => {
    const ext = rankReleases([result(name("[2001, BDRip 1080p] [Extended Edition] Dub (Ukr)"))], lotr, p);
    const x = pickRelease(ext, p);
    expect(x.editions).toEqual([]);
    expect(x.edition).toBe("extended");
  });

  it("recommends nothing when nothing is alive", () => {
    const dead = rankReleases([result(name("[2001, BDRip 1080p] Dub (Ukr)"), 0)], lotr, p);
    expect(pickRelease(dead, p).chosen).toBeUndefined();
  });
});

describe("pickRelease for the sources screen (ANY)", () => {
  const releases = [
    result(name("[2001, BDRemux 2160p, HDR10] [Extended Edition] Dub (Ukr) + Original Eng"), 80, 90e9),
    result(name("[2001, BDRip 1080p] [Theatrical Cut] Dub (Ukr) + Original Eng"), 30, 15e9),
    result(name("[2001, BDRip 1080p] [Theatrical Cut] Dub + MVO + Original Eng"), 90, 14e9),
    result(name("[2001, BDRip 720p] MVO"), 0, 4e9),
  ];
  const p = prefs({ languages: ["uk"] });
  const ranked = rankReleases(releases, lotr, p);

  it("keeps every audio and every cut, and starts with the release Where to watch starts", () => {
    const x = pickRelease(ranked, p, { voice: ANY, edition: ANY, picture: null });
    expect(x.option).toBeUndefined();
    expect(x.pool).toHaveLength(3);
    expect(x.editions.map((e) => e.key).sort()).toEqual(["extended", "theatrical"]);
    // The profile's audio (Ukrainian dub) in its own cut — chosen alike on both (once the screen took the cut most
    // seeded across every audio). On this screen without 4K and HDR that is the theatrical 1080p: the extended cut,
    // seeded more, only comes as a 4K HDR Remux.
    expect(x.chosen).toBe(pickRelease(ranked, p).chosen);
    expect(x.chosen?.result.title).toContain("[Theatrical Cut] Dub (Ukr)");
    expect(x.edition).toBe("theatrical");
    // On a 4K HDR screen the extended cut it is, on both.
    const tv = prefs({ languages: ["uk"], device: { uhd: true, hdr: true } });
    const onTv = rankReleases(releases, lotr, tv);
    expect(pickRelease(onTv, tv).chosen?.result.title).toContain("[Extended Edition] Dub (Ukr)");
    expect(pickRelease(onTv, tv, { voice: ANY, edition: ANY, picture: null }).chosen).toBe(pickRelease(onTv, tv).chosen);
    expect(x.options.map((o) => o.key)).toEqual(pickRelease(ranked, p).options.map((o) => o.key));
  });

  it("narrows to an audio with every cut, and to a cut with every audio", () => {
    const uk = pickRelease(ranked, p, { voice: "uk|dub", edition: ANY, picture: null });
    expect(uk.pool.map((r) => r.result.title).every((t) => /Ukr/.test(t))).toBe(true);
    expect(uk.pool).toHaveLength(2);
    const cut = pickRelease(ranked, p, { voice: ANY, edition: "theatrical", picture: null });
    expect(cut.pool).toHaveLength(2);
    expect(cut.edition).toBe("theatrical");
  });

  it("leaves Where to watch as it was (no ANY, 12 options at most)", () => {
    expect(pickRelease(ranked, p, NO_CHOICE)).toEqual(pickRelease(ranked, p, NO_CHOICE, 12));
    expect(pickRelease(ranked, p, NO_CHOICE).option?.key).toBe("uk|dub");
  });
});

// "Dubbing" in the profile's studios, and kinds of translation that are no option.
describe("the profile's Dubbing, and multi-voice as no option of its own", () => {
  const dune2 = { title: "Dune: Part Two", originalTitle: null, kind: "movie" as const, year: 2024, originalLanguage: "en" };
  const dub = result("Dune: Part Two [2024, WEB-DL 1080p] Dub (Movie Dubbing) + Original (Eng)", 60);
  const lost = result("Dune: Part Two [2024, WEB-DL 1080p] MVO (LostFilm) + Original (Eng)", 60);
  const mvo = result("Dune: Part Two [2024, WEB-DL 1080p] MVO + Original (Eng)", 60);

  it("starts a dub, any studio's, when Dubbing comes first — picked from the list or typed in a language", () => {
    for (const first of [DUBBING, "Дубляж", "Dubbing"]) {
      const p = prefs({ languages: ["ru"], studios: [first, "LostFilm"] });
      const x = pickRelease(rankReleases([lost, dub], dune2, p), p);
      expect(x.chosen?.result).toBe(dub);
      expect(x.option?.voice).toBe("dub");
    }
    // LostFilm first: LostFilm, as before.
    const p = prefs({ languages: ["ru"], studios: ["LostFilm", DUBBING] });
    expect(pickRelease(rankReleases([dub, lost], dune2, p), p).chosen?.result).toBe(lost);
  });

  it("doesn't call a release dubbed for a Russian profile by its Ukrainian dub", () => {
    const ukDub = result("Dune: Part Two [2024, WEB-DL 1080p] MVO (LostFilm) + Dub (Ukr) + Original (Eng)", 60);
    const p = prefs({ languages: ["ru"], studios: [DUBBING] });
    expect(rankReleases([ukDub, dub], dune2, p)[0]!.result).toBe(dub);
  });

  it("offers a multi-voice track without a studio as its language, never as 'multi-voice'", () => {
    const plainDub = result("Dune: Part Two [2024, WEB-DL 1080p] Dub + Original (Eng)", 60);
    const keys = voiceOptions(rankReleases([mvo, lost, dub, plainDub], dune2, prefs({ languages: ["ru"] }))).map((o) => o.key);
    expect(keys).toContain("ru|");
    // A dub stays an option of its own, with its studio or without one.
    expect(keys).toEqual(expect.arrayContaining(["ru|dub", "ru|Movie Dubbing", "ru|LostFilm"]));
    expect(keys).not.toContain("ru|mvo");
  });

  it("plays a dub track when a language's dub was chosen, whatever studio comes first in the profile", () => {
    const tracks = [
      { index: 0, title: "MVO [LostFilm]", language: "rus", default: true },
      { index: 1, title: "Дубляж [Movie Dubbing]", language: "rus" },
      { index: 2, title: "Original", language: "eng" },
    ];
    expect(voiceTrack(tracks, voiceWish("ru|dub")!, ["LostFilm"])).toBe(1);
    expect(voiceTrack(tracks, voiceWish("ru|")!, ["LostFilm"])).toBe(0);
  });
});
