import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlaybackCapabilities } from "../src/lib/media/capabilities";
import { canRemuxInBrowser, screenPictureHeight } from "../src/lib/media/capabilities";
import { fitOf, parseRelease, type ReleasePrefs, rankReleases } from "../src/lib/media/releases";

// A phone like the POCO X4 Pro: HEVC in 8 bits up to 1080p, a 1080 × 2400 panel.
const phone: PlaybackCapabilities = {
  video: { h264: true, hevc: true, hevc10: false, av1: true, vp9: true, h264High10: false },
  audio: { aac: true, mp3: true, opus: true, flac: true, ac3: false, eac3: false, dts: false, truehd: false, vorbis: true },
  containers: { mp4: true, webm: true, mkv: "likely", ts: false, mov: false },
  hls: "mse",
  mse: true,
  mediaSource: "standard",
  mseAudio: { aac: true, mp3: true, opus: true, flac: true, ac3: false, eac3: false, dts: false },
  hdr: false,
  dolbyVision: false,
  maxHeight: 1080,
  pip: true,
  platform: "chromium/android",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("a 4K screen", () => {
  it("is one a 16:9 picture gets 1440 lines or more on, not a long phone", () => {
    expect(screenPictureHeight(393, 873, 2.75)).toBeLessThan(1440); // 1080 × 2400 phone
    expect(screenPictureHeight(1920, 1080, 2)).toBeGreaterThanOrEqual(1440); // 4K TV
    expect(screenPictureHeight(2560, 1440, 1)).toBeGreaterThanOrEqual(1440);
    expect(screenPictureHeight(1920, 1080, 1)).toBeLessThan(1440);
  });
});

describe("HEVC this device doesn't decode", () => {
  it("10-bit where it decodes 8 bits only: not rebuilt, said why", () => {
    expect(canRemuxInBrowser(phone, { container: "matroska,webm", videoCodec: "hevc", audioCodec: "aac", bitDepth: 10 })).toEqual({ ok: false, reason: "video hevc 10-bit" });
    expect(canRemuxInBrowser(phone, { container: "matroska,webm", videoCodec: "hevc", audioCodec: "aac", bitDepth: 8 }).ok).toBe(true);
  });

  it("4K where the browser refuses it and takes 1080p", async () => {
    const store = new Map([["lumovio.uhd-hevc", JSON.stringify({ ua: "test", decodes: false, smooth: false })]]);
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { userAgent: "test" });
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: () => {} });
    const caps = await import("../src/lib/media/capabilities");
    expect(caps.uhdDecodesNow()).toBe(false);
    expect(caps.uhdSmoothNow()).toBe(false);
    const file = { container: "matroska,webm", videoCodec: "hevc", audioCodec: "aac", bitDepth: 8 };
    expect(caps.canRemuxInBrowser(phone, { ...file, width: 3840, height: 1600 })).toEqual({ ok: false, reason: "video hevc 4K" });
    expect(caps.canRemuxInBrowser(phone, { ...file, width: 1920, height: 800 }).ok).toBe(true);
  });

  it("ranks after what plays: 4K and 10-bit HEVC count as not playing here, in Best too", () => {
    const device: ReleasePrefs["device"] = { hevc: true, hdr: false, uhd: false, dolbyVision: false, uhdSmooth: false, hevc10: false, uhdDecodes: false };
    expect(fitOf(parseRelease("Dune: Part Two (2024) WEB-DL [H.265/2160p] [4K, SDR, 8-bit]"), device)).toBe("poor");
    expect(fitOf(parseRelease("Frieren [WEB-DL 1080p HEVC 10-bit]"), device)).toBe("poor");
    expect(fitOf(parseRelease("Dune: Part Two (2024) WEB-DL 1080p HEVC"), device)).toBe("ok");
    expect(fitOf(parseRelease("Dune: Part Two (2024) WEB-DL 1080p HEVC"), { ...device, uhdDecodes: null, hevc10: undefined })).toBe("ok");
    const dune = { title: "Дюна: Часть вторая", originalTitle: "Dune: Part Two", kind: "movie" as const, year: 2024, originalLanguage: "en", runtime: 166 };
    const r = (title: string, size: number) => ({ title, link: `https://jackett.test/${size}`, hash: null, size, seeders: 50, peers: 5, tracker: "RuTracker.org", published: null });
    const uhd = r("Дюна: Часть вторая / Dune: Part Two (2024) WEB-DL 2160p HEVC SDR Dub", 25e9);
    const fhd = r("Дюна: Часть вторая / Dune: Part Two (2024) WEB-DL 1080p Dub", 10e9);
    expect(rankReleases([uhd, fhd], dune, { languages: ["ru"], studios: [], quality: "best", device })[0]!.result).toBe(fhd);
  });
});
