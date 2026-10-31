"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { FilterChip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Select";
import { formatRuntime } from "@/lib/format";
import type { LibraryFilters } from "./url-state";

const RUNTIME_LIMITS = [90, 100, 120, 150];

export interface SortChoice<S extends string> {
  value: S;
  options: { value: S; label: string }[];
  onChange: (v: S) => void;
}

/**
 * The compact filter row of a collection (LIB-10, LIB-17; 8.4): the type as chips in the plural, the length as a small
 * Select, with "Series" chosen the series' status (as in the catalog), "On your servers" and "Hide watched" as chips, the
 * sort on the end with the count. Each control changes the grid at once; the state is in the address (./url-state).
 */
export function CollectionToolbar<S extends string>({
  filters,
  set,
  runtime = false,
  status = false,
  servers = false,
  unwatched = false,
  sort,
  shown,
  total,
  children,
  action,
}: {
  filters: LibraryFilters;
  set: (patch: Record<string, string | null>) => void;
  runtime?: boolean;
  /** The Status select, shown while "Series" is chosen. */
  status?: boolean;
  servers?: boolean;
  unwatched?: boolean;
  sort?: SortChoice<S>;
  shown: number;
  total: number;
  /** A control before the filters (the search inside a list). */
  children?: ReactNode;
  /** An action on what the filters show, after the count ("Save as list", package F). */
  action?: ReactNode;
}) {
  const t = useTranslations("library");
  const tr = useTranslations();
  const tb = useTranslations("browse");
  const minutes = (m: number) => formatRuntime(m, (k, v) => tr(k as "common.minutes", v)) ?? "";
  return (
    <div className="mb-6 flex flex-col gap-3">
      {children}
      {/* One row from a laptop up; on a phone the filters scroll sideways and the sort goes under them. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div
          className="scroll-row flex items-center gap-2 max-lg:-mx-(--gutter) max-lg:overflow-x-auto max-lg:px-(--gutter) lg:flex-wrap"
          role="group"
          aria-label={t("filtersLabel")}
        >
          {([null, "movie", "tv"] as const).map((k) => (
            // A status is about series: it goes with another type.
            <FilterChip key={k ?? "all"} selected={filters.show === k} onClick={() => set({ show: k, ...(k !== "tv" ? { status: null } : {}) })}>
              {k === null ? t("filterAll") : k === "movie" ? t("filterMovies") : t("filterSeries")}
            </FilterChip>
          ))}
          {runtime && (
            <Select
              aria-label={t("filterRuntime")}
              size="sm"
              className="w-auto shrink-0"
              value={filters.max ? String(filters.max) : "any"}
              onValueChange={(v) => set({ max: v === "any" ? null : v })}
              options={[
                { value: "any", label: t("filterRuntimeAny") },
                ...RUNTIME_LIMITS.map((m) => ({
                  value: String(m),
                  label: t("filterRuntimeMax", { time: minutes(m) }),
                })),
              ]}
            />
          )}
          {status && filters.show === "tv" && (
            <Select
              aria-label={t("filterStatus")}
              size="sm"
              className="w-auto shrink-0"
              value={filters.status ?? "any"}
              onValueChange={(v) => set({ status: v === "any" ? null : v })}
              options={[
                { value: "any", label: t("filterStatusAny") },
                { value: "ended", label: tb("statusEnded") },
                { value: "returning", label: tb("statusReturning") },
              ]}
            />
          )}
          {servers && (
            <FilterChip
              selected={filters.onServers}
              onClick={() => set({ avail: filters.onServers ? null : "1" })}
            >
              {t("filterOnServers")}
            </FilterChip>
          )}
          {unwatched && (
            <FilterChip
              selected={filters.unwatched}
              onClick={() => set({ unwatched: filters.unwatched ? null : "1" })}
            >
              {t("filterUnwatched")}
            </FilterChip>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:ms-auto">
          {sort && (
            <Select<S>
              aria-label={tb("sort")}
              size="sm"
              className="w-auto"
              value={sort.value}
              onValueChange={sort.onChange}
              options={sort.options}
            />
          )}
          <p className="text-body-s tabular-nums text-text-2" aria-live="polite">
            {shown === total
              ? tr("common.titlesCount", { count: total })
              : t("filterCount", { shown, total })}
          </p>
          {action}
        </div>
      </div>
      {runtime && filters.max && <p className="text-body-s text-text-2">{t("filterRuntimeNote")}</p>}
    </div>
  );
}
