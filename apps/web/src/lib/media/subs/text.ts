/**
 * Text subtitles: SubRip, WebVTT and ASS/SSA files and Matroska's text blocks, turned into cues the player
 * shows as the browser's own text tracks — SRT's italics and bold kept, ASS's styling dropped where it can't be drawn
 * (`engine.ts` draws ASS with libass when it loads). Plus the subtitle files a torrent carries next to its video.
 */

export interface TextCue {
  /** Seconds. */
  start: number;
  end: number;
  /** WebVTT cue text: plain, with <i>, <b>, <u> and line breaks. */
  text: string;
}

/**
 * A subtitle file's text: UTF-8 (with or without BOM) or UTF-16 by BOM; anything else is a legacy one-byte encoding —
 * Windows-1251 when it reads as Cyrillic (Russian and Ukrainian releases), else Windows-1252.
 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes,
    );
  } catch {
    // Bytes 0xC0–0xFF are Cyrillic letters in 1251; Latin-1 text has few of them.
    let high = 0;
    let cyr = 0;
    for (const b of bytes) {
      if (b >= 0x80) high++;
      if (b >= 0xc0) cyr++;
    }
    return new TextDecoder(high && cyr / high > 0.6 ? "windows-1251" : "windows-1252").decode(bytes);
  }
}

const TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,:](\d{1,3})/;

function seconds(m: RegExpExecArray): number {
  const ms = m[4]!.padEnd(3, "0");
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(ms) / 1000;
}

/** SubRip's markup as WebVTT cue text: <i>, <b>, <u> kept; <font>, ASS-style {\an8} tags and stray markup dropped. */
export function srtToCueText(text: string): string {
  const esc = (s: string) =>
    s
      .replace(/<[^>]*>/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  // Split on the tags kept: they land at the odd places, everything between them is escaped text.
  const parts = text
    .replace(/\r/g, "")
    .replace(/\{\\[^}]*\}/g, "")
    .split(/(<\/?[ibu]\s*>)/i);
  return parts
    .map((p, i) => (i % 2 ? p.replace(/\s+/g, "").toLowerCase() : esc(p)))
    .join("")
    .trim();
}

/** ASS dialogue text as plain cue text: override blocks {…} removed, \N and \n line breaks, \h a space. */
export function assToCueText(text: string): string {
  const plain = text
    .replace(/\{[^}]*\}/g, "")
    .replace(/\\[Nn]/g, "\n")
    .replace(/\\h/g, " ")
    .trim();
  return plain.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A SubRip file. */
export function parseSrt(text: string): TextCue[] {
  const out: TextCue[] = [];
  for (const block of text.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const [a, b] = lines[at]!.split("-->");
    const s = TIME.exec(a ?? "");
    const e = TIME.exec(b ?? "");
    if (!s || !e) continue;
    const body = srtToCueText(lines.slice(at + 1).join("\n"));
    if (body) out.push({ start: seconds(s), end: seconds(e), text: body });
  }
  return out;
}

/** A WebVTT file's cues (settings and regions are left to the default position). */
export function parseVtt(text: string): TextCue[] {
  const out: TextCue[] = [];
  for (const block of text.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const [a, b] = lines[at]!.split("-->");
    const s = TIME.exec(a ?? "");
    const e = TIME.exec(b ?? "");
    if (!s || !e) continue;
    const body = lines
      .slice(at + 1)
      .join("\n")
      .trim();
    if (body) out.push({ start: seconds(s), end: seconds(e), text: body });
  }
  return out;
}

/** An ASS/SSA script: its header (script info and styles, for libass) and its dialogue as plain cues. */
export function parseAss(text: string): { header: string; cues: TextCue[] } {
  const src = text.replace(/\r/g, "");
  const events = src.search(/^\[Events\]/m);
  const header = events >= 0 ? src.slice(0, events) : src;
  const cues: TextCue[] = [];
  if (events >= 0) {
    let fields: string[] = [];
    for (const line of src.slice(events).split("\n")) {
      if (/^Format:/i.test(line))
        fields = line
          .slice(7)
          .split(",")
          .map((f) => f.trim().toLowerCase());
      else if (/^Dialogue:/i.test(line) && fields.length) {
        const parts = line.slice(9).split(",");
        const textAt = fields.indexOf("text");
        const value = (name: string) => parts[fields.indexOf(name)]?.trim() ?? "";
        const s = TIME.exec(value("start"));
        const e = TIME.exec(value("end"));
        const body = assToCueText(parts.slice(textAt).join(","));
        if (s && e && body) cues.push({ start: seconds(s), end: seconds(e), text: body });
      }
    }
  }
  cues.sort((a, b) => a.start - b.start);
  return { header, cues };
}

/** The dialogue text of one Matroska ASS/SSA block: "ReadOrder, Layer, Style, Name, MarginL, MarginR, MarginV, Effect, Text". */
export function assBlockText(block: string): string {
  const parts = block.split(",");
  return parts.length > 8 ? parts.slice(8).join(",") : block;
}

/** The ASS header of a Matroska track (CodecPrivate), with an [Events] format line libass needs to take blocks. */
export function assHeader(codecPrivate: string): string {
  const h = codecPrivate.replace(/\r/g, "").trimEnd();
  return /^\[Events\]/m.test(h)
    ? `${h}\n`
    : `${h}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
}

/** Subtitle file formats a torrent may carry next to its video. */
export type ExternalFormat = "srt" | "vtt" | "ass";
const SUB_EXT = /\.(srt|vtt|ass|ssa)$/i;

const LANGS: [string, RegExp][] = [
  ["ru", /^(ru|rus|russian|рус|русский|русские)$/i],
  ["uk", /^(uk|ua|ukr|ukrainian|укр|українські|украинский)$/i],
  ["en", /^(en|eng|english|англ)$/i],
  ["ja", /^(ja|jp|jpn|jap|japanese)$/i],
  ["de", /^(de|ger|deu|german)$/i],
  ["fr", /^(fr|fre|fra|french)$/i],
  ["es", /^(es|spa|spanish)$/i],
  ["it", /^(it|ita|italian)$/i],
  ["pl", /^(pl|pol|polish)$/i],
  ["pt", /^(pt|por|portuguese)$/i],
  ["zh", /^(zh|chi|chs|cht|chinese)$/i],
  ["ko", /^(ko|kor|korean)$/i],
  ["tr", /^(tr|tur|turkish)$/i],
];

export interface ExternalSubtitle<F> {
  file: F;
  format: ExternalFormat;
  lang: string | null;
  forced: boolean;
  /** What the file name says beyond the video's name and the language ("SDH", "Ancord"), or null. */
  label: string | null;
}

const stemOf = (path: string) => (path.split(/[/\\]/).pop() ?? path).replace(/\.[^.]+$/, "");
const dirOf = (path: string) => path.split(/[/\\]/).slice(0, -1).join("/");

/**
 * A torrent's subtitle files for one of its videos: named after it ("Film.rus.srt", "Film.forced.ass"), or in a
 * subtitles folder ("Subs/Film.srt", "RUS Subs/Film.srt"); for a torrent with one video, every subtitle file.
 * The language comes from the file's or folder's name, else stays unknown.
 */
export function externalSubtitles<F extends { path: string }>(
  files: F[],
  video: F,
  videos: number,
): ExternalSubtitle<F>[] {
  const vstem = stemOf(video.path).toLowerCase();
  const vdir = dirOf(video.path).toLowerCase();
  const out: ExternalSubtitle<F>[] = [];
  for (const f of files) {
    const ext = SUB_EXT.exec(f.path)?.[1]?.toLowerCase();
    if (!ext) continue;
    const stem = stemOf(f.path);
    const lower = stem.toLowerCase();
    const dir = dirOf(f.path);
    const named = lower.startsWith(vstem);
    const inSubsFolder = /sub|сабы|субтитр/i.test(dir.slice(vdir.length));
    if (
      !named &&
      !(inSubsFolder && (lower.startsWith(vstem) || videos === 1 || vstem.startsWith(lower))) &&
      videos > 1
    )
      continue;
    const rest = named ? stem.slice(vstem.length) : stem;
    const tokens = [...rest.split(/[\s._\-[\]()]+/), ...dir.split(/[/\\\s._\-[\]()]+/)].filter(Boolean);
    const lang = tokens.map((t) => LANGS.find(([, re]) => re.test(t))?.[0]).find(Boolean) ?? null;
    const forced = tokens.some((t) => /^(forced|форсированные|форс|надписи)$/i.test(t));
    const label = named
      ? rest
          .split(/[._]+/)
          .filter(
            (t) => t && !LANGS.some(([, re]) => re.test(t)) && !/^(forced|форсированные|форс)$/i.test(t),
          )
          .join(" ")
          .trim() || null
      : null;
    out.push({ file: f, format: ext === "ssa" ? "ass" : (ext as ExternalFormat), lang, forced, label });
  }
  return out;
}

/** Cues of an external file, by its format; ASS also gives its whole script for libass. */
export function parseExternal(format: ExternalFormat, bytes: Uint8Array): { cues: TextCue[]; ass?: string } {
  const text = decodeText(bytes);
  if (format === "ass") return { cues: parseAss(text).cues, ass: text };
  return { cues: format === "vtt" ? parseVtt(text) : parseSrt(text) };
}
