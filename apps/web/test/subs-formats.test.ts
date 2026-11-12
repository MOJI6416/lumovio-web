import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompress, readCueBlock, readMatroskaIndex } from "../src/lib/media/subs/matroska";
import { readMp4TextTracks, tx3gText } from "../src/lib/media/subs/mp4";
import { decodeText } from "../src/lib/media/subs/text";
import { decodeVobRle, parseIdx, vobSubFrames } from "../src/lib/media/subs/vobsub";

const reader = (file: string) => {
  const bytes = readFileSync(new URL(`../public/player-check/${file}`, import.meta.url));
  const reads: [number, number][] = [];
  const read = async (s: number, e: number) => {
    reads.push([s, e]);
    return new Uint8Array(bytes.subarray(s, e));
  };
  return { read, reads, size: bytes.length };
};

// The device check's MP4 subtitle clip: mov_text rus, mov_text rus forced.
describe("MP4 text subtitles (tx3g)", () => {
  it("finds the text tracks with their language, name and kind, reading only the movie box", async () => {
    const { read, reads, size } = reader("mp4-subs.mp4");
    const tracks = await readMp4TextTracks(read);
    expect(tracks.map((t) => [t.language, t.name, t.forced])).toEqual([
      ["rus", null, false],
      ["rus", "Forced", true],
    ]);
    // A few headers and the movie box: far less than the file.
    expect(reads.reduce((n, [s, e]) => n + (e - s), 0)).toBeLessThan(size / 4);
  });

  it("reads each line by its sample: time, duration, text with italics", async () => {
    const { read } = reader("mp4-subs.mp4");
    const [full, forced] = await readMp4TextTracks(read);
    const lines = async (t: typeof full) => {
      const out: string[] = [];
      for (const s of t!.samples) {
        const text = tx3gText(await read(s.offset, s.offset + s.size));
        if (text) out.push(`${s.time.toFixed(2)}–${(s.time + s.duration).toFixed(2)} ${text}`);
      }
      return out;
    };
    expect(await lines(full)).toEqual(["0.50–1.80 <i>Первая</i> строка", "2.00–3.50 Вторая строка"]);
    expect(await lines(forced)).toEqual(["1.00–2.50 НАДПИСЬ"]);
  });

  it("a sample's style box: bold, italic and underline as cue tags; the text escaped", () => {
    const text = new TextEncoder().encode("a<b & c");
    const styl = [0, 0, 0, 22, ...[0x73, 0x74, 0x79, 0x6c], 0, 1, 0, 0, 0, 3, 0, 1, 3, 18, 255, 255, 255, 255];
    const sample = new Uint8Array([0, text.length, ...text, ...styl]);
    expect(tx3gText(sample)).toBe("<b><i>a&lt;b</i></b> &amp; c");
    expect(tx3gText(new Uint8Array([0, 0]))).toBe("");
  });

  it("a file that isn't MP4 says so", async () => {
    const { read } = reader("mkv-h264-aac.mkv");
    await expect(readMp4TextTracks(read)).rejects.toThrow("not MP4");
  });
});

describe("VobSub (DVD picture subtitles)", () => {
  it("reads the Matroska track's palette and decodes each subpicture with its start and end", async () => {
    const { read } = reader("mkv-subs.mkv");
    const idx = await readMatroskaIndex(read);
    const t = idx.tracks.find((x) => x.codecId === "S_VOBSUB")!;
    expect(t.language).toBe("fre");
    const header = parseIdx(decodeText(t.codecPrivate!));
    expect(header.palette).toHaveLength(16);
    const frames = [];
    for (const c of idx.cues.filter((x) => x.track === t.number)) {
      const b = (await readCueBlock(read, idx, c))!;
      frames.push(...vobSubFrames(await decompress(t, b.data), b.time, b.duration, header));
    }
    // Times in 1024/90000 s steps (11 ms).
    expect(frames.map((f) => [Number(f.time.toFixed(1)), f.bitmaps.length])).toEqual([
      [0.5, 1],
      [1.8, 0],
      [2, 1],
      [3.5, 0],
    ]);
    // Light letters on a transparent box.
    const bmp = frames[0]!.bitmaps[0]!;
    let light = 0;
    let clear = 0;
    for (let i = 0; i < bmp.rgba.length; i += 4) {
      if (bmp.rgba[i + 3]! > 0 && bmp.rgba[i]! > 200) light++;
      if (bmp.rgba[i + 3] === 0) clear++;
    }
    expect(light).toBeGreaterThan(50);
    expect(clear).toBeGreaterThan(light);
  });

  it("run-length codes: one to four nibbles, a run to the line's end, lines on whole bytes, two fields", () => {
    // Even line: 3 × colour 1 (one nibble, 0xd), then colour 2 to the end (four nibbles, 0x0002), padded to a byte.
    // Odd line (its own field, from byte 3): 5 × colour 3 (two nibbles, 0x17), then colour 0 to the end (0x0000).
    const buf = new Uint8Array([0xd0, 0x00, 0x20, 0x17, 0x00, 0x00]);
    const out = new Uint8Array(8 * 2);
    decodeVobRle(buf, 0, 8, 1, out, 0);
    decodeVobRle(buf, 3, 8, 1, out, 1);
    expect([...out.subarray(0, 8)]).toEqual([1, 1, 1, 2, 2, 2, 2, 2]);
    expect([...out.subarray(8)]).toEqual([3, 3, 3, 3, 3, 0, 0, 0]);
  });

  it("the .idx header: size and palette; what's missing gets defaults", () => {
    const h = parseIdx("# VobSub index file, v7\nsize: 720x480\npalette: 000000, ffffff, 808080, 101010, ff0000\n");
    expect([h.width, h.height]).toEqual([720, 480]);
    expect(h.palette.slice(0, 2)).toEqual([
      [0, 0, 0],
      [255, 255, 255],
    ]);
    expect(h.palette).toHaveLength(16);
    expect(parseIdx("").width).toBe(720);
  });
});
