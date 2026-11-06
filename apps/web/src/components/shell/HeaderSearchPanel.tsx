"use client";

import type { CatalogSearch, PersonSummary, TitleSummary } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, History, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CardRating } from "@/components/media/CardRating";
import { useSession } from "@/components/providers/Providers";
import { recentSearches, useRecentSearches } from "@/components/search/recent-searches";
import { SearchField } from "@/components/search/SearchField";
import { departmentKey } from "@/components/search/search-helpers";
import { DEBOUNCE_MS, groupResults, isEmpty, looksDescriptive, MIN_CHARS, QUERY_MAX, searchUrl } from "@/components/search/search-model";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { latinLang } from "@/lib/format";
import { tmdbImage } from "@/lib/images";
import { personHref, titleHref } from "@/lib/slug";

const TITLES = 5;
const PEOPLE = 2;
const RECENT = 5;

/** One row of the list: what the arrows step over and Enter opens. */
type Option =
  | { kind: "recent"; key: string; text: string }
  | { kind: "title"; key: string; title: TitleSummary; best: boolean }
  | { kind: "person"; key: string; person: PersonSummary; best: boolean }
  | { kind: "describe"; key: string; href: string }
  | { kind: "all"; key: string; href: string };

/** The round button the field grows out of (IconButton md), and how long it takes to shrink back (--dur-base). */
const BUTTON = 40;
const CLOSE_MS = 200;

/**
 * The open field's width: 320, 384 from lg — or, when that would reach into the header's sections (768–1023, a kids
 * profile's tag, a longer language), from where the sections start, covering them while it is open.
 */
function roomFor(el: HTMLElement | null): number {
  const wide = window.matchMedia("(min-width: 64rem)").matches ? 384 : 320;
  const nav = el?.closest("header")?.querySelector("nav")?.getBoundingClientRect();
  if (!el || !nav || nav.width === 0) return wide;
  const right = el.getBoundingClientRect().right;
  return right - wide < nav.right + 16 ? Math.max(wide, right - nav.left) : wide;
}

/**
 * The header's open search (design-system 7.19, 9 "Search"; as Apple TV's; ./HeaderSearch opens it): the field in the
 * header itself and a list under it. An empty field lists the recent searches (a press puts one back in the field);
 * from two letters the answer comes as it is typed: the best match larger, then titles and people, and "All results"
 * (the search page); a text that reads as a description gets "Search by description" first, otherwise it is the last
 * row. ↑/↓ step through the rows (the field keeps the focus, `aria-activedescendant`), Enter opens the row — or all
 * results when none is chosen —, Escape closes, as do a press outside and an opened row.
 */
export function HeaderSearchPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { me } = useSession();
  const kids = Boolean(me?.activeProfile?.isKids);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const recent = useRecentSearches();

  useEffect(() => {
    const id = setTimeout(() => setDq(q.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q]);
  // The field grows out of the round button and back into it (--dur-base, ease-base: 6.3, 7.19); its width is the
  // header's room — over the sections when they are in the way, so nothing beside it moves.
  const [width, setWidth] = useState(BUTTON);
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  useLayoutEffect(() => {
    setWidth(roomFor(box.current));
    const id = requestAnimationFrame(() => setExpanded(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  /** Shrinks back into the button, then leaves its place to it; at once with reduced motion. */
  const shrinkRef = useRef(() => {});
  shrinkRef.current = () => {
    if (closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return closeRef.current();
    setClosing(true);
    setExpanded(false);
    closeTimer.current = setTimeout(() => closeRef.current(), CLOSE_MS);
  };
  // Opened: the field takes the focus; a press outside closes it.
  useEffect(() => {
    input.current?.focus();
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) shrinkRef.current();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const close = () => shrinkRef.current();
  const typed = dq.length >= MIN_CHARS;
  const results = useQuery({
    queryKey: ["search", dq, locale],
    queryFn: ({ signal }) => api<CatalogSearch>(searchUrl(dq), { signal }),
    enabled: typed,
    staleTime: 5 * 60_000,
  });
  // "Describe it" for whoever may use it (not a kids profile, nor a server without a model).
  const aiStatus = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => api<{ available: boolean }>("/api/ai/status"),
    staleTime: Infinity,
    enabled: !kids,
  });
  const aiOffered = !kids && aiStatus.data?.available === true;

  const data = typed ? results.data : undefined;
  const all = `/search?q=${encodeURIComponent(dq)}`;
  const options = useMemo<Option[]>(() => {
    if (!q.trim()) return recent.slice(0, RECENT).map((text) => ({ kind: "recent" as const, key: `r:${text}`, text }));
    if (!typed || !data) return [];
    const describe: Option[] = aiOffered ? [{ kind: "describe", key: "describe", href: `/search?mode=ai&q=${encodeURIComponent(dq)}` }] : [];
    const first = looksDescriptive(dq, data.clear);
    const g = groupResults(data);
    const best: Option[] = g.best ? [g.best.type === "title" ? { kind: "title", key: g.best.title.id, title: g.best.title, best: true } : { kind: "person", key: `p:${g.best.person.id}`, person: g.best.person, best: true }] : [];
    const titleRows = data.titles.results
      .filter((x) => !(g.best?.type === "title" && g.best.title.id === x.id))
      .slice(0, TITLES - (g.best?.type === "title" ? 1 : 0))
      .map((x): Option => ({ kind: "title", key: x.id, title: x, best: false }));
    const personRows = g.people.slice(0, PEOPLE).map((p): Option => ({ kind: "person", key: `p:${p.id}`, person: p, best: false }));
    const found = isEmpty(data) ? [] : [...best, ...titleRows, ...personRows, { kind: "all" as const, key: "all", href: all }];
    return first ? [...describe, ...found] : [...found, ...describe];
  }, [q, typed, data, recent, aiOffered, dq, all]);
  // A new list starts with nothing chosen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a new list only
  useEffect(() => setActive(-1), [options]);

  const optionId = (i: number) => `${listId}-${i}`;
  const href = (o: Option) =>
    o.kind === "title" ? titleHref(o.title.kind, o.title.tmdbId, o.title.title) : o.kind === "person" ? personHref(o.person.id, o.person.name) : o.kind === "recent" ? null : o.href;
  const choose = (o: Option) => {
    if (o.kind === "recent") {
      setQ(o.text);
      setDq(o.text);
      input.current?.focus();
      return;
    }
    if (o.kind !== "describe") recentSearches.push(dq);
    router.push(href(o)!);
    close();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!options.length) return;
      e.preventDefault();
      setActive((i) => (e.key === "ArrowDown" ? Math.min(i + 1, options.length - 1) : Math.max(i - 1, -1)));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = options[active];
      if (o) choose(o);
      else if (q.trim().length >= MIN_CHARS) {
        recentSearches.push(q.trim());
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        close();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };
  // The cross empties the field, or closes it when it is empty.
  const clear = () => {
    if (!q) return close();
    setQ("");
    input.current?.focus();
  };
  // The chosen row stays in view of a list taller than the window.
  useEffect(() => {
    if (active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const showList = q.trim() ? typed : options.length > 0;
  const kindOf = (x: TitleSummary) => (x.isAnime ? tc("anime") : x.kind === "movie" ? tc("movie") : tc("series"));
  // The field keeps the focus; the list is pointed at with aria-activedescendant (WAI-ARIA combobox), so a row is chosen
  // by the arrows and Enter, or a press.
  const row = (o: Option, i: number, body: ReactNode) => (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled by the search field
    <div
      key={o.key}
      id={optionId(i)}
      role="option"
      tabIndex={-1}
      aria-selected={i === active}
      onMouseMove={() => i !== active && setActive(i)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => choose(o)}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-start transition-colors duration-fast ease-fast",
        i === active && "bg-surface-3",
      )}
    >
      {body}
    </div>
  );
  const body = (o: Option): ReactNode => {
    if (o.kind === "recent")
      return (
        <>
          <History aria-hidden className="size-4.5 shrink-0 text-text-3" />
          <span className="truncate text-body text-text-1">{o.text}</span>
        </>
      );
    if (o.kind === "title") {
      const x = o.title;
      return (
        <>
          <span aria-hidden className={cn("shrink-0 overflow-hidden rounded-xs bg-surface-3", o.best ? "h-21 w-14" : "h-15 w-10")}>
            {x.posterPath && <img src={tmdbImage(x.posterPath, o.best ? "w154" : "w92") ?? undefined} alt="" className="size-full object-cover" loading="lazy" />}
          </span>
          <span className="min-w-0">
            <span className={cn("block truncate font-semibold text-text-1", o.best ? "text-title" : "text-body")} lang={latinLang(x.title, locale)}>
              {x.title}
            </span>
            <span className="flex items-baseline gap-1.5 truncate text-body-s text-text-2">
              {[kindOf(x), x.year].filter(Boolean).join(" · ")}
              {o.best && (x.lumovioScore || x.imdbRating || x.tmdbRating) && (
                <>
                  <span aria-hidden>·</span>
                  <CardRating title={x} />
                </>
              )}
            </span>
          </span>
        </>
      );
    }
    if (o.kind === "person") {
      const p = o.person;
      const dept = departmentKey(p.knownFor);
      return (
        <>
          <span aria-hidden className={cn("shrink-0 overflow-hidden rounded-full bg-surface-3", o.best ? "size-14" : "size-10")}>
            {p.profilePath && <img src={tmdbImage(p.profilePath, "w185") ?? undefined} alt="" className="size-full object-cover" loading="lazy" />}
          </span>
          <span className="min-w-0">
            <span className={cn("block truncate font-semibold text-text-1", o.best ? "text-title" : "text-body")}>{p.name}</span>
            {dept && <span className="block truncate text-body-s text-text-2">{tr(dept as "person.dept0")}</span>}
          </span>
        </>
      );
    }
    if (o.kind === "describe")
      return (
        <>
          <Sparkles aria-hidden className="size-4.5 shrink-0 text-text-2" />
          <span className="min-w-0 truncate text-body font-semibold text-text-1">{t("findByDescription")}</span>
        </>
      );
    return (
      <>
        <ArrowRight aria-hidden className="size-4.5 shrink-0 text-text-2 rtl:-scale-x-100" />
        <span className="flex-1 text-body font-semibold text-text-1">{t("allResults")}</span>
        <kbd className="rounded-xs bg-surface-3 px-1.5 py-0.5 font-sans text-caption text-text-2">Enter</kbd>
      </>
    );
  };

  const people = options.findIndex((o) => o.kind === "person" && !o.best);
  const tail = options.findIndex((o) => o.kind === "all" || (o.kind === "describe" && options[0]?.kind !== "describe"));

  return (
    // The button's place in the header: the field grows from its end edge over what stands before it.
    <div ref={box} className="relative size-10 max-md:hidden">
      <SearchField
        ref={input}
        size="md"
        value={q}
        onValueChange={(v) => setQ(v.slice(0, QUERY_MAX))}
        onClear={clear}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        aria-label={tr("nav.search")}
        placeholder={tr("nav.search")}
        maxLength={QUERY_MAX}
        boxStyle={{ width: expanded ? width : BUTTON }}
        className="absolute end-0 top-0 z-10 overflow-hidden border-transparent transition-[width,border-color,box-shadow] duration-base ease-base in-data-[tv=1]:transition-none"
      />
      {showList && (
        // The page's theme, not the stage's: over a hero the header is a stage (3.5), its list is the site's own layer.
        // It comes in as the field opens (fades in, 4 px down) and goes out as it closes.
        <div
          data-theme={document.documentElement.dataset.theme}
          className={cn(
            "absolute end-0 top-12 z-popover max-h-[calc(100svh-5rem)] w-120 overflow-y-auto rounded-md border border-line bg-surface-2 p-2 text-text-1 shadow-float",
            "transition-[opacity,translate] duration-base ease-base starting:-translate-y-1 starting:opacity-0 in-data-[tv=1]:transition-none",
            closing && "pointer-events-none -translate-y-1 opacity-0",
          )}
        >
          {!q.trim() && (
            <div className="flex items-center justify-between gap-4 px-3 pt-1 pb-1.5">
              <p className="text-body-s font-semibold text-text-3">{t("recent")}</p>
              <Button variant="tertiary" size="sm" onPointerDown={(e) => e.preventDefault()} onClick={recentSearches.clear}>
                {t("clearRecent")}
              </Button>
            </div>
          )}
          {q.trim() && data?.interpreted && <p className="px-3 pt-1 pb-2 text-body-s text-text-2">{t("searchedAs", { q: data.interpreted })}</p>}
          {q.trim() && results.isError && !data ? (
            <p className="px-3 py-4 text-body text-text-2" role="status">
              {t("loadError")}
            </p>
          ) : q.trim() && !data ? (
            <div className="flex flex-col gap-2 p-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-1">
                  <Skeleton className={cn("shrink-0", i === 0 ? "h-21 w-14" : "h-15 w-10")} />
                  <div className="flex-1 space-y-2">
                    <Skeleton shape="xs" className="h-4 w-2/3" />
                    <Skeleton shape="xs" className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {q.trim() && data && isEmpty(data) && (
                <p className="px-3 py-3 text-body text-text-2" role="status">
                  {tr("ui.nothingFound")}
                </p>
              )}
              <div id={listId} role="listbox" aria-label={tr("nav.search")}>
                {options.map((o, i) => (
                  <ListPart key={o.key} heading={i === people ? t("people") : null} divider={i === tail && i > 0}>
                    {row(o, i, body(o))}
                  </ListPart>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** A row with what stands before it: the "People" heading, or the line above the last rows. */
function ListPart({ heading, divider, children }: { heading: string | null; divider: boolean; children: ReactNode }) {
  return (
    <>
      {divider && <div role="presentation" aria-hidden className="mx-3 my-1 h-px bg-line" />}
      {heading && (
        <div role="presentation" className="px-3 pt-2 pb-1 text-body-s font-semibold text-text-3">
          {heading}
        </div>
      )}
      {children}
    </>
  );
}
