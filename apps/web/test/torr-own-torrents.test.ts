import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-11-08: reading ahead took 11 of the owner's torrents off their TorrServer — a Jackett result has no hash and its
// name wasn't the torrent's title there, so the read added it (TorrServer keeps one torrent per hash: the owner's own)
// and removed it after. A fake TorrServer that behaves so: an add of a hash it has answers with that torrent, rewritten.
const OWN = "a3855df198".padEnd(40, "0");
const NEW = "b".repeat(40);
type T = { hash: string; title: string; poster?: string; data?: string };
let torrents: T[] = [];
const calls: string[] = [];
const fake = {
  list: async () => torrents.map((t) => ({ ...t })),
  add: async (_link: string, title: string, data: Record<string, unknown>) => put(title, JSON.stringify({ lumovio: data })),
  peek: async (_link: string, title: string) => put(title, JSON.stringify({ lumovio: { peek: true } })),
  set: async (hash: string, title: string, poster: string, data: string) => {
    calls.push(`set ${hash.slice(0, 6)}`);
    Object.assign(torrents.find((t) => t.hash === hash)!, { title, poster, data });
  },
  remove: async (hash: string) => {
    calls.push(`rem ${hash.slice(0, 6)}`);
    torrents = torrents.filter((t) => t.hash !== hash);
  },
  stat: async () => ({ hash: "", title: "", file_stats: [{ id: 1, path: "La.casa.de.papel.S05E01.2160p.mkv", length: 1 }] }),
  ffprobe: async () => ({ streams: [{ codec_type: "audio", tags: { language: "rus", title: "Пифагор" } }] }),
};
let addsHash = OWN;
function put(title: string, data: string): T {
  const t = torrents.find((x) => x.hash === addsHash);
  if (t) return Object.assign(t, { title, data });
  const n = { hash: addsHash, title, poster: "", data };
  torrents.push(n);
  return n;
}
vi.mock("../src/lib/media/clients", () => ({ getCredentials: async () => ({ id: "c1", baseUrl: "http://ts", auth: { kind: "torrserver" } }) }));
vi.mock("../src/lib/media/torrserver", async () => ({ ...(await vi.importActual<object>("../src/lib/media/torrserver")), torrServerClient: () => fake }));
vi.mock("../src/lib/api", () => ({ api: async () => ({ removed: {} }) }));

const { readOne } = await import("../src/lib/media/read-ahead");
const { addTorrentSource } = await import("../src/lib/media/torrent-source");
const owners = () => ({ hash: OWN, title: "Бумажный дом / La casa de papel S05 2160p", poster: "p.jpg", data: '{"lampa":{"id":71446}}' });
const result = { title: "Money Heist S05 2160p WEB-DL HEVC", link: "http://jackett/dl/x", hash: null, size: 1, seeders: 9, peers: 1, tracker: "T", published: null };
const job = { titleId: "tv:71446", connectionId: "c1", releases: [], originalLanguage: "es", movie: false, year: 2017, season: 5, episode: 1, onRead: () => {} };

describe("a read ahead or an add never takes or rewrites a torrent that was on the server", () => {
  beforeEach(() => {
    torrents = [owners()];
    calls.length = 0;
  });

  it("reads the owner's torrent the name didn't give away, and leaves it as it was", async () => {
    addsHash = OWN;
    const read = await readOne(job, result as never, new AbortController().signal);
    expect(read?.hash).toBe(OWN);
    expect(calls.filter((c) => c.startsWith("rem"))).toEqual([]);
    expect(torrents).toEqual([owners()]);
  });

  it("removes what the read itself added", async () => {
    addsHash = NEW;
    await readOne(job, result as never, new AbortController().signal);
    expect(calls).toEqual([`rem ${NEW.slice(0, 6)}`]);
    expect(torrents).toEqual([owners()]);
  });

  it("puts the owner's torrent back as it was after Lumovio adds it for a title, with no mark to sweep it", async () => {
    addsHash = OWN;
    const added = await addTorrentSource("c1", { id: "tv:71446", title: "Бумажный дом", year: 2017, posterPath: null }, 5, result as never);
    expect(added?.hash).toBe(OWN);
    expect(torrents).toEqual([owners()]);
  });

  it("marks a torrent new to the server as Lumovio's, to be swept if it never plays", async () => {
    addsHash = NEW;
    await addTorrentSource("c1", { id: "tv:71446", title: "Бумажный дом", year: 2017, posterPath: null }, 5, result as never);
    const mark = JSON.parse(torrents.find((t) => t.hash === NEW)!.data!).lumovio;
    expect([mark.titleId, mark.played]).toEqual(["tv:71446", false]);
  });
});

describe("a launch cancelled while its release was added (A16, P7)", () => {
  beforeEach(() => {
    torrents = [owners()];
    calls.length = 0;
  });

  it("takes off what it added, and leaves a torrent that was there", async () => {
    const { dropAdded } = await import("../src/lib/media/torrent-source");
    addsHash = NEW;
    const mine = await addTorrentSource("c1", { id: "tv:71446", title: "Бумажный дом", year: 2017, posterPath: null }, 5, result as never);
    expect(mine?.fresh).toBe(true);
    dropAdded("c1", mine);
    await vi.waitFor(() => expect(torrents.map((t) => t.hash)).toEqual([OWN]));
    addsHash = OWN;
    const theirs = await addTorrentSource("c1", { id: "tv:71446", title: "Бумажный дом", year: 2017, posterPath: null }, 5, result as never);
    expect(theirs?.fresh).toBe(false);
    dropAdded("c1", theirs);
    await new Promise((r) => setTimeout(r, 50));
    expect(torrents).toEqual([owners()]);
  });
});

describe("a launch that heals itself (item 3, S3)", () => {
  beforeEach(() => {
    torrents = [owners()];
    calls.length = 0;
  });

  it("adds the next release of the same audio and picture when the server refuses the first, and says so", async () => {
    const { addFirst } = await import("../src/lib/media/torrent-source");
    const add = fake.add;
    let n = 0;
    fake.add = async (...a: Parameters<typeof add>) => {
      if (n++ === 0) throw new Error("TorrServer answered 400");
      return add(...a);
    };
    addsHash = NEW;
    const said: string[] = [];
    const second = { ...result, title: "Money Heist S05 2160p WEB-DL HEVC (other tracker)" };
    const got = await addFirst("c1", { id: "tv:71446", title: "Бумажный дом", year: 2017, posterPath: null }, 5, [result as never, second as never], { onNext: () => said.push("next") });
    fake.add = add;
    expect([got?.hash, got?.release.title, said]).toEqual([NEW, second.title, ["next"]]);
  });

  it("stops trying once the launch was cancelled, and throws the last failure when none was added", async () => {
    const { addFirst } = await import("../src/lib/media/torrent-source");
    const add = fake.add;
    fake.add = async () => {
      throw new Error("TorrServer answered 400");
    };
    let tries = 0;
    const counting = () => {
      tries++;
      return true;
    };
    await expect(addFirst("c1", { id: "x", title: "X", year: null, posterPath: null }, null, [result as never, result as never], { live: counting })).rejects.toThrow("400");
    await expect(addFirst("c1", { id: "x", title: "X", year: null, posterPath: null }, null, [result as never, result as never], { live: () => false })).rejects.toThrow("400");
    fake.add = add;
    expect(tries).toBe(1);
  });
});
