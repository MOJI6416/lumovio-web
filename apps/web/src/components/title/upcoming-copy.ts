"use client";

import type { TitleUpcoming } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { formatDate } from "@/lib/format";
import { untilDay } from "./core";

/**
 * What is still to come in words: "Coming 16 December", "Premieres 25 November", "Season 9 premieres 6 January 2027",
 * "New episode 18 November", "Release date not announced" — the year only when it isn't this one; `until` says how far
 * off it is.
 */
export function useUpcomingCopy() {
  const t = useTranslations("titlePage");
  const locale = useLocale();
  return (u: TitleUpcoming, today: string): { text: string; until: string | null } => {
    if (!u.date) return { text: t("upcomingUnannounced"), until: null };
    const date = formatDate(u.date, locale, { day: "numeric", month: "long", ...(u.date.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }) }) ?? u.date;
    const text =
      u.kind === "release"
        ? t("upcomingRelease", { date })
        : u.kind === "premiere"
          ? t("upcomingPremiere", { date })
          : u.kind === "season"
            ? t("upcomingSeason", { season: u.season, date })
            : t("upcomingEpisode", { date });
    return { text, until: untilDay(u.date, today, locale) };
  };
}
