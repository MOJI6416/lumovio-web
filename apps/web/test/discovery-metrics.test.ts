import { describe, expect, it } from "vitest";
import { discoveryPage } from "../src/lib/discovery-metrics";

describe("discoveryPage", () => {
  it("names home, the section landings, title pages, and the rest", () => {
    expect(discoveryPage("/ru")).toBe("home");
    expect(discoveryPage("/uk/browse/movie")).toBe("movie");
    expect(discoveryPage("/en/browse/tv")).toBe("tv");
    expect(discoveryPage("/ru/anime")).toBe("anime");
    expect(discoveryPage("/ru/title/movie/438631-dune")).toBe("title");
    expect(discoveryPage("/ru/library")).toBe("other");
    expect(discoveryPage("/ruler")).toBe("other");
    expect(discoveryPage("/de/browse/movie")).toBe("movie");
    expect(discoveryPage("/pt-BR")).toBe("home");
  });

  it("carries the page's comparison arm, and nothing else the API might send", () => {
    expect(discoveryPage("/", "lift_a")).toBe("home_lift_a");
    expect(discoveryPage("/ru/browse/movie", "lift_b")).toBe("movie_lift_b");
    expect(discoveryPage("/ru/title/movie/1-x", "lift_b")).toBe("title");
    expect(discoveryPage("/", "anything")).toBe("home");
    // Fits the counters' page key (contracts DiscoveryEvents: ^[a-z_]{1,24}$).
    expect(discoveryPage("/anime", "lift_b")).toMatch(/^[a-z_]{1,24}$/);
  });
});
