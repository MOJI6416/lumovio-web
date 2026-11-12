import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TsSearchResult } from "../src/lib/media/torrserver";

// The shared cache's client: what a probe sends (within the cache's bounds), how a search's results are asked by the
// digests of their names, and that a copy's own tracks come before the cache's. The API is a fake.

const store = new Map<string, string>();
globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } as Storage;
const asked: { path: string; json: { releases?: { name: string; size: number | null; torrent: string | null }[] } }[] = [];
let answer: (unknown | null)[] = [];
vi.mock("../src/lib/api", () => ({
  api: async (path: string, init: { json: never }) => {
    asked.push({ path, json: init.json });
    return path.endsWith("/lookup") ? { files: answer } : {};
  },
}));

const { lookupFiles, nameKey, shareFile, shareableProbe, sharedFileOf, withSharedFiles } = await import("../src/lib/media/release-files");
const { ReleaseFileProbe } = await import("@lumovio/contracts");

const result = (title: string, link: string, extra: Partial<TsSearchResult> = {}): TsSearchResult => ({ title, link, hash: null, size: 4.2e9, seeders: 9, peers: 1, tracker: "RuTracker.org", published: null, ...extra });
const facts = { audio: ["rus|MVO, LostFilm"], defaultAudio: 0, subtitles: [], video: null, durationSec: null };

beforeEach(() => {
  store.clear();
  asked.length = 0;
});

describe("a probe for the cache", () => {
  it("keeps every stream and chapter, each field within the cache's bounds", () => {
    const p = shareableProbe({
      format: { format_name: "matroska,webm", duration: "3600.000000000000000000001" },
      streams: [
        { index: 0, codec_type: "video", codec_name: "hevc", width: 3840.4, height: 2160, side_data_list: [{ side_data_type: "DOVI configuration record", dv_profile: 8 }] },
        ...Array.from({ length: 40 }, (_, i) => ({ index: i + 1, codec_type: "audio", codec_name: "eac3", tags: { language: "rus", title: `MVO ${"x".repeat(300)}` }, disposition: { default: i === 0 ? 1 : 0 } })),
      ],
      chapters: [{ start_time: "0.000000", end_time: "61.5", tags: { title: "Intro" } }],
    })!;
    expect(p.streams).toHaveLength(41);
    expect(p.streams[0]!.width).toBe(3840);
    expect(p.streams[1]!.tags!.title).toHaveLength(200);
    expect(p.format!.duration).toHaveLength(24);
    expect(ReleaseFileProbe.safeParse(p).success).toBe(true);
    expect(shareableProbe({ streams: [] })).toBeNull();
  });
});

describe("asking the cache", () => {
  it("asks by digests of the name and the hash, once per result in a tab", async () => {
    const a = result("Dune.Part.Two.2024.WEB-DL.1080p", "l-a");
    const b = result("Dune Part Two 2024 BDRip", "l-b", { hash: "C".repeat(40) });
    answer = [facts, null];
    await lookupFiles([a, b]);
    const sent = asked[0]!.json.releases!;
    expect(sent[0]).toEqual({ name: expect.stringMatching(/^[a-f0-9]{64}$/), size: 4.2e9, torrent: null });
    expect(sent[1]!.torrent).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(sent)).not.toMatch(/dune|ccc/i);
    expect(sharedFileOf(a)).toEqual(facts);
    expect(sharedFileOf(b)).toBeNull();
    await lookupFiles([a, b]);
    expect(asked).toHaveLength(1);
  });

  it("takes a copy's own tracks before the cache's", async () => {
    const a = result("X 2024 2x MVO", "l-c");
    answer = [facts];
    await lookupFiles([a]);
    expect(withSharedFiles(null)(a)).toEqual(["rus|MVO, LostFilm"]);
    expect(withSharedFiles(() => ["ukr|Dub"])(a)).toEqual(["ukr|Dub"]);
  });

  it("keys a name as scene names and spacing don't change it", () => {
    expect(nameKey("Dune.Part_Two  (2024)")).toBe(nameKey("dune part two (2024)"));
  });
});

describe("sharing a read", () => {
  it("sends a file once per device, by digests, with the names it goes by", async () => {
    const probe = { streams: [{ index: 0, codec_type: "audio", codec_name: "aac", tags: { language: "rus", title: "LostFilm" } }] };
    await shareFile("ABC".padEnd(40, "0"), 2, probe, [
      { title: "Dune 2", size: 1e9 },
      { title: "dune 2", size: 1e9 },
      { title: "", size: null },
    ]);
    await shareFile("abc".padEnd(40, "0"), 2, probe, [{ title: "Dune 2", size: 1e9 }]);
    expect(asked).toHaveLength(1);
    expect(asked[0]!.json).toMatchObject({ file: 2, v: 1, names: [{ name: expect.stringMatching(/^[a-f0-9]{64}$/), size: 1e9 }] });
  });
});
