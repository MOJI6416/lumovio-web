/**
 * Just enough Matroska to find a file's subtitle tracks and read their blocks one by one (PLR-14): the tracks, the
 * timestamp scale, the cues and the attached fonts — read with HTTP ranges from the start and the cues' place, never
 * the whole file. Muxers (mkvmerge, FFmpeg) write a cue for every subtitle block with its place inside the cluster
 * (CueRelativePosition) and its duration, so one subtitle line costs one small range request, near the playhead,
 * where a torrent's pieces are being fetched for the picture anyway. Browsers read none of these tracks themselves.
 */

/** `[start, end)` of the file; may return fewer bytes at the end of the file. */
export type RangeReader = (start: number, end: number) => Promise<Uint8Array>;

export interface MkvTrack {
  number: number;
  /** 1 video, 2 audio, 17 subtitle. */
  type: number;
  codecId: string;
  codecPrivate: Uint8Array | null;
  language: string | null;
  name: string | null;
  isDefault: boolean;
  forced: boolean;
  /** Content compression of the frames: 0 zlib, 3 header stripping (`settings` is the stripped prefix). */
  compression: { algo: number; settings: Uint8Array | null } | null;
}

export interface MkvCue {
  /** Seconds. */
  time: number;
  track: number;
  /** Absolute byte position of the cluster. */
  cluster: number;
  /** Position of the block inside the cluster's data, when the muxer wrote it. */
  relative: number | null;
  /** Seconds, when the muxer wrote it. */
  duration: number | null;
}

export interface MkvAttachment {
  name: string;
  mime: string;
  /** Absolute position and size of the file's data. */
  offset: number;
  size: number;
}

export interface MkvIndex {
  /** Absolute position of the Segment's data, which every position in it is relative to. */
  segmentData: number;
  /** Seconds per timestamp unit (TimestampScale ns / 1e9). */
  scale: number;
  tracks: MkvTrack[];
  /** Cue points of subtitle tracks only, by time. */
  cues: MkvCue[];
  /** Where the attached files are (`readAttachments`), or null. */
  attachmentsAt: number | null;
  /** The clusters the cues name (absolute position, start time in s), in file order. */
  clusters: { pos: number; time: number }[];
}

export interface MkvBlock {
  track: number;
  /** Seconds. */
  time: number;
  /** Seconds, when the block says. */
  duration: number | null;
  data: Uint8Array;
}

const ID = {
  EBML: 0x1a45dfa3,
  Segment: 0x18538067,
  SeekHead: 0x114d9b74,
  Seek: 0x4dbb,
  SeekID: 0x53ab,
  SeekPosition: 0x53ac,
  Info: 0x1549a966,
  TimestampScale: 0x2ad7b1,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  TrackNumber: 0xd7,
  TrackType: 0x83,
  CodecID: 0x86,
  CodecPrivate: 0x63a2,
  Language: 0x22b59c,
  LanguageBCP47: 0x22b59d,
  Name: 0x536e,
  FlagDefault: 0x88,
  FlagForced: 0x55aa,
  ContentEncodings: 0x6d80,
  ContentEncoding: 0x6240,
  ContentCompression: 0x5034,
  ContentCompAlgo: 0x4254,
  ContentCompSettings: 0x4255,
  Cues: 0x1c53bb6b,
  CuePoint: 0xbb,
  CueTime: 0xb3,
  CueTrackPositions: 0xb7,
  CueTrack: 0xf7,
  CueClusterPosition: 0xf1,
  CueRelativePosition: 0xf0,
  CueDuration: 0xb2,
  Cluster: 0x1f43b675,
  Timestamp: 0xe7,
  SimpleBlock: 0xa3,
  BlockGroup: 0xa0,
  Block: 0xa1,
  BlockDuration: 0x9b,
  Attachments: 0x1941a469,
  AttachedFile: 0x61a7,
  FileName: 0x466e,
  FileMimeType: 0x4660,
  FileData: 0x465c,
} as const;

export class MatroskaError extends Error {}

interface Head {
  id: number;
  /** Bytes of the element's ID and size. */
  headSize: number;
  /** null: unknown size (live-written Segment or Cluster). */
  size: number | null;
}

/** An element header at `p`, or null when the buffer ends before it does. */
function readHead(b: Uint8Array, p: number): Head | null {
  if (p >= b.length) return null;
  const first = b[p]!;
  const idLen = first >= 0x80 ? 1 : first >= 0x40 ? 2 : first >= 0x20 ? 3 : first >= 0x10 ? 4 : 0;
  if (!idLen) throw new MatroskaError("bad element id");
  if (p + idLen >= b.length) return null;
  let id = 0;
  for (let i = 0; i < idLen; i++) id = id * 256 + b[p + i]!;
  const s0 = b[p + idLen]!;
  let len = 1;
  while (len <= 8 && !(s0 & (0x80 >> (len - 1)))) len++;
  if (len > 8) throw new MatroskaError("bad element size");
  if (p + idLen + len > b.length) return null;
  let size = s0 & (0xff >> len);
  let allOnes = size === 0xff >> len;
  for (let i = 1; i < len; i++) {
    const v = b[p + idLen + i]!;
    size = size * 256 + v;
    if (v !== 0xff) allOnes = false;
  }
  return { id, headSize: idLen + len, size: allOnes ? null : size };
}

const uint = (b: Uint8Array, p: number, n: number) => {
  let v = 0;
  for (let i = 0; i < n; i++) v = v * 256 + b[p + i]!;
  return v;
};
const text = (b: Uint8Array, p: number, n: number) =>
  new TextDecoder().decode(b.subarray(p, p + n)).replace(/\0+$/, "");

/** The children of the element whose data is `b[start, end)`. */
function* children(
  b: Uint8Array,
  start: number,
  end: number,
): Generator<Head & { at: number; data: number }> {
  let p = start;
  while (p < end) {
    const h = readHead(b, p);
    if (!h || h.size === null) return;
    yield { ...h, at: p, data: p + h.headSize };
    p += h.headSize + h.size;
  }
}

const FIRST_READ = 64 * 1024;

/** Reads the file's index: tracks, timestamp scale, subtitle cues and where the attachments are. */
export async function readMatroskaIndex(read: RangeReader): Promise<MkvIndex> {
  const b = await read(0, FIRST_READ);
  const ebml = readHead(b, 0);
  if (!ebml || ebml.id !== ID.EBML || ebml.size === null) throw new MatroskaError("not a Matroska file");
  const segAt = ebml.headSize + ebml.size;
  const seg = readHead(b, segAt);
  if (!seg || seg.id !== ID.Segment) throw new MatroskaError("no Segment");
  const segmentData = segAt + seg.headSize;

  // Top-level elements in the first read, then what the SeekHead says is elsewhere.
  const found = new Map<number, number>();
  let p = segmentData;
  for (;;) {
    const h = readHead(b, p);
    if (!h || h.size === null || h.id === ID.Cluster) break;
    if (!found.has(h.id)) found.set(h.id, p);
    if (h.id === ID.SeekHead && p + h.headSize + h.size <= b.length)
      for (const seek of children(b, p + h.headSize, p + h.headSize + h.size)) {
        if (seek.id !== ID.Seek) continue;
        let sid = 0;
        let pos = -1;
        for (const c of children(b, seek.data, seek.data + seek.size!)) {
          if (c.id === ID.SeekID) sid = uint(b, c.data, c.size!);
          else if (c.id === ID.SeekPosition) pos = uint(b, c.data, c.size!);
        }
        if (sid && pos >= 0 && !found.has(sid)) found.set(sid, segmentData + pos);
      }
    p += h.headSize + h.size;
    if (p >= b.length) break;
  }

  /** One whole top-level element, from the first read when it is in it. */
  const element = async (
    at: number | undefined,
    id: number,
    limit: number,
  ): Promise<{ b: Uint8Array; start: number; end: number } | null> => {
    if (at === undefined) return null;
    let head = at + 12 <= b.length ? readHead(b, at) : null;
    let buf = b;
    let base = 0;
    if (!head) {
      buf = await read(at, at + 12);
      base = at;
      head = readHead(buf, 0);
    }
    if (!head || head.id !== id || head.size === null || head.size > limit) return null;
    const end = at + head.headSize + head.size;
    if (end > b.length || base) {
      buf = await read(at, end);
      return { b: buf, start: head.headSize, end: head.headSize + head.size };
    }
    return { b, start: at + head.headSize, end };
  };

  const info = await element(found.get(ID.Info), ID.Info, 1 << 20);
  let scale = 1e-3;
  if (info)
    for (const c of children(info.b, info.start, info.end))
      if (c.id === ID.TimestampScale) scale = uint(info.b, c.data, c.size!) / 1e9;

  const tracksEl = await element(found.get(ID.Tracks), ID.Tracks, 8 << 20);
  if (!tracksEl) throw new MatroskaError("no Tracks");
  const tracks = parseTracks(tracksEl.b, tracksEl.start, tracksEl.end);
  const subs = new Set(tracks.filter((t) => t.type === 17).map((t) => t.number));

  const cues: MkvCue[] = [];
  // Every cluster the cues name, by time: where to look for subtitle blocks when the cues don't name them (older muxers).
  const clusterAt = new Map<number, number>();
  const cuesEl = subs.size ? await element(found.get(ID.Cues), ID.Cues, 32 << 20) : null;
  if (cuesEl) {
    const cb = cuesEl.b;
    for (const point of children(cb, cuesEl.start, cuesEl.end)) {
      if (point.id !== ID.CuePoint) continue;
      let time = 0;
      const positions: Omit<MkvCue, "time">[] = [];
      for (const c of children(cb, point.data, point.data + point.size!)) {
        if (c.id === ID.CueTime) time = uint(cb, c.data, c.size!);
        else if (c.id === ID.CueTrackPositions) {
          const pos: Omit<MkvCue, "time"> = { track: 0, cluster: 0, relative: null, duration: null };
          for (const x of children(cb, c.data, c.data + c.size!)) {
            if (x.id === ID.CueTrack) pos.track = uint(cb, x.data, x.size!);
            else if (x.id === ID.CueClusterPosition) pos.cluster = segmentData + uint(cb, x.data, x.size!);
            else if (x.id === ID.CueRelativePosition) pos.relative = uint(cb, x.data, x.size!);
            else if (x.id === ID.CueDuration) pos.duration = uint(cb, x.data, x.size!) * scale;
          }
          if (subs.has(pos.track)) positions.push(pos);
          if (pos.cluster && !(clusterAt.get(pos.cluster)! <= time * scale))
            clusterAt.set(pos.cluster, time * scale);
        }
      }
      for (const pos of positions) cues.push({ time: time * scale, ...pos });
    }
    cues.sort((a, z) => a.time - z.time);
  }
  const clusters = [...clusterAt].map(([pos, time]) => ({ pos, time })).sort((a, z) => a.pos - z.pos);

  return { segmentData, scale, tracks, cues, clusters, attachmentsAt: found.get(ID.Attachments) ?? null };
}

function parseTracks(b: Uint8Array, start: number, end: number): MkvTrack[] {
  const out: MkvTrack[] = [];
  for (const entry of children(b, start, end)) {
    if (entry.id !== ID.TrackEntry) continue;
    const t: MkvTrack = {
      number: 0,
      type: 0,
      codecId: "",
      codecPrivate: null,
      language: "eng",
      name: null,
      isDefault: true,
      forced: false,
      compression: null,
    };
    let bcp47: string | null = null;
    for (const c of children(b, entry.data, entry.data + entry.size!)) {
      const n = c.size!;
      if (c.id === ID.TrackNumber) t.number = uint(b, c.data, n);
      else if (c.id === ID.TrackType) t.type = uint(b, c.data, n);
      else if (c.id === ID.CodecID) t.codecId = text(b, c.data, n);
      else if (c.id === ID.CodecPrivate) t.codecPrivate = b.slice(c.data, c.data + n);
      else if (c.id === ID.Language) t.language = text(b, c.data, n);
      else if (c.id === ID.LanguageBCP47) bcp47 = text(b, c.data, n);
      else if (c.id === ID.Name) t.name = text(b, c.data, n);
      else if (c.id === ID.FlagDefault) t.isDefault = uint(b, c.data, n) === 1;
      else if (c.id === ID.FlagForced) t.forced = uint(b, c.data, n) === 1;
      else if (c.id === ID.ContentEncodings)
        for (const enc of children(b, c.data, c.data + n))
          for (const e of children(b, enc.data, enc.data + enc.size!))
            if (e.id === ID.ContentCompression) {
              const comp = { algo: 0, settings: null as Uint8Array | null };
              for (const x of children(b, e.data, e.data + e.size!)) {
                if (x.id === ID.ContentCompAlgo) comp.algo = uint(b, x.data, x.size!);
                else if (x.id === ID.ContentCompSettings) comp.settings = b.slice(x.data, x.data + x.size!);
              }
              t.compression = comp;
            }
    }
    if (bcp47) t.language = bcp47;
    if (t.language === "und") t.language = null;
    out.push(t);
  }
  return out;
}

/** Undoes a track's content compression on one frame. */
export async function decompress(track: MkvTrack, data: Uint8Array): Promise<Uint8Array> {
  const c = track.compression;
  if (!c) return data;
  if (c.algo === 3) {
    const prefix = c.settings ?? new Uint8Array(0);
    const out = new Uint8Array(prefix.length + data.length);
    out.set(prefix);
    out.set(data, prefix.length);
    return out;
  }
  if (c.algo === 0) {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new MatroskaError(`compression ${c.algo}`);
}

/** Parses a SimpleBlock or Block's payload: track, relative timestamp, flags, then the frame (no lacing for subtitles). */
function parseBlock(
  b: Uint8Array,
  start: number,
  end: number,
): { track: number; rel: number; data: Uint8Array } {
  const s0 = b[start]!;
  let len = 1;
  while (len <= 8 && !(s0 & (0x80 >> (len - 1)))) len++;
  const track = uint(b, start, len) - (0x80 >> (len - 1)) * 256 ** (len - 1);
  const rawRel = (b[start + len]! << 8) | b[start + len + 1]!;
  const rel = rawRel >= 0x8000 ? rawRel - 0x10000 : rawRel;
  const flags = b[start + len + 2]!;
  if (flags & 0x06) throw new MatroskaError("laced subtitle block");
  return { track, rel, data: b.slice(start + len + 3, end) };
}

/**
 * The block a cue points at. With its place inside the cluster (most files) that is one read of the block; without
 * it, the cluster is read from its start until the block of that track at that time.
 */
export async function readCueBlock(
  read: RangeReader,
  index: MkvIndex,
  cue: MkvCue,
): Promise<MkvBlock | null> {
  if (cue.relative !== null) {
    // The cluster's own header is 12 bytes at most: its data starts there; the cue's position counts from it.
    const ch = readHead(await read(cue.cluster, cue.cluster + 12), 0);
    if (!ch || ch.id !== ID.Cluster) return null;
    const at = cue.cluster + ch.headSize + cue.relative;
    let buf = await read(at, at + 4096);
    const h = readHead(buf, 0);
    if (!h || h.size === null) return null;
    if (h.headSize + h.size > buf.length) buf = await read(at, at + h.headSize + h.size);
    return blockFrom(buf, h, cue, index.scale);
  }
  // No relative position: walk the cluster (its blocks before this one are read too).
  let buf = await read(cue.cluster, cue.cluster + 256 * 1024);
  const ch = readHead(buf, 0);
  if (!ch || ch.id !== ID.Cluster) return null;
  let p = ch.headSize;
  let clusterTime = 0;
  const end = ch.size === null ? Number.POSITIVE_INFINITY : ch.headSize + ch.size;
  while (p < end) {
    if (p + 12 > buf.length) {
      const more = await read(cue.cluster + buf.length, cue.cluster + buf.length + 1024 * 1024);
      if (!more.length) return null;
      const grown = new Uint8Array(buf.length + more.length);
      grown.set(buf);
      grown.set(more, buf.length);
      buf = grown;
    }
    const h = readHead(buf, p);
    if (!h || h.size === null) return null;
    if (h.id === ID.Cluster) return null;
    if (h.id === ID.Timestamp) {
      if (p + h.headSize + h.size > buf.length) return null;
      clusterTime = uint(buf, p + h.headSize, h.size);
    } else if (h.id === ID.SimpleBlock || h.id === ID.BlockGroup) {
      if (p + h.headSize + h.size > buf.length) {
        const more = await read(cue.cluster + buf.length, cue.cluster + p + h.headSize + h.size);
        const grown = new Uint8Array(buf.length + more.length);
        grown.set(buf);
        grown.set(more, buf.length);
        buf = grown;
      }
      const block = blockFrom(buf.subarray(p), h, cue, index.scale, clusterTime * index.scale);
      if (block && block.track === cue.track && Math.abs(block.time - cue.time) < 0.002) return block;
    }
    p += h.headSize + h.size;
  }
  return null;
}

function blockFrom(
  b: Uint8Array,
  h: Head,
  cue: MkvCue,
  scale: number,
  clusterTime?: number,
): MkvBlock | null {
  const start = h.headSize;
  const end = h.headSize + (h.size ?? 0);
  const time = (rel: number) => (clusterTime !== undefined ? clusterTime + rel * scale : cue.time);
  if (h.id === ID.SimpleBlock) {
    const k = parseBlock(b, start, end);
    return { track: k.track, time: time(k.rel), duration: cue.duration, data: k.data };
  }
  if (h.id !== ID.BlockGroup) return null;
  let block: ReturnType<typeof parseBlock> | null = null;
  let duration: number | null = cue.duration;
  for (const c of children(b, start, end)) {
    if (c.id === ID.Block) block = parseBlock(b, c.data, c.data + c.size!);
    else if (c.id === ID.BlockDuration) duration = uint(b, c.data, c.size!) * scale;
  }
  if (!block) return null;
  return { track: block.track, time: time(block.rel), duration, data: block.data };
}

/** Clusters read for subtitles, beyond this they are skipped (a 4K remux's cluster may be tens of MB). */
const MAX_CLUSTER = 24 << 20;

/**
 * A walk over clusters reads pieces of 512 KB, doubling up to 4 MB while it goes on without a gap (few requests where
 * frames are small); it jumps over a gap of 1 MB or more — a frame that big costs more to download than a new request.
 */
export const WALK_PIECE = 512 * 1024;
const WALK_PIECE_MAX = 4 << 20;
const WALK_SKIP = 1 << 20;

/**
 * Every subtitle block of a stretch of clusters (from a cluster the cues name to the next one), for a file whose cues
 * don't name subtitle blocks (older mkvmerge, HDCLUB releases; PLR-18). The clusters are walked element by element in
 * pieces (`WALK_PIECE`), not read whole in one request: a video frame that runs a megabyte or more past the piece in hand
 * is stepped over by its size and its bytes are never fetched — the next piece starts at the element after it — so a
 * big frame costs one small read instead of being downloaded a second time. Each block is handed to `onBlock` as it is found, so
 * the first lines after a seek come with the first pieces, not after the whole stretch. `signal` stops the walk between
 * pieces (an AbortError).
 */
export async function readClusterSubtitles(
  read: RangeReader,
  index: MkvIndex,
  cluster: { pos: number; time: number },
  next: number | null,
  opts: { onBlock?: (block: MkvBlock) => unknown; signal?: AbortSignal } = {},
): Promise<MkvBlock[]> {
  const subs = new Set(index.tracks.filter((t) => t.type === 17).map((t) => t.number));
  const end = Math.min(next ?? cluster.pos + MAX_CLUSTER, cluster.pos + MAX_CLUSTER);
  const out: MkvBlock[] = [];
  // The bytes in hand: the file's [at, at + buf.length). The walk only goes forward.
  let at = cluster.pos;
  let buf: Uint8Array = new Uint8Array(0);
  let piece = WALK_PIECE;
  /** Makes the file's [p, p + n) available: read on from where the bytes in hand stop, or from `p` over a big gap. */
  const have = async (p: number, n: number): Promise<boolean> => {
    if (p >= at && p + n <= at + buf.length) return true;
    if (opts.signal?.aborted) throw new DOMException("Subtitle read stopped", "AbortError");
    const held = at + buf.length;
    const onward = p - held < WALK_SKIP;
    const from = onward ? held : p;
    piece = onward && buf.length ? Math.min(piece * 2, WALK_PIECE_MAX) : WALK_PIECE;
    const want = Math.min(end, Math.max(p + n, from + piece));
    if (want <= p) return false;
    const more = await read(from, want);
    if (onward) {
      const kept = p < held ? buf.subarray(p - at) : new Uint8Array(0);
      const fresh = more.subarray(Math.max(0, p - held));
      buf = new Uint8Array(kept.length + fresh.length);
      buf.set(kept);
      buf.set(fresh, kept.length);
    } else buf = more;
    at = p;
    return p + n <= at + buf.length;
  };
  /** The track of the block element at `p` (SimpleBlock, or a BlockGroup's Block), reading only its first bytes. */
  const trackAt = async (p: number, h: Head): Promise<number | null> => {
    let s = p + h.headSize;
    if (h.id === ID.BlockGroup) {
      if (!(await have(s, Math.min(h.size!, 12)))) return null;
      const c = readHead(buf, s - at);
      if (!c || c.size === null) return null;
      if (c.id !== ID.Block) {
        // Every muxer writes the Block first; a group that doesn't is read whole.
        if (!(await have(p, h.headSize + h.size!))) return null;
        const b = [...children(buf, s - at, s - at + h.size!)].find((x) => x.id === ID.Block);
        return b ? trackOf(buf, b.data) : null;
      }
      s += c.headSize;
    }
    if (!(await have(s, 8))) return null;
    return trackOf(buf, s - at);
  };

  // The cues may name only every few clusters: all of them up to the next named one are walked.
  for (let q = cluster.pos; q < end && (await have(q, Math.min(12, end - q))); ) {
    const ch = readHead(buf, q - at);
    if (!ch || ch.id !== ID.Cluster) break;
    const cEnd = Math.min(end, ch.size === null ? end : q + ch.headSize + ch.size);
    let clusterTime = cluster.time / index.scale;
    for (let p = q + ch.headSize; p < cEnd && (await have(p, Math.min(12, cEnd - p))); ) {
      const h = readHead(buf, p - at);
      if (!h || h.size === null || p + h.headSize + h.size > cEnd) break;
      const d = p + h.headSize;
      if (h.id === ID.Timestamp) {
        if (!(await have(d, h.size))) break;
        clusterTime = uint(buf, d - at, h.size);
      } else if (h.id === ID.SimpleBlock || h.id === ID.BlockGroup) {
        // The block's track first: video and audio blocks are stepped over without being read.
        const track = await trackAt(p, h);
        if (track !== null && subs.has(track) && (await have(p, h.headSize + h.size))) {
          const cue: MkvCue = { time: 0, track: 0, cluster: q, relative: null, duration: null };
          const block = blockFrom(buf.subarray(p - at), h, cue, index.scale, clusterTime * index.scale);
          if (block) {
            out.push(block);
            await opts.onBlock?.(block);
          }
        }
      }
      p = d + h.size;
    }
    if (ch.size === null) break;
    q += ch.headSize + ch.size;
  }
  return out;
}

/** The track number at the start of a block. */
function trackOf(b: Uint8Array, start: number): number {
  const s0 = b[start]!;
  let len = 1;
  while (len <= 8 && !(s0 & (0x80 >> (len - 1)))) len++;
  return uint(b, start, len) - (0x80 >> (len - 1)) * 256 ** (len - 1);
}

/**
 * The attached files' names, types and places (not their data): read only when an ASS track is shown — each file's
 * header is a read of its own (a release may attach two dozen fonts).
 */
export async function readAttachments(read: RangeReader, index: MkvIndex): Promise<MkvAttachment[]> {
  const attachments: MkvAttachment[] = [];
  const attAt = index.attachmentsAt;
  if (attAt === null) return attachments;
  const head = readHead(await read(attAt, attAt + 12), 0);
  if (head?.id !== ID.Attachments || head.size === null) return attachments;
  const end = attAt + head.headSize + head.size;
  let q = attAt + head.headSize;
  while (q < end) {
    const fileHead = readHead(await read(q, q + 12), 0);
    if (!fileHead || fileHead.size === null) break;
    // Name, type and the data's own header come first in every muxer's output; read them, not the data.
    const part = await read(
      q + fileHead.headSize,
      Math.min(q + fileHead.headSize + fileHead.size, q + fileHead.headSize + 1024),
    );
    const file: MkvAttachment = { name: "", mime: "", offset: 0, size: 0 };
    let r = 0;
    while (r < part.length) {
      const h = readHead(part, r);
      if (!h || h.size === null) break;
      if (h.id === ID.FileName) file.name = text(part, r + h.headSize, h.size);
      else if (h.id === ID.FileMimeType) file.mime = text(part, r + h.headSize, h.size);
      else if (h.id === ID.FileData) {
        file.offset = q + fileHead.headSize + r + h.headSize;
        file.size = h.size;
        break;
      }
      r += h.headSize + h.size;
    }
    if (file.size) attachments.push(file);
    q += fileHead.headSize + fileHead.size;
  }
  return attachments;
}

/** Reads an attachment's data (a font for ASS subtitles). */
export async function readAttachment(read: RangeReader, a: MkvAttachment): Promise<Uint8Array> {
  return read(a.offset, a.offset + a.size);
}
