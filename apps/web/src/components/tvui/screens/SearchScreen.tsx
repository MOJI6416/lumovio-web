"use client";

import type { CatalogSearch } from "@lumovio/contracts";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { RefreshCw, Search, SearchX } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FocusEvent, useEffect, useMemo, useState } from "react";
import { CardRating } from "@/components/media/CardRating";
import { cn } from "@/components/ui/cn";
import { TvButton } from "@/components/ui/tv/TvButton";
import { api } from "@/lib/api";
import { TvCard } from "../media/TvCard";
import { useTvNav } from "../nav/TvNav";
import { TvKeyboard } from "../shell/TvKeyboard";
import { TvState } from "../shell/TvState";

/** The address's query follows the search without a history entry per letter, so Back comes back to the results. */
export function SearchScreen({ initialQuery }: { initialQuery: string }) {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const tv = useTranslations("tvui");
  const locale = useLocale();
  const nav = useTvNav();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery.trim());
  const [focused, setFocused] = useState<CatalogSearch["titles"]["results"][number] | null>(null);

  // A search once the typing pauses; the address follows.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(q.trim()), 400);
    return () => window.clearTimeout(id);
  }, [q]);
  useEffect(() => {
    if ((params.get("q") ?? "") === debounced) return;
    const next = new URLSearchParams(params.toString());
    if (debounced) next.set("q", debounced);
    else next.delete("q");
    nav.replaceQuery(next);
  }, [debounced, params, nav]);

  const res = useInfiniteQuery({
    queryKey: ["tv-search", debounced, locale],
    queryFn: ({ pageParam, signal }) =>
      api<CatalogSearch>(`/api/catalog/search?q=${encodeURIComponent(debounced)}&page=${pageParam}`, {
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.titles.page < last.titles.totalPages ? last.titles.page + 1 : undefined,
    enabled: debounced.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (res.data?.pages ?? [])
      .flatMap((p) => p.titles.results)
      .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  }, [res.data]);
  const interpreted = res.data?.pages[0]?.interpreted;

  const onResultFocus = (e: FocusEvent<HTMLDivElement>) => {
    const i = Number((e.target as HTMLElement).dataset.index);
    if (!Number.isFinite(i)) return;
    setFocused(items[i] ?? null);
    if (i >= items.length - 8 && res.hasNextPage && !res.isFetchingNextPage) void res.fetchNextPage();
  };

  return (
    <div data-tv-screen="section" className="flex h-full gap-12 ps-(--tv-pad) pe-(--gutter) pt-12">
      <h1 className="sr-only">{t("label")}</h1>
      <div className="flex w-120 shrink-0 flex-col gap-6">
        <TvKeyboard value={q} onChange={setQ} label={t("label")} placeholder={t("placeholder")} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* The focused result, above the grid and out of its way. */}
        <div className="flex h-24 shrink-0 flex-col justify-end gap-1" aria-live="polite">
          {focused ? (
            <>
              <p className="truncate text-h2 text-text-1">{focused.title}</p>
              <p className="flex items-center gap-3 text-body-l text-text-2">
                {focused.year && <span>{focused.year}</span>}
                <CardRating title={focused} className="text-text-1" />
              </p>
            </>
          ) : interpreted ? (
            <p className="text-body-l text-text-2">{tv("searchedFor", { q: interpreted })}</p>
          ) : null}
        </div>
        <div data-tv-scroller className="relative min-h-0 flex-1 overflow-hidden">
          <div data-tv-content className="flex flex-col gap-6 px-4 pt-4 pb-24">
            {!debounced ? (
              <TvState icon={Search} title={t("startTyping")} text={tv("searchHint")} />
            ) : res.isError && !items.length ? (
              <TvState icon={RefreshCw} title={t("loadError")}>
                <TvButton icon={RefreshCw} onClick={() => void res.refetch()}>
                  {tc("retry")}
                </TvButton>
              </TvState>
            ) : !res.isPending && !res.isPlaceholderData && items.length === 0 ? (
              <TvState icon={SearchX} title={t("noResults", { q: debounced })} text={t("noResultsHint")} />
            ) : (
              <div
                data-zone="results"
                data-zone-axis="grid"
                onFocus={onResultFocus}
                className={cn("grid grid-cols-4 gap-x-6 gap-y-8", res.isPlaceholderData && "opacity-60")}
              >
                {res.isPending &&
                  Array.from({ length: 8 }, (_, i) => (
                    <span
                      key={i}
                      aria-hidden
                      className="aspect-2/3 w-full animate-pulse rounded-sm bg-surface-2"
                    />
                  ))}
                {items.map((x, i) => (
                  <TvCard key={x.id} title={x} index={i} fluid />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
