import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickRelease } from "../src/lib/media/release-pick";
import { DUBBING, profileTrack, type ReleasePrefs, rankReleases, trackVoiceKey, voiceTrack, voiceWish } from "../src/lib/media/releases";
import type { TsSearchResult } from "../src/lib/media/torrserver";
import { loadVoice, saveVoice, voiceMemoryKey } from "../src/lib/media/voice-memory";

const device = { hevc: true, hdr: false, uhd: false, dolbyVision: false };
const prefs = (p: Partial<ReleasePrefs> = {}): ReleasePrefs => ({ languages: ["ru"], studios: ["LostFilm"], quality: "auto", device, ...p });
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
const severance = { title: "Разделение", originalTitle: "Severance", kind: "tv" as const, year: 2022, originalLanguage: "en" };

describe("the audio a track picked in the player is", () => {
  it("its studio, its dub or its language, as the releases' options are keyed", () => {
    expect(trackVoiceKey("rus", "Дубляж", "en")).toBe("ru|dub");
    expect(trackVoiceKey("rus", "MVO LostFilm", "en")).toBe("ru|LostFilm");
    expect(trackVoiceKey("rus", "Dub (Red Head Sound)", "en")).toBe("ru|Red Head Sound");
    expect(trackVoiceKey("eng", "Original", "en")).toBe("en|");
    expect(trackVoiceKey("rus", "FoxCrime AC3 2.0 192 Kbps", "en")).toBe("ru|FoxCrime");
    expect(trackVoiceKey("rus", "FoxCrime @ DTS @ 5.1 @ 1.5Mbps", "en")).toBe("ru|FoxCrime");
    expect(trackVoiceKey("rus", "Невафильм", "en")).toBe("ru|Невафильм");
    expect(trackVoiceKey("rus", "AC3 2.0", "en")).toBe("ru|");
    expect(trackVoiceKey("rus", "Русский", "en")).toBe("ru|");
  });
});

describe("the audio picked for a title", () => {
  const both = result("Severance / S2E1-10 of 10 [2025, WEB-DL 1080p] Dub + MVO (LostFilm) + Original + Sub (Rus, Eng)");
  const lostOnly = result("Severance - S2 - rus 1080p WEBDL (LostFilm)", 200);

  it("is offered first, ahead of the profile's order of studios", () => {
    const own = prefs();
    expect(pickRelease(rankReleases([both, lostOnly], severance, own, 2), own).option?.key).toBe("ru|LostFilm");
    const picked = prefs({ voice: "ru|dub" });
    const x = pickRelease(rankReleases([both, lostOnly], severance, picked, 2), picked);
    expect(x.option?.key).toBe("ru|dub");
    expect(x.chosen?.result).toBe(both);
  });

  it("gives way when no live release has it", () => {
    const gone = prefs({ voice: "ru|HDrezka Studio" });
    expect(pickRelease(rankReleases([both, lostOnly], severance, gone, 2), gone).option?.key).toBe("ru|LostFilm");
    const dying = prefs({ voice: "ru|dub" });
    const dead = result("Severance / S2E1-10 of 10 [2025, WEB-DL 1080p] Dub + Original", 1);
    expect(pickRelease(rankReleases([dead, lostOnly], severance, dying, 2), dying).option?.key).toBe("ru|LostFilm");
  });
});

describe("the audio memory", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  });

  it("keeps one audio per profile and title", () => {
    const a = voiceMemoryKey("p1", "tv:95396");
    saveVoice(a, "ru|dub");
    expect(loadVoice(a)).toBe("ru|dub");
    expect(loadVoice(voiceMemoryKey("p2", "tv:95396"))).toBeNull();
    saveVoice(a, "ru|LostFilm");
    expect(loadVoice(a)).toBe("ru|LostFilm");
  });
});

describe("a dub the file names by its studio alone", () => {
  // Severance S1 BDRip, as its file names its tracks.
  const tracks = ["Невафильм", "HDrezka Studio", "HDrezka Studio (18+)", "AlexFilm", "TVShows", "LostFilm"].map((title, i) => ({ index: i + 1, title, language: "rus", default: i === 0 }));
  tracks.push({ index: 7, title: "Original", language: "eng", default: false });
  const name = "Severance / S1E1-9 of 9 [2022, BDRip 1080p] Dub + 4 x MVO (HDrezka Studio, AlexFilm, TVShows, LostFilm) + Original + Sub (Rus, Eng)";
  const profile = { languages: ["ru"], studios: [DUBBING, "LostFilm"] };

  it("is the one track the release's other studios don't credit", () => {
    expect(profileTrack(tracks, profile, name)).toBe(1);
    expect(voiceTrack(tracks, voiceWish("ru|dub")!, profile.studios, name)).toBe(1);
  });

  it("is its studio when the name credits the dub's studio", () => {
    const rhs = [
      { index: 1, title: "Red Head Sound", language: "rus", default: true },
      { index: 2, title: "LostFilm", language: "rus", default: false },
    ];
    expect(profileTrack(rhs, profile, "Severance S02 [2025, WEB-DL 1080p] Dub (Red Head Sound) + MVO (LostFilm)")).toBe(1);
  });

  it("is found again by the name it was picked under", () => {
    expect(voiceTrack(tracks, voiceWish(trackVoiceKey("rus", "Невафильм", "en"))!, [], null)).toBe(1);
  });

  it("isn't guessed without a name that tells", () => {
    expect(profileTrack(tracks, profile, null)).toBe(6);
    expect(profileTrack(tracks, profile, "Severance / S1E1-9 of 9 [2022, BDRip 1080p] Dub + MVO + Original")).toBe(6);
  });
});
