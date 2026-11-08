import { describe, expect, it } from "vitest";
import { mediaFailure } from "@/lib/media/stream-break";

// S1: F1's WEB-DL x264 played 6.8 s, then MEDIA_ERR_DECODE — it was shown as "the browser can't decode H264".
describe("a media error after the picture went (S1)", () => {
  it("is the file's before the first frame", () => {
    expect(mediaFailure(3, 0, null)).toBe("file");
    expect(mediaFailure(4, 0, null)).toBe("file");
    expect(mediaFailure(null, 120, null)).toBe("file");
    expect(mediaFailure(4, 120, null)).toBe("file");
  });

  it("is the stream that broke after it: once quietly from the place, then said as one", () => {
    expect(mediaFailure(3, 6.8, null)).toBe("resume");
    expect(mediaFailure(2, 6.8, null)).toBe("resume");
    expect(mediaFailure(3, 9, 6.8)).toBe("broke");
    // Much later the same source breaks again elsewhere: one more quiet restart.
    expect(mediaFailure(3, 900, 6.8)).toBe("resume");
  });
});
