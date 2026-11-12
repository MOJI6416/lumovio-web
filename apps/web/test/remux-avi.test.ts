import { describe, expect, it } from "vitest";
import { type AviChunk, type AviFile, runChunks } from "../src/lib/media/avi";

/**
 * An AVI's index as a DVD rip's muxer writes it: a frame every 40 ms (stream 0), a key frame every 2 s, and sound
 * (stream 1) in chunks of 40 ms stored half a second ahead of the picture of the same moment.
 */
function rip(): AviFile {
  const chunks: AviChunk[] = [];
  for (let i = 0; i < 250; i++) {
    const t = i * 0.04;
    chunks.push({ stream: 1, offset: 200 * i + 100, size: 100, key: true, time: t + 0.5 });
    chunks.push({ stream: 0, offset: 200 * i + 200, size: 100, key: i % 50 === 0, time: t });
  }
  // The sound of the first half second, ahead of everything.
  for (let k = 12; k >= 0; k--) chunks.unshift({ stream: 1, offset: 0, size: 100, key: true, time: k * 0.04 });
  return { streams: [], chunks, duration: 10 };
}

describe("runChunks: what a run of the AVI engine reads", () => {
  it("reads the sound of the key frame's first moments, stored before the key frame", () => {
    const run = runChunks(rip(), 0, 1, 4.3);
    // The key frame at 4 s is the first picture.
    expect(run.find((c) => c.stream === 0)).toMatchObject({ key: true, time: 4 });
    // Sound from 50 ms before the key frame on, without a gap — not only from 4.5 s (the first stored after it).
    const sound = run.filter((c) => c.stream === 1).map((c) => Math.round(c.time * 100) / 100);
    expect(sound[0]).toBe(3.98);
    expect(sound.slice(0, 14)).toEqual(Array.from({ length: 14 }, (_, k) => Math.round((3.98 + k * 0.04) * 100) / 100));
  });

  it("reads no picture from before the key frame", () => {
    const run = runChunks(rip(), 0, 1, 4.3);
    expect(run.filter((c) => c.stream === 0).every((c) => c.time >= 4)).toBe(true);
  });

  it("reads only the picture when there's no sound to play", () => {
    const run = runChunks(rip(), 0, null, 4.3);
    expect(run.every((c) => c.stream === 0)).toBe(true);
    expect(run[0]).toMatchObject({ key: true, time: 4 });
  });
});
