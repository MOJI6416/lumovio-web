"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Info, Search, Star, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Poster } from "@/components/media/Poster";
import { useSession } from "@/components/providers/Providers";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { QueryState } from "@/components/ui/QueryState";
import { Select } from "@/components/ui/Select";
import { libraryKey } from "@/hooks/useLibraryState";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { untilComplete } from "@/lib/incomplete";
import { titleHref } from "@/lib/slug";
import { useAction } from "@/lib/use-action";
import { CollectionToolbar } from "./CollectionToolbar";
import { ROW, ROW_GRID, RowsSkeleton } from "./GridSkeleton";
import { readFilters, readSort, useUrlState } from "./url-state";

interface RatingRow {
  title: TitleSummary;
  value: number;
  source: string;
  ratedAt: string;
}
type Ratings = { ratings: RatingRow[] };

const SORTS = ["rated", "high", "low", "title"] as const;
type Sort = (typeof SORTS)[number];
const VALUES = Array.from({ length: 10 }, (_, i) => String(10 - i));

/**
 * Ratings (S09, LIB-12): one row per title with the date it was rated, the value as a Select to change it in place
 * (no toast: the change is seen where it is made, 8.1) and "More" with "Remove rating" — gone at once, "Undo" in the
 * toast puts the same value back. Sorted by date, by value or by name; the type chips of the library apply.
 */
export function RatingsTab() {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const tcard = useTranslations("card");
  const tb = useTranslations("browse");
  const locale = useLocale();
  const kids = Boolean(useSession().me?.activeProfile?.isKids);
  const qc = useQueryClient();
  const { params, set } = useUrlState();
  const filters = readFilters(params);
  const sort = readSort<Sort>(params, SORTS, "rated");
  const q = useQuery({ queryKey: ["ratings"], queryFn: () => api<Ratings>("/api/library/ratings"), refetchInterval: untilComplete });

  const put = (titleId: string, value: number | null) =>
    api(`/api/library/rating`, { method: "PUT", json: { titleId, value } });
  const patch = (fn: (r: RatingRow[]) => RatingRow[]) => {
    const before = qc.getQueryData<Ratings>(["ratings"]);
    void qc.cancelQueries({ queryKey: ["ratings"], exact: true });
    qc.setQueryData<Ratings>(["ratings"], (d) => d && { ratings: fn(d.ratings) });
    return () => qc.setQueryData<Ratings>(["ratings"], before);
  };
  const sync = () => {
    void qc.invalidateQueries({ queryKey: ["ratings"] });
  };

  const change = useAction({
    run: async (r: RatingRow, value: number) => {
      await put(r.title.id, value);
      void qc.invalidateQueries({ queryKey: libraryKey(r.title.id) });
    },
    optimistic: (r: RatingRow, value: number) =>
      patch((rs) => rs.map((x) => (x.title.id === r.title.id ? { ...x, value } : x))),
    error: (_, r) => t("ratingChangeFailed", { title: r.title.title }),
    sync,
  });
  const remove = useAction({
    run: async (r: RatingRow) => {
      await put(r.title.id, null);
      void qc.invalidateQueries({ queryKey: libraryKey(r.title.id) });
    },
    optimistic: (r: RatingRow) => patch((rs) => rs.filter((x) => x.title.id !== r.title.id)),
    success: (_, r) => t("ratingRemoved", { title: r.title.title }),
    undo: async (_, r) => {
      await put(r.title.id, r.value);
      void qc.invalidateQueries({ queryKey: libraryKey(r.title.id) });
    },
    error: (_, r) => t("ratingRemoveFailed", { title: r.title.title }),
    sync,
  });

  const order = (rows: RatingRow[]) => {
    const shown = rows.filter((r) => !filters.show || r.title.kind === filters.show);
    if (sort === "high")
      return [...shown].sort((a, b) => b.value - a.value || b.ratedAt.localeCompare(a.ratedAt));
    if (sort === "low")
      return [...shown].sort((a, b) => a.value - b.value || b.ratedAt.localeCompare(a.ratedAt));
    if (sort === "title")
      return [...shown].sort((a, b) => a.title.title.localeCompare(b.title.title, locale));
    return shown;
  };

  return (
    <QueryState
      query={q}
      loading={<RowsSkeleton rows={6} />}
      isEmpty={(d) => d.ratings.length === 0}
      empty={
        <EmptyState
          icon={Star}
          title={t("emptyRatings")}
          text={kids ? t("emptyRatingsHintKids") : t("emptyRatingsHint")}
          action={
            <Link href="/search" className={buttonClass("primary")}>
              <Search aria-hidden />
              {t("findTitles")}
            </Link>
          }
        />
      }
      error={{ title: t("loadError") }}
    >
      {(d) => {
        const rows = order(d.ratings);
        return (
          <div>
            <CollectionToolbar
              filters={filters}
              set={set}
              sort={{
                value: sort,
                onChange: (v) => set({ sort: v === "rated" ? null : v }),
                options: [
                  { value: "rated", label: t("sortRated") },
                  { value: "high", label: t("sortHigh") },
                  { value: "low", label: t("sortLow") },
                  { value: "title", label: tb("sortTitle") },
                ],
              }}
              shown={rows.length}
              total={d.ratings.length}
            />
            {rows.length === 0 ? (
              <EmptyState
                icon={Star}
                title={t("filterEmpty")}
                action={
                  <Button variant="secondary" onClick={() => set({ show: null })}>
                    {tc("resetFilters")}
                  </Button>
                }
              />
            ) : (
              // Rows across the page's width: two columns from xl, three from 2xl (owner, 2026-10-25).
              <ul className={ROW_GRID}>
                {rows.map((r) => {
                  const href = titleHref(r.title.kind, r.title.tmdbId, r.title.title);
                  return (
                    <li key={r.title.id} className={ROW}>
                      {/* The poster, the name and the line under it are one link to the title; the controls stand beside it. */}
                      <Link
                        href={href}
                        className="group/row flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-sm py-1"
                      >
                        <div className="w-10 shrink-0 overflow-hidden rounded-sm">
                          <Poster path={r.title.posterPath} title="" kind={r.title.kind} sizes="40px" />
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-title text-text-1 group-hover/row:underline">
                            {r.title.title}
                          </span>
                          <span className="block text-body-s text-text-2">
                            {[
                              r.title.year,
                              r.title.kind === "movie" ? tc("movie") : tc("series"),
                              t("ratedOn", {
                                date:
                                  // This year "23 окт.", earlier with the year (2.3).
                                  formatDate(r.ratedAt, locale, {
                                    day: "numeric",
                                    month: "short",
                                    ...(r.ratedAt.startsWith(String(new Date().getFullYear()))
                                      ? {}
                                      : { year: "numeric" }),
                                  }) ?? "",
                              }),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </Link>
                      <div className="relative flex shrink-0 items-center gap-1">
                        <Select
                          aria-label={t("yourRatingOf", { title: r.title.title })}
                          size="sm"
                          className="w-auto shrink-0"
                          value={String(r.value)}
                          onValueChange={(v) => void change.run(r, Number(v))}
                          options={VALUES.map((v) => ({
                            value: v,
                            label: t("ratingValue", { value: Number(v) }),
                          }))}
                        />
                        <Menu
                          label={t("ratingMenu")}
                          title={r.title.title}
                          trigger={
                            <IconButton icon={Ellipsis} label={tcard("more", { title: r.title.title })} />
                          }
                        >
                          <MenuItem icon={Info} href={href}>
                            {tcard("details")}
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem icon={Trash2} tone="danger" onSelect={() => void remove.run(r)}>
                            {t("removeRating")}
                          </MenuItem>
                        </Menu>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      }}
    </QueryState>
  );
}
