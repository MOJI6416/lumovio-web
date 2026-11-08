import type {
  Conversion,
  Input,
  InputAudioTrack,
  InputVideoTrack,
  Output,
  StreamTargetChunk,
} from "mediabunny";
import { background, optional } from "../optional";
import { detectCapabilities, mediaSourceClass } from "./capabilities";
import { nameTrueHdTracks, enableWasmDecoders } from "./codecs/audio";
import { type AudioRoute, remuxAudioRoute, webCodecs } from "./playback-choice";

/**
 * In-browser remux for files the browser can't play as they are (TorrServer streams files
 * unchanged): Mediabunny reads the file over HTTP ranges, copies the video packets, copies the audio
 * when Media Source takes it as it is (AC-3 on Apple devices) or turns it into AAC (Opus where there's no
 * AAC encoder) with WebCodecs — AC-3/E-AC-3, DTS, TrueHD (and MP3, FLAC, Vorbis where WebCodecs can't) decoded by
 * WASM builds of FFmpeg's decoders, AAC encoded by one where WebCodecs has no encoder, each loaded only for a track
 * that needs it — and the fragmented MP4 goes into Media Source: the standard one, or ManagedMediaSource, the
 * only one an iPhone has. Only this module loads Mediabunny (~0.6 MB; a decoder 0.3–1.6 MB more).
 *
 * At most AHEAD seconds are prepared beyond the playhead and BEHIND seconds kept behind it (fewer for a heavy file,
 * `bufferWindow`), so a film never has to fit in memory. A seek outside what's buffered, or another audio track, starts
 * a new conversion from that time (Mediabunny begins at the keyframe before it; video stays copied).
 */

const AHEAD = 30;
const BEHIND = 30;
/**
 * What the buffer may hold of a file: Media Source refuses more than about 150 MB of video (Chrome). A 40 Mbit/s remux
 * is 5 MB a second, so 30 s ahead and 30 s behind didn't fit: appends were refused again and again, playback stopped
 * on a hole and nothing read on (an Arcane BDRemux on the stand, 2026-11-08).
 */
const BUFFER_BYTES = 90e6;
/** Seconds a playback that wants to play stands still before the engine starts again where it stands. */
const STUCK_SEC = 6;

/** Seconds prepared ahead of the playhead and kept behind it for a file of this many bytes a second (null: unknown). */
export function bufferWindow(bytesPerSecond: number | null): { ahead: number; behind: number } {
  if (!bytesPerSecond || !Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return { ahead: AHEAD, behind: BEHIND };
  const seconds = BUFFER_BYTES / bytesPerSecond;
  return { ahead: Math.round(Math.min(AHEAD, Math.max(8, seconds * 0.7))), behind: Math.round(Math.min(BEHIND, Math.max(3, seconds * 0.3))) };
}

export interface RemuxHandle {
  /** Position of the track among the file's audio tracks (ffprobe order = container order). */
  selectAudio(position: number): void;
  destroy(): void;
}

export interface RemuxOptions {
  url: string;
  /** Request headers for `url` (a TorrServer's sign-in, sent by the engine itself rather than the service worker). */
  headers?: Record<string, string>;
  /** Local Network Access for a server on this network (`net.ts`), as the other requests to it say. */
  targetAddressSpace?: "loopback" | "local";
  audioPosition: number;
  startAt: number;
  durationSec: number | null;
  onError: (message: string) => void;
  /** Aborted when the player goes away before the engine is up (React may mount an effect twice). */
  signal: AbortSignal;
  /** What the engine did, for the device check and "Playback info": the audio route and the Media Source used. */
  onRoute?: (info: { audio: AudioRoute; codec: string | null; mediaSource: "standard" | "managed"; mime: string }) => void;
}

let mediabunny: Promise<typeof import("mediabunny")> | null = null;
export const load = () => (mediabunny ??= import("mediabunny"));
let ac3: Promise<void> | null = null;
let dts: Promise<void> | null = null;
let aacEncoder: Promise<void> | null = null;
/** The AC-3/E-AC-3 and DTS decoders (WASM), only for a track that has to be decoded. */
const loadAc3 = () => (ac3 ??= import("@mediabunny/ac3").then((m) => m.registerAc3Decoder()));
const loadDts = () => (dts ??= import("@mediabunny/dts").then((m) => m.registerDtsDecoder()));
/** An AAC encoder in WASM, where WebCodecs has none (iPhones before iOS 26): only then. */
export const loadAacEncoder = () => (aacEncoder ??= import("@mediabunny/aac-encoder").then((m) => m.registerAacEncoder()));

/** Loads what decodes `track` here and encodes `route` (nothing for a copy). */
async function loadCoders(track: InputAudioTrack, codec: string | null, route: AudioRoute, channels: number) {
  if (route === "copy") return;
  if (codec === "ac3" || codec === "eac3") await loadAc3();
  else if (codec === "dts") await loadDts();
  else if (codec === "truehd" || codec === "mlp") enableWasmDecoders([], channels);
  // MP3, FLAC, Vorbis: WebCodecs decodes them in most browsers (checked with this track's own header), WASM elsewhere.
  else if ((codec === "mp3" || codec === "flac" || codec === "vorbis") && !(await track.canDecode())) enableWasmDecoders([codec], channels);
  if (route === "aac" && !(await webCodecs.encodes("aac"))) await loadAacEncoder();
}

const once = (target: EventTarget, type: string, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    target.addEventListener(type, () => resolve(), { once: true });
    signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
  });

/**
 * The MIME type as this Media Source accepts it: Mediabunny names HEVC "hev1" (its MP4 box is "hvc1", which Apple
 * devices want), and browsers differ on "flac"/"fLaC" and "opus"/"Opus".
 */
export function compatibleMime(type: string, supported: (t: string) => boolean): string {
  if (supported(type)) return type;
  const variants = [type.replace(/hev1\./g, "hvc1."), type.replace(/\bflac\b/g, "fLaC"), type.replace(/\bopus\b/g, "Opus"), type.replace(/hev1\./g, "hvc1.").replace(/\bflac\b/g, "fLaC").replace(/\bopus\b/g, "Opus")];
  return variants.find((t) => t !== type && supported(t)) ?? type;
}

type Mediabunny = typeof import("mediabunny");

/** One run of a rebuild, from a time to the end of the file. */
export interface RebuildJob {
  execute(): Promise<void>;
  cancel(): Promise<void>;
}

/**
 * What fills the engine: Mediabunny's conversion of a file it reads (MKV, MP4, MPEG-TS; `startRemux`), or an AVI decoded
 * in WASM and encoded to H.264 (`legacy.ts`). `run` prepares one run from `from` into an Output made by `newOutput`
 * (fragmented MP4 written into Media Source), or null when it was superseded meanwhile (`isCurrent`).
 */
export interface RebuildSource {
  duration: number | null;
  /** The file's bytes a second (its size over its duration), for `bufferWindow`; null when unknown. */
  bytesPerSecond?: number | null;
  audioCount: number;
  run(ctx: {
    from: number;
    audioPosition: number;
    isCurrent: () => boolean;
    newOutput: (route: AudioRoute, codec: string | null) => Output;
  }): Promise<RebuildJob | null>;
  dispose(): void;
}

export function startRemux(video: HTMLVideoElement, opts: RemuxOptions): Promise<RemuxHandle> {
  return startEngine(video, opts, (mb) => mediabunnySource(mb, opts));
}

/** Mediabunny reading the file by ranges: the video copied, the audio copied or converted. */
async function mediabunnySource(mb: Mediabunny, opts: RemuxOptions): Promise<RebuildSource> {
  const input: Input = new mb.Input({
    source: new mb.UrlSource(new URL(opts.url, location.href).href, {
      requestInit: { headers: opts.headers, credentials: "omit", cache: "no-store", ...(opts.targetAddressSpace ? { targetAddressSpace: opts.targetAddressSpace } : {}) } as RequestInit,
    }),
    formats: mb.ALL_FORMATS,
  });
  let videoTrack: InputVideoTrack | null;
  let audioTracks: InputAudioTrack[];
  let duration: number | null;
  try {
    videoTrack = await input.getPrimaryVideoTrack();
    audioTracks = await input.getAudioTracks();
    // TrueHD / MLP tracks get their codec's name, so they can be decoded (codecs/audio.ts).
    nameTrueHdTracks(audioTracks);
    duration = opts.durationSec ?? (await input.getDurationFromMetadata());
  } catch (e) {
    input.dispose();
    throw e;
  }
  const size = await optional(input.source.getSizeOrNull(), null);
  return {
    duration,
    bytesPerSecond: size && duration ? size / duration : null,
    audioCount: audioTracks.length,
    dispose: () => input.dispose(),
    async run({ from, audioPosition, isCurrent, newOutput }) {
      const track = audioTracks[audioPosition] ?? audioTracks[0] ?? null;
      const codec = (track?.codec as string | null | undefined) ?? null;
      const route = track ? await remuxAudioRoute(detectCapabilities(), codec) : "copy";
      if (!route) throw new Error(`can't rebuild audio ${codec ?? "unknown"} in this browser`);
      if (!isCurrent()) return null;
      // 5.1 where the encoder takes it; stereo for the WASM AAC encoder (a phone's CPU) and where it doesn't.
      const wasmAac = route === "aac" && !(await webCodecs.encodes("aac"));
      let channels = Math.min(6, track?.numberOfChannels ?? 2);
      if (wasmAac) channels = Math.min(2, channels);
      else if (track && route !== "copy" && channels > 2 && !(await mb.canEncodeAudio(route, { numberOfChannels: channels, sampleRate: route === "opus" ? 48000 : track.sampleRate })))
        channels = 2;
      if (track) await loadCoders(track, codec, route, channels);
      if (!isCurrent()) return null;
      const output = newOutput(route, codec);
      const c: Conversion = await mb.Conversion.init({
        input,
        output,
        showWarnings: false,
        video: (t) => (t === videoTrack ? {} : { discard: true }),
        // Copied when Media Source takes it as it is; anything else becomes AAC (or Opus).
        audio: (t) =>
          t !== track
            ? { discard: true }
            : route === "copy"
              ? {}
              : { codec: route, numberOfChannels: channels, quality: mb.QUALITY_HIGH, ...(route === "opus" ? { sampleRate: 48000 } : {}) },
        trim: from > 0 ? { start: from } : undefined,
      });
      if (!isCurrent()) {
        await optional(c.cancel(), undefined);
        return null;
      }
      if (!c.isValid) throw new Error(`can't rebuild this file in the browser (${c.discardedTracks.map((d) => d.reason).join(", ")})`);
      return { execute: () => c.execute(), cancel: () => c.cancel() };
    },
  };
}

/**
 * The engine: Media Source (the standard one, or ManagedMediaSource) on the player's <video>, filled by a source's runs
 * within AHEAD seconds of the playhead; a seek outside what's buffered or another audio track starts a new run there.
 */
export async function startEngine(video: HTMLVideoElement, opts: RemuxOptions, open: (mb: Mediabunny) => Promise<RebuildSource>): Promise<RemuxHandle> {
  const { signal } = opts;
  const mb = await load();
  signal.throwIfAborted();
  const MS = mediaSourceClass();
  if (!MS) throw new Error("no Media Source Extensions");
  const managed = typeof MediaSource === "undefined";
  const source = await open(mb);
  // Only the live start may touch the element: a cancelled one would take its source over.
  if (signal.aborted) {
    source.dispose();
    signal.throwIfAborted();
  }

  const ms = new MS();
  const objectUrl = URL.createObjectURL(ms);
  let sourceEl: HTMLSourceElement | null = null;
  const remoteWas = video.disableRemotePlayback;
  if (managed) {
    // ManagedMediaSource opens only with AirPlay off (or an AirPlay alternative), and from a <source> (as hls.js does).
    video.disableRemotePlayback = true;
    video.removeAttribute("src");
    sourceEl = document.createElement("source");
    sourceEl.type = "video/mp4";
    sourceEl.src = objectUrl;
    video.appendChild(sourceEl);
    video.load();
  } else video.src = objectUrl;
  try {
    await once(ms, "sourceopen", signal);
  } catch (e) {
    source.dispose();
    URL.revokeObjectURL(objectUrl);
    sourceEl?.remove();
    throw e;
  }
  const duration = source.duration;
  if (duration && Number.isFinite(duration)) ms.duration = duration;
  const win = bufferWindow(source.bytesPerSecond ?? null);

  let sb: SourceBuffer | null = null;
  let mime = "";
  let gen = 0;
  let job: RebuildJob | null = null;
  let audioPosition = opts.audioPosition;
  let seekTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  // The run whose media is in the buffer now: removals before its first append are the engine's own.
  let appended = -1;
  // A writer waits for room in a full buffer (the browser refused its append).
  let full = false;
  // Writers waiting for room are woken by playback progress, seeks and restarts.
  let wake: (() => void)[] = [];
  const nudge = () => {
    const w = wake;
    wake = [];
    for (const f of w) f();
  };
  // ManagedMediaSource says when it wants data ("streaming"); it is wanted again on a seek (WebKit bug 321919).
  const streaming = () => !managed || (ms as MediaSource & { streaming?: boolean }).streaming !== false || video.seeking;

  const idle = async () => {
    while (sb?.updating) await once(sb, "updateend");
  };
  const bufferedEnd = (t: number) => {
    const b = video.buffered;
    for (let i = 0; i < b.length; i++) if (t >= b.start(i) - 0.25 && t < b.end(i)) return b.end(i);
    return null;
  };
  const evictBehind = async (keep: number) => {
    const b = sb?.buffered;
    if (!sb || !b?.length || b.start(0) >= video.currentTime - keep) return;
    await idle();
    sb.remove(0, Math.max(0.1, video.currentTime - keep));
    await idle();
  };

  const append = async (data: Uint8Array<ArrayBuffer>, mine: number) => {
    for (let attempt = 0; ; attempt++) {
      await evictBehind(win.behind);
      if (mine !== gen || !sb) return;
      try {
        sb.appendBuffer(data);
        await idle();
        full = false;
        return;
      } catch (e) {
        // A full buffer frees up as playback moves on: drop more of what was played, then wait.
        if (!(e instanceof DOMException && e.name === "QuotaExceededError") || attempt > 20) throw e;
        full = true;
        await evictBehind(2);
        await new Promise<void>((r) => wake.push(r));
      }
    }
  };

  const waitForRoom = async (mine: number, from: number) => {
    for (;;) {
      if (mine !== gen) return;
      const at = Math.max(video.currentTime, from);
      const end = bufferedEnd(at);
      if (streaming() && (end === null || end - at < win.ahead)) return;
      await new Promise<void>((r) => wake.push(r));
    }
  };

  const writer = (mine: number, from: number, output: { getMimeType(): Promise<string> }, route: AudioRoute, codec: string | null) => {
    let first = true;
    return new WritableStream<StreamTargetChunk>({
      write: async (chunk) => {
        if (mine !== gen) return;
        const type = compatibleMime(await output.getMimeType(), (t) => MS.isTypeSupported(t));
        if (mine !== gen) return;
        if (!sb) {
          sb = ms.addSourceBuffer(type);
          mime = type;
          // A buffer ManagedMediaSource emptied itself (memory) where playback is about to go is prepared again.
          sb.addEventListener("bufferedchange", (e) => {
            if (closed || appended !== gen) return;
            const removed = (e as Event & { removedRanges?: TimeRanges }).removedRanges;
            const t = video.currentTime;
            for (let i = 0; removed && i < removed.length; i++)
              if (removed.end(i) > t && removed.start(i) < t + win.ahead) return void run(t);
          });
          opts.onRoute?.({ audio: route, codec, mediaSource: managed ? "managed" : "standard", mime: type });
        } else if (type !== mime && typeof sb.changeType === "function") {
          await idle();
          sb.changeType(type);
          mime = type;
          opts.onRoute?.({ audio: route, codec, mediaSource: managed ? "managed" : "standard", mime: type });
        }
        if (first) {
          first = false;
          await idle();
          sb.timestampOffset = from;
        }
        await waitForRoom(mine, from);
        await append(chunk.data, mine);
        if (mine === gen) appended = mine;
        // Start position: only once there's media there, or the seek would restart the conversion.
        if (mine === gen && video.currentTime < from - 0.5 && bufferedEnd(from) !== null)
          video.currentTime = from;
      },
    });
  };

  const restart = async (from: number) => {
    const mine = ++gen;
    full = false;
    nudge();
    const old = job;
    job = null;
    // Stopping the run being replaced: a failure to stop it changes nothing for the new one.
    await (old ? optional(old.cancel(), undefined) : undefined);
    if (mine !== gen || closed) return;
    if (sb) {
      await idle();
      if (ms.readyState === "open") sb.abort();
      if (sb.buffered.length) {
        sb.remove(0, Number.POSITIVE_INFINITY);
        await idle();
      }
    }
    if (mine !== gen || closed) return;
    const j = await source.run({
      from,
      audioPosition,
      isCurrent: () => mine === gen && !closed,
      newOutput: (route, codec) => {
        const output: Output = new mb.Output({
          format: new mb.Mp4OutputFormat({ fastStart: "fragmented", minimumFragmentDuration: 2 }),
          target: new mb.StreamTarget(writer(mine, from, { getMimeType: (): Promise<string> => output.getMimeType() }, route, codec)),
        });
        return output;
      },
    });
    if (!j) return;
    if (mine !== gen || closed) {
      await optional(j.cancel(), undefined);
      return;
    }
    job = j;
    await j.execute();
    if (mine !== gen || closed) return;
    await idle();
    if (ms.readyState === "open") ms.endOfStream();
  };

  const run = (from: number) =>
    restart(from).catch((e) => {
      if (closed || e instanceof mb.ConversionCanceledError) return;
      opts.onError((e as Error).message || String(e));
    });

  const onSeeking = () => {
    nudge();
    if (bufferedEnd(video.currentTime) !== null) return;
    // Scrubbing fires many seeks: start over once the target settles.
    clearTimeout(seekTimer);
    seekTimer = setTimeout(() => {
      if (!closed && bufferedEnd(video.currentTime) === null) void run(video.currentTime);
    }, 150);
  };
  video.addEventListener("seeking", onSeeking);
  video.addEventListener("timeupdate", nudge);
  video.addEventListener("play", nudge);
  ms.addEventListener("startstreaming", nudge);

  // Once a second a writer waiting for room looks again: a video that stands still sends no timeupdate to wake it.
  // A playback that wants to play and stands still for STUCK_SEC where it can't go on by itself — media ahead of the
  // playhead that it doesn't reach (a hole, or frames it lost), or a buffer too full to take what it waits for — starts
  // a new run there, as a seek outside the buffer does (at most once in 20 s). Waiting for the network has no media ahead.
  let lastAt = -1;
  let still = 0;
  let restartedAt = 0;
  const watch = setInterval(() => {
    nudge();
    const t = video.currentTime;
    const wants = !closed && appended === gen && !video.paused && !video.seeking && !video.ended && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
    still = wants && Math.abs(t - lastAt) < 0.01 ? still + 1 : 0;
    lastAt = t;
    const b = video.buffered;
    const ahead = b.length ? b.end(b.length - 1) - t : 0;
    if (still >= STUCK_SEC && (full || ahead > 1) && Date.now() - restartedAt > 20_000) {
      still = 0;
      restartedAt = Date.now();
      void run(t);
    }
  }, 1000);

  // Resume only well inside the file, as for a plain stream (a position saved for another, longer file may be past the end).
  void run(opts.startAt > 5 && (!duration || opts.startAt < duration - 10) ? opts.startAt : 0);

  return {
    selectAudio(position: number) {
      if (position === audioPosition || position < 0 || position >= source.audioCount) return;
      audioPosition = position;
      void run(video.currentTime);
    },
    destroy() {
      closed = true;
      gen++;
      nudge();
      clearTimeout(seekTimer);
      clearInterval(watch);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("timeupdate", nudge);
      video.removeEventListener("play", nudge);
      ms.removeEventListener("startstreaming", nudge);
      if (job) background(job.cancel());
      source.dispose();
      URL.revokeObjectURL(objectUrl);
      if (sourceEl) {
        sourceEl.remove();
        video.disableRemotePlayback = remoteWas;
      }
    },
  };
}
