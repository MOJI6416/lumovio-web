import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readAvi, startChunk } from "../src/lib/media/avi";
import { loadCodec } from "./codec-wasm";

// The device check's AVI clips: 4 s, 24 fps, 426×240, a key frame every second.
const file = (name: string) => readFileSync(new URL(`../public/player-check/${name}`, import.meta.url));
const reader = (b: Buffer) => async (s: number, e: number) => new Uint8Array(b.subarray(s, e));

describe("AVI index", () => {
  it("Xvid + MP3: streams, every chunk's place and time, key frames", async () => {
    const b = file("avi-xvid-mp3.avi");
    const avi = await readAvi(reader(b), b.length);
    const [v, a] = avi.streams;
    expect([v!.type, v!.fourcc, v!.width, v!.height]).toEqual(["vids", "xvid", 426, 240]);
    expect(v!.frameTime).toBeCloseTo(1 / 24);
    expect([a!.type, a!.formatTag, a!.channels, a!.sampleRate]).toEqual(["auds", 0x55, 2, 48000]);
    const video = avi.chunks.filter((c) => c.stream === 0);
    // 96 pictures, and an empty chunk where the muxer repeated one.
    expect(video.filter((c) => c.size > 0).length).toBe(96);
    expect(video.filter((c) => c.key).length).toBe(4);
    expect(avi.duration).toBeCloseTo(4, 1);
    // A chunk's data starts where its header says it does.
    const c = video[24]!;
    expect(String.fromCharCode(...b.subarray(c.offset - 8, c.offset - 6))).toBe("00");
    expect(b.readUInt32LE(c.offset - 4)).toBe(c.size);
    // The audio's times follow the video's.
    const audio = avi.chunks.filter((x) => x.stream === 1);
    expect(audio[audio.length - 1]!.time).toBeGreaterThan(3.5);
    const key2 = video.filter((c) => c.key)[2]!;
    expect(key2.time).toBeCloseTo(2, 1);
    expect(startChunk(avi, 0, 2.5)).toBe(avi.chunks.indexOf(key2));
  });

  it("MPEG-2 + AC-3", async () => {
    const b = file("avi-mpeg2-ac3.avi");
    const avi = await readAvi(reader(b), b.length);
    expect(avi.streams.map((s) => [s.type, s.fourcc || s.formatTag])).toEqual([
      ["vids", "mpg2"],
      ["auds", 0x2000],
    ]);
  });

  it("refuses what isn't an AVI", async () => {
    const b = file("mkv-h264-aac.mkv");
    await expect(readAvi(reader(b), b.length)).rejects.toThrow(/not an AVI/);
  });
});

describe("old codecs in WebAssembly", () => {
  const decodeVideo = async (name: string, codec: number) => {
    const m = await loadCodec("video")();
    const init = m.cwrap("init_decoder", "number", [
      "number",
      "number",
      "number",
      "number",
      "number",
      "number",
    ]);
    const input = m.cwrap("input_buffer", "number", ["number", "number"]);
    const decode = m.cwrap("decode", "number", ["number", "number"]);
    const flush = m.cwrap("flush", "number", ["number"]);
    const width = m.cwrap("output_width", "number", ["number"]);
    const height = m.cwrap("output_height", "number", ["number"]);
    const b = file(name);
    const avi = await readAvi(reader(b), b.length);
    const v = avi.streams[0]!;
    const tag =
      v.fourcc.charCodeAt(0) |
      (v.fourcc.charCodeAt(1) << 8) |
      (v.fourcc.charCodeAt(2) << 16) |
      (v.fourcc.charCodeAt(3) << 24);
    const ctx = init(codec, v.width, v.height, tag, 0, 0);
    expect(ctx).not.toBe(0);
    let frames = 0;
    let n = 0;
    const t0 = performance.now();
    for (const c of avi.chunks.filter((x) => x.stream === 0)) {
      // An empty chunk is a dropped frame (the previous one goes on): nothing to decode.
      if (!c.size) {
        n++;
        continue;
      }
      const at = input(ctx, c.size);
      m.HEAPU8.set(b.subarray(c.offset, c.offset + c.size), at);
      const got = decode(ctx, n++);
      expect(got).toBeGreaterThanOrEqual(0);
      frames += got;
    }
    frames += flush(ctx);
    return {
      frames,
      width: width(ctx),
      height: height(ctx),
      fps: frames / ((performance.now() - t0) / 1000),
    };
  };

  it("decodes Xvid (MPEG-4 Part 2) to I420 pictures, every frame, far faster than real time", async () => {
    const r = await decodeVideo("avi-xvid-mp3.avi", 0);
    expect([r.frames, r.width, r.height]).toEqual([96, 426, 240]);
    expect(r.fps).toBeGreaterThan(24 * 1.2);
  });

  it("decodes MPEG-2", async () => {
    const r = await decodeVideo("avi-mpeg2-ac3.avi", 4);
    expect([r.frames, r.width, r.height]).toEqual([96, 426, 240]);
  });

  it("decodes AVI's MP3 and AC-3 audio", async () => {
    const m = await loadCodec("audio")();
    const init = m.cwrap("init_decoder", "number", [
      "number",
      "number",
      "number",
      "number",
      "number",
      "number",
    ]);
    const input = m.cwrap("input_buffer", "number", ["number", "number"]);
    const decode = m.cwrap("decode", "number", ["number"]);
    const channels = m.cwrap("output_channels", "number", ["number"]);
    for (const [name, codec, ch] of [
      ["avi-xvid-mp3.avi", 2, 2],
      ["avi-mpeg2-ac3.avi", 5, 6],
    ] as const) {
      const b = file(name);
      const avi = await readAvi(reader(b), b.length);
      const a = avi.streams[1]!;
      const ctx = init(codec, 0, a.channels, a.sampleRate, 0, 0);
      let samples = 0;
      let got = 0;
      for (const c of avi.chunks.filter((x) => x.stream === 1 && x.size > 0)) {
        const at = input(ctx, c.size);
        m.HEAPU8.set(b.subarray(c.offset, c.offset + c.size), at);
        const n = decode(ctx);
        expect(n).toBeGreaterThanOrEqual(0);
        if (n) got = channels(ctx);
        samples += n;
      }
      expect(got).toBe(ch);
      expect(samples / 48000).toBeGreaterThan(3.8);
    }
  });
});
