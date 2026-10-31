import type { ConnectionTorrentIndex, TorrentIndexEntry } from "@lumovio/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaNetError } from "../src/lib/media/net";

// TS7: removing torrents from a TorrServer and reconciling Lumovio's index with what the server
// really has. The server and the API are fakes; the order and content of the calls is the point.

const server = { list: vi.fn(), remove: vi.fn() };
const apiCalls: { path: string; json?: unknown }[] = [];
let apiAnswer: (path: string, json: unknown) => unknown = () => ({});
vi.mock("../src/lib/api", () => ({
  api: async (path: string, init?: { json?: unknown }) => {
    apiCalls.push({ path, json: init?.json });
    const r = apiAnswer(path, init?.json);
    if (r instanceof Error) throw r;
    return r;
  },
  ApiRequestError: class extends Error {},
}));
vi.mock("../src/lib/media/torrent-source", () => ({ torrServerFor: async () => server }));

const { asTorrentList, loadTorrentManager, managedTorrents, presenceIn, removalScope, removeVia, staleHashes } = await import("../src/lib/media/torrent-manage");

const H = { film: "a".repeat(40), k4: "b".repeat(40), k1080: "c".repeat(40), pack: "d".repeat(40), other: "e".repeat(40) };
const listed = (hash: string, extra: Record<string, unknown> = {}) => ({ hash, title: `T ${hash.slice(0, 3)}`, ...extra });
const link = (titleId: string, externalId: string, season: number | null = null, episode: number | null = null, label: string | null = null) => ({
  titleId: titleId as never,
  season,
  episode,
  externalId,
  label,
  quality: null,
});
const PACK: TorrentIndexEntry = {
  hash: H.pack,
  links: [link("tv:100", H.pack, null, null, "Fixture Show S02 1080p"), ...[1, 2, 3].map((e) => link("tv:100", `${H.pack}:${e}`, 2, e))],
};

/** A server whose list reflects removals, unless a hash is read-only or `rem` fails for it. */
function fakeServer(hashes: string[], opts: { readOnly?: string[]; failing?: Record<string, Error>; listError?: Error } = {}) {
  const present = new Set(hashes);
  server.remove.mockImplementation(async (h: string) => {
    if (opts.failing?.[h]) throw opts.failing[h];
    if (!opts.readOnly?.includes(h)) present.delete(h);
  });
  server.list.mockImplementation(async () => {
    if (opts.listError) throw opts.listError;
    return [...present].map((h) => listed(h));
  });
  return present;
}
const forget = vi.fn(async (hashes: string[]) => Object.fromEntries(hashes.map((h) => [h, h === H.pack ? 4 : 1])));

beforeEach(() => {
  vi.clearAllMocks();
  apiCalls.length = 0;
  apiAnswer = () => ({});
});

describe("removing torrents from a TorrServer", () => {
  it("one film, one torrent: removed on the server, checked in its list, then its links leave the index", async () => {
    fakeServer([H.film, H.other]);
    const out = await removeVia(server, forget, [H.film]);
    expect(server.remove).toHaveBeenCalledWith(H.film);
    expect(forget).toHaveBeenCalledWith([H.film]);
    expect(out).toEqual([{ hash: H.film, status: "removed", links: 1, error: null }]);
  });

  it("1080p and 4K of one title: only the chosen version goes", async () => {
    const left = fakeServer([H.k1080, H.k4]);
    const out = await removeVia(server, forget, [H.k4.toUpperCase()]);
    expect(server.remove).toHaveBeenCalledTimes(1);
    expect(forget).toHaveBeenCalledWith([H.k4]);
    expect([...left]).toEqual([H.k1080]);
    expect(out.map((r) => r.status)).toEqual(["removed"]);
  });

  it("a read-only server answers 200 but keeps the torrent: no success, the index is untouched", async () => {
    fakeServer([H.film], { readOnly: [H.film] });
    const out = await removeVia(server, forget, [H.film]);
    expect(out).toEqual([{ hash: H.film, status: "still_there", links: 0, error: null }]);
    expect(forget).not.toHaveBeenCalled();
  });

  it("bulk with one failing: the others are removed, the failing one is reported with its error", async () => {
    const boom = new MediaNetError("http", "Server responded with 500", 500);
    fakeServer([H.film, H.pack, H.other], { failing: { [H.pack]: boom } });
    const progress: number[] = [];
    const out = await removeVia(server, forget, [H.film, H.pack, H.other], (done) => progress.push(done));
    expect(progress).toEqual([1, 2, 3]);
    expect(forget).toHaveBeenCalledWith([H.film, H.other]);
    expect(out.map((r) => [r.hash, r.status])).toEqual([
      [H.film, "removed"],
      [H.pack, "still_there"],
      [H.other, "removed"],
    ]);
    expect(out[1]!.error).toBe(boom);
  });

  it("an offline server: no more requests after it's clearly unreachable, nothing is claimed, the index is untouched", async () => {
    const timeout = new MediaNetError("timeout", "The server didn't answer in time");
    fakeServer([H.film, H.k4, H.other], { failing: { [H.film]: timeout, [H.k4]: timeout, [H.other]: timeout }, listError: timeout });
    const out = await removeVia(server, forget, [H.film, H.k4, H.other]);
    expect(server.remove).toHaveBeenCalledTimes(1);
    expect(out.every((r) => r.status === "unknown" && r.error === timeout)).toBe(true);
    expect(forget).not.toHaveBeenCalled();
  });

  it("a request that timed out after the server did remove it counts as removed: the list decides", async () => {
    const present = fakeServer([H.film]);
    server.remove.mockImplementationOnce(async (h: string) => {
      present.delete(h);
      throw new MediaNetError("timeout", "late");
    });
    expect((await removeVia(server, forget, [H.film]))[0]!.status).toBe("removed");
  });

  it("a list that isn't a list is a failed read, never an empty server", async () => {
    fakeServer([H.film]);
    server.list.mockResolvedValueOnce(null);
    const out = await removeVia(server, forget, [H.film]);
    expect(out[0]!.status).toBe("unknown");
    expect(forget).not.toHaveBeenCalled();
  });

  it("removed from the server but Lumovio's API failed: a partial result to retry, never a re-add", async () => {
    fakeServer([H.pack]);
    const down = new Error("Network error");
    const out = await removeVia(server, async () => Promise.reject(down), [H.pack]);
    expect(out).toEqual([{ hash: H.pack, status: "index_pending", links: 0, error: down }]);
    expect(server.remove).toHaveBeenCalledTimes(1);
  });
});

describe("the server's list next to the index", () => {
  it("rejects anything but a list of torrents with hashes", () => {
    expect(() => asTorrentList(null)).toThrow();
    expect(() => asTorrentList({ torrents: [] })).toThrow();
    expect(() => asTorrentList([{ title: "no hash" }])).toThrow();
    expect(asTorrentList([])).toEqual([]);
  });

  it("keeps torrents Lumovio doesn't know under their own name, with size, activity and release facts", () => {
    const rows = managedTorrents(
      [
        listed(H.other, { name: "Some.Show.S01.2160p.HDR.mkv", torrent_size: 5 * 1024 ** 3, stat: 3, timestamp: 1 }),
        listed(H.pack, { title: "Fixture Show (2020)", data: JSON.stringify({ lumovio: { titleId: "tv:100" } }), file_stats: [{ id: 1, path: "a.mp4", length: 100 }], timestamp: 2 }),
      ],
      [PACK],
    );
    expect(rows.map((r) => r.hash)).toEqual([H.pack, H.other]);
    // Added under the film's name before SRC-06: that name is what it was added for.
    expect(rows[0]).toMatchObject({ name: "Fixture Show (2020)", fromLumovio: true, addedFor: "Fixture Show (2020)", sizeBytes: 100, active: false, release: { resolution: 1080 } });
    expect(rows[0]!.links).toHaveLength(4);
    expect(rows[1]).toMatchObject({ name: "Some.Show.S01.2160p.HDR.mkv", links: [], fromLumovio: false, addedFor: null, active: true, sizeBytes: 5 * 1024 ** 3, release: { resolution: 2160, hdr: true } });
  });

  it("names a torrent added from Lumovio by its release, and keeps the film it was added for (SRC-06)", () => {
    const release = "Дюна / Dune (2021) WEB-DL 2160p | HEVC | SDR | MVO (HDrezka Studio)";
    const [row] = managedTorrents([listed(H.other, { title: release, data: JSON.stringify({ lumovio: { titleId: "movie:438631", season: null, title: "Дюна (2021)" } }) })], []);
    expect(row).toMatchObject({ name: release, fromLumovio: true, addedFor: "Дюна (2021)", release: { resolution: 2160, studios: ["HDrezka Studio"] } });
  });

  it("a season pack's scope is every episode bound to it", () => {
    expect(removalScope(PACK)).toEqual({ titles: ["tv:100"], episodes: 3, films: 0 });
  });

  it("finds links of torrents a full list doesn't have", () => {
    expect(staleHashes([PACK, { hash: H.film, links: [link("movie:1", H.film)] }], [listed(H.film)])).toEqual([H.pack]);
  });
});

describe("opening the manager", () => {
  const index = (torrents: TorrentIndexEntry[]): ConnectionTorrentIndex => ({ torrents, titles: { "tv:100": { title: "Fixture Show", year: 2020, posterPath: null } } });

  it("reads the index before the server's list, and forgets torrents removed in TorrServer's own UI", async () => {
    const order: string[] = [];
    apiAnswer = (path, json) => {
      order.push(path.endsWith("/torrents") ? "index" : "forget");
      return path.endsWith("/torrents") ? index([PACK, { hash: H.film, links: [link("movie:1", H.film)] }]) : { removed: Object.fromEntries((json as { hashes: string[] }).hashes.map((h) => [h, 4])) };
    };
    server.list.mockImplementation(async () => {
      order.push("list");
      return [listed(H.film), listed(H.other)];
    });
    const d = await loadTorrentManager("conn-1");
    expect(order).toEqual(["index", "list", "forget"]);
    expect(apiCalls[1]).toEqual({ path: "/api/connections/conn-1/index/forget", json: { hashes: [H.pack] } });
    expect(d.reconciled).toEqual([{ hash: H.pack, status: "removed", links: 4, error: null }]);
    expect(d.torrents.map((t) => [t.hash, t.links.length])).toEqual([
      [H.film, 1],
      [H.other, 0],
    ]);
  });

  it("a failed list read throws and forgets nothing", async () => {
    apiAnswer = () => index([PACK]);
    server.list.mockRejectedValue(new MediaNetError("unreachable", "down"));
    await expect(loadTorrentManager("conn-1")).rejects.toThrow("down");
    expect(apiCalls.map((c) => c.path)).toEqual(["/api/connections/conn-1/index/torrents"]);
  });

  it("an empty server with links waits for the person instead of forgetting them", async () => {
    apiAnswer = () => index([PACK]);
    server.list.mockResolvedValue([]);
    const d = await loadTorrentManager("conn-1");
    expect(d.emptyServer).toEqual([H.pack]);
    expect(d.reconciled).toEqual([]);
    expect(apiCalls).toHaveLength(1);
  });

  it("without the index the list still shows, and nothing is reconciled", async () => {
    apiAnswer = () => new Error("API down");
    server.list.mockResolvedValue([listed(H.film)]);
    const d = await loadTorrentManager("conn-1");
    expect(d.indexError).toBeInstanceOf(Error);
    expect(d.torrents.map((t) => t.hash)).toEqual([H.film]);
    expect(d.reconciled).toEqual([]);
  });
});

describe("a source whose torrent left the server (SRC-03)", () => {
  it("is gone only by a list that has other torrents and not it; an empty or broken list proves nothing", () => {
    expect(presenceIn([listed(H.pack), listed(H.other)], H.pack.toUpperCase())).toBe("present");
    expect(presenceIn([listed(H.other)], H.pack)).toBe("gone");
    expect(presenceIn([], H.pack)).toBe("unknown");
    expect(presenceIn({ error: "nope" }, H.pack)).toBe("unknown");
  });
});
