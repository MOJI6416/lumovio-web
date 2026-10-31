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

/**
 * Statistics (S12; INS-01, INS-02): the year as a SegmentedControl in the page's header — a year from an old link gets
 * its own segment, a wrong one is said in words; this year is "so far", not "Wrapped". Tiles with their words over the
 * numbers (StatTile, 7.20); the months as one series in --progress with every value written on its column (nothing
 * only on hover); genres in one taxonomy and one case; an empty year points to finding and importing.
 */
export function StatsView() {
  const t = useTranslations("stats");
  const locale = useLocale();
  const params = useSearchParams();
  const { me } = useSession();
  const now = new Date().getFullYear();
  const { year, invalid } = readYear(params.get("year"), now);
  const q = useQuery({ queryKey: ["stats", year, locale], queryFn: () => api<Stats>(`/api/stats${year ? `?year=${year}` : ""}`), refetchInterval: untilComplete });
  const genres = useQuery({
    queryKey: ["genres-all", locale],
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
  const years = [now, now - 1, now - 2];
  if (year !== null && !years.includes(year)) years.push(year);
  const setYear = (v: string) => {
    // The page reads the year from the address; no server round trip for it.
    window.history.replaceState(null, "", `${window.location.pathname}${v === String(now) ? "" : `?year=${v}`}`);
  };
  const sentence = (name: string) => name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  const description =
    year === null
      ? s?.firstWatch
        ? t("allTimeSince", { date: formatDate(s.firstWatch, locale, { month: "long", year: "numeric" }) ?? "" })
        : t("allTime")
      : year === now
        ? t("yearSoFar", { year })
        : t("yearWrapped", { year });

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={description}
        actions={
          <SegmentedControl
            label={t("year")}
            value={year === null ? "all" : String(year)}
            onValueChange={setYear}
            options={[...years.sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) })), { value: "all", label: t("allTime") }]}
          />
        }
      />
      <div className="space-y-10">
        {invalid && <InlineAlert tone="warning" title={t("badYear", { year: now })} />}
        {q.isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} shape="md" className="h-24 w-full" />
              ))}
            </div>
            <Skeleton shape="md" className="h-56 w-full" />
          </div>
        )}
        {/* A failed load is not an empty year (X-14). */}
        {q.isError && !s && <ErrorState error={q.error} title={t("loadError")} onRetry={() => void q.refetch()} retrying={q.isFetching} />}
        {s && total === 0 && (
          <EmptyState
            icon={BarChart3}
            title={year === null ? t("emptyAll") : t("emptyYear", { year })}
            text={t("empty")}
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
            {/* StatTiles (7.20): every number has its words over it. */}
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
              <Tile label={t("hours")} value={nf.format(Math.round(s.minutes / 60))} />
              <Tile label={t("films")} value={nf.format(s.films)} />
              <Tile label={t("episodes")} value={nf.format(s.episodes)} />
              <Tile label={t("series")} value={nf.format(s.series)} />
              <Tile label={t("streak")} value={nf.format(s.longestStreakDays)} />
            </dl>

            <section aria-labelledby="by-month">
              <h2 id="by-month" className="mb-3 text-h2 text-text-1 md:mb-4">
                {t("byMonth")}
              </h2>
              <MonthBars data={s.byMonth} locale={locale} label={t("byMonthLabel")} />
            </section>

            {s.topGenres.length > 0 && (
              <section aria-labelledby="top-genres">
                <h2 id="top-genres" className="mb-3 text-h2 text-text-1 md:mb-4">
                  {t("topGenres")}
                </h2>
                <ol className="space-y-3">
                  {s.topGenres.map((g, i) => {
                    const name = genres.data?.find((x) => x.id === g.id)?.name;
                    const max = s.topGenres[0]?.count ?? 1;
                    return (
                      <li key={g.id} className="grid grid-cols-[1.5rem_8rem_1fr_3rem] items-center gap-3 text-body-s sm:grid-cols-[1.5rem_12rem_1fr_3rem]">
                        <span className="font-semibold tabular-nums text-text-2">{i + 1}</span>
                        <span className="truncate font-semibold text-text-1">{name ? sentence(name) : <Skeleton shape="xs" className="h-4 w-20" />}</span>
                        <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <span className="block h-full rounded-full bg-progress" style={{ width: `${(g.count / max) * 100}%` }} />
                        </span>
                        <span className="text-end font-semibold tabular-nums text-text-2">{nf.format(g.count)}</span>
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
                <TitleGrid>
                  {s.topTitles.map((x) => (
                    <PosterCard key={x.title.id} title={x.title} subtitle={t("timesWatched", { count: x.count })} showState={false} />
                  ))}
                </TitleGrid>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** A StatTile (7.20): the words over the number (`body-s` --text-2, the number `h1` in tabular figures). */
function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-surface-1 p-4">
      <dt className="text-body-s text-text-2">{label}</dt>
      <dd className="mt-1 text-h1 tabular-nums text-text-1">{value}</dd>
    </div>
  );
}

/**
 * One series by month (7.20): --progress columns on --line grid lines, captions in `caption`. Every month with a value
 * has it written over its column — on a phone too, with no hover-only tooltip (INS-01); one letter per month on a phone
 * (twelve short names don't fit), the full name for screen readers in the table under it.
 */
function MonthBars({ data, locale, label }: { data: { month: number; count: number }[]; locale: string; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const monthName = (m: number, style: "narrow" | "short" | "long") => new Intl.DateTimeFormat(locale, { month: style, timeZone: "UTC" }).format(new Date(Date.UTC(2024, m - 1, 1)));
  const nf = new Intl.NumberFormat(locale);
  return (
    <figure>
      <div className="relative h-56 rounded-md border border-line bg-surface-1 px-3 pt-8 pb-8" aria-hidden>
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-3 border-t border-line" style={{ bottom: `calc(2rem + ${f} * (100% - 4rem))` }} />
        ))}
        <div className="relative grid h-full grid-cols-12 items-end gap-1">
          {data.map((d) => (
            <div key={d.month} className="relative flex h-full flex-col items-center justify-end">
              {d.count > 0 && (
                <>
                  <span className="mb-1 text-caption tabular-nums text-text-1">{nf.format(d.count)}</span>
                  <div className="w-full max-w-6 rounded-t-xs bg-progress" style={{ height: `${(d.count / max) * 100}%` }} />
                </>
              )}
              <span className="absolute -bottom-6 text-caption text-text-2">
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
