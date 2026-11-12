"use client";

import type { Genre, TitleSummary } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { PosterCard } from "@/components/media/PosterCard";
import { TitleGrid } from "@/components/media/Row";
import { useSession } from "@/components/providers/Providers";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { untilComplete } from "@/lib/incomplete";

interface Stats {
  year: number | null;
  minutes: number;
  films: number;
  episodes: number;
  series: number;
  topGenres: { id: number; count: number }[];
  byMonth: { month: number; count: number }[];
  topTitles: { title: TitleSummary; count: number }[];
  firstWatch: string | null;
  longestStreakDays: number;
}

/** The year in the address: a year since 1950 up to now, "all", or nothing; anything else is said to be wrong. */
function readYear(param: string | null, now: number): { year: number | null; invalid: boolean } {
  if (param === "all") return { year: null, invalid: false };
  if (param === null || param === "") return { year: now, invalid: false };
  const y = Number(param);
  return Number.isInteger(y) && y >= 1950 && y <= now ? { year: y, invalid: false } : { year: now, invalid: true };
}

const statsQuery = (year: number | null, locale: string) => ({
  queryKey: ["stats", year, locale],
  queryFn: () => api<Stats>(`/api/stats${year ? `?year=${year}` : ""}`),
  refetchInterval: untilComplete,
});

/**
 * Statistics (S12; design-system 7.20, 9 «Статистика»): one number first — the hours — and four facts beside it, as a
 * year in review opens; the years to choose are the ones with something watched (from the first watch on, the latest
 * three) and "All time"; the months only for a year (all time would add up every January); the genres as shares of
 * what was watched; the titles watched most, a series by its episodes. An empty profile points to finding and importing.
 */
export function StatsView() {
  const t = useTranslations("stats");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const params = useSearchParams();
  const { me } = useSession();
  const now = new Date().getFullYear();
  const { year, invalid } = readYear(params.get("year"), now);
  const q = useQuery(statsQuery(year, locale));
  // All time knows the first watch, so only years from it on are offered; it is the "All time" segment's answer too.
  const all = useQuery(statsQuery(null, locale));
  const genres = useQuery({
    // Not "genres-all": that key holds the genre picker's entries (GenresDialog), another shape — Stats first, then
    // Settings → Recommendations broke on it ("reading 'some'").
    queryKey: ["genres-stats", locale],
    queryFn: async () => {
      const [m, tv] = await Promise.all([api<{ genres: Genre[] }>("/api/catalog/genres/movie"), api<{ genres: Genre[] }>("/api/catalog/genres/tv")]);
      // Film names first: the statistics count series genres as their film counterparts (INS-01).
      return [...m.genres, ...tv.genres.filter((g) => !m.genres.some((x) => x.id === g.id))];
    },
    staleTime: Infinity,
  });
  const s = q.data;
  const nf = new Intl.NumberFormat(locale);
  const total = s ? s.films + s.episodes : 0;
  const first = all.data?.firstWatch ? new Date(all.data.firstWatch).getFullYear() : now;
  const years = [now, now - 1, now - 2].filter((y) => y >= first);
  // A year from an old link keeps its segment.
  if (year !== null && !years.includes(year)) years.push(year);
  const setYear = (v: string) => {
    // The page reads the year from the address; no server round trip for it.
    window.history.replaceState(null, "", `${window.location.pathname}${v === String(now) ? "" : `?year=${v}`}`);
  };
  const sentence = (name: string) => name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  const hours = s ? s.minutes / 60 : 0;

  return (
    <div>
      <PageHeader
        back={{ href: "/library", label: tn("library") }}
        title={t("title")}
        actions={
          <SegmentedControl
            label={t("year")}
            value={year === null ? "all" : String(year)}
            onValueChange={setYear}
            options={[...years.sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) })), { value: "all", label: t("allTime") }]}
          />
        }
      />
      <div className="flex flex-col gap-12">
        {invalid && <InlineAlert tone="warning" title={t("badYear", { year: now })} />}
        {q.isLoading && (
          <div className="flex flex-col gap-12" aria-hidden>
            <div className="flex flex-col gap-3">
              <Skeleton shape="xs" className="h-4 w-32" />
              <Skeleton shape="sm" className="h-14 w-40" />
              <div className="mt-3 grid grid-cols-2 gap-6 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} shape="xs" className="h-12 w-full" />
                ))}
              </div>
            </div>
            <Skeleton shape="md" className="h-48 w-full" />
          </div>
        )}
        {/* A failed load is not an empty year (X-14). */}
        {q.isError && !s && <ErrorState error={q.error} title={t("loadError")} onRetry={() => void q.refetch()} retrying={q.isFetching} />}
        {/* Offline before anything came: said, not a blank page; a failed refresh keeps the numbers, one line above (7.11). */}
        {!s && !q.isError && q.fetchStatus === "paused" && <ErrorState error={null} onRetry={() => void q.refetch()} />}
        {q.isError && s && <ErrorState variant="inline" error={q.error} title={t("loadError")} onRetry={() => void q.refetch()} retrying={q.isFetching} />}
        {s && total === 0 && (
          <EmptyState
            icon={BarChart3}
            title={year === null ? t("emptyAll") : t("emptyYear", { year })}
            action={
              <Link href="/search" className={buttonClass("primary")}>
                <Search aria-hidden />
                {t("findSomething")}
              </Link>
            }
            secondaryAction={
              !me?.activeProfile?.isKids && (
                <Link href="/import" className={buttonClass("tertiary")}>
                  {t("importHistory")}
                </Link>
              )
            }
          />
        )}

        {s && total > 0 && (
          <>
            {/* The hours first and large; the other numbers beside them, each with its words over it (7.20). */}
            <section aria-label={t("summary")}>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
                <div className="col-span-full">
                  <dt className="text-body-s text-text-2">{t("hours")}</dt>
                  <dd className="text-display tabular-nums text-text-1">{new Intl.NumberFormat(locale, { maximumFractionDigits: hours < 10 ? 1 : 0 }).format(hours)}</dd>
                  {year === null && s.firstWatch && (
                    <dd className="mt-1 text-body-s text-text-2">{t("allTimeSince", { date: formatDate(s.firstWatch, locale, { month: "long", year: "numeric" }) ?? "" })}</dd>
                  )}
                </div>
                <Fact label={t("films")} value={nf.format(s.films)} />
                <Fact label={t("episodes")} value={nf.format(s.episodes)} />
                <Fact label={t("series")} value={nf.format(s.series)} />
                <Fact label={t("streak")} value={nf.format(s.longestStreakDays)} />
              </dl>
            </section>

            {year !== null && (
              <section aria-labelledby="by-month">
                <h2 id="by-month" className="mb-3 text-h2 text-text-1 md:mb-4">
                  {t("byMonth")}
                </h2>
                <MonthBars data={s.byMonth} locale={locale} label={t("byMonthLabel")} current={year === now ? new Date().getMonth() + 1 : null} />
              </section>
            )}

            {s.topGenres.length > 0 && (
              <section aria-labelledby="top-genres">
                <h2 id="top-genres" className="mb-3 text-h2 text-text-1 md:mb-4">
                  {t("topGenres")}
                </h2>
                {/* Each genre's share of what was watched: a title of three genres counts in all three. */}
                <ol className="gap-x-12 md:columns-2">
                  {s.topGenres.map((g, i) => {
                    const name = genres.data?.find((x) => x.id === g.id)?.name;
                    const share = Math.min(1, g.count / total);
                    return (
                      <li key={g.id} className="mb-4 grid break-inside-avoid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-2">
                        <span className="text-body-s font-semibold tabular-nums text-text-2">{i + 1}</span>
                        <span className="truncate text-title text-text-1">{name ? sentence(name) : <Skeleton shape="xs" className="inline-block h-4 w-20" />}</span>
                        <span className="text-body-s font-semibold tabular-nums text-text-2">{new Intl.NumberFormat(locale, { style: "percent" }).format(share)}</span>
                        <span aria-hidden className="col-span-2 col-start-2 h-1 overflow-hidden rounded-full bg-surface-2">
                          <span className="block h-full rounded-full bg-progress" style={{ width: `${share * 100}%` }} />
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {s.topTitles.length > 0 && (
              <section aria-labelledby="top-titles">
                <h2 id="top-titles" className="mb-3 text-h2 text-text-1 md:mb-4">
                  {t("topTitles")}
                </h2>
                <TopTitles titles={s.topTitles} />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-body-s text-text-2">{label}</dt>
      <dd className="mt-1 text-h2 tabular-nums text-text-1">{value}</dd>
    </div>
  );
}

/** A series counts its episodes ("12 episodes"); a film the times it was watched, or just "Film" for once. */
function TopTitles({ titles }: { titles: Stats["topTitles"] }) {
  const t = useTranslations("stats");
  const tc = useTranslations("common");
  return (
    <TitleGrid>
      {titles.map((x) => (
        <PosterCard
          key={x.title.id}
          title={x.title}
          subtitle={x.title.kind === "tv" ? tc("episodes", { count: x.count }) : x.count > 1 ? t("timesWatched", { count: x.count }) : tc("movie")}
          showState={false}
        />
      ))}
    </TitleGrid>
  );
}

/**
 * One series by month (7.20): --progress columns on --line grid lines, captions in `caption`. Every month with a value
 * has it written over its column — on a phone too, with no hover-only tooltip (INS-01); one letter per month on a phone
 * (twelve short names don't fit), the full name for screen readers in the table under it. This year's months after the
 * current one are lighter: they haven't come yet.
 */
function MonthBars({ data, locale, label, current }: { data: { month: number; count: number }[]; locale: string; label: string; current: number | null }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const monthName = (m: number, style: "narrow" | "short" | "long") => new Intl.DateTimeFormat(locale, { month: style, timeZone: "UTC" }).format(new Date(Date.UTC(2024, m - 1, 1)));
  const nf = new Intl.NumberFormat(locale);
  return (
    <figure>
      <div className="relative h-52 pt-6 pb-7" aria-hidden>
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-line" style={{ bottom: `calc(1.75rem + ${f} * (100% - 3.25rem))` }} />
        ))}
        <div className="relative grid h-full grid-cols-12 items-end gap-1">
          {data.map((d) => (
            <div key={d.month} className="relative flex h-full flex-col items-center justify-end">
              {d.count > 0 && (
                <>
                  <span className="mb-1 text-caption tabular-nums text-text-1">{nf.format(d.count)}</span>
                  <div className="w-2/3 max-w-6 rounded-t-xs bg-progress" style={{ height: `${(d.count / max) * 100}%` }} />
                </>
              )}
              <span className={`absolute -bottom-7 text-caption ${current !== null && d.month > current ? "text-text-3" : "text-text-2"}`}>
                <span className="sm:hidden">{monthName(d.month, "narrow")}</span>
                <span className="max-sm:hidden">{monthName(d.month, "short")}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{monthName(d.month, "long")}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
