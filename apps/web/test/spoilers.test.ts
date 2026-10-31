import { describe, expect, it } from "vitest";
import { episodesOpen } from "../src/lib/spoilers";

describe("episodes open without spoilers (design-system 8.12)", () => {
  it("opens nothing while the library state is unknown or empty", () => {
    expect(episodesOpen(undefined)(1, 1)).toBe(false);
    expect(episodesOpen([])(1, 1)).toBe(false);
    expect(episodesOpen([])(0, 1)).toBe(false);
  });

  it("opens everything up to the last watched episode, gaps in the marks included", () => {
    const open = episodesOpen(["s1e1", "s2e3"]);
    expect([open(1, 1), open(1, 9), open(2, 1), open(2, 3)]).toEqual([true, true, true, true]);
    expect([open(2, 4), open(3, 1)]).toEqual([false, false]);
  });

  it("opens a marked episode after the last one in order only by itself", () => {
    const open = episodesOpen(["s1e2", "s3e5"]);
    expect(open(3, 5)).toBe(true);
    expect(open(3, 6)).toBe(false);
    expect(open(2, 7)).toBe(true);
  });

  it("opens a special only when it is marked, and specials don't move the last watched episode", () => {
    const open = episodesOpen(["s0e4", "s1e2"]);
    expect(open(0, 4)).toBe(true);
    expect(open(0, 1)).toBe(false);
    expect(open(1, 2)).toBe(true);
    expect(open(1, 3)).toBe(false);
    expect(episodesOpen(["s0e9"])(1, 1)).toBe(false);
  });

  it("ignores keys it can't read", () => {
    expect(episodesOpen(["tv:1", "s2"])(1, 1)).toBe(false);
  });
});
