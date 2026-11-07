"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { FilterChip } from "@/components/ui/Chip";
import { cn } from "@/components/ui/cn";
import { formatRuntime } from "@/lib/format";
import { ChoicePill, type PillOption } from "./ChoicePill";
import type { LibraryFilters } from "./url-state";

const RUNTIME_LIMITS = [90, 100, 120, 150];

export interface SortChoice<S extends string> {
  value: S;
  options: PillOption<S>[];
  onChange: (v: S) => void;
}

/**
 * The filters of a collection — Watchlist, Favourites, Ratings, a list (S09, S10; design-system 8.4, 7.4): the same
 * row of pills as the catalog's. The type as one-choice chips (only when the collection holds both films and series —
 * a filter that changes nothing isn't offered), "Length ⌄" and, with "Series" chosen, "Status ⌄" as pills with a
 * menu, "On your servers" and "Not watched yet" as chips; on the end the sort pill, the count and an action on what
 * is shown ("Save as list"). From a laptop up it is one row; on a phone the filters scroll sideways and the sort, the
 * count and the action are the line under them. Each changes the grid at once; the state is in the address (./url-state).
 */
export function CollectionToolbar<S extends string>({
  filters,
  set,
  types = true,
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
  /** Whether the type chips mean anything: the collection holds both films and series (or one is chosen). */
  types?: boolean;
  runtime?: boolean;
  /** The Status pill, shown while "Series" is chosen. */
  status?: boolean;
  servers?: boolean;
  unwatched?: boolean;
  sort?: SortChoice<S>;
  shown: number;
  total: number;
  /** A control over the row (the search inside a list). */
  children?: ReactNode;
  /** An action on what the filters show, after the count ("Save as list", package F). */
  action?: ReactNode;
}) {
  const t = useTranslations("library");
  const tr = useTranslations();
  const tb = useTranslations("browse");
  const minutes = (m: number) => formatRuntime(m, (k, v) => tr(k as "common.minutes", v)) ?? "";
  const showTypes = types || filters.show !== null;
  const any = showTypes || runtime || (status && filters.show === "tv") || servers || unwatched;
  return (
    <div className="mb-6 flex flex-col gap-3">
      {children}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        {any && (
          // biome-ignore lint/a11y/useSemanticElements: a row of filter chips that scrolls sideways, not a form's fieldset
          <div
            className="scroll-row flex items-center gap-2 max-lg:-mx-(--gutter) max-lg:overflow-x-auto max-lg:px-(--gutter) lg:flex-wrap"
            role="group"
            aria-label={t("filtersLabel")}
          >
            {showTypes &&
              ([null, "movie", "tv"] as const).map((k) => (
                // A status is about series: it goes with another type.
                <FilterChip key={k ?? "all"} selected={filters.show === k} onClick={() => set({ show: k, ...(k !== "tv" ? { status: null } : {}) })}>
                  {k === null ? t("filterAll") : k === "movie" ? t("filterMovies") : t("filterSeries")}
                </FilterChip>
              ))}
            {runtime && (
              <ChoicePill
                name={t("filterRuntime")}
                any={t("filterRuntimeAny")}
                value={filters.max ? String(filters.max) : null}
                onChange={(v) => set({ max: v })}
                options={RUNTIME_LIMITS.map((m) => ({ value: String(m), label: t("filterRuntimeMax", { time: minutes(m) }) }))}
              />
            )}
            {status && filters.show === "tv" && (
              <ChoicePill
                name={t("filterStatus")}
                any={t("filterStatusAny")}
                value={filters.status}
                onChange={(v) => set({ status: v })}
                options={[
                  { value: "ended", label: tb("statusEnded") },
                  { value: "returning", label: tb("statusReturning") },
                ]}
              />
            )}
            {servers && (
              <FilterChip selected={filters.onServers} onClick={() => set({ avail: filters.onServers ? null : "1" })}>
                {t("filterOnServers")}
              </FilterChip>
            )}
            {unwatched && (
              <FilterChip selected={filters.unwatched} onClick={() => set({ unwatched: filters.unwatched ? null : "1" })}>
                {t("rulesUnwatched")}
              </FilterChip>
            )}
          </div>
        )}
        {/* At the row's end after the filters; where there are none, where the row starts. */}
        <div className={cn("flex min-h-11 items-center gap-x-3 sm:min-h-8", any && "lg:ms-auto")}>
          {sort && <ChoicePill sort name={tb("sort")} value={sort.value} onChange={(v) => v && sort.onChange(v)} options={sort.options} />}
          <p className="whitespace-nowrap text-body-s tabular-nums text-text-2" aria-live="polite">
            {shown === total ? tr("common.titlesCount", { count: total }) : t("filterCount", { shown, total })}
          </p>
          {action && <div className="ms-auto lg:ms-0">{action}</div>}
        </div>
      </div>
      {/* What a length limit leaves out, for a screen reader: the row says only the limit. */}
      {runtime && filters.max && <p className="sr-only">{t("filterRuntimeNote")}</p>}
    </div>
  );
}
