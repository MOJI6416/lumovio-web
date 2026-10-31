import { readFileSync } from "node:fs";
import { ALL_FORMATS, BufferSource, EncodedPacketSink, Input } from "mediabunny";
import { describe, expect, it } from "vitest";
import { nameTrueHdTracks } from "../src/lib/media/codecs/audio";
import { loadCodec } from "./codec-wasm";

// The player's own WASM audio decoders (public/codecs/audio.js + .wasm, scripts/player-codecs/build.sh), run here in
// Node as the worker runs them in a browser, on the device check's TrueHD 5.1 clip (4 s, 48 kHz).
const create = loadCodec("audio");

async function decodeAll(maxChannels: number) {
  const m = await create();
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
  const rate = m.cwrap("output_rate", "number", ["number"]);
  const output = m.cwrap("output", "number", ["number"]);

  const file = readFileSync(new URL("../public/player-check/mkv-h264-truehd.mkv", import.meta.url));
  const source = new Input({ source: new BufferSource(file), formats: ALL_FORMATS });
  const tracks = await source.getAudioTracks();
  const named = nameTrueHdTracks(tracks);
  const track = tracks[0]!;
  const ctx = init(0, maxChannels, track.numberOfChannels, track.sampleRate, 0, 0);
  let samples = 0;
  let peak = 0;
  let ch = 0;
  let sr = 0;
  for await (const packet of new EncodedPacketSink(track).packets()) {
    const at = input(ctx, packet.data.length);
    m.HEAPU8.set(packet.data, at);
    const n = decode(ctx);
    expect(n).toBeGreaterThanOrEqual(0);
    if (!n) continue;
    ch = channels(ctx);
    sr = rate(ctx);
    const out = output(ctx) >> 2;
    for (const v of m.HEAPF32.subarray(out, out + n * ch)) peak = Math.max(peak, Math.abs(v));
    samples += n;
  }
  source.dispose();
  return { codec: named.get(track), mbCodec: track.codec, samples, channels: ch, sampleRate: sr, peak };
}

describe("TrueHD in WebAssembly", () => {
  it("names Matroska's TrueHD track for Mediabunny and decodes its 5.1 to float samples", async () => {
    const r = await decodeAll(6);
    expect(r.codec).toBe("truehd");
    expect(r.mbCodec).toBe("truehd");
    expect(r.channels).toBe(6);
    expect(r.sampleRate).toBe(48000);
    // 4 s of a 440 Hz sine at FFmpeg's default amplitude (1/8).
    expect(r.samples).toBeGreaterThan(48000 * 3.9);
    expect(r.peak).toBeGreaterThan(0.1);
    expect(r.peak).toBeLessThan(0.2);
  });

  it("gives its stereo presentation when the rebuild encodes stereo", async () => {
    const r = await decodeAll(2);
    expect(r.channels).toBe(2);
    expect(r.samples).toBeGreaterThan(48000 * 3.9);
  });
});
