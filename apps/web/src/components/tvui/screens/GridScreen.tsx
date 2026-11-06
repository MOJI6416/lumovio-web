"use client";

import type { CatalogSorts, Genre, MediaKind, Paged, TitleSummary } from "@lumovio/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowDownUp, RefreshCw, RotateCcw, SearchX, Tags, Tv } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FocusEvent, useEffect, useMemo, useState } from "react";
import { CardRating } from "@/components/media/CardRating";
import { TvButton } from "@/components/ui/tv/TvButton";
import { api } from "@/lib/api";
import { browseState, discoverQuery, filtersQuery, isIndexSort } from "@/lib/discover";
import { TvCard } from "../media/TvCard";
import { useTvNav } from "../nav/TvNav";
import { type Choice, ChoiceLayer } from "../shell/ChoiceLayer";
import { TvState } from "../shell/TvState";

/*
 * A section's whole list on a TV (S02, S03 TV; TV document §4 "Каталог/подборки"): the filters as one row of buttons —
 * the sort, the genre, films or series for anime, "Reset" — each opening a card; then the grid of posters, which
 * loads the next part by itself as the focus nears the end (no "Show more" to reach), keeping the focused card. The
 * filters live in the address (replaced, not pushed), so Back from a title comes back to the same grid, card and filters.
 */
export function GridScreen({
  kind: baseKind,
  anime,
  genres,
  movieGenres,
  title,
  description,
  initial,
}: {
  kind: MediaKind;
  anime: boolean;
  genres: Genre[];
  /** Anime: the film genres, for "Films". */
  movieGenres?: Genre[];
  title: string;
  description?: string;
  initial?: { query: string; page: Paged<TitleSummary> };
}) {
  const t = useTranslations("browse");
  const tc = useTranslations("common");
  const tv = useTranslations("tvui");
  const locale = useLocale();
  const params = useSearchParams();
  const nav = useTvNav();
  const kind: MediaKind = anime && params.get("kind") === "movie" ? "movie" : baseKind;
  const state = browseState((k) => params.get(k), anime);
  const query = discoverQuery(kind, state);
  const [picking, setPicking] = useState<"sort" | "genre" | "kind" | null>(null);
  const [focused, setFocused] = useState<TitleSummary | null>(null);
  const shown = anime && kind === "movie" && movieGenres ? movieGenres : genres;

  const sorts = useQuery({
    queryKey: ["catalog-sorts", filtersQuery(kind, state)],
    queryFn: () => api<CatalogSorts>(`/api/catalog/sorts?${filtersQuery(kind, state)}`),
    staleTime: 10 * 60_000,
  });
  const q = useInfiniteQuery({
    queryKey: ["discover", query, locale],
    queryFn: ({ pageParam }) => api<Paged<TitleSummary>>(`/api/catalog/discover?${query}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    initialData: initial && initial.query === query ? { pages: [initial.page], pageParams: [1] } : undefined,
    staleTime: 5 * 60_000,
  });
  // An index sort these filters don't allow isn't kept: the grid would be sorted by something else than its name says.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once the answer for the current filters arrives
  useEffect(() => {
    if (sorts.data && isIndexSort(state.sort) && !sorts.data[state.sort]) set("sort", null);
  }, [sorts.data]);
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages ?? [])
      .flatMap((p) => p.results)
      .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  }, [q.data]);

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    // A shelf's own name stays only while its conditions do (CAT-11).
    next.delete("shelf");
    if (k === "kind") next.delete("genres");
    next.set("view", "all");
    nav.replaceQuery(next);
  };

  const indexOption = (s: keyof CatalogSorts, label: string): Choice[] =>
    sorts.data?.[s] ? [{ value: s, label }] : [];
  const sortOptions: Choice[] = [
    { value: "popularity", label: t("sortPopularity") },
    { value: "release_desc", label: t("sortNewest") },
    { value: "release_asc", label: t("sortOldest") },
    { value: "rating", label: t("sortRating") },
    { value: "votes", label: t("sortVotes") },
    ...indexOption("imdb", t("sortImdb")),
    ...indexOption("imdb_votes", t("sortImdbVotes")),
    ...indexOption("lumovio", t("sortLumovio")),
    ...indexOption("rt", t("sortRt")),
    ...indexOption("metacritic", t("sortMetacritic")),
    { value: "title", label: t("sortTitle") },
  ];
  const genre = state.genres[0] ? shown.find((g) => g.id === state.genres[0]) : undefined;
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  const sortLabel = sortOptions.find((o) => o.value === state.sort)?.label ?? t("sortPopularity");
  const filtered = state.genres.length > 0 || state.sort !== "popularity" || (anime && kind === "movie");

  // The next part arrives before the focus gets to the end (the last two rows).
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const i = Number((e.target as HTMLElement).dataset.index);
    if (!Number.isFinite(i)) return;
    setFocused(items[i] ?? null);
    if (i >= items.length - 12 && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
  };

  const first = q.data?.pages[0];
  return (
    <div data-tv-screen="detail" className="relative h-full">
      <div data-tv-scroller className="absolute inset-0 overflow-hidden">
        <div data-tv-content data-zone-group className="flex flex-col gap-8 pb-24">
          <header data-zone-frame="top" className="flex flex-col gap-5 ps-(--tv-pad) pe-(--gutter) pt-12">
            <div className="flex flex-col gap-2">
              <h1 className="text-h1 text-text-1">{title}</h1>
              {description && <p className="max-w-measure text-body-l text-text-2">{description}</p>}
            </div>
            <div
              data-zone="filters"
              data-zone-axis="x"
              data-zone-entry="first"
              className="flex flex-wrap gap-4"
            >
              <TvButton icon={ArrowDownUp} aria-haspopup="dialog" onClick={() => setPicking("sort")}>
                {sortLabel}
              </TvButton>
              {anime && (
                <TvButton icon={Tv} aria-haspopup="dialog" onClick={() => setPicking("kind")}>
                  {kind === "movie" ? t("titleMovies") : t("titleSeries")}
                </TvButton>
              )}
              {shown.length > 0 && (
                <TvButton icon={Tags} aria-haspopup="dialog" onClick={() => setPicking("genre")}>
                  {genre ? cap(genre.name) : t("genres")}
                </TvButton>
              )}
              {filtered && (
                <TvButton
                  icon={RotateCcw}
                  onClick={() => nav.replaceQuery(new URLSearchParams({ view: "all" }))}
                >
                  {t("resetShort")}
                </TvButton>
              )}
            </div>
            <div className="flex h-9 items-center gap-4 text-body-l text-text-2" aria-live="polite">
              {focused ? (
                <>
                  <span className="truncate font-semibold text-text-1">{focused.title}</span>
                  {focused.year && <span>{focused.year}</span>}
                  <CardRating title={focused} className="text-text-1" />
                </>
              ) : (
                first && (
                  <span className="tabular-nums">
                    {first.totalResults > 0 ? t("results", { count: first.totalResults }) : ""}
                  </span>
                )
              )}
            </div>
          </header>
          {q.isError && !items.length ? (
            <div className="ps-(--tv-pad)">
              <TvState icon={RefreshCw} title={tv("loadFailed")}>
                <TvButton icon={RefreshCw} onClick={() => void q.refetch()}>
                  {tc("retry")}
                </TvButton>
              </TvState>
            </div>
          ) : items.length === 0 && !q.isPending ? (
            <div className="ps-(--tv-pad)">
              <TvState icon={SearchX} title={t("empty")} text={t("emptyHint")} />
            </div>
          ) : (
            <div
              data-zone="grid"
              data-zone-axis="grid"
              onFocus={onFocus}
              className="grid grid-cols-7 gap-x-6 gap-y-8 ps-(--tv-pad) pe-(--gutter)"
            >
              {q.isPending &&
                Array.from({ length: 12 }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="aspect-2/3 w-full animate-pulse rounded-sm bg-surface-2"
                  />
                ))}
              {items.map((x, i) => (
                <TvCard key={x.id} title={x} index={i} fluid />
              ))}
              {q.isFetchingNextPage &&
                Array.from({ length: 6 }, (_, i) => (
                  <span
                    key={`more${i}`}
                    aria-hidden
                    className="aspect-2/3 w-full animate-pulse rounded-sm bg-surface-2"
                  />
                ))}
              {q.isFetchNextPageError && (
                <TvButton icon={RefreshCw} data-key="retry-more" onClick={() => void q.fetchNextPage()}>
                  {tc("retry")}
                </TvButton>
              )}
            </div>
          )}
        </div>
      </div>
      {picking === "sort" && (
        <ChoiceLayer
          title={t("sort")}
          options={sortOptions}
          value={state.sort}
          onPick={(v) => set("sort", v === "popularity" ? null : v)}
          onClose={() => setPicking(null)}
        />
      )}
      {picking === "genre" && (
        <ChoiceLayer
          title={t("genres")}
          options={[
            { value: "", label: t("any") },
            ...shown.map((g) => ({ value: String(g.id), label: cap(g.name) })),
          ]}
          value={state.genres[0] ? String(state.genres[0]) : ""}
          onPick={(v) => set("genres", v || null)}
          onClose={() => setPicking(null)}
        />
      )}
      {picking === "kind" && (
        <ChoiceLayer
          title={t("type")}
          options={[
            { value: "tv", label: t("titleSeries") },
            { value: "movie", label: t("titleMovies") },
          ]}
          value={kind}
          onPick={(v) => set("kind", v === "movie" ? "movie" : null)}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
