/**
 * Blu-ray picture subtitles (PGS, "HDMV presentation graphics"): each display set — composition, windows,
 * palette, run-length coded pictures — decoded into bitmaps in the composition's own pixels, which `engine.ts` draws
 * over the video. Matroska stores one display set per block, without the "PG" headers a .sup file has.
 */

export interface PgsBitmap {
  x: number;
  y: number;
  width: number;
  height: number;
  /** RGBA, `width * height * 4`. */
  rgba: Uint8ClampedArray;
}

export interface PgsFrame {
  /** Seconds: shown from here until the next frame of the track. */
  time: number;
  /** The composition's size (the video's, usually 1920×1080). */
  width: number;
  height: number;
  /** Nothing to show (a clearing display set) when empty. */
  bitmaps: PgsBitmap[];
}

interface PgsObject {
  width: number;
  height: number;
  data: Uint8Array[];
}

const PDS = 0x14;
const ODS = 0x15;
const PCS = 0x16;
const WDS = 0x17;
const END = 0x80;

/** YCbCr (limited range) to RGB, BT.709 for HD and BT.601 for SD. */
function toRgb(y: number, cr: number, cb: number, hd: boolean): [number, number, number] {
  const Y = 1.164 * (y - 16);
  const r = hd ? Y + 1.793 * (cr - 128) : Y + 1.596 * (cr - 128);
  const g = hd ? Y - 0.213 * (cb - 128) - 0.533 * (cr - 128) : Y - 0.392 * (cb - 128) - 0.813 * (cr - 128);
  const b = hd ? Y + 2.112 * (cb - 128) : Y + 2.017 * (cb - 128);
  return [r, g, b];
}

/** Run-length decoding of one picture into palette indexes. */
export function decodeRle(data: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  let i = 0;
  let x = 0;
  let y = 0;
  while (i < data.length && y < height) {
    const b = data[i++]!;
    let color = 0;
    let run = 1;
    if (b !== 0) color = b;
    else {
      const f = data[i++] ?? 0;
      if (f === 0) {
        x = 0;
        y++;
        continue;
      }
      const long = f & 0x40;
      run = long ? ((f & 0x3f) << 8) | (data[i++] ?? 0) : f & 0x3f;
      if (f & 0x80) color = data[i++] ?? 0;
    }
    const at = y * width + x;
    out.fill(color, at, Math.min(at + run, (y + 1) * width));
    x += run;
  }
  return out;
}

interface DisplaySet {
  time: number;
  width: number;
  height: number;
  paletteId: number;
  placed: { id: number; x: number; y: number; crop: { x: number; y: number; w: number; h: number } | null }[];
}

/**
 * Decodes a track's display sets in order (palettes and pictures carry over within an epoch). A display set may come
 * in one block (mkvmerge) or one segment per block (FFmpeg without its merging filter): segments are gathered until
 * the set's end segment, and the set is shown at the time of the block that began it.
 */
export class PgsDecoder {
  private palettes = new Map<number, Uint8ClampedArray>();
  private objects = new Map<number, PgsObject>();
  private set: DisplaySet | null = null;

  /** Forgets everything carried over (after a seek: the next epoch start brings it again). */
  reset() {
    this.palettes.clear();
    this.objects.clear();
    this.set = null;
  }

  /** Segments of a display set as Matroska stores them, at `time`; the frame once its set is complete, else null. */
  decode(block: Uint8Array, time: number): PgsFrame | null {
    let frame: PgsFrame | null = null;
    let p = 0;
    while (p + 3 <= block.length) {
      const type = block[p]!;
      const size = (block[p + 1]! << 8) | block[p + 2]!;
      const s = block.subarray(p + 3, p + 3 + size);
      p += 3 + size;
      if (type === PCS && s.length >= 11) {
        const state = s[7]!;
        // An epoch start drops what the previous epoch defined.
        if (state & 0x80) {
          this.palettes.clear();
          this.objects.clear();
        }
        const set: DisplaySet = {
          time,
          width: (s[0]! << 8) | s[1]!,
          height: (s[2]! << 8) | s[3]!,
          paletteId: s[9]!,
          placed: [],
        };
        const n = s[10]!;
        let q = 11;
        for (let k = 0; k < n && q + 8 <= s.length; k++) {
          const cropped = s[q + 3]! & 0x80;
          const entry = {
            id: (s[q]! << 8) | s[q + 1]!,
            x: (s[q + 4]! << 8) | s[q + 5]!,
            y: (s[q + 6]! << 8) | s[q + 7]!,
            crop: null as DisplaySet["placed"][number]["crop"],
          };
          q += 8;
          if (cropped && q + 8 <= s.length) {
            entry.crop = {
              x: (s[q]! << 8) | s[q + 1]!,
              y: (s[q + 2]! << 8) | s[q + 3]!,
              w: (s[q + 4]! << 8) | s[q + 5]!,
              h: (s[q + 6]! << 8) | s[q + 7]!,
            };
            q += 8;
          }
          set.placed.push(entry);
        }
        this.set = set;
      } else if (type === PDS && s.length >= 2) {
        const id = s[0]!;
        const pal = this.palettes.get(id) ?? new Uint8ClampedArray(256 * 4);
        const h = this.set?.height ?? 1080;
        for (let q = 2; q + 5 <= s.length; q += 5) {
          const [r, g, b] = toRgb(s[q + 1]!, s[q + 2]!, s[q + 3]!, h > 576);
          const e = s[q]! * 4;
          pal[e] = r;
          pal[e + 1] = g;
          pal[e + 2] = b;
          pal[e + 3] = s[q + 4]!;
        }
        this.palettes.set(id, pal);
      } else if (type === ODS && s.length >= 4) {
        const id = (s[0]! << 8) | s[1]!;
        if (s[3]! & 0x80) {
          // First fragment: data length (3 bytes, counting width and height), width, height, then data.
          if (s.length >= 11)
            this.objects.set(id, {
              width: (s[7]! << 8) | s[8]!,
              height: (s[9]! << 8) | s[10]!,
              data: [s.slice(11)],
            });
        } else this.objects.get(id)?.data.push(s.slice(4));
      } else if (type === WDS) {
        // Windows bound where pictures go; the placements above already say where each one is.
      } else if (type === END) {
        if (this.set) frame = this.compose(this.set);
        this.set = null;
      }
    }
    return frame;
  }

  private compose(set: DisplaySet): PgsFrame | null {
    if (!set.width || !set.height) return null;
    const palette = this.palettes.get(set.paletteId);
    const bitmaps: PgsBitmap[] = [];
    for (const pl of set.placed) {
      const obj = this.objects.get(pl.id);
      // A picture of an earlier display set that wasn't read (playback started past it): this one can't be drawn.
      if (!obj || !palette) return null;
      const data = obj.data.length === 1 ? obj.data[0]! : concat(obj.data);
      const idx = decodeRle(data, obj.width, obj.height);
      const c = pl.crop ?? { x: 0, y: 0, w: obj.width, h: obj.height };
      const rgba = new Uint8ClampedArray(c.w * c.h * 4);
      for (let yy = 0; yy < c.h; yy++)
        for (let xx = 0; xx < c.w; xx++) {
          const src = idx[(yy + c.y) * obj.width + xx + c.x]! * 4;
          const dst = (yy * c.w + xx) * 4;
          rgba[dst] = palette[src]!;
          rgba[dst + 1] = palette[src + 1]!;
          rgba[dst + 2] = palette[src + 2]!;
          rgba[dst + 3] = palette[src + 3]!;
        }
      bitmaps.push({ x: pl.x, y: pl.y, width: c.w, height: c.h, rgba });
    }
    return { time: set.time, width: set.width, height: set.height, bitmaps };
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of parts) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}
