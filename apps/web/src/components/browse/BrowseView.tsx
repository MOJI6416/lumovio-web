"use client";

import type { CatalogSorts, Genre, MediaKind, Paged, TitleSummary } from "@lumovio/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Clapperboard, ListFilterPlus, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { lazy, type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { RulesEdit } from "@/components/library/SaveRulesDialog";
import { CARD_GAP_X } from "@/components/media/card-sizes";
import { PosterCard, PosterCardSkeleton } from "@/components/media/PosterCard";
import { keepShelf, SHELF_COPY } from "@/components/media/shelf-copy";
import { useSession } from "@/components/providers/Providers";
import { Button } from "@/components/ui/Button";
import { FilterChip, InputChip } from "@/components/ui/Chip";
import { cn } from "@/components/ui/cn";
import { Combobox } from "@/components/ui/Combobox";
import { DialogActions, Sheet } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { LoadMore } from "@/components/ui/LoadMore";
import { QueryState } from "@/components/ui/QueryState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { usePathname, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { type BrowseState, browseState, discoverQuery, filtersQuery, INDEX_SORTS, isIndexSort, MOOD_NAME } from "@/lib/discover";
import { formatRuntime, languageName } from "@/lib/format";
import { NOT_TOGGLE, FilterPill as Pill } from "./FilterPill";

const LANGS = ["en", "ja", "ko", "fr", "es", "de", "it", "uk", "ru", "zh", "hi", "pt", "tr", "pl", "sv", "da"];
/** "Any" in a list (Radix keeps the empty value for "nothing chosen"); it clears the filter in the address. */
const ANY = "any";
const orAny = (v: string) => v || ANY;
const fromAny = (v: string) => (v === ANY ? null : v);
/** TMDB stops counting at about this many results: past it the number is a ceiling, not a count (CAT-07). */
const COUNT_CEILING = 20000;
/** Keys of the loading grid's 18 skeleton cards. */
const SKELETONS = Array.from({ length: 18 }, (_, i) => `skeleton-${i}`);
/**
 * The catalog's grid runs edge to edge, as the filter row above it (5.4, owner 2026-11-06): as many columns as fit
 * cards of at least 144 px (md) or 168 px (xl), and they share what is left — fixed columns left up to a column's
 * width empty on the right (193 px at 1920 with a scrollbar). Three columns on a phone. From 2xl the minimum stays 168:
 * at 1920 that is nine cards of ≈ 183 px, the shelf's 184 and its image, not eight blown-up ones. `auto-fill` keeps a
 * short result's cards at that size instead of stretching a few across the page.
 */
const CATALOG_GRID = cn(
  "grid grid-cols-3 gap-y-6 md:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]",
  CARD_GAP_X,
);
/** Every filter of the grid in the address (the sort and the series/films switch are not filters). */
const FILTER_KEYS = ["genres", "yearFrom", "yearTo", "ratingMin", "language", "without", "runtimeMax", "type", "status", "votesMin", "votesMax", "nospecials", "episodesMax", "imdbVotesMax", "opinions", "mood", "shelf"];

type Patch = Record<string, string | null>;

// Loaded when used (bundle budget): "Save as list", a smart list's "Edit conditions" (package F) and a guest's sign-in.
const SaveRulesDialog = lazy(() => import("@/components/library/SaveRulesDialog").then((m) => ({ default: m.SaveRulesDialog })));
const EditRulesBar = lazy(() => import("@/components/library/EditRulesBar").then((m) => ({ default: m.EditRulesBar })));
const GuestGate = lazy(() => import("@/components/shell/GuestGate").then((m) => ({ default: m.GuestGate })));

/** A labelled filter list: Select up to 10 options, Combobox with a search above that (design-system 7.6). */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string | null) => void;
  options: { value: string; label: string; disabled?: boolean }[];
}) {
  return (
    <Field label={label}>
      {(id, describedBy) =>
        options.length > 10 ? (
          <Combobox id={id} aria-describedby={describedBy} value={orAny(value)} onValueChange={(v) => onChange(fromAny(v))} options={options} />
        ) : (
          <Select id={id} aria-describedby={describedBy} value={orAny(value)} onValueChange={(v) => onChange(fromAny(v))} options={options} />
        )
      }
    </Field>
  );
}

/** How many results, in words: an exact count, or "20 000+" where TMDB's number is only its ceiling (CAT-07). */
function useCountText() {
  const t = useTranslations("browse");
  const format = useFormatter();
  return (total: number) => (total >= COUNT_CEILING ? t("resultsOver", { count: format.number(COUNT_CEILING) }) : t("results", { count: total }));
}


/** A single-choice filter with "Any": the same options for the desktop's pill menu and the sheet's pill group. */
type Choice = { key: string; name: string; heading?: string; value: string; options: { value: string; label: string }[] };

/** The years a range can start or end with, and their two lists; the other end's impossible years are disabled (CAT-06). */
function YearFields({ state, set }: { state: BrowseState; set: (patch: Patch) => void }) {
  const t = useTranslations("browse");
  const year = new Date().getFullYear();
  const any = { value: ANY, label: t("any") };
  const years = Array.from({ length: year - 1919 }, (_, i) => String(year + 1 - i));
  return (
    <div className="grid grid-cols-2 gap-3">
      <FilterSelect
        label={t("from")}
        value={state.yearFrom}
        onChange={(v) => set({ yearFrom: v })}
        options={[any, ...years.map((y) => ({ value: y, label: y, disabled: Boolean(state.yearTo) && Number(y) > Number(state.yearTo) }))]}
      />
      <FilterSelect
        label={t("to")}
        value={state.yearTo}
        onChange={(v) => set({ yearTo: v })}
        options={[any, ...years.map((y) => ({ value: y, label: y, disabled: Boolean(state.yearFrom) && Number(y) < Number(state.yearFrom) }))]}
      />
    </div>
  );
}

/**
 * The genres pill: a menu of genres that stays open while they are ticked. A tick shows at once, before the address
 * catches up, so quick ticks don't undo each other.
 */
function GenresPill({ state, set, shown, name }: { state: BrowseState; set: (patch: Patch) => void; shown: Genre[]; name: (id: number) => string }) {
  const t = useTranslations("browse");
  const [pending, setPending] = useState<number[] | null>(null);
  const picked = pending ?? state.genres;
  const key = state.genres.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the address catches up
  useEffect(() => {
    if (pending?.join(",") === key) setPending(null);
  }, [key]);
  const pick = (next: number[]) => {
    setPending(next);
    set({ genres: next.join(",") || null });
  };
  const names = picked.map(name);
  const text = names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
  return (
    <Pill
      text={text || t("genres")}
      selected={picked.length > 0}
      label={picked.length ? `${t("genres")}: ${names.join(", ")}` : undefined}
      popup="menu"
      // Each opening starts from the address (a tick it never took doesn't stay).
      onOpenChange={(o) => o && setPending(null)}
    >
      {(m, trigger, { open, setOpen }) => (
        <m.Menu label={t("genres")} align="start" open={open} onOpenChange={setOpen} trigger={trigger}>
          <m.MenuCheckboxItem checked={picked.length === 0} onCheckedChange={() => pick([])}>
            {t("any")}
          </m.MenuCheckboxItem>
          <m.MenuSeparator />
          {shown.map((g) => (
            <m.MenuCheckboxItem
              key={g.id}
              keepOpen
              checked={picked.includes(g.id)}
              onCheckedChange={(on) => pick(on ? [...picked, g.id] : picked.filter((x) => x !== g.id))}
            >
              {name(g.id)}
            </m.MenuCheckboxItem>
          ))}
        </m.Menu>
      )}
    </Pill>
  );
}

/**
 * The filters of a catalog grid (8.4), for both places they are shown: a row of pills above the grid on a desktop,
 * each opening its menu and applied at once, and the filter sheet on a phone and tablet — the same filters as groups
 * of pills, applied with its "Show N" button (CAT-03).
 */
function Filters({ state, set, kind, genres, layout }: { state: BrowseState; set: (patch: Patch) => void; kind: MediaKind; genres: Genre[]; layout: "row" | "sheet" }) {
  const t = useTranslations("browse");
  const tr = useTranslations();
  const locale = useLocale();
  // Decimals in the locale's style (2.3: 6,5 in ru/uk).
  const format = useFormatter();
  const isMovie = kind === "movie";
  const series = kind === "tv" && !state.anime;
  const tv = kind === "tv";
  const minutes = (m: number) => formatRuntime(m, (k, v) => tr(k as "common.minutes", v)) ?? "";
  const shown = genres.filter((g) => !(state.anime && g.id === 16));
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  const genreName = (id: number) => cap(genres.find((g) => g.id === id)?.name ?? `#${id}`);
  const choices: Choice[] = [
    { key: "ratingMin", name: t("rating"), heading: t("minRating"), value: state.ratingMin, options: [5, 6, 6.5, 7, 7.5, 8, 8.5].map((r) => ({ value: String(r), label: `${format.number(r)}+` })) },
    ...(isMovie ? [{ key: "runtimeMax", name: t("runtime"), value: state.runtimeMax, options: [90, 100, 120, 150].map((m) => ({ value: String(m), label: t("runtimeMax", { time: minutes(m) }) })) }] : []),
    ...(series ? [{ key: "type", name: t("type"), value: state.type, options: [{ value: "scripted", label: t("typeScripted") }, { value: "mini", label: t("typeMini") }] }] : []),
    ...(tv ? [{ key: "status", name: t("status"), value: state.status, options: [{ value: "ended", label: t("statusEnded") }, { value: "returning", label: t("statusReturning") }] }] : []),
    ...(!state.anime ? [{ key: "language", name: t("language"), heading: t("originalLanguage"), value: state.language, options: LANGS.map((l) => ({ value: l, label: cap(languageName(l, locale) ?? l) })) }] : []),
  ];
  const { yearFrom: from, yearTo: to } = state;
  const yearsText = from && to ? (from === to ? from : `${from}–${to}`) : from ? t("yearsFrom", { year: from }) : to ? t("yearsTo", { year: to }) : "";

  if (layout === "sheet") {
    const group = (legend: string, children: ReactNode) => (
      <fieldset key={legend}>
        <legend className="mb-2.5 text-body-s font-semibold text-text-1">{legend}</legend>
        <div className="flex flex-wrap gap-x-2 gap-y-1">{children}</div>
      </fieldset>
    );
    return (
      <div className="space-y-6">
        {group(
          t("genres"),
          shown.map((g) => (
            <FilterChip
              key={g.id}
              selected={state.genres.includes(g.id)}
              onClick={() => set({ genres: (state.genres.includes(g.id) ? state.genres.filter((x) => x !== g.id) : [...state.genres, g.id]).join(",") || null })}
            >
              {cap(g.name)}
            </FilterChip>
          )),
        )}
        <fieldset>
          <legend className="mb-2.5 text-body-s font-semibold text-text-1">{t("years")}</legend>
          <YearFields state={state} set={set} />
        </fieldset>
        {choices.map((c) =>
          group(c.heading ?? c.name, [
            <FilterChip key={ANY} selected={!c.value} onClick={() => set({ [c.key]: null })}>
              {t("any")}
            </FilterChip>,
            ...c.options.map((o) => (
              <FilterChip key={o.value} selected={c.value === o.value} onClick={() => set({ [c.key]: c.value === o.value ? null : o.value })}>
                {o.label}
              </FilterChip>
            )),
          ]),
        )}
      </div>
    );
  }
  return (
    <>
      <GenresPill state={state} set={set} shown={shown} name={genreName} />
      <Pill text={yearsText || t("years")} selected={Boolean(yearsText)} label={yearsText ? `${t("years")}: ${yearsText}` : undefined} popup="dialog">
        {(m, trigger, { open, setOpen }) => (
          <m.Popover title={t("years")} align="start" open={open} onOpenChange={setOpen} trigger={trigger}>
            <YearFields state={state} set={set} />
          </m.Popover>
        )}
      </Pill>
      {choices.map((c) => {
        const chosen = c.options.find((o) => o.value === c.value)?.label;
        return (
          <Pill key={c.key} text={chosen ?? c.name} selected={Boolean(chosen)} label={chosen ? `${c.heading ?? c.name}: ${chosen}` : undefined} popup="menu">
            {(m, trigger, { open, setOpen }) => (
              <m.Menu label={c.heading ?? c.name} align="start" open={open} onOpenChange={setOpen} trigger={trigger}>
                {c.heading && <m.MenuLabel>{c.heading}</m.MenuLabel>}
                <m.MenuCheckboxItem checked={!chosen} onCheckedChange={() => set({ [c.key]: null })}>
                  {t("any")}
                </m.MenuCheckboxItem>
                <m.MenuSeparator />
                {c.options.map((o) => (
                  <m.MenuCheckboxItem key={o.value} checked={c.value === o.value} onCheckedChange={() => set({ [c.key]: o.value })}>
                    {o.label}
                  </m.MenuCheckboxItem>
                ))}
              </m.Menu>
            )}
          </Pill>
        );
      })}
    </>
  );
}

export function BrowseView({
  kind: initialKind,
  genres,
  anime = false,
  allowKindSwitch = false,
  initial,
}: {
  kind: MediaKind;
  genres: Genre[];
  anime?: boolean;
  allowKindSwitch?: boolean;
  /** First page rendered on the server for this exact query (no skeleton flash, crawlable). */
  initial?: { query: string; page: Paged<TitleSummary> };
}) {
  const t = useTranslations("browse");
  const tc = useTranslations("common");
  const trows = useTranslations("rows");
  const locale = useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const countText = useCountText();
  const format = useFormatter();
  const kind = (allowKindSwitch && params.get("kind") === "movie" ? "movie" : initialKind) as MediaKind;
  const state = browseState((k) => params.get(k), anime);
  const { me } = useSession();
  const tl = useTranslations("library");
  // "Save as list" (null) or a smart list's "Edit conditions" (its list, `?editList=`) open the dialog; false — closed.
  const [saving, setSaving] = useState<RulesEdit | null | false>(false);
  const [gate, setGate] = useState(false);
  const editing = /^[0-9a-f-]{36}$/.test(params.get("editList") ?? "") ? params.get("editList") : null;

  // The filters, the sort and the loaded position are in the address (8.4, 8.7): "Back" returns to the same grid. A
  // shelf's name stays while its own conditions do (CAT-11).
  const navigate = (next: URLSearchParams) => {
    const sp = keepShelf(new URLSearchParams(params.toString()), next);
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };
  const patched = (base: URLSearchParams, patch: Patch) => {
    const sp = new URLSearchParams(base.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    return sp;
  };
  const update = (patch: Patch) => navigate(patched(new URLSearchParams(params.toString()), patch));
  // Without filters the grid stays a grid ("view=all"), not the section's landing.
  const cleared: Patch = { ...Object.fromEntries(FILTER_KEYS.map((k) => [k, null])), view: "all" };

  // biome-ignore lint/correctness/useExhaustiveDependencies: the state fields are the inputs
  const apiQuery = useMemo(
    () => discoverQuery(kind, state),
    [kind, state.sort, state.genres.join(","), state.yearFrom, state.yearTo, state.ratingMin, state.language, state.anime, state.without.join(","), state.runtimeMax, state.type, state.status, state.votesMin, state.votesMax, state.noSpecials, state.episodesMax, state.imdbVotesMax, state.opinions, state.mood],
  );

  // The sorts on Lumovio's own catalog index these filters allow (IMDb, Lumovio Score, critics), with how many of the
  // filtered titles each one scores; a source that scores too few is not offered.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the state fields are the inputs
  const sortsQuery = useMemo(() => filtersQuery(kind, state), [apiQuery]);
  const sorts = useQuery({
    queryKey: ["catalog-sorts", sortsQuery],
    queryFn: () => api<CatalogSorts>(`/api/catalog/sorts?${sortsQuery}`),
    staleTime: 10 * 60_000,
  });
  // An index sort these filters don't allow (a filter the index lacks, too few scored) is not kept: the grid would
  // otherwise be sorted by something else than its name says.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the answer for the current filters arrives
  useEffect(() => {
    if (sorts.data && isIndexSort(state.sort) && !sorts.data[state.sort]) update({ sort: null });
  }, [sorts.data]);

  const q = useInfiniteQuery({
    queryKey: ["discover", apiQuery, locale],
    queryFn: ({ pageParam }) => api<Paged<TitleSummary>>(`/api/catalog/discover?${apiQuery}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    initialData: initial && initial.query === apiQuery ? { pages: [initial.page], pageParams: [1] } : undefined,
    staleTime: 5 * 60_000,
  });

  // "Show more" is a button (8.4); only the TV mode loads the next page by itself near the end.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || document.documentElement.dataset.tv !== "1") return;
    const io = new IntersectionObserver(
      (e) => {
        if (e[0]?.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      },
      { rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [q]);

  const items = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages ?? [])
      .flatMap((p) => p.results)
      .filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
  }, [q.data]);
  const first = q.data?.pages[0];
  const isMovie = kind === "movie";
  const tv = kind === "tv";
  const series = tv && !state.anime;
  // A shelf's "All" page keeps the shelf's conditions without showing them as chips (CAT-05).
  const shelf = SHELF_COPY[params.get("shelf") ?? ""]?.title ? params.get("shelf") : null;
  // Conditions without a control of their own; a shelf's page counts them as one (its name stands for them), and a
  // shelf with none of them ("Anime series", "Popular series") adds nothing to the count (CAT-11).
  const hiddenCount =
    state.without.length +
    [state.votesMin, state.votesMax, isMovie && state.noSpecials, tv && state.episodesMax, state.imdbVotesMax, state.opinions, isMovie && state.mood].filter(Boolean).length;
  const activeCount =
    state.genres.length +
    [state.yearFrom || state.yearTo, state.ratingMin, state.language, isMovie && state.runtimeMax, series && state.type, tv && state.status].filter(Boolean).length +
    (shelf ? Math.min(1, hiddenCount) : hiddenCount);
  const genreName = (id: number) => genres.find((g) => g.id === id)?.name ?? `#${id}`;
  // Conditions that arrive from links and have no control of their own stay visible and removable.
  const presets: { key: string; label: string; clear: Patch }[] = shelf
    ? []
    : [
        ...state.without.map((g) => ({ key: `w${g}`, label: t("without", { genre: genreName(g) }), clear: { without: state.without.filter((x) => x !== g).join(",") || null } })),
        ...(state.votesMin ? [{ key: "vmin", label: t("votesMin", { count: Number(state.votesMin) }), clear: { votesMin: null } }] : []),
        ...(state.votesMax ? [{ key: "vmax", label: t("votesMax", { count: Number(state.votesMax) }), clear: { votesMax: null } }] : []),
        ...(isMovie && state.noSpecials ? [{ key: "nospecials", label: t("noSpecials"), clear: { nospecials: null } }] : []),
        ...(tv && state.episodesMax ? [{ key: "episodes", label: t("episodesMax", { count: Number(state.episodesMax) }), clear: { episodesMax: null } }] : []),
        ...(state.imdbVotesMax ? [{ key: "imdbmax", label: t("imdbVotesMax", { count: Number(state.imdbVotesMax) }), clear: { imdbVotesMax: null } }] : []),
        ...(state.opinions ? [{ key: "opinions", label: t("criticsHigher"), clear: { opinions: null } }] : []),
        ...(isMovie && state.mood ? [{ key: "mood", label: t("mood", { name: trows(MOOD_NAME[state.mood]) }), clear: { mood: null } }] : []),
      ];

  // The phone's filter sheet works on a copy of the address and applies it with "Show N" (CAT-03).
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(() => new URLSearchParams());
  const openSheet = () => {
    setDraft(new URLSearchParams(params.toString()));
    setSheetOpen(true);
  };
  const draftState = browseState((k) => draft.get(k), anime);
  const draftQuery = discoverQuery(kind, draftState);
  const [countQuery, setCountQuery] = useState(draftQuery);
  useEffect(() => {
    const id = setTimeout(() => setCountQuery(draftQuery), 300);
    return () => clearTimeout(id);
  }, [draftQuery]);
  const count = useQuery({
    queryKey: ["discover", countQuery, locale, "count"],
    queryFn: () => api<Paged<TitleSummary>>(`/api/catalog/discover?${countQuery}&page=1`),
    enabled: sheetOpen,
    staleTime: 5 * 60_000,
  });
  const draftCount = count.data && countQuery === draftQuery ? count.data : null;
  const showLabel = !draftCount
    ? t("apply")
    : draftCount.results.length === 0
      ? t("nothing")
      : draftCount.totalIsEstimate
        ? t("apply")
        : t("showCount", { count: countText(draftCount.totalResults) });
  const grid = (children: ReactNode) => <div className={CATALOG_GRID}>{children}</div>;
  // TMDB's own sorts in the owner's order (2026-10-25), then the ones on Lumovio's catalog index over the whole
  // filtered catalog (not a loaded page) — each only where the filters allow it and enough titles have the score.
  const indexOption = (s: keyof typeof INDEX_SORTS, label: string) => (sorts.data?.[s] || state.sort === s ? [{ value: s, label }] : []);
  const sortOptions = [
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
  const sortLabel = sortOptions.find((o) => o.value === state.sort)?.label ?? t("sortPopularity");
  // The sort is not a filter: a pill of the same look on the end of the row, never "selected".
  const sort = (
    <Pill text={sortLabel} selected={false} label={`${t("sort")}: ${sortLabel}`} popup="menu">
      {(m, trigger, { open, setOpen }) => (
        <m.Menu label={t("sort")} open={open} onOpenChange={setOpen} trigger={trigger}>
          {sortOptions.map((o) => (
            <m.MenuCheckboxItem key={o.value} checked={state.sort === o.value} onCheckedChange={() => update({ sort: o.value === "popularity" ? null : o.value })}>
              {o.label}
            </m.MenuCheckboxItem>
          ))}
        </m.Menu>
      )}
    </Pill>
  );
  // The grid's filters and sort as a smart list (package F); a guest is asked to sign in first (8.6). While a list's
  // conditions are edited, the banner above saves them back instead.
  const saveAsList = (className: string) =>
    !editing && (
      <Button variant="tertiary" size="sm" icon={ListFilterPlus} className={className} onClick={() => (me?.activeProfile ? setSaving(null) : setGate(true))}>
        {tl("saveAsList")}
      </Button>
    );
  // A sort by a score lists the titles that have it, and says how many of the filtered ones those are — not for a kids
  // profile, whose numbers are counted before each title's age rule (as the count above is not shown then).
  const coverage = first?.coverage && !first.totalIsEstimate && isIndexSort(state.sort) ? first.coverage : null;

  return (
    <div>
      {editing && (
        <Suspense>
          <EditRulesBar listId={editing} onSave={setSaving} className="mb-4" />
        </Suspense>
      )}
      {/* One row of pills (7.4, 8.4): the filters, "Reset" once something is chosen, the sort and "Save as list" on
          the end. Below lg the filters are one "Filters" pill opening the sheet. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {allowKindSwitch && (
          <SegmentedControl
            label={t("type")}
            value={kind}
            onValueChange={(k) => update({ kind: k === "movie" ? "movie" : null })}
            options={[
              { value: "tv", label: t("titleSeries") },
              { value: "movie", label: t("titleMovies") },
            ]}
          />
        )}
        <div className="contents max-lg:hidden">
          <Filters state={state} set={update} kind={kind} genres={genres} layout="row" />
          {activeCount > 0 && (
            <Button variant="tertiary" size="sm" onClick={() => update(cleared)}>
              {t("resetShort")}
            </Button>
          )}
        </div>
        <FilterChip
          icon={SlidersHorizontal}
          selected={activeCount > 0}
          count={activeCount > 0 ? activeCount : undefined}
          {...NOT_TOGGLE}
          aria-haspopup="dialog"
          className="lg:hidden"
          onClick={openSheet}
        >
          {t("filters")}
        </FilterChip>
        <div className="ms-auto flex items-center gap-2">
          {sort}
          {saveAsList("max-lg:hidden")}
        </div>
      </div>
      {presets.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <InputChip key={p.key} label={p.label} onRemove={() => update(p.clear)} />
          ))}
        </div>
      )}
      <div className="mb-4 flex min-h-8 items-center gap-3">
        {/* After Lumovio re-checks the conditions the source's count is only an upper bound, so it is not shown. */}
        <p className="text-body-s text-text-2" aria-live="polite">
          {coverage && isIndexSort(state.sort)
            ? t("sortCoverage", { rated: coverage.rated, of: format.number(coverage.of), source: INDEX_SORTS[state.sort] })
            : first && !first.totalIsEstimate && first.totalResults > 0
              ? countText(first.totalResults)
              : null}
        </p>
        {saveAsList("ms-auto lg:hidden")}
      </div>
      {/* A failed load says so with Retry, not "nothing found" (8.4, audit X-14); a failed "Show more" — at the button
          below, not above the grid out of sight (CAT-12). */}
      <QueryState
        query={{ ...q, isError: q.isError && !q.isFetchNextPageError }}
        loading={grid(SKELETONS.map((k) => <PosterCardSkeleton key={k} />))}
        isEmpty={(d) => d.pages.every((p) => p.results.length === 0)}
        empty={
          <EmptyState
            icon={Clapperboard}
            title={t("empty")}
            about={t("emptyHint")}
            action={
              activeCount > 0 ? (
                <Button variant="secondary" icon={X} onClick={() => update(cleared)}>
                  {tc("resetFilters")}
                </Button>
              ) : undefined
            }
          />
        }
      >
        {() => grid(items.map((r, i) => <PosterCard key={r.id} title={r} priority={i < 6} />))}
      </QueryState>
      <div ref={sentinel} className="h-1" />
      <LoadMore
        onMore={() => void q.fetchNextPage()}
        loading={q.isFetchingNextPage}
        failed={q.isFetchNextPageError}
        hasMore={q.hasNextPage}
      />
      <Suspense>
        {saving !== false && (
          <SaveRulesDialog
            open
            onOpenChange={(o) => !o && setSaving(false)}
            target={{ from: "catalog", kind, state }}
            edit={saving}
            genres={genres}
          />
        )}
        {gate && <GuestGate open onOpenChange={setGate} reason="saveList" />}
      </Suspense>
      {/* Filters on a phone and tablet: a sheet; the choices apply with "Show N", "Reset" clears them (CAT-03). */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title={t("filters")}>
        <Filters state={draftState} set={(patch) => setDraft((d) => patched(d, patch))} kind={kind} genres={genres} layout="sheet" />
        <DialogActions>
          <Button variant="secondary" onClick={() => setDraft((d) => patched(d, cleared))}>
            {t("resetShort")}
          </Button>
          <Button
            loading={countQuery !== draftQuery || count.isFetching}
            disabled={draftCount?.results.length === 0}
            onClick={() => {
              setSheetOpen(false);
              navigate(draft);
            }}
          >
            {showLabel}
          </Button>
        </DialogActions>
      </Sheet>
    </div>
  );
}
