"use client";

import type { CatalogRow, CatalogSearch, TitleSummary } from "@lumovio/contracts";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Search, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { PosterCard } from "@/components/media/PosterCard";
import { Row } from "@/components/media/Row";
import { useSession } from "@/components/providers/Providers";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/Chip";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadMore } from "@/components/ui/LoadMore";
import { Progress } from "@/components/ui/Progress";
import { api } from "@/lib/api";
import { AI_MAX, AI_MIN, AiPanel, useAiSearch } from "./AiSearch";
import { recentSearches } from "./recent-searches";
import { BestMatchBlock, PeopleGrid, ResultGrid, ResultGroups, ResultsSkeleton } from "./SearchResults";
import { SearchField } from "./SearchField";
import { SearchStart } from "./SearchStart";
import { layoutFix, otherLayout } from "./search-helpers";
import {
  DEBOUNCE_MS,
  type GenreTile,
  type GroupKey,
  groupResults,
  isEmpty,
  looksDescriptive,
  MIN_CHARS,
  popularOf,
  QUERY_MAX,
  type SearchKind,
  searchUrl,
  tilesFor,
} from "./search-model";

type Scope = "all" | GroupKey;
type Mode = "titles" | "ai";

const SCOPES: Scope[] = ["movie", "tv", "people"];
const nextPage = (last: CatalogSearch) => (last.titles.page < last.titles.totalPages ? last.titles.page + 1 : undefined);
const titlesOf = (pages: CatalogSearch[]) => [...new Map(pages.flatMap((p) => p.titles.results).map((x) => [x.id, x])).values()];

/** The address follows the search without a history entry per keystroke (the page's first answer is server-rendered). */
function replaceUrl(q: string, mode: Mode, scope: Scope) {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (mode === "ai") sp.set("mode", "ai");
  else if (q && scope !== "all") sp.set("kind", scope);
  const qs = sp.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
}

/**
 * The search page: one field on top — results come as it is typed; under it the
 * types with their counts and, for whoever may use it, "Describe it", the second way to search with the same text.
 * Without a query: recent searches, what's popular, genre tiles. With one: the best match larger, then films, series and
 * people as shelves; a type opens its whole list in place (films and series page by page). A text that reads as
 * a description, with no title named like it, is offered "Search by description" first; nothing found offers the same
 * keys on the other keyboard layout, "Describe it" and what's popular. A kids profile has neither people nor
 * "Describe it", and is told in one line when results are hidden for it.
 */
export function SearchView({
  initial,
  popular: popularProp = [],
  tiles: allTiles = [],
  genres = {},
}: {
  initial?: { q: string; data: CatalogSearch };
  popular?: TitleSummary[];
  tiles?: GenreTile[];
  /** Genre names by id, films' and series' (the best match's facts). */
  genres?: Record<number, string>;
}) {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const tl = useTranslations("library");
  const locale = useLocale();
  const params = useSearchParams();
  const { me } = useSession();
  const kids = Boolean(me?.activeProfile?.isKids);
  const signedIn = Boolean(me?.activeProfile);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(q.trim());
  const [chosenMode, setMode] = useState<Mode>(params.get("mode") === "ai" ? "ai" : "titles");
  const [scope, setScope] = useState<Scope>(() => {
    const k = params.get("kind") as Scope | null;
    return k && SCOPES.includes(k) ? k : "all";
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // A kids profile has no "Describe it" (the API closes AI search to kids); nor a server without a
  // model. ?mode=ai opens the ordinary search then.
  const ai = useAiSearch({ enabled: !kids, signedIn, arrival: chosenMode === "ai" ? q : "" });
  const aiOffered = !kids && ai.available;
  const mode: Mode = aiOffered ? chosenMode : "titles";
  const titles = mode === "titles";
  const active = debounced.length >= MIN_CHARS;

  useEffect(() => {
    // A mouse and keyboard type at once; a touch screen keeps the page in view until the field is tapped (as Apple TV's).
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, []);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q]);
  // A new query starts from all types (the address's type applies on arrival only).
  const scoped = useRef(debounced);
  useEffect(() => {
    if (scoped.current === debounced) return;
    scoped.current = debounced;
    setScope("all");
  }, [debounced]);
  // The address names what was searched: the query once it searches, a description once it ran.
  const searched = mode === "ai" ? (ai.ran ?? "") : active ? debounced : "";
  useEffect(() => replaceUrl(searched, mode, scope), [searched, mode, scope]);

  const first = initial && initial.q === debounced ? initial.data : undefined;
  // Films, series and people of page 1: the best match, the groups, the types' counts and "nothing found".
  const lead = useQuery({
    queryKey: ["search", debounced, locale],
    queryFn: ({ signal }) => api<CatalogSearch>(searchUrl(debounced), { signal }),
    enabled: titles && active,
    initialData: first,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  // A type: the server's search of only films or only series, page by page.
  const typedKind: SearchKind | undefined = scope === "movie" || scope === "tv" ? scope : undefined;
  const typed = useInfiniteQuery({
    queryKey: ["search-pages", debounced, locale, typedKind],
    queryFn: ({ pageParam, signal }) => api<CatalogSearch>(searchUrl(debounced, pageParam, typedKind), { signal }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: titles && active && Boolean(typedKind),
    staleTime: 5 * 60_000,
  });

  const data = lead.data;
  const groups = useMemo(() => (data ? groupResults(data) : null), [data]);
  const empty = Boolean(data && isEmpty(data) && !lead.isPlaceholderData);
  const counts = data?.counts;
  const typedPages = typed.data?.pages ?? [];
  const typedTitles = titlesOf(typedPages);
  // Some results of the pages read are hidden for a kids profile: said in a line, without a number.
  const hidden = Boolean(data?.hidden) || typedPages.some((p) => p.hidden);

  // A query that found something and stayed for a moment goes to "Recent"; a failed one doesn't.
  const found = titles && active && lead.isSuccess && !lead.isPlaceholderData && !empty;
  // Keys typed on the other layout are remembered as what they found ("bynthcntkkfh" → "интерстеллар").
  const remembered = data?.interpreted ?? debounced;
  useEffect(() => {
    if (!found) return;
    const id = setTimeout(() => recentSearches.push(remembered), 1500);
    return () => clearTimeout(id);
  }, [found, remembered]);

  // Nothing found: the same keys on the other layout, if that names a title.
  const alt = empty ? otherLayout(debounced) : null;
  const altResults = useQuery({
    queryKey: ["search", alt, locale],
    queryFn: () => api<CatalogSearch>(searchUrl(alt!)),
    enabled: Boolean(alt),
    staleTime: 5 * 60_000,
  });
  const fix = layoutFix(alt, altResults.data);
  // …and what's popular, so it is never a dead end (the server's, else asked here).
  const popularQuery = useQuery({
    queryKey: ["catalog-home-popular", locale],
    queryFn: () => api<{ rows: CatalogRow[] }>("/api/catalog/home"),
    enabled: popularProp.length === 0 && (empty || (titles && !active)),
    staleTime: 10 * 60_000,
    select: (d) => popularOf(d.rows),
  });
  const popular = popularProp.length > 0 ? popularProp : (popularQuery.data ?? []);
  const tiles = tilesFor(allTiles, kids);

  const focusField = () => requestAnimationFrame(() => inputRef.current?.focus());
  const max = mode === "ai" ? AI_MAX : QUERY_MAX;
  const text = q.trim();
  /** Searches the field's text by description (the chip, "Search by description", an empty result's offer). */
  const describe = () => {
    setMode("ai");
    if (text.length >= AI_MIN && text !== ai.ran) ai.run(text);
    focusField();
  };
  const toggleMode = () => {
    if (mode === "ai") {
      setMode("titles");
      focusField();
    } else describe();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "ai") ai.run(text);
    else if (text.length >= MIN_CHARS) {
      setDebounced(text);
      recentSearches.push(text);
    }
    // On a touch screen Enter hides the keyboard, so the results are in view.
    if (window.matchMedia("(pointer: coarse)").matches) inputRef.current?.blur();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && q) {
      e.preventDefault();
      setQ("");
    }
  };
  const searchFor = (v: string) => {
    setQ(v);
    setDebounced(v);
  };
  const openScope = (k: Scope) => {
    setScope(k);
    window.scrollTo({ top: 0 });
  };
  // A result opened from the page counts its query as a recent search.
  const rememberOnOpen = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("a[href]")) recentSearches.push(remembered);
  };

  const showTypes = titles && active && Boolean(data) && !empty;
  const canRun = mode === "ai" && signedIn && text.length >= AI_MIN && text !== ai.ran && !ai.busy;
  const shownOf = (k: SearchKind) => (groups?.[k].length ?? 0) + (groups?.best?.type === "title" && groups.best.title.kind === k ? 1 : 0);
  const more = (k: SearchKind) => (counts ? counts[k] > shownOf(k) : (data?.titles.totalPages ?? 1) > 1);
  const scopeHref = (k: GroupKey) => `/search?q=${encodeURIComponent(debounced)}&kind=${k}`;

  return (
    <div>
      <form onSubmit={submit} className="relative">
        <SearchField
          ref={inputRef}
          id="search-field"
          value={q}
          onValueChange={(v) => setQ(v.slice(0, max))}
          onClear={() => {
            setQ("");
            focusField();
          }}
          onKeyDown={onKeyDown}
          placeholder={mode === "ai" ? t("aiPlaceholder") : t("placeholder")}
          aria-label={mode === "ai" ? t("aiToggle") : t("label")}
          aria-describedby={mode === "ai" ? "ai-hint" : undefined}
          maxLength={max}
        />
        {/* While results come, a thin bar under the field. */}
        {titles && lead.isFetching && !first && <Progress value={null} label={tc("loading")} className="absolute inset-x-6 -bottom-2 w-auto" />}
        {mode === "ai" && (
          <p id="ai-hint" className="sr-only">
            {t("aiHint")}
          </p>
        )}
      </form>
      {q.length >= max && (
        <p className="mt-3 text-body-s text-text-2" role="status">
          {t("tooLong", { max })}
        </p>
      )}

      {(showTypes || aiOffered) && (
        // The types of the answer and the second way to search: one row under the field, scrolling on a phone.
        // biome-ignore lint/a11y/useSemanticElements: a row of filter chips, not a form's fieldset
        <div className="scroll-row mt-4 flex items-center gap-2 overflow-x-auto *:shrink-0 max-md:-mx-(--gutter) max-md:px-(--gutter)" role="group" aria-label={t("mode")}>
          {showTypes && mode === "titles" && (
            <>
              <FilterChip selected={scope === "all"} onClick={() => openScope("all")}>
                {tl("filterAll")}
              </FilterChip>
              {/* A type with "· 0" is off: it would only open an empty grid; its count says why. */}
              <FilterChip selected={scope === "movie"} count={counts?.movie} disabled={counts?.movie === 0 && scope !== "movie"} onClick={() => openScope("movie")}>
                {tl("filterMovies")}
              </FilterChip>
              <FilterChip selected={scope === "tv"} count={counts?.tv} disabled={counts?.tv === 0 && scope !== "tv"} onClick={() => openScope("tv")}>
                {tl("filterSeries")}
              </FilterChip>
              {(data?.people.length ?? 0) > 0 && (
                <FilterChip selected={scope === "people"} count={data?.people.length} onClick={() => openScope("people")}>
                  {t("people")}
                </FilterChip>
              )}
            </>
          )}
          {showTypes && aiOffered && mode === "titles" && <span aria-hidden className="mx-1 h-5 w-px bg-line-2" />}
          {aiOffered && (
            <FilterChip selected={mode === "ai"} icon={Sparkles} onClick={toggleMode}>
              {t("aiToggle")}
            </FilterChip>
          )}
          {canRun && (
            <Button size="sm" icon={Sparkles} onClick={() => ai.run(text)}>
              {t("aiSubmit")}
            </Button>
          )}
        </div>
      )}

      {mode === "ai" ? (
        <AiPanel
          ai={ai}
          signedIn={signedIn}
          onExample={(v) => {
            setQ(v);
            ai.run(v);
          }}
          onTitleSearch={(v) => {
            setMode("titles");
            searchFor(v);
            focusField();
          }}
        />
      ) : !active ? (
        <SearchStart popular={popular} tiles={tiles} onRecent={searchFor} />
      ) : lead.isPending ? (
        <div className="mt-8">
          <ResultsSkeleton />
        </div>
      ) : lead.isError && !data ? (
        // A failed search is not "nothing found".
        <ErrorState className="mt-8" error={lead.error} title={t("loadError")} onRetry={() => void lead.refetch()} retrying={lead.isFetching} />
      ) : empty ? (
        <div className="mt-8" onClickCapture={rememberOnOpen}>
          <EmptyState
            icon={Search}
            title={t("noResults", { q: debounced })}
            // A kids profile whose search found only what it can't open is told so: a limit, in sight.
            note={data?.hidden ? t("hiddenAllForKids") : undefined}
            about={fix ? t("didYouMean") : undefined}
            action={
              fix ? (
                <Button icon={Search} onClick={() => searchFor(fix)}>
                  {t("searchInstead", { q: fix })}
                </Button>
              ) : (
                aiOffered && (
                  <Button icon={Sparkles} onClick={describe}>
                    {t("findByDescription")}
                  </Button>
                )
              )
            }
            secondaryAction={
              fix &&
              aiOffered && (
                <Button variant="tertiary" icon={Sparkles} onClick={describe}>
                  {t("findByDescription")}
                </Button>
              )
            }
          />
          {popular.length > 0 && (
            <div className="-mx-(--gutter) mt-4">
              <Row id="search-popular" title={t("popularNow")}>
                {popular.map((x) => (
                  <PosterCard key={x.id} title={x} />
                ))}
              </Row>
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn("mt-8 flex flex-col gap-10 transition-opacity duration-base ease-base md:gap-12", lead.isPlaceholderData && "opacity-60")}
          aria-live="polite"
          aria-busy={lead.isFetching}
          onClickCapture={rememberOnOpen}
        >
          {(data?.interpreted || hidden) && (
            <div className="-mb-4 flex flex-col gap-1 md:-mb-6">
              {data?.interpreted && <p className="text-body-s text-text-2">{t("searchedAs", { q: data.interpreted })}</p>}
              {hidden && <p className="text-body-s text-text-2">{t("hiddenForKids")}</p>}
            </div>
          )}
          {/* A failed refresh keeps what was shown, with Retry above it. */}
          {lead.isError && <ErrorState variant="inline" error={lead.error} title={t("loadError")} onRetry={() => void lead.refetch()} retrying={lead.isFetching} />}
          {scope === "all" && groups && (
            <>
              {aiOffered && looksDescriptive(debounced, data?.clear) && (
                <div>
                  <Button variant="secondary" icon={Sparkles} onClick={describe}>
                    {t("findByDescription")}
                  </Button>
                </div>
              )}
              {groups.best && <BestMatchBlock best={groups.best} genres={genres} />}
              <ResultGroups groups={groups} more={more} onScope={openScope} scopeHref={scopeHref} />
            </>
          )}
          {scope === "people" && data && <PeopleGrid people={data.people} />}
          {typedKind && (
            <section aria-label={typedKind === "movie" ? tl("filterMovies") : tl("filterSeries")}>
              {typed.isPending ? (
                <ResultsSkeleton />
              ) : typed.isError && !typed.data ? (
                <ErrorState error={typed.error} title={t("loadError")} onRetry={() => void typed.refetch()} retrying={typed.isFetching} />
              ) : typedTitles.length > 0 ? (
                <ResultGrid>
                  {typedTitles.map((x) => (
                    <PosterCard key={x.id} title={x} />
                  ))}
                </ResultGrid>
              ) : (
                <EmptyState icon={Search} title={t("noneOfKind")} />
              )}
              {/* The next page that didn't come: what is shown stays, Retry at the same place. */}
              <LoadMore
                onMore={() => void typed.fetchNextPage()}
                loading={typed.isFetchingNextPage}
                failed={typed.isFetchNextPageError}
                hasMore={typed.hasNextPage}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
