import { describe, expect, it } from "vitest";
import { bestOf, rankReleases, type ReleasePrefs } from "../src/lib/media/releases";
import type { TsSearchResult } from "../src/lib/media/torrserver";
import { findMarks, findOf, findPictureText } from "../src/lib/torrent-finds";

const result = (title: string, seeders = 10): TsSearchResult => ({ title, link: `magnet:?xt=urn:btih:${title.length}`, hash: null, size: null, seeders, peers: null, tracker: "RuTracker.org", published: null });
const ARRIVAL = { title: "Прибытие", originalTitle: "Arrival", kind: "movie" as const, year: 2016, originalLanguage: "en" };
const prefs: ReleasePrefs = { languages: ["ru"], studios: ["Пифагор"], quality: "auto", device: { hevc: true, hdr: true, uhd: false, dolbyVision: false } };

/** A stored find keeps every picture version its audio option was found in, not only the best release's. */
describe("stored finds' picture versions", () => {
  const ranked = rankReleases(
    [
      result("Прибытие / Arrival (2016) BDRip 1080p | Dub (Пифагор) + Original Eng"),
      result("Прибытие / Arrival (2016) UHD BDRemux 2160p | HEVC | HDR10 | Dub (Пифагор)"),
      result("Прибытие / Arrival (2016) WEB-DL 2160p | HEVC | SDR | Dub (Пифагор)"),
      result("Прибытие / Arrival / 2016 / ПМ (LostFilm) / WEB-DL (720p)"),
    ],
    ARRIVAL,
    prefs,
  );

  it("are the profile's studio's versions, lowest first", () => {
    const f = findOf(bestOf(ranked), ranked);
    expect(f?.studio).toBe("Пифагор");
    expect(f?.pictures).toEqual([
      { resolution: 1080, range: null },
      { resolution: 2160, range: "sdr" },
      { resolution: 2160, range: "hdr" },
    ]);
    expect(findPictureText(f!)).toBe("1080p, 4K SDR, 4K HDR");
    // The card shows its best version as marks.
    expect(findMarks(f!)).toEqual(["4k", "hdr"]);
  });

  it("show the best version's marks: Dolby Vision over HDR at the top resolution, nothing without a resolution", () => {
    const find = (pictures: { resolution: 2160 | 1080 | 720 | 480 | null; range: "hdr" | "dv" | "sdr" | null }[]) => ({ language: "ru", voice: "dub" as const, studio: null, resolution: null, pictures });
    expect(findMarks(find([{ resolution: 1080, range: "hdr" }, { resolution: 2160, range: "dv" }, { resolution: 2160, range: "hdr" }]))).toEqual(["4k", "dv"]);
    expect(findMarks(find([{ resolution: 720, range: null }, { resolution: 1080, range: null }]))).toEqual(["hd"]);
    expect(findMarks(find([{ resolution: null, range: "hdr" }]))).toEqual([]);
    expect(findMarks({ language: "ru", voice: "dub", studio: null, resolution: 2160 })).toEqual(["4k"]);
  });

  it("fall back to the best release's resolution for a find kept before versions were", () => {
    expect(findPictureText({ language: "ru", voice: "dub", studio: null, resolution: 2160 })).toBe("4K");
    expect(findPictureText({ language: "ru", voice: "dub", studio: null, resolution: null })).toBeNull();
  });
});
