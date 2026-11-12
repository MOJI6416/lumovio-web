/*
 * The seasons and episodes a release name states (TS5): its own module, so the places that only ask whether a copy holds
 * a season (the title's copies, lib/watch-state) don't load the whole release ranking (./releases).
 */

export interface PackInfo {
  /** Seasons the name states (S01-02, Season 2, Сезон: 1, 1-3 сезоны), or anime cours (TV-1,2) when `cours`. */
  seasons: { from: number; to: number } | null;
  /** The numbers are anime cours ("TV-2"), which trackers count apart from TMDB's seasons. */
  cours: boolean;
  /**
   * Episodes the name states: a range (1-47 из 47, E01-E05, S02E01-05) or one (S02E03); `of`: the total it gives, if
   * any; `open`: a range that runs on ("S2E1- из 10", an updating pack); `bySeason`: numbered within a season (SxxEyy,
   * 2x05), never across the series as an anime's "1-47 из 47" may be.
   */
  episodes: { from: number; to: number; of: number | null; open?: true; bySeason?: true } | null;
}

const spanOf = (nums: number[]) => (nums.length ? { from: Math.min(...nums), to: Math.max(...nums) } : null);

/**
 * The seasons and episodes a release name states, as trackers write them. Nothing is inferred: a name
 * without them gives nulls. Episode numbers are the name's own (anime packs count across cours).
 */
export function packOf(name: string): PackInfo {
  const t = name.replace(/[._]/g, " ");
  // "S02E01-09", "S02E01-E09", a whole series "S1-8E1-73" or "S01E01-S08E73" (episodes counted across its seasons);
  // never a year after a dash as the range's end (Kinozal's "S2E1 - 2026" is one episode).
  const se = /(?<![\p{L}\d])s(\d{1,2})(?:\s*[-–]\s*s?(\d{1,2}))?\s?e(\d{1,4})(?:\s*[-–]\s*(?:e|s(\d{1,2})\s?e)?(?!(?:19|20)\d\d(?!\d))(\d{1,4}))?(?!\d)/iu.exec(t);
  // "02x01-10", "2x05": season × episode, as some trackers write it (never a "1920x1080" frame size).
  const sx = se ? null : /(?<![\p{L}\d])(\d{1,2})x(\d{2,3})(?:\s*[-–]\s*(?:\d{1,2}x)?(\d{2,3}))?(?!\d)/iu.exec(t);
  let seasons: number[] = [];
  let cours = false;
  let episodes: PackInfo["episodes"] = null;
  if (se) {
    seasons = [Number(se[1]), Number(se[2] ?? se[4] ?? se[1])];
    const after = t.slice(se.index + se[0].length);
    // A range that runs on, as an updating pack writes it: "S2E1- из 10", "(S2E1-)" — a dash right after the number with
    // nothing after it, never a separator ("S2E1 - Risky Business").
    const open = se[5] === undefined && /^[-–]\s*(?:(?:из|of|з)\s*\d|[)\]]|$)/iu.test(after);
    // The total right after the range: "S5E1-5 of 10", "S02E01-08 из 10", "S2E1- из 10".
    const of = /^\s*(?:[-–]\s*)?(?:из|of|з)\s*(\d{1,4})(?!\d)/iu.exec(after);
    episodes = { from: Number(se[3]), to: Number(se[5] ?? se[3]), of: of ? Number(of[1]) : null, ...(open ? { open: true as const } : {}), bySeason: true };
  } else if (sx) {
    seasons = [Number(sx[1])];
    const of = /^\s*(?:из|of|з)\s*(\d{1,4})(?!\d)/iu.exec(t.slice(sx.index + sx[0].length));
    episodes = { from: Number(sx[2]), to: Number(sx[3] ?? sx[2]), of: of ? Number(of[1]) : null, bySeason: true };
  } else {
    for (const m of t.matchAll(/(?<![\p{L}\d])s(\d{1,2})(?:\s*[-–]\s*s?(\d{1,2}))?(?![\p{L}\d])/giu)) seasons.push(Number(m[1]), Number(m[2] ?? m[1]));
    for (const m of t.matchAll(/(?:seasons?|сезоны?|сезони|сезон)\s*:?\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?(?!\d)/giu)) seasons.push(Number(m[1]), Number(m[2] ?? m[1]));
    for (const m of t.matchAll(/(?<!\d)(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?(?:-?(?:й|ий))?\s*(?:сезон\p{L}*|seasons?)(?![\p{L}])/giu)) seasons.push(Number(m[1]), Number(m[2] ?? m[1]));
  }
  if (seasons.length === 0) {
    const tv = /(?<![\p{L}\d])tv[-\s]?(\d{1,2}(?:\s*[,+\-–]\s*\d{1,2})*)(?!\d)/iu.exec(t);
    if (tv) {
      seasons = tv[1]!.split(/[,+\-–]/).map(Number);
      cours = true;
    }
  }
  if (!episodes) {
    const of = /(?<![\d.])(\d{1,4})\s*[-–]\s*(\d{1,4})\s*(?:из|of|з)\s*(\d{1,4}|xx|\?\?)(?!\d)/iu.exec(t);
    const named = /(?<!\p{L})(?:серии|серія|серії|эпизоды|епізоди|episodes|eps?)\s*:?\s*(\d{1,4})\s*[-–]\s*(\d{1,4})(?!\d)/iu.exec(t);
    const e = /(?<![\p{L}\d])e(\d{1,4})\s*[-–]\s*e?(\d{1,4})(?!\d)/iu.exec(t);
    const m = of ?? named ?? e;
    if (m) episodes = { from: Number(m[1]), to: Number(m[2]), of: of && /^\d+$/.test(of[3]!) ? Number(of[3]) : null };
  }
  return { seasons: spanOf(seasons), cours, episodes };
}

/**
 * Whether a release holds a season by its name: false only when it names seasons (not anime cours)
 * and the wanted one isn't among them, null when the name doesn't say. With a wanted `episode`, also false when the
 * name numbers one season's episodes as SxxEyy and the episode isn't among them ("S2E1 of 10" — an updating pack's
 * first episode — for the third); other numbering decides nothing (packs count across the whole series, an open
 * range runs on). The file itself is matched when it's read.
 */
export function holdsSeason(pack: PackInfo, season: number, episode: number | null = null): boolean | null {
  if (!pack.seasons || pack.cours) return null;
  if (season < pack.seasons.from || season > pack.seasons.to) return false;
  const e = pack.episodes;
  if (episode !== null && e?.bySeason && !e.open && pack.seasons.from === pack.seasons.to && (episode < e.from || episode > e.to)) return false;
  return true;
}

/**
 * A whole torrent holds a series' season unless its release name says it holds others only (docs/torrserver-2026-11.md,
 * 20): a season-1 pack is no copy of season 2, so the title searches for season 2 and the player doesn't offer season 1's
 * files. A server's copy (Jellyfin, Plex) isn't judged by a name.
 */
export function holdsByName(s: { kind: string; label: string | null }, season: number): boolean {
  return s.kind !== "torrserver" || !s.label || holdsSeason(packOf(s.label), season) !== false;
}

/** The copies of a series' season (`holdsByName`), as `titleCopies` and `useTitleAvailability` take them; null for a film. */
export const seasonCopies = (season: number | null | undefined) => (season == null ? null : (s: { kind: string; label: string | null }) => holdsByName(s, season));
