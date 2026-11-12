"use client";

import type { CatalogSearch, PersonSummary, TitleSummary } from "@lumovio/contracts";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { History, RefreshCw, Search, SearchX, User } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FocusEvent, type MouseEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { CardRating } from "@/components/media/CardRating";
import { recentSearches, useRecentSearches } from "@/components/search/recent-searches";
import { departmentKey, layoutFix, otherLayout } from "@/components/search/search-helpers";
import {
  type GenreTile,
  groupResults,
  isEmpty,
  MIN_CHARS,
  type SearchKind,
  searchUrl,
  TV_DEBOUNCE_MS,
  tilesFor,
} from "@/components/search/search-model";
import { useSession } from "@/components/providers/Providers";
import { cn } from "@/components/ui/cn";
import { TvButton } from "@/components/ui/tv/TvButton";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { tmdbImage } from "@/lib/images";
import { personHref } from "@/lib/slug";
import { TvCard } from "../media/TvCard";
import { TvMoreCard, TvShelfFrame } from "../media/TvShelf";
import { useTvNav } from "../nav/TvNav";
import { TvKeyboard } from "../shell/TvKeyboard";
import { TvState } from "../shell/TvState";

const nextPage = (last: CatalogSearch) => (last.titles.page < last.titles.totalPages ? last.titles.page + 1 : undefined);

/**
 * Search on a TV: the site's search for a remote. On the left the
 * field and the on-screen keyboard; on the right, under a line about the focused card, the same groups as the site —
 * without a query the recent searches, what's popular and the genres; with one the best match wide, then films, series
 * and people as shelves, each type's whole list a grid of its own ("See all", `?kind=`). The query and the type live in
 * the address (replaced), so Back from a title comes back to the same results and card.
 */
export function SearchScreen({
  initialQuery,
  popular = [],
  tiles: allTiles = [],
}: {
  initialQuery: string;
  popular?: TitleSummary[];
  tiles?: GenreTile[];
}) {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const tl = useTranslations("library");
  const tv = useTranslations("tvui");
  const tb = useTranslations("browse");
  const tr = useTranslations();
  const locale = useLocale();
  const nav = useTvNav();
  const params = useSearchParams();
  const { me } = useSession();
  const kids = Boolean(me?.activeProfile?.isKids);
  const recent = useRecentSearches();
  // A type's whole list ("See all" opens it as a step of its own, so Back returns to all the groups).
  const kindParam = params.get("kind");
  const kind: SearchKind | undefined = kindParam === "movie" || kindParam === "tv" ? kindParam : undefined;
  const [q, setQ] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery.trim());
  const [focused, setFocused] = useState<TitleSummary | null>(null);
  const active = debounced.length >= MIN_CHARS;

  // A search once the typing pauses; the address follows (a new query leaves a type's list).
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(q.trim()), TV_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [q]);
  useEffect(() => {
    if ((params.get("q") ?? "") === debounced) return;
    const next = new URLSearchParams();
    if (debounced) next.set("q", debounced);
    nav.replaceQuery(next);
  }, [debounced, params, nav]);

  const lead = useQuery({
    queryKey: ["search", debounced, locale],
    queryFn: ({ signal }) => api<CatalogSearch>(searchUrl(debounced), { signal }),
    enabled: active,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const typed = useInfiniteQuery({
    queryKey: ["search-pages", debounced, locale, kind],
    queryFn: ({ pageParam, signal }) => api<CatalogSearch>(searchUrl(debounced, pageParam, kind), { signal }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: active && Boolean(kind),
    staleTime: 5 * 60_000,
  });
  const data = active ? lead.data : undefined;
  const groups = useMemo(() => (data ? groupResults(data) : null), [data]);
  const empty = Boolean(data && isEmpty(data) && !lead.isPlaceholderData);
  const typedTitles = useMemo(() => [...new Map((typed.data?.pages ?? []).flatMap((p) => p.titles.results).map((x) => [x.id, x])).values()], [typed.data]);
  const hidden = Boolean(data?.hidden) || (typed.data?.pages ?? []).some((p) => p.hidden);
  const tiles = tilesFor(allTiles, kids);

  // Nothing found: the same keys on the other layout, when that names a title.
  const alt = empty ? otherLayout(debounced) : null;
  const altResults = useQuery({
    queryKey: ["search", alt, locale],
    queryFn: () => api<CatalogSearch>(searchUrl(alt!)),
    enabled: Boolean(alt),
    staleTime: 5 * 60_000,
  });
  const fix = layoutFix(alt, altResults.data);

  // What found something and stayed a moment is a recent search, as on the site.
  const found = active && lead.isSuccess && !lead.isPlaceholderData && !empty;
  useEffect(() => {
    if (!found) return;
    const id = window.setTimeout(() => recentSearches.push(debounced), 1500);
    return () => window.clearTimeout(id);
  }, [found, debounced]);

  // The line above the results names the focused card (posters carry no names on a TV); the best match says it beside
  // its card.
  const known = useMemo(() => {
    const all = [...popular, ...typedTitles, ...(groups ? [...groups.movie, ...groups.tv] : [])];
    return new Map(all.map((x) => [x.id, x]));
  }, [popular, typedTitles, groups]);
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    setFocused(known.get(el.dataset.key ?? "") ?? null);
    const i = Number(el.dataset.index);
    if (kind && Number.isFinite(i) && i >= typedTitles.length - 8 && typed.hasNextPage && !typed.isFetchingNextPage) void typed.fetchNextPage();
  };
  const remember = (e: MouseEvent) => {
    if (active && (e.target as HTMLElement).closest("a[href]")) recentSearches.push(debounced);
  };

  const label = (k: SearchKind | "people") => (k === "movie" ? tl("filterMovies") : k === "tv" ? tl("filterSeries") : t("people"));
  const counts = data?.counts;
  const shownOf = (k: SearchKind) => (groups?.[k].length ?? 0) + (groups?.best?.type === "title" && groups.best.title.kind === k ? 1 : 0);
  const more = (k: SearchKind) => (counts ? counts[k] > shownOf(k) : (data?.titles.totalPages ?? 1) > 1);
  const kindHref = (k: SearchKind) => `/search?q=${encodeURIComponent(debounced)}&kind=${k}`;
  const status = focused ? null : data?.interpreted ? tv("searchedFor", { q: data.interpreted }) : hidden ? t("hiddenForKids") : null;

  let body: ReactNode;
  if (!active) {
    body = (
      <>
        {recent.length > 0 && (
          <TvShelfFrame id="recent" title={t("recent")}>
            {recent.map((r) => (
              <TvButton key={r} data-key={`r:${r}`} icon={History} onClick={() => setQ(r)}>
                {r}
              </TvButton>
            ))}
          </TvShelfFrame>
        )}
        {popular.length > 0 && (
          <TvShelfFrame id="popular" title={t("popularNow")}>
            {popular.map((x, i) => (
              <TvCard key={x.id} title={x} index={i} />
            ))}
          </TvShelfFrame>
        )}
        {tiles.length > 0 && (
          <TvShelfFrame id="genres" title={tb("genres")}>
            {tiles.map((g) => (
              <TvGenreTile key={g.id} tile={g} />
            ))}
          </TvShelfFrame>
        )}
      </>
    );
  } else if (lead.isPending) {
    body = <ShelfPlaceholder />;
  } else if (lead.isError && !data) {
    body = (
      <TvState icon={RefreshCw} title={t("loadError")} className="ps-(--tv-pad)">
        <TvButton icon={RefreshCw} onClick={() => void lead.refetch()}>
          {tc("retry")}
        </TvButton>
      </TvState>
    );
  } else if (empty) {
    body = (
      <>
        <TvState icon={SearchX} title={t("noResults", { q: debounced })} text={data?.hidden ? t("hiddenAllForKids") : undefined} className="ps-(--tv-pad)">
          {fix && (
            <TvButton icon={Search} onClick={() => setQ(fix)}>
              {t("searchInstead", { q: fix })}
            </TvButton>
          )}
        </TvState>
        {popular.length > 0 && (
          <TvShelfFrame id="popular" title={t("popularNow")}>
            {popular.map((x, i) => (
              <TvCard key={x.id} title={x} index={i} />
            ))}
          </TvShelfFrame>
        )}
      </>
    );
  } else if (kind) {
    body = (
      <section aria-label={label(kind)} className="flex flex-col gap-2 ps-(--tv-pad)">
        <h2 className="text-h3 text-text-1">{label(kind)}</h2>
        {typed.isError && !typedTitles.length ? (
          <TvState icon={RefreshCw} title={t("loadError")}>
            <TvButton icon={RefreshCw} onClick={() => void typed.refetch()}>
              {tc("retry")}
            </TvButton>
          </TvState>
        ) : !typed.isPending && typedTitles.length === 0 ? (
          <TvState icon={SearchX} title={t("noneOfKind")} />
        ) : (
          <div data-zone="results" data-zone-axis="grid" className="grid grid-cols-4 gap-x-6 gap-y-8 py-3 pe-(--gutter)">
            {typed.isPending &&
              Array.from({ length: 8 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                <span key={i} aria-hidden data-tv-initial-pending={i === 0 || undefined} className="aspect-2/3 w-full animate-pulse rounded-sm bg-surface-2" />
              ))}
            {/* "See all" lands on the grid's first card, not on the keyboard. */}
            {typedTitles.map((x, i) => (
              <TvCard key={x.id} title={x} index={i} initial={i === 0} fluid />
            ))}
          </div>
        )}
      </section>
    );
  } else if (groups) {
    body = (
      <>
        {groups.best && <TvBestMatch best={groups.best} heading={t("bestMatch")} />}
        {groups.order.map((k) =>
          k === "people" ? (
            <TvShelfFrame key={k} id="people" title={label(k)}>
              {groups.people.map((p) => (
                <TvPerson key={p.id} person={p} dept={departmentKey(p.knownFor)} tr={tr} />
              ))}
            </TvShelfFrame>
          ) : (
            <TvShelfFrame key={k} id={k} title={label(k)}>
              {groups[k].map((x, i) => (
                <TvCard key={x.id} title={x} index={i} />
              ))}
              {more(k) && <TvMoreCard href={kindHref(k)} shape="poster" />}
            </TvShelfFrame>
          ),
        )}
      </>
    );
  }

  return (
    // A type's grid is a step from the groups (TvNav "detail"): Back returns to them, not to the menu and the home.
    <div data-tv-screen={kind ? "detail" : "section"} className="flex h-full gap-10 ps-(--tv-pad) pt-12">
      <h1 className="sr-only">{t("label")}</h1>
      <div className="flex w-104 shrink-0 flex-col gap-6">
        <TvKeyboard value={q} onChange={setQ} label={t("label")} placeholder={t("placeholder")} onSubmit={() => recentSearches.push(q)} initial={!kind} />
      </div>

      {/* The column's own start: shelves begin at its edge, with room for the focus ring. */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 [--tv-pad:1rem]">
        <div className="flex h-9 shrink-0 items-center gap-4 ps-(--tv-pad) pe-(--gutter) text-body-l text-text-2" aria-live="polite">
          {focused ? (
            <>
              <span className="truncate font-semibold text-text-1">{focused.title}</span>
              {focused.year && <span>{focused.year}</span>}
              <CardRating title={focused} className="text-text-1" />
            </>
          ) : (
            status && <span className="truncate">{status}</span>
          )}
        </div>
        <div data-tv-scroller className="relative min-h-0 flex-1 overflow-hidden">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: it listens to the cards inside (focus, an opened result), it is no control */}
          <div
            data-tv-content
            data-zone-group
            onFocus={onFocus}
            onClickCapture={remember}
            className={cn("flex flex-col gap-8 pb-24 transition-opacity duration-base", active && lead.isPlaceholderData && "opacity-60")}
          >
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The best match on a TV: a wide card (the poster without a backdrop, or the person's photo) with its name and facts beside it. */
function TvBestMatch({ best, heading }: { best: NonNullable<ReturnType<typeof groupResults>["best"]>; heading: string }) {
  const tc = useTranslations("common");
  const tr = useTranslations();
  return (
    <section data-zone-frame aria-label={heading} className="flex flex-col gap-2">
      <h2 className="ps-(--tv-pad) text-h3 text-text-1">{heading}</h2>
      <div data-zone="best" className="flex items-center gap-8 py-3 ps-(--tv-pad) pe-(--gutter)">
        {best.type === "title" ? (
          <>
            <TvCard title={best.title} shape={best.title.backdropPath ? "wide" : "poster"} index={0} />
            <div className="flex min-w-0 flex-col gap-2">
              <p className="line-clamp-2 text-h2 text-text-1">{best.title.title}</p>
              <p className="flex items-center gap-3 text-body-l text-text-2">
                <span>{best.title.isAnime ? tc("anime") : best.title.kind === "movie" ? tc("movie") : tc("series")}</span>
                {best.title.year && <span>{best.title.year}</span>}
                <CardRating title={best.title} className="text-text-1" />
              </p>
            </div>
          </>
        ) : (
          <TvPerson person={best.person} dept={departmentKey(best.person.knownFor)} tr={tr} wide />
        )}
      </div>
    </section>
  );
}

/** A person of the results: the round photo, the name and the department; OK opens the person. */
function TvPerson({
  person: p,
  dept,
  tr,
  wide,
}: {
  person: PersonSummary;
  dept: string | null;
  tr: ReturnType<typeof useTranslations>;
  /** The best match: the name beside the photo, larger. */
  wide?: boolean;
}) {
  const src = tmdbImage(p.profilePath, "w185");
  const role = dept ? tr(dept as "person.dept0") : null;
  return (
    <Link
      prefetch={false}
      href={personHref(p.id, p.name)}
      data-key={`p:${p.id}`}
      aria-label={[p.name, role].filter(Boolean).join(", ")}
      className={cn("tv-focus flex shrink-0 items-center rounded-md p-2", wide ? "gap-8 pe-8" : "w-40 flex-col gap-3")}
    >
      <span className="grid size-36 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2">
        {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : <User aria-hidden className="size-12 text-text-3" />}
      </span>
      <span className={cn("flex min-w-0 flex-col gap-1", !wide && "items-center text-center")}>
        <span className={cn("line-clamp-2 font-semibold text-text-1", wide ? "text-h2" : "text-body")}>{p.name}</span>
        {role && <span className={cn("line-clamp-1 text-text-2", wide ? "text-body-l" : "text-body")}>{role}</span>}
      </span>
    </Link>
  );
}

/** A genre tile on a TV: the picture 16:9 with the name on its foot; OK opens the catalog's films of the genre. */
function TvGenreTile({ tile }: { tile: GenreTile }) {
  const src = tmdbImage(tile.art, "w780");
  return (
    <Link
      prefetch={false}
      href={tile.href}
      data-key={`g:${tile.id}`}
      className="tv-focus stage relative block aspect-video w-72 shrink-0 overflow-hidden rounded-sm bg-surface-2"
    >
      {src && <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />}
      <span aria-hidden className="absolute inset-0 bg-linear-to-t from-stage/90 via-stage/30 to-transparent" />
      <span className="absolute inset-x-4 bottom-3 truncate text-title text-text-1">{tile.name}</span>
    </Link>
  );
}

/** The first look of the results while they come: a shelf of placeholders. */
function ShelfPlaceholder() {
  return (
    <div aria-hidden className="flex flex-col gap-2 ps-(--tv-pad)">
      <span className="h-8 w-60 animate-pulse rounded-xs bg-surface-2" />
      <div className="flex gap-6 py-3">
        {Array.from({ length: 4 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <span key={i} className="aspect-2/3 w-38 shrink-0 animate-pulse rounded-sm bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
