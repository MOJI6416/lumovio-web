import { describe, expect, it } from "vitest";
import { audioTrackFacts, languageCode, playbackReasons } from "../src/lib/media/explain";

describe("playbackReasons", () => {
  it("reads the engines' notes as facts, never as text to show", () => {
    expect(playbackReasons("container avi")).toEqual([{ kind: "container", value: "AVI" }]);
    expect(playbackReasons("audio dts")).toEqual([{ kind: "audio", value: "DTS" }]);
    expect(playbackReasons("video hevc 10-bit")).toEqual([{ kind: "video", value: "HEVC 10-bit" }]);
    expect(playbackReasons("audio ac3 → AAC in the browser")).toEqual([{ kind: "audioToAac", value: "AC3" }]);
    expect(playbackReasons("audio eac3 → Opus in the browser")).toEqual([{ kind: "audioToOpus", value: "EAC3" }]);
    // An iPhone without Media Source: the container and the missing rebuild, both said.
    expect(playbackReasons("container mkv, no Media Source Extensions")).toEqual([
      { kind: "container", value: "MKV" },
      { kind: "noMse", value: null },
    ]);
    expect(playbackReasons("rebuilt in the browser")).toEqual([{ kind: "rebuilt", value: null }]);
    expect(playbackReasons("container unknown")).toEqual([{ kind: "container", value: null }]);
    expect(playbackReasons("no Media Source Extensions")).toEqual([{ kind: "noMse", value: null }]);
  });
  it("reads Jellyfin's transcode reasons, one per kind", () => {
    expect(playbackReasons("AudioCodecNotSupported, AudioChannelsNotSupported, ContainerNotSupported")).toEqual([
      { kind: "audio", value: null },
      { kind: "container", value: null },
    ]);
  });
  it("gives one 'other' for anything it doesn't know, and nothing for no note", () => {
    expect(playbackReasons("something new happened, and another")).toEqual([{ kind: "other", value: null }]);
    expect(playbackReasons(null)).toEqual([]);
  });
});

describe("audio track facts", () => {
  it("reads a dubbing's language, kind and studio from the track's own tags", () => {
    const f = audioTrackFacts("Dub (Пифагор) AAC", "rus");
    expect([f.language, f.track?.voice, f.track?.studio, f.title]).toEqual(["ru", "dub", "Пифагор", null]);
    const h = audioTrackFacts("MVO (HDrezka Studio)", null);
    expect([h.language, h.track?.voice, h.track?.studio]).toEqual(["ru", "mvo", "HDrezka Studio"]);
  });
  it("takes the tag's language over the title's guess, and keeps a title the facts don't cover", () => {
    expect(audioTrackFacts("Original", "eng", "en")).toMatchObject({ language: "en", track: { original: true }, title: null });
    expect(audioTrackFacts("Commentary", "eng")).toMatchObject({ language: "en", track: null, title: "Commentary" });
    // A studio not on the known list, in square brackets as files title tracks: its name is kept.
    expect(audioTrackFacts("MVO [Novamedia]", "rus")).toMatchObject({ language: "ru", track: { voice: "mvo", studio: null, credit: "Novamedia" } });
    expect(audioTrackFacts("MVO [LostFilm]", "rus")).toMatchObject({ track: { voice: "mvo", studio: "LostFilm" } });
    expect(audioTrackFacts("English AC3 5.1", "eng")).toMatchObject({ language: "en", track: null, title: null });
    expect(audioTrackFacts(null, "ukr")).toMatchObject({ language: "uk", track: null, title: null });
  });
  it("turns three-letter tags into two-letter codes", () => {
    expect([languageCode("rus"), languageCode("UKR"), languageCode("und"), languageCode("en"), languageCode(null)]).toEqual(["ru", "uk", null, "en", null]);
  });
});

describe("server-composed track titles", () => {
  it("drop what is only format or the default flag", () => {
    expect(audioTrackFacts("AAC - Stereo - По умолчанию", null)).toMatchObject({ language: null, track: null, title: null });
    expect(audioTrackFacts("Rus - AAC - Stereo - Default", "rus")).toMatchObject({ language: "ru", track: null, title: null });
  });
});
