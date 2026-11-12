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
import { cutWithinGroups, startsAtKeyFrame } from "./codecs/fragments";
import { keyAtRecoveryPoints } from "./codecs/h264";
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
 * At most AHEAD seconds are prepared beyond the playhead and BEHIND seconds kept behind it, so a
 * film never has to fit in memory. A seek outside what's buffered, or another audio track, starts a
 * new conversion from that time (Mediabunny begins at the keyframe before it; video stays copied).
 */

const AHEAD = 30;
const BEHIND = 30;
/**
 * The most one append gives Media Source: an iPhone's ManagedMediaSource refuses a whole fragment of a high-bitrate film
 * (8.4 MB of a 20 GB Blu-ray rip) even into an empty buffer, QuotaExceededError, and takes the same bytes in slices
 * (iOS 27.2). A fragment split across appends is fine: the buffer parses a stream.
 */
const SLICE = 1 << 20;
/**
 * The MP4 a rebuild writes: fragments of a second or more, each ending at a key frame or, inside a long group of pictures,
 * where every frame shown before is written (`cutWithinGroups`). The first fragment is what the first frame waits for —
 * 6 MB of a 44 Mbit/s film at one second, 10 MB at two; a whole group of a file with key frames 10 s apart was up to 20 MB.
 */
export const FRAGMENTED = { fastStart: "fragmented", minimumFragmentDuration: 1 } as const;
/** A playhead stopped this long with media buffered past it is stuck: Media Source doesn't cross a hole on its own. */
const STUCK_MS = 1500;

/**
 * What gets a stopped playhead moving when media lies buffered past it (`ranges`: the buffered stretches, in order). A
 * hole of up to a second just ahead is stepped over, to where the media goes on; a longer hole, or a playhead stopped
 * inside buffered media, starts the rebuild again from there — 2 s further on when it already restarted at that place,
 * so a spot the rebuild keeps leaving out is passed. Null when nothing is buffered past the playhead: it waits for media
 * still to come.
 */
export function unstick(
  at: number,
  ranges: readonly (readonly [number, number])[],
  restartedAt: number | null,
): { jump: number } | { restart: number } | null {
  const inside = ranges.find(([start, end]) => at >= start && at < end);
  const next = ranges.find(([start]) => start > at)?.[0];
  const restart = { restart: restartedAt !== null && Math.abs(restartedAt - at) < 1 ? at + 2 : at };
  if (inside && inside[1] - at > 0.5) return restart;
  if (next === undefined) return null;
  return next - at <= 1 ? { jump: next + 0.01 } : restart;
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

type FileSource = Pick<RemuxOptions, "url" | "headers" | "targetAddressSpace">;
interface Opened {
  input: Input;
  videoTrack: InputVideoTrack | null;
  audioTracks: InputAudioTrack[];
}

/** The file opened for reading by ranges, its tracks read (the head and, for Matroska, the index at the end). */
async function openFile(mb: Mediabunny, src: FileSource): Promise<Opened> {
  const input: Input = new mb.Input({
    source: new mb.UrlSource(new URL(src.url, location.href).href, {
      requestInit: { headers: src.headers, credentials: "omit", cache: "no-store", ...(src.targetAddressSpace ? { targetAddressSpace: src.targetAddressSpace } : {}) } as RequestInit,
    }),
    formats: mb.ALL_FORMATS,
  });
  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    // A Blu-ray's H.264 is cut and started at its every-second I-frames, not only at IDR frames half a minute apart.
    if (videoTrack) keyAtRecoveryPoints(videoTrack);
    const audioTracks = await input.getAudioTracks();
    // TrueHD / MLP tracks get their codec's name, so they can be decoded (codecs/audio.ts).
    nameTrueHdTracks(audioTracks);
    return { input, videoTrack, audioTracks };
  } catch (e) {
    input.dispose();
    throw e;
  }
}

/** Files opened before their player asked (`preopen`), by address. */
const opened = new Map<string, Promise<Opened>>();

/**
 * Starts reading a file that will be rebuilt, while the rest of its preparation (TorrServer's probe) still runs: the
 * player's rebuild then takes it as it is. One its player doesn't take within a minute is let go.
 */
export function preopen(src: FileSource) {
  const href = new URL(src.url, location.href).href;
  if (opened.has(href)) return;
  const p = load().then((mb) => openFile(mb, src));
  opened.set(href, p);
  p.catch(() => opened.get(href) === p && opened.delete(href));
  setTimeout(() => {
    if (opened.get(href) !== p) return;
    opened.delete(href);
    p.then((o) => o.input.dispose(), () => undefined);
  }, 60_000);
}

/**
 * Where the clock of these tracks starts: 0 in most files, seconds or hours in MPEG-TS and Blu-ray streams. A run from
 * the start is moved to 0 by Mediabunny itself; a run from the middle has to ask for its place on the file's clock, or
 * every seek and resume lands that much early — and one to before the clock's start never gets its picture.
 */
export const fileStart = async (input: Input, tracks: (InputVideoTrack | InputAudioTrack | null)[]) =>
  Math.max(0, await optional(input.getFirstTimestamp(tracks.filter((t) => t !== null)), 0));

/** Mediabunny reading the file by ranges: the video copied, the audio copied or converted. */
async function mediabunnySource(mb: Mediabunny, opts: RemuxOptions): Promise<RebuildSource> {
  const href = new URL(opts.url, location.href).href;
  const early = opened.get(href);
  opened.delete(href);
  const { input, videoTrack, audioTracks } = (early ? await optional(early, null) : null) ?? (await openFile(mb, opts));
  let duration: number | null;
  try {
    duration = opts.durationSec ?? (await input.getDurationFromMetadata());
  } catch (e) {
    input.dispose();
    throw e;
  }
  const starts = new Map<InputAudioTrack | null, Promise<number>>();
  return {
    duration,
    audioCount: audioTracks.length,
    dispose: () => input.dispose(),
    async run({ from, audioPosition, isCurrent, newOutput }) {
      const track = audioTracks[audioPosition] ?? audioTracks[0] ?? null;
      const codec = (track?.codec as string | null | undefined) ?? null;
      // Read alongside the coders: a run from the middle is asked for on the file's own clock.
      let start = from > 0 ? starts.get(track) : undefined;
      if (from > 0 && !start) {
        start = fileStart(input, [videoTrack, track]);
        starts.set(track, start);
      }
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
        trim: start ? { start: (await start) + from } : undefined,
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

  let sb: SourceBuffer | null = null;
  let mime = "";
  let gen = 0;
  let job: RebuildJob | null = null;
  let audioPosition = opts.audioPosition;
  let seekTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  // The run whose media is in the buffer now: removals before its first append are the engine's own.
  let appended = -1;
  // Where the newest run starts: until its writer puts the playhead there, the playhead isn't stuck, only early.
  let runFrom = 0;
  // Where the fragments in the buffer begin (key frames), oldest first: what `evictBehind` may remove up to.
  let cuts: number[] = [];
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
  /**
   * Drops what was played, all but `keep` seconds — only up to where a fragment begins, a key frame. A removal that ends
   * inside a group of pictures takes the rest of the group with it: with key frames 10 s apart, "all but the last 2 s"
   * removed the frames under the playhead too.
   */
  const evictBehind = async (keep: number, mine: number) => {
    const limit = video.currentTime - keep;
    let cut = -1;
    for (const c of cuts) if (c <= limit && c > cut) cut = c;
    if (cut < 0) return;
    cuts = cuts.filter((c) => c > cut);
    if (!sb?.buffered.length || sb.buffered.start(0) >= cut) return;
    await idle();
    if (mine !== gen || !sb) return;
    sb.remove(0, cut);
    await idle();
  };

  /** Whether the video has something to play from where it is: then playback moving on frees room in a full buffer. */
  const playable = () => {
    const end = bufferedEnd(video.currentTime);
    return end !== null && end - video.currentTime > 0.5;
  };
  const appendSlice = async (data: Uint8Array<ArrayBuffer>, mine: number) => {
    // Tries that had nothing to wait for: only they end in an error.
    for (let stuck = 0; ; ) {
      await evictBehind(BEHIND, mine);
      if (mine !== gen || !sb) return;
      try {
        sb.appendBuffer(data);
        await idle();
        return;
      } catch (e) {
        // A full buffer frees up as playback moves on: drop more of what was played, then wait for it — however long
        // (a pause, steps back and forth inside what's buffered). With nothing to play, nothing moves on: a moment,
        // then the next try, and an error in the end rather than loading for ever.
        if (!(e instanceof DOMException && e.name === "QuotaExceededError") || stuck > 20) throw e;
        await evictBehind(2, mine);
        const waits = playable();
        if (!waits) stuck++;
        await new Promise<void>((r) => {
          wake.push(r);
          if (!waits) setTimeout(r, 500);
        });
      }
    }
  };
  const append = async (data: Uint8Array<ArrayBuffer>, mine: number) => {
    // A chunk that starts with "moof" is a fragment: where the buffer ends before it is where the fragment begins — a
    // place to remove played media up to only when the fragment begins with a key frame.
    const before = sb?.buffered;
    if (before?.length && startsAtKeyFrame(data)) cuts.push(before.end(before.length - 1));
    for (let at = 0; at < data.byteLength; at += SLICE) {
      await appendSlice(data.subarray(at, at + SLICE), mine);
      if (mine !== gen || !sb) return;
    }
  };

  const waitForRoom = async (mine: number, from: number) => {
    for (;;) {
      if (mine !== gen) return;
      const at = Math.max(video.currentTime, from);
      const end = bufferedEnd(at);
      if (streaming() && (end === null || end - at < AHEAD)) return;
      await new Promise<void>((r) => wake.push(r));
    }
  };

  const writer = (mine: number, from: number, output: { getMimeType(): Promise<string> }, route: AudioRoute, codec: string | null) => {
    let first = true;
    let placed = false;
    // Resolved when this run is replaced or the engine goes: the output's type is known only with a first packet of
    // every track, and a run stopped before that would wait for it for ever — and keep its own stopping waiting.
    const replaced = new Promise<null>((resolve) => {
      const check = () => (mine !== gen ? resolve(null) : void wake.push(check));
      check();
    });
    return new WritableStream<StreamTargetChunk>({
      write: async (chunk) => {
        if (mine !== gen) return;
        const named = await Promise.race([output.getMimeType(), replaced]);
        if (named === null || mine !== gen) return;
        const type = compatibleMime(named, (t) => MS.isTypeSupported(t));
        if (!sb) {
          sb = ms.addSourceBuffer(type);
          mime = type;
          // A buffer ManagedMediaSource emptied itself (memory) where playback is about to go is prepared again.
          sb.addEventListener("bufferedchange", (e) => {
            if (closed || appended !== gen) return;
            const removed = (e as Event & { removedRanges?: TimeRanges }).removedRanges;
            const t = video.currentTime;
            for (let i = 0; removed && i < removed.length; i++)
              if (removed.end(i) > t && removed.start(i) < t + AHEAD) return void run(t);
          });
          opts.onRoute?.({ audio: route, codec, mediaSource: managed ? "managed" : "standard", mime: type });
        } else if (type !== mime && typeof sb.changeType === "function") {
          await idle();
          if (mine !== gen) return;
          sb.changeType(type);
          mime = type;
          opts.onRoute?.({ audio: route, codec, mediaSource: managed ? "managed" : "standard", mime: type });
        }
        if (first) {
          await idle();
          if (mine !== gen) return;
          first = false;
          sb.timestampOffset = from;
        }
        await waitForRoom(mine, from);
        await append(chunk.data, mine);
        if (mine === gen) appended = mine;
        // Start position: only once there's media there, or the seek would restart the conversion. Once: a step back
        // from there while the run still fills is the viewer's, not to be undone by the next fragment.
        if (mine === gen && !placed && bufferedEnd(from) !== null) {
          placed = true;
          if (video.currentTime < from - 0.5) video.currentTime = from;
        }
      },
    });
  };

  const restart = async (from: number) => {
    const mine = ++gen;
    runFrom = from;
    nudge();
    const old = job;
    job = null;
    // Stopping the run being replaced: a failure to stop it changes nothing for the new one.
    await (old ? optional(old.cancel(), undefined) : undefined);
    if (mine !== gen || closed) return;
    if (sb) {
      await idle();
      // Only the newest run touches the buffer: two that woke on one event would abort each other's removal.
      if (mine !== gen || closed) return;
      if (ms.readyState === "open") sb.abort();
      cuts = [];
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
          format: new mb.Mp4OutputFormat(FRAGMENTED),
          target: new mb.StreamTarget(writer(mine, from, { getMimeType: (): Promise<string> => output.getMimeType() }, route, codec)),
        });
        cutWithinGroups(output, FRAGMENTED.minimumFragmentDuration);
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

  const run = (from: number) => {
    const mine = gen + 1;
    return restart(from).catch((e) => {
      // A run already replaced fails for itself: its read was cut off, or it never got to start. Once the element itself
      // failed (Media Source refused what was appended), the next append fails only because of that: the player reports
      // the element's failure, with its code and words.
      if (closed || mine !== gen || e instanceof mb.ConversionCanceledError || video.error) return;
      opts.onError((e as Error).message || String(e));
    });
  };

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

  // A playhead that stops with media buffered past it (a hole in the buffer, frames the decoder can't get past) would
  // wait for ever: the writer counts that media as the lead and reads nothing more, so the server's speed falls to 0
  // under the loader. After a moment it is moved on (`unstick`).
  let still = { at: -1, since: 0 };
  let restartedAt: number | null = null;
  const watch = setInterval(() => {
    const t = video.currentTime;
    if (closed || video.paused || video.seeking || video.ended || video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA || t !== still.at || t < runFrom - 0.5) {
      still = { at: t, since: Date.now() };
      return;
    }
    if (Date.now() - still.since < STUCK_MS) return;
    still = { at: -1, since: 0 };
    const b = video.buffered;
    const step = unstick(t, Array.from({ length: b.length }, (_, i) => [b.start(i), b.end(i)] as const), restartedAt);
    if (!step) return;
    if ("jump" in step) video.currentTime = step.jump;
    else {
      restartedAt = step.restart;
      void run(step.restart);
    }
  }, 250);

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
