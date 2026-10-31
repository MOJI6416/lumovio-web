import type { Availability, SourceState, TitleAvailability } from "@lumovio/contracts";
import { describe, expect, it } from "vitest";
import { watchState } from "../src/lib/watch-state";

const source = (over: Partial<SourceState> = {}): SourceState => ({ id: "c1", kind: "jellyfin", name: "Home", status: "ok", indexed: true, ...over });
const copy = (connectionId: string): Availability => ({ connectionId, kind: "jellyfin", connectionName: "Home", externalId: "x", label: null, season: null, episode: null, quality: null });
const avail = (over: Partial<TitleAvailability> = {}): TitleAvailability => ({ servers: [], connections: 0, sources: [], ...over });

describe("watch state", () => {
  it("is loading until availability arrives, and an error is not 'nothing there'", () => {
    expect(watchState(undefined, { signedIn: true })).toEqual({ kind: "loading" });
    expect(watchState(undefined, { signedIn: true, failed: true })).toEqual({ kind: "error" });
  });

  it("plays from the profile's servers, counting every copy", () => {
    const a = avail({ servers: [copy("c1"), copy("c2")], connections: 2, sources: [source(), source({ id: "c2" })] });
    expect(watchState(a, { signedIn: true })).toEqual({ kind: "playable", copies: 2 });
  });

  it("counts a series' torrents, not the files bound to its episodes", () => {
    const torrent = (externalId: string, season: number | null = null, episode: number | null = null): Availability => ({ ...copy("t1"), kind: "torrserver", externalId, season, episode });
    const a = avail({ servers: [torrent("aa:2", 1, 2), torrent("aa"), torrent("bb:3", 2, 3), torrent("bb")], connections: 1, sources: [source({ id: "t1", kind: "torrserver" })] });
    expect(watchState(a, { signedIn: true })).toEqual({ kind: "playable", copies: 2 });
  });

  it("never promises a personal copy to a guest", () => {
    expect(watchState(avail(), { signedIn: false })).toEqual({ kind: "guest" });
  });

  it("separates no servers, no copy, an unreachable server and a server still indexing", () => {
    expect(watchState(avail(), { signedIn: true })).toEqual({ kind: "noServers" });
    expect(watchState(avail({ connections: 1, sources: [source()] }), { signedIn: true })).toEqual({ kind: "notInLibrary", servers: 1 });
    expect(watchState(avail({ connections: 2, sources: [source(), source({ id: "c2", name: "NAS", status: "unreachable" })] }), { signedIn: true })).toEqual({ kind: "unreachable", names: ["NAS"] });
    expect(watchState(avail({ connections: 1, sources: [source({ indexed: false })] }), { signedIn: true })).toEqual({ kind: "indexing", names: ["Home"] });
  });
});
