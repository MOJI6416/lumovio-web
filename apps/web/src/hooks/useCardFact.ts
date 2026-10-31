"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { formatDate, formatRuntime } from "@/lib/format";

/**
 * Why a card is on its shelf, in a few words: the day a copy arrived on the profile's servers, a
 * cinema or first digital release, a new season or premiere, the next episode, a series' length, or
 * the runtime a length limit chose a film by. Null on shelves that choose by something the card
 * already shows (popularity, genre, rating).
 */
export function useCardFact(title: TitleSummary): string | null {
  const tr = useTranslations();
  const locale = useLocale();
  const day = (iso: string) => formatDate(iso, locale, { day: "numeric", month: "short" }) ?? iso;
  const time = (min: number | null | undefined) => formatRuntime(min, (k, v) => tr(k as "common.minutes", v));
  if (title.serverEvent) return tr("rows.addedOn", { date: day(title.serverEvent.date) });
  const release = title.release;
  if (release) {
    const key = release.type === "digital" ? "rows.digitalOn" : release.rerelease ? "rows.rereleaseOn" : "rows.releaseOn";
    return tr(key, { date: day(release.date) });
  }
  const f = title.seriesFact;
  switch (f?.kind) {
    case "season":
      return f.complete ? tr("rows.seasonComplete", { season: f.season }) : tr("rows.seasonAiring", { season: f.season, count: f.aired });
    case "premiere":
      return tr("rows.premiereOn", { date: day(f.date) });
    case "airing":
      return f.next ? tr("rows.nextEpisodeOn", { date: day(f.next) }) : f.last ? tr("rows.lastEpisodeOn", { date: day(f.last) }) : null;
    case "length": {
      if (f.seasons > 1) return tr("rows.lengthSeasons", { seasons: f.seasons, episodes: f.episodes });
      const each = time(f.episodeRuntime);
      return each ? tr("rows.lengthEpisodesEach", { count: f.episodes, time: each }) : tr("rows.lengthEpisodes", { count: f.episodes });
    }
  }
  return time(title.runtime);
}
