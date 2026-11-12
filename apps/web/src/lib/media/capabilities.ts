/**
 * What this browser can actually decode. Built from MediaSource.isTypeSupported / canPlayType,
 * never from user-agent guesses, and used to pick Direct Play vs. server-side transcoding.
 */
export interface PlaybackCapabilities {
  /** `hevc10`: HEVC Main 10 (10-bit, every HDR release) — a phone may decode HEVC only in 8 bits; false when it says so. */
  video: { h264: boolean; hevc: boolean; av1: boolean; vp9: boolean; h264High10: boolean; hevc10?: boolean };
  audio: { aac: boolean; mp3: boolean; opus: boolean; flac: boolean; ac3: boolean; eac3: boolean; dts: boolean; truehd: boolean; vorbis: boolean };
  containers: { mp4: boolean; webm: boolean; mkv: "likely" | "no"; ts: boolean; mov: boolean };
  hls: "native" | "mse" | "none";
  mse: boolean;
  /**
   * The Media Source the in-browser rebuild (`remux.ts`) writes into: the standard one, Apple's ManagedMediaSource
   * (the only one on an iPhone, iOS 17.1 and later), or none (older iPhones, in-app browsers without it).
   */
  mediaSource: "standard" | "managed" | "none";
  /** Audio that Media Source takes in fragmented MP4 as it is: the rebuild copies it instead of converting it (AC-3 on Apple devices). */
  mseAudio: { aac: boolean; mp3: boolean; opus: boolean; flac: boolean; ac3: boolean; eac3: boolean; dts: boolean };
  hdr: boolean;
  /** Dolby Vision without an HDR10 base layer (profile 5) decodes here; elsewhere it shows wrong colours. */
  dolbyVision: boolean;
  maxHeight: number;
  pip: boolean;
  platform: string;
}

type MediaSourceClass = { isTypeSupported(type: string): boolean; new (): MediaSource };

/** The standard MediaSource, else Apple's ManagedMediaSource (iPhone), else null. */
export function mediaSourceClass(): MediaSourceClass | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { MediaSource?: MediaSourceClass; ManagedMediaSource?: MediaSourceClass };
  return w.MediaSource ?? w.ManagedMediaSource ?? null;
}

function mseCan(type: string): boolean {
  try {
    return Boolean(mediaSourceClass()?.isTypeSupported(type));
  } catch {
    return false;
  }
}

function can(type: string): boolean {
  if (mseCan(type)) return true;
  try {
    const v = document.createElement("video");
    return v.canPlayType(type) !== "";
  } catch {
    return false;
  }
}

let cached: PlaybackCapabilities | null = null;

export function detectCapabilities(): PlaybackCapabilities {
  if (cached) return cached;
  const ua = navigator.userAgent;
  const video = document.createElement("video");
  const chromium = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/OPR\/|SamsungBrowser/.test(ua);
  const safari = /Safari\//.test(ua) && !/Chrome\/|Chromium\//.test(ua);
  const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";
  const mediaSource = typeof MediaSource !== "undefined" ? "standard" : "ManagedMediaSource" in window ? "managed" : "none";
  const mse = mediaSource !== "none";
  cached = {
    video: {
      h264: can('video/mp4; codecs="avc1.640028"'),
      h264High10: can('video/mp4; codecs="avc1.6e0028"'),
      hevc: can('video/mp4; codecs="hvc1.1.6.L120.90"') || can('video/mp4; codecs="hev1.1.6.L120.90"'),
      hevc10: can('video/mp4; codecs="hvc1.2.4.L120.90"') || can('video/mp4; codecs="hev1.2.4.L120.90"'),
      av1: can('video/mp4; codecs="av01.0.08M.08"'),
      vp9: can('video/webm; codecs="vp09.00.10.08"'),
    },
    audio: {
      aac: can('audio/mp4; codecs="mp4a.40.2"'),
      mp3: can("audio/mpeg"),
      opus: can('audio/webm; codecs="opus"') || can('audio/mp4; codecs="opus"'),
      flac: can('audio/mp4; codecs="flac"') || can("audio/flac"),
      ac3: can('audio/mp4; codecs="ac-3"'),
      eac3: can('audio/mp4; codecs="ec-3"'),
      dts: can('audio/mp4; codecs="dtsc"'),
      truehd: false,
      vorbis: can('audio/webm; codecs="vorbis"'),
    },
    containers: {
      mp4: can("video/mp4"),
      webm: can("video/webm"),
      // Chromium plays progressive Matroska with supported codecs even though canPlayType says "".
      mkv: chromium || can("video/x-matroska") ? "likely" : "no",
      ts: can('video/mp2t; codecs="avc1.640028"'),
      mov: can("video/quicktime") || chromium || safari,
    },
    hls: nativeHls && (safari || !mse) ? "native" : mse ? "mse" : nativeHls ? "native" : "none",
    mse,
    mediaSource,
    mseAudio: {
      aac: mseCan('audio/mp4; codecs="mp4a.40.2"'),
      mp3: mseCan('audio/mp4; codecs="mp3"') || mseCan('audio/mp4; codecs="mp4a.6b"'),
      opus: mseCan('audio/mp4; codecs="opus"') || mseCan('audio/mp4; codecs="Opus"'),
      flac: mseCan('audio/mp4; codecs="flac"') || mseCan('audio/mp4; codecs="fLaC"'),
      ac3: mseCan('audio/mp4; codecs="ac-3"'),
      eac3: mseCan('audio/mp4; codecs="ec-3"'),
      dts: mseCan('audio/mp4; codecs="dtsc"'),
    },
    hdr: typeof matchMedia === "function" && matchMedia("(dynamic-range: high)").matches,
    dolbyVision: can('video/mp4; codecs="dvh1.05.06"') || can('video/mp4; codecs="dvhe.05.06"'),
    maxHeight: screenPictureHeight(window.screen.width, window.screen.height, window.devicePixelRatio || 1) >= 1440 ? 2160 : 1080,
    pip: "pictureInPictureEnabled" in document && Boolean(document.pictureInPictureEnabled),
    platform: `${chromium ? "chromium" : safari ? "safari" : /Firefox\//.test(ua) ? "firefox" : "other"}/${/Android/.test(ua) ? "android" : /iPhone|iPad/.test(ua) ? "ios" : /Windows/.test(ua) ? "windows" : /Mac OS/.test(ua) ? "macos" : /Tizen|Web0S|SmartTV/.test(ua) ? "tv" : "other"}`,
  };
  return cached;
}

/** The height a 16:9 picture gets on this screen at full size, in device pixels: a phone's 1080 × 2400 panel shows 1080. */
export function screenPictureHeight(width: number, height: number, pixelRatio: number): number {
  return Math.min(Math.min(width, height) * pixelRatio, (Math.max(width, height) * pixelRatio * 9) / 16);
}

/*
 * Whether 4K HEVC decodes here, and plays smoothly (MediaCapabilities, never user-agent guesses): "decodes HEVC" says
 * nothing about a 4K stream on a weak TV or phone — a phone may decode HEVC up to 1080p only while its browser still
 * says yes to the codec. `decodingInfo()` is asked once for 4K HEVC Main (3840 × 2160, 24 fps, 20 Mbit/s, as Media
 * Source would get it — the in-browser rebuild — or as a file) and, to check the answer, for 1080p: 4K refused where
 * 1080p is taken means it doesn't decode 4K; both refused, that this browser doesn't answer for HEVC (not known). Kept on
 * the device (localStorage, per browser version), so release search ranks the same from the first answer on and rows
 * don't move under the focus. null: not known (no API, no answer for HEVC, or not asked yet).
 */
const UHD_KEY = "lumovio.uhd-hevc";
type UhdAnswer = { decodes: boolean; smooth: boolean };
let uhd: UhdAnswer | null | undefined;
const smoothListeners = new Set<() => void>();
let probing = false;

function uhdNow(): UhdAnswer | null {
  if (uhd !== undefined) return uhd;
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(localStorage.getItem(UHD_KEY) ?? "null") as ({ ua: string } & UhdAnswer) | null;
    if (saved && saved.ua === navigator.userAgent) uhd = { decodes: saved.decodes, smooth: saved.smooth };
  } catch {
    // No storage: asked again on this page.
  }
  if (uhd === undefined) void probeUhd();
  return uhd ?? null;
}

/** Whether 4K HEVC plays smoothly here as far as known now (false where it doesn't decode); starts asking the first time. */
export function uhdSmoothNow(): boolean | null {
  const a = uhdNow();
  return a ? a.decodes && a.smooth : null;
}

/** Whether 4K HEVC decodes here at all as far as known now: false where the browser refuses it and takes 1080p. */
export function uhdDecodesNow(): boolean | null {
  return uhdNow()?.decodes ?? null;
}

/** For `useSyncExternalStore`: told once the answer arrives. */
export function onUhdSmooth(listener: () => void) {
  smoothListeners.add(listener);
  return () => smoothListeners.delete(listener);
}

async function probeUhd() {
  const mc = (navigator as Navigator & { mediaCapabilities?: MediaCapabilities }).mediaCapabilities;
  if (probing || !mc?.decodingInfo) return;
  probing = true;
  const type = mediaSourceClass() ? "media-source" : "file";
  const ask = (codec: string, width: number, height: number, bitrate: number) =>
    mc.decodingInfo({ type, video: { contentType: `video/mp4; codecs="${codec}"`, width, height, bitrate, framerate: 24 } });
  let answer: UhdAnswer | null = null;
  try {
    const [uhdInfo, hd] = await Promise.all([ask("hvc1.1.6.L153.B0", 3840, 2160, 20_000_000), ask("hvc1.1.6.L120.B0", 1920, 1080, 8_000_000)]);
    answer = uhdInfo.supported ? { decodes: true, smooth: uhdInfo.smooth } : hd.supported ? { decodes: false, smooth: false } : null;
  } catch {
    answer = null;
  }
  uhd = answer;
  if (answer !== null) {
    try {
      localStorage.setItem(UHD_KEY, JSON.stringify({ ua: navigator.userAgent, ...answer }));
    } catch {
      // Kept for this page only.
    }
  }
  for (const l of smoothListeners) l();
}

export type CompatVerdict = { ok: true } | { ok: false; reason: string };

export interface MediaFileFacts {
  container: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  profile?: string | null;
  bitDepth?: number | null;
  /** The picture's size, when the probe says (the AVI engine takes standard definition only). */
  width?: number | null;
  height?: number | null;
}

/** A container as people know it ("MKV", "MP4", "AVI"), from ffprobe's names ("matroska,webm", "mov,mp4,m4a,…") or an extension. */
export function containerName(container: string | null | undefined): string {
  const c = (container ?? "").toLowerCase();
  if (!c) return "unknown";
  if (c.includes("matroska") || c === "mkv") return "mkv";
  if (c === "webm") return "webm";
  if (c.includes("mp4") || c === "m4v") return "mp4";
  if (c.includes("mov") || c.includes("quicktime")) return "mov";
  if (c.includes("mpegts") || c === "ts" || c === "m2ts") return "ts";
  if (c.includes("avi")) return "avi";
  if (c.includes("asf") || c === "wmv") return "wmv";
  if (c.includes("mpeg") || c === "mpg" || c === "vob") return "mpeg";
  return c.split(",")[0]!;
}

/** Can this exact file (container + codecs) be played without server-side processing? */
export function canDirectPlay(caps: PlaybackCapabilities, file: MediaFileFacts): CompatVerdict {
  const c = (file.container ?? "").toLowerCase();
  const v = (file.videoCodec ?? "").toLowerCase();
  const a = (file.audioCodec ?? "").toLowerCase();
  // ffprobe reports both WebM and MKV as "matroska,webm": tell them apart by codecs.
  const matroska = c.includes("matroska") || c === "mkv" || c === "webm";
  const webmCodecs = /^(vp8|vp9|av1)?$/.test(v) && /^(opus|vorbis)?$/.test(a);
  const containerOk = matroska
    ? webmCodecs
      ? caps.containers.webm
      : caps.containers.mkv === "likely"
    : c.includes("mp4") || c.includes("m4v") || c === "mov,mp4,m4a,3gp,3g2,mj2"
      ? caps.containers.mp4
      : c.includes("mov") || c.includes("quicktime")
        ? caps.containers.mov
        : c.includes("mpegts") || c === "ts"
          ? false
          : !c;
  if (!containerOk) return { ok: false, reason: `container ${containerName(c)}` };
  if (!videoPlayable(caps, v, file) && !(v.includes("vp8") && caps.containers.webm)) return { ok: false, reason: videoReason(caps, v, file) };
  const audioOk =
    !a ||
    (a.includes("aac") && caps.audio.aac) ||
    (a.includes("mp3") && caps.audio.mp3) ||
    (a.includes("opus") && caps.audio.opus) ||
    (a.includes("flac") && caps.audio.flac) ||
    (a === "ac3" && caps.audio.ac3) ||
    (a === "eac3" && caps.audio.eac3) ||
    (a.includes("vorbis") && caps.audio.vorbis) ||
    (a.includes("dts") && caps.audio.dts);
  if (!audioOk) return { ok: false, reason: `audio ${a}` };
  return { ok: true };
}

const isHevc = (v: string) => v.includes("hevc") || v.includes("h265");
/** HEVC past 1080p on a device whose browser refuses 4K HEVC but takes 1080p (`uhdDecodesNow`). */
const hevcTooBig = (v: string, file: MediaFileFacts) => isHevc(v) && ((file.width ?? 0) > 1920 || (file.height ?? 0) > 1088) && uhdDecodesNow() === false;

function videoPlayable(caps: PlaybackCapabilities, v: string, file: MediaFileFacts): boolean {
  const deep = Boolean(file.bitDepth && file.bitDepth > 8);
  return (
    !v ||
    (v.includes("h264") || v.includes("avc") ? caps.video.h264 && !(deep && !caps.video.h264High10) : false) ||
    (isHevc(v) && caps.video.hevc && !(deep && caps.video.hevc10 === false) && !hevcTooBig(v, file)) ||
    (v.includes("av1") && caps.video.av1) ||
    (v.includes("vp9") && caps.video.vp9)
  );
}

const videoReason = (caps: PlaybackCapabilities, v: string, file: MediaFileFacts) =>
  `video ${v || "unknown"}${caps.video.hevc && hevcTooBig(v, file) ? " 4K" : file.bitDepth && file.bitDepth > 8 ? ` ${file.bitDepth}-bit` : ""}`;

/** Containers the rebuild reads (Mediabunny): Matroska/WebM, MP4/MOV and MPEG-TS (also Blu-ray's M2TS). Not AVI or WMV. */
const REMUX_CONTAINERS = new Set(["mkv", "webm", "mp4", "mov", "ts"]);

/**
 * Can the browser rebuild this file itself (`lib/media/remux.ts`): video copied into fragmented MP4, through
 * Media Source (the standard one, or ManagedMediaSource on an iPhone)? It helps where the container or the audio is
 * the problem; the video must already be one this browser decodes. `remuxAudioRoute` decides the audio. A file
 * ffprobe couldn't read (`videoCodec` null) is tried on its container alone: the engine reads its tracks itself.
 */
export function canRemuxInBrowser(caps: PlaybackCapabilities, file: MediaFileFacts): CompatVerdict {
  const c = containerName(file.container);
  const v = (file.videoCodec ?? "").toLowerCase();
  const a = (file.audioCodec ?? "").toLowerCase();
  // A container it never reads (AVI) is the reason, wherever it runs.
  if (!REMUX_CONTAINERS.has(c)) return { ok: false, reason: `container ${c}` };
  if (caps.mediaSource === "none") return { ok: false, reason: "no Media Source Extensions" };
  if (v && !videoPlayable(caps, v, file)) return { ok: false, reason: videoReason(caps, v, file) };
  if (a && !REMUXABLE_AUDIO.test(a)) return { ok: false, reason: `audio ${a}` };
  return { ok: true };
}

/** Audio the rebuild can take at all: copied, or decoded (WebCodecs, else WASM: AC-3/E-AC-3, DTS, TrueHD/MLP, MP3, FLAC, Vorbis) and converted. */
export const REMUXABLE_AUDIO = /^(aac|ac3|eac3|mp3|opus|flac|vorbis|dts|truehd|mlp)$/;
