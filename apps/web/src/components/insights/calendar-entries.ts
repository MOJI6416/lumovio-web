import type { CalendarEvent } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import { eventDay, localDay } from "@/lib/format";
import { titleHref } from "@/lib/slug";

/** The calendar's lines and the shelf of what came out (CalendarView, CalendarShelf): one way to group and to say them. */

export const dayAfter = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDay(d);
};

/** One line of the calendar: a show's episodes on one day (a whole season dropped at once is one line), or a film. */
export interface Entry {
  key: string;
  day: string;
  first: CalendarEvent;
  episodes: number[];
}

/** A day's events by show and season, in the order they air. */
export function entries(events: CalendarEvent[]): Entry[] {
  const out: Entry[] = [];
  const at = new Map<string, Entry>();
  for (const e of events) {
    const day = eventDay(e);
    const key = `${day}:${e.title.id}:${e.kind === "episode" && !e.special ? e.season : `${e.episode ?? e.episodeName}`}`;
    const same = at.get(key);
    if (same && e.episode !== null) same.episodes.push(e.episode);
    else {
      const entry = { key, day, first: e, episodes: e.episode !== null ? [e.episode] : [] };
      at.set(key, entry);
      out.push(entry);
    }
  }
  return out;
}

/** "Season 28 · Episode 6", a dropped season's "Season 1 · Episodes 1–8", "Special", "Movie". */
export function useWhat() {
  const t = useTranslations("calendar");
  const tc = useTranslations("common");
  const tcard = useTranslations("card");
  return (e: Entry) => {
    const f = e.first;
    if (f.kind === "movie") return tc("movie");
    if (f.special) return t("special");
    if (f.season === null) return null;
    const n = [...new Set(e.episodes)].sort((a, b) => a - b);
    if (n.length > 1) {
      const run = n.at(-1)! - n[0]! === n.length - 1;
      return run ? t("episodeRange", { season: f.season, from: n[0]!, to: n.at(-1)! }) : t("episodeCount", { season: f.season, count: n.length });
    }
    return f.episode !== null ? tcard("episode", { season: f.season, episode: f.episode }) : null;
  };
}

export const href = (f: CalendarEvent) => `${titleHref(f.title.kind, f.title.tmdbId, f.title.title)}${f.kind === "episode" ? "?tab=episodes" : ""}`;

