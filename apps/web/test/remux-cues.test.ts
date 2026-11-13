import { ALL_FORMATS, BufferTarget, CustomSource, EncodedPacket, EncodedPacketSink, EncodedVideoPacketSource, Input, MkvOutputFormat, Output } from "mediabunny";
import { describe, expect, it } from "vitest";
import { keyLookupFromCues } from "../src/lib/media/codecs/matroska";

const FPS = 10;
const SECONDS = 40;
/** Frames the container marks as key frames only to start a cluster there: half a second apart. */
const CLUSTER_EVERY = FPS / 2;
const KEY_EVERY = 10 * FPS;
const marker = (i: number) => [0x4c, 0x75, 0x6d, 0x6f, i >> 8, i & 255, 0x5a, 0xa5];
const SPS = [0x67, 0x64, 0x00, 0x1f, 0xac, 0xd9, 0x40, 0x50, 0x05, 0xbb, 0x01, 0x10, 0x00, 0x00, 0x03, 0x00, 0x10, 0x00, 0x00, 0x03, 0x03, 0xc0, 0xf1, 0x83, 0x19, 0x60];
const PPS = [0x68, 0xeb, 0xe3, 0xcb, 0x22, 0xc0];

/**
 * A film as a release muxes it: clusters half a second long, a key frame every ten seconds, and cue points only at key
 * frames. Mediabunny's writer starts a cluster only at a key frame and indexes every cluster, so the frames between are
 * written as key frames and turned back into delta frames in the bytes (the flags byte just before a frame's data), and
 * their cue points are left out when the file is read (`keysOnly`).
 */
async function releaseFile() {
  const output = new Output({ format: new MkvOutputFormat({ minimumClusterDuration: 0 }), target: new BufferTarget() });
  const source = new EncodedVideoPacketSource("avc");
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();
  const avcc = new Uint8Array([1, SPS[1]!, SPS[2]!, SPS[3]!, 0xff, 0xe1, 0, SPS.length, ...SPS, 1, 0, PPS.length, ...PPS]);
  const decoderConfig = { codec: "avc1.64001f", codedWidth: 1280, codedHeight: 720, description: avcc };
  for (let i = 0; i < FPS * SECONDS; i++) {
    const data = new Uint8Array([...marker(i), ...new Array(1500).fill(i & 255)]);
    await source.add(new EncodedPacket(data, i % CLUSTER_EVERY === 0 ? "key" : "delta", i / FPS, 1 / FPS), i === 0 ? { decoderConfig } : undefined);
  }
  await output.finalize();
  const bytes = new Uint8Array(output.target.buffer!);
  for (let i = CLUSTER_EVERY; i < FPS * SECONDS; i += CLUSTER_EVERY) {
    if (i % KEY_EVERY === 0) continue;
    const m = marker(i);
    const at = bytes.findIndex((_, p) => m.every((b, k) => bytes[p + k] === b));
    expect(bytes[at - 1]! & 0x80).toBe(0x80);
    bytes[at - 1]! &= 0x7f;
  }
  return bytes;
}

type Internals = { _backing: { internalTrack: { cuePoints: { time: number; clusterPosition: number }[] } } };

/** The file read by ranges, each range remembered; its cue points only at key frames. */
async function open(bytes: Uint8Array, fix: boolean) {
  const reads: number[] = [];
  const input = new Input({
    source: new CustomSource({
      getSize: () => bytes.byteLength,
      read: (start, end) => {
        reads.push(start);
        return bytes.slice(start, end);
      },
      prefetchProfile: "none",
      // Smaller than the file, as a film is to the reader's memory: a cluster read again is read from the file again.
      maxCacheSize: 16384,
    }),
    formats: ALL_FORMATS,
  });
  const track = (await input.getPrimaryVideoTrack())!;
  const cues = (track as unknown as Internals)._backing.internalTrack.cuePoints;
  cues.splice(0, cues.length, ...cues.filter((c) => c.time % (KEY_EVERY * (1000 / FPS)) === 0));
  if (fix) keyLookupFromCues(track);
  // A run from the middle asks where the file's clock starts first, as the engine does: the first cluster is read.
  await input.getFirstTimestamp([track]);
  return { input, track, reads, cueAt: (s: number) => cues.findLast((c) => c.time <= s * 1000)!.clusterPosition };
}

/** A key frame lookup as a run's start makes it: what it found and the first byte it read. */
async function lookup(o: Awaited<ReturnType<typeof open>>, at: number) {
  const from = o.reads.length;
  const packet = await new EncodedPacketSink(o.track).getKeyPacket(at);
  return { key: packet?.timestamp ?? null, readFrom: Math.min(Infinity, ...o.reads.slice(from)) };
}

describe("keyLookupFromCues", () => {
  it("models the file: a key frame and a cue point every ten seconds, clusters between", async () => {
    const o = await open(await releaseFile(), false);
    expect((o.track as unknown as Internals)._backing.internalTrack.cuePoints.map((c) => c.time)).toEqual([0, 10000, 20000, 30000]);
    expect((await lookup(o, 24)).key).toBe(20);
    o.input.dispose();
  });

  it("without it, a second lookup in the group the first began in reads the file from its start", async () => {
    const o = await open(await releaseFile(), false);
    const first = await lookup(o, 24);
    expect(first).toEqual({ key: 20, readFrom: o.cueAt(24) });
    const second = await lookup(o, 24.4);
    expect(second.key).toBe(20);
    expect(second.readFrom).toBeLessThan(o.cueAt(10));
    o.input.dispose();
  });

  it("starts a lookup at the cue point before the time, however many clusters after it were read", async () => {
    const o = await open(await releaseFile(), true);
    expect(await lookup(o, 24)).toEqual({ key: 20, readFrom: o.cueAt(24) });
    // Another audio track 0.4 s later, the same place again, a step back to the group's own key frame: nothing before it.
    for (const at of [24.4, 24, 20.2, 20]) {
      const r = await lookup(o, at);
      expect(r.key).toBe(20);
      expect(r.readFrom).toBeGreaterThanOrEqual(o.cueAt(20));
    }
    // A later group, and back to an earlier one.
    expect(await lookup(o, 33)).toMatchObject({ key: 30 });
    const back = await lookup(o, 15);
    expect(back.key).toBe(10);
    expect(back.readFrom).toBeGreaterThanOrEqual(o.cueAt(10));
    o.input.dispose();
  });

  it("leaves a track that isn't Matroska as it was", async () => {
    const getKeyPacket = async () => null;
    const track = { _backing: { getKeyPacket } } as unknown as Parameters<typeof keyLookupFromCues>[0];
    keyLookupFromCues(track);
    expect((track as unknown as { _backing: { getKeyPacket: unknown } })._backing.getKeyPacket).toBe(getKeyPacket);
  });
});
