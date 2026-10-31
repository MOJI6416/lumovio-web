import { describe, expect, it } from "vitest";
import { parseSlugId, slugify, titleHref } from "../src/lib/slug";


import { safeNext } from "../src/lib/safe-next";

describe("slugs", () => {
  it("keeps non-Latin scripts readable", () => {
    expect(slugify("Бойцовский клуб")).toBe("бойцовский-клуб");
    expect(slugify("Amélie & Co.")).toBe("amelie-co");
  });
  it("builds and parses title URLs", () => {
    expect(titleHref("movie", 550, "Fight Club")).toBe("/title/movie/550-fight-club");
    expect(parseSlugId("550-fight-club")).toBe(550);
    expect(parseSlugId("abc")).toBeNull();
  });
});

describe("post-login redirects (no open redirects)", () => {
  it("accepts same-site relative paths only", () => {
    expect(safeNext("/library")).toBe("/library");
    expect(safeNext("https://evil.example/")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
  it("drops a locale prefix so the destination is not localized twice", () => {
    expect(safeNext("/ru/search?mode=ai")).toBe("/search?mode=ai");
    expect(safeNext("/uk")).toBe("/");
    expect(safeNext("/ru?x=1")).toBe("/?x=1");
    expect(safeNext("/rules")).toBe("/rules");
  });
});
