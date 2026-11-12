import { type HttpSource, httpReader } from "./http-range";
import { children, MatroskaError, type RangeReader, readHead, text, uint } from "./subs/matroska";
import type { FileProbe, ProbeChapter } from "./torrserver";

/*
 * What TorrServer's ffprobe says about a Matroska file (`/ffp`), read from the file's own start instead: its tracks in
 * the file's order — codec, language, name, default flag, picture size and bit depth, Dolby Vision profile, channels —
 * its duration and its chapters. All of them are in the elements before the first cluster: the first 64 KB, or where
 * the SeekHead points. ffprobe reads megabytes from the start and the end of the file and takes 2–15 s on a torrent
 * TorrServer has to wake; this is a range read or two. Everything is named in ffprobe's words, so a playback is decided
 * on it the same way; a file with anything it can't name so (a codec, a kind of track) gives null, and ffprobe's answer
 * is waited for.
 */

const ID = {
  EBML: 0x1a45dfa3,
  Segment: 0x18538067,
  SeekHead: 0x114d9b74,
  Seek: 0x4dbb,
  SeekID: 0x53ab,
  SeekPosition: 0x53ac,
  Info: 0x1549a966,
  TimestampScale: 0x2ad7b1,
  Duration: 0x4489,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  TrackNumber: 0xd7,
  TrackType: 0x83,
  FlagEnabled: 0xb9,
  FlagDefault: 0x88,
  CodecID: 0x86,
  CodecPrivate: 0x63a2,
  Language: 0x22b59c,
  Name: 0x536e,
  Video: 0xe0,
  PixelWidth: 0xb0,
  PixelHeight: 0xba,
  Colour: 0x55b0,
  BitsPerChannel: 0x55b2,
  Audio: 0xe1,
  Channels: 0x9f,
  BitDepth: 0x6264,
  BlockAdditionMapping: 0x41e4,
  BlockAddIDType: 0x41e7,
  BlockAddIDExtraData: 0x41ed,
  Chapters: 0x1043a770,
  EditionEntry: 0x45b9,
  ChapterAtom: 0xb6,
  ChapterUID: 0x73c4,
  ChapterTimeStart: 0x91,
  ChapterTimeEnd: 0x92,
  ChapterDisplay: 0x80,
  ChapString: 0x85,
  Cluster: 0x1f43b675,
} as const;

/** ffprobe's codec names for Matroska's codec IDs. */
const VIDEO: Record<string, string> = {
  "V_MPEG4/ISO/AVC": "h264",
  "V_MPEGH/ISO/HEVC": "hevc",
  V_AV1: "av1",
  V_VP9: "vp9",
  V_VP8: "vp8",
  "V_MPEG4/ISO/ASP": "mpeg4",
  "V_MPEG4/ISO/SP": "mpeg4",
  "V_MPEG4/ISO/AP": "mpeg4",
  V_MPEG2: "mpeg2video",
  V_MPEG1: "mpeg1video",
};
/** Video in a Video for Windows header (`V_MS/VFW/FOURCC`), by its FourCC: VC-1 Blu-ray rips, old Xvid / DivX. */
const FOURCC: Record<string, string> = {
  WVC1: "vc1",
  WMV3: "wmv3",
  XVID: "mpeg4",
  DIVX: "mpeg4",
  DX50: "mpeg4",
  FMP4: "mpeg4",
  MP4V: "mpeg4",
  DIV3: "msmpeg4v3",
  H264: "h264",
  AVC1: "h264",
  X264: "h264",
};
const AUDIO: Record<string, string> = {
  A_AC3: "ac3",
  "A_AC3/BSID9": "ac3",
  "A_AC3/BSID10": "ac3",
  A_EAC3: "eac3",
  A_DTS: "dts",
  "A_DTS/EXPRESS": "dts",
  "A_DTS/LOSSLESS": "dts",
  A_TRUEHD: "truehd",
  A_MLP: "mlp",
  A_FLAC: "flac",
  A_OPUS: "opus",
  A_VORBIS: "vorbis",
  "A_MPEG/L3": "mp3",
  "A_MPEG/L2": "mp2",
  "A_MPEG/L1": "mp1",
  A_ALAC: "alac",
};
/** Audio in a WAVEFORMATEX header (`A_MS/ACM`), by its format tag. */
const WAVE_FORMAT = new Map([
  [0x0050, "mp2"],
  [0x0055, "mp3"],
  [0x00ff, "aac"],
  [0x1610, "aac"],
  [0x2000, "ac3"],
  [0x2001, "dts"],
]);
const SUBTITLE: Record<string, string> = {
  "S_TEXT/UTF8": "subrip",
  "S_TEXT/ASCII": "text",
  "S_TEXT/SSA": "ass",
  "S_TEXT/ASS": "ass",
  S_SSA: "ass",
  S_ASS: "ass",
  "S_TEXT/WEBVTT": "webvtt",
  "S_HDMV/PGS": "hdmv_pgs_subtitle",
  S_VOBSUB: "dvd_subtitle",
  S_DVBSUB: "dvb_subtitle",
  "S_HDMV/TEXTST": "hdmv_text_subtitle",
};
/** Dolby Vision configuration records in a track's block addition mapping: "dvcC", "dvvC", "dvwC". */
const DOVI = new Set([0x64766343, 0x64767643, 0x64767743]);

type Stream = NonNullable<FileProbe["streams"]>[number];
/** A track this reader can't name as ffprobe does: the probe is ffprobe's to give. */
class Unnamed extends Error {}

const FIRST_READ = 64 * 1024;

/** The probe of a file on a media server, read by ranges with its sign-in. */
export const serverFileProbe = (src: HttpSource, size: number, signal: AbortSignal) => matroskaProbe(httpReader(src, signal), size);

/** The file's probe, as ffprobe would give it, or null when only ffprobe can tell. `size`: the file's length. */
export async function matroskaProbe(read: RangeReader, size: number): Promise<FileProbe | null> {
  try {
    return await probe(read, size);
  } catch (e) {
    // A file it can't read through (broken or cut elements) is ffprobe's too; a failed read is the caller's.
    if (e instanceof Unnamed || e instanceof MatroskaError || e instanceof RangeError) return null;
    throw e;
  }
}

async function probe(read: RangeReader, size: number): Promise<FileProbe | null> {
  const b = await read(0, FIRST_READ);
  const ebml = readHead(b, 0);
  if (!ebml || ebml.id !== ID.EBML || ebml.size === null) return null;
  const segAt = ebml.headSize + ebml.size;
  const seg = readHead(b, segAt);
  if (!seg || seg.id !== ID.Segment) return null;
  const segmentData = segAt + seg.headSize;

  // The top-level elements in the first read, then where the SeekHead says the others are.
  const at = new Map<number, number>();
  let clusterReached = false;
  for (let p = segmentData; ; ) {
    const h = readHead(b, p);
    if (!h) break;
    if (h.id === ID.Cluster) {
      clusterReached = true;
      break;
    }
    if (h.size === null) break;
    if (!at.has(h.id)) at.set(h.id, p);
    if (h.id === ID.SeekHead && p + h.headSize + h.size <= b.length)
      for (const seek of children(b, p + h.headSize, p + h.headSize + h.size)) {
        if (seek.id !== ID.Seek) continue;
        let id = 0;
        let pos = -1;
        for (const c of children(b, seek.data, seek.data + seek.size!)) {
          if (c.id === ID.SeekID) id = uint(b, c.data, c.size!);
          else if (c.id === ID.SeekPosition) pos = uint(b, c.data, c.size!);
        }
        if (id && pos >= 0 && !at.has(id)) at.set(id, segmentData + pos);
      }
    p += h.headSize + h.size;
  }

  /** One whole top-level element: from the first read when it is in it, else read where it is. */
  const element = async (id: number, limit: number): Promise<{ b: Uint8Array; start: number; end: number } | null> => {
    const pos = at.get(id);
    if (pos === undefined) return null;
    let head = pos + 12 <= b.length ? readHead(b, pos) : null;
    if (!head) head = readHead(await read(pos, pos + 12), 0);
    if (!head || head.id !== id || head.size === null || head.size > limit) return null;
    const end = pos + head.headSize + head.size;
    if (end <= b.length) return { b, start: pos + head.headSize, end };
    return { b: await read(pos, end), start: head.headSize, end: head.headSize + head.size };
  };
  const [info, tracksEl, chaptersEl] = await Promise.all([element(ID.Info, 1 << 20), element(ID.Tracks, 8 << 20), element(ID.Chapters, 4 << 20)]);
  if (!tracksEl) return null;

  let scale = 1_000_000;
  let duration: number | null = null;
  if (info)
    for (const c of children(info.b, info.start, info.end)) {
      if (c.id === ID.TimestampScale) scale = uint(info.b, c.data, c.size!);
      else if (c.id === ID.Duration) duration = float(info.b, c.data, c.size!);
    }
  const seconds = duration !== null && duration > 0 ? (duration * scale) / 1e9 : null;

  const streams = tracks(tracksEl.b, tracksEl.start, tracksEl.end);
  if (!streams.length) return null;
  // Chapters that may lie past what was read and that no SeekHead names stay unknown, as ffprobe's alone can tell.
  const chapters = chaptersEl ? chapterList(chaptersEl.b, chaptersEl.start, chaptersEl.end, seconds) : clusterReached ? [] : undefined;
  return {
    format: {
      format_name: "matroska,webm",
      duration: seconds === null ? undefined : String(seconds),
      bit_rate: seconds && size > 0 ? String(Math.floor((size * 8) / seconds)) : undefined,
    },
    streams,
    chapters,
  };
}

const float = (b: Uint8Array, p: number, n: number) => {
  const v = new DataView(b.buffer, b.byteOffset + p, n);
  return n === 4 ? v.getFloat32(0) : n === 8 ? v.getFloat64(0) : 0;
};

/** The tracks as ffprobe's streams, numbered in the file's order (ffprobe's stream index). */
function tracks(b: Uint8Array, start: number, end: number): Stream[] {
  const out: Stream[] = [];
  for (const entry of children(b, start, end)) {
    if (entry.id !== ID.TrackEntry) continue;
    let number = 0;
    let type = 0;
    let enabled = true;
    let isDefault = true;
    let codecId = "";
    let priv: Uint8Array | null = null;
    let language: string | null = null;
    let name: string | null = null;
    let width: number | undefined;
    let height: number | undefined;
    let bitsPerChannel = 0;
    let channels = 1;
    let pcmDepth = 0;
    let dvProfile: number | null = null;
    for (const c of children(b, entry.data, entry.data + entry.size!)) {
      const n = c.size!;
      if (c.id === ID.TrackNumber) number = uint(b, c.data, n);
      else if (c.id === ID.TrackType) type = uint(b, c.data, n);
      else if (c.id === ID.FlagEnabled) enabled = uint(b, c.data, n) !== 0;
      else if (c.id === ID.FlagDefault) isDefault = uint(b, c.data, n) !== 0;
      else if (c.id === ID.CodecID) codecId = text(b, c.data, n);
      else if (c.id === ID.CodecPrivate) priv = b.subarray(c.data, c.data + n);
      else if (c.id === ID.Language) language = text(b, c.data, n);
      else if (c.id === ID.Name) name = text(b, c.data, n);
      else if (c.id === ID.Video)
        for (const v of children(b, c.data, c.data + n)) {
          if (v.id === ID.PixelWidth) width = uint(b, v.data, v.size!);
          else if (v.id === ID.PixelHeight) height = uint(b, v.data, v.size!);
          else if (v.id === ID.Colour)
            for (const x of children(b, v.data, v.data + v.size!)) if (x.id === ID.BitsPerChannel) bitsPerChannel = uint(b, x.data, x.size!);
        }
      else if (c.id === ID.Audio)
        for (const a of children(b, c.data, c.data + n)) {
          if (a.id === ID.Channels) channels = uint(b, a.data, a.size!);
          else if (a.id === ID.BitDepth) pcmDepth = uint(b, a.data, a.size!);
        }
      else if (c.id === ID.BlockAdditionMapping) {
        let kind = 0;
        let extra: Uint8Array | null = null;
        for (const m of children(b, c.data, c.data + n)) {
          if (m.id === ID.BlockAddIDType) kind = uint(b, m.data, m.size!);
          else if (m.id === ID.BlockAddIDExtraData) extra = b.subarray(m.data, m.data + m.size!);
        }
        if (DOVI.has(kind) && extra && extra.length >= 4) dvProfile = extra[2]! >> 1;
      }
    }
    // What ffprobe would leave out or number otherwise: only ffprobe's answer keeps its stream numbers.
    if (!number || !codecId || !enabled || (type !== 1 && type !== 2 && type !== 17)) throw new Unnamed();
    // Matroska's language is English unless the track says otherwise — mkvmerge leaves "eng" out and writes only its
    // BCP 47 form ("en") — and ffprobe reads it so; it gives no language for "und".
    const lang = language ?? "eng";
    const tags = { ...(lang && lang !== "und" ? { language: lang } : {}), ...(name ? { title: name } : {}) };
    const s: Stream = { index: out.length, codec_type: "", codec_name: "", tags: Object.keys(tags).length ? tags : undefined, disposition: { default: isDefault ? 1 : 0 } };
    if (type === 1) {
      const codec = codecId === "V_MS/VFW/FOURCC" ? (priv && priv.length >= 20 ? FOURCC[String.fromCharCode(...priv.subarray(16, 20)).toUpperCase()] : undefined) : VIDEO[codecId];
      if (!codec || !width || !height) throw new Unnamed();
      const depth = bitDepth(codec, priv) ?? (bitsPerChannel || 8);
      Object.assign(s, { codec_type: "video", codec_name: codec, width, height, bits_per_raw_sample: String(depth) });
      if (dvProfile !== null) s.side_data_list = [{ side_data_type: "DOVI configuration record", dv_profile: dvProfile }];
    } else if (type === 2) {
      const codec = audioCodec(codecId, priv, pcmDepth);
      if (!codec) throw new Unnamed();
      Object.assign(s, { codec_type: "audio", codec_name: codec, channels });
    } else Object.assign(s, { codec_type: "subtitle", codec_name: SUBTITLE[codecId] ?? "unknown" });
    out.push(s);
  }
  return out;
}

function audioCodec(codecId: string, priv: Uint8Array | null, depth: number): string | undefined {
  if (AUDIO[codecId]) return AUDIO[codecId];
  if (codecId === "A_AAC" || codecId.startsWith("A_AAC/")) return "aac";
  if (codecId === "A_PCM/INT/LIT") return depth === 8 ? "pcm_u8" : depth ? `pcm_s${depth}le` : undefined;
  if (codecId === "A_PCM/INT/BIG") return depth === 8 ? "pcm_s8" : depth ? `pcm_s${depth}be` : undefined;
  if (codecId === "A_PCM/FLOAT/IEEE") return depth === 64 ? "pcm_f64le" : "pcm_f32le";
  if (codecId === "A_MS/ACM" && priv && priv.length >= 16) {
    const tag = priv[0]! | (priv[1]! << 8);
    const bits = priv[14]! | (priv[15]! << 8);
    if (tag === 0x0001) return bits === 8 ? "pcm_u8" : `pcm_s${bits}le`;
    if (tag === 0x0003) return bits === 64 ? "pcm_f64le" : "pcm_f32le";
    return WAVE_FORMAT.get(tag);
  }
  return undefined;
}

/** The picture's bit depth from the codec's own record: H.264's SPS, HEVC's and AV1's configuration; null if it doesn't say. */
export function bitDepth(codec: string, priv: Uint8Array | null): number | null {
  if (!priv) return null;
  if (codec === "hevc") return priv.length >= 23 && priv[0] === 1 ? (priv[17]! & 7) + 8 : null;
  if (codec === "av1") return priv.length >= 4 ? (priv[2]! & 0x40 ? (priv[2]! & 0x20 ? 12 : 10) : 8) : null;
  if (codec === "h264") return h264Depth(priv);
  return null;
}

/** The first SPS of an avcC record: bit_depth_luma_minus8 + 8, read where High profiles have it. */
function h264Depth(avcc: Uint8Array): number | null {
  if (avcc.length < 8 || avcc[0] !== 1 || !(avcc[5]! & 31)) return null;
  const length = (avcc[6]! << 8) | avcc[7]!;
  // Emulation prevention: 00 00 03 in the unit stands for 00 00.
  const sps: number[] = [];
  for (let i = 8; i < Math.min(avcc.length, 8 + length); i++) {
    if (avcc[i] === 3 && sps.length >= 2 && sps[sps.length - 1] === 0 && sps[sps.length - 2] === 0) continue;
    sps.push(avcc[i]!);
  }
  // NAL header, profile_idc, constraint flags, level_idc, then the exp-Golomb fields.
  const profile = sps[1] ?? 0;
  if (![100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135].includes(profile)) return 8;
  let bit = 32;
  const u1 = () => {
    const v = ((sps[bit >> 3] ?? 0) >> (7 - (bit & 7))) & 1;
    bit++;
    return v;
  };
  const ue = () => {
    let zeros = 0;
    while (!u1()) if (++zeros > 31) return -1;
    let v = 0;
    for (let i = 0; i < zeros; i++) v = v * 2 + u1();
    return v + 2 ** zeros - 1;
  };
  ue(); // seq_parameter_set_id
  const chroma = ue();
  if (chroma === 3) u1(); // separate_colour_plane_flag
  const minus8 = ue();
  return minus8 >= 0 && minus8 <= 8 ? minus8 + 8 : null;
}

/**
 * Chapters as ffprobe lists them: each edition's top-level chapters with a UID, each starting after the one before; a
 * chapter without an end ends where the next begins (the last one, with the file).
 */
function chapterList(b: Uint8Array, start: number, end: number, duration: number | null): ProbeChapter[] {
  const atoms: { start: number; end: number | null; title: string | null }[] = [];
  let last = -1;
  for (const edition of children(b, start, end)) {
    if (edition.id !== ID.EditionEntry) continue;
    for (const atom of children(b, edition.data, edition.data + edition.size!)) {
      if (atom.id !== ID.ChapterAtom) continue;
      let uid = 0;
      let from: number | null = null;
      let to: number | null = null;
      let title: string | null = null;
      for (const c of children(b, atom.data, atom.data + atom.size!)) {
        if (c.id === ID.ChapterUID) uid = uint(b, c.data, c.size!);
        else if (c.id === ID.ChapterTimeStart) from = uint(b, c.data, c.size!) / 1e9;
        else if (c.id === ID.ChapterTimeEnd) to = uint(b, c.data, c.size!) / 1e9;
        else if (c.id === ID.ChapterDisplay && title === null)
          for (const d of children(b, c.data, c.data + c.size!)) if (d.id === ID.ChapString) title = text(b, d.data, d.size!);
      }
      if (!uid || from === null || from <= last) continue;
      last = from;
      atoms.push({ start: from, end: to, title });
    }
  }
  return atoms.map((a, i) => ({
    start_time: String(a.start),
    end_time: String(a.end ?? atoms[i + 1]?.start ?? duration ?? a.start),
    tags: a.title ? { title: a.title } : undefined,
  }));
}
