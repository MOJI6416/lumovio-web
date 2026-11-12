import { describe, expect, it } from "vitest";
import { QUIET_RETRY_MS, remuxFailure, retriesQuietly } from "../src/lib/media/remux-failure";

describe("remuxFailure: what a rebuilt playback's failure was", () => {
  it("is the data when Media Source or the engine's reader couldn't parse what was read", () => {
    // Chrome, a damaged piece of a torrent at the first fragment of a rebuild.
    expect(remuxFailure("CHUNK_DEMUXER_ERROR_APPEND_FAILED: Failed to prepare video sample for decode")).toBe("data");
    expect(remuxFailure("DEMUXER_ERROR_COULD_NOT_PARSE: mp4 parse failed")).toBe("data");
    expect(remuxFailure("NS_ERROR_DOM_MEDIA_DEMUXER_ERR (0x806e000c)")).toBe("data");
    // Mediabunny reading a damaged Matroska block.
    expect(remuxFailure("Invalid EBML lacing: bad frame size.")).toBe("data");
  });

  it("is the browser when it can't do the rebuild at all", () => {
    expect(remuxFailure("can't rebuild audio pcm_s16le in this browser")).toBe("browser");
    expect(remuxFailure("can't rebuild this file in the browser (undecodable_source_codec)")).toBe("browser");
    expect(remuxFailure("no Media Source Extensions")).toBe("browser");
    expect(remuxFailure("Failed to execute 'addSourceBuffer' on 'MediaSource': The type provided ('video/mp4; codecs=\"hev1.2.4.L153.B0\"') is unsupported.")).toBe("browser");
    expect(remuxFailure("Input has an unsupported or unrecognizable format.")).toBe("browser");
    expect(remuxFailure("CHUNK_DEMUXER_ERROR_APPEND_FAILED: Audio codec is not supported")).toBe("browser");
  });

  it("is something else for a decoder that gave up or the engine itself", () => {
    expect(remuxFailure("PIPELINE_ERROR_DECODE: video decode error")).toBe("other");
    expect(remuxFailure("QuotaExceededError")).toBe("other");
    expect(remuxFailure("")).toBe("other");
  });
});

describe("retriesQuietly: a failed rebuild starts again once, without an error screen", () => {
  const now = 1_000_000;

  it("starts the first failure again at once", () => {
    expect(retriesQuietly("data", undefined, now)).toBe(true);
    expect(retriesQuietly("other", undefined, now)).toBe(true);
  });

  it("says a failure that comes again soon after the retry: the place doesn't read", () => {
    expect(retriesQuietly("data", now - 5_000, now)).toBe(false);
    expect(retriesQuietly("data", now - QUIET_RETRY_MS + 1, now)).toBe(false);
  });

  it("starts a later failure again too: it is another place", () => {
    expect(retriesQuietly("data", now - QUIET_RETRY_MS, now)).toBe(true);
  });

  it("never repeats what the browser can't do", () => {
    expect(retriesQuietly("browser", undefined, now)).toBe(false);
  });
});
