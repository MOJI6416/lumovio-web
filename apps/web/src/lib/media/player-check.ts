import type { MediaFileFacts, PlaybackCapabilities } from "./capabilities";
import { type AudioRoute, choosePlayback, webCodecs } from "./playback-choice";
import { background, optional } from "../optional";
import type { RemuxHandle } from "./remux";
import type { SubtitleTrackInfo } from "./subs/engine";

/*
 * The device check (/dev/player-check): what this browser can play,
 * and short reference clips in the formats real releases use, each started the way the player would (as it is,
 * rebuilt in the browser, or another app), muted. The clips are Lumovio's own files (public/player-check/, made by
 * a script kept outside the repository), so the check needs no server of the person's.
 */

export interface ReferenceClip {
  id: string;
  url: string;
  /** What the clip is, in codec names ("MKV · H.264 · AC-3 5.1"): the check is a technical page. */
  label: string;
  facts: MediaFileFacts;
  /** The clip has a second audio track: switching to it is tried too. */
  switchTo?: number;
  /** The clip has subtitle tracks (and files next to it): each one is shown and checked. */
  subtitles?: { files: { path: string; format: "srt" | "vtt" | "ass"; lang: string | null; forced: boolean; label: string | null; url: string }[] };
}

export const REFERENCE_CLIPS: ReferenceClip[] = [
  { id: "mp4-h264-aac", url: "/player-check/mp4-h264-aac.mp4", label: "MP4 · H.264 · AAC", facts: { container: "mov,mp4,m4a,3gp,3g2,mj2", videoCodec: "h264", audioCodec: "aac" } },
  { id: "mkv-h264-aac", url: "/player-check/mkv-h264-aac.mkv", label: "MKV · H.264 · AAC", facts: { container: "matroska,webm", videoCodec: "h264", audioCodec: "aac" } },
  { id: "mkv-h264-ac3", url: "/player-check/mkv-h264-ac3.mkv", label: "MKV · H.264 · AC-3 5.1", facts: { container: "matroska,webm", videoCodec: "h264", audioCodec: "ac3" } },
  { id: "mkv-h264-eac3", url: "/player-check/mkv-h264-eac3.mkv", label: "MKV · H.264 · E-AC-3 5.1", facts: { container: "matroska,webm", videoCodec: "h264", audioCodec: "eac3" } },
  { id: "mkv-hevc10-aac", url: "/player-check/mkv-hevc10-aac.mkv", label: "MKV · HEVC 10-bit · AAC", facts: { container: "matroska,webm", videoCodec: "hevc", audioCodec: "aac", bitDepth: 10 } },
  { id: "mkv-av1-eac3", url: "/player-check/mkv-av1-eac3.mkv", label: "MKV · AV1 10-bit · E-AC-3 5.1", facts: { container: "matroska,webm", videoCodec: "av1", audioCodec: "eac3", bitDepth: 10 } },
  { id: "mkv-multi", url: "/player-check/mkv-multi.mkv", label: "MKV · H.264 · AC-3 + AAC + E-AC-3", facts: { container: "matroska,webm", videoCodec: "h264", audioCodec: "ac3" }, switchTo: 1 },
  { id: "mkv-h264-dts", url: "/player-check/mkv-h264-dts.mkv", label: "MKV · H.264 · DTS 5.1", facts: { container: "matroska,webm", videoCodec: "h264", audioCodec: "dts" } },
  { id: "mkv-h264-truehd", url: "/player-check/mkv-h264-truehd.mkv", label: "MKV · H.264 · TrueHD 5.1", facts: { container: "matroska,webm", videoCodec: "h264", audioCodec: "truehd" } },
  {
    id: "mkv-subs",
    url: "/player-check/mkv-subs.mkv",
    label: "MKV · SRT + ASS + PGS + VobSub",
    facts: { container: "matroska,webm", videoCodec: "h264", audioCodec: "aac" },
    subtitles: { files: [{ path: "mkv-subs.ukr.srt", format: "srt", lang: "uk", forced: false, label: null, url: "/player-check/mkv-subs.ukr.srt" }] },
  },
  {
    id: "mp4-subs",
    url: "/player-check/mp4-subs.mp4",
    label: "MP4 · H.264 · AAC · mov_text",
    facts: { container: "mov,mp4,m4a,3gp,3g2,mj2", videoCodec: "h264", audioCodec: "aac" },
    subtitles: { files: [] },
  },
  { id: "avi-xvid-mp3", url: "/player-check/avi-xvid-mp3.avi", label: "AVI · Xvid · MP3", facts: { container: "avi", videoCodec: "mpeg4", audioCodec: "mp3" } },
  { id: "avi-mpeg2-ac3", url: "/player-check/avi-mpeg2-ac3.avi", label: "AVI · MPEG-2 · AC-3", facts: { container: "avi", videoCodec: "mpeg2video", audioCodec: "ac3" } },
];

/** Why a clip didn't play, as a key the page puts in words (never the engine's own message). */
export type ClipError = "decode" | "network" | "format" | "timeout" | "noPicture" | "engine";

export interface ClipResult {
  id: string;
  path: "direct" | "remux" | "legacy" | "external";
  /** The AVI engine: how much faster than real time this device decodes the clip's video (×). */
  speed?: number;
  outcome: "works" | "external" | "fails";
  /** For "external": the reasons, in the engines' words (`explain.ts` → `useWhy`). */
  reason?: string;
  route?: AudioRoute;
  mediaSource?: "standard" | "managed";
  startMs?: number;
  seekMs?: number | null;
  /** The browser says audio was decoded (muted, so nothing is heard); null when it has no way to say. */
  audio?: boolean | null;
  /** Another audio track, switched to while playing (only for a clip that has one, when it is rebuilt). */
  switched?: boolean | null;
  /** Each subtitle track ("srt:rus", "srt-forced:rus", "ass:eng", "pgs:eng", "vobsub:fre", "srt-file:uk", "tx3g:rus"): how it was drawn, or false. */
  subtitles?: Record<string, "native" | "libass" | "text" | "canvas" | false>;
  error?: ClipError;
  /** For the report: the media element's error code and the engine's message (English, technical). */
  detail?: string;
  size?: string;
}

/** Facts about the browser that the report and the page show, beyond `PlaybackCapabilities`. */
export interface BrowserFacts {
  userAgent: string;
  encoders: { aac: boolean; opus: boolean };
  /**
   * The service worker that adds a TorrServer's password to a plain stream: "active" (serves this page), "waiting"
   * (installed, takes over on reload), "failed" (the browser has the API but didn't install it), "unsupported".
   */
  worker: "active" | "waiting" | "failed" | "unsupported";
  /** Element fullscreen, or only the video's own fullscreen (iPhone). */
  fullscreen: "element" | "video" | "none";
  pip: boolean;
}

export async function browserFacts(): Promise<BrowserFacts> {
  const v = document.createElement("video") as HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitSupportsPresentationMode?: (m: string) => boolean };
  return {
    userAgent: navigator.userAgent,
    encoders: { aac: await webCodecs.encodes("aac"), opus: await webCodecs.encodes("opus") },
    worker: !("serviceWorker" in navigator)
      ? "unsupported"
      : navigator.serviceWorker.controller
        ? "active"
        : (await optional(navigator.serviceWorker.getRegistration(), undefined))
          ? "waiting"
          : "failed",
    fullscreen: document.fullscreenEnabled ? "element" : typeof v.webkitEnterFullscreen === "function" ? "video" : "none",
    pip: Boolean(document.pictureInPictureEnabled) || Boolean(v.webkitSupportsPresentationMode?.("picture-in-picture")),
  };
}

const START_TIMEOUT = 15_000;

/** Waits until `ok()` holds, checking on the element's events and every 100 ms; rejects on `fail`. */
function until(video: HTMLVideoElement, ok: () => boolean, ms: number, fail: { error: ClipError | null; detail?: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const check = () => {
      if (fail.error) return done(new Error(fail.error));
      if (video.error) {
        fail.error = video.error.code === 2 ? "network" : video.error.code === 3 ? "decode" : "format";
        fail.detail = `media error ${video.error.code}${video.error.message ? `: ${video.error.message}` : ""}`;
        return done(new Error(fail.error));
      }
      if (ok()) return done(null);
      if (performance.now() - started > ms) {
        fail.error ??= "timeout";
        return done(new Error(fail.error));
      }
    };
    const id = window.setInterval(check, 100);
    const events = ["timeupdate", "playing", "seeked", "error", "loadeddata"];
    const done = (e: Error | null) => {
      window.clearInterval(id);
      for (const ev of events) video.removeEventListener(ev, check);
      if (e) reject(e);
      else resolve();
    };
    for (const ev of events) video.addEventListener(ev, check);
    check();
  });
}

function audioDecoded(video: HTMLVideoElement): boolean | null {
  const v = video as HTMLVideoElement & { webkitAudioDecodedByteCount?: number; mozHasAudio?: boolean; audioTracks?: { length: number } };
  if (typeof v.webkitAudioDecodedByteCount === "number") return v.webkitAudioDecodedByteCount > 0;
  if (typeof v.mozHasAudio === "boolean") return v.mozHasAudio;
  if (v.audioTracks) return v.audioTracks.length > 0;
  return null;
}

/**
 * Starts one clip the way the player would, on a muted `<video>` of the page: decides the path, plays, checks that
 * time moves and there is a picture, seeks, switches the audio track where the clip has another, and stops.
 */
export async function runClip(clip: ReferenceClip, caps: PlaybackCapabilities, video: HTMLVideoElement): Promise<ClipResult> {
  const choice = await choosePlayback(caps, { ...clip.facts, probed: true }, {});
  if (choice.path === "external") return { id: clip.id, path: "external", outcome: "external", reason: choice.reason };
  const result: ClipResult = { id: clip.id, path: choice.path, outcome: "fails", route: choice.path === "direct" ? undefined : choice.audio };
  // The AVI engine first measures this device's decoding speed, as the player does.
  if (choice.path === "legacy") {
    const { probeLegacy } = await import("./legacy");
    const probe = await probeLegacy({ url: new URL(clip.url, location.href).href, headers: {} });
    result.speed = probe.speed !== undefined ? Math.round(probe.speed * 10) / 10 : undefined;
    if (!probe.ok) return { ...result, path: "external", outcome: "external", reason: `container avi, ${probe.reason}` };
  }
  const fail: { error: ClipError | null; detail?: string } = { error: null };
  const abort = new AbortController();
  let handle: RemuxHandle | null = null;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const t0 = performance.now();
  try {
    if (choice.path === "direct") video.src = clip.url;
    else {
      const engine = choice.path === "legacy" ? (await import("./legacy")).startLegacy : (await import("./remux")).startRemux;
      handle = await engine(video, {
        url: choice.path === "legacy" ? new URL(clip.url, location.href).href : clip.url,
        audioPosition: 0,
        startAt: 0,
        durationSec: null,
        signal: abort.signal,
        onError: (message) => {
          fail.error = "engine";
          fail.detail = message.slice(0, 200);
        },
        // What the default track came out as (a switch to another track reports again).
        onRoute: (r) => {
          if (result.mediaSource) return;
          result.route = r.audio;
          result.mediaSource = r.mediaSource;
        },
      });
    }
    // A refused play() shows as the start timing out.
    background(video.play());
    await until(video, () => video.currentTime > 0.3 && !video.paused, START_TIMEOUT, fail);
    result.startMs = Math.round(performance.now() - t0);
    result.size = `${video.videoWidth}×${video.videoHeight}`;
    if (!video.videoWidth) {
      fail.error = "noPicture";
      throw new Error("noPicture");
    }
    result.audio = audioDecoded(video);
    // A seek further on, then playback has to go on from there.
    const s0 = performance.now();
    try {
      video.currentTime = 2.5;
      await until(video, () => !video.seeking && video.currentTime > 2.6, 8000, fail);
      result.seekMs = Math.round(performance.now() - s0);
    } catch {
      if (fail.error && fail.error !== "timeout") throw new Error(fail.error);
      fail.error = null;
      result.seekMs = null;
    }
    if (clip.switchTo !== undefined) {
      if (handle) {
        video.currentTime = 0.5;
        await optional(until(video, () => !video.seeking && video.currentTime > 0.6, 8000, fail), undefined);
        fail.error = null;
        const at = video.currentTime;
        handle.selectAudio(clip.switchTo);
        result.switched = await until(video, () => video.currentTime > at + 0.8 && !video.paused, 8000, fail).then(
          () => true,
          () => false,
        );
        fail.error = null;
      } else result.switched = null;
    }
    if (clip.subtitles) result.subtitles = await checkSubtitles(clip, video);
    result.outcome = "works";
  } catch (e) {
    result.outcome = "fails";
    // The rebuild couldn't read the file at all: that's the network, not the format.
    const message = e instanceof Error ? e.message : String(e);
    result.error = fail.error ?? (/fetch|network|status|\b[45]\d\d\b/i.test(message) ? "network" : "engine");
    result.detail = fail.detail ?? message.slice(0, 200);
  } finally {
    abort.abort();
    handle?.destroy();
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
  return result;
}

/**
 * Shows each subtitle track of a clip in turn, paused at one of its lines, and sees it drawn: an active cue for text,
 * libass's canvas for ASS, pixels on the canvas for PGS and VobSub.
 */
async function checkSubtitles(clip: ReferenceClip, video: HTMLVideoElement): Promise<Record<string, "native" | "libass" | "text" | "canvas" | false>> {
  const { startSubtitles } = await import("./subs/engine");
  const abort = new AbortController();
  let tracks: SubtitleTrackInfo[] = [];
  const engine = await startSubtitles({
    video,
    file: { url: new URL(clip.url, location.href).href, headers: {} },
    files: clip.subtitles?.files.map((f) => ({ ...f, url: new URL(f.url, location.href).href })),
    headers: {},
    signal: abort.signal,
    onTracks: (t) => {
      tracks = t;
    },
  });
  const out: Record<string, "native" | "libass" | "text" | "canvas" | false> = {};
  video.pause();
  try {
    for (const info of tracks) {
      for (const x of tracks) x.track.mode = x === info ? "showing" : "disabled";
      video.currentTime = info.forced ? 1.5 : 1.0;
      const key = `${info.format}${info.forced ? "-forced" : ""}${info.origin === "file" ? "-file" : ""}:${info.lang ?? "und"}`;
      const drawn = () => {
        if (info.renderer === "libass") return Boolean(video.parentElement?.querySelector("canvas.JASSUB"));
        if (info.renderer === "canvas") {
          const c = video.parentElement?.querySelector<HTMLCanvasElement>("canvas[data-subtitles]");
          const d = c?.width ? c.getContext("2d")?.getImageData(0, 0, c.width, c.height).data : null;
          return Boolean(d?.some((v, i) => i % 4 === 3 && v > 0));
        }
        return Boolean(info.track.activeCues?.length);
      };
      const ok = await new Promise<boolean>((resolve) => {
        const t0 = performance.now();
        const id = window.setInterval(() => {
          if (drawn()) {
            window.clearInterval(id);
            resolve(true);
          } else if (performance.now() - t0 > 8000) {
            window.clearInterval(id);
            resolve(false);
          }
        }, 100);
      });
      out[key] = ok ? (info.renderer ?? "native") : false;
    }
  } finally {
    for (const x of tracks) x.track.mode = "disabled";
    engine.destroy();
    abort.abort();
  }
  return out;
}

/** The report the person copies and sends: what the browser is and can do, and each clip's result. Nothing about their servers. */
export function reportText(caps: PlaybackCapabilities, facts: BrowserFacts, results: ClipResult[], at = new Date()): string {
  const yes = (b: boolean) => (b ? "yes" : "no");
  const list = (o: Record<string, boolean | string>) =>
    Object.entries(o)
      .map(([k, v]) => `${k} ${typeof v === "boolean" ? yes(v) : v}`)
      .join(", ");
  const lines = [
    `Lumovio device check · ${at.toISOString()}`,
    `UA: ${facts.userAgent}`,
    `Platform: ${caps.platform} · Media Source: ${caps.mediaSource} · HLS: ${caps.hls} · service worker: ${facts.worker}`,
    `Encoders: AAC ${yes(facts.encoders.aac)}, Opus ${yes(facts.encoders.opus)} · fullscreen: ${facts.fullscreen} · PiP: ${yes(facts.pip)} · HDR screen: ${yes(caps.hdr)}`,
    `Video: ${list({ ...caps.video, dolbyVision5: caps.dolbyVision })}`,
    `Audio (element): ${list(caps.audio)}`,
    `Audio (Media Source, copied): ${list(caps.mseAudio)}`,
    `Containers: ${list(caps.containers)}`,
    "",
    ...results.map((r) =>
      [
        r.id,
        r.outcome,
        r.path,
        r.route ? `audio ${r.route}` : null,
        r.mediaSource ? `MS ${r.mediaSource}` : null,
        r.speed !== undefined ? `decodes ${r.speed}× real time` : null,
        r.startMs !== undefined ? `start ${r.startMs} ms` : null,
        r.seekMs !== undefined ? `seek ${r.seekMs === null ? "failed" : `${r.seekMs} ms`}` : null,
        r.audio !== undefined ? `audio decoded ${r.audio === null ? "?" : yes(r.audio)}` : null,
        r.switched !== undefined ? `switch ${r.switched === null ? "n/a" : yes(r.switched)}` : null,
        r.subtitles ? `subtitles ${Object.entries(r.subtitles).map(([k, v]) => `${k} ${v || "no"}`).join(", ")}` : null,
        r.size ? `picture ${r.size}` : null,
        r.reason ? `why: ${r.reason}` : null,
        r.error ? `error ${r.error}${r.detail ? ` (${r.detail})` : ""}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ),
  ];
  return lines.join("\n");
}
