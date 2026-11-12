import { describe, expect, it } from "vitest";
import { sweepPick } from "../src/lib/media/torrent-sweep";

const now = Date.parse("2026-11-12T12:00:00Z");
const daysAgo = (d: number) => now - d * 86_400_000;
const t = (hash: string, over: Partial<{ claimedAt: number | null; active: boolean }> = {}) => ({ hash, claimedAt: daysAgo(1), active: false, ...over });
const v = (stale: string[], indexed: string[], any = false) => ({ stale: new Set(stale), indexed: new Set(indexed), any });

describe("sweepPick", () => {
  it("removes Lumovio's torrents the API calls done with — not one an older mark may sit on, never one playing", () => {
    const list = [t("a"), t("old-mark", { claimedAt: null }), t("c", { active: true }), t("d")];
    expect(sweepPick(list, v(["a", "old-mark", "c"], ["a", "old-mark", "c", "d"]), now)).toEqual(["a"]);
  });

  it("removes the server's other torrents of titles too when the person turned it on, still not one playing", () => {
    const list = [t("a"), t("mine", { claimedAt: null }), t("playing", { claimedAt: null, active: true })];
    expect(sweepPick(list, v(["a", "mine", "playing"], ["a", "mine", "playing"], true), now)).toEqual(["a", "mine"]);
  });

  it("removes Lumovio's torrent linked to nothing a week after it brought it, never anyone else's", () => {
    const list = [t("old", { claimedAt: daysAgo(8) }), t("new", { claimedAt: daysAgo(2) }), t("theirs", { claimedAt: null })];
    expect(sweepPick(list, v([], [], true), now)).toEqual(["old"]);
  });

  it("keeps a linked torrent the API didn't name, however old", () => {
    expect(sweepPick([t("x", { claimedAt: daysAgo(90) })], v([], ["x"], true), now)).toEqual([]);
  });
});
