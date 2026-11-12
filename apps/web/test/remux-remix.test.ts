import { AudioSample } from "mediabunny";
import { describe, expect, it } from "vitest";
import { remixed } from "../src/lib/media/codecs/audio";

const RATE = 48000;
const FRAMES = 480;

/** A block of `channels` channels (the decoders' order) with a 440 Hz tone at full level in the channels of `loud`. */
function block(channels: number, loud: number[]) {
  const data = new Float32Array(FRAMES * channels);
  for (let i = 0; i < FRAMES; i++) for (const c of loud) data[i * channels + c] = Math.sin((i / RATE) * 2 * Math.PI * 440) * 0.5;
  return new AudioSample({ data, format: "f32", numberOfChannels: channels, sampleRate: RATE, timestamp: 12.5 });
}

/** The loudest sample of each channel of `s`. */
function peaks(s: AudioSample) {
  const n = s.numberOfChannels;
  const data = new Float32Array(s.numberOfFrames * n);
  s.copyTo(data, { planeIndex: 0, format: "f32" });
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < data.length; i++) out[i % n] = Math.max(out[i % n]!, Math.abs(data[i]!));
  return out.map((p) => Math.round(p * 100) / 100);
}

describe("remixed: 5.0, 6.1 and 7.1 taken down to stereo or 5.1", () => {
  it("keeps the centre — the dialogue — in both sides of the stereo", () => {
    // Mediabunny's own remix gave silence here: it kept only the first two channels of these layouts.
    for (const channels of [5, 7, 8]) expect(peaks(remixed(block(channels, [2]), 2))).toEqual([0.35, 0.35]);
  });

  it("puts each surround into its own side of the stereo", () => {
    // 5.0: L R C Ls Rs.
    expect(peaks(remixed(block(5, [3]), 2))).toEqual([0.35, 0]);
    // 7.1: side right (the last channel) to the right.
    expect(peaks(remixed(block(8, [7]), 2))).toEqual([0, 0.25]);
    // 6.1: the back centre to both.
    expect(peaks(remixed(block(7, [4]), 2))).toEqual([0.25, 0.25]);
  });

  it("folds 7.1's back and side surrounds into 5.1's, keeping the centre and LFE where they are", () => {
    const out = remixed(block(8, [2, 3, 4, 6]), 6);
    expect(out.numberOfChannels).toBe(6);
    expect(peaks(out)).toEqual([0, 0, 0.5, 0.5, 0.71, 0]);
    // 6.1: the back centre into both surrounds.
    expect(peaks(remixed(block(7, [4]), 6))).toEqual([0, 0, 0, 0, 0.35, 0.35]);
  });

  it("keeps the block's time and rate, and leaves a block that already fits as it is", () => {
    const out = remixed(block(7, [2]), 2);
    expect(out.timestamp).toBe(12.5);
    expect(out.sampleRate).toBe(RATE);
    expect(out.numberOfFrames).toBe(FRAMES);
    const stereo = block(2, [0]);
    expect(remixed(stereo, 2)).toBe(stereo);
    const surround = block(6, [2]);
    expect(remixed(surround, 6)).toBe(surround);
    // 5.1 to stereo, as Mediabunny remixes it.
    expect(peaks(remixed(block(6, [2]), 2))).toEqual([0.35, 0.35]);
  });
});
