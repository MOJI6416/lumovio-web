import { beforeEach, describe, expect, it, vi } from "vitest";

// The owner's limits for reading ahead (2026-11-08): up to 5 releases a title, 2 at a time, 40 a day per TorrServer on a
// device, never while the server streams to a player; names that hide their studios first, then the best pictures.
type T = { hash: string; title: string; stat?: number; data?: string; poster?: string };
let torrents: T[] = [];
let now = 0;
let most = 0;
const peeks: string[] = [];
const hashOf = (link: string) => link.replace(/\W/g, "").padEnd(40, "0").slice(0, 40);
const fake = {
  list: async () => torrents.map((t) => ({ ...t })),
  peek: async (link: string, title: string) => {
    peeks.push(title);
    const t = { hash: hashOf(link), title, stat: 1 };
    torrents.push(t);
    return t;
  },
  set: async () => {},
  remove: async (hash: string) => {
    torrents = torrents.filter((t) => t.hash !== hash);
  },
  stat: async () => {
    now++;
    most = Math.max(most, now);
    await new Promise((r) => setTimeout(r, 5));
    now--;
    return { hash: "", title: "", file_stats: [{ id: 1, path: "film.mkv", length: 1 }] };
  },
  ffprobe: async () => ({ streams: [{ codec_type: "audio", tags: { language: "rus", title: "LostFilm" } }] }),
};
vi.mock("../src/lib/media/clients", () => ({ getCredentials: async () => ({ id: "c1", baseUrl: "http://ts", auth: { kind: "torrserver" } }) }));
vi.mock("../src/lib/media/torrserver", async () => ({ ...(await vi.importActual<object>("../src/lib/media/torrserver")), torrServerClient: () => fake }));
vi.mock("../src/lib/media/release-tracks", async () => ({ ...(await vi.importActual<object>("../src/lib/media/release-tracks")), saveTracks: async () => ({}) }));
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: globalThis,
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
});
const { readAhead, MAX_READS, AT_ONCE, DAILY_READS } = await import("../src/lib/media/read-ahead");
const { readOrder } = await import("../src/lib/media/release-tracks");
const { rankReleases } = await import("../src/lib/media/releases");

let n = 0;
const result = (title: string, seeders = 10) => ({ title, link: `http://jackett/dl/${++n}`, hash: null, size: 1, seeders, peers: 1, tracker: "T", published: null });
const job = (titleId: string, releases: ReturnType<typeof result>[]) =>
  new Promise<number>((done) => {
    let reads = 0;
    readAhead({ titleId, connectionId: "c1", releases, originalLanguage: "en", movie: true, year: 2020, season: null, episode: null, onRead: () => reads++ });
    setTimeout(() => done(reads), 2600);
  });

describe("reading ahead within the owner's limits", () => {
  beforeEach(() => {
    torrents = [];
    peeks.length = 0;
    most = 0;
    store.clear();
  });

  it("reads 5 releases of a title at most, 2 at a time", async () => {
    expect([MAX_READS, AT_ONCE, DAILY_READS]).toEqual([5, 2, 40]);
    const reads = await job("movie:1", Array.from({ length: 8 }, (_, i) => result(`Film ${i} 1080p MVO`)));
    expect(reads).toBe(5);
    expect(most).toBe(2);
    expect(torrents).toEqual([]);
  });

  it("reads nothing while the server streams to a player", async () => {
    torrents = [{ hash: "c".repeat(40), title: "Someone's film", stat: 3 }];
    expect(await job("movie:2", [result("Film A 1080p MVO")])).toBe(0);
    expect(peeks).toEqual([]);
  });

  it("stops at 40 reads a day through one TorrServer", async () => {
    store.set("lumovio.readAhead.c1", `${new Date().toISOString().slice(0, 10)}:40`);
    expect(await job("movie:3", [result("Film B 1080p MVO")])).toBe(0);
  });

  it("orders names that hide their studios first, then the best picture and seeders; skips what is known", () => {
    const d = { title: "Film", originalTitle: "Film", kind: "movie" as const, year: 2020, originalLanguage: "en" };
    const prefs = { languages: ["ru"], studios: ["LostFilm"], quality: "auto" as const, device: { hevc: true, hdr: true, uhd: true, dolbyVision: false } };
    const ranked = rankReleases(
      [result("Film 2020 2160p WEB-DL Dub (LostFilm)", 90), result("Film 2020 1080p WEB-DL MVO", 5), result("Film 2020 2160p WEB-DL MVO", 3), result("Film 2020 1080p BDRip Dub (Jaskier)", 50)],
      d,
      prefs,
    );
    const order = readOrder(ranked, new Set(["Film 2020 1080p BDRip Dub (Jaskier)"])).map((r) => r.title);
    expect(order).toEqual(["Film 2020 2160p WEB-DL MVO", "Film 2020 1080p WEB-DL MVO", "Film 2020 2160p WEB-DL Dub (LostFilm)"]);
  });
});

describe("reading ahead never spends the person's tracker downloads", () => {
  it("leaves out Kinozal's .torrent links and trackers that refused today; a magnet is free", async () => {
    const { spendsQuota, refusedToday } = await import("../src/lib/media/release-tracks");
    expect(spendsQuota({ link: "http://jackett/dl/kinozal/?x", tracker: "Kinozal.tv", origins: undefined })).toBe(true);
    expect(spendsQuota({ link: "magnet:?xt=urn:btih:abc", tracker: "Kinozal.tv", origins: undefined })).toBe(false);
    expect(spendsQuota({ link: "http://jackett/dl/rutracker/?x", tracker: "RuTracker.org", origins: undefined })).toBe(false);
    refusedToday("RuTracker.org");
    expect(spendsQuota({ link: "http://jackett/dl/rutracker/?x", tracker: "RuTracker.org", origins: undefined }, refusedToday())).toBe(true);
  });
});
