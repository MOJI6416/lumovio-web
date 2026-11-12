import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaNetError } from "../src/lib/media/net";
import type { FileProbe, TsSearchResult } from "../src/lib/media/torrserver";

// Reading a release's file ahead through the account's TorrServer: what is added, read and taken off again, what is
// never touched (a torrent already there, the server playing), what goes to the shared cache, and how a "Watch" pressed
// during a read takes the torrent the read brought. The server and the API are fakes.

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const server = { list: vi.fn(), quietAdd: vi.fn(), claim: vi.fn(), remove: vi.fn(), files: vi.fn(), readProbe: vi.fn() };
const apiCalls: { path: string; json?: unknown }[] = [];
vi.mock("../src/lib/api", () => ({
  api: async (path: string, init?: { json?: unknown }) => {
    apiCalls.push({ path, json: init?.json });
    if (path.endsWith("/lookup")) return { files: ((init?.json as { releases?: unknown[] } | undefined)?.releases ?? []).map(() => null) };
    return {};
  },
}));
vi.mock("../src/lib/media/clients", () => ({ getCredentials: async () => ({ id: "c1", baseUrl: "http://ts.test", auth: { kind: "torrserver" } }) }));
vi.mock("../src/lib/media/torrserver", async (original) => ({ ...(await original<object>()), torrServerClient: () => server }));

const { readRelease, readsToday } = await import("../src/lib/media/read-ahead");
const { addTorrentSource } = await import("../src/lib/media/torrent-source");
const { registerRead } = await import("../src/lib/media/read-lock");
const { failingTrackers } = await import("../src/lib/media/tracker-adds");

const NEW = "a".repeat(40);
const OWN = "b".repeat(40);
const job = { connectionId: "c1", titleId: "movie:693134", movie: true, year: 2024, season: null, episode: null };
const film = { id: "movie:693134" as const, title: "Dune: Part Two", year: 2024, posterPath: null };
const result = (extra: Partial<TsSearchResult> = {}): TsSearchResult => ({
  title: "Dune: Part Two (2024) BDRip 1080p | 3x Dub + 6x MVO",
  link: "https://jackett.test/dl/one",
  hash: null,
  size: 20e9,
  seeders: 120,
  peers: 4,
  tracker: "RuTracker.org",
  published: null,
  ...extra,
});
const probe: FileProbe = {
  format: { format_name: "matroska,webm", duration: "9960" },
  streams: [
    { index: 0, codec_type: "video", codec_name: "h264", width: 1920, height: 800 },
    { index: 1, codec_type: "audio", codec_name: "ac3", tags: { language: "rus", title: "Dub, Movie Dubbing" }, disposition: { default: 1 } },
    { index: 2, codec_type: "audio", codec_name: "ac3", tags: { language: "rus", title: "MVO, LostFilm" } },
  ],
};
const shared = () => apiCalls.filter((c) => c.path === "/api/releases/files");

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  apiCalls.length = 0;
  server.list.mockResolvedValue([{ hash: OWN, title: "[LAMPA] Dune 2", stat: 5 }]);
  server.quietAdd.mockResolvedValue({ hash: NEW });
  server.files.mockResolvedValue({ title: "", files: [{ id: 1, path: "Dune.Part.Two.2024.BDRip.1080p.mkv", length: 20e9 }] });
  server.readProbe.mockResolvedValue(probe);
  server.remove.mockResolvedValue(undefined);
  server.claim.mockResolvedValue({ hash: NEW });
});

describe("one read", () => {
  it("adds the release quietly, reads its file, shares it and takes it off again", async () => {
    const out = await readRelease(job, result(), new AbortController().signal);
    expect(out).toMatchObject({ kind: "read", hash: NEW, there: false });
    expect(server.quietAdd).toHaveBeenCalledWith("https://jackett.test/dl/one", expect.any(Number));
    expect(server.readProbe).toHaveBeenCalledWith(NEW, expect.objectContaining({ id: 1 }), expect.anything(), expect.any(Number));
    expect(server.remove).toHaveBeenCalledWith(NEW);
    expect(server.claim).not.toHaveBeenCalled();
    const read = shared()[0]!.json as { torrent: string; file: number; names: { name: string; size: number | null }[]; probe: { streams: unknown[] } };
    // Digests only: neither the hash nor the name reaches Lumovio.
    expect(read.torrent).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(read)).not.toContain(NEW);
    expect(JSON.stringify(read)).not.toContain("Dune");
    expect(read.file).toBe(1);
    expect(read.names).toEqual([{ name: expect.stringMatching(/^[a-f0-9]{64}$/), size: 20e9 }]);
    expect(read.probe.streams).toHaveLength(3);
    expect(store.get("lumovio.readAhead.left")).toBe("[]");
  });

  it("reads a torrent already on the server where it is, and leaves it there", async () => {
    server.list.mockResolvedValue([{ hash: OWN, title: "Dune: Part Two (2024) BDRip 1080p | 3x Dub + 6x MVO", torrent_size: 20.05e9, stat: 5 }]);
    const out = await readRelease(job, result(), new AbortController().signal);
    expect(out).toMatchObject({ kind: "read", hash: OWN, there: true });
    expect(server.quietAdd).not.toHaveBeenCalled();
    expect(server.remove).not.toHaveBeenCalled();
  });

  it("doesn't take a torrent of the same name and another size for the release", async () => {
    server.list.mockResolvedValue([{ hash: OWN, title: "Dune: Part Two (2024) BDRip 1080p | 3x Dub + 6x MVO", torrent_size: 8e9, stat: 5 }]);
    expect(await readRelease(job, result(), new AbortController().signal)).toMatchObject({ kind: "read", hash: NEW, there: false });
  });

  it("never reads while the server plays or loads a torrent", async () => {
    server.list.mockResolvedValue([{ hash: OWN, title: "Arcane S01", stat: 3 }]);
    expect(await readRelease(job, result(), new AbortController().signal)).toEqual({ kind: "busy" });
    expect(server.quietAdd).not.toHaveBeenCalled();
  });

  it("counts a tracker that gave the server no torrent as failing, as a failed add does", async () => {
    server.quietAdd.mockRejectedValue(new MediaNetError("http", "Server responded with 400", 400));
    expect(await readRelease(job, result({ tracker: "Kinozal" }), new AbortController().signal)).toEqual({ kind: "failed" });
    expect(failingTrackers().has("Kinozal")).toBe(true);
    expect(server.remove).not.toHaveBeenCalled();
  });

  it("doesn't blame the tracker for the server's own error", async () => {
    server.quietAdd.mockRejectedValue(new MediaNetError("http", "Server responded with 500", 500));
    expect(await readRelease(job, result({ tracker: "NoNaMe" }), new AbortController().signal)).toEqual({ kind: "failed" });
    expect(failingTrackers().has("NoNaMe")).toBe(false);
  });

  it("takes off what it brought when the file can't be read", async () => {
    server.readProbe.mockResolvedValue(null);
    expect(await readRelease(job, result(), new AbortController().signal)).toEqual({ kind: "failed" });
    expect(server.remove).toHaveBeenCalledWith(NEW);
    expect(shared()).toHaveLength(0);
  });
});

describe("a Watch pressed during a read", () => {
  it("stops the read, takes the torrent the read brought as new, and the read leaves it on the server", async () => {
    let release!: () => void;
    server.readProbe.mockImplementation(() => new Promise((ok) => (release = () => ok(null))));
    const ctrl = new AbortController();
    const held = registerRead("c1", () => ctrl.abort());
    const reading = readRelease(job, result(), ctrl.signal, held.quiet);
    await vi.waitFor(() => expect(server.readProbe).toHaveBeenCalled());
    // The server lists the read's torrent now; "Watch" adds the same release.
    server.list.mockResolvedValue([{ hash: OWN, title: "[LAMPA] Dune 2", stat: 5 }, { hash: NEW, title: "", stat: 3 }]);
    const added = await addTorrentSource("c1", film, null, result());
    expect(ctrl.signal.aborted).toBe(true);
    expect(added?.existed).toBe(false);
    expect(server.claim).toHaveBeenCalledWith(NEW, expect.any(String), expect.anything(), null);
    release();
    await reading;
    held.end();
    expect(server.remove).not.toHaveBeenCalled();
  });
});

describe("the day's reads", () => {
  it("are counted per server on this device", () => {
    expect(readsToday("c1")).toBe(0);
    readsToday("c1", 2);
    expect(readsToday("c1")).toBe(2);
    expect(readsToday("c2")).toBe(0);
  });
});
