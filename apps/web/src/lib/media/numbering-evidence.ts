import type { TitleSummary } from "@lumovio/contracts";
import { api } from "@/lib/api";
import { background } from "@/lib/optional";
import { isSameTitle, packOf } from "./releases";
import {
  episodeOf,
  isExtra,
  isVideoFile,
  seasonOfText,
  type TsFile,
  type TsSearchResult,
} from "./torrserver";

/**
 * What a series' releases say about its seasons, sent to Lumovio so the series is numbered as releases count it (api
 * modules/numbering: Бумажный дом is 13 + 9 + 8 + 8 + 10 in releases, 15 + 16 + 10 in TMDB's own seasons). Only
 * numbers leave the device: never a release's name, link, hash or tracker.
 */
export interface NumberingItem {
  season: number;
  /** "max": the season has at least `episodes`; "total": a name states its length. */
  kind: "max" | "total";
  episodes: number;
  /** How many of the releases say it. */
  releases: number;
}

const add = (
  into: Map<string, NumberingItem>,
  season: number,
  kind: NumberingItem["kind"],
  episodes: number,
) => {
  if (season < 1 || season > 99 || episodes < 1 || episodes > 999) return;
  const k = `${season}:${kind}:${episodes}`;
  const was = into.get(k);
  into.set(k, { season, kind, episodes, releases: (was?.releases ?? 0) + 1 });
};

const lower = (s: string) =>
  s.toLowerCase().replace(/ё/g, "е").replace(/[._]/g, " ").replace(/\s+/g, " ").trim();

/** What may follow the title in a name of this very series: a season or episode mark, or a number. */
const MARK = /^(?:s\d|e\d|сезон|season|серии|серія|серії|episodes?|tv[-\s]?\d|complete|\d)/iu;
const fits = (rest: string) => rest === "" || /^[[(,.]/.test(rest) || MARK.test(rest);

/**
 * Stricter than the sources screen's `isSameTitle`, since another series' seasons would count against this one's: the
 * title must be followed by nothing, a bracket, a year or a season mark — "Firefly Lane", "Sherlock Holmes", "Lupin
 * III" and spin-offs after a colon or a dash ("Бумажный дом: Корея", "Money Heist - Berlin") are other series — and a
 * series named alike that started years before is another one too ("Shameless (2004-2013)" for the 2011 one).
 */
function sameSeries(release: string, names: string[], year: number | null): boolean {
  const wanted = names.filter(Boolean).map(lower);
  let found = false;
  for (const part of lower(release).split(/\s*[/|]\s*/)) {
    for (const n of wanted) {
      if (!part.startsWith(n)) continue;
      const rest = part.slice(n.length).trimStart();
      // ": 1-8" (a season list without its word) and "- S2E1-9" are this series; ": Корея" or "- Berlin" another.
      const after = rest.replace(/^[:\-–—]\s*/, "");
      if (!fits(rest) && (after === rest || !fits(after))) return false;
      found = true;
    }
  }
  const years = [...release.matchAll(/(?<!\d)(19\d{2}|20\d{2})(?!\d)/g)].map((m) => Number(m[1]));
  return found && !(year && years.length > 0 && Math.min(...years) < year - 1);
}

/**
 * This title's release names that state one season (not anime cours) and its episodes: "Сезон 2, серии 1-9 из 9" gives
 * the season's length, "S02E01-09" or "Серии 1-9" its highest episode at least. Names of several seasons or of none say
 * nothing; a name is counted once however many trackers list it.
 */
export function namesNumbering(
  results: TsSearchResult[],
  d: Pick<TitleSummary, "title" | "originalTitle" | "year" | "kind">,
): NumberingItem[] {
  const names = [d.originalTitle ?? "", d.title];
  const out = new Map<string, NumberingItem>();
  const seen = new Set<string>();
  for (const r of results) {
    if (
      seen.has(r.title) ||
      !isSameTitle(r.title, names, d.year, d.kind) ||
      !sameSeries(r.title, names, d.year)
    )
      continue;
    seen.add(r.title);
    const { seasons, cours, episodes } = packOf(r.title);
    if (!seasons || cours || seasons.from !== seasons.to || !episodes) continue;
    // "S2E1-8 of 10", "Серии 1-8 из 10": the season's length; without a total, its highest episode at least.
    const { of } = episodes;
    if (of !== null && of >= episodes.to) add(out, seasons.from, "total", of);
    else add(out, seasons.from, "max", episodes.to);
  }
  return [...out.values()];
}

/** One torrent's files: the highest episode of each season its files name (the season from a file, its folder or the torrent's title). */
export function filesNumbering(files: TsFile[], torrentTitle: string): NumberingItem[] {
  const pack = seasonOfText(torrentTitle);
  const top = new Map<number, number>();
  for (const f of files) {
    if (!isVideoFile(f.path) || isExtra(f.path)) continue;
    const e = episodeOf(f.path, pack);
    if (e?.season) top.set(e.season, Math.max(top.get(e.season) ?? 0, e.episode));
  }
  const out = new Map<string, NumberingItem>();
  for (const [season, episodes] of top) add(out, season, "max", episodes);
  return [...out.values()];
}

const sent = new Set<string>();

/** Sends it once per page load; nobody waits on it, and a failure only leaves it for the next search or playback. */
export function reportNumbering(titleId: string, source: "names" | "files", seasons: NumberingItem[]): void {
  if (!titleId.startsWith("tv:") || seasons.length === 0) return;
  const key = `${titleId}|${source}|${JSON.stringify(seasons)}`;
  if (sent.has(key)) return;
  sent.add(key);
  background(
    api("/api/numbering/evidence", {
      method: "POST",
      json: { titleId, source, seasons: seasons.slice(0, 100) },
    }),
  );
}
