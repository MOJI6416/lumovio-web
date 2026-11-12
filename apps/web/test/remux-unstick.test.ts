import { describe, expect, it } from "vitest";
import { unstick } from "../src/lib/media/remux";

describe("unstick: a rebuilt playhead stopped with media buffered past it", () => {
  it("waits when nothing is buffered past it: media is still coming", () => {
    expect(unstick(10, [], null)).toBeNull();
    expect(unstick(11.8, [[0, 12]], null)).toBeNull();
    expect(unstick(12, [[0, 12]], null)).toBeNull();
  });

  it("steps over a hole of up to a second just ahead, to where the media goes on", () => {
    // In the hole itself, as a series' rebuild once stopped: 14.3 s with the next stretch from 14.45 s.
    const jump = (s: ReturnType<typeof unstick>) => (s && "jump" in s ? s.jump : null);
    expect(jump(unstick(14.3, [[0, 11.4], [14.45, 56]], null))).toBeCloseTo(14.46);
    // At the very end of a stretch, the next one a moment later.
    expect(jump(unstick(11.96, [[0, 12], [12.5, 40]], null))).toBeCloseTo(12.51);
  });

  it("starts the rebuild again from the playhead past a longer hole, or when it stopped inside buffered media", () => {
    expect(unstick(11.97, [[0, 12], [14, 40]], null)).toEqual({ restart: 11.97 });
    expect(unstick(14.2, [[0, 11.4], [12, 65.9]], null)).toEqual({ restart: 14.2 });
  });

  it("goes 2 s on when it already restarted at that place, so a spot left out every time is passed", () => {
    expect(unstick(14.4, [[14, 65.9]], 14.2)).toEqual({ restart: 16.4 });
    expect(unstick(30, [[14, 65.9]], 14.2)).toEqual({ restart: 30 });
  });
});
