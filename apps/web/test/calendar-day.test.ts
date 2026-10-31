import { afterEach, describe, expect, it } from "vitest";
import { eventDay, hasAired } from "../src/lib/format";

describe("calendar days in the viewer's time zone", () => {
  const tz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = tz;
  });

  // Law & Order: SVU S28E3 on NBC: Thursday 22 Oct 2026, 21:00 Eastern = 01:00 UTC on the 23rd.
  const svu = { date: "2026-10-22", airstamp: "2026-10-23T01:00:00.000Z" };

  it("moves an exact air time into the viewer's day", () => {
    process.env.TZ = "America/New_York";
    expect(eventDay(svu)).toBe("2026-10-22");
    process.env.TZ = "Europe/Kyiv";
    expect(eventDay(svu)).toBe("2026-10-23");
    process.env.TZ = "Asia/Tokyo";
    expect(eventDay(svu)).toBe("2026-10-23");
  });

  it("keeps a date-only release on its published date everywhere", () => {
    const slowHorses = { date: "2026-10-21", airstamp: null };
    for (const zone of ["America/Los_Angeles", "Europe/Kyiv", "Pacific/Auckland"]) {
      process.env.TZ = zone;
      expect(eventDay(slowHorses)).toBe("2026-10-21");
    }
  });

  it("calls an episode out only once its start has passed", () => {
    expect(hasAired(svu, new Date("2026-10-23T00:59:00Z"))).toBe(false);
    expect(hasAired(svu, new Date("2026-10-23T01:00:00Z"))).toBe(true);
  });
});
