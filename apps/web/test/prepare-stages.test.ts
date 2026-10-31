import { describe, expect, it } from "vitest";
import { stagesFor, stageState } from "../src/lib/media/prepare-stages";

describe("preparation stages (TS4)", () => {
  it("a release picked from search goes through every stage, the add first", () => {
    expect(stagesFor({ provider: "torrserver", bound: false }, { added: true, episode: false })).toEqual(["add", "files", "file", "probe", "play"]);
  });

  it("a torrent file already chosen for this film or episode skips the file list", () => {
    expect(stagesFor({ provider: "torrserver", bound: true }, { added: false, episode: true })).toEqual(["file", "probe", "play"]);
  });

  it("Jellyfin and Plex look an episode up, a film goes straight to the file check; nothing is added there", () => {
    expect(stagesFor({ provider: "jellyfin", bound: false }, { added: true, episode: true })).toEqual(["file", "probe", "play"]);
    expect(stagesFor({ provider: "plex", bound: false }, { added: false, episode: false })).toEqual(["probe", "play"]);
  });

  it("stages before the current one are done, after it ahead", () => {
    const p = { stages: stagesFor({ provider: "torrserver", bound: false }, { added: true, episode: false }), at: "file" as const, facts: {} };
    expect(p.stages.map((s) => stageState(p, s))).toEqual(["done", "done", "current", "ahead", "ahead"]);
  });
});
