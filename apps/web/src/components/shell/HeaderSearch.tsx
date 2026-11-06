"use client";

import type { CatalogSearch } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { tmdbImage } from "@/lib/images";
import { titleHref } from "@/lib/slug";

/** Typing pauses this long before a search goes out. */
const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;
const TITLES = 5;
const PEOPLE = 2;

/**
 * The header's search (owner, 2026-11-06, as Apple TV's): a round search button that opens a field in the header
 * itself — a press or "/" — and the results under it as they are typed: the first titles and people, then "All results"
 * (the search page). Enter goes there too; Escape, a press outside or a chosen result close it. A phone keeps its
 * Search tab.
 */
export function HeaderSearch() {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const id = setTimeout(() => setDq(q.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q]);
  // "/" opens it from anywhere but a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `close` only resets this component's own state
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const close = () => {
    setOpen(false);
    setQ("");
    setDq("");
  };
  // The cross empties the field, or closes it when it is empty.
  const clear = () => {
    if (!q) return close();
    setQ("");
    input.current?.focus();
  };
  const all = `/search?q=${encodeURIComponent(q.trim())}`;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length === 0) return;
    router.push(all);
    close();
  };

  const results = useQuery({
    queryKey: ["header-search", dq],
    queryFn: () => api<CatalogSearch>(`/api/catalog/search?q=${encodeURIComponent(dq)}`),
    enabled: open && dq.length >= MIN_CHARS,
    staleTime: 60_000,
  });

  if (!open)
    return <IconButton icon={Search} label={t("nav.search")} variant="secondary" aria-keyshortcuts="/" onClick={() => setOpen(true)} className="max-md:hidden" />;

  const titles = results.data?.titles.results.slice(0, TITLES) ?? [];
  const people = results.data?.people.slice(0, PEOPLE) ?? [];
  const shown = dq.length >= MIN_CHARS;
  const peopleBlock = people.length > 0 && (
    <li>
      <p className="px-3 pt-2 pb-1 text-body-s font-semibold text-text-3">{t("search.people")}</p>
      <ul>
        {people.map((p) => (
          <li key={p.id}>
            <Link href={`/person/${p.id}`} onClick={close} className="flex items-center gap-3 rounded-sm px-3 py-2 transition-colors duration-fast ease-fast hover:bg-surface-3 focus-visible:bg-surface-3">
              <span aria-hidden className="size-10 shrink-0 overflow-hidden rounded-full bg-surface-3">
                {p.profilePath && <img src={tmdbImage(p.profilePath, "w185") ?? undefined} alt="" className="size-full object-cover" loading="lazy" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-body font-semibold text-text-1">{p.name}</span>
                {p.knownFor && <span className="block truncate text-body-s text-text-2">{p.knownFor}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );

  return (
    <div ref={box} className="relative max-md:hidden">
      <form onSubmit={submit} className="flex h-10 w-80 items-center gap-2 rounded-full bg-surface-2 ps-3.5 pe-1.5 ring-2 ring-focus lg:w-96">
        <Search aria-hidden className="size-4.5 shrink-0 text-text-2" />
        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && close()}
          aria-label={t("nav.search")}
          aria-controls={listId}
          placeholder={t("nav.search")}
          className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-body text-text-1 shadow-none outline-none placeholder:text-text-3 focus-visible:shadow-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <IconButton icon={X} label={t("ui.clear")} size="sm" onClick={clear} />
      </form>
      {shown && (
        <div id={listId} className="absolute end-0 top-12 z-popover w-120 rounded-md border border-line bg-surface-2 p-2 shadow-float">
          {results.isPending ? (
            <div className="flex flex-col gap-2 p-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-1">
                  <Skeleton className="h-15 w-10 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton shape="xs" className="h-4 w-2/3" />
                    <Skeleton shape="xs" className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : titles.length + people.length === 0 ? (
            <p className="px-3 py-4 text-body text-text-2">{t("ui.nothingFound")}</p>
          ) : (
            <ul>
              {results.data?.peopleFirst && peopleBlock}
              {titles.map((r) => (
                <li key={r.id}>
                  <Link href={titleHref(r.kind, r.tmdbId, r.title)} onClick={close} className="flex items-center gap-3 rounded-sm px-3 py-2 transition-colors duration-fast ease-fast hover:bg-surface-3 focus-visible:bg-surface-3">
                    <span aria-hidden className="h-15 w-10 shrink-0 overflow-hidden rounded-xs bg-surface-3">
                      {r.posterPath && <img src={tmdbImage(r.posterPath, "w92") ?? undefined} alt="" className="size-full object-cover" loading="lazy" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-body font-semibold text-text-1">{r.title}</span>
                      <span className="block truncate text-body-s text-text-2">
                        {[r.isAnime ? t("common.anime") : r.kind === "movie" ? t("common.movie") : t("common.series"), r.year].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {!results.data?.peopleFirst && peopleBlock}
            </ul>
          )}
          <div aria-hidden className="mx-3 my-1 h-px bg-line" />
          <Link href={all} onClick={close} className={cn("flex items-center justify-between rounded-sm px-3 py-2.5 text-body font-semibold text-text-1 transition-colors duration-fast ease-fast hover:bg-surface-3 focus-visible:bg-surface-3")}>
            {t("search.allResults")}
            <kbd className="rounded-xs bg-surface-3 px-1.5 py-0.5 font-sans text-caption text-text-2">Enter</kbd>
          </Link>
        </div>
      )}
    </div>
  );
}
