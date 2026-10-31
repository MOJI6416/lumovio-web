/**
 * TV genres TMDB actually files anime series under: each had 30+ Japanese animated series with 30+
 * votes on 2026-10-23. News, reality, soap, talk, documentary and western had none or one.
 */
export const ANIME_GENRES = new Set([10759, 10765, 35, 18, 9648, 80, 10768, 10751, 10762]);

/**
 * Movie genres for anime films (CAT-02: the series list gave 0 results there), by the same rule: each had
 * 30+ Japanese animated films with 30+ votes on 2026-10-24. Documentary, western, history, music and war had
 * 0–27; animation itself is implied.
 */
export const ANIME_MOVIE_GENRES = new Set([28, 12, 35, 80, 18, 10751, 14, 27, 9648, 10749, 878, 10770, 53]);
