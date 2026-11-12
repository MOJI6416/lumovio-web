import { creditsStudio, isDubbing, parseRelease, withFileTracks } from "./releases";
import { type CopyAudio, scanAudio } from "./source-order";

/**
 * A copy's audio for ordering copies (`orderedSources`): a TorrServer copy's by its release name and the tracks the
 * player read in its file (`quality.audioTracks`) — "6x MVO" gets its studios from the file — else its server's scan.
 * Its own module: it brings the release-name parser, which a title's first load leaves to its lazy parts.
 */
export const copyAudio: CopyAudio = (s) => {
  if (s.kind !== "torrserver") return scanAudio(s);
  if (!s.label) return null;
  const name = s.label;
  const info = withFileTracks(parseRelease(name), s.quality?.audioTracks);
  if (info.languages.length === 0 && info.studios.length === 0) return null;
  return {
    languages: info.languages,
    credits: (studio) =>
      isDubbing(studio) ? info.voice === "dub" || info.tracks.some((t) => t.voice === "dub") : creditsStudio(name, studio) || info.tracks.some((t) => t.studio !== null && creditsStudio(t.studio, studio)),
  };
};
