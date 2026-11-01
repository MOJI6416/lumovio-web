import type { PgsBitmap, PgsFrame } from "./pgs";

/**
 * DVD picture subtitles (VobSub, Matroska's S_VOBSUB): the track's CodecPrivate is the .idx header — the picture's size
 * and a 16-colour palette — and each block one subpicture unit: two-bit run-length coded fields (even and odd lines)
 * and a control sequence that picks four of the palette's colours with their opacity, the picture's place, and when it
 * shows and goes. Decoded into the same frames as PGS (`pgs.ts`), which `engine.ts` draws over the video.
 */

export interface VobSubHeader {
  /** The picture's size the subtitles are placed in (the DVD's, 720×576 or 720×480). */
  width: number;
  height: number;
  /** 16 colours, RGB. */
  palette: [number, number, number][];
}

/** The .idx header: "size: 720x576" and "palette: 000000, f0f0f0, …"; what's missing reads as a PAL DVD's greys. */
export function parseIdx(text: string): VobSubHeader {
  const size = /^\s*size:\s*(\d+)\s*x\s*(\d+)/im.exec(text);
  const pal = /^\s*palette:\s*(.+)$/im.exec(text);
  const palette = (pal?.[1] ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^[0-9a-f]{6}$/i.test(c))
    .map((c) => [Number.parseInt(c.slice(0, 2), 16), Number.parseInt(c.slice(2, 4), 16), Number.parseInt(c.slice(4, 6), 16)] as [number, number, number]);
  while (palette.length < 16) {
    const v = [0, 255, 128, 64][palette.length % 4]!;
    palette.push([v, v, v]);
  }
  return { width: Number(size?.[1]) || 720, height: Number(size?.[2]) || 576, palette };
}

/** One two-bit field of a subpicture: nibble codes of a run and a colour, every line starting on a whole byte. */
export function decodeVobRle(buf: Uint8Array, start: number, width: number, lines: number, out: Uint8Array, firstLine: number) {
  let bit = start * 8;
  const end = buf.length * 8;
  const nibble = () => {
    const b = buf[bit >> 3] ?? 0;
    const n = bit & 4 ? b & 0x0f : b >> 4;
    bit += 4;
    return n;
  };
  for (let y = 0; y < lines; y++) {
    const row = (firstLine + y * 2) * width;
    let x = 0;
    while (x < width) {
      if (bit >= end) return;
      // 1 to 4 nibbles: the code grows while it is smaller than 4, 16, 64.
      let v = nibble();
      for (let t = 4; v < t && t <= 0x40; t <<= 2) v = (v << 4) | nibble();
      const color = v & 3;
      // A run of 0: the colour to the end of the line.
      const run = v < 4 ? width - x : Math.min(v >> 2, width - x);
      out.fill(color, row + x, row + x + run);
      x += run;
    }
    // Lines start on a whole byte.
    bit = (bit + 7) & ~7;
  }
}

export interface VobSubPicture {
  /** Seconds after the block's time it shows and goes (null: until the next one). */
  start: number;
  end: number | null;
  bitmap: PgsBitmap | null;
}

/** One subpicture unit (a Matroska block's data). */
export function decodeSpu(buf: Uint8Array, header: VobSubHeader): VobSubPicture | null {
  if (buf.length < 10) return null;
  const word = (p: number) => ((buf[p] ?? 0) << 8) | (buf[p + 1] ?? 0);
  let cmd = word(2);
  let start = 0;
  let end: number | null = null;
  const colors = [0, 0, 0, 0];
  const alpha = [0, 15, 15, 15];
  let area: { x1: number; y1: number; x2: number; y2: number } | null = null;
  let fields: [number, number] | null = null;
  for (let guard = 0; cmd > 0 && cmd + 4 <= buf.length && guard < 64; guard++) {
    // Display control sequence: its delay in 1024/90000 s, the next one's place, then commands to 0xFF.
    const at = (word(cmd) * 1024) / 90_000;
    const next = word(cmd + 2);
    let p = cmd + 4;
    loop: while (p < buf.length) {
      switch (buf[p++]) {
        case 0x00:
          // A "forced" (menu) picture: shown like any other.
          break;
        case 0x01:
          start = at;
          break;
        case 0x02:
          end = at;
          break;
        case 0x03:
          colors[3] = buf[p]! >> 4;
          colors[2] = buf[p]! & 0x0f;
          colors[1] = buf[p + 1]! >> 4;
          colors[0] = buf[p + 1]! & 0x0f;
          p += 2;
          break;
        case 0x04:
          alpha[3] = buf[p]! >> 4;
          alpha[2] = buf[p]! & 0x0f;
          alpha[1] = buf[p + 1]! >> 4;
          alpha[0] = buf[p + 1]! & 0x0f;
          p += 2;
          break;
        case 0x05:
          area = {
            x1: (buf[p]! << 4) | (buf[p + 1]! >> 4),
            x2: ((buf[p + 1]! & 0x0f) << 8) | buf[p + 2]!,
            y1: (buf[p + 3]! << 4) | (buf[p + 4]! >> 4),
            y2: ((buf[p + 4]! & 0x0f) << 8) | buf[p + 5]!,
          };
          p += 6;
          break;
        case 0x06:
          fields = [word(p), word(p + 2)];
          p += 4;
          break;
        default:
          // 0xFF ends the sequence; anything else (colour changes, 0x07) isn't drawn here.
          break loop;
      }
    }
    if (next <= cmd) break;
    cmd = next;
  }
  if (!area || !fields) return { start, end, bitmap: null };
  const width = area.x2 - area.x1 + 1;
  const height = area.y2 - area.y1 + 1;
  if (width <= 0 || height <= 0) return { start, end, bitmap: null };
  const idx = new Uint8Array(width * height);
  decodeVobRle(buf, fields[0], width, Math.ceil(height / 2), idx, 0);
  decodeVobRle(buf, fields[1], width, Math.floor(height / 2), idx, 1);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const lut = colors.map((c, i) => [...header.palette[c]!, alpha[i]! * 17] as const);
  let visible = false;
  for (let i = 0; i < idx.length; i++) {
    const [r, g, b, a] = lut[idx[i]!]!;
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = a;
    if (a) visible = true;
  }
  return { start, end, bitmap: visible ? { x: area.x1, y: area.y1, width, height, rgba } : null };
}

/**
 * A track's subpictures as frames to draw: each picture from its start, and an empty frame when it goes (its stop
 * command, else the block's duration, else the next picture replaces it).
 */
export function vobSubFrames(buf: Uint8Array, time: number, duration: number | null, header: VobSubHeader): PgsFrame[] {
  const pic = decodeSpu(buf, header);
  if (!pic) return [];
  const { width, height } = header;
  const out: PgsFrame[] = [{ time: time + pic.start, width, height, bitmaps: pic.bitmap ? [pic.bitmap] : [] }];
  const end = pic.end !== null && pic.end > pic.start ? time + pic.end : duration ? time + duration : null;
  if (end !== null) out.push({ time: end, width, height, bitmaps: [] });
  return out;
}
