import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaNetError } from "../src/lib/media/net";
import type { TsSearchResult } from "../src/lib/media/torrserver";

// Adding a search result to a TorrServer (docs/torrserver-2026-11.md, finding 28): a torrent that is already on the server
// is linked, never renamed or marked; only a torrent the add brought gets the release's name and Lumovio's mark. The
// server and the API are fakes; which calls are made, in which order, is the point.

const server = { list: vi.fn(), quietAdd: vi.fn(), claim: vi.fn(), remove: vi.fn() };
const apiCalls: { path: string; json?: unknown }[] = [];
let apiFails = 0;
vi.mock("../src/lib/api", () => ({
  api: async (path: string, init?: { json?: unknown }) => {
    apiCalls.push({ path, json: init?.json });
    if (apiFails > 0) {
      apiFails--;
      throw new Error("API down");
    }
    return {};
  },
}));
vi.mock("../src/lib/media/clients", () => ({ getCredentials: async () => ({ id: "c1", baseUrl: "http://ts.test", auth: { kind: "torrserver" } }) }));
vi.mock("../src/lib/media/torrserver", async (original) => ({ ...(await original<object>()), torrServerClient: () => server }));

const { addTorrentSource, takeBack } = await import("../src/lib/media/torrent-source");

const NEW = "a".repeat(40);
const OWN = "b".repeat(40);
const film = { id: "movie:693134" as const, title: "Dune: Part Two", year: 2024, posterPath: "/p.jpg" };
const result = (extra: Partial<TsSearchResult> = {}): TsSearchResult => ({
  title: "Dune: Part Two (2024) WEB-DL 1080p",
  link: "https://jackett.test/dl/one",
  hash: null,
  size: 1,
  seeders: 10,
  peers: 1,
  tracker: "NoNaMe",
  published: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  apiCalls.length = 0;
  apiFails = 0;
  server.list.mockResolvedValue([{ hash: OWN, title: "[LAMPA] Dune 2" }]);
  server.claim.mockResolvedValue({ hash: NEW });
  server.remove.mockResolvedValue(undefined);
});

describe("adding a search result to a TorrServer", () => {
  it("names and marks only a torrent the add brought, and links it", async () => {
    server.quietAdd.mockResolvedValue({ hash: NEW.toUpperCase() });
    const out = await addTorrentSource("c1", film, null, result());
    expect(server.list).toHaveBeenCalledBefore(server.quietAdd);
    expect(server.quietAdd).toHaveBeenCalledWith("https://jackett.test/dl/one");
    expect(server.claim).toHaveBeenCalledWith(NEW, "Dune: Part Two (2024) WEB-DL 1080p", { titleId: "movie:693134", season: null, title: "Dune: Part Two (2024)", added: expect.any(Number) }, expect.stringContaining("/p.jpg"));
    expect(apiCalls).toEqual([{ path: "/api/connections/c1/index", json: { mode: "merge", entries: [{ titleId: "movie:693134", externalId: NEW, season: null, episode: null, label: "Dune: Part Two (2024) WEB-DL 1080p", quality: null }] } }]);
    expect(out).toEqual({ hash: NEW, label: "Dune: Part Two (2024) WEB-DL 1080p", existed: false });
  });

  it("only links a torrent that was on the server before (the person's own): no name, poster or mark of Lumovio's", async () => {
    server.quietAdd.mockResolvedValue({ hash: OWN });
    const out = await addTorrentSource("c1", film, null, result());
    expect(server.claim).not.toHaveBeenCalled();
    expect(apiCalls).toHaveLength(1);
    expect(out?.existed).toBe(true);
  });

  it("adds nothing when the server's list can't be read", async () => {
    server.list.mockResolvedValue({ error: "nope" });
    await expect(addTorrentSource("c1", film, null, result())).rejects.toThrow();
    expect(server.quietAdd).not.toHaveBeenCalled();
  });

  it("tries the next indexer's link when one fails, and names the torrent once", async () => {
    server.quietAdd.mockRejectedValueOnce(new MediaNetError("http", "Server responded with 400", 400)).mockResolvedValueOnce({ hash: NEW });
    const r = result({ origins: [{ tracker: "Kinozal", link: "https://jackett.test/dl/k", seeders: 5, peers: 1, published: null }, { tracker: "RuTracker", link: "https://jackett.test/dl/r", seeders: 9, peers: 1, published: null }] });
    await addTorrentSource("c1", film, 2, r);
    expect(server.quietAdd.mock.calls.map((c) => c[0])).toEqual(["https://jackett.test/dl/k", "https://jackett.test/dl/r"]);
    expect(server.claim).toHaveBeenCalledTimes(1);
    expect(server.claim.mock.calls[0]![2]).toMatchObject({ season: 2 });
  });

  it("takes a torrent the server added after the wait ran out: the one new hash in its list", async () => {
    server.list.mockResolvedValueOnce([{ hash: OWN }]).mockResolvedValueOnce([{ hash: OWN }, { hash: NEW }]);
    server.quietAdd.mockRejectedValue(new MediaNetError("timeout", "The server didn't answer in time"));
    const out = await addTorrentSource("c1", film, null, result());
    expect(out).toMatchObject({ hash: NEW, existed: false });
    expect(server.claim).toHaveBeenCalledTimes(1);
  });

  it("reports the timeout when nothing new appeared", async () => {
    server.quietAdd.mockRejectedValue(new MediaNetError("timeout", "The server didn't answer in time"));
    await expect(addTorrentSource("c1", film, null, result())).rejects.toMatchObject({ code: "timeout" });
    expect(server.claim).not.toHaveBeenCalled();
  });

  it("retries the index, and takes back only a torrent it brought when the index stays down", async () => {
    vi.useFakeTimers();
    server.quietAdd.mockResolvedValue({ hash: NEW });
    apiFails = 3;
    const added = addTorrentSource("c1", film, null, result());
    const failed = expect(added).rejects.toThrow("API down");
    await vi.runAllTimersAsync();
    await failed;
    expect(apiCalls).toHaveLength(3);
    expect(server.remove).toHaveBeenCalledWith(NEW);

    server.quietAdd.mockResolvedValue({ hash: OWN });
    apiFails = 3;
    const linked = addTorrentSource("c1", film, null, result());
    const failed2 = expect(linked).rejects.toThrow("API down");
    await vi.runAllTimersAsync();
    await failed2;
    expect(server.remove).toHaveBeenCalledTimes(1);
  });

  it("goes on when the index answers on a second try", async () => {
    vi.useFakeTimers();
    server.quietAdd.mockResolvedValue({ hash: NEW });
    apiFails = 1;
    const added = addTorrentSource("c1", film, null, result());
    await vi.runAllTimersAsync();
    await expect(added).resolves.toMatchObject({ hash: NEW });
    expect(server.remove).not.toHaveBeenCalled();
  });

  it("takes back a torrent the add brought when the person left before it played: off the server and out of the index", async () => {
    await takeBack("c1", NEW);
    expect(server.remove).toHaveBeenCalledWith(NEW);
    expect(apiCalls).toEqual([{ path: "/api/connections/c1/index/forget", json: { hashes: [NEW] } }]);
  });
});
