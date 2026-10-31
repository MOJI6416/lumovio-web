import { canDirectPlay, canRemuxInBrowser, type CompatVerdict, containerName, type MediaFileFacts, type PlaybackCapabilities, REMUXABLE_AUDIO } from "./capabilities";

/*
 * How one file plays in this browser (player document, 4): as it is, rebuilt in the browser, or in another app. Kept
 * apart from capabilities.ts, which every page with a title card loads: only preparing a playback (torrserver.ts,
 * loaded then), the rebuild engine and the device check need it.
 */

/** How the rebuild handles one audio track: copied as it is, or converted to AAC (or Opus, where there's no AAC encoder). */
export type AudioRoute = "copy" | "aac" | "opus";

/** What WebCodecs can do here; replaced by a fake in tests. */
export interface AudioCoders {
  encodes(codec: "aac" | "opus"): Promise<boolean>;
  /** WebCodecs decodes it (the rebuild has WASM decoders for what it doesn't; the device check reports this). */
  decodes(codec: string): Promise<boolean>;
}

const WEBCODECS_NAME: Record<string, string> = { aac: "mp4a.40.2", mp3: "mp3", opus: "opus", vorbis: "vorbis", flac: "flac" };

export const webCodecs: AudioCoders = {
  async encodes(codec) {
    try {
      if (typeof AudioEncoder === "undefined") return false;
      return Boolean((await AudioEncoder.isConfigSupported({ codec: codec === "aac" ? "mp4a.40.2" : "opus", sampleRate: 48000, numberOfChannels: 2, bitrate: 128_000 })).supported);
    } catch {
      return false;
    }
  },
  async decodes(codec) {
    const name = WEBCODECS_NAME[codec];
    if (!name || typeof AudioDecoder === "undefined") return false;
    try {
      return Boolean((await AudioDecoder.isConfigSupported({ codec: name, sampleRate: 48000, numberOfChannels: 2 })).supported);
    } catch {
      // FLAC and Vorbis need their codec header to be checked; the engine finds out when it starts.
      return codec === "flac" || codec === "vorbis";
    }
  },
};

/**
 * The rebuild's way with one audio codec here, or null when it has none: copied when Media Source takes it in MP4 as
 * it is (AAC everywhere, AC-3/E-AC-3 on Apple devices — no conversion, 5.1 kept), else decoded and converted to AAC,
 * else to Opus (Firefox has no AAC encoder). Every codec the rebuild takes decodes here: WebCodecs, or WASM builds of
 * FFmpeg's decoders (AC-3/E-AC-3, DTS, TrueHD/MLP; MP3, FLAC, Vorbis where WebCodecs can't). Without a WebCodecs
 * encoder AAC is encoded in WASM too (iPhones before iOS 26), so only a browser without WebAssembly has no way.
 */
export async function remuxAudioRoute(caps: PlaybackCapabilities, codec: string | null | undefined, coders: AudioCoders = webCodecs): Promise<AudioRoute | null> {
  const a = (codec ?? "").toLowerCase();
  if (!a) return "copy";
  if (a in caps.mseAudio && caps.mseAudio[a as keyof PlaybackCapabilities["mseAudio"]]) return "copy";
  if (!REMUXABLE_AUDIO.test(a)) return null;
  if (caps.mseAudio.aac && (await coders.encodes("aac"))) return "aac";
  if (caps.mseAudio.opus && (await coders.encodes("opus"))) return "opus";
  if (caps.mseAudio.aac && typeof WebAssembly === "object") return "aac";
  return null;
}

/** ffprobe's names of what the AVI engine (`legacy.ts`) decodes in WASM: MPEG-4 Part 2 (Xvid, DivX), MS-MPEG-4, MPEG-1/2, H.263. */
const LEGACY_VIDEO = /^(mpeg4|msmpeg4v[123]|mpeg2video|mpeg1video|h263)$/;
const LEGACY_AUDIO = /^(mp3|mp2|ac3|pcm_s16le)$/;

/**
 * Can the AVI engine play this file here (`legacy.ts`): an AVI with an old video codec at standard definition (DVD PAL
 * at most), its audio one the engine decodes, Media Source and the browser's H.264 encoder. Whether the device decodes
 * it fast enough is measured on the file when it is prepared (`probeLegacy`).
 */
export function canDecodeLegacy(caps: PlaybackCapabilities, file: MediaFileFacts): CompatVerdict {
  const c = containerName(file.container);
  const v = (file.videoCodec ?? "").toLowerCase();
  const a = (file.audioCodec ?? "").toLowerCase();
  if (c !== "avi") return { ok: false, reason: `container ${c}` };
  if (caps.mediaSource === "none") return { ok: false, reason: "no Media Source Extensions" };
  if (!LEGACY_VIDEO.test(v)) return { ok: false, reason: `video ${v || "unknown"}` };
  if ((file.width ?? 0) > 1024 || (file.height ?? 0) > 576) return { ok: false, reason: `video ${v} ${file.width}×${file.height}` };
  if (a && !LEGACY_AUDIO.test(a)) return { ok: false, reason: `audio ${a}` };
  if (typeof VideoEncoder === "undefined") return { ok: false, reason: "no video encoder" };
  return { ok: true };
}

/** The AVI engine always encodes the audio: AAC, Opus where there's no AAC encoder (Firefox), AAC in WASM where neither. */
async function legacyAudioRoute(caps: PlaybackCapabilities, coders: AudioCoders): Promise<AudioRoute | null> {
  if (caps.mseAudio.aac && (await coders.encodes("aac"))) return "aac";
  if (caps.mseAudio.opus && (await coders.encodes("opus"))) return "opus";
  return caps.mseAudio.aac ? "aac" : null;
}

export type PlaybackChoice =
  | { path: "direct" }
  | { path: "remux"; audio: AudioRoute }
  /** An AVI decoded in WASM and encoded to H.264 here (`legacy.ts`). */
  | { path: "legacy"; audio: AudioRoute }
  /** `reason`: every reason, comma-separated, in the engines' words (`explain.ts` puts them in the person's). */
  | { path: "external"; reason: string };

/**
 * How one file plays in this browser — the minimum that works (player document, 4): as it is; else rebuilt in the
 * browser (video copied, audio copied or converted); else in another app, with every reason why. `otherTrack`: an
 * audio track other than the file's default is wanted (a plain stream always plays the default). `noBridge`: the
 * plain stream would need the service worker (a TorrServer with a password) and there is none — the rebuild fetches
 * with the password itself. `probed: false`: ffprobe couldn't read the file; only its extension is known.
 */
export async function choosePlayback(
  caps: PlaybackCapabilities,
  file: MediaFileFacts & { probed?: boolean },
  opts: { otherTrack?: boolean; noBridge?: boolean } = {},
  coders: AudioCoders = webCodecs,
): Promise<PlaybackChoice> {
  const probed = file.probed !== false;
  const c = containerName(file.container);
  // Without ffprobe, the container decides alone: an MP4 is tried as it is (as before), a Matroska file this browser
  // can't open is rebuilt (its tracks are read then), anything else goes to another app.
  const direct: CompatVerdict = probed
    ? canDirectPlay(caps, file)
    : c === "mp4" || c === "mov" || c === "webm" || (c === "mkv" && caps.containers.mkv === "likely")
      ? { ok: true }
      : { ok: false, reason: `container ${c}` };
  if (direct.ok && !opts.otherTrack && !opts.noBridge) return { path: "direct" };
  const rebuild = canRemuxInBrowser(caps, file);
  const audio = rebuild.ok ? await remuxAudioRoute(caps, file.audioCodec, coders) : null;
  if (rebuild.ok && audio) return { path: "remux", audio };
  if (direct.ok) return { path: "direct" };
  // An old AVI: decoded here in WASM, the video encoded to H.264 by the browser.
  const legacy = probed && c === "avi" ? canDecodeLegacy(caps, file) : null;
  const legacyAudio = legacy?.ok ? await legacyAudioRoute(caps, coders) : null;
  if (legacy?.ok && legacyAudio) return { path: "legacy", audio: legacyAudio };
  const reasons = [direct.reason, rebuild.ok ? `audio ${(file.audioCodec ?? "").toLowerCase()}` : rebuild.reason, ...(legacy && !legacy.ok ? [legacy.reason] : [])];
  return { path: "external", reason: [...new Set(reasons)].join(", ") };
}
