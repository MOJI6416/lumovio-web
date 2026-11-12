import type { FileProbe } from "./torrserver";

/** Only what a playback reads of a probe, so that a remembered one stays small. */
export function trimProbe(p: FileProbe): FileProbe {
  return {
    format: p.format ? { format_name: p.format.format_name, duration: p.format.duration, bit_rate: p.format.bit_rate } : undefined,
    streams: p.streams?.map((s) => ({
      index: s.index,
      codec_type: s.codec_type,
      codec_name: s.codec_name,
      tags: s.tags ? { language: s.tags.language, title: s.tags.title } : undefined,
      disposition: s.disposition?.default ? { default: 1 } : undefined,
      bits_per_raw_sample: s.bits_per_raw_sample,
      pix_fmt: s.pix_fmt,
      width: s.width,
      height: s.height,
      side_data_list: s.side_data_list?.map((x) => ({ side_data_type: x.side_data_type, dv_profile: x.dv_profile })),
      color_transfer: s.color_transfer,
      channels: s.channels,
    })),
    chapters: p.chapters?.map((c) => ({ start_time: c.start_time, end_time: c.end_time, tags: c.tags?.title ? { title: c.tags.title } : undefined })),
  };
}

/*
 * A torrent's file never changes (its info hash says so), so what ffprobe said about it is kept on this device: the next
 * start of the same file — "Continue", another audio track, a stream opened again after it broke off — goes without
 * waiting for the probe, which takes 2–17 s on a torrent TorrServer has to wake.
 */
const PROBES_KEY = "lumovio.probes.v1";
const PROBES_MAX = 30;
let probes: Map<string, FileProbe> | null = null;
const probeBook = () => {
  if (probes) return probes;
  probes = new Map();
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(PROBES_KEY) ?? "null") as [string, FileProbe][] | null;
    if (Array.isArray(saved)) for (const [k, v] of saved) probes.set(k, v);
  } catch {
    /* storage unavailable or damaged: the probes are asked again */
  }
  return probes;
};
export function rememberedProbe(key: string): FileProbe | null {
  return probeBook().get(key) ?? null;
}
export function rememberProbe(key: string, probe: FileProbe) {
  const book = probeBook();
  book.delete(key);
  book.set(key, trimProbe(probe));
  while (book.size > PROBES_MAX) book.delete(book.keys().next().value!);
  try {
    globalThis.localStorage?.setItem(PROBES_KEY, JSON.stringify([...book]));
  } catch {
    /* full or unavailable: kept for this page only */
  }
}
