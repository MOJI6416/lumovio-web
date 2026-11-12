import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaybackCapabilities } from "../src/lib/media/capabilities";

// Preparing a TorrServer file: what is waited for before the player gets the stream. The
// server is a fake that answers each path when the test says so; the order of the requests is the point.

const chrome: PlaybackCapabilities = {
  video: { h264: true, hevc: true, av1: true, vp9: true, h264High10: true },
  audio: { aac: true, mp3: true, opus: true, flac: true, ac3: false, eac3: false, dts: false, truehd: false, vorbis: true },
  containers: { mp4: true, webm: true, mkv: "likely", ts: false, mov: true },
  hls: "mse",
  mse: true,
  mediaSource: "standard",
  mseAudio: { aac: true, mp3: false, opus: true, flac: true, ac3: false, eac3: false, dts: false },
  hdr: false,
  dolbyVision: false,
  maxHeight: 1080,
  pip: true,
  platform: "chromium/windows",
};
const iphone: PlaybackCapabilities = {
  ...chrome,
  containers: { mp4: true, webm: false, mkv: "no", ts: false, mov: true },
  mediaSource: "managed",
  mseAudio: { aac: true, mp3: true, opus: true, flac: true, ac3: true, eac3: true, dts: false },
  platform: "safari/ios",
};
let caps = chrome;
vi.mock("../src/lib/media/capabilities", async (original) => ({ ...(await original<object>()), detectCapabilities: () => caps }));
const preopen = vi.fn();
vi.mock("../src/lib/media/remux", () => ({ preopen }));

/** Requests in the order they were made; each path answers when its gate is opened (or at once without one). */
const asked: string[] = [];
const gates = new Map<string, { open: (body: unknown) => void; fail: () => void }>();
let gated: RegExp | null = null;
const PROBE = {
  format: { format_name: "matroska,webm", duration: "6000.0" },
  streams: [
    { index: 0, codec_type: "video", codec_name: "h264", width: 1920, height: 1080, pix_fmt: "yuv420p" },
    { index: 1, codec_type: "audio", codec_name: "aac", tags: { language: "rus", title: "LostFilm" }, disposition: { default: 1 } },
  ],
};
vi.mock("../src/lib/media/net", async (original) => ({
  ...(await original<object>()),
  mediaFetch: async (url: string) => {
    const path = new URL(url).pathname + new URL(url).search;
    asked.push(path.replace(/[0-9a-f]{40}/g, "#"));
    const answer = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    const body = path.includes("stat") ? { hash: "x", title: "Film", file_stats: [{ id: 1, path: "Film/Film.2024.1080p.mkv", length: 4e9 }] } : path.startsWith("/subs/") ? [] : PROBE;
    if (gated?.test(path))
      return new Promise<Response>((resolve, reject) => gates.set(path.replace(/[0-9a-f]{40}/g, "#"), { open: (b) => resolve(answer(b)), fail: () => reject(new Error("probe failed")) }));
    return answer(body);
  },
}));

/** The file's own bytes, read by ranges (the engine's own fetch): a real Matroska file, or a server that won't say. */
let fileBytes: Uint8Array | null = null;
const ranges: string[] = [];
vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
  const range = new Headers(init?.headers).get("Range");
  ranges.push(`${new URL(url).pathname} ${range}`);
  const m = /bytes=(\d+)-(\d+)/.exec(range ?? "");
  if (!fileBytes || !m) return new Response(null, { status: 404 });
  return new Response(fileBytes.slice(Number(m[1]), Number(m[2]) + 1), { status: 206 });
});
const multi = readFileSync(new URL("../public/player-check/mkv-multi.mkv", import.meta.url));

const { torrServerClient } = await import("../src/lib/media/torrserver");
const client = torrServerClient("http://ts.test", { username: null, password: null });
const tick = () => new Promise((r) => setTimeout(r, 0));
const opened = () => vi.waitFor(() => expect(gates.size).toBeGreaterThan(0));

beforeEach(() => {
  asked.length = 0;
  ranges.length = 0;
  gates.clear();
  gated = null;
  fileBytes = null;
  caps = chrome;
  preopen.mockClear();
});

describe("a Matroska file new to this device", () => {
  it("is decided from its own first kilobytes: ffprobe is not waited for, nor asked", async () => {
    fileBytes = multi;
    gated = /^\/ffp\//;
    const p = await client.prepare(`${"f".repeat(40)}:1`, { profile: { languages: ["uk"], studios: [] } });
    expect(asked).toEqual(["/stream?link=#&stat", "/subs/#/1"]);
    expect(ranges).toEqual(["/stream/Film.2024.1080p.mkv bytes=0-65535"]);
    expect(p.audio.map((a) => [a.index, a.label, a.lang, a.codec])).toEqual([
      [1, "Дубляж", "rus", "ac3"],
      [2, "ukr", "ukr", "aac"],
      [3, "eng", "eng", "eac3"],
    ]);
    // The profile's Ukrainian is not the file's default: rebuilt with that track, as with ffprobe's answer.
    expect(p.type).toBe("remux");
    expect(p.remuxAudio).toBe(2);
    expect(p.durationSec).toBe(4.021);
    // What it read is kept: the next start of the file reads nothing.
    ranges.length = 0;
    asked.length = 0;
    await client.prepare(`${"f".repeat(40)}:1`, { audioIndex: 3 });
    expect(ranges).toEqual([]);
    expect(asked).toEqual(["/stream?link=#&stat", "/subs/#/1"]);
  });

  it("asks ffprobe in the background for what the head leaves unknown, for the next start", async () => {
    // The clip's Duration element zeroed: the file doesn't say how long it is.
    const b = new Uint8Array(multi);
    const at = b.findIndex((x, i) => x === 0x44 && b[i + 1] === 0x89);
    b.fill(0, at + 3, at + 3 + (b[at + 2]! & 0x7f));
    fileBytes = b;
    gated = /^\/ffp\//;
    const id = `${"9".repeat(40)}:1`;
    const p = await client.prepare(id);
    expect(p.durationSec).toBeNull();
    expect(asked).toContain("/ffp/#/1");
    gates.get("/ffp/#/1")!.open(PROBE);
    await tick();
    gated = null;
    expect((await client.prepare(id)).durationSec).toBe(6000);
  });
});

describe("preparing a TorrServer file", () => {
  it("asks for the subtitle list alongside the probe, not after it", async () => {
    gated = /^\/ffp\//;
    const ready = client.prepare(`${"a".repeat(40)}:1`);
    await opened();
    expect(asked).toEqual(["/stream?link=#&stat", "/subs/#/1", "/ffp/#/1"]);
    gates.get("/ffp/#/1")!.open(PROBE);
    const p = await ready;
    expect(p.type).toBe("progressive");
    expect(p.audio.map((a) => a.label)).toEqual(["LostFilm"]);
  });

  it("starts the same file again without waiting for its probe: a torrent's file never changes", async () => {
    const id = `${"b".repeat(40)}:1`;
    await client.prepare(id);
    expect(asked.filter((x) => x.startsWith("/ffp/"))).toHaveLength(1);
    asked.length = 0;
    // Another audio track, "Continue", a stream opened again: the probe is not asked again.
    gated = /^\/ffp\//;
    const p = await client.prepare(id, { audioIndex: 1 });
    expect(asked.some((x) => x.startsWith("/ffp/"))).toBe(false);
    expect(p.durationSec).toBe(6000);
  });

  it("asks again for a probe that failed", async () => {
    const id = `${"c".repeat(40)}:1`;
    gated = /^\/ffp\//;
    const first = client.prepare(id);
    await opened();
    gates.get("/ffp/#/1")!.fail();
    expect((await first).info).toBeUndefined();
    gated = null;
    asked.length = 0;
    await client.prepare(id);
    expect(asked).toContain("/ffp/#/1");
  });

  it("on an iPhone, where Matroska is always rebuilt, the rebuild starts reading the file during the probe", async () => {
    caps = iphone;
    gated = /^\/ffp\//;
    const ready = client.prepare(`${"d".repeat(40)}:1`);
    await opened();
    await tick();
    expect(preopen).toHaveBeenCalledTimes(1);
    expect(preopen.mock.calls[0]![0].url).toMatch(/\/stream\/Film\.2024\.1080p\.mkv\?link=d{40}&index=1&play$/);
    gates.get("/ffp/#/1")!.open(PROBE);
    const p = await ready;
    expect(p.type).toBe("remux");
    expect(p.remuxSource?.url).toBe(preopen.mock.calls[0]![0].url);
  });

  it("does not read ahead where the browser plays Matroska itself", async () => {
    await client.prepare(`${"e".repeat(40)}:1`);
    expect(preopen).not.toHaveBeenCalled();
  });
});
