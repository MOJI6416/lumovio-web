import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lineSpeed, noteLine, watchLine } from "../src/lib/media/line-speed";
import { packOf, type ReleasePrefs, rankReleases, releaseBps } from "../src/lib/media/releases";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a release's bytes per second", () => {
  it("is a film's size over its runtime, a pack's over its episodes'", () => {
    expect(releaseBps(packOf("Dune (2021) BDRip 1080p"), 9.96e9, "movie", 166)).toBeCloseTo(1e6, -3);
    expect(releaseBps(packOf("Fargo / S1E1-10 of 10 [2014, WEB-DL 1080p]"), 30e9, "tv", 50)).toBeCloseTo(1e6, -3);
  });

  it("isn't known for an updating pack, an unknown runtime or size", () => {
    expect(releaseBps(packOf("Fargo / S5E1-3 of 10 [2023, WEB-DL 1080p]"), 9e9, "tv", 50)).not.toBeNull();
    expect(releaseBps(packOf("Fargo - S5E1- из 10 - WEB-DL 1080p"), 9e9, "tv", 50)).toBeNull();
    expect(releaseBps(packOf("Dune (2021) BDRip 1080p"), 9e9, "movie", null)).toBeNull();
    expect(releaseBps(packOf("Dune (2021) BDRip 1080p"), null, "movie", 155)).toBeNull();
  });
});

describe("Auto by the line to the server", () => {
  const dune = { title: "Дюна", originalTitle: "Dune", kind: "movie" as const, year: 2021, originalLanguage: "en", runtime: 155 };
  const r = (title: string, size: number) => ({ title, link: `https://jackett.test/${size}`, hash: null, size, seeders: 50, peers: 5, tracker: "RuTracker.org", published: null });
  const remux = r("Дюна / Dune (2021) UHD BDRemux 2160p HDR Dub", 80e9); // ~8.6 MB/s
  const rip = r("Дюна / Dune (2021) BDRip 1080p Dub", 12e9); // ~1.3 MB/s
  const prefs = (p: Partial<ReleasePrefs>): ReleasePrefs => ({ languages: ["ru"], studios: [], quality: "auto", device: { hevc: true, hdr: true, uhd: true, dolbyVision: true }, ...p });

  it("puts a release the line can't carry after one it can, as 4K on a screen without it", () => {
    expect(rankReleases([remux, rip], dune, prefs({}))[0]!.result).toBe(remux);
    expect(rankReleases([remux, rip], dune, prefs({ lineBps: 5e6 }))[0]!.result).toBe(rip);
    expect(rankReleases([remux, rip], dune, prefs({ lineBps: 20e6 }))[0]!.result).toBe(remux);
  });

  it("leaves Best and Smaller file as they are", () => {
    expect(rankReleases([remux, rip], dune, prefs({ quality: "best", lineBps: 5e6 }))[0]!.result).toBe(remux);
  });
});

describe("the line kept per server", () => {
  it("is the best of the last five playbacks within 30 days", () => {
    const now = Date.parse("2026-11-12T12:00:00Z");
    noteLine("torr", 9e6, now - 40 * 86_400_000);
    for (const bps of [3e6, 5e6, 4e6]) noteLine("torr", bps, now - 86_400_000);
    expect(lineSpeed("torr", now)).toBe(5e6);
    expect(lineSpeed("other", now)).toBeNull();
    for (const bps of [1e6, 1e6, 1e6, 1e6, 1e6]) noteLine("torr", bps, now);
    expect(lineSpeed("torr", now)).toBe(1e6);
  });
});

describe("watching a playback's buffer", () => {
  it("tells the picture seconds arriving per second times the file's bytes per second, once", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    let end = 0;
    const video = { currentTime: 0, seeking: false, buffered: { length: 1, start: () => 0, end: () => end } } as unknown as HTMLVideoElement;
    const told: number[] = [];
    const stop = watchLine(video, 1e6, (bps) => told.push(bps));
    // 2 s of picture a second until the buffer runs 25 s ahead (the line carries it): told then, once.
    for (let s = 0; s < 20; s++) {
      end += 2;
      vi.advanceTimersByTime(1000);
    }
    stop();
    expect(told).toHaveLength(1);
    expect(told[0]).toBeCloseTo(2e6, -4);
  });

  it("starts when the buffer shows: what came before the header was read isn't one second's", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    let end: number | null = null;
    const video = { currentTime: 0, seeking: false, buffered: { get length() { return end === null ? 0 : 1; }, start: () => 0, end: () => end } } as unknown as HTMLVideoElement;
    const told: number[] = [];
    watchLine(video, 1e6, (bps) => told.push(bps));
    for (let s = 0; s < 3; s++) vi.advanceTimersByTime(1000);
    end = 6;
    for (let s = 0; s < 10; s++) {
      vi.advanceTimersByTime(1000);
      end += 3;
    }
    expect(told).toHaveLength(1);
    expect(told[0]).toBeCloseTo(3e6, -4);
  });

  it("tells a line that fills 25 s within a second by that second", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    let end = 0;
    const video = { currentTime: 0, seeking: false, buffered: { length: 1, start: () => 0, end: () => end } } as unknown as HTMLVideoElement;
    const told: number[] = [];
    watchLine(video, 1e6, (bps) => told.push(bps));
    vi.advanceTimersByTime(1000);
    end = 30;
    vi.advanceTimersByTime(1000);
    expect(told).toEqual([30e6]);
  });
});
