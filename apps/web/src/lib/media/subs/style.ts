import type { SubtitleStyle } from "@lumovio/contracts";

/*
 * The profile's subtitle look (`SubtitleStyle`) for the renderers that don't take CSS: ASS styles
 * given to libass and the pictures of PGS and VobSub. Text cues take it from globals.css (`[data-sub-*]` on the player).
 */

/** Each size against the medium one. */
export const SUBTITLE_SCALE: Record<SubtitleStyle["size"], number> = { s: 0.8, m: 1, l: 1.25, xl: 1.5 };
/** "Higher": how far up lines at the bottom move, as a share of the picture's height. */
export const SUBTITLE_RAISE = 0.08;

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * An ASS script with the size and height applied to its styles: font size, outline and shadow scaled; bottom-aligned
 * styles lifted by their vertical margin. Lines placed by \pos and inline \fs keep their own; colours, fonts and edges
 * stay the script's.
 */
export function restyleAss(script: string, style: Pick<SubtitleStyle, "size" | "position">): string {
  const scale = SUBTITLE_SCALE[style.size];
  const raised = style.position === "raised";
  if (scale === 1 && !raised) return script;
  const playX = Number(/^PlayResX:\s*(\d+)/im.exec(script)?.[1]) || 0;
  const playY = Number(/^PlayResY:\s*(\d+)/im.exec(script)?.[1]) || (playX ? (playX * 3) / 4 : 288);
  const lift = Math.round(playY * SUBTITLE_RAISE);
  let section = "";
  let fields: string[] = [];
  return script
    .split("\n")
    .map((line) => {
      const head = /^\s*\[([^\]]+)\]/.exec(line);
      if (head) {
        section = head[1]!.toLowerCase();
        fields = [];
        return line;
      }
      if (!/^v4\+? styles$/.test(section)) return line;
      if (/^Format:/i.test(line)) {
        fields = line
          .slice(7)
          .split(",")
          .map((f) => f.trim().toLowerCase());
        return line;
      }
      const m = /^(Style:\s*)(.*?)(\r?)$/i.exec(line);
      if (!m || !fields.length) return line;
      const parts = m[2]!.split(",");
      const at = (name: string) => fields.indexOf(name);
      const set = (name: string, f: (v: number) => number) => {
        const i = at(name);
        const v = Number(parts[i]);
        if (i >= 0 && i < parts.length && Number.isFinite(v)) parts[i] = String(round(f(v)));
      };
      set("fontsize", (v) => v * scale);
      set("outline", (v) => v * scale);
      set("shadow", (v) => v * scale);
      // Alignment 1–3 is the bottom row in both ASS (numpad) and SSA (legacy) numbering.
      const align = Number(parts[at("alignment")]);
      if (raised && align >= 1 && align <= 3) set("marginv", (v) => v + lift);
      return `${m[1]}${parts.join(",")}${m[3]}`;
    })
    .join("\n");
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where a picture subtitle's bitmaps go with the size and height: those in the lower half of the frame together, scaled
 * about their bottom centre and lifted when "higher"; those in the upper half (signs, a second speaker) scaled about
 * their top centre. Each group stays inside the frame.
 */
export function placeBitmaps(bitmaps: Rect[], frame: { width: number; height: number }, style: Pick<SubtitleStyle, "size" | "position">): Rect[] {
  const scale = SUBTITLE_SCALE[style.size];
  const lift = style.position === "raised" ? frame.height * SUBTITLE_RAISE : 0;
  const out: Rect[] = bitmaps.map((b) => ({ ...b }));
  for (const lower of [true, false]) {
    const idx = bitmaps.map((b, i) => (b.y + b.height / 2 >= frame.height / 2 === lower ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    const left = Math.min(...idx.map((i) => bitmaps[i]!.x));
    const right = Math.max(...idx.map((i) => bitmaps[i]!.x + bitmaps[i]!.width));
    const top = Math.min(...idx.map((i) => bitmaps[i]!.y));
    const bottom = Math.max(...idx.map((i) => bitmaps[i]!.y + bitmaps[i]!.height));
    const ax = (left + right) / 2;
    const ay = lower ? bottom : top;
    // Larger only as far as the group still fits the frame.
    const s = scale > 1 ? Math.max(1, Math.min(scale, frame.width / (right - left), frame.height / (bottom - top))) : scale;
    const rects = idx.map((i) => {
      const b = bitmaps[i]!;
      return { x: ax + (b.x - ax) * s, y: ay + (b.y - ay) * s - (lower ? lift : 0), width: b.width * s, height: b.height * s };
    });
    // Moved back inside the frame as a whole.
    const gl = Math.min(...rects.map((r) => r.x));
    const gr = Math.max(...rects.map((r) => r.x + r.width));
    const gt = Math.min(...rects.map((r) => r.y));
    const gb = Math.max(...rects.map((r) => r.y + r.height));
    const dx = gl < 0 ? -gl : gr > frame.width ? Math.max(-gl, frame.width - gr) : 0;
    const dy = gt < 0 ? -gt : gb > frame.height ? Math.max(-gt, frame.height - gb) : 0;
    idx.forEach((i, k) => {
      const r = rects[k]!;
      out[i] = { x: Math.round(r.x + dx), y: Math.round(r.y + dy), width: Math.round(r.width), height: Math.round(r.height) };
    });
  }
  return out;
}
