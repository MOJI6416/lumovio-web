/**
 * Which episodes of a series are open — nothing about them hidden as a spoiler (design-system 8.12): every episode up
 * to the last watched one of the regular seasons, by season and episode number, so gaps in the marks don't hide what
 * was seen; and any marked one, specials included. An unknown library state (loading, a guest) opens nothing, so a
 * spoiler is hidden first and shown after, never the other way round. Keys are `watchedEpisodes`' `s{season}e{episode}`.
 */
export function episodesOpen(watched: readonly string[] | undefined): (season: number, episode: number) => boolean {
  const set = new Set(watched ?? []);
  let last = { season: 0, episode: 0 };
  for (const k of set) {
    const m = /^s(\d+)e(\d+)$/.exec(k);
    if (!m) continue;
    const season = Number(m[1]);
    const episode = Number(m[2]);
    if (season > 0 && (season > last.season || (season === last.season && episode > last.episode))) last = { season, episode };
  }
  return (season, episode) =>
    set.has(`s${season}e${episode}`) || (season > 0 && (season < last.season || (season === last.season && episode <= last.episode)));
}
