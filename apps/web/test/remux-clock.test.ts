import { ALL_FORMATS, BufferSource, BufferTarget, Conversion, EncodedPacket, EncodedPacketSink, EncodedVideoPacketSource, Input, MkvOutputFormat, Mp4OutputFormat, Output } from "mediabunny";
import { beforeAll, describe, expect, it } from "vitest";
import { FRAGMENTED, fileStart } from "../src/lib/media/remux";

const SPS = [0x67, 0x64, 0x00, 0x1f, 0xac, 0xd9, 0x40, 0x50, 0x05, 0xbb, 0x01, 0x10, 0x00, 0x00, 0x03, 0x00, 0x10, 0x00, 0x00, 0x03, 0x03, 0xc0, 0xf1, 0x83, 0x19, 0x60];
const PPS = [0x68, 0xeb, 0xe3, 0xcb, 0x22, 0xc0];
const lengthPrefixed = (...nals: number[][]) => new Uint8Array(nals.flatMap((n) => [0, 0, 0, n.length, ...n]));
const CLOCK = 10;

/** 12 s of video whose clock starts at 10 s, as a broadcast recording's does: a key frame every second, each frame numbered. */
async function recording() {
  const avcc = new Uint8Array([1, SPS[1]!, SPS[2]!, SPS[3]!, 0xff, 0xe1, 0, SPS.length, ...SPS, 1, 0, PPS.length, ...PPS]);
  const output = new Output({ format: new MkvOutputFormat(), target: new BufferTarget() });
  const source = new EncodedVideoPacketSource("avc");
  output.addVideoTrack(source, { frameRate: 25 });
  await output.start();
  const decoderConfig = { codec: "avc1.64001f", codedWidth: 1280, codedHeight: 720, description: avcc };
  for (let i = 0; i < 300; i++) {
    const key = i % 25 === 0;
    const data = key ? lengthPrefixed(SPS, PPS, [0x65, 0x88, i >> 8, i & 255]) : lengthPrefixed([0x41, 0x9a, i >> 8, i & 255]);
    await source.add(new EncodedPacket(data, key ? "key" : "delta", CLOCK + i / 25, 1 / 25), i === 0 ? { decoderConfig } : undefined);
  }
  await output.finalize();
  return output.target.buffer!;
}

/** The rebuild's conversion from `trim`, read back: the first frame it wrote (its number) and that frame's time. */
async function firstFrame(file: ArrayBuffer, trim: { start: number } | undefined) {
  const input = new Input({ source: new BufferSource(file), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat(FRAGMENTED), target: new BufferTarget() });
  const conversion = await Conversion.init({ input, output, showWarnings: false, trim });
  await conversion.execute();
  const built = new Input({ source: new BufferSource(output.target.buffer!), formats: ALL_FORMATS });
  const packet = (await new EncodedPacketSink((await built.getPrimaryVideoTrack())!).getFirstPacket())!;
  return { frame: (packet.data.at(-2)! << 8) | packet.data.at(-1)!, time: packet.timestamp };
}

describe("a file whose clock doesn't start at 0", () => {
  let file: ArrayBuffer;
  let zero: number;
  beforeAll(async () => {
    file = await recording();
    const input = new Input({ source: new BufferSource(file), formats: ALL_FORMATS });
    zero = await fileStart(input, [await input.getPrimaryVideoTrack(), null]);
  });

  it("knows where the clock starts", () => {
    expect(zero).toBe(CLOCK);
  });

  it("plays its first frame at 0 from the start, and the frame 5 s in when asked for 5 s", async () => {
    // From the start Mediabunny moves the clock to 0 itself.
    expect(await firstFrame(file, undefined)).toEqual({ frame: 0, time: 0 });
    // From the middle the engine asks on the file's clock; the output's own time starts at 0, and the engine puts it at 5 s.
    expect(await firstFrame(file, { start: zero + 5 })).toEqual({ frame: 125, time: 0 });
    // Asked by the viewer's time alone, the same 5 s gave the file's very first frame, 5 s late.
    expect(await firstFrame(file, { start: 5 })).toEqual({ frame: 0, time: 5 });
  });
});
