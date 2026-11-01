import type { Availability } from "@lumovio/contracts";
import { describe, expect, it } from "vitest";
import type { PlaybackCapabilities } from "../src/lib/media/capabilities";
import { audioLanguages, languageCode } from "../src/lib/media/languages";
import { languageRank, orderedSources, sourceRank } from "../src/lib/media/source-order";

/** Jellyfin and Plex copies' audio languages (roadmap Stage 7 «Jellyfin track languages»): read, stored, ranked. */
describe("audio languages of a server's tracks", () => {
  it("are ISO 639-1, each once, untagged tracks left out", () => {
    expect(audioLanguages(["rus", "eng", "rus", "und", null, "ukr"])).toEqual(["ru", "en", "uk"]);
    expect(audioLanguages(["ger", "deu", "fre", "tur", "pt-BR"])).toEqual(["de", "fr", "tr", "pt"]);
    expect(languageCode("RUS")).toBe("ru");
    expect(languageCode("mul")).toBeNull();
  });
});

const copy = (externalId: string, quality: Availability["quality"], kind: Availability["kind"] = "jellyfin"): Availability => ({
  connectionId: "c",
  kind,
  connectionName: "Home",
  externalId,
  label: null,
  season: null,
  episode: null,
  quality,
});

const caps = {
  video: { h264: true, h264High10: false, hevc: false, av1: false, vp9: true },
  audio: { aac: true, mp3: true, opus: true, flac: true, ac3: false, eac3: false, vorbis: true },
  containers: { mp4: true, webm: true, mkv: "maybe", mov: false },
  maxHeight: 2160,
} as unknown as PlaybackCapabilities;

describe("copies in the profile's audio language start first", () => {
  const en = copy("en", { container: "mp4", videoCodec: "h264", audioCodecs: ["aac"], audioLanguages: ["en"] });
  const ru = copy("ru", { container: "mkv", videoCodec: "hevc", audioCodecs: ["ac3"], audioLanguages: ["ru", "en"] });
  const torrent = copy("t".repeat(40), null, "torrserver");

  it("ranks a known language above an unknown one, and an unknown one above another language", () => {
    expect(languageRank({ server: ru }, ["ru"])).toBe(0);
    expect(languageRank({ server: torrent }, ["ru"])).toBe(1);
    expect(languageRank({ server: en }, ["ru"])).toBe(2);
    expect(languageRank({ server: en }, [])).toBe(1);
  });

  it("puts the Russian copy first for a Russian profile, playable or not; keeps the server's order without languages", () => {
    const a = { servers: [en, torrent, ru], connections: 1, sources: [] };
    expect(orderedSources(a, caps, ["ru"]).map((x) => x.server.externalId)).toEqual(["ru", torrent.externalId, "en"]);
    expect(orderedSources(a, caps).map((x) => x.server.externalId)).toEqual(["en", torrent.externalId, "ru"]);
  });

  it("calls a series' entry with only its languages unknown, not a transcode", () => {
    expect(sourceRank(caps, { server: copy("show", { audioLanguages: ["ru"] }) })).toBe(2);
  });
});
