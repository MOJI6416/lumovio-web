import { describe, expect, it } from "vitest";
import { backdropSrcSet } from "@/lib/images";

/** The width a browser picks from a `w`-descriptor srcset for a slot of `need` device pixels. */
const pick = (srcset: string, need: number) => {
  const c = srcset.split(", ").map((s) => {
    const [url, w] = s.split(" ");
    return { url: url!, w: Number.parseInt(w!, 10) };
  });
  return (c.find((x) => x.w >= need) ?? c.at(-1)!).url.split("/")[5];
};

describe("backdropSrcSet", () => {
  const set = backdropSrcSet("/abc.jpg")!;

  it("a 1080p screen or TV gets TMDB's 1920 px copy, not the 4K original", () => {
    expect(pick(set, 1920)).toBe("w1920");
    expect(pick(set, 1536)).toBe("w1920");
  });

  it("only screens needing more than 1920 device pixels get the original", () => {
    expect(pick(set, 3840)).toBe("original");
    expect(pick(set, 2560)).toBe("original");
  });

  it("phones keep the small copies", () => {
    expect(pick(set, 780)).toBe("w780");
    expect(pick(set, 1170)).toBe("w1280");
  });

  it("no path, no srcset", () => {
    expect(backdropSrcSet(null)).toBeUndefined();
  });
});
