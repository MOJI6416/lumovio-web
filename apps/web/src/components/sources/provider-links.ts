/*
 * Where a streaming service's own search for a title is (TTL-12): TMDB gives its offers by provider id without a link
 * to the service, so "Watch" opens the service's search for the title's name — only for the services whose search
 * address is stable and public. Others have no "Watch" of their own: the section links TMDB's offers page once.
 */
const SEARCH: Record<number, (q: string) => string> = {
  8: (q) => `https://www.netflix.com/search?q=${q}`, // Netflix
  9: (q) => `https://www.primevideo.com/search/?phrase=${q}`, // Amazon Prime Video
  119: (q) => `https://www.primevideo.com/search/?phrase=${q}`, // Amazon Prime Video (some regions)
  10: (q) => `https://www.primevideo.com/search/?phrase=${q}`, // Amazon Video (rent, buy)
  2: (q) => `https://tv.apple.com/search?term=${q}`, // Apple TV (store)
  350: (q) => `https://tv.apple.com/search?term=${q}`, // Apple TV+
  3: (q) => `https://play.google.com/store/search?q=${q}&c=movies`, // Google Play Movies
  192: (q) => `https://www.youtube.com/results?search_query=${q}`, // YouTube
  283: (q) => `https://www.crunchyroll.com/search?q=${q}`, // Crunchyroll
  117: (q) => `https://www.kinopoisk.ru/index.php?kp_query=${q}`, // Kinopoisk
  11: (q) => `https://mubi.com/search/films?query=${q}`, // MUBI
};

/** The service's search for this title, or null when there is no address we can vouch for. */
export function providerSearch(providerId: number, title: string): string | null {
  const make = SEARCH[providerId];
  return make ? make(encodeURIComponent(title)) : null;
}
