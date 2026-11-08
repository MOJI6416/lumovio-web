import type { ReleaseQuality, TitleDetails, TitleSummary } from "@lumovio/contracts";
import type { TsSearchResult } from "./torrserver";

/** Translation kinds as release names list them, best first: dubbing, professional multi- and two-voice, author's, single/amateur voice-over. */
export type Voice = "dub" | "mvo" | "dvo" | "avo" | "vo";
const VOICES: Voice[] = ["dub", "mvo", "dvo", "avo", "vo"];

/** HDR formats as names list them; "hdr" is HDR without a named format. */
export type HdrFormat = "hdr" | "hdr10" | "hdr10+" | "dv" | "hlg";

/**
 * Where the picture comes from, best first: a disc copied untouched, a disc encode, a streaming
 * service's file as it was, a re-encode of one, a TV recording, a DVD.
 */
export type PictureSource = "remux" | "bluray" | "webdl" | "webrip" | "hdtv" | "dvd";
const SOURCES: PictureSource[] = ["remux", "bluray", "webdl", "webrip", "hdtv", "dvd"];

/** A resolution as a release names it, one table for every screen that lists releases (L10N-09). */
export const RESOLUTION_LABEL: Record<number, string> = { 2160: "4K", 1080: "1080p", 720: "720p", 480: "SD" };

export interface ReleaseInfo {
  resolution: 2160 | 1080 | 720 | 480 | null;
  /** Picture or sound recorded in a cinema (CAMRip, TS, TC). */
  cam: boolean;
  /** Any HDR format is named. */
  hdr: boolean;
  hdrFormats: HdrFormat[];
  /** The name says SDR. Saying nothing is not SDR, it is unknown. */
  sdr: boolean;
  /** The sound is Dolby Atmos by the name ("TrueHD 7.1 Atmos", "DDP5.1 Atmos", "DDPA5.1"). */
  atmos: boolean;
  /** The name lists subtitles that can be turned on ("Sub (Rus, Eng)", "Eng Subs", "Субтитры: укр"; not "Hardsub"). */
  subtitles: boolean;
  hevc: boolean;
  codec: "hevc" | "avc" | "av1" | null;
  source: PictureSource | null;
  /** Audio languages the name states or, by the tracker's conventions, implies (ISO 639-1). */
  languages: string[];
  /** The best translation the name lists. */
  voice: Voice | null;
  /** Known dubbing and voice-over studios the name credits (`VOICE_STUDIOS` names). */
  studios: string[];
  /**
   * The kind of translation of each studio the name pairs with one ("Dub (Пифагор) + MVO (HDrezka)",
   * "ПМ (LostFilm)"); a studio missing here has no kind of its own in the name.
   */
  studioVoices: Record<string, Voice>;
  /**
   * The audio tracks the name lists, in its order, each with its own language, kind and studio as far as the name
   * links them ("Dub + MVO (Jaskier) + Dub (Ukr) + Original Eng" is a Russian dub, Jaskier's Russian voice-over, a
   * Ukrainian dub and the original) — never one language for every studio (SRC-05). Empty when the name lists none.
   */
  tracks: ReleaseTrack[];
  /** The seasons and episodes the name states, for a series' releases. */
  pack: PackInfo;
}

/** One audio track as a release name lists it; each fact is null when the name doesn't say it. */
export interface ReleaseTrack {
  /** ISO 639-1: written next to it ("Dub (Ukr)", "Ukr Dub"), its studio's, or the tracker's convention. */
  language: string | null;
  voice: Voice | null;
  /** A known studio (`VOICE_STUDIOS` name). */
  studio: string | null;
  /** Another name in its credit that is not a known studio ("DVO (Pazl Voice)"): shown, never matched. */
  credit: string | null;
  /** The title's own soundtrack ("Original Eng"). */
  original: boolean;
}

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

// Word boundaries that work for Cyrillic too (`\b` is ASCII-only).
const W = (s: string) => new RegExp(`(?<![\\p{L}\\d])(?:${s})(?![\\p{L}\\d])`, "iu");

/**
 * Dubbing and voice-over studios as release names credit them ("MVO (LostFilm)", "Dub (Пифагор)",
 * "P (HDRezka)"), with the spellings trackers use. `lang` groups them in settings; `anime` marks
 * anime groups. Not exhaustive: a profile can add any other name, matched as written.
 */
export const VOICE_STUDIOS: { name: string; lang: "ru" | "uk"; anime?: boolean; match: RegExp }[] = [
  { name: "LostFilm", lang: "ru", match: W("lostfilm|lost film|лостфильм") },
  { name: "HDrezka Studio", lang: "ru", match: W("hdrezka|rezka|hdrezka studio|резка") },
  { name: "NewStudio", lang: "ru", match: W("newstudio|new studio|нью студио") },
  { name: "Кубик в Кубе", lang: "ru", match: W("кубик в кубе|kubik v kube|kubikvkube") },
  { name: "AlexFilm", lang: "ru", match: W("alexfilm|alex film|алекс фильм") },
  { name: "TVShows", lang: "ru", match: W("tvshows|tv shows") },
  { name: "Jaskier", lang: "ru", match: W("jaskier|яскьер|яскиер") },
  { name: "Amedia", lang: "ru", match: W("amedia|амедиа") },
  { name: "BaibaKo", lang: "ru", match: W("baibako|байбако") },
  { name: "Ideafilm", lang: "ru", match: W("ideafilm|идеафильм") },
  { name: "Пифагор", lang: "ru", match: W("пифагор|pifagor") },
  { name: "Red Head Sound", lang: "ru", match: W("red head sound|redheadsound|rhs") },
  { name: "Movie Dubbing", lang: "ru", match: W("movie dubbing|moviedubbing") },
  { name: "Невафильм", lang: "ru", match: W("невафильм|nevafilm") },
  { name: "Мосфильм-Мастер", lang: "ru", match: W("мосфильм[- ]мастер|mosfilm[- ]master") },
  { name: "Кураж-Бамбей", lang: "ru", match: W("кураж[- ]бамбей|kurazh[- ]bambey") },
  { name: "ColdFilm", lang: "ru", match: W("coldfilm|колдфильм") },
  { name: "Кравец", lang: "ru", match: W("кравец|kravec|kravets") },
  { name: "Кириллица", lang: "ru", match: W("кириллица|kirillica") },
  { name: "Октопус", lang: "ru", match: W("октопус|octopus") },
  { name: "СВ-Дубль", lang: "ru", match: W("св[- ]дубль|sv[- ]double") },
  { name: "SDI Media", lang: "ru", match: W("sdi media") },
  { name: "HamsterStudio", lang: "ru", match: W("hamsterstudio|hamster studio") },
  { name: "Profix Media", lang: "ru", match: W("profix media|profixmedia") },
  { name: "Ozz", lang: "ru", match: W("ozz|ozz tv") },
  { name: "Сыендук", lang: "ru", match: W("сыендук|syenduk") },
  { name: "Гоблин", lang: "ru", match: W("гоблин|goblin|пучков") },
  { name: "Гаврилов", lang: "ru", match: W("гаврилов|gavrilov") },
  { name: "Михалёв", lang: "ru", match: W("михал[её]в|mikhalev") },
  { name: "Володарский", lang: "ru", match: W("володарский|volodarsky") },
  { name: "Живов", lang: "ru", match: W("живов|zhivov") },
  { name: "Сербин", lang: "ru", match: W("сербин|serbin") },
  { name: "Есарев", lang: "ru", match: W("есарев|esarev") },
  { name: "Дохалов", lang: "ru", match: W("дохалов|dokhalov") },
  { name: "Яроцкий", lang: "ru", match: W("яроцкий|yarotsky") },
  { name: "Le Doyen", lang: "uk", match: W("le doyen|ledoyen|ле доєн|ледоєн") },
  { name: "Цікава Ідея", lang: "uk", match: W("цікава ідея|tsikava ideya") },
  { name: "Так Треба Продакшн", lang: "uk", match: W("так треба продакшн|так треба|tak treba") },
  { name: "Струґачка", lang: "uk", match: W("струґачка|стругачка") },
  { name: "UATeam", lang: "uk", match: W("uateam|ua team") },
  { name: "Postmodern", lang: "uk", match: W("postmodern|постмодерн") },
  { name: "DniproFilm", lang: "uk", match: W("dniprofilm|дніпрофільм") },
  { name: "1+1", lang: "uk", match: /(?<![\p{L}\d])1\s?\+\s?1(?![\p{L}\d])/iu },
  { name: "Новий канал", lang: "uk", match: W("новий канал|novyi kanal") },
  { name: "ICTV", lang: "uk", match: W("ictv") },
  { name: "ТЕТ", lang: "uk", match: W("тет|tet") },
  { name: "НЛО TV", lang: "uk", match: W("нло tv|nlo tv") },
  { name: "Гуртом", lang: "uk", match: W("гуртом|hurtom") },
  { name: "AniLibria", lang: "ru", anime: true, match: W("anilibria|анилибрия") },
  { name: "AniDUB", lang: "ru", anime: true, match: W("anidub|анидаб") },
  { name: "SHIZA Project", lang: "ru", anime: true, match: W("shiza|шиза") },
  { name: "Dream Cast", lang: "ru", anime: true, match: W("dream cast|dreamcast|дримкаст") },
  { name: "AnimeVost", lang: "ru", anime: true, match: W("animevost|анимевост") },
  { name: "Studio Band", lang: "ru", anime: true, match: W("studio band|studioband|студийная банда") },
  { name: "AniStar", lang: "ru", anime: true, match: W("anistar|анистар") },
  { name: "Anything Group", lang: "ru", anime: true, match: W("anything group|anything-group") },
  { name: "Amanogawa", lang: "uk", anime: true, match: W("amanogawa|аманогава") },
  { name: "Unimay", lang: "uk", anime: true, match: W("unimay|юнімей") },
  { name: "InariDUB", lang: "uk", anime: true, match: W("inaridub|інаридаб") },
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether a release name credits a studio: a known one by its spellings, any other as written. */
export function creditsStudio(release: string, studio: string): boolean {
  const known = VOICE_STUDIOS.find((s) => s.name.toLowerCase() === studio.toLowerCase());
  return (known?.match ?? W(escapeRe(studio.trim()))).test(release.replace(/[._]/g, " "));
}

const VOICE_WORDS: Record<Voice, RegExp> = {
  dub: W("dub|dubbed|дубляж|дублированн\\p{L}*|дубльован\\p{L}*|дб|лицензия|license|licence|itunes"),
  mvo: W("mvo|многоголос\\p{L}*|багатоголос\\p{L}*|пм"),
  dvo: W("dvo|двухголос\\p{L}*|двоголос\\p{L}*|пд"),
  avo: W("avo|авторск\\p{L}*|авторськ\\p{L}*|ап"),
  vo: W("vo|одноголос\\p{L}*|любительск\\p{L}*|аматорськ\\p{L}*|лм|лд|ло"),
};
// Single letters count only inside a list of such tokens ("D, P, A", "| D |", "Dub + P2"), never in a title.
const LIST_TOKEN = /^(d|p\d?|a|l\d?|dub|mvo|dvo|avo|vo|original|orig|eng|ukr|rus|sub\b.*|subs|дб|пм|пд|ап|лм|лд|ло|ст|укр|рус)$/iu;
// "Kind (Studio)": a translation token right before a parenthesised credit.
const KIND_BEFORE_PARENS = /([\p{L}\d]+)\s*\(([^)]+)\)/gu;
const LETTER_VOICE: Record<string, Voice> = { d: "dub", p: "mvo", p1: "mvo", p2: "dvo", a: "avo", l: "vo", l1: "vo", l2: "vo" };

const LANG_WORDS: [string, RegExp][] = [
  ["uk", W("ukr|ua|укр|україн\\p{L}*|украин\\p{L}*|ukrainian")],
  ["ru", W("rus|рус|русск\\p{L}*|russian")],
  ["en", W("eng|english|англ\\p{L}*")],
  ["ja", W("jap|jpn|japanese|япон\\p{L}*")],
];
const ORIGINAL = W("original|orig|оригинал\\p{L}*|оригінал\\p{L}*");
// Subtitles name languages too ("Sub (Rus, Eng)", "Eng Subs", "Субтитры: укр"); they say nothing about the audio.
const SUBTITLES = /(?:sub|subs|субтитры|субтитри|сабы)\s*[:(]?\s*(?:[\p{L}]{2,10}\s*[,/+]\s*)*[\p{L}]{2,10}\)?|(?<![\p{L}])[\p{L}]{2,4}\s+subs?(?![\p{L}])/giu;

/** Trackers whose releases are Russian unless they say otherwise, and Ukrainian ones. */
const RU_TRACKERS = /rutracker|kinozal|nnm|noname|rutor|lostfilm|megapeer|anilibria|animelayer|rustorka/i;
const UK_TRACKERS = /toloka|hurtom|mazepa/i;
/** Kinds of translation only Russian and Ukrainian trackers write (an English name says "Dubbed", never "MVO"). */
const RU_KINDS = /(?<![\p{L}\d])(?:MVO|DVO|AVO)(?![\p{L}\d])/u;

// A kind of translation as a word or an abbreviation (single letters only as a credit's kind: "P (HDRezka)").
const KIND_WORDS =
  "dub|dubbed|mvo|dvo|avo|vo|дб|пм|пд|ап|лм|лд|ло|дубляж|дублированн\\p{L}*|дубльован\\p{L}*|многоголос\\p{L}*|багатоголос\\p{L}*|двухголос\\p{L}*|двоголос\\p{L}*|авторск\\p{L}*|авторськ\\p{L}*|одноголос\\p{L}*|любительск\\p{L}*|аматорськ\\p{L}*";
const LANG_TOKEN = "ukr|ua|укр|україн\\p{L}*|украин\\p{L}*|ukrainian|rus|рус|русск\\p{L}*|russian|eng|english|англ\\p{L}*|jap|jpn|japanese|япон\\p{L}*";
const PAIRED = new RegExp(`(?<![\\p{L}\\d])(${KIND_WORDS}|d|p\\d?|a|l\\d?)\\s*\\(([^()]{1,80})\\)`, "giu");
const BARE = new RegExp(`(?<![\\p{L}\\d])(?:(${LANG_TOKEN})\\s+)?(${KIND_WORDS})(?:\\s+(${LANG_TOKEN}))?(?![\\p{L}\\d])`, "giu");
const ORIGINAL_TRACK = new RegExp(`(?<![\\p{L}\\d])(?:original|orig|оригинал\\p{L}*|оригінал\\p{L}*)(?:\\s*\\(?\\s*(${LANG_TOKEN})\\)?)?(?![\\p{L}\\d])`, "giu");
const LANG_ALONE = new RegExp(`(?<![\\p{L}\\d])(${LANG_TOKEN})(?![\\p{L}\\d])`, "giu");
const LANG_ONLY = new RegExp(`^(?:${LANG_TOKEN})$`, "iu");
// Names in a credit that say how it was made, not who: never a studio of its own.
const NOT_A_CREDIT = W("лицензия|license|licence|itunes|netflix|amazon|bd|blu-?ray|web-?dl|cinema|кинотеатр\\p{L}*|театральн\\p{L}*|5\\.1|2\\.0|ac3|dts|eac3|aac|ddp?|\\d+ ?kbps");

function voiceOfToken(token: string): Voice | null {
  return LETTER_VOICE[token.toLowerCase()] ?? VOICES.find((v) => VOICE_WORDS[v].test(token)) ?? null;
}

function langOfToken(token: string | undefined): string | null {
  if (!token) return null;
  return LANG_WORDS.find(([, re]) => re.test(token))?.[0] ?? null;
}

/**
 * The audio tracks a name lists (`ReleaseInfo.tracks`). A credit in parentheses gives its kind to what it names —
 * each studio in its own language, a language word, another name kept as written; a bare kind takes the language
 * written next to it; a studio credited on its own is a track of its own, with the one bare kind there is when it is
 * the only studio; "Original" is the title's own language. A track without a written language takes the tracker's
 * convention (Russian on Russian trackers, Ukrainian on Ukrainian ones; with no tracker, Russian where the name writes
 * MVO / DVO / AVO), else stays unknown.
 */
function tracksOf(name: string, tracker: string | null, originalLanguage: string | null): ReleaseTrack[] {
  // No tracker (a torrent already on a TorrServer): MVO / DVO / AVO in the name are those trackers' convention too.
  const fallback = UK_TRACKERS.test(tracker ?? "") ? "uk" : RU_TRACKERS.test(tracker ?? "") || (!tracker && RU_KINDS.test(name)) ? "ru" : null;
  let rest = name.replace(/[._]/g, " ").replace(SUBTITLES, (m) => " ".repeat(m.length));
  const found: { at: number; track: ReleaseTrack }[] = [];
  const used = new Set<string>();
  const blank = (at: number, length: number) => {
    rest = rest.slice(0, at) + " ".repeat(length) + rest.slice(at + length);
  };
  const add = (at: number, t: Partial<ReleaseTrack>) => found.push({ at, track: { language: null, voice: null, studio: null, credit: null, original: false, ...t } });

  for (const m of [...rest.matchAll(PAIRED)]) {
    const voice = voiceOfToken(m[1]!);
    if (!voice) continue;
    const letter = m[1]!.length <= 2 && /^[a-z]\d?$/i.test(m[1]!);
    let any = false;
    for (const part of m[2]!.split(/\s*[,;+&/]\s*|\s+(?:и|and|та)\s+/iu).map((p) => p.trim()).filter(Boolean)) {
      const studio = VOICE_STUDIOS.find((s) => s.match.test(part));
      const lang = LANG_ONLY.test(part) ? langOfToken(part) : null;
      if (studio) {
        used.add(studio.name);
        add(m.index!, { voice, studio: studio.name, language: lang ?? studio.lang });
        any = true;
      } else if (lang) {
        add(m.index!, { voice, language: lang });
        any = true;
      } else if (!letter && /\p{L}{2}/u.test(part) && part.length <= 30 && !NOT_A_CREDIT.test(part)) {
        add(m.index!, { voice, credit: part, language: fallback });
        any = true;
      }
    }
    // "Dub (лицензия)": the kind still names a track.
    if (!any && !letter) add(m.index!, { voice, language: fallback });
    if (any || !letter) blank(m.index!, m[0].length);
  }

  for (const m of [...rest.matchAll(BARE)]) {
    const voice = voiceOfToken(m[2]!);
    if (!voice) continue;
    const lang = langOfToken(m[1]) ?? langOfToken(m[3]);
    // "Дубляж Le Doyen": a studio named right after its kind is that track's.
    const after = rest.slice(m.index! + m[0].length, m.index! + m[0].length + 32);
    const studio = VOICE_STUDIOS.find((s) => {
      if (used.has(s.name)) return false;
      const hit = s.match.exec(after);
      return hit !== null && /^[\s:–-]{1,3}$/u.test(after.slice(0, hit.index));
    });
    if (studio) used.add(studio.name);
    add(m.index!, { voice, studio: studio?.name ?? null, language: lang ?? studio?.lang ?? fallback });
    blank(m.index!, m[0].length);
  }

  // Single letters in a list of such tokens ("D, P, A", "| D |"), as `parseRelease` reads them.
  let offset = 0;
  for (const segment of rest.split(/([|/[\]()])/)) {
    const tokens = segment.split(/[,+]/).map((x) => x.trim()).filter(Boolean);
    if (tokens.length > 0 && tokens.every((x) => LIST_TOKEN.test(x))) {
      for (const x of tokens) {
        const v = LETTER_VOICE[x.toLowerCase()];
        if (v) add(offset + segment.indexOf(x), { voice: v, language: fallback });
      }
    }
    offset += segment.length;
  }

  for (const m of rest.matchAll(ORIGINAL_TRACK)) add(m.index!, { original: true, language: langOfToken(m[1]) ?? originalLanguage });

  // Studios credited on their own ("[AniLibria]", "| HDrezka, LostFilm"): a track each, in its language.
  const alone = VOICE_STUDIOS.filter((s) => !used.has(s.name) && s.match.test(rest));
  const bare = found.filter((f) => !f.track.studio && !f.track.credit && !f.track.original && f.track.voice);
  if (alone.length === 1 && bare.length === 1 && (bare[0]!.track.language === null || bare[0]!.track.language === alone[0]!.lang || bare[0]!.track.language === fallback)) {
    // One studio and one kind with nothing linking them otherwise: that studio's kind (as `kindOf` reads it).
    bare[0]!.track.studio = alone[0]!.name;
    bare[0]!.track.language = alone[0]!.lang;
  } else {
    for (const s of alone) add(rest.search(s.match), { studio: s.name, language: s.lang });
  }

  // Languages written alone ("Ukr/Eng" on Toloka): the original, or a track of that language when none names it.
  for (const m of rest.matchAll(LANG_ALONE)) {
    const lang = langOfToken(m[1]);
    if (!lang || found.some((f) => f.track.language === lang)) continue;
    add(m.index!, lang === originalLanguage ? { original: true, language: lang } : { language: lang });
  }

  return found.sort((a, b) => a.at - b.at).map((f) => f.track);
}

/**
 * What a release name says about the picture and the sound. Heuristic: names follow trackers' habits,
 * not a standard. On Russian trackers a translation without a language ("Dub", "D, P, A", "ДБ, ПМ") is
 * Russian; on Toloka a release is Ukrainian. "Original" is the title's own language.
 */
export function parseRelease(title: string, tracker: string | null = null, originalLanguage: string | null = null): ReleaseInfo {
  const t = title.replace(/[._]/g, " ");
  const res = /(?<![\d])(2160p|4k|uhd)(?![\p{L}\d])/iu.test(t)
    ? 2160
    : /(?<![\d])1080[pi]/i.test(t)
      ? 1080
      : /(?<![\d])720p/i.test(t)
        ? 720
        : W("dvdrip|satrip|hdtvrip|tvrip|webrip|dvd5|dvd9|xvid|divx|480p|576p").test(t)
          ? 480
          : null;
  const cam = W("camrip|cam|ts|telesync|tc|telecine|hdcam|tsrip|hdts|звук с ts").test(t);
  const hdrFormats: HdrFormat[] = [];
  const plus = /(?<![\p{L}\d])hdr10(?:\+|\s?plus)/iu;
  if (plus.test(t)) hdrFormats.push("hdr10+");
  if (W("hdr10").test(t.replace(new RegExp(plus.source, "giu"), " "))) hdrFormats.push("hdr10");
  if (W("hlg").test(t)) hdrFormats.push("hlg");
  if (hdrFormats.length === 0 && W("hdr").test(t)) hdrFormats.push("hdr");
  if (W("dolby vision|dolbyvision|dv|dovi").test(t)) hdrFormats.push("dv");
  const codec = W("hevc|x265|h 265|h265").test(t) ? "hevc" : W("av1").test(t) ? "av1" : W("avc|x264|h 264|h264").test(t) ? "avc" : null;
  const source: PictureSource | null = /remux/i.test(t)
    ? "remux"
    : /(?<![\p{L}])(?:blu-?ray|bd-?rip|brrip|bdmv|bd(?:25|50|66|100))/iu.test(t)
      ? "bluray"
      : /web-?dl-?rip|web-?rip/i.test(t)
        ? "webrip"
        : /web-?dl/i.test(t) || W("web").test(t)
          ? "webdl"
          : /hdtv|satrip|tvrip|iptv/i.test(t)
            ? "hdtv"
            : /dvd/i.test(t)
              ? "dvd"
              : null;

  const voices = new Set<Voice>();
  for (const v of VOICES) if (VOICE_WORDS[v].test(t)) voices.add(v);
  for (const segment of t.split(/[|/[\]()]/)) {
    const tokens = segment
      .split(/[,+]/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (tokens.length === 0 || !tokens.every((x) => LIST_TOKEN.test(x))) continue;
    for (const x of tokens) {
      const v = LETTER_VOICE[x.toLowerCase()];
      if (v) voices.add(v);
    }
  }
  const voice = VOICES.find((v) => voices.has(v)) ?? null;

  const audio = t.replace(SUBTITLES, " ");
  const languages = new Set<string>();
  for (const [code, re] of LANG_WORDS) if (re.test(audio)) languages.add(code);
  if (originalLanguage && ORIGINAL.test(audio)) languages.add(originalLanguage);
  const tr = tracker ?? "";
  if (UK_TRACKERS.test(tr)) languages.add("uk");
  else if (voice && (RU_TRACKERS.test(tr) || (!tr && RU_KINDS.test(audio)))) {
    // "Dub (Ukr)" or "Ukr Dub" alone is a Ukrainian dub; any other translation on such a tracker is Russian. A torrent
    // with no tracker (one already on a TorrServer) is judged by its name: MVO / DVO / AVO are those trackers' own words
    // ("12 angry men … Dub + 2x MVO + AVO + Original (Eng)" has a Russian dub, owner's TorrServer, 2026-11-06).
    const ukOnly = languages.has("uk") && !languages.has("ru") && /(?:dub|mvo|dvo|avo|vo|дубляж)[\s(]*(?:ukr|укр)|(?:ukr|укр)\p{L}*[\s)]*(?:dub|mvo|dvo|avo|vo|дубляж)/iu.test(audio);
    if (!ukOnly) languages.add("ru");
  }
  // A credited studio is a track in its language ("[AniLibria]" alone is a Russian voice-over).
  const credited = VOICE_STUDIOS.filter((s) => s.match.test(t));
  const studioVoices: Record<string, Voice> = {};
  for (const m of t.matchAll(KIND_BEFORE_PARENS)) {
    const kind = LETTER_VOICE[m[1]!.toLowerCase()] ?? VOICES.find((v) => VOICE_WORDS[v].test(m[1]!));
    if (!kind) continue;
    for (const s of credited) if (s.match.test(m[2]!) && !studioVoices[s.name]) studioVoices[s.name] = kind;
  }
  for (const s of credited) languages.add(s.lang);
  const tracks = tracksOf(title, tracker, originalLanguage);
  for (const tr of tracks) if (tr.language) languages.add(tr.language);
  return {
    resolution: res,
    cam,
    hdr: hdrFormats.length > 0,
    hdrFormats,
    sdr: W("sdr").test(t),
    // "Atmos" as a word (never "Atmosphere"), or DD+ Atmos as some groups shorten it: "DDPA5.1".
    atmos: W("atmos").test(t) || /(?<![\p{L}\d])ddpa\s?\d/iu.test(t),
    subtitles: W("subs?|subtitles?|softsubs?|sdh|субтитр\\p{L}*|субтитри|сабы").test(t),
    hevc: codec === "hevc",
    codec,
    source,
    languages: [...languages],
    voice,
    studios: credited.map((s) => s.name),
    studioVoices,
    tracks,
    pack: packOf(title),
  };
}

/** The tracks of a release that are a translation (not the original), with a kind or a studio. */
export const namedTracks = (info: Pick<ReleaseInfo, "tracks">) => info.tracks.filter((t) => !t.original && (t.studio !== null || t.voice !== null || t.credit !== null));

/** The best kind of translation the name lists in a language (by its tracks), or null. */
function bestVoiceIn(info: ReleaseInfo, language: string): Voice | null {
  const kinds = new Set(info.tracks.filter((t) => t.language === language && t.voice).map((t) => t.voice!));
  return VOICES.find((v) => kinds.has(v)) ?? null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[._]/g, " ")
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();

const EXTRAS = W("саундтрек|soundtrack|ost|making of|бонус\\p{L}*|bonus|трейлер|trailer|featurette");

/**
 * Whether a search result is this title: one of the name's parts (Russian trackers write "Рус / Eng")
 * starts with the original or localized title, and a film's year, when the name has one, is within a
 * year of it. A different film that merely contains the words ("The Science of Interstellar") does not count.
 */
export function isSameTitle(release: string, names: string[], year: number | null, kind: "movie" | "tv"): boolean {
  if (EXTRAS.test(release)) return false;
  // A film is never a release that names seasons: "Avatar: The Last Airbender - S1 - rus 1080p" is not "Avatar" (2009).
  if (kind === "movie") {
    const pack = packOf(release);
    if (pack.seasons && !pack.cours) return false;
  }
  const parts = norm(release).split(/\s*[/|]\s*/);
  const wanted = [...new Set(names.filter(Boolean).map(norm))].filter((n) => n.length > 0);
  const starts = parts.some((p) => wanted.some((n) => p.startsWith(n) && !/[\p{L}\d]/u.test(p.charAt(n.length))));
  if (!starts) return false;
  if (kind === "tv" || !year) return true;
  const years = [...release.matchAll(/(?<!\d)(19\d{2}|20\d{2})(?!\d)/g)].map((m) => Number(m[1]));
  return years.length === 0 || years.some((y) => Math.abs(y - year) <= 1);
}

/**
 * The query the sources screen starts with: the original title, and a film's year. An original title
 * in another script (葬送のフリーレン) is not what trackers write, so the localized one is used then.
 */
export function torrentQuery(d: Pick<TitleDetails, "title" | "originalTitle" | "kind" | "year">): string {
  const original = d.originalTitle && /^[\p{Script=Latin}\p{Script=Cyrillic}\p{N}\p{P}\p{Zs}\p{S}]+$/u.test(d.originalTitle) ? d.originalTitle : null;
  return `${original ?? d.title}${d.kind === "movie" && d.year ? ` ${d.year}` : ""}`;
}

export interface ReleasePrefs {
  /** Audio languages in the profile's order of preference (ISO 639-1). */
  languages: string[];
  /** Dubbing and voice-over studios in the profile's order of preference. */
  studios: string[];
  /** How the picture version is picked: the profile's default, or another one for this viewing. */
  quality: ReleaseQuality;
  /**
   * This device: decodes HEVC (most 4K releases are HEVC), shows HDR, has a 4K screen, decodes Dolby Vision without an
   * HDR10 base; and whether 4K HEVC plays smoothly by the browser's MediaCapabilities (`uhdSmoothNow`; null or left out:
   * not known, which changes nothing); decodes AV1 (left out: not known).
   */
  device: { hevc: boolean; hdr: boolean; uhd: boolean; dolbyVision: boolean; uhdSmooth?: boolean | null; av1?: boolean };
}

/** Dynamic range as the name states it: HDR (HDR10/HLG-style, Dolby Vision with such a base too), Dolby Vision alone, or SDR. */
export type Range = "hdr" | "dv" | "sdr";

/** The release's dynamic range, or null when its name says nothing. */
export function rangeOf(info: Pick<ReleaseInfo, "hdrFormats" | "sdr">): Range | null {
  if (info.hdrFormats.some((f) => f !== "dv")) return "hdr";
  if (info.hdrFormats.includes("dv")) return "dv";
  return info.sdr ? "sdr" : null;
}

/**
 * A picture version: resolution and dynamic range ("2160-hdr", "2160-sdr", "2160" when the name says
 * nothing, "1080"). Below 4K, SDR said and nothing said are one version: that is what such releases are.
 */
export function pictureKey(info: Pick<ReleaseInfo, "resolution" | "hdrFormats" | "sdr">): string {
  const range = rangeOf(info);
  const res = info.resolution ?? 0;
  return range === null || (range === "sdr" && res !== 2160) ? String(res) : `${res}-${range}`;
}

/**
 * Whether this device plays the picture, as far as the name tells: "poor" when it shows it can't
 * (HEVC or AV1 without a decoder, Dolby Vision alone without support), "unknown" for 4K that names no codec
 * on a device without HEVC (most 4K is HEVC). The file itself is checked only when it is prepared.
 */
export type Fit = "ok" | "unknown" | "poor";

export function fitOf(info: ReleaseInfo, device: ReleasePrefs["device"]): Fit {
  if (info.codec === "hevc" && !device.hevc) return "poor";
  if (info.codec === "av1" && device.av1 === false) return "poor";
  if (rangeOf(info) === "dv" && !device.dolbyVision) return "poor";
  if (info.resolution === 2160 && info.codec === null && !device.hevc) return "unknown";
  return "ok";
}

export interface RankedRelease {
  result: TsSearchResult;
  info: ReleaseInfo;
  /** The first of the profile's languages the release has, or null. */
  language: string | null;
  /** The first of the profile's studios the release credits, or null. */
  studio: string | null;
  /** The release's `pictureKey`. */
  picture: string;
  /**
   * The floor the profile's order of studios holds within (`floorOf`): 2 — plays here and HD, 1 — plays here in SD or
   * a picture the name doesn't state, 0 — this device can't play it. A studio further down the order wins only by this.
   */
  floor: 0 | 1 | 2;
  fit: Fit;
  /** The indexer reports no seeders: listed last and never recommended. Unknown seeders are not zero. */
  dead: boolean;
  /** For a wanted episode: whether the release holds its season by the name (`holdsSeason`); null when not asked or not said. */
  holds: boolean | null;
  /** What it is ranked by, in order, higher first (see `rankReleases`). */
  rank: number[];
}

const VOICE_SCORE: Record<Voice, number> = { dub: 5, mvo: 4, dvo: 3, avo: 2, vo: 1 };
const FIT_SCORE: Record<Fit, number> = { ok: 2, unknown: 1, poor: 0 };
const UNKNOWN_SIZE = -Number.MAX_SAFE_INTEGER;

/**
 * The floor the profile's order of studios holds within (`RankedRelease.floor`): its first studio wins over its second
 * at any comparable picture — 720p, 1080p and 4K are all comparable, so a 1080p LostFilm beats a 4K HDRezka — but a
 * release this device plays wins over one it can't (`fitOf` "poor"), and one in HD over one in SD or of a picture its
 * name doesn't state (a studio's only DVDRip loses to another studio's 1080p). "Smaller file" asks for no quality, so
 * it holds only the first.
 */
function floorOf(info: Pick<ReleaseInfo, "resolution">, fit: Fit, prefs: Pick<ReleasePrefs, "quality">): 0 | 1 | 2 {
  if (fit === "poor") return 0;
  return prefs.quality === "small" || (info.resolution ?? 0) >= 720 ? 2 : 1;
}

/**
 * A swarm too weak to stream from: the indexer counts one or two seeders. It sinks below the same picture's healthy
 * releases in every mode (an unknown count is not weak), never below another picture version.
 */
const WEAK_SWARM = 3;

/**
 * Where the picture comes from, as "auto" wants it — "what loads at your speed" (Settings → quality): a disc's encode,
 * then a streaming service's file, and only then the disc untouched, whose 30–40 Mbit/s at 1080p (60–90 at 4K) stalls
 * where an encode of the same picture plays (Remux 1080p of a film: 35–55 GB, its BDRip 8–15). "Best" keeps `SOURCES`.
 */
const AUTO_SOURCES: PictureSource[] = ["bluray", "webdl", "remux", "webrip", "hdtv", "dvd"];

/** Whether "auto" puts 4K first: the screen shows it, the device decodes HEVC, and the browser doesn't say it stutters. */
const uhdFits = (d: ReleasePrefs["device"]) => d.uhd && d.hevc && d.uhdSmooth !== false;

/** Resolutions, most wanted first: in "auto", 4K first only where it fits this device (`uhdFits`). */
function resolutionOrder(prefs: ReleasePrefs): (number | null)[] {
  return prefs.quality === "auto" && !uhdFits(prefs.device) ? [1080, 2160, 720, null, 480] : [2160, 1080, 720, null, 480];
}

/**
 * The picture part of the rank, by the quality mode. "auto" and "best": resolution in the mode's order,
 * then HDR only on a screen that shows it (an SDR screen gets the SDR version), then a healthy swarm (`WEAK_SWARM`),
 * then the source — "auto" an encode before the untouched disc (`AUTO_SOURCES`), "best" the disc first; "best"
 * also takes a film's bigger file (an episode's bitrate can't be told from a season pack's size).
 * "small": a healthy swarm, then the smallest known size, unknown sizes last.
 */
function pictureRank(info: ReleaseInfo, size: number | null, seeders: number | null, prefs: ReleasePrefs, movie: boolean): number[] {
  const order = resolutionOrder(prefs);
  const res = order.length - order.indexOf(info.resolution);
  const range = rangeOf(info);
  const dynamic = range === "hdr" || range === "dv" ? (prefs.device.hdr ? 2 : 0) : 1;
  const healthy = seeders === null || seeders >= WEAK_SWARM ? 1 : 0;
  const sources = prefs.quality === "auto" ? AUTO_SOURCES : SOURCES;
  const source = info.source ? sources.length - sources.indexOf(info.source) : 0;
  if (prefs.quality === "small") return [healthy, size ? -size : UNKNOWN_SIZE, res, dynamic, source];
  if (prefs.quality === "best") return [res, dynamic, healthy, source, movie && size ? size : 0];
  return [res, dynamic, healthy, source];
}

function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i]! - a[i]!;
  return 0;
}

/**
 * Releases of this title, best for this profile and device first. In order: alive (no seeders sinks to
 * the end), one of the profile's audio languages (earlier ones first), not a cinema recording, the floor (`floorOf`:
 * plays here, then HD), one of its studios (earlier ones first), the kind of translation (only where no studio of the
 * profile is credited: a studio's own track is heard whatever kind the name writes, or doesn't, beside it), a picture
 * this device surely plays, the picture by the quality mode (`pictureRank`: resolution, dynamic range, a healthy swarm,
 * the source or the size), for a series a pack before a single episode (the next episodes come with it), and
 * seeders as the indexer reports them for releases equal in all of that; the sort is stable after that. Seeders never
 * outweigh a picture version, and a 4K release is never swapped for 1080p by them. Results for other titles are left
 * out. With a wanted `season` (and `episode`), a release whose name says it holds other seasons (or other episodes of
 * that season) only sinks below the rest, like one without seeders, and is never recommended. `fileOf`: the audio
 * tracks its file was read to have (a release already on the profile's server, `fileTracks`), else null — the name's
 * "6x MVO" then credits the studios the file names.
 */
export function rankReleases(
  results: TsSearchResult[],
  d: Pick<TitleSummary, "title" | "originalTitle" | "kind" | "year" | "originalLanguage">,
  prefs: ReleasePrefs,
  season: number | null = null,
  episode: number | null = null,
  fileOf: ((r: TsSearchResult) => readonly string[] | null | undefined) | null = null,
): RankedRelease[] {
  const names = [d.originalTitle ?? "", d.title];
  return results
    .filter((r) => isSameTitle(r.title, names, d.year, d.kind))
    .map((result) => {
      const info = withFileTracks(parseRelease(result.title, result.tracker, d.originalLanguage), fileOf?.(result), d.originalLanguage);
      const i = prefs.languages.findIndex((l) => info.languages.includes(l));
      const j = prefs.studios.findIndex((s) => creditsStudio(result.title, s) || info.tracks.some((t) => (t.studio !== null && creditsStudio(t.studio, s)) || (t.credit !== null && creditsStudio(t.credit, s))));
      // Without a studio of the profile: the best translation in the profile's language the release has (its tracks say
      // which), else the release's best one. A studio of the profile decides by itself: "MVO (LostFilm)" and LostFilm's
      // own "rus 1080p WEBDL (LostFilm)" are the same track, and the picture tells them apart (Dexter: Resurrection).
      const kind = j >= 0 ? null : ((i >= 0 ? bestVoiceIn(info, prefs.languages[i]!) : null) ?? info.voice);
      const fit = fitOf(info, prefs.device);
      const floor = floorOf(info, fit, prefs);
      const dead = result.seeders === 0;
      const holds = season !== null ? holdsSeason(info.pack, season, episode) : null;
      // A pack before a single episode (the next ones are there too); how big a pack is decides nothing.
      const e = info.pack.episodes;
      const held = season === null ? 0 : e?.bySeason && !e.open && e.from === e.to ? 0 : 1;
      const rank = [
        dead || holds === false ? 0 : 1,
        i >= 0 ? prefs.languages.length - i : 0,
        info.cam ? 0 : 1,
        floor,
        j >= 0 ? prefs.studios.length - j : 0,
        kind ? VOICE_SCORE[kind] : 0,
        FIT_SCORE[fit],
        ...pictureRank(info, result.size, result.seeders, prefs, d.kind === "movie"),
        held,
        result.seeders ?? -1,
      ];
      return { result, info, language: i >= 0 ? prefs.languages[i]! : null, studio: j >= 0 ? prefs.studios[j]! : null, picture: pictureKey(info), floor, fit, dead, holds, rank };
    })
    .sort((a, b) => compareRank(a.rank, b.rank));
}

/**
 * The kind of translation a studio does in a release: paired in the name, or the release's own kind
 * when it credits that one studio only; null when the name doesn't tell (never another studio's kind).
 */
export function kindOf(info: ReleaseInfo, studio: string): Voice | null {
  const known = VOICE_STUDIOS.find((s) => s.name.toLowerCase() === studio.toLowerCase())?.name ?? studio;
  const track = info.tracks.find((t) => t.studio === known);
  if (track) return track.voice;
  return info.studioVoices[known] ?? (info.studios.length <= 1 ? info.voice : null);
}

/** The release to recommend: the first ranked one, unless nothing is alive (or holds the wanted season). */
export function bestOf(ranked: RankedRelease[]): RankedRelease | undefined {
  const x = ranked[0];
  return x && !x.dead && x.holds !== false ? x : undefined;
}

/**
 * What the audio of a release has to do with the profile: one of its studios ("your dubbing"), or only
 * one of its languages ("your language") — a language match alone is never called the profile's dubbing.
 */
export function audioMatch(x: RankedRelease): { kind: "studio"; studio: string } | { kind: "language"; language: string } | null {
  if (x.studio) return { kind: "studio", studio: x.studio };
  return x.language ? { kind: "language", language: x.language } : null;
}

/**
 * The keys of the audio options a release belongs to, "<language>|<studio or kind>": one per track the name lists,
 * each in its own language (a Russian studio's track is a Russian option, whatever the profile's language — SRC-04,
 * SRC-05); a name that lists none is an option of the profile's language it has, with its kind, or of none.
 */
export function voiceKeys(x: Pick<RankedRelease, "info" | "language">): string[] {
  const tracks = namedTracks(x.info);
  if (tracks.length === 0) return [`${x.language ?? ""}|${x.info.voice ?? ""}`];
  return [...new Set(tracks.map((t) => `${t.language ?? ""}|${t.studio ?? t.voice ?? ""}`))];
}

export interface PictureVersion {
  /** `pictureKey`. */
  key: string;
  resolution: ReleaseInfo["resolution"];
  range: Range | null;
  /** Its best release, in `rankReleases` order. */
  best: RankedRelease;
  count: number;
}

export interface VoiceOption {
  /** What `voiceKeys` gives its releases. */
  key: string;
  /** The studio, or null for a translation no known studio is credited with. */
  studio: string | null;
  voice: Voice | null;
  /** The language of this option's track (its studio's, or the one written next to it), or null when the name doesn't tell. */
  language: string | null;
  /** The best release with it, in `rankReleases` order. */
  best: RankedRelease;
  /** Every picture version it comes in, lowest resolution first (1080p · 4K SDR · 4K HDR). */
  versions: PictureVersion[];
}

const RANGE_ORDER: (Range | null)[] = [null, "sdr", "hdr", "dv"];

/** Picture versions of some releases, lowest resolution first and unknown resolution last; each with its best release. */
export function pictureVersions(ranked: RankedRelease[]): PictureVersion[] {
  const out = new Map<string, PictureVersion>();
  for (const x of ranked) {
    const v = out.get(x.picture);
    if (v) v.count++;
    else out.set(x.picture, { key: x.picture, resolution: x.info.resolution, range: rangeOf(x.info), best: x, count: 1 });
  }
  return [...out.values()].sort((a, b) => (a.resolution ?? 9999) - (b.resolution ?? 9999) || RANGE_ORDER.indexOf(a.range) - RANGE_ORDER.indexOf(b.range));
}

/**
 * The dubbings and voice-overs a title's releases offer, as sites list them under the player: one
 * option per studio (a release with several credited tracks counts for each), else per kind of
 * translation, in each language; ordered by their best release, each with all its picture versions
 * (a studio's 1080p and 4K, SDR and HDR are versions of one option, never folded into one release).
 * A release that names neither studio nor translation is an option of its language, or of none.
 * Cinema recordings and releases without seeders are not offered.
 */
export function voiceOptions(ranked: RankedRelease[], max = 12): VoiceOption[] {
  const groups = new Map<string, { option: Omit<VoiceOption, "versions">; releases: RankedRelease[] }>();
  for (const x of ranked) {
    if (x.info.cam || x.dead) continue;
    for (const key of voiceKeys(x)) {
      const g = groups.get(key);
      if (g) {
        if (!g.releases.includes(x)) g.releases.push(x);
        continue;
      }
      const [language = "", rest = ""] = key.split("|");
      const studio = rest && !(VOICES as string[]).includes(rest) ? rest : null;
      const voice = studio ? kindOf(x.info, studio) : rest ? (rest as Voice) : null;
      groups.set(key, { option: { key, studio, voice, language: language || null, best: x }, releases: [x] });
    }
  }
  return [...groups.values()].slice(0, max).map((g) => ({ ...g.option, versions: pictureVersions(g.releases) }));
}

/** Why the pick's picture version won among its audio option's versions, in the quality mode's terms. */
export type PictureReason = "uhdHere" | "noUhdScreen" | "noHevc" | "uhdNotSmooth" | "sdrScreen" | "hdrScreen" | "best" | "maxResolution" | "smallest";

/**
 * The reasons for a pick among `among` (its audio option's releases): the resolution or the mode's
 * own measure first, then the screen when an SDR and an HDR version of that resolution were both
 * there. Empty when there was nothing to choose between.
 */
export function pictureReasons(x: RankedRelease, among: RankedRelease[], prefs: ReleasePrefs): PictureReason[] {
  const others = among.filter((o) => !o.dead && !o.info.cam && o.picture !== x.picture);
  if (others.length === 0) return [];
  if (prefs.quality === "small") return x.result.size ? ["smallest"] : [];
  const out: PictureReason[] = [];
  if (prefs.quality === "best") out.push(x.info.source ? "best" : "maxResolution");
  else if (x.info.resolution === 2160) {
    if (uhdFits(prefs.device)) out.push("uhdHere");
  } else if (others.some((o) => o.info.resolution === 2160)) {
    if (!prefs.device.uhd) out.push("noUhdScreen");
    else if (!prefs.device.hevc) out.push("noHevc");
    else if (prefs.device.uhdSmooth === false) out.push("uhdNotSmooth");
  }
  const isHdr = (o: RankedRelease) => o.info.hdrFormats.length > 0;
  if (others.some((o) => o.info.resolution === x.info.resolution && isHdr(o) !== isHdr(x))) {
    if (isHdr(x) && prefs.device.hdr) out.push("hdrScreen");
    if (!isHdr(x) && !prefs.device.hdr) out.push("sdrScreen");
  }
  return out;
}

/** The dubbing or voice-over chosen before the file was read: its studio and language. */
export interface VoiceWish {
  studio: string | null;
  language: string | null;
}

/** The studio and language of an audio option's key (`voiceKeys`); a key naming only a kind of translation has no studio. */
export function voiceWish(key: string | null): VoiceWish | null {
  if (!key) return null;
  const [language = "", rest = ""] = key.split("|");
  return { studio: rest && !(VOICES as string[]).includes(rest) ? rest : null, language: language || null };
}

/** ISO 639-2 codes (bibliographic and terminology) files tag their tracks with, by ISO 639-1. */
const ISO_639_2: Record<string, string[]> = {
  ru: ["rus"],
  uk: ["ukr"],
  en: ["eng"],
  ja: ["jpn"],
  de: ["ger", "deu"],
  fr: ["fre", "fra"],
  es: ["spa"],
  it: ["ita"],
  pl: ["pol"],
  pt: ["por"],
  tr: ["tur"],
};

/** An audio track as ffprobe reads a file: its tags, and whether the file plays it by default. */
export interface FileTrack {
  index: number;
  title: string | null;
  language: string | null;
  default?: boolean;
}

/**
 * Whether a file's track is in a language: by its language tag; untagged ("und" too), by a language its title names
 * ("RUS", "Ukr") or else by the studio it credits ("MVO [LostFilm]" is Russian).
 */
function speaks(t: FileTrack, language: string): boolean {
  const tag = t.language?.toLowerCase() ?? null;
  const base = language.split("-")[0]!;
  if (tag && tag !== "und") return tag === base || (ISO_639_2[base] ?? []).includes(tag);
  if (!t.title) return false;
  const title = t.title.replace(/[._]/g, " ");
  const named = LANG_WORDS.find(([, re]) => re.test(title))?.[0] ?? VOICE_STUDIOS.find((s) => s.match.test(title))?.lang ?? null;
  return named === base;
}

/** Of several tracks that are all it (one studio's "MVO [HDrezka Studio]" and its "… 18+" cut): the default one, else the first. */
const firstOf = (tracks: FileTrack[]) => (tracks.find((t) => t.default) ?? tracks[0])?.index ?? null;

const credits = (t: FileTrack, studio: string) => t.title !== null && creditsStudio(t.title, studio);

/**
 * The audio track a chosen studio is on, by the titles a file gives its tracks ("MVO (HDrezka Studio)"): a track
 * crediting the studio, in the wished language when several do; when several are left they are that studio's own
 * versions ("18+"), and the file's default among them plays, else the first. A file whose tracks credit no studio at
 * all (LostFilm's own: "RUS", "ENG") has it on its one track in the wished language. A wish of a language alone (a
 * Ukrainian dub no studio is credited with) is a track in that language: the one of the profile's first `studios`
 * there is, else the default, else the first. A file with a single track is that track. Null when no track can be
 * told to be it — nothing is guessed then.
 */
export function voiceTrack(tracks: FileTrack[], wish: VoiceWish, studios: string[] = []): number | null {
  const studio = wish.studio;
  if (tracks.length === 0) return null;
  if (!studio) return wish.language && tracks.some((t) => speaks(t, wish.language!)) ? profileTrack(tracks, { languages: [wish.language], studios }) : null;
  if (tracks.length === 1) return tracks[0]!.index;
  let hits = tracks.filter((t) => credits(t, studio));
  if (hits.length > 1 && wish.language) {
    const inLanguage = hits.filter((t) => speaks(t, wish.language!));
    if (inLanguage.length > 0) hits = inLanguage;
  }
  if (hits.length > 0) return firstOf(hits);
  if (wish.language && !tracks.some((t) => t.title !== null && VOICE_STUDIOS.some((s) => s.match.test(t.title!.replace(/[._]/g, " "))))) {
    const inLanguage = tracks.filter((t) => speaks(t, wish.language!));
    if (inLanguage.length === 1) return inLanguage[0]!.index;
  }
  return null;
}

/**
 * The track a profile hears first when no audio was chosen for this file (a copy already on the server, the next
 * episode, a viewing sent to a TV): the order "Where to watch" offers audio in (`forProfile`) — the first of the
 * profile's languages a track is in, and in it the track of the profile's first studio there is, else that language's
 * default or first track; with no track in its languages, the track of its first studio there is. Null when neither
 * finds a track: the file's default plays. A file that lists "MVO [HDrezka Studio]" first and "MVO [LostFilm]" fifth
 * plays LostFilm for "1 — LostFilm, 2 — HDRezka".
 */
export function profileTrack(tracks: FileTrack[], prefs: Pick<ReleasePrefs, "languages" | "studios">): number | null {
  for (const language of prefs.languages) {
    const inLanguage = tracks.filter((t) => speaks(t, language));
    if (inLanguage.length === 0) continue;
    for (const studio of prefs.studios) {
      const hits = inLanguage.filter((t) => credits(t, studio));
      if (hits.length > 0) return firstOf(hits);
    }
    return firstOf(inLanguage);
  }
  for (const studio of prefs.studios) {
    const hits = tracks.filter((t) => credits(t, studio));
    if (hits.length > 0) return firstOf(hits);
  }
  return null;
}

/**
 * A file's audio tracks ("<language tag>|<title>", as `torrentTracks` keeps them: "rus|MVO, LostFilm") read as a
 * release name's tracks, in the file's order: each title's kind, studio or other credit and the original, its language
 * by the tag (else by the title or the studio). What a name that says "6x MVO" doesn't tell.
 */
export function fileTracks(list: readonly string[], originalLanguage: string | null = null): ReleaseTrack[] {
  return list.map((entry) => {
    const bar = entry.indexOf("|");
    const tag = bar >= 0 ? entry.slice(0, bar).toLowerCase() : "";
    const title = bar >= 0 ? entry.slice(bar + 1) : entry;
    const byTag = tag && tag !== "und" ? (Object.entries(ISO_639_2).find(([, codes]) => codes.includes(tag))?.[0] ?? (tag.length === 2 ? tag : null)) : null;
    const t = tracksOf(title, null, originalLanguage);
    const own = t.find((x) => !x.original && (x.studio || x.voice || x.credit)) ?? t.find((x) => x.original) ?? t[0];
    const track: ReleaseTrack = own ? { ...own } : { language: null, voice: null, studio: null, credit: null, original: false };
    // A name no studio list knows, after the kind: "Дубляж, Dragon Studio", "MVO [LE-Production]".
    if (!track.studio && !track.credit && !track.original) {
      const name = /(?:,|\(|\[)\s*([^,()[\]|]{2,40}?)\s*[)\]]?\s*(?:18\+)?\s*$/u.exec(title)?.[1]?.trim();
      if (name && /\p{L}{2}/u.test(name) && !LANG_ONLY.test(name) && !NOT_A_CREDIT.test(name) && !voiceOfToken(name)) track.credit = name;
    }
    if (byTag) track.language = byTag;
    if (!track.original && originalLanguage && track.language === originalLanguage && !track.voice && !track.studio && !track.credit) track.original = true;
    return track;
  });
}

/** A release's name as its file's tracks tell it, when they were read (`fileTracks`): its studios and languages too. */
export function withFileTracks(info: ReleaseInfo, list: readonly string[] | null | undefined, originalLanguage: string | null = null): ReleaseInfo {
  if (!list?.length) return info;
  const tracks = fileTracks(list, originalLanguage);
  const studios = [...new Set([...info.studios, ...tracks.flatMap((t) => (t.studio ? [t.studio] : []))])];
  const languages = [...new Set([...info.languages, ...tracks.flatMap((t) => (t.language ? [t.language] : []))])];
  return { ...info, tracks, studios, languages };
}

/**
 * The track of a release's name the profile hears first (`profileTrack` over the name's tracks, its first listed as
 * the file's default — names list tracks in the file's order): what a copy already on the server says it plays.
 */
export function profileNameTrack(info: Pick<ReleaseInfo, "tracks">, prefs: Pick<ReleasePrefs, "languages" | "studios">): ReleaseTrack | null {
  const i = profileTrack(
    info.tracks.map((t, index) => ({ index, title: t.studio ?? t.credit, language: t.language, default: index === 0 })),
    prefs,
  );
  return i === null ? null : (info.tracks[i] ?? null);
}
