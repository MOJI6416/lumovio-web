import { type PictureVersion, pictureVersions, type RankedRelease, type ReleasePrefs, type VoiceOption, voiceKeys, voiceOptions } from "./releases";

/*
 * What "Where to watch" offers to watch from a TorrServer search (design-system 7.15): one release, and the three
 * choices that lead to another — the audio, the cut of the film and the picture — each narrowing the one before it,
 * as Plex's Version / Audio pickers do before Play. The title hero's "Watch" starts the same pick with no choice made
 * (TorrentProbe), so both always say the same thing (TTL-06).
 */

/** A cut of the film as release names name it. */
export type Edition = "theatrical" | "extended" | "directors" | "final" | "unrated" | "imax";

const CUTS: [Exclude<Edition, "theatrical" | "imax">, RegExp][] = [
  // "Extended Edition", "Ext. Cut", "Special Extended", "Extended Collector's Cut", BvS's "Ultimate Edition".
  ["extended", /\bextended\b|\bext\.?[\s._-]*cut\b|\bultimate[\s._-]*(?:edition|cut)\b|расширенн|розширен/i],
  ["directors", /\bdirector'?s?[\s._-]*cut\b|режисс[её]рск|режисерськ/i],
  ["final", /\bfinal[\s._-]*cut\b|финальн[а-я]*\s+верси|фінальн[а-яії]*\s+версі/i],
  ["unrated", /\bunrated\b|\buncut\b|без[\s._-]+цензур/i],
];
const THEATRICAL = /\btheatrical\b|театральн|прокатн/i;
const IMAX = /\bimax\b/i;

/**
 * The cut a release's name says it is, or null when it names none. A name with the theatrical cut and another one
 * ("2-in-1: Theatrical & Director's Cut") is both, so neither; "IMAX" counts only when no cut is named ("[Extended]
 * [IMAX]" is the extended cut). "Remastered", "Special Edition", "Open Matte" are not cuts.
 */
export function editionOf(name: string): Edition | null {
  const cuts = CUTS.filter(([, re]) => re.test(name)).map(([e]) => e);
  const theatrical = THEATRICAL.test(name);
  if (theatrical) return cuts.length ? null : "theatrical";
  if (cuts.length) return cuts[0]!;
  return IMAX.test(name) ? "imax" : null;
}

/** A cut on offer for the chosen audio: its best release and the resolutions it comes in (2160 first). */
export interface EditionOption {
  key: Edition;
  best: RankedRelease;
  resolutions: (2160 | 1080 | 720 | 480 | null)[];
}

/** What was picked by hand; null follows the recommendation. A choice holds only under the ones before it. */
export interface ReleaseChoice {
  voice: string | null;
  edition: Edition | null;
  picture: string | null;
}

export const NO_CHOICE: ReleaseChoice = { voice: null, edition: null, picture: null };

export interface ReleasePick {
  /** The audio options, the profile's languages first (then its studios), else as the releases rank. */
  options: VoiceOption[];
  option: VoiceOption | undefined;
  /** The cuts of the chosen audio, best first — empty when its releases are all one cut (or name none). */
  editions: EditionOption[];
  /** The cut shown: the chosen one, else the best release's; null when no release of the audio names one. */
  edition: Edition | null;
  /** The picture versions of the chosen audio and cut, lowest resolution first. */
  versions: PictureVersion[];
  version: PictureVersion | undefined;
  /** The releases of the chosen audio and cut, best first. */
  pool: RankedRelease[];
  /** The release "Watch" adds. */
  chosen: RankedRelease | undefined;
}

/**
 * Audio options for the profile: the ones in its audio languages first, in their order, then its studios (the
 * ranking's own order: language before studio), else as their best releases rank. A release lists its tracks in its
 * own order ("Dub (rus) + Dub (ukr)"), so the first option of the best release may not be the profile's.
 */
export function forProfile(options: VoiceOption[], prefs: Pick<ReleasePrefs, "languages" | "studios">): VoiceOption[] {
  const lang = (o: VoiceOption) => {
    const i = o.language ? prefs.languages.indexOf(o.language) : -1;
    return i < 0 ? prefs.languages.length : i;
  };
  const studio = (o: VoiceOption) => (o.studio && prefs.studios.includes(o.studio) ? 0 : 1);
  return options
    .map((o, i) => ({ o, i }))
    .sort((a, b) => lang(a.o) - lang(b.o) || studio(a.o) - studio(b.o) || a.i - b.i)
    .map((x) => x.o);
}

const cutOf = (x: RankedRelease, any: boolean) => editionOf(x.result.title) ?? (any ? "theatrical" : null);

/**
 * The release to watch for `choice`: the audio option (the profile's first, unless chosen), its cut (the best
 * release's, unless chosen), the picture version (the mode's pick — `ranked` comes ranked by the quality mode — unless
 * chosen). A release without a cut in its name is the theatrical one once some release of the audio names another
 * cut. Releases of other seasons only, cinema recordings and dead ones are never picked.
 */
export function pickRelease(ranked: RankedRelease[], prefs: Pick<ReleasePrefs, "languages" | "studios">, choice: ReleaseChoice = NO_CHOICE): ReleasePick {
  const alive = ranked.filter((x) => x.holds !== false);
  const options = forProfile(voiceOptions(alive), prefs);
  const option = options.find((o) => o.key === choice.voice) ?? options[0];
  if (!option) {
    const x = ranked[0];
    const chosen = x && !x.dead && x.holds !== false ? x : undefined;
    return { options, option, editions: [], edition: null, versions: [], version: undefined, pool: chosen ? [chosen] : [], chosen };
  }
  const pool = alive.filter((x) => !x.info.cam && !x.dead && voiceKeys(x).includes(option.key));
  const named = pool.some((x) => editionOf(x.result.title) !== null);
  const editions: EditionOption[] = [];
  if (named)
    for (const x of pool) {
      const key = cutOf(x, true)!;
      const e = editions.find((o) => o.key === key);
      if (e) {
        if (!e.resolutions.includes(x.info.resolution)) e.resolutions.push(x.info.resolution);
      } else editions.push({ key, best: x, resolutions: [x.info.resolution] });
    }
  for (const e of editions) e.resolutions.sort((a, b) => (b ?? 0) - (a ?? 0));
  const many = editions.length > 1;
  const edition = many ? (editions.find((e) => e.key === choice.edition)?.key ?? editions[0]!.key) : named ? cutOf(pool[0]!, false) : null;
  const inCut = many ? pool.filter((x) => cutOf(x, true) === edition) : pool;
  const versions = pictureVersions(inCut);
  const version = versions.find((v) => v.key === choice.picture) ?? versions.find((v) => v.key === inCut[0]?.picture);
  return { options, option, editions: many ? editions : [], edition, versions, version, pool: inCut, chosen: version?.best ?? inCut[0] };
}
