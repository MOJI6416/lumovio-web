import { background, optional } from "../../optional";
import { type HttpSource, httpFile, httpReader } from "../http-range";
import {
  decompress,
  MatroskaError,
  type MkvBlock,
  type MkvCue,
  type MkvIndex,
  type MkvTrack,
  type RangeReader,
  readAttachment,
  readAttachments,
  readClusterSubtitles,
  readCueBlock,
  readMatroskaIndex,
} from "./matroska";
import { Mp4Error, type Mp4Sample, type Mp4TextTrack, readMp4TextTracks, tx3gText } from "./mp4";
import { type PgsBitmap, PgsDecoder, type PgsFrame } from "./pgs";
import { placeBitmaps, restyleAss } from "./style";
import {
  assBlockText,
  assHeader,
  assToCueText,
  decodeText,
  type ExternalFormat,
  parseExternal,
  srtToCueText,
  type TextCue,
} from "./text";
import { onSubtitleView, type SubtitleView, shiftCue, subtitleView } from "./view";
import { parseIdx, type VobSubHeader, vobSubFrames } from "./vobsub";

/*
 * Subtitles the browser doesn't show by itself: a Matroska file's own tracks (SRT, WebVTT, ASS/SSA, PGS,
 * VobSub), an MP4 file's text tracks (tx3g) and the subtitle files its torrent carries. Each one is a text track of the
 * player's <video> — so the player's menu, the C key and the native fullscreen of an iPhone see them — and whichever
 * is shown is fetched and drawn: text as the browser's own cues; ASS with libass (JASSUB, loaded only then), as plain
 * text when it can't load; PGS and VobSub as pictures on a canvas over the video. A Matroska track is read cue by cue,
 * an MP4 one sample by sample, only around the playhead (`matroska.ts`, `mp4.ts`). Every renderer follows the video's
 * subtitle view (`view.ts`): the timing offset of this viewing and the profile's look. Loaded by the player only for a
 * playback that has such subtitles.
 */

export type SubtitleFormat = "srt" | "vtt" | "ass" | "pgs" | "vobsub" | "tx3g";

export interface SubtitleTrackInfo {
  track: TextTrack;
  /** The file's own name for it ("Forced", "SDH", "HDrezka"), or null. */
  name: string | null;
  lang: string | null;
  forced: boolean;
  isDefault: boolean;
  format: SubtitleFormat;
  origin: "embedded" | "file";
  /** How it is drawn once shown: the browser's own cues, libass, ASS as plain cues (libass didn't load), a canvas. */
  renderer?: "native" | "libass" | "text" | "canvas";
}

interface ExternalSubtitleFile {
  path: string;
  format: ExternalFormat;
  lang: string | null;
  forced: boolean;
  label: string | null;
  fetch: () => Promise<Uint8Array>;
}

export interface SubtitleEngineOptions {
  video: HTMLVideoElement;
  /** The video file, read by ranges for its own tracks (Matroska only). */
  file?: HttpSource | null;
  /** Subtitle files next to it (same sign-in as `file`). */
  files?: {
    path: string;
    format: ExternalFormat;
    lang: string | null;
    forced: boolean;
    label: string | null;
    url: string;
  }[];
  headers?: Record<string, string>;
  targetAddressSpace?: "loopback" | "local";
  signal: AbortSignal;
  /** The tracks found (empty when none), once. */
  onTracks: (tracks: SubtitleTrackInfo[]) => void;
}

/** How far ahead of the playhead a Matroska track is read, and how far behind it is kept (s). */
const AHEAD = 30;
/** Ahead by whole clusters (their video too): less. */
const CLUSTER_AHEAD = 15;
/** Clusters already read, per file: any of its subtitle tracks takes its lines from there. */
const clusterBlocks = new WeakMap<MkvIndex, Map<number, Promise<MkvBlock[]>>>();
const clusterCache = (index: MkvIndex) => {
  let m = clusterBlocks.get(index);
  if (!m) {
    m = new Map();
    clusterBlocks.set(index, m);
  }
  return m;
};
const BEHIND = 5;
/** A short fingerprint of a block's bytes (FNV-1a), to know a line already shown. */
function fnv(data: Uint8Array): number {
  let h = 0x811c9dc5;
  for (const x of data) h = Math.imul(h ^ x, 0x01000193);
  return h >>> 0;
}
const FORCED_NAME = /forced|форс|надпис/i;

const CODEC: Record<string, SubtitleFormat> = {
  "S_TEXT/UTF8": "srt",
  "S_TEXT/ASCII": "srt",
  "S_TEXT/WEBVTT": "vtt",
  "S_TEXT/ASS": "ass",
  "S_TEXT/SSA": "ass",
  "S_HDMV/PGS": "pgs",
  S_VOBSUB: "vobsub",
};

/** What the file is, by its first bytes: Matroska's EBML header, or an MP4 box. */
async function sniff(read: RangeReader): Promise<"matroska" | "mp4" | null> {
  const b = await read(0, 12);
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "matroska";
  const box = b.length >= 8 ? String.fromCharCode(b[4]!, b[5]!, b[6]!, b[7]!) : "";
  return /^(ftyp|moov|mdat|free|skip|wide)$/.test(box) ? "mp4" : null;
}

/** A video's text tracks made by an engine, kept for the next one on the same element (React mounts effects twice). */
const madeFor = new WeakMap<HTMLVideoElement, Map<string, TextTrack>>();

function textTrack(video: HTMLVideoElement, key: string, label: string, lang: string): TextTrack {
  let made = madeFor.get(video);
  if (!made) {
    made = new Map();
    madeFor.set(video, made);
  }
  const known = made.get(key);
  if (known) return known;
  const t = video.addTextTrack("subtitles", label, lang);
  t.mode = "disabled";
  made.set(key, t);
  return t;
}

/**
 * Whether the browser shows the file's own text tracks itself: once the metadata is in, a text track neither made here
 * nor by a <track> element.
 */
async function inbandTracks(video: HTMLVideoElement, signal: AbortSignal): Promise<boolean> {
  if (video.readyState < 1)
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(id);
        video.removeEventListener("loadedmetadata", done);
        signal.removeEventListener("abort", done);
        resolve();
      };
      const id = setTimeout(done, 30_000);
      video.addEventListener("loadedmetadata", done);
      signal.addEventListener("abort", done);
    });
  const made = new Set(madeFor.get(video)?.values());
  const elements = new Set(Array.from(video.querySelectorAll("track"), (t) => t.track));
  return Array.from(video.textTracks).some((t) => !made.has(t) && !elements.has(t) && (t.kind === "subtitles" || t.kind === "captions"));
}

interface Controller {
  info: SubtitleTrackInfo;
  start(): void;
  stop(): void;
}

export async function startSubtitles(opts: SubtitleEngineOptions): Promise<{ destroy(): void }> {
  const { video, signal } = opts;
  const controllers: Controller[] = [];
  let index: MkvIndex | null = null;
  let mp4: Mp4TextTrack[] | null = null;
  const read = opts.file ? httpReader(opts.file, signal) : null;
  // The index sits at the end of the file: a torrent may take a while to bring that piece, so it is asked again twice.
  for (let attempt = 0; read && !index && !mp4 && attempt < 3 && !signal.aborted; attempt++) {
    try {
      const kind = await sniff(read);
      if (kind === "matroska") index = await readMatroskaIndex(read);
      else if (kind === "mp4") mp4 = await readMp4TextTracks(read);
      else break;
    } catch (e) {
      // Not a file these read: no point asking again. Otherwise wait and try again; in the end the file's own tracks
      // stay unknown, its external files still count.
      if (e instanceof MatroskaError || e instanceof Mp4Error) break;
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
    }
  }
  signal.throwIfAborted();
  // A browser that shows an MP4's text tracks itself (Safari) has them already: they aren't added twice.
  if (mp4?.length && read && !(await inbandTracks(video, signal)))
    for (const t of mp4) {
      const lang = t.language;
      const info: SubtitleTrackInfo = {
        track: textTrack(video, `mp4:${t.id}`, t.name ?? "", lang ?? ""),
        name: t.name,
        lang,
        forced: t.forced || FORCED_NAME.test(t.name ?? ""),
        isDefault: t.enabled,
        format: "tx3g",
        origin: "embedded",
      };
      controllers.push(mp4Track(video, read, t, info));
    }
  if (index && read) {
    for (const t of index.tracks) {
      const format = t.type === 17 ? CODEC[t.codecId] : undefined;
      if (!format) continue;
      const lang = t.language ? t.language.split("-")[0]! : null;
      const info: SubtitleTrackInfo = {
        track: textTrack(video, `mkv:${t.number}`, t.name ?? "", lang ?? ""),
        name: t.name,
        lang,
        forced: t.forced || FORCED_NAME.test(t.name ?? ""),
        isDefault: t.isDefault,
        format,
        origin: "embedded",
      };
      controllers.push(embedded(video, read, index, t, info));
    }
  }
  for (const x of opts.files ?? []) {
    const f: ExternalSubtitleFile = {
      ...x,
      fetch: () =>
        httpFile(
          {
            url: x.url,
            headers: opts.headers ?? opts.file?.headers ?? {},
            targetAddressSpace: opts.targetAddressSpace ?? opts.file?.targetAddressSpace,
          },
          signal,
        ),
    };
    const info: SubtitleTrackInfo = {
      track: textTrack(video, `file:${f.path}`, f.label ?? "", f.lang ?? ""),
      name: f.label,
      lang: f.lang,
      forced: f.forced,
      isDefault: false,
      format: f.format,
      origin: "file",
    };
    controllers.push(external(video, f, info));
  }

  const running = new Set<Controller>();
  const sync = () => {
    for (const c of controllers) {
      const on = c.info.track.mode === "showing";
      if (on && !running.has(c)) {
        running.add(c);
        c.start();
      } else if (!on && running.has(c)) {
        running.delete(c);
        c.stop();
      }
    }
  };
  video.textTracks.addEventListener("change", sync);
  opts.onTracks(controllers.map((c) => c.info));
  sync();
  return {
    destroy() {
      video.textTracks.removeEventListener("change", sync);
      for (const c of running) c.stop();
      running.clear();
      for (const c of controllers) c.info.track.mode = "disabled";
    },
  };
}

/** Cues added at the file's times, moved by this viewing's offset. */
function addCues(video: HTMLVideoElement, track: TextTrack, cues: TextCue[]) {
  const { offset } = subtitleView(video);
  for (const c of cues) {
    if (!(c.end > c.start)) continue;
    const cue = new VTTCue(c.start, c.end, c.text);
    shiftCue(cue, offset);
    track.addCue(cue);
  }
}

/**
 * Reads what a track needs around the playhead (from it on first, then just behind it), a few at a time, then looks at
 * the playhead again (a seek changes everything); a failed read (the torrent hasn't got that piece yet, or the server
 * stumbled) waits and tries again.
 */
async function aroundPlayhead<T>(
  video: HTMLVideoElement,
  signal: AbortSignal,
  items: T[],
  span: (item: T) => [number, number],
  take: (item: T) => Promise<void>,
) {
  const done = new Set<T>();
  let failures = 0;
  while (!signal.aborted) {
    const now = video.currentTime;
    const wanted = items.filter((c) => !done.has(c) && span(c)[1] >= now - BEHIND && span(c)[0] <= now + AHEAD);
    if (!wanted.length) {
      await moved(video, 2000, signal);
      continue;
    }
    wanted.sort((x, y) => Number(span(x)[1] < now) - Number(span(y)[1] < now) || span(x)[0] - span(y)[0]);
    for (const item of wanted.slice(0, 4)) {
      if (signal.aborted) return;
      try {
        await take(item);
        done.add(item);
        failures = 0;
      } catch {
        failures++;
        await moved(video, Math.min(10_000, 1000 * failures), signal);
        break;
      }
    }
  }
}

/** An MP4's text track (tx3g), read sample by sample around the playhead while it is shown. */
function mp4Track(video: HTMLVideoElement, read: RangeReader, t: Mp4TextTrack, info: SubtitleTrackInfo): Controller {
  // Each sample once, however often the track is shown again.
  const added = new Set<Mp4Sample>();
  let run: AbortController | null = null;
  return {
    info,
    start() {
      info.renderer = "native";
      run = new AbortController();
      const signal = run.signal;
      const samples = t.samples.filter((s) => !added.has(s) && s.size > 2);
      void aroundPlayhead(
        video,
        signal,
        samples,
        (s) => [s.time, s.time + s.duration],
        async (s) => {
          const data = await read(s.offset, s.offset + s.size);
          if (added.has(s)) return;
          added.add(s);
          const text = tx3gText(data);
          if (text) addCues(video, info.track, [{ start: s.time, end: s.time + s.duration, text }]);
        },
      );
    },
    stop() {
      run?.abort();
      run = null;
    },
  };
}

/** Waits for the playhead to move (or a seek), at most `ms`. */
function moved(video: HTMLVideoElement, ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(id);
      video.removeEventListener("timeupdate", done);
      video.removeEventListener("seeking", done);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const id = setTimeout(done, ms);
    video.addEventListener("timeupdate", done);
    video.addEventListener("seeking", done);
    signal.addEventListener("abort", done);
  });
}

/** One of the file's own tracks, read around the playhead while it is shown. */
function embedded(
  video: HTMLVideoElement,
  read: RangeReader,
  index: MkvIndex,
  t: MkvTrack,
  info: SubtitleTrackInfo,
): Controller {
  const cues = index.cues.filter((c) => c.track === t.number);
  const done = new Set<MkvCue>();
  const blocks = new Map<MkvCue, Uint8Array>();
  let run: AbortController | null = null;
  let draw: Drawer | null = null;
  let unfollow: (() => void) | null = null;
  let plain: Drawer | null = null;
  const header = info.format === "ass" && t.codecPrivate ? assHeader(decodeText(t.codecPrivate)) : "";
  const idx = info.format === "vobsub" ? parseIdx(t.codecPrivate ? decodeText(t.codecPrivate) : "") : null;

  const handle = async (cue: MkvCue, data: Uint8Array) => {
    if (info.format === "srt" || info.format === "vtt") {
      const text = info.format === "srt" ? srtToCueText(decodeText(data)) : decodeText(data).trim();
      if (text) addCues(video, info.track, [{ start: cue.time, end: cue.time + (cue.duration ?? 4), text }]);
    } else blocks.set(cue, data);
    await draw?.add(cue, data);
  };

  const pump = async (signal: AbortSignal) => {
    let failures = 0;
    while (!signal.aborted) {
      const now = video.currentTime;
      const wanted = cues.filter(
        (c) => !done.has(c) && c.time + (c.duration ?? 0) >= now - BEHIND && c.time <= now + AHEAD,
      );
      if (!wanted.length) {
        await moved(video, 2000, signal);
        continue;
      }
      // From the playhead on first (after a seek the next lines come first), then just behind it, a few at a time;
      // then look at the playhead again (a seek changes everything).
      wanted.sort((x, y) => Number(x.time + (x.duration ?? 0) < now) - Number(y.time + (y.duration ?? 0) < now) || x.time - y.time);
      for (const cue of wanted.slice(0, 4)) {
        if (signal.aborted) return;
        try {
          const block = await readCueBlock(read, index, cue);
          done.add(cue);
          if (block) await handle(cue, await decompress(t, block.data));
          failures = 0;
        } catch {
          // The torrent hasn't got that piece yet, or the server stumbled: wait and try again.
          failures++;
          await moved(video, Math.min(10_000, 1000 * failures), signal);
          break;
        }
      }
    }
  };

  // No cue names this track's blocks (older muxers): the stretches of clusters around the playhead are walked for them
  // instead (./matroska readClusterSubtitles) — the one the playhead is in first, then those ahead, then the one
  // behind; each line is shown as soon as it is found, and a seek out of a stretch's reach stops its walk for the new place.
  const doneClusters = new Set<number>();
  const seenBlocks = new Set<string>();
  const handleBlock = async (b: MkvBlock, pos: number) => {
    if (b.track !== t.number) return;
    // A stretch stopped by a seek is walked again later: what it already gave isn't added twice.
    const key = `${b.time}:${b.data.length}:${fnv(b.data)}`;
    if (seenBlocks.has(key)) return;
    seenBlocks.add(key);
    await handle({ time: b.time, track: b.track, cluster: pos, relative: null, duration: b.duration }, await decompress(t, b.data));
  };
  const pumpClusters = async (signal: AbortSignal) => {
    const all = index.clusters;
    const cache = clusterCache(index);
    const nextTime = (i: number) => all[i + 1]?.time ?? Number.POSITIVE_INFINITY;
    let failures = 0;
    while (!signal.aborted) {
      const now = video.currentTime;
      const wanted = all
        .map((c, i) => ({ c, i }))
        .filter(({ c, i }) => !doneClusters.has(c.pos) && nextTime(i) >= now - BEHIND && c.time <= now + CLUSTER_AHEAD);
      if (!wanted.length) {
        await moved(video, 2000, signal);
        continue;
      }
      const rank = ({ c, i }: { c: { time: number }; i: number }) => (c.time <= now && nextTime(i) > now ? 0 : c.time > now ? 1 : 2);
      wanted.sort((a, b) => rank(a) - rank(b) || a.c.time - b.c.time);
      const { c, i } = wanted[0]!;
      const stop = new AbortController();
      const onSeek = () => {
        const to = video.currentTime;
        if (to < c.time - CLUSTER_AHEAD || to > nextTime(i) + BEHIND) stop.abort();
      };
      const onAbort = () => stop.abort();
      video.addEventListener("seeking", onSeek);
      signal.addEventListener("abort", onAbort);
      try {
        const cached = cache.get(c.pos);
        if (cached) for (const b of await cached) await handleBlock(b, c.pos);
        else {
          const walk = readClusterSubtitles(read, index, c, all[i + 1]?.pos ?? null, {
            onBlock: (b) => handleBlock(b, c.pos),
            signal: stop.signal,
          });
          cache.set(c.pos, walk);
          await walk;
        }
        doneClusters.add(c.pos);
        failures = 0;
      } catch {
        cache.delete(c.pos);
        // Stopped for a seek: on at once. Otherwise the torrent hasn't got those pieces yet: wait and try again.
        if (!stop.signal.aborted) {
          failures++;
          await moved(video, Math.min(10_000, 1000 * failures), signal);
        }
      } finally {
        video.removeEventListener("seeking", onSeek);
        signal.removeEventListener("abort", onAbort);
      }
    }
  };

  const controller: Controller = {
    info,
    start() {
      run = new AbortController();
      const signal = run.signal;
      // libass takes the size and height with the script's styles: a new one is drawn from what was read.
      if (info.format === "ass")
        unfollow = onSubtitleView(video, (v, before) => {
          if (run && info.renderer === "libass" && styleChanged(v, before)) {
            controller.stop();
            controller.start();
          }
        });
      void (async () => {
        if (info.format === "ass")
          draw = await optional(assDrawer(video, restyleAss(header, subtitleView(video).style), read, index, signal), null);
        else if (info.format === "pgs") draw = pgsDrawer(video);
        else if (idx) draw = vobSubDrawer(video, idx);
        if (signal.aborted) return draw?.destroy();
        info.renderer =
          info.format === "pgs" || info.format === "vobsub" ? "canvas" : info.format === "ass" ? (draw ? "libass" : "text") : "native";
        // ASS without libass: its dialogue as plain cues (one set of them, however often it is shown again).
        if (info.format === "ass" && !draw) draw = plain ??= textAss(video, info.track);
        for (const [cue, data] of [...blocks].sort((a, b) => a[0].time - b[0].time))
          await draw?.add(cue, data);
        await (cues.length || !index.clusters.length ? pump(signal) : pumpClusters(signal));
      })();
    },
    stop() {
      run?.abort();
      run = null;
      unfollow?.();
      unfollow = null;
      draw?.destroy();
      draw = null;
    },
  };
  return controller;
}

/** The size or height changed (what libass is given; colour and edge are for text cues). */
const styleChanged = (v: SubtitleView, before: SubtitleView) =>
  v.style.size !== before.style.size || v.style.position !== before.style.position;

/** A torrent's subtitle file, read whole when it is first shown. */
function external(video: HTMLVideoElement, f: ExternalSubtitleFile, info: SubtitleTrackInfo): Controller {
  let loaded: Promise<{ cues: TextCue[]; ass?: string }> | null = null;
  let draw: { destroy(): void } | null = null;
  let run: AbortController | null = null;
  let unfollow: (() => void) | null = null;
  let cuesAdded = false;
  const controller: Controller = {
    info,
    start() {
      run = new AbortController();
      const signal = run.signal;
      // libass takes the size and height with the script's styles: drawn again from the file already read.
      unfollow = onSubtitleView(video, (v, before) => {
        if (run && info.renderer === "libass" && styleChanged(v, before)) {
          controller.stop();
          controller.start();
        }
      });
      void (async () => {
        loaded ??= f.fetch().then((b) => parseExternal(f.format, b));
        let parsed: { cues: TextCue[]; ass?: string };
        try {
          parsed = await loaded;
        } catch {
          // It can be tried again: shown again, it is fetched again.
          loaded = null;
          return;
        }
        if (signal.aborted) return;
        if (parsed.ass) {
          const r = await optional(assRenderer(video, { subContent: restyleAss(parsed.ass, subtitleView(video).style) }), null);
          if (signal.aborted) return r?.destroy();
          if (r) {
            info.renderer = "libass";
            draw = r;
            return;
          }
        }
        info.renderer = parsed.ass ? "text" : "native";
        if (!cuesAdded) {
          cuesAdded = true;
          addCues(video, info.track, parsed.cues);
        }
      })();
    },
    stop() {
      run?.abort();
      run = null;
      unfollow?.();
      unfollow = null;
      draw?.destroy();
      draw = null;
    },
  };
  return controller;
}

interface Drawer {
  add(cue: MkvCue, data: Uint8Array): Promise<void> | void;
  destroy(): void;
}

/** ASS dialogue as plain cues of the track (libass didn't load). */
function textAss(video: HTMLVideoElement, track: TextTrack): Drawer {
  const seen = new Set<MkvCue>();
  return {
    add(cue, data) {
      if (seen.has(cue)) return;
      seen.add(cue);
      const text = assToCueText(assBlockText(decodeText(data)));
      if (text) addCues(video, track, [{ start: cue.time, end: cue.time + (cue.duration ?? 4), text }]);
    },
    destroy() {},
  };
}

const JASSUB_URL = "/codecs/jassub/jassub.js";

type Jassub = {
  renderer: {
    processChunk(data: string, timecode: number, duration: number): Promise<void>;
    addFonts(fonts: Uint8Array[]): Promise<void>;
  };
  ready: Promise<void>;
  /** Seconds added to the video's time before libass draws it. */
  timeOffset: number;
  destroy(): Promise<void> | void;
  /** Draws the lines of this frame (what each frame the video shows does). */
  manualRender(frame: { mediaTime: number; width: number; height: number; expectedDisplayTime: number }, repaint?: boolean): Promise<void>;
};

/** libass (JASSUB) over the video; fails where it can't run here (no OffscreenCanvas, WebAssembly or worker). */
async function assRenderer(
  video: HTMLVideoElement,
  content: { subContent: string },
): Promise<{ renderer: Jassub["renderer"]; repaint(): void; destroy(): void }> {
  if (
    typeof OffscreenCanvas === "undefined" ||
    !("transferControlToOffscreen" in HTMLCanvasElement.prototype)
  )
    throw new Error("no OffscreenCanvas");
  // Static files of public/codecs/jassub (scripts/player-codecs/jassub.mjs), never through the bundler: its worker
  // starts copies of itself, which Turbopack's production build can't get to the end of.
  const { default: JASSUB } = (await import(
    /* turbopackIgnore: true */ /* webpackIgnore: true */ JASSUB_URL
  )) as { default: new (o: object) => Jassub };
  // A line shown `offset` s later is the one libass draws for the time `offset` s earlier.
  const instance = new JASSUB({ video, subContent: content.subContent, queryFonts: false, timeOffset: -subtitleView(video).offset });
  try {
    await instance.ready;
  } catch (e) {
    background(Promise.resolve(instance.destroy()));
    throw e;
  }
  // libass draws on the video's frames: a paused one is drawn again for a line (or a font) that came after it — as the
  // frame on screen, since a renderer made while paused (another size, shown again) has had no frame to draw on yet.
  // Its first draw only sizes the canvas (and what is drawn right after that is lost), so it is drawn again a moment
  // later; lines given one after another are drawn once.
  let pending = 0;
  let sized = false;
  const repaint = (wait = 50) => {
    if (!video.paused || pending) return;
    pending = window.setTimeout(() => {
      pending = 0;
      if (!video.paused) return;
      const first = !sized;
      sized = true;
      background(
        instance
          .manualRender({ mediaTime: video.currentTime, width: video.videoWidth, height: video.videoHeight, expectedDisplayTime: performance.now() }, true)
          .then(() => first && repaint(150)),
      );
    }, wait);
  };
  // A whole script (a torrent's .ass) has its lines already: drawn now if the video waits paused.
  repaint();
  const unfollow = onSubtitleView(video, (v, before) => {
    if (v.offset === before.offset) return;
    instance.timeOffset = -v.offset;
    repaint();
  });
  return {
    renderer: instance.renderer,
    repaint,
    destroy: () => {
      unfollow();
      window.clearTimeout(pending);
      background(Promise.resolve(instance.destroy()));
    },
  };
}

const FONT = /\.(ttf|otf|ttc|woff2?)$/i;
const FONT_BUDGET = 40 * 1024 * 1024;
/** Fonts already read, per file: libass drawn again (at another size) takes them from here. */
const fontData = new WeakMap<MkvIndex, Map<number, Promise<Uint8Array | null>>>();

/**
 * libass for a Matroska ASS track: drawn at once with its default font, then with the file's attached fonts as they
 * arrive (an anime release carries a dozen or two, read four at a time).
 */
async function assDrawer(
  video: HTMLVideoElement,
  header: string,
  read: RangeReader,
  index: MkvIndex,
  signal: AbortSignal,
): Promise<Drawer> {
  const r = await assRenderer(video, { subContent: header });
  let budget = FONT_BUDGET;
  const queue = (await optional(readAttachments(read, index), [])).filter((a) => {
    if (!(FONT.test(a.name) || /font|truetype|opentype/i.test(a.mime)) || a.size > budget) return false;
    budget -= a.size;
    return true;
  });
  let fonts = fontData.get(index);
  if (!fonts) {
    fonts = new Map();
    fontData.set(index, fonts);
  }
  const cache = fonts;
  const lane = async () => {
    for (let a = queue.shift(); a && !signal.aborted; a = queue.shift()) {
      // A font that can't be read leaves libass its default one (and is asked for again next time).
      let pending = cache.get(a.offset);
      if (!pending) {
        pending = optional(readAttachment(read, a), null);
        cache.set(a.offset, pending);
      }
      const data = await pending;
      if (!data) cache.delete(a.offset);
      if (data && !signal.aborted) {
        await optional(r.renderer.addFonts([data]), undefined);
        r.repaint();
      }
    }
  };
  background(Promise.all([lane(), lane(), lane(), lane()]));
  const seen = new Set<MkvCue>();
  return {
    async add(cue, data) {
      if (seen.has(cue)) return;
      seen.add(cue);
      await r.renderer.processChunk(
        decodeText(data),
        Math.round(cue.time * 1000),
        Math.round((cue.duration ?? 4) * 1000),
      );
      r.repaint();
    },
    destroy: () => r.destroy(),
  };
}

/** PGS pictures: display sets decoded in order (a seek starts a new run of them: what was carried over may not match). */
function pgsDrawer(video: HTMLVideoElement): Drawer {
  const decoder = new PgsDecoder();
  return bitmapDrawer(
    video,
    "pgs",
    (cue, data) => {
      const f = decoder.decode(data, cue.time);
      return f ? [f] : [];
    },
    () => decoder.reset(),
  );
}

/** VobSub pictures: each block one subpicture, with its own start and end. */
function vobSubDrawer(video: HTMLVideoElement, header: VobSubHeader): Drawer {
  return bitmapDrawer(video, "vobsub", (cue, data) => vobSubFrames(data, cue.time, cue.duration, header));
}

/**
 * Picture subtitles on a canvas laid over the video's picture (letterbox and all), each frame shown from its time until
 * the next one, at this viewing's offset, the bitmaps scaled and lifted by the profile's size and height.
 */
function bitmapDrawer(
  video: HTMLVideoElement,
  kind: "pgs" | "vobsub",
  decode: (cue: MkvCue, data: Uint8Array) => PgsFrame[],
  onSeek?: () => void,
): Drawer {
  const frames: PgsFrame[] = [];
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.subtitles = kind;
  canvas.style.cssText = "position:absolute;pointer-events:none;";
  video.insertAdjacentElement("afterend", canvas);
  const ctx = canvas.getContext("2d");
  let shown: PgsFrame | null = null;
  let raf = 0;
  let lastTime = -1;
  // Each bitmap made a canvas once, so it can be drawn at another size.
  const sources = new WeakMap<PgsBitmap, HTMLCanvasElement>();
  const source = (b: PgsBitmap) => {
    let c = sources.get(b);
    if (!c) {
      c = document.createElement("canvas");
      c.width = b.width;
      c.height = b.height;
      c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(b.rgba), b.width, b.height), 0, 0);
      sources.set(b, c);
    }
    return c;
  };

  const place = () => {
    // The video's picture inside its box (object-fit: contain).
    const w = video.clientWidth;
    const h = video.clientHeight;
    const vw = video.videoWidth || 16;
    const vh = video.videoHeight || 9;
    const scale = Math.min(w / vw, h / vh);
    const pw = vw * scale;
    const ph = vh * scale;
    canvas.style.left = `${video.offsetLeft + (w - pw) / 2}px`;
    canvas.style.top = `${video.offsetTop + (h - ph) / 2}px`;
    canvas.style.width = `${pw}px`;
    canvas.style.height = `${ph}px`;
  };

  const render = (frame: PgsFrame | null) => {
    if (!ctx) return;
    if (frame && (canvas.width !== frame.width || canvas.height !== frame.height)) {
      canvas.width = frame.width;
      canvas.height = frame.height;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!frame?.bitmaps.length) return;
    const rects = placeBitmaps(frame.bitmaps, frame, subtitleView(video).style);
    frame.bitmaps.forEach((b, i) => {
      const r = rects[i]!;
      ctx.drawImage(source(b), r.x, r.y, r.width, r.height);
    });
  };

  // Checked on every frame the video shows (requestVideoFrameCallback), and on a seek or a pause.
  let closed = false;
  type Rvfc = HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: () => void) => number;
    cancelVideoFrameCallback?: (id: number) => void;
  };
  const v = video as Rvfc;
  const tick = () => {
    // The file's time of what is on screen: a line shown `offset` s later belongs `offset` s earlier.
    const t = video.currentTime - subtitleView(video).offset;
    if (t === lastTime) return;
    lastTime = t;
    let at: PgsFrame | null = null;
    for (const f of frames) {
      if (f.time > t + 0.02) break;
      at = f;
    }
    if (at !== shown) {
      shown = at;
      place();
      render(at);
    }
  };
  const frame = () => {
    if (closed) return;
    tick();
    raf = v.requestVideoFrameCallback ? v.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
  };
  frame();
  const onResize = () => place();
  window.addEventListener("resize", onResize);
  const seeking = () => onSeek?.();
  video.addEventListener("seeking", seeking);
  video.addEventListener("seeked", tick);
  video.addEventListener("timeupdate", tick);
  // Another offset or look: drawn again at once, paused too.
  const unfollow = onSubtitleView(video, () => {
    lastTime = -1;
    shown = null;
    render(null);
    tick();
  });

  return {
    add(cue, data) {
      for (const f of decode(cue, data)) {
        const i = frames.findIndex((x) => x.time >= f.time);
        if (i >= 0 && frames[i]!.time === f.time) frames[i] = f;
        else if (i < 0) frames.push(f);
        else frames.splice(i, 0, f);
      }
      lastTime = -1;
      tick();
    },
    destroy() {
      closed = true;
      if (v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(raf);
      else cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      video.removeEventListener("seeking", seeking);
      video.removeEventListener("seeked", tick);
      video.removeEventListener("timeupdate", tick);
      unfollow();
      canvas.remove();
    },
  };
}
