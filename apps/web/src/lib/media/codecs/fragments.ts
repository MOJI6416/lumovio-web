import type { Output } from "mediabunny";

/*
 * Fragments cut inside a group of pictures. Mediabunny's MP4 muxer ends a fragment only where every track can begin the
 * next one with a key frame: with key frames ten seconds apart, a frame from the middle of a group waited for the whole
 * group — up to 20 MB of a 1080p film — before anything of it reached Media Source. Media Source takes a fragment that
 * begins with frames depending on earlier ones, as long as those came before it (they do: fragments come in decode
 * order). So a fragment also ends before a frame where every frame of the group shown earlier is already written: from
 * there the next decode times follow on from the written ones, as Mediabunny gives a group's frames its own presentation
 * times, sorted, for decode times.
 */

interface Sample {
  timestamp: number;
  duration: number;
  type: "key" | "delta";
}
interface TrackData {
  type: "video" | "audio" | "subtitle";
  timestampProcessingQueue: Sample[];
}
interface Muxer {
  registerSample(trackData: TrackData, sample: Sample): Promise<void>;
  addSampleToTrack(trackData: TrackData, sample: Sample): Promise<void>;
  processTimestamps(trackData: TrackData, nextSample?: Pick<Sample, "timestamp" | "type">): void;
}

/**
 * Where a fragment may end before `next` in a video track whose frames since the last cut are `queue` (decode order):
 * every one of them comes right after the frames written before (`written`: the latest shown of those; null at the start),
 * none missing in between, and `next` is shown after all of them. Returns when the frame after them is shown — where the
 * next decode times begin — or null.
 */
export function cutBefore(queue: readonly Sample[], next: Sample, written: number | null): number | null {
  if (queue.length === 0 || next.type !== "delta") return null;
  const shown = queue.map((s) => s.timestamp).sort((a, b) => a - b);
  const step = queue.at(-1)!.duration;
  if (!(step > 0)) return null;
  const gap = (a: number, b: number) => b - a > step * 1.5 || b - a < step * 0.5;
  if (written !== null && gap(written, shown[0]!)) return null;
  for (let i = 1; i < shown.length; i++) if (gap(shown[i - 1]!, shown[i]!)) return null;
  const last = shown.at(-1)!;
  return next.timestamp > last ? last + step : null;
}

/**
 * Makes `output`'s MP4 muxer also end a video fragment inside a group of pictures, `minimum` seconds or more after the
 * fragment began, where `cutBefore` finds a place. Pinned to Mediabunny 1.62.1's muxer internals; with others the output
 * is left as it is.
 */
export function cutWithinGroups(output: Output, minimum: number) {
  const muxer = (output as unknown as { _muxer?: Partial<Muxer> })._muxer;
  if (!muxer || typeof muxer.registerSample !== "function" || typeof muxer.addSampleToTrack !== "function" || typeof muxer.processTimestamps !== "function") return;
  const m = muxer as Muxer;
  const register = m.registerSample;
  const add = m.addSampleToTrack;
  // Frames passed off as key frames for the muxer to end a fragment before them: delta frames again once placed.
  const posing = new WeakSet<Sample>();
  let written: number | null = null;
  let begun: number | null = null;
  m.registerSample = async function (trackData, sample) {
    if (trackData.type === "video") {
      const queue = trackData.timestampProcessingQueue;
      const from = sample.type === "delta" && begun !== null && sample.timestamp - begun >= minimum ? cutBefore(queue, sample, written) : null;
      if (from !== null) {
        written = from - queue.at(-1)!.duration;
        // The frames so far get their decode times now, as if their group ended here; the last one lasts until the next.
        this.processTimestamps(trackData, { type: "key", timestamp: from });
        sample.type = "key";
        posing.add(sample);
        begun = sample.timestamp;
      } else if (sample.type === "key") {
        if (queue.length) written = Math.max(...queue.map((s) => s.timestamp));
        begun = sample.timestamp;
      }
    }
    return register.call(this, trackData, sample);
  };
  m.addSampleToTrack = async function (trackData, sample) {
    // A real key frame always begins a fragment, however soon after a cut inside the group: played media is removed only
    // up to such a fragment's start.
    const own = this as Muxer & { minimumFragmentDuration: number };
    const keep = own.minimumFragmentDuration;
    if (trackData.type === "video" && sample.type === "key" && !posing.has(sample)) own.minimumFragmentDuration = 0;
    try {
      return await add.call(this, trackData, sample);
    } finally {
      own.minimumFragmentDuration = keep;
      if (posing.delete(sample)) sample.type = "delta";
    }
  };
}

/**
 * Whether a fragment (a chunk beginning with its "moof" box) begins with a key frame in every track: only there may
 * played media be removed up to it — a removal that ends inside a group of pictures takes the rest of the group with it.
 */
export function startsAtKeyFrame(data: Uint8Array): boolean {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const type = (at: number) => String.fromCharCode(data[at + 4]!, data[at + 5]!, data[at + 6]!, data[at + 7]!);
  if (data.byteLength < 8 || type(0) !== "moof") return false;
  const end = Math.min(view.getUint32(0), data.byteLength);
  let tracks = 0;
  for (let at = 8; at + 8 <= end; ) {
    const size = view.getUint32(at);
    if (size < 8) return false;
    if (type(at) === "traf") {
      let fallback: number | null = null;
      let first: number | null = null;
      for (let b = at + 8; b + 12 <= at + size; ) {
        const s = view.getUint32(b);
        if (s < 8) return false;
        const flags = view.getUint32(b + 8) & 0xffffff;
        if (type(b) === "tfhd") {
          // track_ID, then base_data_offset, sample_description_index, default duration and size, default flags.
          const f = b + 16 + (flags & 1 ? 8 : 0) + (flags & 2 ? 4 : 0) + (flags & 8 ? 4 : 0) + (flags & 0x10 ? 4 : 0);
          if (flags & 0x20 && f + 4 <= b + s) fallback = view.getUint32(f);
        } else if (type(b) === "trun") {
          // sample_count, data_offset, first_sample_flags, then per sample: duration, size, flags.
          const f = b + 16 + (flags & 1 ? 4 : 0);
          if (flags & 4) first = view.getUint32(f);
          else if (flags & 0x400 && f + 12 <= b + s) first = view.getUint32(f + (flags & 0x100 ? 4 : 0) + (flags & 0x200 ? 4 : 0));
        }
        b += s;
      }
      const flags = first ?? fallback;
      // sample_is_non_sync_sample.
      if (flags === null || (flags >> 16) & 1) return false;
      tracks++;
    }
    at += size;
  }
  return tracks > 0;
}
