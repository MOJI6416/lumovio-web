import { languageCode } from "../explain";

/*
 * Which subtitles start shown, and the choice remembered for the title like the dubbing is: the track picked
 * last time for this title, matched by language and kind (never by position — another episode's file has its own
 * order); else, when the audio is in a language the profile doesn't list among its audio languages, the first of its
 * subtitle languages (Settings → Profile, "chosen in this order"); else the audio language's forced subtitles (signs
 * and foreign lines of a dubbed film); else none. The timing offset set in the player is remembered for the title too.
 */

export interface SubtitleFacts {
  lang: string | null;
  forced: boolean;
  name: string | null;
}

export type SubtitleMemory =
  | { off: true }
  | { off?: false; lang: string | null; forced: boolean; name: string | null };

const norm = (l: string | null | undefined) => languageCode((l ?? "").split("-")[0]);

export function pickSubtitle(
  tracks: SubtitleFacts[],
  ctx: {
    memory: SubtitleMemory | null;
    audioLang: string | null;
    audioLanguages: string[];
    subtitleLanguages: string[];
  },
): number | null {
  if (!tracks.length) return null;
  const m = ctx.memory;
  if (m?.off) return null;
  if (m) {
    const lang = norm(m.lang);
    const same = (t: SubtitleFacts) => norm(t.lang) === lang && t.forced === m.forced;
    const i = tracks.findIndex((t) => same(t) && (t.name ?? null) === (m.name ?? null));
    if (i >= 0) return i;
    const j = tracks.findIndex(same);
    if (j >= 0) return j;
    const k = tracks.findIndex((t) => norm(t.lang) === lang && !t.forced);
    if (k >= 0 && !m.forced) return k;
  }
  const audio = norm(ctx.audioLang);
  const understood = ctx.audioLanguages.map(norm);
  if (audio && understood.length && !understood.includes(audio))
    for (const want of ctx.subtitleLanguages.map(norm)) {
      const i = tracks.findIndex((t) => norm(t.lang) === want && !t.forced);
      if (i >= 0) return i;
    }
  if (audio) {
    const f = tracks.findIndex((t) => t.forced && norm(t.lang) === audio);
    if (f >= 0) return f;
  }
  return null;
}

const KEY = "lumovio.player.subtitles";
const KEEP = 200;

/** The remembered choice for a title on this device (per profile). */
export function loadMemory(key: string): SubtitleMemory | null {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, SubtitleMemory>;
    return all[key] ?? null;
  } catch {
    return null;
  }
}

export function saveMemory(key: string, value: SubtitleMemory) {
  remember(KEY, key, value);
}

/** The latest `KEEP` titles' values under `storageKey`, the newest last; `undefined` forgets the title's. */
function remember(storageKey: string, key: string, value: unknown) {
  try {
    const all = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, unknown>;
    delete all[key];
    if (value !== undefined) all[key] = value;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete all[k];
    localStorage.setItem(storageKey, JSON.stringify(all));
  } catch {
    // Storage unavailable: the choice holds for this playback only.
  }
}

const OFFSET_KEY = "lumovio.player.subtitle-offset";

/** The subtitle timing offset set for a title on this device (per profile), in seconds; 0 when none. */
export function loadOffset(key: string): number {
  try {
    const v = (JSON.parse(localStorage.getItem(OFFSET_KEY) ?? "{}") as Record<string, unknown>)[key];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

/** Remembers the offset for the title; back at 0 it is forgotten. */
export function saveOffset(key: string, value: number) {
  remember(OFFSET_KEY, key, value === 0 ? undefined : value);
}
