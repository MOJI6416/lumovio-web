import { describe, expect, it } from "vitest";
import { discoveryPage } from "../src/lib/discovery-metrics";

describe("discoveryPage", () => {
  it("names home, the section landings and their watch-now mode, title pages, and the rest", () => {
    expect(discoveryPage("/ru", "")).toBe("home");
    expect(discoveryPage("/", "?watch=now")).toBe("home_now");
    expect(discoveryPage("/uk/browse/movie", "")).toBe("movie");
    expect(discoveryPage("/en/browse/tv", "?watch=now")).toBe("tv_now");
    expect(discoveryPage("/ru/anime", "")).toBe("anime");
    expect(discoveryPage("/ru/title/movie/438631-dune", "")).toBe("title");
    expect(discoveryPage("/ru/library", "")).toBe("other");
    expect(discoveryPage("/ruler", "")).toBe("other");
  });
});
