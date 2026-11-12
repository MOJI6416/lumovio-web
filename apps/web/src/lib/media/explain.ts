import { languageCode } from "./languages";
import { parseRelease, type ReleaseTrack } from "./releases";

/*
 * What the playback engines say in their own (English, technical) words, as facts the interface puts in the person's
 * language: why a file needs another player or is rebuilt, and what a file's audio
 * track is. Nothing here is shown as it is.
 */

/** One reason in a method note or an incompatibility. `value`: the format it names, upper-cased ("AVI", "AC3"), when it names one. */
export type PlaybackReason =
  | { kind: "container" | "video" | "audio" | "bitrate" | "subtitles"; value: string | null }
  | { kind: "audioToAac" | "audioToOpus" | "videoToH264"; value: string | null }
  | { kind: "rebuilt" | "noMse" | "serverCopy" | "serverEncode" | "slowDevice" | "noEncoder" | "other"; value: null };

const JELLYFIN: Record<string, PlaybackReason["kind"]> = {
  ContainerNotSupported: "container",
  ContainerBitrateExceedsLimit: "bitrate",
  VideoCodecNotSupported: "video",
  VideoProfileNotSupported: "video",
  VideoLevelNotSupported: "video",
  VideoResolutionNotSupported: "video",
  VideoBitDepthNotSupported: "video",
  VideoFramerateNotSupported: "video",
  VideoRangeTypeNotSupported: "video",
  VideoBitrateNotSupported: "bitrate",
  AudioCodecNotSupported: "audio",
  AudioChannelsNotSupported: "audio",
  AudioProfileNotSupported: "audio",
  AudioSampleRateNotSupported: "audio",
  AudioBitDepthNotSupported: "audio",
  AudioBitrateNotSupported: "bitrate",
  SubtitleCodecNotSupported: "subtitles",
};

const upper = (s: string | undefined) => (s ? s.trim().toUpperCase() : null);

/**
 * The reasons in an engine's note: "container avi", "audio dts", "video hevc 10-bit", "audio ac3 → AAC in the
 * browser", "rebuilt in the browser", "no Media Source Extensions", Jellyfin's "AudioCodecNotSupported, …". Anything
 * else is one "other" reason — never shown in the engine's words.
 */
export function playbackReasons(note: string | null | undefined): PlaybackReason[] {
  if (!note) return [];
  const out: PlaybackReason[] = [];
  for (const part of note.split(/\s*,\s*/).filter(Boolean)) {
    const jf = JELLYFIN[part];
    if (jf) {
      if (!out.some((r) => r.kind === jf)) out.push({ kind: jf, value: null } as PlaybackReason);
      continue;
    }
    const converted = /^audio (\S+) → (AAC|Opus) in the browser$/i.exec(part);
    const encoded = /^video (\S+) → H\.264 in the browser$/i.exec(part);
    const named = /^(container|video|audio) (.+)$/i.exec(part);
    if (converted) out.push({ kind: converted[2]!.toLowerCase() === "opus" ? "audioToOpus" : "audioToAac", value: upper(converted[1]) });
    else if (encoded) out.push({ kind: "videoToH264", value: upper(encoded[1]) });
    else if (/^slow device$/i.test(part)) out.push({ kind: "slowDevice", value: null });
    else if (/^no video encoder$/i.test(part)) out.push({ kind: "noEncoder", value: null });
    else if (/^rebuilt in the browser$/i.test(part)) out.push({ kind: "rebuilt", value: null });
    else if (/^server: video copied$/i.test(part)) out.push({ kind: "serverCopy", value: null });
    else if (/^server: video → H\.264$/i.test(part)) out.push({ kind: "serverEncode", value: null });
    else if (/^no Media Source Extensions$/i.test(part)) out.push({ kind: "noMse", value: null });
    else if (named) {
      const value = named[2]!.trim();
      out.push({ kind: named[1]!.toLowerCase() as "container" | "video" | "audio", value: value === "unknown" ? null : value.toUpperCase().replace(/(\d+)-BIT$/, "$1-bit") });
    } else if (!out.some((r) => r.kind === "other")) out.push({ kind: "other", value: null });
  }
  return out;
}

// The track language codes live in ./languages (the servers' scans use them too); kept importable from here.
export { languageCode };

/** What one audio track of a file is, from its language tag and its title ("Dub (Пифагор) AAC", "MVO (HDrezka Studio)"). */
export interface AudioTrackFacts {
  language: string | null;
  /** Its translation as the title names it (kind, studio), when it names one. */
  track: ReleaseTrack | null;
  /** The title itself when it says something the facts don't ("Commentary"), else null. */
  title: string | null;
}

// Words a track title adds that are only its format, not what it is.
const FORMAT_ONLY = /^(?:[\s|,.()[\]+–-]|aac|ac-?3|e-?ac-?3|eac3|dts(?:-hd)?(?: ma)?|truehd|atmos|flac|opus|mp3|pcm|lpcm|dd\+?|ddp|stereo|mono|surround|\d\.\d|\d+ ?kbps|\d+ ?kbit\/s|ch|default|forced|по умолчанию|за замовчуванням|стерео|моно)*$/iu;

export function audioTrackFacts(title: string | null | undefined, languageTag: string | null | undefined, originalLanguage: string | null = null): AudioTrackFacts {
  const own = languageCode(languageTag);
  const name = (title ?? "").trim();
  const parsed = name ? parseRelease(name, null, originalLanguage) : null;
  const track = parsed?.tracks.find((t) => t.original || t.voice || t.studio || t.credit) ?? null;
  const language = own ?? track?.language ?? parsed?.languages[0] ?? null;
  // The title is shown only when the facts don't cover it: not a translation, and more than its language or format.
  const leftover = name.replace(LANGUAGE_WORDS, " ");
  return { language, track, title: !track && name && !FORMAT_ONLY.test(leftover) ? name : null };
}

const LANGUAGE_WORDS = /(?<![\p{L}\d])(?:rus|ukr|eng|jpn|russian|ukrainian|english|japanese|русский|украинский|українська|английский|японский)(?![\p{L}\d])/giu;
