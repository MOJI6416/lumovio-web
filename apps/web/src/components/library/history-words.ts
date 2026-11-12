"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDate, localDay } from "@/lib/format";
import { episodesOf, type Group } from "./history";

/**
 * What a history card says under its poster: the day it was watched ("Today", "Yesterday", "4 Nov", earlier
 * years with the year) and what of it — a film watched twice "2 times", a show's "Season 1 · episodes 1–3". The
 * time and where a watch came from are left out: the day finds the card, the title page has the rest.
 */
export function useHistoryCaption() {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const tcard = useTranslations("card");
  const locale = useLocale();
  const today = localDay();
  const yesterday = localDay(new Date(Date.now() - 864e5));
  const year = String(new Date().getFullYear());
  const day = (d: string) =>
    d === today
      ? tc("today")
      : d === yesterday
        ? tc("yesterday")
        : (formatDate(d, locale, { day: "numeric", month: "short", ...(d.startsWith(year) ? {} : { year: "numeric" }) }) ?? d);
  return (g: Group) => {
    const eps = episodesOf(g.entries);
    const what =
      g.title.kind === "movie"
        ? g.entries.length > 1
          ? t("historyTimes", { count: g.entries.length })
          : null
        : eps.kind === "one"
          ? tcard("episode", { season: eps.season, episode: eps.episode })
          : eps.kind === "range"
            ? t("historyEpisodeRange", { season: eps.season, from: eps.from, to: eps.to })
            : eps.kind === "many"
              ? tc("episodes", { count: eps.count })
              : t("historyWholeShow");
    return [day(g.day), what].filter(Boolean).join(" · ");
  };
}

/** The month a history section is ("November", earlier years "October 2025"), from a "YYYY-MM-DD" day. */
export function useMonthName() {
  const locale = useLocale();
  const year = new Date().getFullYear();
  return (day: string) => {
    const [y, m] = day.split("-").map(Number) as [number, number];
    const date = new Date(y, m - 1, 1);
    return new Intl.DateTimeFormat(locale, y === year ? { month: "long" } : { month: "long", year: "numeric" }).format(date);
  };
}
