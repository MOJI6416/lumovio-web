import { describe, expect, it } from "vitest";
import { ANY, editionOf, forProfile, NO_CHOICE, pickRelease } from "../src/lib/media/release-pick";
import { type ReleasePrefs, rankReleases, voiceOptions } from "../src/lib/media/releases";
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

  it("recommends the profile's audio, the best release's cut and the mode's picture", () => {
    const x = pickRelease(ranked, p, NO_CHOICE);
    expect(x.option?.key).toBe("uk|dub");
    expect(x.editions.map((e) => e.key)).toEqual(["extended", "theatrical"]);
    expect(x.edition).toBe("extended");
    expect(x.chosen?.result.title).toContain("BDRip 1080p] [Extended");
    expect(x.versions.map((v) => v.key)).toEqual(["1080", "2160-hdr"]);
    expect(x.editions[0]!.resolutions).toEqual([2160, 1080]);
  });

  it("counts a release that names no cut as the theatrical one", () => {
    const x = pickRelease(ranked, p, { voice: null, edition: "theatrical", picture: null });
    expect(x.pool).toHaveLength(2);
    expect(x.pool.every((r) => !/Extended/.test(r.result.title))).toBe(true);
  });

  it("follows a picture chosen by hand, and the mode's pick again when it is not there", () => {
    expect(pickRelease(ranked, p, { voice: null, edition: null, picture: "2160-hdr" }).chosen?.result.title).toContain("2160p");
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

  it("keeps every audio and every cut, and picks the best of all", () => {
    const x = pickRelease(ranked, p, { voice: ANY, edition: ANY, picture: null });
    expect(x.option).toBeUndefined();
    expect(x.pool).toHaveLength(3);
    // The best alive release of the title, whatever its audio (the dead MVO release is never picked).
    expect(x.chosen).toBe(ranked.find((r) => !r.dead));
    expect(x.editions.map((e) => e.key).sort()).toEqual(["extended", "theatrical"]);
    // The cut shown is the chosen release's own (auto on a screen without 4K: the theatrical 1080p).
    expect(x.chosen?.result.title).toContain("BDRip 1080p] [Theatrical");
    expect(x.edition).toBe("theatrical");
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
