import { describe, expect, it } from "vitest";
import { canDirectPlay, type PlaybackCapabilities } from "../src/lib/media/capabilities";
import { resolutionLabel } from "../src/lib/media/jellyfin";
import { episodeOf, parseSize, pickMovieFile } from "../src/lib/media/torrserver";

const chrome: PlaybackCapabilities = {
  video: { h264: true, hevc: false, av1: true, vp9: true, h264High10: false },
  audio: { aac: true, mp3: true, opus: true, flac: true, ac3: false, eac3: false, dts: false, truehd: false, vorbis: true },
  containers: { mp4: true, webm: true, mkv: "likely", ts: false, mov: true },
  hls: "mse",
  mse: true,
  mediaSource: "standard",
  mseAudio: { aac: true, mp3: false, opus: true, flac: true, ac3: false, eac3: false, dts: false },
  hdr: false,
  dolbyVision: false,
  maxHeight: 1080,
  pip: true,
  platform: "chromium/windows",
};
const safari: PlaybackCapabilities = { ...chrome, video: { ...chrome.video, hevc: true }, audio: { ...chrome.audio, ac3: true, eac3: true }, containers: { ...chrome.containers, mkv: "no" }, hls: "native" };

describe("canDirectPlay", () => {
  it("plays H.264/AAC MP4 everywhere", () => {
    expect(canDirectPlay(chrome, { container: "mp4", videoCodec: "h264", audioCodec: "aac" }).ok).toBe(true);
    expect(canDirectPlay(safari, { container: "mp4", videoCodec: "h264", audioCodec: "aac" }).ok).toBe(true);
  });
  it("rejects AC3 audio where the browser can't decode it (silent video otherwise)", () => {
    const v = canDirectPlay(chrome, { container: "mkv", videoCodec: "h264", audioCodec: "ac3" });
    expect(v.ok).toBe(false);
    expect(v.ok ? "" : v.reason).toContain("audio");
  });
  it("respects container support (MKV not on Safari)", () => {
    expect(canDirectPlay(safari, { container: "matroska,webm", videoCodec: "h264", audioCodec: "aac" }).ok).toBe(false);
  });
  it("rejects 10-bit H.264 without High 10 support and HEVC without HEVC support", () => {
    expect(canDirectPlay(chrome, { container: "mp4", videoCodec: "h264", audioCodec: "aac", bitDepth: 10 }).ok).toBe(false);
    expect(canDirectPlay(chrome, { container: "mp4", videoCodec: "hevc", audioCodec: "aac" }).ok).toBe(false);
    expect(canDirectPlay(safari, { container: "mp4", videoCodec: "hevc", audioCodec: "eac3" }).ok).toBe(true);
  });
  it("never direct-plays MPEG-TS progressive files", () => {
    expect(canDirectPlay(chrome, { container: "mpegts", videoCodec: "h264", audioCodec: "aac" }).ok).toBe(false);
  });
});

describe("torrent helpers", () => {
  it("detects episode numbers in common naming schemes", () => {
    expect(episodeOf("Show.S02E05.1080p.mkv")).toEqual({ season: 2, episode: 5 });
    expect(episodeOf("Show/Season 1/show - 1x07 - name.mp4")).toEqual({ season: 1, episode: 7 });
    // Without a season anywhere it stays unknown instead of being assumed to be season 1.
    expect(episodeOf("[Group] Anime - Ep 12 [1080p].mkv")).toEqual({ season: null, episode: 12 });
    expect(episodeOf("Movie.2019.mkv")).toBeNull();
  });
  it("prefers the browser-playable copy of the same film over a bigger one", () => {
    const files = [
      { id: 2, path: "BBB/big_buck_bunny.avi", length: 332e6 },
      { id: 4, path: "BBB/big_buck_bunny.mp4", length: 62e6 },
      { id: 5, path: "BBB/big_buck_bunny.ogv", length: 47e6 },
      { id: 1, path: "BBB/meta.xml", length: 1e3 },
    ];
    expect(pickMovieFile(files)).toMatchObject({ status: "match", file: { id: 4 } });
  });
  it("parses torznab sizes given as bytes or TorrServer's humanized text", () => {
    expect(parseSize(1536)).toBe(1536);
    expect(parseSize("19.7 GCiB")).toBe(Math.round(19.7 * 1024 ** 3));
    expect(parseSize("700 MiB")).toBe(700 * 1024 ** 2);
    expect(parseSize("")).toBeNull();
    expect(parseSize(undefined)).toBeNull();
  });
});

describe("resolutionLabel", () => {
  it("classifies scope films by width", () => {
    expect(resolutionLabel(1920, 818)).toBe("1080p");
    expect(resolutionLabel(3840, 1600)).toBe("2160p");
    expect(resolutionLabel(1280, 720)).toBe("720p");
  });
});

describe("skip segments and trickplay", () => {
  it("maps Jellyfin media segments (ticks) and drops tiny or unknown ones", async () => {
    const { parseSegments } = await import("../src/lib/media/jellyfin");
    const T = 10_000_000;
    expect(
      parseSegments([
        { Type: "Outro", StartTicks: 1300 * T, EndTicks: 1400 * T },
        { Type: "Intro", StartTicks: 30 * T, EndTicks: 95 * T },
        { Type: "Unknown", StartTicks: 0, EndTicks: 10 * T },
        { Type: "Recap", StartTicks: 0, EndTicks: 2 * T },
      ]),
    ).toEqual([
      { kind: "intro", start: 30, end: 95 },
      { kind: "outro", start: 1300, end: 1400 },
    ]);
  });
  it("maps Plex intro / credits markers (milliseconds)", async () => {
    const { plexSegments } = await import("../src/lib/media/plex");
    expect(plexSegments([{ type: "credits", startTimeOffset: 2_500_000, endTimeOffset: 2_600_000 }, { type: "intro", startTimeOffset: 60_000, endTimeOffset: 120_000 }])).toEqual([
      { kind: "intro", start: 60, end: 120 },
      { kind: "outro", start: 2500, end: 2600 },
    ]);
  });
  it("picks the trickplay width closest to 320 px for the playing source", async () => {
    const { pickTrickplay } = await import("../src/lib/media/jellyfin");
    const tile = (w: number) => ({ Width: w, Height: Math.round(w / 1.78), TileWidth: 10, TileHeight: 10, ThumbnailCount: 60, Interval: 10000 });
    const map = { a: { "160": tile(160), "320": tile(320), "640": tile(640) }, b: { "1280": tile(1280) } };
    expect(pickTrickplay(map, "a")?.key).toBe("320");
    expect(pickTrickplay(map, "missing")?.key).toBe("320");
    expect(pickTrickplay(undefined, "a")).toBeNull();
  });
});
