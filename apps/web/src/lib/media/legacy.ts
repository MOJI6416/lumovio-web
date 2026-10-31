import type { AudioSample, VideoSample } from "mediabunny";
import { optional } from "../optional";
import { type AviFile, type AviStream, readAvi, startChunk } from "./avi";
import { detectCapabilities } from "./capabilities";
import { AUDIO_DECODER } from "./codecs/audio";
import { codecWorker } from "./codecs/worker";
import { type HttpSource, httpReader } from "./http-range";
import { type AudioRoute, webCodecs } from "./playback-choice";
import {
  loadAacEncoder,
  type RebuildSource,
  type RemuxHandle,
  type RemuxOptions,
  startEngine,
} from "./remux";

/*
 * Old releases in AVI — Xvid/DivX (MPEG-4 Part 2), DivX 3, MPEG-2, with MP3, MP2 or AC-3 audio — played in the browser
 * (player document, P5): the AVI read by ranges (`avi.ts`), its video decoded in WebAssembly (FFmpeg's decoders,
 * public/codecs/video.*) and encoded to H.264 by the browser's own encoder (WebCodecs, in hardware where there is one),
 * the audio decoded in WebAssembly and encoded to AAC (Opus in Firefox), all of it into the same Media Source engine as
 * the rebuild (`remux.ts`). Only for standard definition, and only on a device that decodes it at least 1.2× faster than
 * real time (`probeLegacy`, measured before playing); anything else goes to another app or the server. Loaded only
 * for such a file.
 */

/** ffprobe's names of the video codecs here, and their decoder in public/codecs/video.wasm. */
export const LEGACY_VIDEO: Record<string, number> = {
  mpeg4: 0,
  msmpeg4v3: 1,
  msmpeg4v2: 2,
  msmpeg4v1: 3,
  mpeg2video: 4,
  mpeg1video: 5,
  h263: 6,
};
/** AVI's FourCCs of the same codecs. */
const FOURCC: [RegExp, number][] = [
  [
    /^(xvid|divx|dx50|fmp4|mp4v|xvix|3iv2|3ivx|blz0|dxgm|m4s2|mp4s|rmp4|sedg|wv1f|ump4|smp4|dm4v|geox|hdx4|lmp4|nds |ndx |pvmm|xvid)$/i,
    0,
  ],
  [/^(div3|mp43|div4|div5|div6|ap41|col1|mpg3|3ivd|dvx3)$/i, 1],
  [/^(mp42|div2)$/i, 2],
  [/^(mpg4|mp41|div1)$/i, 3],
  [/^(mpg2|mp2v|mpeg|mmes|em2v|lmp2|slif|hdv[1-9a]|mx[3-5][np])$/i, 4],
  [/^(mpg1|pim1|mp1v|vcr2)$/i, 5],
  [/^(h263|u263|s263|x263|i263|m263|l263|viv1|t263)$/i, 6],
];
/** AVI audio format tags: MP3 (0x55), MP2 (0x50), AC-3 (0x2000), PCM (1). */
const AUDIO_TAG: Record<number, "mp3" | "mp2" | "ac3" | "pcm"> = {
  85: "mp3",
  80: "mp2",
  8192: "ac3",
  1: "pcm",
};
/** Standard definition (DVD PAL at most): beyond it, WASM decoding isn't for phones. */
export const LEGACY_MAX = { width: 1024, height: 576 };
/** Decoding speed needed, × real time. */
const MIN_SPEED = 1.2;

const videoCall = codecWorker("/codecs/video-worker.js");
const audioCall = codecWorker("/codecs/audio-worker.js");

type Picture = { data: ArrayBuffer; width: number; height: number; pts: number };

const files = new Map<string, Promise<AviFile>>();
/** The file's index, read once per page (the speed probe and the engine share it). */
function aviOf(src: HttpSource): Promise<AviFile> {
  let f = files.get(src.url);
  if (!f) {
    f = readAvi(httpReader(src, new AbortController().signal), null);
    f.catch(() => files.delete(src.url));
    files.set(src.url, f);
  }
  return f;
}

const fourccOf = (s: AviStream) => FOURCC.find(([re]) => re.test(s.fourcc))?.[1];
const tagOf = (fourcc: string) =>
  fourcc.charCodeAt(0) |
  (fourcc.charCodeAt(1) << 8) |
  (fourcc.charCodeAt(2) << 16) |
  (fourcc.charCodeAt(3) << 24);

export type LegacyProbe =
  | { ok: true; speed: number; width: number; height: number }
  | { ok: false; reason: string; speed?: number };

/**
 * Can this device play the AVI here: a video codec of the WASM decoder, standard definition, an H.264 encoder at that
 * size, and decoding at least 1.2× faster than real time — measured on the file's first two seconds (`reason` in the
 * engines' words otherwise: "video mpeg4 1280×720", "slow device").
 */
export async function probeLegacy(src: HttpSource): Promise<LegacyProbe> {
  const file = await aviOf(src);
  const v = file.streams.find((s) => s.type === "vids");
  if (!v) return { ok: false, reason: "video unknown" };
  const codec = fourccOf(v);
  if (codec === undefined) return { ok: false, reason: `video ${v.fourcc.trim() || "unknown"}` };
  if (v.width > LEGACY_MAX.width || v.height > LEGACY_MAX.height)
    return { ok: false, reason: `video ${v.fourcc} ${v.width}×${v.height}` };
  if (typeof VideoEncoder === "undefined") return { ok: false, reason: "no video encoder" };
  const support = await optional(
    VideoEncoder.isConfigSupported({
      codec: "avc1.4d401f",
      width: v.width & ~1,
      height: v.height & ~1,
      bitrate: 2_000_000,
      framerate: 1 / v.frameTime,
    }),
    { supported: false },
  );
  if (!support.supported) return { ok: false, reason: "no video encoder" };
  // Two seconds of pictures from the start, timed in the decoder itself (the network doesn't count).
  const read = httpReader(src, new AbortController().signal);
  const chunks = file.chunks
    .filter((c) => c.stream === v.index && c.size > 0)
    .slice(0, Math.max(24, Math.round(2 / v.frameTime)));
  if (!chunks.length) return { ok: false, reason: "video unknown" };
  const first = chunks[0]!;
  const last = chunks[chunks.length - 1]!;
  const bytes = await read(first.offset, last.offset + last.size);
  const { ctx } = await videoCall<{ ctx: number }>("init", {
    codec,
    width: v.width,
    height: v.height,
    tag: tagOf(v.fourcc),
    extradata: v.extradata?.slice().buffer ?? null,
  });
  let ms = 0;
  let pictures = 0;
  try {
    for (const [i, c] of chunks.entries()) {
      const data = bytes.slice(c.offset - first.offset, c.offset - first.offset + c.size).buffer;
      const r = await videoCall<{ frames: Picture[]; ms: number }>("decode", { ctx, data, pts: i }, [data]);
      ms += r.ms;
      pictures += r.frames.length;
    }
  } finally {
    await optional(videoCall("close", { ctx }), undefined);
  }
  const speed = pictures && ms ? (pictures * v.frameTime) / (ms / 1000) : 0;
  return speed >= MIN_SPEED
    ? { ok: true, speed, width: v.width, height: v.height }
    : { ok: false, reason: "slow device", speed };
}

/** The AVI engine: `startEngine` filled by AVI chunks decoded here. */
export function startLegacy(video: HTMLVideoElement, opts: RemuxOptions): Promise<RemuxHandle> {
  const src: HttpSource = {
    url: opts.url,
    headers: opts.headers ?? {},
    targetAddressSpace: opts.targetAddressSpace,
  };
  return startEngine(video, opts, async (mb) => {
    const file = await aviOf(src);
    const v = file.streams.find((s) => s.type === "vids");
    const vCodec = v ? fourccOf(v) : undefined;
    if (!v || vCodec === undefined)
      throw new Error(`can't decode video ${v?.fourcc ?? "unknown"} in the browser`);
    const audios = file.streams.filter((s) => s.type === "auds");
    const read = httpReader(src, opts.signal);
    const source: RebuildSource = {
      duration: opts.durationSec ?? file.duration,
      audioCount: audios.length,
      dispose: () => undefined,
      async run({ from, audioPosition, isCurrent, newOutput }) {
        const a = audios[audioPosition] ?? audios[0] ?? null;
        const aCodec = a ? AUDIO_TAG[a.formatTag] : undefined;
        const caps = detectCapabilities();
        const aacHere = caps.mseAudio.aac && (await webCodecs.encodes("aac"));
        const route: AudioRoute = aacHere
          ? "aac"
          : caps.mseAudio.opus && (await webCodecs.encodes("opus"))
            ? "opus"
            : "aac";
        if (route === "aac" && !aacHere) await loadAacEncoder();
        if (!isCurrent()) return null;
        const output = newOutput(route, aCodec ?? null);
        const fps = 1 / v.frameTime;
        const videoSource = new mb.VideoSampleSource({
          codec: "avc",
          bitrate: mb.QUALITY_HIGH,
          keyFrameInterval: 2,
          sizeChangeBehavior: "passThrough",
        });
        output.addVideoTrack(videoSource, { frameRate: fps });
        const audioSource =
          a && aCodec ? new mb.AudioSampleSource({ codec: route, bitrate: mb.QUALITY_HIGH }) : null;
        if (audioSource) output.addAudioTrack(audioSource);
        let cancelled = false;
        const execute = async () => {
          await output.start();
          const { ctx: vctx } = await videoCall<{ ctx: number }>("init", {
            codec: vCodec,
            width: v.width,
            height: v.height,
            tag: tagOf(v.fourcc),
            extradata: v.extradata?.slice().buffer ?? null,
          });
          // PCM is taken as it is; the rest has a WASM decoder of the audio worker.
          const actx =
            a && aCodec && aCodec !== "pcm"
              ? (
                  await audioCall<{ ctx: number }>("init", {
                    codec: AUDIO_DECODER[aCodec],
                    maxChannels: 0,
                    channels: a.channels,
                    sampleRate: a.sampleRate,
                    extradata: null,
                  })
                ).ctx
              : 0;
          // Pictures come out in display order; their numbers say when. One that would go back in time (DivX's packed
          // B-frames, a skipped frame's placeholder) is left out: H.264 needs each later than the last.
          let last = -1;
          const addPictures = async (pictures: Picture[]) => {
            for (const p of pictures) {
              const t = p.pts * v.frameTime - from;
              if (t < -1e-3 || t <= last + 1e-6) continue;
              last = t;
              const sample: VideoSample = new mb.VideoSample(new Uint8Array(p.data), {
                format: "I420",
                codedWidth: p.width,
                codedHeight: p.height,
                timestamp: Math.max(0, t),
                duration: v.frameTime,
              });
              try {
                await videoSource.add(sample);
              } finally {
                sample.close();
              }
            }
          };
          // The audio's own clock: the parser returns whole frames, a little after the chunk they began in, so after the
          // first one each block follows the one before it.
          let clock: number | null = null;
          const addAudio = async (pcm: Float32Array, channels: number, sampleRate: number, time: number) => {
            let data = pcm;
            const at = clock ?? time;
            clock = at + pcm.length / channels / sampleRate;
            let t = at - from;
            // A chunk that starts before the run's start loses its first samples.
            if (t < 0) {
              const skip = Math.round(-t * sampleRate) * channels;
              if (skip >= data.length) return;
              data = data.subarray(skip);
              t = 0;
            }
            const sample: AudioSample = new mb.AudioSample({
              data,
              format: "f32",
              numberOfChannels: channels,
              sampleRate,
              timestamp: t,
            });
            try {
              await audioSource!.add(sample);
            } finally {
              sample.close();
            }
          };
          try {
            const i0 = startChunk(file, v.index, from);
            const keyTime = file.chunks[i0]?.time ?? 0;
            const wanted = file.chunks
              .slice(i0)
              .filter(
                (c) =>
                  c.size > 0 &&
                  (c.stream === v.index || (a && c.stream === a.index && c.time >= keyTime - 0.05)),
              );
            for (let k = 0; k < wanted.length && !cancelled && isCurrent(); ) {
              // Contiguous chunks in reads of about 1 MB: the file in order, as a download would read it.
              let end = k;
              while (
                end + 1 < wanted.length &&
                wanted[end + 1]!.offset + wanted[end + 1]!.size - wanted[k]!.offset < 1 << 20
              )
                end++;
              const base = wanted[k]!.offset;
              const bytes = await read(base, wanted[end]!.offset + wanted[end]!.size);
              for (; k <= end && !cancelled && isCurrent(); k++) {
                const c = wanted[k]!;
                const data = bytes.slice(c.offset - base, c.offset - base + c.size).buffer;
                if (c.stream === v.index) {
                  const r = await videoCall<{ frames: Picture[] }>(
                    "decode",
                    { ctx: vctx, data, pts: Math.round(c.time / v.frameTime) },
                    [data],
                  );
                  await addPictures(r.frames);
                } else if (audioSource && a) {
                  if (aCodec === "pcm") {
                    const s16 = new Int16Array(data);
                    const f = new Float32Array(s16.length);
                    for (let i = 0; i < s16.length; i++) f[i] = s16[i]! / 32768;
                    await addAudio(f, a.channels, a.sampleRate, c.time);
                  } else {
                    const r = await audioCall<{
                      samples: number;
                      channels?: number;
                      sampleRate?: number;
                      pcm?: ArrayBuffer;
                    }>("decode", { ctx: actx, data }, [data]);
                    if (r.samples && r.pcm && r.channels && r.sampleRate)
                      await addAudio(new Float32Array(r.pcm), r.channels, r.sampleRate, c.time);
                  }
                }
              }
            }
            if (cancelled || !isCurrent()) return;
            const rest = await videoCall<{ frames: Picture[] }>("flush", { ctx: vctx });
            await addPictures(rest.frames);
            videoSource.close();
            audioSource?.close();
            await output.finalize();
          } finally {
            await optional(videoCall("close", { ctx: vctx }), undefined);
            if (actx) await optional(audioCall("close", { ctx: actx }), undefined);
          }
        };
        return {
          // A run that was replaced (a seek, another track) ends with its output cancelled under it: that's no failure.
          execute: () =>
            execute().catch((e: unknown) => {
              if (cancelled || !isCurrent()) return;
              throw e;
            }),
          async cancel() {
            cancelled = true;
            await optional(output.cancel(), undefined);
          },
        };
      },
    };
    return source;
  });
}
