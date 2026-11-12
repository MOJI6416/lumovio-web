import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bitDepth, matroskaProbe } from "../src/lib/media/matroska-probe";
import { chapterSegments } from "../src/lib/media/torrserver";

// A Matroska file's probe from its first kilobytes, in ffprobe's words. The player-check clips are real files (the
// expected values are what ffprobe says of them); the rest are built here, element by element.

const fixture = (name: string) => readFileSync(new URL(`../public/player-check/${name}`, import.meta.url));
const reader = (b: Uint8Array) => {
  const reads: [number, number][] = [];
  const read = async (s: number, e: number) => {
    reads.push([s, e]);
    return new Uint8Array(b.subarray(s, e));
  };
  return { read, reads };
};

const concat = (parts: (Uint8Array | number[])[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const be = (n: number, bytes: number) => Array.from({ length: bytes }, (_, i) => Math.floor(n / 256 ** (bytes - 1 - i)) % 256);
const idBytes = (id: number) => be(id, id > 0xffffff ? 4 : id > 0xffff ? 3 : id > 0xff ? 2 : 1);
/** An element with an 8-byte size. */
const el = (id: number, ...body: (Uint8Array | number[])[]) => {
  const data = concat(body);
  return concat([idBytes(id), [0x01, ...be(data.length, 7)], data]);
};
const u = (id: number, n: number, bytes = 4) => el(id, be(n, bytes));
const str = (id: number, s: string) => el(id, new TextEncoder().encode(s));
const f64 = (id: number, x: number) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, x);
  return el(id, b);
};
const M = {
  EBML: 0x1a45dfa3,
  DocType: 0x4282,
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
  LanguageBCP47: 0x22b59d,
  Name: 0x536e,
  Video: 0xe0,
  PixelWidth: 0xb0,
  PixelHeight: 0xba,
  Audio: 0xe1,
  Channels: 0x9f,
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
  Void: 0xec,
  Cluster: 0x1f43b675,
};
const video = (codec: string, ...more: Uint8Array[]) =>
  el(M.TrackEntry, u(M.TrackNumber, 1, 1), u(M.TrackType, 1, 1), str(M.CodecID, codec), el(M.Video, u(M.PixelWidth, 1920, 2), u(M.PixelHeight, 1080, 2)), ...more);
const audio = (n: number, codec: string, ...more: Uint8Array[]) => el(M.TrackEntry, u(M.TrackNumber, n, 1), u(M.TrackType, 2, 1), str(M.CodecID, codec), el(M.Audio, u(M.Channels, 6, 1)), ...more);
const info = (seconds: number | null) => el(M.Info, u(M.TimestampScale, 1_000_000), ...(seconds === null ? [] : [f64(M.Duration, seconds * 1000)]));
/** A Matroska file: its top-level elements, then a cluster. */
const mkv = (...top: Uint8Array[]) => concat([el(M.EBML, str(M.DocType, "matroska")), el(M.Segment, ...top, el(M.Cluster, u(0xe7, 0, 1)))]);

describe("a Matroska file's probe from its head", () => {
  it("names the tracks as ffprobe does, in one read of the file's start", async () => {
    const b = fixture("mkv-multi.mkv");
    const { read, reads } = reader(b);
    const p = await matroskaProbe(read, b.length);
    expect(reads).toEqual([[0, 65536]]);
    expect(p?.format).toEqual({ format_name: "matroska,webm", duration: "4.021", bit_rate: "489394" });
    expect(p?.streams?.map((s) => [s.index, s.codec_type, s.codec_name, s.tags?.language ?? null, s.tags?.title ?? null, s.disposition?.default])).toEqual([
      [0, "video", "h264", null, null, 0],
      [1, "audio", "ac3", "rus", "Дубляж", 1],
      [2, "audio", "aac", "ukr", null, 0],
      [3, "audio", "eac3", "eng", null, 0],
    ]);
    expect(p?.chapters).toEqual([]);
  });

  it("reads the picture's bit depth from the codec's record: HEVC Main 10, H.264 High 10", async () => {
    const b = fixture("mkv-hevc10-aac.mkv");
    const p = await matroskaProbe(reader(b).read, b.length);
    expect(p?.streams?.[0]).toMatchObject({ codec_name: "hevc", width: 426, height: 240, bits_per_raw_sample: "10" });
    // avcC with one SPS: High 10 (110), seq_parameter_set_id 0, chroma_format_idc 1, bit_depth_luma_minus8 2.
    expect(bitDepth("h264", new Uint8Array([1, 0x6e, 0, 0x28, 0xff, 0xe1, 0, 5, 0x67, 0x6e, 0, 0x28, 0xa6]))).toBe(10);
    expect(bitDepth("h264", new Uint8Array([1, 0x64, 0, 0x28, 0xff, 0xe1, 0, 5, 0x67, 0x64, 0, 0x28, 0xac]))).toBe(8);
  });

  it("names subtitle tracks, which the player reads itself", async () => {
    const b = fixture("mkv-subs.mkv");
    const p = await matroskaProbe(reader(b).read, b.length);
    expect(p?.streams?.filter((s) => s.codec_type === "subtitle").map((s) => s.codec_name)).toEqual(["subrip", "subrip", "ass", "hdmv_pgs_subtitle", "dvd_subtitle"]);
  });

  it("takes a track without a language for English, as Matroska and ffprobe do, and gives none for und", async () => {
    const b = mkv(info(100), el(M.Tracks, video("V_MPEG4/ISO/AVC"), audio(2, "A_EAC3", str(M.LanguageBCP47, "en")), audio(3, "A_AC3", str(M.Language, "und"), str(M.Name, "Commentary"))));
    const p = await matroskaProbe(reader(b).read, b.length);
    expect(p?.streams?.[1]?.tags).toEqual({ language: "eng" });
    expect(p?.streams?.[2]?.tags).toEqual({ title: "Commentary" });
    // FlagDefault is 1 unless the track says otherwise.
    expect(p?.streams?.map((s) => s.disposition?.default)).toEqual([1, 1, 1]);
  });

  it("gives Dolby Vision's profile from the track's block addition mapping", async () => {
    const dovi = el(M.BlockAdditionMapping, u(M.BlockAddIDType, 0x64766343), el(M.BlockAddIDExtraData, [1, 0, (5 << 1) | 0, 0x10, 0, 0, 0, 0]));
    const b = mkv(info(100), el(M.Tracks, video("V_MPEGH/ISO/HEVC", dovi), audio(2, "A_EAC3")));
    const p = await matroskaProbe(reader(b).read, b.length);
    expect(p?.streams?.[0]?.side_data_list).toEqual([{ side_data_type: "DOVI configuration record", dv_profile: 5 }]);
  });

  it("lists chapters as ffprobe does: one without an end runs to the next, the last to the file's end", async () => {
    const atom = (uid: number, start: number, end: number | null, title: string) =>
      el(M.ChapterAtom, u(M.ChapterUID, uid), u(M.ChapterTimeStart, start * 1e9, 8), ...(end === null ? [] : [u(M.ChapterTimeEnd, end * 1e9, 8)]), el(M.ChapterDisplay, str(M.ChapString, title)));
    const chapters = el(M.Chapters, el(M.EditionEntry, atom(1, 0, null, "Intro"), atom(2, 90, 1990, "Episode"), atom(0, 50, null, "No UID"), atom(3, 2000, null, "Credits")));
    const b = mkv(info(2100), el(M.Tracks, video("V_MPEG4/ISO/AVC"), audio(2, "A_AAC")), chapters);
    const p = await matroskaProbe(reader(b).read, b.length);
    expect(p?.chapters).toEqual([
      { start_time: "0", end_time: "90", tags: { title: "Intro" } },
      { start_time: "90", end_time: "1990", tags: { title: "Episode" } },
      { start_time: "2000", end_time: "2100", tags: { title: "Credits" } },
    ]);
    expect(chapterSegments(p?.chapters)).toEqual([
      { kind: "intro", start: 0, end: 90 },
      { kind: "outro", start: 2000, end: 2100 },
    ]);
  });

  it("reads what the SeekHead points to past the first read; chapters it can't see stay unknown", async () => {
    const tracks = el(M.Tracks, video("V_MPEG4/ISO/AVC"), audio(2, "A_DTS", str(M.Language, "rus")));
    const filler = el(M.Void, new Uint8Array(100_000));
    // SeekHead with a placeholder position, its length fixed: then the real one, from where the Tracks land.
    const seekHead = (pos: number) => el(M.SeekHead, el(M.Seek, u(M.SeekID, 0x1654ae6b), u(M.SeekPosition, pos, 8)));
    const before = concat([seekHead(0), info(100), filler]);
    const b = mkv(seekHead(before.length), info(100), filler, tracks);
    const { read, reads } = reader(b);
    const p = await matroskaProbe(read, b.length);
    expect(reads.length).toBeGreaterThan(1);
    expect(p?.streams?.map((s) => s.codec_name)).toEqual(["h264", "dts"]);
    expect(p?.chapters).toBeUndefined();
  });

  it("gives null for what only ffprobe can name or number", async () => {
    const probe = async (b: Uint8Array) => matroskaProbe(reader(b).read, b.length);
    expect(await probe(mkv(info(100), el(M.Tracks, video("V_REAL/RV40"), audio(2, "A_AAC"))))).toBeNull();
    expect(await probe(mkv(info(100), el(M.Tracks, video("V_MPEG4/ISO/AVC"), audio(2, "A_REAL/COOK"))))).toBeNull();
    expect(await probe(mkv(info(100), el(M.Tracks, video("V_MPEG4/ISO/AVC"), audio(2, "A_AAC", u(M.FlagEnabled, 0, 1)))))).toBeNull();
    expect(await probe(mkv(info(100), el(M.Tracks, video("V_MPEG4/ISO/AVC"), el(M.TrackEntry, u(M.TrackNumber, 2, 1), u(M.TrackType, 18, 1), str(M.CodecID, "B_VOBBTN")))))).toBeNull();
    expect(await probe(fixture("mp4-h264-aac.mp4"))).toBeNull();
    // A file cut short inside its tracks is ffprobe's too.
    expect(await probe(mkv(info(100), el(M.Tracks, video("V_MPEG4/ISO/AVC"))).subarray(0, 60))).toBeNull();
  });

  it("leaves the duration unknown when the file doesn't say it", async () => {
    const b = mkv(info(null), el(M.Tracks, video("V_MPEG4/ISO/AVC"), audio(2, "A_AAC")));
    const p = await matroskaProbe(reader(b).read, b.length);
    expect(p?.format).toEqual({ format_name: "matroska,webm", duration: undefined, bit_rate: undefined });
  });
});
