import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pickSubtitle } from "../src/lib/media/subs/choice";
import {
  decompress,
  readClusterSubtitles,
  readCueBlock,
  readMatroskaIndex,
} from "../src/lib/media/subs/matroska";
import { decodeRle, PgsDecoder } from "../src/lib/media/subs/pgs";
import {
  assBlockText,
  assHeader,
  assToCueText,
  decodeText,
  externalSubtitles,
  parseAss,
  parseSrt,
  srtToCueText,
} from "../src/lib/media/subs/text";

// The device check's subtitle clip: SRT rus, SRT rus forced, ASS eng, PGS eng,
// VobSub fre.
const clip = readFileSync(new URL("../public/player-check/mkv-subs.mkv", import.meta.url));
const reads: [number, number][] = [];
const read = async (s: number, e: number) => {
  reads.push([s, e]);
  return new Uint8Array(clip.subarray(s, e));
};

describe("Matroska subtitle tracks", () => {
  it("finds the tracks and a cue with its place for every subtitle block, reading only ranges", async () => {
    const idx = await readMatroskaIndex(read);
    const subs = idx.tracks.filter((t) => t.type === 17);
    expect(subs.map((t) => [t.codecId, t.language, t.forced])).toEqual([
      ["S_TEXT/UTF8", "rus", false],
      ["S_TEXT/UTF8", "rus", true],
      ["S_TEXT/ASS", "eng", false],
      ["S_HDMV/PGS", "eng", false],
      ["S_VOBSUB", "fre", false],
    ]);
    expect(subs[1]!.name).toBe("Forced");
    expect(subs[2]!.codecPrivate && decodeText(subs[2]!.codecPrivate)).toContain("[V4+ Styles]");
    for (const t of subs) expect(idx.cues.filter((c) => c.track === t.number).length).toBeGreaterThan(0);
    expect(idx.cues.every((c) => c.relative !== null)).toBe(true);
  });

  it("reads each line by its cue: text, time and duration", async () => {
    const idx = await readMatroskaIndex(read);
    const [rus, forced, ass] = idx.tracks.filter((t) => t.type === 17);
    const lines = async (n: number) =>
      Promise.all(
        idx.cues
          .filter((c) => c.track === n)
          .map(async (c) => {
            const b = (await readCueBlock(read, idx, c))!;
            return {
              time: b.time,
              duration: b.duration,
              text: decodeText(await decompress(idx.tracks.find((t) => t.number === n)!, b.data)),
            };
          }),
      );
    expect(await lines(rus!.number)).toEqual([
      { time: 0.5, duration: 1.3, text: "<i>Первая</i> строка" },
      { time: 2, duration: 1.5, text: "Вторая строка" },
    ]);
    expect((await lines(forced!.number)).map((l) => l.text)).toEqual(["НАДПИСЬ"]);
    const a = await lines(ass!.number);
    expect(assBlockText(a[0]!.text)).toBe("{\\b1}ASS{\\b0} line one");
    expect(assToCueText(assBlockText(a[1]!.text))).toBe("ASS line two\nsecond row");
  });

  it("finds the lines by reading clusters when the cues don't name subtitle blocks (older muxers)", async () => {
    const idx = await readMatroskaIndex(read);
    expect(idx.clusters.length).toBeGreaterThan(0);
    const rus = idx.tracks.find((t) => t.type === 17)!;
    const lines: string[] = [];
    for (const [i, c] of idx.clusters.entries()) {
      const blocks = await readClusterSubtitles(read, idx, c, idx.clusters[i + 1]?.pos ?? null);
      for (const b of blocks)
        if (b.track === rus.number) lines.push(`${b.time}+${b.duration} ${decodeText(b.data)}`);
    }
    expect(lines).toEqual(["0.5+1.3 <i>Первая</i> строка", "2+1.5 Вторая строка"]);
  });

  it("decodes the PGS display sets into pictures, then a clearing set", async () => {
    const idx = await readMatroskaIndex(read);
    const pgs = idx.tracks.find((t) => t.codecId === "S_HDMV/PGS")!;
    const dec = new PgsDecoder();
    const frames = [];
    for (const c of idx.cues.filter((x) => x.track === pgs.number)) {
      const b = (await readCueBlock(read, idx, c))!;
      const f = dec.decode(await decompress(pgs, b.data), b.time);
      if (f) frames.push(f);
    }
    expect(frames.map((f) => [f.time, f.bitmaps.length])).toEqual([
      [0, 0],
      [0.5, 1],
      [1.8, 0],
      [2, 1],
      [3.5, 0],
    ]);
    const bmp = frames[1]!.bitmaps[0]!;
    expect([frames[1]!.width, frames[1]!.height]).toEqual([426, 240]);
    // White letters (alpha 255) and transparent background.
    let white = 0;
    let clear = 0;
    for (let i = 0; i < bmp.rgba.length; i += 4) {
      if (bmp.rgba[i + 3] === 255 && bmp.rgba[i]! > 230) white++;
      if (bmp.rgba[i + 3] === 0) clear++;
    }
    expect(white).toBeGreaterThan(100);
    expect(clear).toBeGreaterThan(white);
  });

  it("run-length codes: short and long runs, colour runs, line ends", () => {
    // 2 pixels of colour 5, 3 transparent, then a line end; next line: 70 pixels of colour 1.
    const data = new Uint8Array([5, 5, 0, 3, 0, 0, 0, 0xc0, 70, 1, 0, 0]);
    const px = decodeRle(data, 70, 2);
    expect([...px.subarray(0, 6)]).toEqual([5, 5, 0, 0, 0, 0]);
    expect(px.subarray(70).every((v) => v === 1)).toBe(true);
  });
});

describe("text subtitles", () => {
  it("SubRip: times, italics kept, other markup dropped", () => {
    const cues = parseSrt(
      "1\r\n00:01:02,500 --> 00:01:04,000\r\n<i>Привет</i>\r\n<font color=red>мир</font>\r\n\r\n2\r\n01:00:00,000 --> 01:00:01,250\r\n{\\an8}Top & <b>bold</b>\r\n",
    );
    expect(cues).toEqual([
      { start: 62.5, end: 64, text: "<i>Привет</i>\nмир" },
      { start: 3600, end: 3601.25, text: "Top &amp; <b>bold</b>" },
    ]);
    expect(srtToCueText("a < b")).toBe("a &lt; b");
  });

  it("ASS: header for libass, dialogue as plain cues in order", () => {
    const { header, cues } = parseAss(
      "[Script Info]\nTitle: x\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:05.00,0:00:06.50,Default,,0,0,0,,{\\i1}Two{\\i0}, with comma\\Nnext\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,One\n",
    );
    expect(header).toContain("[Script Info]");
    expect(cues).toEqual([
      { start: 1, end: 2, text: "One" },
      { start: 5, end: 6.5, text: "Two, with comma\nnext" },
    ]);
    expect(assHeader("[Script Info]\n")).toContain("[Events]\nFormat: Layer, Start");
  });

  it("legacy encodings: Windows-1251 Cyrillic, UTF-8 with a BOM", () => {
    const cp1251 = new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
    expect(decodeText(cp1251)).toBe("Привет");
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69]))).toBe("hi");
  });

  it("a torrent's subtitle files: named after the video, or in a subtitles folder; language and forced from the name", () => {
    const files = [
      { path: "Film (2020)/Film.2020.1080p.mkv" },
      { path: "Film (2020)/Film.2020.1080p.rus.srt" },
      { path: "Film (2020)/Film.2020.1080p.eng.forced.ass" },
      { path: "Film (2020)/Subs/Ukr/Film.2020.1080p.srt" },
      { path: "Film (2020)/Other.srt" },
    ];
    const got = externalSubtitles(files, files[0]!, 2).map((s) => [
      s.file.path.split("/").pop(),
      s.format,
      s.lang,
      s.forced,
    ]);
    expect(got).toEqual([
      ["Film.2020.1080p.rus.srt", "srt", "ru", false],
      ["Film.2020.1080p.eng.forced.ass", "ass", "en", true],
      ["Film.2020.1080p.srt", "srt", "uk", false],
    ]);
    // With one video in the torrent, any subtitle file belongs to it.
    expect(externalSubtitles(files, files[0]!, 1).length).toBe(4);
  });
});

describe("which subtitles start shown", () => {
  const tracks = [
    { lang: "rus", forced: true, name: "Forced" },
    { lang: "rus", forced: false, name: null },
    { lang: "en-US", forced: false, name: "SDH" },
    { lang: "en-US", forced: false, name: null },
  ];
  const ctx = { memory: null, audioLang: "rus", audioLanguages: ["ru"], subtitleLanguages: ["en", "ru"] };

  it("the dubbed audio's forced subtitles when the audio is understood", () => {
    expect(pickSubtitle(tracks, ctx)).toBe(0);
  });

  it("the first subtitle language when the audio isn't one of the profile's", () => {
    expect(pickSubtitle(tracks, { ...ctx, audioLang: "eng" })).toBe(2);
    expect(pickSubtitle(tracks, { ...ctx, audioLang: "jpn", subtitleLanguages: ["ru"] })).toBe(1);
  });

  it("the remembered choice by language, kind and name, never by position; off stays off", () => {
    expect(pickSubtitle(tracks, { ...ctx, memory: { lang: "en", forced: false, name: null } })).toBe(3);
    expect(pickSubtitle(tracks, { ...ctx, memory: { lang: "en", forced: false, name: "Other" } })).toBe(2);
    expect(pickSubtitle(tracks, { ...ctx, memory: { off: true } })).toBeNull();
    // A language this file hasn't: the profile's rules.
    expect(pickSubtitle(tracks, { ...ctx, memory: { lang: "de", forced: false, name: null } })).toBe(0);
  });

  it("nothing when nothing fits", () => {
    expect(pickSubtitle(tracks, { ...ctx, audioLang: null })).toBeNull();
    expect(pickSubtitle([], ctx)).toBeNull();
  });
});
