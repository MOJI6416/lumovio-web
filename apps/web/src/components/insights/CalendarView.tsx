"use client";

import type { CalendarEvent } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, Tv } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Poster } from "@/components/media/Poster";
import { AccentBadge, Tag } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSpoilerPrefs } from "@/hooks/useSpoilers";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { eventDay, formatDate, localDay } from "@/lib/format";
import { titleHref } from "@/lib/slug";

/**
 * The calendar (S11; INS-03…INS-05): today first — always marked, even on a day with nothing — then the coming days;
 * the past week folded under "Earlier" at the end. Every entry opens the title (an episode — its "Episodes" tab), never
 * the player: whether it can be played is said there. Nothing coming: an EmptyState that tells how a show gets here
 * ("Notify" on its page) and where to find shows.
 */
export function CalendarView() {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["calendar", locale], queryFn: () => api<{ events: CalendarEvent[] }>("/api/calendar") });
  // A failed load is not "nothing scheduled" (X-14).
  return (
    <QueryState
      query={q}
      loading={
        <div className="space-y-3">
          <Skeleton shape="xs" className="h-6 w-40" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} shape="md" className="h-20 w-full" />
          ))}
        </div>
      }
      isEmpty={(d) => d.events.length === 0}
      empty={
        <EmptyState
          icon={CalendarDays}
          title={t("empty")}
          text={t("emptyHint")}
          action={
            <Link href="/browse/tv" className={buttonClass("primary")}>
              <Tv aria-hidden />
              {t("findSeries")}
            </Link>
          }
        />
      }
      error={{ title: t("loadError") }}
    >
      {(d) => <Days events={d.events} />}
    </QueryState>
  );
}

function Days({ events }: { events: CalendarEvent[] }) {
  const t = useTranslations("calendar");
  const [showPast, setShowPast] = useState(false);
  // Days are the viewer's own: an exact air time is shown in their time zone, a date-only release on its date.
  const today = localDay();
  const groups = new Map<string, CalendarEvent[]>();
  for (const e of events) groups.set(eventDay(e), [...(groups.get(eventDay(e)) ?? []), e]);
  const days = [...groups.keys()].sort();
  const coming = days.filter((d) => d >= today);
  const past = days.filter((d) => d < today).reverse();
  const pastCount = past.reduce((n, d) => n + groups.get(d)!.length, 0);

  return (
    <>
      <ol className="space-y-8">
        {/* "Today" is always there to find one's place, with or without anything on it (INS-03). */}
        {coming[0] !== today && (
          <li>
            <DayHeading date={today} today={today} />
            <p className="text-body text-text-2">{coming.length ? t("nothingToday") : t("nothingComing")}</p>
          </li>
        )}
        {coming.map((date) => (
          <Day key={date} date={date} today={today} list={groups.get(date)!} />
        ))}
      </ol>
      {past.length > 0 && (
        <section className="mt-10" aria-labelledby="cal-past">
          <h2 id="cal-past">
            <Button variant="tertiary" aria-expanded={showPast} aria-controls="cal-past-days" onClick={() => setShowPast((v) => !v)}>
              <ChevronDown aria-hidden className={cn("transition-transform duration-base ease-base", showPast && "rotate-180")} />
              {t("earlier", { count: pastCount })}
            </Button>
          </h2>
          <ol id="cal-past-days" hidden={!showPast} className="mt-4 space-y-8">
            {past.map((date) => (
              <Day key={date} date={date} today={today} list={groups.get(date)!} past />
            ))}
          </ol>
        </section>
      )}
      {events.some((e) => e.source === "tvmaze") && (
        <p className="mt-8 text-body-s text-text-2">
          {t("scheduleCredit")}{" "}
          <a href="https://www.tvmaze.com" target="_blank" rel="noreferrer noopener" className="underline underline-offset-3 hover:text-text-1 inline-flex min-h-6 items-center max-sm:min-h-11">
            TVmaze
          </a>
        </p>
      )}
    </>
  );
}

function DayHeading({ date, today }: { date: string; today: string }) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const tomorrow = localDay(new Date(Date.now() + 864e5));
  const special = date === today ? t("today") : date === tomorrow ? t("tomorrow") : null;
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  const full = formatDate(date, locale, sameYear ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" });
  return (
    <h2 className="mb-3 flex flex-wrap items-baseline gap-x-3">
      <span className="text-h3 text-text-1 first-letter:uppercase">{special ?? full}</span>
      {special && <span className="text-body-s text-text-2">{formatDate(date, locale, { day: "numeric", month: "long" })}</span>}
    </h2>
  );
}

function Day({ date, today, list, past }: { date: string; today: string; list: CalendarEvent[]; past?: boolean }) {
  const t = useTranslations("calendar");
  const tc = useTranslations("common");
  const tcard = useTranslations("card");
  const locale = useLocale();
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  // A profile that hides the names of unwatched episodes (8.12) sees the numbers only.
  const hideNames = useSpoilerPrefs().names;
  return (
    <li>
      <DayHeading date={date} today={today} />
      <ul className="space-y-2">
        {list.map((e) => {
          const what =
            e.kind === "movie"
              ? tc("movie")
              : e.special
                ? t("special")
                : e.season !== null && e.episode !== null
                  ? tcard("episode", { season: e.season, episode: e.episode })
                  : null;
          return (
            <li key={`${e.title.id}-${e.season}-${e.episode ?? e.episodeName}`}>
              <Link
                href={`${titleHref(e.title.kind, e.title.tmdbId, e.title.title)}${e.kind === "episode" ? "?tab=episodes" : ""}`}
                className={cn(
                  "flex items-center gap-4 rounded-md border border-line bg-surface-1 p-3 transition-colors duration-fast ease-fast hover:border-line-2",
                  past && "bg-bg",
                )}
              >
                <div className="w-12 shrink-0 overflow-hidden rounded-sm">
                  <Poster path={e.title.posterPath} title="" kind={e.title.kind} sizes="48px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-title text-text-1">{e.title.title}</p>
                  <p className="text-body-s text-text-2">{[what, hideNames ? null : e.episodeName].filter(Boolean).join(" · ")}</p>
                </div>
                {(e.airstamp || e.channel) && (
                  <p className="shrink-0 text-end text-body-s text-text-2">
                    {e.airstamp && (
                      <time dateTime={e.airstamp} className="block text-title tabular-nums text-text-1">
                        {time.format(new Date(e.airstamp))}
                      </time>
                    )}
                    {e.channel}
                  </p>
                )}
                {/* Something new is the one accent on the row; a finale is a plain label (7.4). */}
                {e.badge === "finale" ? <Tag>{t("finale")}</Tag> : e.badge ? <AccentBadge>{e.badge === "premiere" ? t("premiere") : t("seasonPremiere")}</AccentBadge> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
