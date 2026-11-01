import type { RangeReader } from "./matroska";
import { decodeText } from "./text";

/**
 * Just enough MP4 to read a file's text subtitles (3GPP timed text, "tx3g" — FFmpeg's mov_text), which browsers
 * don't show: the movie box (`moov`, at the start or the end of the file) with each text track's language, name and
 * sample tables, read with HTTP ranges; then each line by its own small range near the playhead, like a Matroska cue
 * (`matroska.ts`). Fragmented MP4 (moof) isn't read.
 */

export class Mp4Error extends Error {}

export interface Mp4Sample {
  /** Seconds. */
  time: number;
  duration: number;
  /** Absolute byte position and size. */
  offset: number;
  size: number;
}

export interface Mp4TextTrack {
  id: number;
  /** ISO 639-2 ("rus", "eng"), null for "und". */
  language: string | null;
  name: string | null;
  /** Only signs and foreign lines: its kind box says "forced-subtitle" (FFmpeg's forced disposition). */
  forced: boolean;
  enabled: boolean;
  samples: Mp4Sample[];
}

/** The largest movie box read (a long film's tables of every track are a few MB). */
const MOOV_LIMIT = 64 * 1024 * 1024;

interface Box {
  type: string;
  /** Absolute (or buffer) positions of the box's content and end. */
  start: number;
  end: number;
}

const fourcc = (b: Uint8Array, p: number) => String.fromCharCode(b[p]!, b[p + 1]!, b[p + 2]!, b[p + 3]!);
const u32 = (b: Uint8Array, p: number) => ((b[p]! << 24) >>> 0) + ((b[p + 1]! << 16) | (b[p + 2]! << 8) | b[p + 3]!);
const u64 = (b: Uint8Array, p: number) => u32(b, p) * 2 ** 32 + u32(b, p + 4);
const u16 = (b: Uint8Array, p: number) => (b[p]! << 8) | b[p + 1]!;

/** The boxes inside `[start, end)` of a buffer. */
function children(b: Uint8Array, start: number, end: number): Box[] {
  const out: Box[] = [];
  let p = start;
  while (p + 8 <= end) {
    let size = u32(b, p);
    let head = 8;
    if (size === 1 && p + 16 <= end) {
      size = u64(b, p + 8);
      head = 16;
    } else if (size === 0) size = end - p;
    if (size < head || p + size > end) break;
    out.push({ type: fourcc(b, p + 4), start: p + head, end: p + size });
    p += size;
  }
  return out;
}

const child = (b: Uint8Array, box: Box, type: string) => children(b, box.start, box.end).find((c) => c.type === type);

/** The path of boxes from `box` down, or undefined. */
function find(b: Uint8Array, box: Box, ...path: string[]): Box | undefined {
  let at: Box | undefined = box;
  for (const t of path) at = at && child(b, at, t);
  return at;
}

/** The top-level boxes of the file, read header by header, until the movie box; it is read whole. */
async function readMoov(read: RangeReader): Promise<Uint8Array> {
  let p = 0;
  for (let n = 0; n < 64; n++) {
    const h = await read(p, p + 16);
    if (h.length < 8) break;
    const type = fourcc(h, 4);
    if (n === 0 && type !== "ftyp" && type !== "moov" && type !== "free" && type !== "skip" && type !== "wide")
      throw new Mp4Error("not MP4");
    let size = u32(h, 0);
    let head = 8;
    if (size === 1) {
      if (h.length < 16) break;
      size = u64(h, 8);
      head = 16;
    }
    if (type === "moov") {
      if (size === 0 || size > MOOV_LIMIT) throw new Mp4Error("movie box too large");
      const body = await read(p + head, p + size);
      if (body.length < size - head) throw new Error("movie box cut short");
      return body;
    }
    // A box to the end of the file (size 0) or a broken size: no movie box after it.
    if (size < head) break;
    p += size;
  }
  throw new Mp4Error("no movie box");
}

/** ISO 639-2/T packed in 15 bits (mdhd). */
function packedLanguage(v: number): string | null {
  const s = String.fromCharCode(((v >> 10) & 31) + 0x60, ((v >> 5) & 31) + 0x60, (v & 31) + 0x60);
  return /^[a-z]{3}$/.test(s) && s !== "und" ? s : null;
}

/** The file's tx3g tracks with their samples, in file order. */
export async function readMp4TextTracks(read: RangeReader): Promise<Mp4TextTrack[]> {
  const b = await readMoov(read);
  const all: Box = { type: "moov", start: 0, end: b.length };
  const mvhd = child(b, all, "mvhd");
  const movieScale = mvhd ? u32(b, mvhd.start + (b[mvhd.start] === 1 ? 20 : 12)) || 1 : 1;
  const out: Mp4TextTrack[] = [];
  for (const trak of children(b, 0, b.length).filter((c) => c.type === "trak")) {
    const stsd = find(b, trak, "mdia", "minf", "stbl", "stsd");
    const entry = stsd && children(b, stsd.start + 8, stsd.end)[0];
    if (entry?.type !== "tx3g") continue;
    const tkhd = child(b, trak, "tkhd");
    const mdhd = find(b, trak, "mdia", "mdhd");
    if (!tkhd || !mdhd) continue;
    const id = u32(b, tkhd.start + (b[tkhd.start] === 1 ? 20 : 12));
    const v1 = b[mdhd.start] === 1;
    const scale = u32(b, mdhd.start + (v1 ? 20 : 12)) || 1;
    const language = packedLanguage(u16(b, mdhd.start + (v1 ? 32 : 20)));
    const stbl = find(b, trak, "mdia", "minf", "stbl")!;
    const samples = sampleTable(b, stbl, scale);
    // The edit list moves the track on the film's timeline: an empty edit first delays it, a media time skips into it.
    const elst = find(b, trak, "edts", "elst");
    let shift = 0;
    if (elst) {
      const ev1 = b[elst.start] === 1;
      const n = u32(b, elst.start + 4);
      for (let i = 0, p = elst.start + 8; i < n && p < elst.end; i++, p += ev1 ? 20 : 12) {
        const dur = ev1 ? u64(b, p) : u32(b, p);
        const media = ev1 ? u64(b, p + 8) : u32(b, p + 4);
        const empty = ev1 ? media === 2 ** 64 - 1 || u32(b, p + 8) === 0xffffffff : media === 0xffffffff;
        if (empty) shift += dur / movieScale;
        else {
          shift -= media / scale;
          break;
        }
      }
    }
    if (shift) for (const s of samples) s.time += shift;
    const udta = child(b, trak, "udta");
    const kinds = udta ? children(b, udta.start, udta.end).filter((k) => k.type === "kind") : [];
    const forced = kinds.some((k) => cString(b, k.start + 4, k.end).split("\0")[1] === "forced-subtitle");
    out.push({ id, language, name: trackName(b, trak), forced, enabled: Boolean(b[tkhd.start + 3]! & 1), samples });
  }
  return out;
}

const cString = (b: Uint8Array, start: number, end: number) => new TextDecoder().decode(b.subarray(start, end));

/** Names muxers give every text track: not the track's own. */
const MUXER_NAME = /handler|^(core media|gpac|apple|mp4box|l-smash|subtitles?|text|timed text|sbtl|tx3g)\b/i;

/** The track's own title: udta/name (FFmpeg's `title`), else the handler's name when a muxer didn't make it up. */
function trackName(b: Uint8Array, trak: Box): string | null {
  const name = find(b, trak, "udta", "name");
  if (name) {
    const s = cString(b, name.start, name.end).replace(/\0/g, "").trim();
    if (s) return s;
  }
  const hdlr = find(b, trak, "mdia", "hdlr");
  if (!hdlr || hdlr.end - hdlr.start <= 24) return null;
  let raw = b.subarray(hdlr.start + 24, hdlr.end);
  // QuickTime writes a length byte first.
  if (raw[0] === raw.length - 1) raw = raw.subarray(1);
  const s = cString(raw, 0, raw.length).replace(/\0/g, "").trim();
  return s && !MUXER_NAME.test(s) ? s : null;
}

function sampleTable(b: Uint8Array, stbl: Box, scale: number): Mp4Sample[] {
  const stts = child(b, stbl, "stts");
  const stsc = child(b, stbl, "stsc");
  const stsz = child(b, stbl, "stsz");
  const stco = child(b, stbl, "stco");
  const co64 = child(b, stbl, "co64");
  if (!stts || !stsc || !stsz || !(stco || co64)) return [];
  const count = u32(b, stsz.start + 8);
  const fixed = u32(b, stsz.start + 4);
  const size = (i: number) => (fixed ? fixed : u32(b, stsz.start + 12 + i * 4));
  const chunks = co64 ? u32(b, co64.start + 4) : u32(b, stco!.start + 4);
  const chunkOffset = (i: number) => (co64 ? u64(b, co64.start + 8 + i * 8) : u32(b, stco!.start + 8 + i * 4));
  // Durations, sample by sample.
  const durations: number[] = [];
  for (let i = 0, n = u32(b, stts.start + 4), p = stts.start + 8; i < n; i++, p += 8)
    for (let k = u32(b, p), d = u32(b, p + 4); k > 0 && durations.length < count; k--) durations.push(d);
  const runs: { first: number; per: number }[] = [];
  for (let i = 0, n = u32(b, stsc.start + 4), p = stsc.start + 8; i < n; i++, p += 12) runs.push({ first: u32(b, p) - 1, per: u32(b, p + 4) });
  const out: Mp4Sample[] = [];
  let t = 0;
  let s = 0;
  for (let r = 0; r < runs.length && s < count; r++) {
    const last = r + 1 < runs.length ? runs[r + 1]!.first : chunks;
    for (let c = runs[r]!.first; c < last && s < count; c++) {
      let offset = chunkOffset(c);
      for (let k = 0; k < runs[r]!.per && s < count; k++, s++) {
        const d = durations[s] ?? 0;
        out.push({ time: t / scale, duration: d / scale, offset, size: size(s) });
        offset += size(s);
        t += d;
      }
    }
  }
  return out;
}

/**
 * One tx3g sample as WebVTT cue text: its text (16-bit length, UTF-8 or UTF-16 with a BOM), with the bold, italic and
 * underline of its style box kept; an empty sample (a gap between lines) is "".
 */
export function tx3gText(sample: Uint8Array): string {
  if (sample.length < 2) return "";
  const len = Math.min(u16(sample, 0), sample.length - 2);
  const text = decodeText(sample.subarray(2, 2 + len)).replace(/\r\n?/g, "\n");
  const chars = Array.from(text);
  const flags = new Uint8Array(chars.length);
  for (const box of children(sample, 2 + len, sample.length))
    if (box.type === "styl")
      for (let i = 0, n = u16(sample, box.start), p = box.start + 2; i < n && p + 12 <= box.end; i++, p += 12)
        flags.fill(sample[p + 6]! & 7, u16(sample, p), Math.min(u16(sample, p + 2), chars.length));
  const esc = (c: string) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c);
  const tags: [number, string][] = [
    [1, "b"],
    [2, "i"],
    [4, "u"],
  ];
  let out = "";
  let open = 0;
  for (let i = 0; i <= chars.length; i++) {
    const f = i < chars.length ? flags[i]! : 0;
    if (f !== open) {
      for (const [bit, tag] of [...tags].reverse()) if (open & bit) out += `</${tag}>`;
      for (const [bit, tag] of tags) if (f & bit) out += `<${tag}>`;
      open = f;
    }
    if (i < chars.length) out += esc(chars[i]!);
  }
  return out.trim();
}
