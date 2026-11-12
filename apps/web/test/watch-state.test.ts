import type { Availability, SourceState, TitleAvailability } from "@lumovio/contracts";
import { describe, expect, it } from "vitest";
import { startEpisode, watchHref } from "../src/components/title/core";
import { seasonCopies } from "../src/lib/media/packs";
import { titleCopies, watchState } from "../src/lib/watch-state";

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

  // docs/torrserver-2026-11.md, 20: a season-1 pack is no copy of season 2 — the title searches for season 2 instead.
  it("doesn't count a whole torrent whose name holds other seasons only as a copy of the season asked for", () => {
    const pack = (label: string, externalId: string): Availability => ({ ...copy("t1"), kind: "torrserver", externalId, label });
    const a = avail({ servers: [pack("La Casa de Papel - S1 - rus 1080p WEBDL (LostFilm)", "aa"), pack("Some Show (2017) WEB-DL 1080p", "bb")], connections: 1, sources: [source({ id: "t1", kind: "torrserver" })] });
    expect(titleCopies(a, seasonCopies(1)).servers.map((s) => s.externalId)).toEqual(["aa", "bb"]);
    // A name that says nothing of seasons may hold any of them.
    expect(titleCopies(a, seasonCopies(2)).servers.map((s) => s.externalId)).toEqual(["bb"]);
    expect(watchState(avail({ ...a, servers: [a.servers[0]!] }), { signedIn: true, holds: seasonCopies(2) })).toEqual({ kind: "notInLibrary", servers: 1 });
    expect(watchState(avail({ ...a, servers: [a.servers[0]!] }), { signedIn: true })).toEqual({ kind: "playable", copies: 1 });
    // Server copies (Jellyfin, Plex) aren't judged by a release name.
    expect(titleCopies(avail({ servers: [{ ...copy("c1"), label: "Show S1" }] }), seasonCopies(2)).servers).toHaveLength(1);
    // A film: every copy counts.
    expect(seasonCopies(null)).toBeNull();
  });
});

describe("the episode a series' Watch starts", () => {
  const show = { kind: "tv" as const, tmdbId: 1, seasons: [1, 2, 3].map((n) => ({ seasonNumber: n, name: `S${n}`, episodeCount: 10, airDate: null, posterPath: null, overview: null })) };
  const progress = (season: number, episode: number, over: Record<string, unknown> = {}) => ({ season, episode, positionSec: 600, durationSec: 2400, completed: false, updatedAt: "2026-11-12T00:00:00Z", ...over }) as never;
  it("follows a season picked in Episodes: its first episode, unless the profile is in it", () => {
    expect(startEpisode(show, progress(1, 5))).toEqual({ season: 1, episode: 5 });
    expect(startEpisode(show, progress(1, 5), 2)).toEqual({ season: 2, episode: 1 });
    expect(startEpisode(show, progress(1, 5), 1)).toEqual({ season: 1, episode: 5 });
    expect(startEpisode(show, undefined, 3)).toEqual({ season: 3, episode: 1 });
    // A season the series doesn't have changes nothing.
    expect(startEpisode(show, undefined, 9)).toEqual({ season: 1, episode: 1 });
    expect(watchHref(show, progress(1, 5), 2)).toBe("/watch/tv/1?s=2&e=1");
  });
  it("goes on to the next season after a season's last episode, not to an episode that doesn't exist", () => {
    expect(startEpisode(show, progress(1, 10, { completed: true }))).toEqual({ season: 2, episode: 1 });
    expect(startEpisode(show, progress(1, 4, { completed: true }))).toEqual({ season: 1, episode: 5 });
    // The last season's last episode: nothing after it is known, as before.
    expect(startEpisode(show, progress(3, 10, { completed: true }))).toEqual({ season: 3, episode: 11 });
  });
});
