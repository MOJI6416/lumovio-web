import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { releaseKey } from "@/lib/media/releases";

// A12: a Jackett link carries the account's jackett_apikey; the rows of the sources screen (site and TV) keep a key
// without it in the DOM, and the TV's focus memory saves that key to sessionStorage.
const jackett = {
  title: "F1 (2025) WEB-DL 1080p",
  link: "http://ts.example:9117/dl/rutracker/?jackett_apikey=SECRETKEY&path=abc&file=F1",
  hash: null,
  tracker: "RuTracker",
  size: 7_000_000_000,
};

describe("a release's key on the page (A12)", () => {
  it("never carries the link or its key", () => {
    expect(releaseKey(jackett)).not.toContain("SECRETKEY");
    expect(releaseKey(jackett)).not.toContain(jackett.link);
    expect(releaseKey({ ...jackett, hash: "ABCDEF0123456789ABCDEF0123456789ABCDEF01" })).toBe("abcdef0123456789abcdef0123456789abcdef01");
  });

  it("is what the site's and the TV's rows put in data-key and data-*, never the link", () => {
    for (const file of ["src/components/tvui/sources/TvFinder.tsx", "src/components/sources/ReleaseFinder.tsx"]) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(/data-[a-z-]+=\{[^}]*\.link\b/);
      expect(src).not.toMatch(/data-key=\{`\$\{r\.link\}/);
    }
  });
});
