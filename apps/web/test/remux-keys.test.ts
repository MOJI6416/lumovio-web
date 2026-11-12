import { ALL_FORMATS, BufferSource, BufferTarget, Conversion, EncodedPacket, EncodedPacketSink, EncodedVideoPacketSource, Input, MkvOutputFormat, Mp4OutputFormat, Output } from "mediabunny";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { isRecoveryPoint, keyAtRecoveryPoints } from "../src/lib/media/codecs/h264";
import { FRAGMENTED } from "../src/lib/media/remux";

// Mediabunny asks the browser once whether it is Chromium, where it takes only IDR for an H.264 key frame.
vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36", vendor: "Google Inc." });

const SPS = [0x67, 0x64, 0x00, 0x1f, 0xac, 0xd9, 0x40, 0x50, 0x05, 0xbb, 0x01, 0x10, 0x00, 0x00, 0x03, 0x00, 0x10, 0x00, 0x00, 0x03, 0x03, 0xc0, 0xf1, 0x83, 0x19, 0x60];
const PPS = [0x68, 0xeb, 0xe3, 0xcb, 0x22, 0xc0];
/** A recovery point SEI: recovery_frame_cnt 0, exact_match_flag 1 (`exact`), or a count of 1. */
const sei = (exact = true, count = 0) => [0x06, 0x06, 0x01, count ? 0x58 : exact ? 0xc4 : 0x84, 0x80];
const IDR = [0x65, 0x88, 0x84, 0x00, 0x10];
const SLICE = [0x41, 0x9a, 0x24, 0x6c, 0x41];
const lengthPrefixed = (...nals: number[][]) => new Uint8Array(nals.flatMap((n) => [0, 0, 0, n.length, ...n]));
const annexB = (...nals: number[][]) => new Uint8Array(nals.flatMap((n) => [0, 0, 1, ...n]));

describe("isRecoveryPoint", () => {
  it("finds a recovery point decoding starts at exactly, before the frame's first slice", () => {
    expect(isRecoveryPoint(lengthPrefixed(SPS, PPS, sei(), SLICE), 4)).toBe(true);
    expect(isRecoveryPoint(annexB(SPS, PPS, sei(), SLICE), null)).toBe(true);
    // Other SEI messages before it in the same unit: buffering period (type 0, 2 bytes), then the recovery point.
    expect(isRecoveryPoint(lengthPrefixed([0x06, 0x00, 0x02, 0x11, 0x22, 0x06, 0x01, 0xc4, 0x80], SLICE), 4)).toBe(true);
  });
  it("is not one without the SEI, with frames still to recover, or without an exact match", () => {
    expect(isRecoveryPoint(lengthPrefixed(SPS, PPS, SLICE), 4)).toBe(false);
    expect(isRecoveryPoint(lengthPrefixed(sei(true, 1), SLICE), 4)).toBe(false);
    expect(isRecoveryPoint(lengthPrefixed(sei(false), SLICE), 4)).toBe(false);
    // An SEI after the first slice belongs to the next frame.
    expect(isRecoveryPoint(lengthPrefixed(SLICE, sei()), 4)).toBe(false);
    expect(isRecoveryPoint(new Uint8Array(0), 4)).toBe(false);
  });
});

/**
 * A Blu-ray's video in Matroska: 12 s at 25 frames a second, a key frame every second by the container, of which only
 * those at 0 and 10 s are IDR — the rest are I-frames with a recovery point.
 */
async function bluRayFile() {
  const avcc = new Uint8Array([1, SPS[1]!, SPS[2]!, SPS[3]!, 0xff, 0xe1, 0, SPS.length, ...SPS, 1, 0, PPS.length, ...PPS]);
  const output = new Output({ format: new MkvOutputFormat(), target: new BufferTarget() });
  const source = new EncodedVideoPacketSource("avc");
  output.addVideoTrack(source, { frameRate: 25 });
  await output.start();
  const decoderConfig = { codec: "avc1.64001f", codedWidth: 1280, codedHeight: 720, description: avcc };
  for (let i = 0; i < 300; i++) {
    const key = i % 25 === 0;
    const data = !key ? lengthPrefixed(SLICE) : i === 0 || i === 250 ? lengthPrefixed(SPS, PPS, sei(), IDR) : lengthPrefixed(SPS, PPS, sei(), SLICE);
    await source.add(new EncodedPacket(data, key ? "key" : "delta", i / 25, 1 / 25), i === 0 ? { decoderConfig } : undefined);
  }
  await output.finalize();
  return output.target.buffer!;
}

const open = async (file: ArrayBuffer, recoveryPoints: boolean) => {
  const input = new Input({ source: new BufferSource(file), formats: ALL_FORMATS });
  const track = (await input.getPrimaryVideoTrack())!;
  if (recoveryPoints) keyAtRecoveryPoints(track);
  return { input, track };
};

/** The rebuild's own conversion (video copied into the MP4 the engine writes): how many fragments it wrote. */
async function fragments(file: ArrayBuffer, recoveryPoints: boolean) {
  const { input } = await open(file, recoveryPoints);
  const output = new Output({ format: new Mp4OutputFormat(FRAGMENTED), target: new BufferTarget() });
  const conversion = await Conversion.init({ input, output, showWarnings: false });
  expect(conversion.isValid).toBe(true);
  await conversion.execute();
  const bytes = new Uint8Array(output.target.buffer!);
  const view = new DataView(bytes.buffer);
  let count = 0;
  for (let at = 0; at + 8 <= bytes.length; at += view.getUint32(at)) if (String.fromCharCode(...bytes.subarray(at + 4, at + 8)) === "moof") count++;
  return count;
}

describe("a rebuild of H.264 whose IDR frames are far apart", () => {
  let file: ArrayBuffer;
  beforeAll(async () => {
    file = await bluRayFile();
  });

  it("cuts fragments at the recovery points: the first is a second of the film, not all of it up to the next IDR", async () => {
    // As Mediabunny does it in Chromium by itself: one fragment up to the IDR at 10 s, one after it.
    expect(await fragments(file, false)).toBe(2);
    expect(await fragments(file, true)).toBe(12);
  });

  it("starts from the middle at the recovery point before the time asked, not at the IDR far behind it", async () => {
    const plain = await open(file, false);
    expect((await new EncodedPacketSink(plain.track).getKeyPacket(5.5, { verifyKeyPackets: true }))?.timestamp).toBe(0);
    const fixed = await open(file, true);
    expect((await new EncodedPacketSink(fixed.track).getKeyPacket(5.5, { verifyKeyPackets: true }))?.timestamp).toBe(5);
    // A real IDR stays a key frame.
    expect((await new EncodedPacketSink(fixed.track).getKeyPacket(10.5, { verifyKeyPackets: true }))?.timestamp).toBe(10);
  });
});
