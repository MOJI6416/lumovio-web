import { describe, expect, it, vi } from "vitest";
import { costsDownload, DAILY, hidesStudios, noteTrackerRead, PER_TITLE, PER_VERSION, planReads, TRACKER_DAILY, trackerReadsToday } from "../src/lib/media/read-plan";
import { type ReleasePrefs, rankReleases } from "../src/lib/media/releases";
import type { TsSearchResult } from "../src/lib/media/torrserver";

const prefs = (p: Partial<ReleasePrefs> = {}): ReleasePrefs => ({
  languages: p.languages ?? ["ru"],
  studios: p.studios ?? ["LostFilm", "HDRezka"],
  quality: p.quality ?? "auto",
  device: { hevc: true, hdr: true, uhd: true, dolbyVision: true, ...p.device },
  ...(p.failingTrackers ? { failingTrackers: p.failingTrackers } : {}),
});
let n = 0;
const result = (rest: string, seeders = 50, o: { tracker?: string; magnet?: boolean } = {}): TsSearchResult => {
  const hash = (++n).toString(16).padStart(40, "0");
  return {
    title: `Дюна: Часть вторая / Dune: Part Two (2024) ${rest}`,
    link: o.magnet === false ? `http://jackett/dl/${hash}.torrent` : `magnet:?xt=urn:btih:${hash}`,
    hash: null,
    size: 20e9,
    seeders,
    peers: 1,
    tracker: o.tracker ?? "RuTracker.org",
    published: null,
  };
};
const dune = { title: "Дюна: Часть вторая", originalTitle: "Dune: Part Two", kind: "movie" as const, year: 2024, originalLanguage: "en" };
const none = () => false;
const plan = (results: TsSearchResult[], p = prefs(), ctx: { readsToday?: number; readsForTitle?: number; trackerReadsToday?: (t: string) => number } = {}, known = none) =>
  planReads(rankReleases(results, dune, p), known, { readsToday: ctx.readsToday ?? 0, prefs: p, readsForTitle: ctx.readsForTitle, trackerReadsToday: ctx.trackerReadsToday });

describe("planReads", () => {
  it("reads nothing for a profile without studios: no read changes its pick", () => {
    expect(plan([result("WEB-DL 1080p | MVO")], prefs({ studios: [] }))).toEqual([]);
  });

  it("leaves a version alone once a live release in it credits the profile's first studio", () => {
    const lost = result("WEB-DL 1080p | MVO (LostFilm)", 80);
    const hidden1080 = result("BDRip 1080p | MVO", 300);
    const uhd = [result("UHD WEB-DL 2160p HDR | 6x MVO", 90), result("UHD WEB-DL 2160p HDR | MVO", 60), result("UHD WEB-DL 2160p HDR | многоголосый", 40)];
    const got = plan([lost, hidden1080, ...uhd]);
    // 1080p is settled by LostFilm; 4K HDR is not: its two best releases that hide studios, not the third.
    expect(got).toEqual(uhd.slice(0, PER_VERSION));
  });

  it("an almost dead release of the first studio settles nothing: it would never be the one that plays", () => {
    const dying = result("WEB-DL 1080p | MVO (LostFilm)", 2);
    const hidden = result("WEB-DL 1080p | MVO", 120);
    expect(plan([dying, hidden])).toEqual([hidden]);
  });

  it("reads the versions in rank order: the one Watch starts first", () => {
    const hd = result("WEB-DL 1080p | MVO", 100);
    const uhd = result("UHD WEB-DL 2160p HDR | MVO", 100);
    // A 4K HDR screen starts 4K; a 1080p one starts 1080p.
    expect(plan([hd, uhd])).toEqual([uhd, hd]);
    expect(plan([hd, uhd], prefs({ device: { hevc: true, hdr: false, uhd: false, dolbyVision: false } }))).toEqual([hd, uhd]);
  });

  it("reads the sharp versions only: 1080p and 4K, else the title's best", () => {
    const hd = result("WEB-DL 1080p | MVO", 100);
    const sd = result("BDRip 720p | MVO", 300);
    const unstated = result("BDRip-AVC | MVO", 300);
    expect(plan([hd, sd, unstated])).toEqual([hd]);
    expect(plan([sd, result("DVDRip 480p | MVO", 300)])).toEqual([sd]);
    expect(plan([unstated])).toEqual([unstated]);
  });

  it("skips what a read can't use or wouldn't get", () => {
    const named = result("WEB-DL 1080p | MVO (HDRezka)", 100);
    const cam = result("CAMRip | MVO", 100);
    const dead = result("BDRip 720p | MVO", 0);
    const thin = result("WEB-DL 1080p | MVO", 2);
    const dv = result("UHD WEB-DL 2160p DV | MVO", 100);
    const failing = result("BDRip 1080p | MVO", 100, { tracker: "NoNaMe-Club" });
    const cached = result("WEBRip 1080p | MVO", 100);
    const good = result("HDTV 1080p | MVO", 100);
    const p = prefs({ device: { hevc: true, hdr: true, uhd: true, dolbyVision: false }, failingTrackers: new Set(["NoNaMe-Club"]) });
    expect(plan([named, cam, dead, thin, dv, failing, cached, good], p, {}, (r) => r === cached)).toEqual([good]);
  });

  it("never spends a quota tracker's .torrent downloads; a magnet of it costs nothing", () => {
    const kinozal = result("WEB-DL 1080p | MVO", 300, { tracker: "Kinozal", magnet: false });
    const kinozalMagnet = result("BDRip 1080p | MVO", 200, { tracker: "Kinozal" });
    expect(costsDownload(kinozal)).toBe(true);
    expect(costsDownload(kinozalMagnet)).toBe(false);
    expect(plan([kinozal, kinozalMagnet])).toEqual([kinozalMagnet]);
  });

  it("a tracker's .torrent downloads stop at its day's budget, counting the ones planned", () => {
    const a = result("WEB-DL 1080p | MVO", 100, { magnet: false });
    const b = result("UHD WEB-DL 2160p HDR | MVO", 100, { magnet: false });
    const c = result("UHD WEB-DL 2160p DV | MVO", 100, { magnet: false });
    expect(plan([a, b, c], prefs(), { trackerReadsToday: () => TRACKER_DAILY - 2 })).toHaveLength(2);
    expect(plan([a, b, c], prefs(), { trackerReadsToday: () => TRACKER_DAILY })).toEqual([]);
  });

  it("counts a tracker's .torrent downloads by day and server, not a magnet's", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    vi.useFakeTimers({ now: new Date("2026-11-12T10:00:00Z") });
    try {
      const torrent = result("WEB-DL 1080p | MVO", 100, { magnet: false });
      noteTrackerRead("server-a", torrent);
      noteTrackerRead("server-a", torrent);
      noteTrackerRead("server-a", result("BDRip 1080p | MVO"));
      noteTrackerRead("server-b", torrent);
      expect(trackerReadsToday("server-a")("RuTracker.org")).toBe(2);
      expect(trackerReadsToday("server-b")("RuTracker.org")).toBe(1);
      vi.setSystemTime(new Date("2026-11-13T00:30:00Z"));
      expect(trackerReadsToday("server-a")("RuTracker.org")).toBe(0);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("keeps to the day's and the title's budget", () => {
    const many = [1080, 2160].flatMap((res) => ["WEB-DL", "BDRip", "WEBRip"].map((s, i) => result(`${s} ${res}p${res === 2160 ? " HDR" : ""} | MVO`, 100 - i)));
    expect(plan(many)).toHaveLength(2 * PER_VERSION);
    expect(plan(many, prefs(), { readsToday: DAILY - 1 })).toHaveLength(1);
    expect(plan(many, prefs(), { readsToday: DAILY })).toEqual([]);
    expect(plan(many, prefs(), { readsForTitle: PER_TITLE - 3 })).toHaveLength(3);
    expect(plan(many, prefs(), { readsForTitle: PER_TITLE })).toEqual([]);
  });

  it("knows a name that hides its studios", () => {
    const rank = (rest: string) => rankReleases([result(rest)], dune, prefs())[0]!;
    expect(hidesStudios(rank("WEB-DL 1080p | MVO"))).toBe(true);
    expect(hidesStudios(rank("WEB-DL 1080p | многоголосый"))).toBe(true);
    expect(hidesStudios(rank("WEB-DL 1080p | MVO (LostFilm)"))).toBe(false);
    expect(hidesStudios(rank("WEB-DL 1080p | Dub (Пифагор) + MVO"))).toBe(true);
  });
});
