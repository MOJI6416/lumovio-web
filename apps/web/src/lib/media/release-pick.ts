import { type Edition, editionOf } from "./editions";
import { optionIsStudio, type PictureVersion, pictureVersions, type RankedRelease, type ReleasePrefs, swarmOf, type VoiceOption, voiceKeys, voiceOptions } from "./releases";

export { type Edition, editionOf };

/*
 * What "Where to watch" offers to watch from a TorrServer search (design-system 7.15): one release, and the three
 * choices that lead to another — the audio, the cut of the film and the picture — each narrowing the one before it,
 * as Plex's Version / Audio pickers do before Play. The title hero's "Watch" starts the same pick with no choice made
 * (TorrentProbe), so both always say the same thing (TTL-06).
 */

/** A cut on offer for the chosen audio: its best release and the resolutions it comes in (2160 first). */
export interface EditionOption {
  key: Edition;
  best: RankedRelease;
  resolutions: (2160 | 1080 | 720 | 480 | null)[];
}

/**
 * "Any" audio or cut: the sources screen lists every release (its pills narrow a list, design-system 7.15 «Экран
 * источников»), where "Where to watch" always holds one. Never an option's key or an Edition.
 */
export const ANY = "*";

/** What was picked by hand; null follows the recommendation. A choice holds only under the ones before it. */
export interface ReleaseChoice {
  voice: string | null;
  edition: Edition | typeof ANY | null;
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
 * Audio options for the profile, in the ranking's own order: the ones in its audio languages first, in their order;
 * then the ones with a live release before those whose releases are all almost dead (`swarmOf`); then by the floor of their best release (`RankedRelease.floor`: plays here, then HD); then its studios, in their
 * order; else as their best releases rank. A release lists its tracks in its own order ("7 x MVO (HDrezka Studio,
 * NewStudio, …, LostFilm)"), so the first option of the best release may not be the profile's: "1 — LostFilm,
 * 2 — HDRezka" offers LostFilm first.
 */
export function forProfile(options: VoiceOption[], prefs: Pick<ReleasePrefs, "languages" | "studios">): VoiceOption[] {
  const lang = (o: VoiceOption) => {
    const i = o.language ? prefs.languages.indexOf(o.language) : -1;
    return i < 0 ? prefs.languages.length : i;
  };
  const hd = (o: VoiceOption) => 2 - o.best.floor;
  // An option whose releases are all almost dead (one or two seeders) comes after the live ones, whatever its studio.
  const dying = (o: VoiceOption) => (swarmOf(o.best.result.seeders) === 0 ? 1 : 0);
  // A studio typed in by hand ("HDRezka") is the known one it names ("HDrezka Studio"), as the ranking reads it.
  const studio = (o: VoiceOption) => {
    const i = prefs.studios.findIndex((s) => optionIsStudio(o, s));
    return i < 0 ? prefs.studios.length : i;
  };
  return options
    .map((o, i) => ({ o, i }))
    .sort((a, b) => lang(a.o) - lang(b.o) || dying(a.o) - dying(b.o) || hd(a.o) - hd(b.o) || studio(a.o) - studio(b.o) || a.i - b.i)
    .map((x) => x.o);
}

const cutOf = (x: RankedRelease, any: boolean) => editionOf(x.result.title) ?? (any ? "theatrical" : null);

/**
 * The cut to start with nothing chosen: the one most seeded among the audio's releases — the version viewers keep, the
 * director's where that is the film (Blade Runner: The Final Cut), the theatrical one where the others are for fans —
 * among the cuts whose best release reaches the best one's floor (`RankedRelease.floor`: an SD-only cut never wins);
 * a tie goes to the theatrical cut, then the best release's. The others are offered right beside it in the "Version"
 * pill. `editions` come best first; `pool` is the audio's releases.
 */
function defaultCut(editions: EditionOption[], pool: RankedRelease[]): Edition {
  const top = editions[0]!.best.floor;
  const seeded = (key: Edition) => pool.filter((x) => cutOf(x, true) === key).reduce((n, x) => n + (x.result.seeders ?? 0), 0);
  const order = editions
    .filter((e) => e.best.floor === top)
    .map((e, i) => ({ key: e.key, n: seeded(e.key), i }))
    .sort((a, b) => b.n - a.n || Number(b.key === "theatrical") - Number(a.key === "theatrical") || a.i - b.i);
  return order[0]!.key;
}

/**
 * The release to watch for `choice`: the audio option (the profile's first, unless chosen), its cut (`defaultCut`,
 * unless chosen), the picture version (the mode's pick — `ranked` comes ranked by the quality mode — unless
 * chosen). A release without a cut in its name is the theatrical one once some release of the audio names another
 * cut. Releases of other seasons only, cinema recordings and dead ones are never picked.
 *
 * `ANY` as the voice keeps every audio (no option is chosen), as the cut every cut: the sources screen's list. `max`:
 * how many audio options to offer (the sources screen offers more than "Where to watch").
 */
export function pickRelease(ranked: RankedRelease[], prefs: Pick<ReleasePrefs, "languages" | "studios">, choice: ReleaseChoice = NO_CHOICE, max = 12): ReleasePick {
  const alive = ranked.filter((x) => x.holds !== false);
  const options = forProfile(voiceOptions(alive, max), prefs);
  const anyVoice = choice.voice === ANY;
  const option = anyVoice ? undefined : (options.find((o) => o.key === choice.voice) ?? options[0]);
  if (!option && !anyVoice) {
    const x = ranked[0];
    const chosen = x && !x.dead && x.holds !== false ? x : undefined;
    return { options, option, editions: [], edition: null, versions: [], version: undefined, pool: chosen ? [chosen] : [], chosen };
  }
  const pool = alive.filter((x) => !x.info.cam && !x.dead && (!option || voiceKeys(x).includes(option.key)));
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
  const anyCut = many && choice.edition === ANY;
  const preferred = many ? defaultCut(editions, pool) : null;
  const edition = many && !anyCut ? (editions.find((e) => e.key === choice.edition)?.key ?? preferred) : named && pool[0] ? cutOf(pool[0], false) : null;
  const inCut = many && !anyCut ? pool.filter((x) => cutOf(x, true) === edition) : pool;
  const versions = pictureVersions(inCut);
  // Every cut listed (the sources screen): the card still starts the default cut's release, as "Where to watch" does
  // with nothing chosen, unless a picture version was chosen by hand.
  const lead = anyCut ? (pool.find((x) => cutOf(x, true) === preferred) ?? inCut[0]) : inCut[0];
  const version = versions.find((v) => v.key === choice.picture) ?? versions.find((v) => v.key === lead?.picture);
  const chosen = anyCut && !choice.picture ? lead : (version?.best ?? inCut[0]);
  // Every cut: the one shown is the chosen release's own (a release without a cut in its name is the theatrical one).
  return { options, option, editions: many ? editions : [], edition: anyCut && chosen ? cutOf(chosen, true) : edition, versions, version, pool: inCut, chosen };
}
