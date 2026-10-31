import { describe, expect, it } from "vitest";
import { type HoldReasons, rotates, SlideClock } from "@/lib/rotation";

const S = 1000;

describe("SlideClock", () => {
  it("a hover at 5 s of 9 s holds the slide, then only the remaining 4 s are left", () => {
    const c = new SlideClock(9 * S);
    c.resume(0);
    c.pause(5 * S); // pointer enters
    expect(c.remaining(25 * S)).toBe(4 * S); // 20 s of hover cost nothing
    expect(c.progress(25 * S)).toBeCloseTo(5 / 9);
    c.resume(25 * S); // pointer leaves
    expect(c.remaining(27 * S)).toBe(2 * S);
    expect(c.remaining(29 * S)).toBe(0);
  });

  it("several pauses add up only the time on screen", () => {
    const c = new SlideClock(9 * S);
    c.resume(0);
    c.pause(2 * S);
    c.resume(10 * S);
    c.pause(13 * S); // pause button
    c.resume(40 * S);
    c.pause(41 * S); // tab hidden
    c.resume(100 * S);
    expect(c.shown(100 * S)).toBe(6 * S);
    expect(c.remaining(100 * S)).toBe(3 * S);
  });

  it("repeated pause or resume calls do not double count", () => {
    const c = new SlideClock(9 * S);
    c.resume(0);
    c.resume(3 * S);
    c.pause(4 * S);
    c.pause(8 * S);
    expect(c.shown(20 * S)).toBe(4 * S);
  });

  it("a new slide starts a full interval", () => {
    const c = new SlideClock(9 * S);
    c.resume(0);
    c.pause(7 * S);
    c.reset();
    expect(c.remaining(7 * S)).toBe(9 * S);
    expect(c.progress(7 * S)).toBe(0);
  });
});

describe("hold reasons are independent", () => {
  const none: HoldReasons = { paused: false, hover: false, focus: false, hidden: false, reduced: false };

  it("rotates only with more than one slide and no reason to hold", () => {
    expect(rotates(5, none)).toBe(true);
    expect(rotates(1, none)).toBe(false);
  });

  it("the pointer leaving does not resume while focus, the pause button or a hidden tab still holds it", () => {
    for (const reason of ["focus", "paused", "hidden", "reduced"] as const) {
      expect(rotates(5, { ...none, hover: false, [reason]: true })).toBe(false);
    }
  });
});
