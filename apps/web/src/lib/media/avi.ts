import type { RangeReader } from "./subs/matroska";

/**
 * Just enough AVI to play the old releases (Xvid/DivX, MPEG-2) in the browser (`legacy.ts`): the streams' formats from
 * the header, and every chunk's place, time and key flag from the index — idx1 at the end of the file, or OpenDML's
 * per-stream indexes of files over 1 GB. Read by ranges: the header, then the index, never the whole file.
 */

export interface AviStream {
  /** Position among the file's streams (chunk ids "00dc", "01wb"). */
  index: number;
  type: "vids" | "auds" | "other";
  /** Video: the compression FourCC ("XVID", "DX50", "DIV3", "MPG2"). */
  fourcc: string;
  /** Audio: the WAVE format tag (0x55 MP3, 0x50 MP2, 0x2000 AC-3, 1 PCM). */
  formatTag: number;
  width: number;
  height: number;
  /** Seconds per frame (video) or per chunk of a variable-rate stream: dwScale / dwRate. */
  frameTime: number;
  /** Fixed-rate audio: bytes per second (dwSampleSize × dwRate / dwScale); 0 for one chunk per frame. */
  bytesPerSecond: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  /** The codec header after the format structure (MPEG-4 VOL, WAVE extra bytes), or null. */
  extradata: Uint8Array | null;
  /** OpenDML super index entries: absolute offset and size of each of this stream's index chunks. */
  superIndex: { offset: number; size: number }[];
}

export interface AviChunk {
  stream: number;
  /** Absolute offset of the chunk's data and its size. */
  offset: number;
  size: number;
  key: boolean;
  /** Seconds. */
  time: number;
}

export interface AviFile {
  streams: AviStream[];
  /** All chunks of the indexed streams, in file order. */
  chunks: AviChunk[];
  duration: number;
}

export class AviError extends Error {}

const fourcc = (b: Uint8Array, p: number) => String.fromCharCode(b[p]!, b[p + 1]!, b[p + 2]!, b[p + 3]!);
const u16 = (b: Uint8Array, p: number) => b[p]! | (b[p + 1]! << 8);
const u32 = (b: Uint8Array, p: number) =>
  (b[p]! | (b[p + 1]! << 8) | (b[p + 2]! << 16)) + b[p + 3]! * 0x1000000;
const u64 = (b: Uint8Array, p: number) => u32(b, p) + u32(b, p + 4) * 0x100000000;

/** The stream number of a chunk id ("01wb" → 1), or -1. */
const streamOf = (id: string) => {
  const n = Number.parseInt(id.slice(0, 2), 10);
  return Number.isFinite(n) && /^\d\d/.test(id) ? n : -1;
};

const HEAD = 256 * 1024;

export async function readAvi(read: RangeReader, fileSize: number | null): Promise<AviFile> {
  const b = await read(0, HEAD);
  if (b.length < 12 || fourcc(b, 0) !== "RIFF" || fourcc(b, 8) !== "AVI ")
    throw new AviError("not an AVI file");
  const streams: AviStream[] = [];
  let moviData = -1;
  let moviEnd = -1;
  // Top-level chunks of the first RIFF: hdrl (in the first read), then movi and idx1 (found by their sizes).
  let p = 12;
  const riffEnd = 8 + u32(b, 4);
  while (p + 12 <= riffEnd) {
    const head = p + 12 <= b.length ? b.subarray(p, p + 12) : await read(p, p + 12);
    if (head.length < 8) break;
    const id = fourcc(head, 0);
    const size = u32(head, 4);
    if (id === "LIST" && fourcc(head, 8) === "hdrl") {
      if (p + 8 + size > b.length) throw new AviError("header too big");
      parseHdrl(b, p + 12, p + 8 + size, streams);
    } else if (id === "LIST" && fourcc(head, 8) === "movi") {
      moviData = p + 8;
      moviEnd = p + 8 + size;
    } else if (id === "idx1" && moviData >= 0) {
      const idx = await read(p + 8, p + 8 + size);
      return finish(streams, await fromIdx1(idx, read, moviData, streams));
    }
    p += 8 + size + (size & 1);
  }
  // No idx1: OpenDML's per-stream indexes.
  if (streams.some((s) => s.superIndex.length)) return finish(streams, await fromOpenDml(read, streams));
  void moviEnd;
  void fileSize;
  throw new AviError("no index");
}

function parseHdrl(b: Uint8Array, start: number, end: number, streams: AviStream[]) {
  let p = start;
  while (p + 8 <= end) {
    const id = fourcc(b, p);
    const size = u32(b, p + 4);
    if (id === "LIST" && fourcc(b, p + 8) === "strl") {
      const s: AviStream = {
        index: streams.length,
        type: "other",
        fourcc: "",
        formatTag: 0,
        width: 0,
        height: 0,
        frameTime: 0,
        bytesPerSecond: 0,
        channels: 0,
        sampleRate: 0,
        bitsPerSample: 0,
        extradata: null,
        superIndex: [],
      };
      let q = p + 12;
      const listEnd = p + 8 + size;
      while (q + 8 <= listEnd) {
        const cid = fourcc(b, q);
        const csize = u32(b, q + 4);
        const d = q + 8;
        if (cid === "strh") {
          const type = fourcc(b, d);
          s.type = type === "vids" || type === "auds" ? type : "other";
          const handler = fourcc(b, d + 4);
          if (s.type === "vids") s.fourcc = handler;
          const scale = u32(b, d + 20);
          const rate = u32(b, d + 24);
          const sampleSize = u32(b, d + 44);
          s.frameTime = rate ? scale / rate : 0;
          s.bytesPerSecond = sampleSize && scale ? (sampleSize * rate) / scale : 0;
        } else if (cid === "strf") {
          if (s.type === "vids" && csize >= 40) {
            s.width = u32(b, d + 4);
            s.height = Math.abs(u32(b, d + 8) | 0);
            const compression = fourcc(b, d + 16);
            if (/^[\x20-\x7e]{4}$/.test(compression)) s.fourcc = compression;
            if (csize > 40) s.extradata = b.slice(d + 40, d + csize);
          } else if (s.type === "auds" && csize >= 16) {
            s.formatTag = u16(b, d);
            s.channels = u16(b, d + 2);
            s.sampleRate = u32(b, d + 4);
            // A variable-rate stream's chunk duration comes from strh; a fixed-rate one counts bytes.
            const avgBytes = u32(b, d + 8);
            if (s.bytesPerSecond) s.bytesPerSecond = avgBytes || s.bytesPerSecond;
            s.bitsPerSample = u16(b, d + 14);
            if (csize > 18) {
              const extra = u16(b, d + 16);
              if (extra && 18 + extra <= csize) s.extradata = b.slice(d + 18, d + 18 + extra);
            }
            // WAVE_FORMAT_EXTENSIBLE: the real format is the sub-format GUID's first two bytes.
            if (s.formatTag === 0xfffe && s.extradata && s.extradata.length >= 22)
              s.formatTag = u16(s.extradata, 6);
          }
        } else if (cid === "indx" && csize >= 24) {
          // OpenDML super index: entries of { qwOffset, dwSize, dwDuration }.
          const longs = u16(b, d);
          const inUse = u32(b, d + 4);
          if (longs === 4 && b[d + 3] === 0)
            for (let k = 0; k < inUse && d + 24 + k * 16 + 16 <= q + 8 + csize; k++)
              s.superIndex.push({ offset: u64(b, d + 24 + k * 16), size: u32(b, d + 24 + k * 16 + 8) });
        }
        q = d + csize + (csize & 1);
      }
      streams.push(s);
    }
    p += 8 + size + (size & 1);
  }
}

/** idx1 entries: { ckid, flags (0x10 key), offset, size }; offsets count from the "movi" FourCC or, in a few muxers, from the file's start. */
async function fromIdx1(
  idx: Uint8Array,
  read: RangeReader,
  moviData: number,
  streams: AviStream[],
): Promise<{ stream: number; offset: number; size: number; key: boolean }[]> {
  const raw: { stream: number; id: string; flags: number; offset: number; size: number }[] = [];
  for (let q = 0; q + 16 <= idx.length; q += 16) {
    const id = fourcc(idx, q);
    const stream = streamOf(id);
    if (stream < 0 || !streams[stream] || streams[stream]!.type === "other") continue;
    raw.push({ stream, id, flags: u32(idx, q + 4), offset: u32(idx, q + 8), size: u32(idx, q + 12) });
  }
  if (!raw.length) throw new AviError("empty index");
  // Which base: the first entry's chunk header must be where it says (its id at the offset).
  const first = raw[0]!;
  const relative = await read(moviData + first.offset, moviData + first.offset + 4);
  const base = fourcc(relative, 0) === first.id ? moviData : 0;
  return raw.map((r) => ({
    stream: r.stream,
    offset: base + r.offset + 8,
    size: r.size,
    key: Boolean(r.flags & 0x10),
  }));
}

async function fromOpenDml(
  read: RangeReader,
  streams: AviStream[],
): Promise<{ stream: number; offset: number; size: number; key: boolean }[]> {
  const out: { stream: number; offset: number; size: number; key: boolean }[] = [];
  for (const s of streams) {
    if (s.type === "other") continue;
    for (const part of s.superIndex) {
      const b = await read(part.offset, part.offset + part.size);
      // "ix##" chunk: wLongsPerEntry, bIndexSubType, bIndexType (1 = chunks), nEntriesInUse, dwChunkId, qwBaseOffset.
      const d = 8;
      const inUse = u32(b, d + 4);
      const baseOffset = u64(b, d + 12);
      for (let k = 0; k < inUse && d + 24 + k * 8 + 8 <= b.length; k++) {
        const off = u32(b, d + 24 + k * 8);
        const raw = u32(b, d + 24 + k * 8 + 4);
        out.push({
          stream: s.index,
          offset: baseOffset + off,
          size: raw & 0x7fffffff,
          key: !(raw & 0x80000000),
        });
      }
    }
  }
  return out.sort((a, z) => a.offset - z.offset);
}

/** Times: a video frame or a variable-rate audio chunk counts one `frameTime`; fixed-rate audio counts its bytes. */
function finish(
  streams: AviStream[],
  entries: { stream: number; offset: number; size: number; key: boolean }[],
): AviFile {
  const frames = new Map<number, number>();
  const bytes = new Map<number, number>();
  const chunks: AviChunk[] = [];
  let duration = 0;
  for (const e of entries) {
    const s = streams[e.stream]!;
    let time: number;
    if (s.type === "auds" && s.bytesPerSecond) {
      const before = bytes.get(e.stream) ?? 0;
      time = before / s.bytesPerSecond;
      bytes.set(e.stream, before + e.size);
    } else {
      const n = frames.get(e.stream) ?? 0;
      time = n * s.frameTime;
      frames.set(e.stream, n + 1);
    }
    // Audio has no key frames in AVI's sense: every chunk starts cleanly.
    chunks.push({ stream: e.stream, offset: e.offset, size: e.size, key: s.type === "auds" || e.key, time });
    if (s.type === "vids") duration = Math.max(duration, time + s.frameTime);
  }
  return { streams, chunks, duration };
}

/** The video chunk to start from for `t`: the last key frame at or before it. */
/**
 * The chunks a run from `t` reads, in file order: the video from the key frame at or before `t` on, and the audio from
 * 50 ms before that key frame — wherever the file keeps it. Muxers store sound up to a second ahead of its picture, so
 * the sound of the key frame's first moments may lie before the key frame's own chunk; read from there, it isn't lost.
 */
export function runChunks(file: AviFile, video: number, audio: number | null, t: number): AviChunk[] {
  const i0 = startChunk(file, video, t);
  const keyTime = file.chunks[i0]?.time ?? 0;
  let from = i0;
  if (audio !== null)
    for (let i = i0 - 1; i >= 0 && i0 - i < 4096; i--) {
      const c = file.chunks[i]!;
      if (c.stream !== audio) continue;
      if (c.time < keyTime - 0.05) break;
      from = i;
    }
  return file.chunks.slice(from).filter((c, k) => c.size > 0 && ((c.stream === video && from + k >= i0) || (c.stream === audio && c.time >= keyTime - 0.05)));
}

export function startChunk(file: AviFile, video: number, t: number): number {
  let at = -1;
  for (let i = 0; i < file.chunks.length; i++) {
    const c = file.chunks[i]!;
    if (c.stream !== video || !c.key || c.size === 0) continue;
    if (c.time > t + 1e-6) break;
    at = i;
  }
  return Math.max(0, at);
}
