import { describe, expect, it } from "vitest";
import { canRemuxInBrowser, containerName, type PlaybackCapabilities } from "../src/lib/media/capabilities";
import { type AudioCoders, choosePlayback, remuxAudioRoute } from "../src/lib/media/playback-choice";
import { compatibleMime } from "../src/lib/media/remux";

// Capabilities as the browsers report them (tmp/player-compat/caps.json, 2026-10-25) or, for phones that weren't
// available, as their platform documents them: the iPhone has only ManagedMediaSource (iOS 17.1+), or nothing.
const chrome: PlaybackCapabilities = {
  video: { h264: true, hevc: true, av1: true, vp9: true, h264High10: true },
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
const noHevc: PlaybackCapabilities = { ...chrome, video: { ...chrome.video, hevc: false, h264High10: false } };
const firefox: PlaybackCapabilities = { ...chrome, video: { ...chrome.video, h264High10: false }, mseAudio: { ...chrome.mseAudio, mp3: true }, platform: "firefox/windows" };
const iphone: PlaybackCapabilities = {
  ...chrome,
  video: { h264: true, hevc: true, av1: false, vp9: false, h264High10: false },
  audio: { aac: true, mp3: true, opus: true, flac: true, ac3: true, eac3: true, dts: false, truehd: false, vorbis: false },
  containers: { mp4: true, webm: false, mkv: "no", ts: false, mov: true },
  hls: "native",
  mediaSource: "managed",
  mseAudio: { aac: true, mp3: true, opus: true, flac: true, ac3: true, eac3: true, dts: false },
  platform: "safari/ios",
};
const iphoneWithoutMms: PlaybackCapabilities = { ...iphone, mse: false, mediaSource: "none" };

const coders = (enc: { aac: boolean; opus: boolean }, dec: string[] = ["aac", "mp3", "opus", "flac", "vorbis"]): AudioCoders => ({
  encodes: async (c) => enc[c],
  decodes: async (c) => dec.includes(c),
});
const chromeCoders = coders({ aac: true, opus: true });
const firefoxCoders = coders({ aac: false, opus: true });
const none = coders({ aac: false, opus: false }, []);

const mkv = (videoCodec: string, audioCodec: string | null, bitDepth = 8) => ({ container: "matroska,webm", videoCodec, audioCodec, bitDepth });
const mp4 = { container: "mov,mp4,m4a,3gp,3g2,mj2", videoCodec: "h264", audioCodec: "aac" };

describe("canRemuxInBrowser", () => {
  it("rebuilds MKV with AC-3 or E-AC-3 when the video plays here", () => {
    expect(canRemuxInBrowser(chrome, mkv("h264", "ac3")).ok).toBe(true);
    expect(canRemuxInBrowser(chrome, mkv("h264", "eac3")).ok).toBe(true);
    expect(canRemuxInBrowser(iphone, mkv("hevc", "ac3", 10)).ok).toBe(true);
  });
  it("can't fix the video, AVI, or audio it has no way with", () => {
    expect(canRemuxInBrowser(noHevc, mkv("hevc", "ac3"))).toEqual({ ok: false, reason: "video hevc" });
    expect(canRemuxInBrowser(noHevc, mkv("h264", "aac", 10)).ok).toBe(false);
    expect(canRemuxInBrowser(chrome, { container: "avi", videoCodec: "mpeg4", audioCodec: "mp3" })).toEqual({ ok: false, reason: "container avi" });
    expect(canRemuxInBrowser(chrome, mkv("h264", "pcm_bluray"))).toEqual({ ok: false, reason: "audio pcm_bluray" });
    // TrueHD and DTS are decoded in WASM now.
    expect(canRemuxInBrowser(chrome, mkv("h264", "truehd")).ok).toBe(true);
    expect(canRemuxInBrowser(chrome, mkv("h264", "dts")).ok).toBe(true);
  });
  it("needs a Media Source: the standard one or the iPhone's ManagedMediaSource", () => {
    expect(canRemuxInBrowser(iphone, mkv("h264", "aac")).ok).toBe(true);
    expect(canRemuxInBrowser(iphoneWithoutMms, mkv("h264", "aac"))).toEqual({ ok: false, reason: "no Media Source Extensions" });
  });
});

describe("remuxAudioRoute", () => {
  it("copies what Media Source takes as it is: AAC everywhere, AC-3/E-AC-3/FLAC on an iPhone", async () => {
    expect(await remuxAudioRoute(chrome, "aac", none)).toBe("copy");
    expect(await remuxAudioRoute(chrome, "flac", none)).toBe("copy");
    expect(await remuxAudioRoute(iphone, "ac3", none)).toBe("copy");
    expect(await remuxAudioRoute(iphone, "eac3", none)).toBe("copy");
    expect(await remuxAudioRoute(chrome, null, none)).toBe("copy");
  });
  it("converts AC-3/E-AC-3 to AAC (its own decoder), or to Opus where there's no AAC encoder (Firefox)", async () => {
    expect(await remuxAudioRoute(chrome, "ac3", chromeCoders)).toBe("aac");
    expect(await remuxAudioRoute(firefox, "eac3", firefoxCoders)).toBe("opus");
    // No WebCodecs encoder at all (iPhones before iOS 26): AAC in WASM.
    expect(await remuxAudioRoute(chrome, "ac3", none)).toBe("aac");
    expect(await remuxAudioRoute({ ...chrome, mseAudio: { ...chrome.mseAudio, aac: false, opus: false } }, "ac3", chromeCoders)).toBeNull();
  });
  it("decodes in WASM what WebCodecs can't: DTS, TrueHD, and MP3/FLAC/Vorbis without a WebCodecs decoder", async () => {
    expect(await remuxAudioRoute(chrome, "mp3", chromeCoders)).toBe("aac");
    expect(await remuxAudioRoute(chrome, "mp3", coders({ aac: true, opus: true }, []))).toBe("aac");
    expect(await remuxAudioRoute(chrome, "dts", chromeCoders)).toBe("aac");
    expect(await remuxAudioRoute(firefox, "dts", firefoxCoders)).toBe("opus");
    expect(await remuxAudioRoute({ ...chrome, mseAudio: { ...chrome.mseAudio, dts: true } }, "dts", none)).toBe("copy");
    expect(await remuxAudioRoute(chrome, "truehd", chromeCoders)).toBe("aac");
    expect(await remuxAudioRoute(iphone, "truehd", none)).toBe("aac");
    expect(await remuxAudioRoute(chrome, "pcm_bluray", chromeCoders)).toBeNull();
  });
});

describe("choosePlayback (the corpus' formats, per browser)", () => {
  it("Chrome: plays MKV/MP4 with AAC as they are, rebuilds AC-3, DTS and TrueHD, sends AVI and VC-1 to another app", async () => {
    expect(await choosePlayback(chrome, mp4, {}, chromeCoders)).toEqual({ path: "direct" });
    expect(await choosePlayback(chrome, mkv("h264", "aac"), {}, chromeCoders)).toEqual({ path: "direct" });
    expect(await choosePlayback(chrome, mkv("hevc", "aac", 10), {}, chromeCoders)).toEqual({ path: "direct" });
    expect(await choosePlayback(chrome, mkv("h264", "ac3"), {}, chromeCoders)).toEqual({ path: "remux", audio: "aac" });
    expect(await choosePlayback(chrome, mkv("av1", "eac3", 10), {}, chromeCoders)).toEqual({ path: "remux", audio: "aac" });
    // No H.264 encoder here (Node has no WebCodecs): the AVI engine can't run.
    expect(await choosePlayback(chrome, { container: "avi", videoCodec: "mpeg4", audioCodec: "ac3" }, {}, chromeCoders)).toEqual({ path: "external", reason: "container avi, no video encoder" });
    expect(await choosePlayback(chrome, mkv("h264", "dts"), {}, chromeCoders)).toEqual({ path: "remux", audio: "aac" });
    expect(await choosePlayback(chrome, mkv("hevc", "truehd", 10), {}, chromeCoders)).toEqual({ path: "remux", audio: "aac" });
    expect(await choosePlayback(chrome, mkv("vc1", "ac3"), {}, chromeCoders)).toEqual({ path: "external", reason: "video vc1" });
  });
  it("old AVI: decoded here (Xvid, DivX 3, MPEG-2) at standard definition, with an H.264 encoder and Media Source", async () => {
    const g = globalThis as { VideoEncoder?: unknown };
    g.VideoEncoder = class {};
    try {
      const avi = (videoCodec: string, audioCodec: string, height = 304) => ({ container: "avi", videoCodec, audioCodec, width: 720, height });
      expect(await choosePlayback(chrome, avi("mpeg4", "ac3"), {}, chromeCoders)).toEqual({ path: "legacy", audio: "aac" });
      expect(await choosePlayback(firefox, avi("msmpeg4v3", "mp3"), {}, firefoxCoders)).toEqual({ path: "legacy", audio: "opus" });
      expect(await choosePlayback(iphone, avi("mpeg2video", "mp2"), {}, none)).toEqual({ path: "legacy", audio: "aac" });
      expect(await choosePlayback(chrome, avi("mpeg4", "mp3", 720), {}, chromeCoders)).toEqual({ path: "external", reason: "container avi, video mpeg4 720×720" });
      expect(await choosePlayback(chrome, avi("h264", "aac"), {}, chromeCoders)).toEqual({ path: "external", reason: "container avi, video h264" });
      expect(await choosePlayback(chrome, avi("mpeg4", "dts"), {}, chromeCoders)).toEqual({ path: "external", reason: "container avi, audio dts" });
      expect(await choosePlayback(iphoneWithoutMms, avi("mpeg4", "mp3"), {}, none)).toEqual({ path: "external", reason: "container avi, no Media Source Extensions" });
    } finally {
      delete g.VideoEncoder;
    }
  });
  it("another audio track than the default, or a password stream without the service worker: rebuilt", async () => {
    expect(await choosePlayback(chrome, mkv("h264", "aac"), { otherTrack: true }, chromeCoders)).toEqual({ path: "remux", audio: "copy" });
    expect(await choosePlayback(chrome, mp4, { noBridge: true }, chromeCoders)).toEqual({ path: "remux", audio: "copy" });
    // Nothing can be rebuilt: the plain stream stays (the player then says the service worker is missing).
    expect(await choosePlayback(iphoneWithoutMms, mp4, { noBridge: true }, none)).toEqual({ path: "direct" });
  });
  it("Firefox: AC-3 and E-AC-3 come out as Opus", async () => {
    expect(await choosePlayback(firefox, mkv("h264", "ac3"), {}, firefoxCoders)).toEqual({ path: "remux", audio: "opus" });
    expect(await choosePlayback(firefox, mkv("h264", "aac", 10), {}, firefoxCoders)).toEqual({ path: "external", reason: "video h264 10-bit" });
  });
  it("iPhone with ManagedMediaSource: MKV is rebuilt, AC-3/E-AC-3 copied (no conversion)", async () => {
    expect(await choosePlayback(iphone, mkv("h264", "aac"), {}, none)).toEqual({ path: "remux", audio: "copy" });
    expect(await choosePlayback(iphone, mkv("h264", "ac3"), {}, none)).toEqual({ path: "remux", audio: "copy" });
    expect(await choosePlayback(iphone, mkv("hevc", "eac3", 10), {}, none)).toEqual({ path: "remux", audio: "copy" });
    expect(await choosePlayback(iphone, mp4, {}, none)).toEqual({ path: "direct" });
    expect(await choosePlayback(iphone, mkv("av1", "eac3", 10), {}, none)).toEqual({ path: "external", reason: "container mkv, video av1 10-bit" });
    expect(await choosePlayback(iphone, mkv("h264", "flac", 10), {}, none)).toEqual({ path: "external", reason: "container mkv, video h264 10-bit" });
  });
  it("iPhone without it: MKV can't play here, and both reasons are said", async () => {
    expect(await choosePlayback(iphoneWithoutMms, mkv("h264", "ac3"), {}, none)).toEqual({ path: "external", reason: "container mkv, no Media Source Extensions" });
    expect(await choosePlayback(iphoneWithoutMms, mp4, {}, none)).toEqual({ path: "direct" });
  });
  it("a file ffprobe couldn't read: decided by its container", async () => {
    const unread = (container: string) => ({ container, videoCodec: null, audioCodec: null, probed: false });
    expect(await choosePlayback(chrome, unread("mkv"), {}, chromeCoders)).toEqual({ path: "direct" });
    expect(await choosePlayback(iphone, unread("mkv"), {}, none)).toEqual({ path: "remux", audio: "copy" });
    expect(await choosePlayback(chrome, unread("avi"), {}, chromeCoders)).toEqual({ path: "external", reason: "container avi" });
    expect(await choosePlayback(iphone, unread("mp4"), {}, none)).toEqual({ path: "direct" });
  });
});

describe("containerName and compatibleMime", () => {
  it("names containers as people know them", () => {
    expect(containerName("matroska,webm")).toBe("mkv");
    expect(containerName("mov,mp4,m4a,3gp,3g2,mj2")).toBe("mp4");
    expect(containerName("avi")).toBe("avi");
    expect(containerName("mpegts")).toBe("ts");
    expect(containerName(null)).toBe("unknown");
  });
  it("gives Media Source the HEVC, FLAC and Opus names it takes", () => {
    const only = (...ok: string[]) => (t: string) => ok.includes(t);
    expect(compatibleMime('video/mp4; codecs="hev1.2.4.L93.90, mp4a.40.2"', only('video/mp4; codecs="hvc1.2.4.L93.90, mp4a.40.2"'))).toBe('video/mp4; codecs="hvc1.2.4.L93.90, mp4a.40.2"');
    expect(compatibleMime('video/mp4; codecs="avc1.64001e, flac"', only('video/mp4; codecs="avc1.64001e, fLaC"'))).toBe('video/mp4; codecs="avc1.64001e, fLaC"');
    expect(compatibleMime('video/mp4; codecs="avc1.64001e, ac-3"', only('video/mp4; codecs="avc1.64001e, ac-3"'))).toBe('video/mp4; codecs="avc1.64001e, ac-3"');
    // Nothing fits: the type as it is, and Media Source says why.
    expect(compatibleMime('video/mp4; codecs="avc1.64001e, dtsc"', only())).toBe('video/mp4; codecs="avc1.64001e, dtsc"');
  });
});
