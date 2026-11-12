import type { HistoryEntry, TitleSummary } from "@lumovio/contracts";
import { localDay } from "@/lib/format";

/** One row of the history: a title on one day, with every watch of it that day (no identical rows). */
export interface Group {
  key: string;
  day: string;
  title: TitleSummary;
  entries: HistoryEntry[];
}

export function groupHistory(entries: HistoryEntry[]): { day: string; groups: Group[] }[] {
  const days: { day: string; groups: Group[] }[] = [];
  for (const e of entries) {
    const day = localDay(new Date(e.watchedAt));
    let d = days.at(-1);
    if (!d || d.day !== day) {
      d = { day, groups: [] };
      days.push(d);
    }
    const key = `${day}|${e.title.id}`;
    const g = d.groups.find((x) => x.key === key);
    if (g) g.entries.push(e);
    else d.groups.push({ key, day, title: e.title, entries: [e] });
  }
  return days;
}

/** "1 сезон · 4 серия", "1 сезон · 4–6 серия", "3 серии" — the format for what was watched in a group. */
export function episodesOf(entries: HistoryEntry[]) {
  const eps = [
    ...new Map(
      entries
        .filter((e) => e.season !== null && e.episode !== null)
        .map((e) => [`${e.season}:${e.episode}`, e]),
    ).values(),
  ].sort((a, b) => a.season! - b.season! || a.episode! - b.episode!);
  if (eps.length === 0) return { kind: "none" as const };
  if (eps.length === 1) return { kind: "one" as const, season: eps[0]!.season!, episode: eps[0]!.episode! };
  const season = eps[0]!.season!;
  const consecutive = eps.every((e, i) => e.season === season && e.episode === eps[0]!.episode! + i);
  return consecutive
    ? { kind: "range" as const, season, from: eps[0]!.episode!, to: eps.at(-1)!.episode! }
    : { kind: "many" as const, count: eps.length };
}
