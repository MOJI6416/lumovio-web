import { afterEach, describe, expect, it, vi } from "vitest";
import { jellyfinClient } from "../src/lib/media/jellyfin";

/** Import history from Jellyfin (C134): what the sign-in played, read on the device, an episode by its series. */
describe("Jellyfin history", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists played films and episodes, each episode with its series' name, year and ids", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        const body = url.includes("Filters=IsPlayed")
          ? {
              TotalRecordCount: 3,
              Items: [
                { Id: "m1", Name: "Sintel", Type: "Movie", ProductionYear: 2010, ProviderIds: { Tmdb: "45745", Imdb: "tt1727587" }, UserData: { Played: true, LastPlayedDate: "2026-10-20T19:00:00Z" } },
                { Id: "e1", Name: "Pilot", Type: "Episode", SeriesId: "s1", ParentIndexNumber: 1, IndexNumber: 1, UserData: { Played: true } },
                { Id: "e2", Name: "Special", Type: "Episode", SeriesId: "s1", IndexNumber: 4, UserData: { Played: true } },
              ],
            }
          : { Items: [{ Id: "s1", Name: "Breaking Bad", Type: "Series", ProductionYear: 2008, ProviderIds: { Tvdb: "81189", Tmdb: "1396" } }] };
        return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
      }),
    );
    const client = jellyfinClient("https://jf.example.org", { userId: "u", accessToken: "t" });
    const items = await client.history!(() => {});
    expect(items).toEqual([
      { kind: "movie", title: "Sintel", year: 2010, ids: { tmdb: "45745", imdb: "tt1727587", tvdb: undefined }, season: null, episode: null, watchedAt: "2026-10-20T19:00:00Z" },
      // The episode without a season number is left out; the series is fetched once by its id.
      { kind: "episode", title: "Breaking Bad", year: 2008, ids: { tmdb: "1396", imdb: undefined, tvdb: "81189" }, season: 1, episode: 1, watchedAt: null },
    ]);
    expect(calls.filter((u) => u.includes("Ids=s1"))).toHaveLength(1);
  });
});
