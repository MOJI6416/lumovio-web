import { describe, expect, it } from "vitest";
import { readClusterSubtitles, readMatroskaIndex } from "../src/lib/media/subs/matroska";

/*
 * A Matroska file whose cues name only the video's clusters (older mkvmerge, HDCLUB). Its subtitle lines are
 * found by walking the clusters — big video frames stepped over, not downloaded — and handed over one by one.
 */

const bytes = (...parts: (Uint8Array | number[])[]) => {
  const all = parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)));
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of all) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const idBytes = (id: number) => {
  const out: number[] = [];
  for (let v = id; v > 0; v = Math.floor(v / 256)) out.unshift(v % 256);
  return out;
};
/** An element with an 8-byte size. */
const el = (id: number, ...payload: (Uint8Array | number[])[]) => {
  const data = bytes(...payload);
  const size = [0x01, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 7, v = data.length; i > 0; i--, v = Math.floor(v / 256)) size[i] = v % 256;
  return bytes(idBytes(id), size, data);
};
/** A number in 8 bytes, so a payload's size doesn't depend on it. */
const u8 = (v: number) => {
  const out = new Array<number>(8).fill(0);
  for (let i = 7; i >= 0; i--, v = Math.floor(v / 256)) out[i] = v % 256;
  return out;
};
const text = (s: string) => new TextEncoder().encode(s);

const FRAME = 2 << 20;
/** Two clusters of 2 s: three 2 MB video frames each, and subtitle lines between them. */
function file() {
  const video = (rel: number) => el(0xa3, [0x81, rel >> 8, rel & 0xff, 0x80], new Uint8Array(FRAME));
  const line = (rel: number, s: string) => el(0xa0, el(0xa1, [0x82, rel >> 8, rel & 0xff, 0x00], text(s)), el(0x9b, u8(1500)));
  const clusters = [
    el(0x1f43b675, el(0xe7, u8(0)), video(0), line(200, "Первая"), video(700), line(900, "Вторая"), video(1400)),
    el(0x1f43b675, el(0xe7, u8(2000)), video(0), video(700), line(1000, "Третья"), video(1400)),
  ];
  const info = el(0x1549a966, el(0x2ad7b1, u8(1_000_000)));
  const tracks = el(
    0x1654ae6b,
    el(0xae, el(0xd7, [1]), el(0x83, [1]), el(0x86, text("V_MPEG4/ISO/AVC"))),
    el(0xae, el(0xd7, [2]), el(0x83, [17]), el(0x86, text("S_TEXT/UTF8")), el(0x22b59c, text("rus"))),
  );
  // Cues of the video track only; positions are relative to the Segment's data.
  const cue = (time: number, pos: number) => el(0xbb, el(0xb3, u8(time)), el(0xb7, el(0xf7, [1]), el(0xf1, u8(pos))));
  const cuesSize = el(0x1c53bb6b, cue(0, 0), cue(0, 0)).length;
  const first = info.length + tracks.length + cuesSize;
  const cues = el(0x1c53bb6b, cue(0, first), cue(2000, first + clusters[0]!.length));
  const segment = el(0x18538067, info, tracks, cues, ...clusters);
  return bytes(el(0x1a45dfa3, el(0x4282, text("matroska"))), segment);
}

describe("subtitles walked out of clusters the cues don't name", () => {
  const mkv = file();
  let fetched = 0;
  const read = async (s: number, e: number) => {
    fetched += Math.min(e, mkv.length) - s;
    return mkv.slice(s, e);
  };

  it("finds every line with its time and duration, stepping over the big frames", async () => {
    const idx = await readMatroskaIndex(read);
    expect(idx.cues).toEqual([]);
    expect(idx.clusters.map((c) => c.time)).toEqual([0, 2]);
    fetched = 0;
    const lines: string[] = [];
    for (const [i, c] of idx.clusters.entries())
      for (const b of await readClusterSubtitles(read, idx, c, idx.clusters[i + 1]?.pos ?? null))
        lines.push(`${b.time}+${b.duration} ${new TextDecoder().decode(b.data)}`);
    expect(lines).toEqual(["0.2+1.5 Первая", "0.9+1.5 Вторая", "3+1.5 Третья"]);
    // 12 MB of picture: what's read is the pieces landing on each element, not the frames.
    const total = mkv.length - idx.clusters[0]!.pos;
    expect(fetched).toBeLessThan(total * 0.4);
  });

  it("hands each line over as it is found, before the rest of the stretch is read", async () => {
    const idx = await readMatroskaIndex(read);
    const c = idx.clusters[0]!;
    const seen: { line: string; fetchedThen: number }[] = [];
    fetched = 0;
    await readClusterSubtitles(read, idx, c, idx.clusters[1]!.pos, {
      onBlock: (b) => seen.push({ line: new TextDecoder().decode(b.data), fetchedThen: fetched }),
    });
    expect(seen.map((s) => s.line)).toEqual(["Первая", "Вторая"]);
    expect(seen[0]!.fetchedThen).toBeLessThan(fetched);
  });

  it("stops between pieces when told to (a seek away)", async () => {
    const idx = await readMatroskaIndex(read);
    const stop = new AbortController();
    const walk = readClusterSubtitles(read, idx, idx.clusters[0]!, idx.clusters[1]!.pos, {
      signal: stop.signal,
      onBlock: () => stop.abort(),
    });
    await expect(walk).rejects.toMatchObject({ name: "AbortError" });
  });
});
