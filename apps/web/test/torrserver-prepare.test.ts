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

const { torrServerClient } = await import("../src/lib/media/torrserver");
const client = torrServerClient("http://ts.test", { username: null, password: null });
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  asked.length = 0;
  gates.clear();
  gated = null;
  caps = chrome;
  preopen.mockClear();
});

describe("preparing a TorrServer file", () => {
  it("asks for the subtitle list alongside the probe, not after it", async () => {
    gated = /^\/ffp\//;
    const ready = client.prepare(`${"a".repeat(40)}:1`);
    for (let i = 0; i < 20 && !gates.size; i++) await tick();
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
    for (let i = 0; i < 20 && !gates.size; i++) await tick();
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
    for (let i = 0; i < 20 && !gates.size; i++) await tick();
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
