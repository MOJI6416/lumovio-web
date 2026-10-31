import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ api: vi.fn(async () => ({ ok: true })) }));
const { api } = await import("@/lib/api");
const { filesNumbering, namesNumbering, reportNumbering } = await import("@/lib/media/numbering-evidence");

const heist = { kind: "tv" as const, title: "Бумажный дом", originalTitle: "La casa de papel", year: 2017 };
const result = (title: string) => ({
  title,
  link: `https://jackett/${encodeURIComponent(title)}`,
  tracker: "RuTracker.org",
  size: null,
  seeders: 10,
  peers: 1,
  hash: null,
  date: null,
});

describe("what release names say about the seasons", () => {
  it("takes a season's length or highest episode from names of this title stating one season", () => {
    const items = namesNumbering(
      [
        result("Бумажный дом / La casa de papel [S01] (2017) WEB-DLRip | LostFilm | 1-13 из 13"),
        result(
          "Бумажный дом / La casa de papel / Сезон: 1 / Серии: 1-13 из 13 [2017, WEB-DL 1080p] MVO (LostFilm)",
        ),
        result("Бумажный дом (Сезон 2, Серии 1-9) / La casa de papel (2018) WEB-DL 1080p | LostFilm"),
        // The same name twice (two trackers) counts once; several seasons, anime cours and other titles say nothing.
        result("Бумажный дом (Сезон 2, Серии 1-9) / La casa de papel (2018) WEB-DL 1080p | LostFilm"),
        result("Бумажный дом / La casa de papel [S01-05] (2017-2021) WEB-DL 1080p"),
        result("Бумажный дом: Корея / Money Heist: Korea [S01] 1-12 из 12"),
        result("Money Heist - Berlin / Берлин [S01] (2023) 1-8 из 8"),
        result("Бумажный дом / La casa de papel (2010) [S01] 1-15 из 15"),
        result("Бумажный дом / La casa de papel [TV-2] 1-9 из 9"),
        result("La casa de papel - S3E1-8 - 2019  MVO (LostFilm), Sub WEBRip 1080p - RUSSIAN"),
        result(
          "La casa de papel / Money Heist / S5E1-5 of 10 [2021, HDR, WEBRip 2160p] Dub + 2x MVO (LostFilm, TVShows)",
        ),
      ],
      heist,
    );
    expect(items).toEqual([
      { season: 1, kind: "total", episodes: 13, releases: 2 },
      { season: 2, kind: "max", episodes: 9, releases: 1 },
      { season: 3, kind: "max", episodes: 8, releases: 1 },
      { season: 5, kind: "total", episodes: 10, releases: 1 },
    ]);
  });

  it("leaves out other series whose names start with the title", () => {
    const firefly = { kind: "tv" as const, title: "Светлячок", originalTitle: "Firefly", year: 2002 };
    const items = namesNumbering(
      [
        result("Светлячок / Firefly (2002) [S01] 1-14 из 14 BDRip 1080p"),
        result("Светлячок Лэйн / Firefly Lane [S02] 1-16 из 16 (2022)"),
        result("Firefly Lane / S2E1-16 of 16 [2022, WEB-DL 1080p]"),
      ],
      firefly,
    );
    expect(items).toEqual([{ season: 1, kind: "total", episodes: 14, releases: 1 }]);
  });
});

describe("what a torrent's files say", () => {
  it("gives each season's highest episode, the season from a file, its folder or the torrent's name", () => {
    const f = (path: string) => ({ id: 1, path, length: 1 });
    expect(
      filesNumbering(
        [
          f("La.casa.de.papel.S03E01.mkv"),
          f("La.casa.de.papel.S03E08.mkv"),
          f("Season 4/04.mkv"),
          f("Season 4/08.mkv"),
          f("Sample/S03E09.sample.mkv"),
          f("cover.jpg"),
        ],
        "Бумажный дом / La casa de papel (Сезоны 3-4)",
      ),
    ).toEqual([
      { season: 3, kind: "max", episodes: 8, releases: 1 },
      { season: 4, kind: "max", episodes: 8, releases: 1 },
    ]);
    // Numbers without a season anywhere are no evidence.
    expect(filesNumbering([f("01.mkv"), f("02.mkv")], "Jujutsu Kaisen [TV-1]")).toEqual([]);
  });

  it("sends a report once, only for a series and only with something in it", () => {
    reportNumbering("tv:71446", "files", [{ season: 3, kind: "max", episodes: 8, releases: 1 }]);
    reportNumbering("tv:71446", "files", [{ season: 3, kind: "max", episodes: 8, releases: 1 }]);
    reportNumbering("movie:27205", "names", [{ season: 1, kind: "max", episodes: 1, releases: 1 }]);
    reportNumbering("tv:1396", "names", []);
    expect(vi.mocked(api).mock.calls).toEqual([
      [
        "/api/numbering/evidence",
        {
          method: "POST",
          json: {
            titleId: "tv:71446",
            source: "files",
            seasons: [{ season: 3, kind: "max", episodes: 8, releases: 1 }],
          },
        },
      ],
    ]);
  });
});
