"use client";

import type { CatalogRow, CatalogSearch, TitleSummary } from "@lumovio/contracts";
import { type InfiniteData, keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { History, Search, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { PersonCard } from "@/components/media/PersonCard";
import { PosterCard, PosterCardSkeleton } from "@/components/media/PosterCard";
import { Row, TitleGrid } from "@/components/media/Row";
import { useSession } from "@/components/providers/Providers";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { SearchInput } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Progress";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { api } from "@/lib/api";
import { AiSearch } from "./AiSearch";
import { departmentKey, layoutFix, otherLayout } from "./search-helpers";

const RECENT_KEY = "lumovio.recentSearches";
/** The API's limit for a query (SRCH-11): the field stops there instead of a 400 and "Search failed". */
export const QUERY_MAX = 200;

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function pushRecent(q: string): string[] {
  const list = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: the list still shows for this visit */
  }
  return list;
}

type SearchResult = CatalogSearch;
type Kind = "all" | "movie" | "tv";

const searchUrl = (q: string, page: number, kind: Kind) =>
  `/api/catalog/search?q=${encodeURIComponent(q)}&page=${page}${kind === "all" ? "" : `&kind=${kind}`}`;
const nextPage = (last: SearchResult) => (last.titles.page < last.titles.totalPages ? last.titles.page + 1 : undefined);
const titlesOf = (pages: SearchResult[]) => [...new Map(pages.flatMap((p) => p.titles.results).map((x) => [x.id, x])).values()];

/** The search address without a server round trip per keystroke (the page's first answer is server-rendered). */
function replaceUrl(q: string, mode: "titles" | "ai") {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (mode === "ai") sp.set("mode", "ai");
  const qs = sp.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
}

/**
 * Search (S04, S05; Collection template): one field on the page's gutter, under the mode switch "Titles / Describe it"
 * — the text goes along when the mode changes (SRCH-07). Titles: the count, people as PersonCards in a shelf with
 * their department in words (SRCH-06, SRCH-12), type chips and "Show more" (SRCH-05). A type chip searches only films
 * or only series on the server, with their real count (SRCH-13). A kids profile is told in one line that some results
 * are hidden for it (PRF-05). Nothing found offers "Describe it", the same keys on the other keyboard layout and what's
 * popular (SRCH-08). Recent searches update at once.
 */
export function SearchView({ initial, suggestions = [] }: { initial?: { q: string; data: SearchResult }; suggestions?: TitleSummary[] }) {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const tl = useTranslations("library");
  const tr = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();
  const { me } = useSession();
  // A kids profile has no "Describe it" (the API closes AI search to kids, design-system 8.10): ?mode=ai opens the
  // ordinary search, and the mode switch isn't shown.
  const aiAllowed = !me?.activeProfile?.isKids;
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(q.trim());
  const [chosenMode, setMode] = useState<"titles" | "ai">(params.get("mode") === "ai" ? "ai" : "titles");
  const mode = aiAllowed ? chosenMode : "titles";
  const [kind, setKind] = useState<Kind>("all");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: on arrival only
  useEffect(() => {
    setRecent(readRecent());
    if (mode === "titles") inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    // The address follows without a history entry per keystroke.
    replaceUrl(mode === "titles" ? debounced : "", mode);
    setKind("all");
  }, [debounced, mode]);

  const first = initial && initial.q === debounced ? initial.data : undefined;
  // Films, series and people: the people shelf, the type chips' counts and "nothing found" come from this search.
  const all = useInfiniteQuery({
    // Its own key: pages of results (InfiniteData), not the one-page answers cached under "search" elsewhere.
    queryKey: ["search-pages", debounced, locale, "all"],
    queryFn: ({ pageParam }) => api<SearchResult>(searchUrl(debounced, pageParam, "all")),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: mode === "titles" && debounced.length > 0,
    // Results for the URL's query arrive server-rendered; don't refetch them on hydration.
    initialData: first ? ({ pages: [first], pageParams: [1] } satisfies InfiniteData<SearchResult, number>) : undefined,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  // A type chip: the server's search of only films or only series, page by page (SRCH-13).
  const typed = useInfiniteQuery({
    queryKey: ["search-pages", debounced, locale, kind],
    queryFn: ({ pageParam }) => api<SearchResult>(searchUrl(debounced, pageParam, kind)),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: mode === "titles" && debounced.length > 0 && kind !== "all",
    staleTime: 5 * 60_000,
  });
  const results = kind === "all" ? all : typed;
  // A query that found something and stayed for a moment goes to "Recent" at once (SRCH-07); a failed one doesn't.
  const found = mode === "titles" && debounced.length >= 2 && all.isSuccess && !all.isPlaceholderData;
  useEffect(() => {
    if (!found) return;
    const id = setTimeout(() => setRecent(pushRecent(debounced)), 1500);
    return () => clearTimeout(id);
  }, [found, debounced]);

  const lead = all.data?.pages[0];
  const people = lead?.people ?? [];
  // People above the titles only when the query reads as a person's name; for a title's name they follow the titles.
  const peopleFirst = lead?.peopleFirst !== false;
  // The keys were typed on the other layout, and that is what was found: the page says what it searched for.
  const interpreted = lead?.interpreted;
  const counts = lead?.counts;
  const empty = all.isSuccess && titlesOf(all.data.pages).length === 0 && people.length === 0;
  const pages = results.data?.pages ?? [];
  const shown = titlesOf(pages);
  const head = pages[0]?.titles;
  // The server's count: films plus series for "All" (TMDB's own total counts people too, which is the fallback minus the
  // people shown), never fewer than shown, as the first page adds titles the people found are known for. A kids
  // profile's count is an estimate until every page is read, and then it is what is shown.
  const exact = head && !head.totalIsEstimate ? Math.max(kind === "all" && !counts ? head.totalResults - people.length : head.totalResults, shown.length) : null;
  const total = exact ?? (head && !results.hasNextPage ? shown.length : null);
  // Some results of the pages read are hidden for a kids profile (PRF-05): said in a line, without a number.
  const hidden = pages.some((p) => p.hidden);

  // Nothing found: the same keys on the other layout, if that finds something (SRCH-08).
  const alt = empty ? otherLayout(debounced) : null;
  const altResults = useQuery({
    queryKey: ["search-alt", alt, locale],
    queryFn: () => api<SearchResult>(`/api/catalog/search?q=${encodeURIComponent(alt!)}`),
    enabled: Boolean(alt),
    staleTime: 5 * 60_000,
  });
  const fix = layoutFix(alt, altResults.data);
  // …and what's popular, so it is never a dead end.
  const popular = useQuery({
    queryKey: ["catalog-home-popular", locale],
    queryFn: () => api<{ rows: CatalogRow[] }>("/api/catalog/home"),
    enabled: empty && suggestions.length === 0,
    staleTime: 10 * 60_000,
    select: (d) => d.rows[0]?.items.slice(0, 18) ?? [],
  });
  const popularTitles = suggestions.length > 0 ? suggestions : (popular.data ?? []);

  // People in a shelf of PersonCards (5.4), the department in words, not TMDB's "Acting" (SRCH-06, SRCH-12).
  const peopleShelf = (
    <div className="-mx-(--gutter)">
      <Row id="search-people" kind="person" title={t("people")}>
        {people.map((p) => {
          const dept = departmentKey(p.knownFor);
          return <PersonCard key={p.id} person={p} subtitle={dept ? tr(dept as "person.dept0") : null} />;
        })}
      </Row>
    </div>
  );

  const switchMode = (m: "titles" | "ai") => {
    setMode(m);
    if (m === "titles") requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div>
      <div className="max-w-3xl">
        {aiAllowed && (
          <SegmentedControl
            label={t("mode")}
            value={mode}
            onValueChange={switchMode}
            options={[
              { value: "titles", label: t("titles") },
              { value: "ai", label: t("aiToggle") },
            ]}
            className="mb-4"
          />
        )}
        {mode === "titles" && (
          <div className="relative">
            <SearchInput
              ref={inputRef}
              size="lg"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onClear={() => setQ("")}
              placeholder={t("placeholder")}
              aria-label={t("label")}
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              maxLength={QUERY_MAX}
            />
            {/* While results come, a thin bar under the field (the clear button keeps its place). */}
            {results.isFetching && !results.isFetchingNextPage && <Progress value={null} label={tc("loading")} className="absolute inset-x-0 -bottom-2" />}
          </div>
        )}
        {mode === "titles" && q.length >= QUERY_MAX && (
          <p className="mt-3 text-body-s text-text-2" role="status">
            {t("tooLong", { max: QUERY_MAX })}
          </p>
        )}
      </div>

      {mode === "ai" && <AiSearch signedIn={Boolean(me?.activeProfile)} text={q} onTextChange={setQ} />}

      {mode === "titles" && !debounced && (
        <>
          {recent.length > 0 && (
            <section className="mt-8 max-w-3xl" aria-labelledby="recent-h">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 id="recent-h" className="text-title text-text-1">
                  {t("recent")}
                </h2>
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => {
                    try {
                      localStorage.removeItem(RECENT_KEY);
                    } catch {
                      /* storage unavailable: the list goes from the screen anyway */
                    }
                    setRecent([]);
                  }}
                >
                  {t("clearRecent")}
                </Button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {recent.map((r) => (
                  <li key={r} className="min-w-0 max-w-full">
                    {/* Searches again for this query. */}
                    <Button variant="secondary" size="sm" icon={History} onClick={() => setQ(r)} className="max-w-full">
                      <span className="truncate">{r}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {suggestions.length > 0 ? (
            <section className="mt-10" aria-labelledby="popular-h">
              <h2 id="popular-h" className="mb-3 text-h2 text-text-1 md:mb-4">
                {t("popularNow")}
              </h2>
              <TitleGrid>
                {suggestions.map((r) => (
                  <PosterCard key={r.id} title={r} />
                ))}
              </TitleGrid>
            </section>
          ) : (
            recent.length === 0 && <p className="mt-8 text-body text-text-2">{t("startTyping")}</p>
          )}
        </>
      )}

      {mode === "titles" && debounced && (
        <div className="mt-8" aria-live="polite" aria-busy={results.isFetching}>
          {all.isLoading ? (
            <ResultsSkeleton />
          ) : all.isError && !all.data ? (
            // A failed search is not "nothing found" (X-14).
            <ErrorState error={all.error} title={t("loadError")} onRetry={() => void all.refetch()} retrying={all.isFetching} />
          ) : empty ? (
            <div>
              <EmptyState
                icon={Search}
                title={t("noResults", { q: debounced })}
                // A kids profile whose search found only what it can't open is told so (PRF-05), with or without a
                // suggestion on the other layout (SRCH-17).
                text={lead?.hidden ? t("hiddenAllForKids") : fix ? undefined : t("noResultsHint")}
                action={
                  fix ? (
                    <Button icon={Search} onClick={() => setQ(fix)}>
                      {t("searchInstead", { q: fix })}
                    </Button>
                  ) : (
                    aiAllowed && (
                      <Button icon={Sparkles} onClick={() => switchMode("ai")}>
                        {t("describeInstead")}
                      </Button>
                    )
                  )
                }
                secondaryAction={
                  fix &&
                  aiAllowed && (
                    <Button variant="tertiary" icon={Sparkles} onClick={() => switchMode("ai")}>
                      {t("describeInstead")}
                    </Button>
                  )
                }
              >
                {fix && <p className="mt-3 text-body-s text-text-2">{t("didYouMean", { q: fix })}</p>}
              </EmptyState>
              {popularTitles.length > 0 && (
                <section className="mt-4" aria-labelledby="popular-h">
                  <h2 id="popular-h" className="mb-3 text-h2 text-text-1 md:mb-4">
                    {t("popularNow")}
                  </h2>
                  <TitleGrid>
                    {popularTitles.map((r) => (
                      <PosterCard key={r.id} title={r} />
                    ))}
                  </TitleGrid>
                </section>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {/* A failed refresh above; a failed "Show more" at the button below (CAT-12). */}
              {all.isError && !all.isFetchNextPageError && <ErrorState error={all.error} title={t("loadError")} onRetry={() => void all.refetch()} retrying={all.isFetching} />}
              {kind === "all" && people.length > 0 && peopleFirst && peopleShelf}
              <section aria-labelledby="titles-h">
                <div className="mb-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <h2 id="titles-h" className="text-h2 text-text-1">
                      {t("titles")}
                    </h2>
                    {/* Nothing of a type is said by its chip and the empty state below, not by "0 results" too. */}
                    {total !== null && total > 0 && <p className="text-body-s tabular-nums text-text-2">{t("resultsCount", { count: total })}</p>}
                    <div className="flex flex-wrap gap-2" role="group" aria-label={tl("filtersLabel")}>
                      <FilterChip selected={kind === "all"} onClick={() => setKind("all")}>
                        {tl("filterAll")}
                      </FilterChip>
                      {/* A type with "· 0" is off: it would only open an empty grid (SRCH-14); its count says why. */}
                      <FilterChip selected={kind === "movie"} count={counts?.movie} disabled={counts?.movie === 0 && kind !== "movie"} onClick={() => setKind("movie")}>
                        {tl("filterMovies")}
                      </FilterChip>
                      <FilterChip selected={kind === "tv"} count={counts?.tv} disabled={counts?.tv === 0 && kind !== "tv"} onClick={() => setKind("tv")}>
                        {tl("filterSeries")}
                      </FilterChip>
                    </div>
                  </div>
                  {hidden && <p className="mt-2 text-body-s text-text-2">{t("hiddenForKids")}</p>}
                  {interpreted && <p className="mt-2 text-body-s text-text-2">{t("searchedAs", { q: interpreted })}</p>}
                </div>
                {results.isLoading ? (
                  <ResultsSkeleton />
                ) : results.isError && !results.data ? (
                  <ErrorState error={results.error} title={t("loadError")} onRetry={() => void results.refetch()} retrying={results.isFetching} />
                ) : shown.length > 0 ? (
                  <TitleGrid>
                    {shown.map((r) => (
                      <PosterCard key={r.id} title={r} />
                    ))}
                  </TitleGrid>
                ) : (
                  <EmptyState icon={Search} title={t("noneOfKind")} />
                )}
                {results.isFetchNextPageError ? (
                  // The next page didn't come: what is shown stays, with the way to ask again at the same place (8.4).
                  <InlineAlert
                    tone="danger"
                    className="mt-8"
                    action={
                      <Button variant="tertiary" size="sm" loading={results.isFetchingNextPage} onClick={() => void results.fetchNextPage()}>
                        {tc("retry")}
                      </Button>
                    }
                  >
                    {tc("moreFailed")}
                  </InlineAlert>
                ) : (
                  <>
                    {/* A chip's answer that failed to refresh ("All" says so above). */}
                    {kind !== "all" && typed.isError && typed.data && (
                      <ErrorState error={typed.error} title={t("loadError")} onRetry={() => void typed.refetch()} retrying={typed.isFetching} className="mt-8" />
                    )}
                    {results.hasNextPage && (
                      <div className="mt-8 flex justify-center">
                        <Button variant="secondary" loading={results.isFetchingNextPage} onClick={() => void results.fetchNextPage()}>
                          {tc("showMore")}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </section>
              {kind === "all" && people.length > 0 && !peopleFirst && peopleShelf}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The grid's first look while results come: poster placeholders in the same grid. */
function ResultsSkeleton() {
  return (
    <TitleGrid>
      {Array.from({ length: 12 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <PosterCardSkeleton key={i} />
      ))}
    </TitleGrid>
  );
}
