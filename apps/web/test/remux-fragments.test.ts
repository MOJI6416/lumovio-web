import { ALL_FORMATS, BufferSource, BufferTarget, Conversion, EncodedAudioPacketSource, EncodedPacket, EncodedPacketSink, EncodedVideoPacketSource, Input, MkvOutputFormat, Mp4OutputFormat, Output } from "mediabunny";
import { beforeAll, describe, expect, it } from "vitest";
import { cutBefore, cutWithinGroups, startsAtKeyFrame } from "../src/lib/media/codecs/fragments";
import { FRAGMENTED } from "../src/lib/media/remux";

const SPS = [0x67, 0x64, 0x00, 0x1f, 0xac, 0xd9, 0x40, 0x50, 0x05, 0xbb, 0x01, 0x10, 0x00, 0x00, 0x03, 0x00, 0x10, 0x00, 0x00, 0x03, 0x03, 0xc0, 0xf1, 0x83, 0x19, 0x60];
const PPS = [0x68, 0xeb, 0xe3, 0xcb, 0x22, 0xc0];
const lengthPrefixed = (...nals: number[][]) => new Uint8Array(nals.flatMap((n) => [0, 0, 0, n.length, ...n]));
const FPS = 25;
const FRAMES = 750;

/**
 * 30 s of a web release's H.264 in Matroska: a key frame every 10 s, B-frames (each P frame stored before the two B
 * frames shown before it), every frame numbered; and a sound track.
 */
async function webRelease(gop = 250) {
  const avcc = new Uint8Array([1, SPS[1]!, SPS[2]!, SPS[3]!, 0xff, 0xe1, 0, SPS.length, ...SPS, 1, 0, PPS.length, ...PPS]);
  const output = new Output({ format: new MkvOutputFormat(), target: new BufferTarget() });
  const video = new EncodedVideoPacketSource("avc");
  output.addVideoTrack(video, { frameRate: FPS });
  const audio = new EncodedAudioPacketSource("opus");
  output.addAudioTrack(audio);
  await output.start();
  const order: number[] = [];
  for (let g = 0; g < FRAMES; g += gop) {
    order.push(g);
    for (let i = g + 1; i < Math.min(g + gop, FRAMES); i += 3) {
      const p = Math.min(i + 2, g + gop - 1, FRAMES - 1);
      order.push(p);
      for (let b = i; b < p; b++) order.push(b);
    }
  }
  const decoderConfig = { codec: "avc1.64001f", codedWidth: 1280, codedHeight: 720, description: avcc };
  let sound = 0;
  for (const i of order) {
    const key = i % gop === 0;
    const data = key ? lengthPrefixed(SPS, PPS, [0x65, 0x88, i >> 8, i & 255]) : lengthPrefixed([0x41, 0x9a, i >> 8, i & 255]);
    await video.add(new EncodedPacket(data, key ? "key" : "delta", i / FPS, 1 / FPS), i === 0 ? { decoderConfig } : undefined);
    for (; sound * 0.02 <= i / FPS; sound++)
      await audio.add(new EncodedPacket(new Uint8Array([0xfc, sound & 255]), "key", sound * 0.02, 0.02), sound === 0 ? { decoderConfig: { codec: "opus", numberOfChannels: 2, sampleRate: 48000 } } : undefined);
  }
  await output.finalize();
  return output.target.buffer!;
}

interface Fragment {
  bytes: Uint8Array;
  /** The video track's: decode time of its first sample and the sum of its samples' durations, in its timescale. */
  decodeStart: number;
  decodeLength: number;
}

/** The rebuild's conversion from `start`, with or without cuts inside groups: its fragments. */
async function rebuild(file: ArrayBuffer, cut: boolean, start?: number) {
  const input = new Input({ source: new BufferSource(file), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat(FRAGMENTED), target: new BufferTarget() });
  if (cut) cutWithinGroups(output, FRAGMENTED.minimumFragmentDuration);
  const conversion = await Conversion.init({ input, output, showWarnings: false, trim: start ? { start } : undefined });
  await conversion.execute();
  const all = new Uint8Array(output.target.buffer!);
  const view = new DataView(all.buffer);
  const type = (at: number) => String.fromCharCode(...all.subarray(at + 4, at + 8));
  const fragments: Fragment[] = [];
  for (let at = 0; at + 8 <= all.length; at += view.getUint32(at)) {
    if (type(at) !== "moof") continue;
    const moofEnd = at + view.getUint32(at);
    const mdatEnd = moofEnd + view.getUint32(moofEnd);
    // The first traf is the video's: tfhd's default duration, tfdt, trun's durations.
    const traf = at + 8 + view.getUint32(at + 8);
    let tfhdDuration = 0;
    let decodeStart = 0;
    let decodeLength = 0;
    for (let b = traf + 8; b < traf + view.getUint32(traf); b += view.getUint32(b)) {
      const flags = view.getUint32(b + 8) & 0xffffff;
      if (type(b) === "tfhd") tfhdDuration = view.getUint32(b + 16);
      if (type(b) === "tfdt") decodeStart = Number(view.getBigUint64(b + 12));
      if (type(b) === "trun") {
        const count = view.getUint32(b + 12);
        let f = b + 16 + (flags & 1 ? 4 : 0) + (flags & 4 ? 4 : 0);
        const entry = (flags & 0x100 ? 4 : 0) + (flags & 0x200 ? 4 : 0) + (flags & 0x400 ? 4 : 0) + (flags & 0x800 ? 4 : 0);
        for (let i = 0; i < count; i++, f += entry) decodeLength += flags & 0x100 ? view.getUint32(f) : tfhdDuration;
      }
    }
    fragments.push({ bytes: all.subarray(at, mdatEnd), decodeStart, decodeLength });
  }
  const built = new Input({ source: new BufferSource(all.buffer), formats: ALL_FORMATS });
  const packets: { frame: number; type: string; time: number }[] = [];
  for await (const p of new EncodedPacketSink((await built.getPrimaryVideoTrack())!).packets())
    packets.push({ frame: (p.data.at(-2)! << 8) | p.data.at(-1)!, type: p.type, time: p.timestamp });
  return { fragments, packets };
}

describe("cutBefore: where a fragment may end inside a group of pictures", () => {
  const f = (frame: number, type: "key" | "delta" = "delta") => ({ timestamp: frame / FPS, duration: 1 / FPS, type });

  it("ends where every frame shown before the next one is in: the next decode time follows on", () => {
    // Stored I0 P3 B1 B2, next P6: frames 0–3 are all in.
    expect(cutBefore([f(0, "key"), f(3), f(1), f(2)], f(6), null)).toBeCloseTo(4 / FPS);
    // After frames up to 3 were written: P6 B4 B5, next P9.
    expect(cutBefore([f(6), f(4), f(5)], f(9), 3 / FPS)).toBeCloseTo(7 / FPS);
  });

  it("doesn't end where a frame shown earlier is still to come, or at a key frame (the muxer's own place)", () => {
    // I0 P3 stored, B1 and B2 still to come.
    expect(cutBefore([f(0, "key"), f(3)], f(1), null)).toBeNull();
    // A frame missing between the written ones and these.
    expect(cutBefore([f(6), f(5)], f(9), 3 / FPS)).toBeNull();
    expect(cutBefore([f(6), f(4), f(5)], f(10, "key"), 3 / FPS)).toBeNull();
    expect(cutBefore([], f(1), null)).toBeNull();
  });
});

describe("a rebuild of H.264 whose key frames are 10 s apart", () => {
  let file: ArrayBuffer;
  beforeAll(async () => {
    file = await webRelease();
  });

  it("writes fragments of about a second, not a whole group each", async () => {
    // As Mediabunny does by itself: one fragment per group.
    expect((await rebuild(file, false)).fragments).toHaveLength(3);
    const cut = (await rebuild(file, true)).fragments;
    expect(cut.length).toBeGreaterThanOrEqual(27);
    expect(cut.length).toBeLessThanOrEqual(31);
  });

  it("leaves a file with a key frame every second as it was", async () => {
    const often = await webRelease(25);
    const plain = await rebuild(often, false);
    const cut = await rebuild(often, true);
    expect(cut.fragments.map((f) => f.bytes.length)).toEqual(plain.fragments.map((f) => f.bytes.length));
    expect(cut.fragments.every((f) => startsAtKeyFrame(f.bytes))).toBe(true);
  });

  it("keeps every frame, in order, with its own time; only the real key frames are key frames", async () => {
    const plain = await rebuild(file, false);
    const cut = await rebuild(file, true);
    expect(cut.packets).toEqual(plain.packets);
    expect(cut.packets.filter((p) => p.type === "key").map((p) => p.frame)).toEqual([0, 250, 500]);
  });

  it("gives each fragment the decode time where the one before it ended", async () => {
    const { fragments } = await rebuild(file, true);
    for (let i = 1; i < fragments.length; i++) expect(fragments[i]!.decodeStart).toBe(fragments[i - 1]!.decodeStart + fragments[i - 1]!.decodeLength);
  });

  it("knows which fragments begin with a key frame: only there may played media be removed", async () => {
    const { fragments } = await rebuild(file, true);
    const atKeys = fragments.map((f) => startsAtKeyFrame(f.bytes));
    expect(atKeys.filter(Boolean)).toHaveLength(3);
    expect(atKeys[0]).toBe(true);
    expect(startsAtKeyFrame(new Uint8Array(16))).toBe(false);
  });

  it("from the middle of a group, the first fragment ends a second after its key frame, not at the next one", async () => {
    const plain = await rebuild(file, false, 15.5);
    const cut = await rebuild(file, true, 15.5);
    expect(cut.packets).toEqual(plain.packets);
    // The run starts at the key frame of 10 s, 5.5 s before the place.
    expect(cut.packets[0]).toMatchObject({ frame: 250, type: "key" });
    expect(cut.packets[0]!.time).toBeCloseTo(-5.5);
    // Without cuts the first fragment is the whole group (10 s); with them, about a second of it.
    const ratio = plain.fragments[0]!.decodeLength / cut.fragments[0]!.decodeLength;
    expect(ratio).toBeGreaterThan(6);
    expect(ratio).toBeLessThan(11);
  });
});
