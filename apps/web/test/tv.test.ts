import { describe, expect, it } from "vitest";
import { entryIndex, nearest } from "../src/components/tvui/nav/engine";
import { isTvMode, isTvUserAgent, tvAppVersion, tvShellPath } from "../src/lib/tv";

/*
 * The TV shell (TV document §4.1, §5, §12): which device gets it, where an address is answered, and the remote's
 * choice of the next item.
 */

const TIZEN = "Mozilla/5.0 (SMART-TV; LINUX; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) 94.0.4606.31/7.0 TV Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const APP = `Mozilla/5.0 (Linux; Android 11; BRAVIA) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 LumovioTV/1.0 (AndroidTV)`;

describe("TV mode", () => {
  it("is chosen by the TV app always, then by the device's choice, then by a TV's user agent", () => {
    expect(tvAppVersion(APP)).toBe("1.0");
    expect(isTvMode("0", APP)).toBe(true);
    expect(isTvMode(undefined, TIZEN)).toBe(true);
    expect(isTvMode("0", TIZEN)).toBe(false);
    expect(isTvMode("1", DESKTOP)).toBe(true);
    expect(isTvMode(undefined, DESKTOP)).toBe(false);
    expect(isTvUserAgent(null)).toBe(false);
  });
});

describe("TV addresses", () => {
  it("keeps the address and answers it in the TV tree", () => {
    expect(tvShellPath("/")).toBe("/tvui");
    expect(tvShellPath("/title/movie/550-fight-club")).toBe("/tvui/title/movie/550-fight-club");
    expect(tvShellPath("/settings/connections")).toBe("/tvui/settings/connections");
  });
  it("sends sign-in pages to the code screen and leaves the code confirmation and the showcase to the site", () => {
    expect(tvShellPath("/auth/sign-in")).toBe("/tvui/tv");
    expect(tvShellPath("/link")).toBeNull();
    expect(tvShellPath("/dev/ui")).toBeNull();
  });
  it("doesn't nest the TV tree in itself", () => {
    expect(tvShellPath("/tvui/search")).toBe("/tvui/search");
  });
});

const box = (left: number, top: number, w = 100, h = 150) => ({ left, top, right: left + w, bottom: top + h });

describe("the remote's next item", () => {
  it("prefers what is straight ahead over something nearer aside", () => {
    const from = box(0, 0);
    const ahead = { box: box(0, 400), value: "ahead" };
    const aside = { box: box(260, 200), value: "aside" };
    expect(nearest(from, [aside, ahead], "down")).toBe("ahead");
  });
  it("only looks the way it goes", () => {
    const from = box(500, 0);
    expect(nearest(from, [{ box: box(100, 0), value: "left" }], "right")).toBeNull();
    expect(nearest(from, [{ box: box(100, 0), value: "left" }], "left")).toBe("left");
  });
  it("enters a shelf at the remembered card, else under the same column among those on screen", () => {
    const shelf = [box(0, 600), box(120, 600), box(240, 600), box(360, 600), box(2000, 600)];
    const view = { width: 1920, height: 1080 };
    expect(entryIndex(shelf, box(250, 300), "down", 3, view)).toBe(3);
    expect(entryIndex(shelf, box(250, 300), "down", -1, view)).toBe(2);
    // Off screen cards don't take the entry even if the column matches.
    expect(entryIndex(shelf, box(2000, 300), "down", -1, view)).toBe(3);
  });
});
