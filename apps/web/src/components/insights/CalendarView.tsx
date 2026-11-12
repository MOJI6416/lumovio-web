"use client";

import type { CalendarEvent } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Tv } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { lazy, Suspense, useEffect } from "react";
import { Artwork } from "@/components/media/Artwork";
import { Tag } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSpoilerPrefs } from "@/hooks/useSpoilers";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { formatDate, localDay } from "@/lib/format";
import { tmdbImage } from "@/lib/images";
import { dayAfter, type Entry, entries, href, useWhat } from "./calendar-entries";

const loadShelf = () => import("./CalendarShelf");
const OutShelf = lazy(() => loadShelf().then((m) => ({ default: m.OutShelf })));

/** Days shown one by one from today; after them, each show once at its next date ("Later"). */
const NEAR_DAYS = 14;
/**
 * How far ahead the calendar asks: a show's next season, and a film put on the calendar from its page, are often dated
 * a year or more before (the API loads the same seasons for any window; films come from the profile's own list).
 */
const AHEAD_DAYS = 730;

/**
 * The calendar: a timeline of the profile's shows and watchlist films, read top
 * to bottom. "Out" — the past week as a shelf of the shows' art, what can be watched now; then today, always there to
 * find one's place, and each of the next two weeks' days; then "Later" — each show once, at the date it comes back.
 * A whole season dropped on one day is one line ("Season 1 · Episodes 1–8"). Every line opens the title's episodes,
 * never the player: whether it can be played is said there.
 */
export function CalendarView() {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const today = localDay();
  // The shelf's chunk comes while the data does.
  useEffect(() => void loadShelf(), []);
  const q = useQuery({
    queryKey: ["calendar", "page", today, locale],
    queryFn: () => api<{ events: CalendarEvent[] }>(`/api/calendar?from=${dayAfter(today, -7)}&to=${dayAfter(today, AHEAD_DAYS)}`),
  });
  // A failed load is not "nothing scheduled".
  return (
    <QueryState
      query={q}
      loading={<CalendarSkeleton />}
      isEmpty={(d) => d.events.length === 0}
      empty={
        <EmptyState
          icon={CalendarDays}
          title={t("empty")}
          about={t("emptyHint")}
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
      {(d) => <Timeline events={d.events} today={today} />}
    </QueryState>
  );
}

function Timeline({ events, today }: { events: CalendarEvent[]; today: string }) {
  const t = useTranslations("calendar");
  const all = entries(events);
  const last = dayAfter(today, NEAR_DAYS - 1);
  // Newest first: the shelf starts with what came out last.
  const out = all.filter((e) => e.day < today).reverse();
  const days = new Map<string, Entry[]>([[today, []]]);
  for (const e of all) if (e.day >= today && e.day <= last) days.set(e.day, [...(days.get(e.day) ?? []), e]);
  // Each show once after the two weeks, at its first date: "when does it come back?".
  const seen = new Set<string>();
  const later = all.filter((e) => e.day > last && !seen.has(e.first.title.id) && seen.add(e.first.title.id));

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      {out.length > 0 && (
        // A shelf keeps its own edge: out of the column's gutter, its first card on the column's edge.
        <div className="-mx-(--gutter)">
          <Suspense fallback={<ShelfSkeleton />}>
            <OutShelf entries={out} today={today} />
          </Suspense>
        </div>
      )}
      {/* From lg the days are an axis down the start edge and their lines beside them, as a schedule reads. */}
      <ol className="flex flex-col gap-8">
        {[...days.entries()].map(([day, list]) => (
          <li key={day} className={AXIS}>
            <DayHeading day={day} today={today} />
            {list.length === 0 ? <EmptyState variant="inline" className="lg:py-2" title={t("nothingDay")} /> : <Lines entries={list} />}
          </li>
        ))}
      </ol>
      {later.length > 0 && (
        <section aria-labelledby="cal-later" className={AXIS}>
          <h2 id="cal-later" className="mb-2 text-h3 text-text-1 lg:mb-0 lg:py-2">
            {t("later")}
          </h2>
          <Lines entries={later} dated />
        </section>
      )}
      {events.some((e) => e.source === "tvmaze") && (
        // TVmaze's licence asks for the credit; one quiet line at the end.
        <p className="text-body-s text-text-2">
          {t("scheduleCredit")}{" "}
          <a href="https://www.tvmaze.com" target="_blank" rel="noreferrer noopener" className="inline-flex min-h-6 items-center underline underline-offset-3 hover:text-text-1 max-sm:min-h-11">
            TVmaze
          </a>
        </p>
      )}
    </div>
  );
}

/** A day on the axis and the column of its lines (lg+); on a phone the heading stands over its lines. */
const AXIS = "lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:items-start lg:gap-x-8";

/** "Today" / "Tomorrow" / the weekday, then the date: one line on a phone, two on the axis. */
function DayHeading({ day, today }: { day: string; today: string }) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const special = day === today ? t("today") : day === dayAfter(today, 1) ? t("tomorrow") : null;
  const weekday = formatDate(day, locale, { weekday: "long" });
  const year = day.slice(0, 4) === today.slice(0, 4) ? {} : ({ year: "numeric" } as const);
  const date = formatDate(day, locale, { ...(special ? { weekday: "long" } : {}), day: "numeric", month: "long", ...year });
  return (
    <h2 className="mb-2 flex flex-wrap items-baseline gap-x-3 lg:mb-0 lg:flex-col lg:gap-0.5 lg:py-2">
      <span className="text-h3 text-text-1 first-letter:uppercase">{special ?? weekday}</span>
      <span className="text-body-s text-text-2">{date}</span>
    </h2>
  );
}

/**
 * A day's lines: the show's art 16:9, its name, the episode and (unless the profile hides them) its name,
 * and on the end the air time in the viewer's zone with the channel — or, under "Later", the date.
 */
function Lines({ entries: list, dated }: { entries: Entry[]; dated?: boolean }) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const what = useWhat();
  const hideNames = useSpoilerPrefs().names;
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const tag = { premiere: t("premiere"), season_premiere: t("seasonPremiere"), finale: t("finale") } as const;
  return (
    <ul className="flex flex-col gap-1">
      {list.map((e) => {
        const f = e.first;
        // A film's "premiere" is the release itself: no label for it.
        const badge = f.kind === "episode" && f.badge ? tag[f.badge] : null;
        const name = e.episodes.length === 1 && !hideNames ? f.episodeName : null;
        const at = dated ? formatDate(e.day, locale, { day: "numeric", month: "short" }) : f.airstamp ? time.format(new Date(f.airstamp)) : null;
        const line = [what(e), name].filter(Boolean).join(" · ");
        return (
          <li key={e.key} className="group/card">
            <Link
              href={href(f)}
              // Said in its parts — the name, the episode, the label, the time and channel — not glued into one word.
              aria-label={[f.title.title, line, badge, at, f.channel].filter(Boolean).join(", ")}
              className="-mx-2 grid grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-sm px-2 py-2 transition-colors duration-fast ease-fast hover:bg-surface-1 md:grid-cols-[8rem_minmax(0,1fr)_auto] md:gap-x-4"
            >
              <Artwork shape="landscape" src={tmdbImage(f.title.backdropPath ?? f.title.posterPath, "w300")} sizes="128px" placeholder={f.title.kind} />
              <span className="min-w-0">
                <span className="line-clamp-2 text-title text-text-1">{f.title.title}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-s text-text-2">
                  {line && <span className="line-clamp-2">{line}</span>}
                  {badge && <Tag>{badge}</Tag>}
                </span>
              </span>
              {(at || f.channel) && (
                <span className="max-w-28 text-end text-body-s text-text-2">
                  {at && (
                    <time dateTime={f.airstamp ?? e.day} className="block text-title tabular-nums text-text-1">
                      {at}
                    </time>
                  )}
                  {f.channel && <span className="line-clamp-2">{f.channel}</span>}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The "Just out" shelf's place while its chunk or the data comes: its heading and a row of frames. */
function ShelfSkeleton() {
  return (
    <div className="page-x flex flex-col gap-3 md:gap-4" aria-hidden>
      <Skeleton shape="xs" className="h-7 w-32" />
      <div className="flex gap-2 overflow-hidden md:gap-3 xl:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} shape="sm" className="aspect-video w-60 shrink-0 md:w-70 xl:w-76" />
        ))}
      </div>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-hidden>
      <div className="-mx-(--gutter)">
        <ShelfSkeleton />
      </div>
      {[0, 1].map((d) => (
        <div key={d} className="flex flex-col gap-3">
          <Skeleton shape="xs" className="h-6 w-48" />
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3 md:gap-4">
                <Skeleton shape="sm" className="aspect-video w-24 shrink-0 md:w-32" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton shape="xs" className="h-4 w-2/3" />
                  <Skeleton shape="xs" className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
