"use client";

import { useLocale, useTranslations } from "next-intl";
import { LandscapeCard } from "@/components/media/LandscapeCard";
import { Row } from "@/components/media/Row";
import { formatDate } from "@/lib/format";
import { dayAfter, type Entry, href, useWhat } from "./calendar-entries";

// Its own chunk (bundle budget): a shelf and its cards bring the card menu and the personal actions (~11 KB gzip);
// the calendar starts loading it with its data, so it is in place by the time the data is.

/** The past week: the shows' art, newest first, with the episode and the day it came out. */
export function OutShelf({ entries: list, today }: { entries: Entry[]; today: string }) {
  const t = useTranslations("calendar");
  const tc = useTranslations("common");
  const locale = useLocale();
  const what = useWhat();
  const yesterday = dayAfter(today, -1);
  // Inside the line, lower case: "Episode 10 · yesterday".
  const when = (day: string) => (day === yesterday ? tc("yesterday").toLocaleLowerCase(locale) : formatDate(day, locale, { weekday: "short", day: "numeric", month: "short" }));
  return (
    <Row id="cal-out" kind="landscape" title={t("out")}>
      {list.map((e) => {
        const meta = [what(e), when(e.day)];
        return <LandscapeCard key={e.key} title={e.first.title} href={href(e.first)} meta={meta} label={[e.first.title.title, ...meta].filter(Boolean).join(", ")} />;
      })}
    </Row>
  );
}

