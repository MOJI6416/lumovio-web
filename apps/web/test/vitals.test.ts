import { describe, expect, it } from "vitest";
import { statOf } from "../src/components/perf/PerfMeter";
import { pageGroup } from "../src/lib/vitals";

describe("page groups of the field speed counts", () => {
  it("knows the kind of page in every interface language", () => {
    expect(pageGroup("/", false)).toBe("home");
    expect(pageGroup("/de", false)).toBe("home");
    expect(pageGroup("/pt-BR/browse/movie", false)).toBe("section");
    expect(pageGroup("/ru/anime", false)).toBe("section");
    expect(pageGroup("/tr/title/movie/27205-inception", false)).toBe("title");
    expect(pageGroup("/uk/watch/tv/1?s=1&e=1", false)).toBe("watch");
    expect(pageGroup("/settings/notifications", false)).toBe("settings");
    expect(pageGroup("/fr/lists/abc", false)).toBe("list");
    expect(pageGroup("/legal/privacy", false)).toBe("other");
    expect(pageGroup("/title/movie/1", true)).toBe("tv");
  });
});

describe("the speed meter's figures", () => {
  it("p50, p95, p99 and max of the samples, rounded", () => {
    const s = statOf(Array.from({ length: 100 }, (_, i) => i + 1.4));
    expect(s).toEqual({ n: 100, p50: 50, p95: 95, p99: 99, max: 100 });
    expect(statOf([])).toBeNull();
    expect(statOf([42])).toEqual({ n: 1, p50: 42, p95: 42, p99: 42, max: 42 });
  });
});
