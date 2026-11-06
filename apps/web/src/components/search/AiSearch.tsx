"use client";

import type { AiFilters, AiResultTitle, AiSearchResponse } from "@lumovio/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleHelp, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { PosterCard, PosterCardSkeleton } from "@/components/media/PosterCard";
import { TitleGrid } from "@/components/media/Row";
import { GuestGatePanel } from "@/components/shell/GuestGate";
import { Button } from "@/components/ui/Button";
import { InputChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Link } from "@/components/ui/Link";
import { Select } from "@/components/ui/Select";
import { capitalize, formatRuntime, languageName } from "@/lib/format";
import { api } from "@/lib/api";
import { catalogHref } from "./search-helpers";

/** The last search survives a trip to a title page and back. */
const STORE = "lumovio:ai-search";
const RUNTIMES = [60, 90, 100, 120, 150, 180];
/** "Any" in a Select (Radix keeps the empty value for "nothing chosen"). */
const ANY = "any";
const EXAMPLES = ["aiExample1", "aiExample2", "aiExample3"] as const;
/** A description is at least this long, and the API takes this much. */
export const AI_MIN = 3;
export const AI_MAX = 300;

type Saved = { text: string; data: AiSearchResponse };

async function readSaved(): Promise<Saved | null> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null") as Saved | null;
    if (!saved) return null;
    // Ignore state saved by an older version of this screen. The schemas (zod) load only to check one.
    const { AiFilters } = await import("@lumovio/contracts");
    const f = AiFilters.safeParse(saved.data?.filters);
    return f.success && Array.isArray(saved.data.results) ? { ...saved, data: { ...saved.data, filters: f.data } } : null;
  } catch {
    return null;
  }
}

/**
 * Searching by description (S05; SRCH-01…SRCH-03, SRCH-09, SRCH-10): the state of the search page's second way to
 * search, which shares its field. `run` asks the model once for a text; `apply` re-queries the catalog with edited
 * conditions, no model call. `ran` is the text the shown results are for — the page offers "Find" again once the
 * field says something else. `available` is false where the server has no model (the way isn't offered then).
 * Arriving with a text (`?mode=ai&q=`) restores this tab's last search of that text, else searches it.
 */
export function useAiSearch({ enabled, signedIn, arrival }: { enabled: boolean; signedIn: boolean; arrival: string }) {
  const [data, setData] = useState<AiSearchResponse | null>(null);
  const [ran, setRan] = useState<string | null>(null);
  const status = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => api<{ available: boolean }>("/api/ai/status"),
    staleTime: Infinity,
    enabled,
  });
  const save = (next: Saved) => {
    setData(next.data);
    setRan(next.text);
    try {
      sessionStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* storage unavailable: the search simply isn't kept for the way back */
    }
  };
  const runM = useMutation({
    mutationFn: (query: string) => api<AiSearchResponse>("/api/ai/search", { method: "POST", json: { query } }),
    onSuccess: (d, query) => save({ text: query, data: d }),
  });
  // Edited conditions re-query the catalog only; the notes about the original wording stay.
  const applyM = useMutation({
    mutationFn: (filters: AiFilters) => api<Omit<AiSearchResponse, "approximate" | "unsupported">>("/api/ai/results", { method: "POST", json: { filters } }),
    onSuccess: (d) => data && save({ text: ran ?? "", data: { ...data, ...d } }),
  });
  const run = (text: string) => {
    const v = text.trim().slice(0, AI_MAX);
    if (v.length < AI_MIN || !signedIn) return;
    applyM.reset();
    runM.mutate(v);
  };
  const runRef = useRef(run);
  runRef.current = run;

  // biome-ignore lint/correctness/useExhaustiveDependencies: once the way is open, on arrival
  useEffect(() => {
    if (!enabled || !signedIn) return;
    let live = true;
    void readSaved().then((saved) => {
      if (!live) return;
      const want = arrival.trim();
      if (saved && (!want || saved.text === want)) {
        setData((cur) => cur ?? saved.data);
        setRan((cur) => cur ?? saved.text);
      } else if (want) runRef.current(want);
    });
    return () => {
      live = false;
    };
  }, [enabled, signedIn]);

  return {
    available: status.data?.available !== false,
    data,
    ran,
    run,
    edit: (patch: Partial<AiFilters>) => {
      if (!data) return;
      runM.reset();
      applyM.mutate({ ...data.filters, ...patch });
    },
    busy: runM.isPending || applyM.isPending,
    error: runM.error ?? applyM.error,
    retry: () => (runM.isError ? runM.variables && runM.mutate(runM.variables) : data && applyM.mutate(applyM.variables ?? data.filters)),
  };
}

export type AiSearchState = ReturnType<typeof useAiSearch>;

/**
 * What searching by description shows under the field: a guest — the sign-in panel (SRCH-03, AUTH-02); before the
 * first search — examples that search at once; while it works — the grid's placeholders; a failure in words by its code,
 * never over the previous results (SRCH-02); a text that describes nothing — said so, with the examples; then the
 * conditions the model read (Selects and InputChips: a change re-queries the catalog only) and the titles, each with
 * why it is there when that says more than the description. The page keeps its height meanwhile (SRCH-10).
 */
export function AiPanel({ ai, signedIn, onExample }: { ai: AiSearchState; signedIn: boolean; onExample: (text: string) => void }) {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const tg = useTranslations("shell.gate");
  const tr = useTranslations();
  const locale = useLocale();

  if (!signedIn) {
    return (
      // In the middle of the page, as the empty and error states (no block hangs at the start, owner 2026-10-25).
      <div className="mx-auto mt-8 max-w-3xl rounded-md border border-line bg-surface-1">
        <GuestGatePanel reason="ai" next="/search?mode=ai" />
      </div>
    );
  }
  const { data, busy, error } = ai;
  const f = data?.filters;
  const genre = (id: number) => {
    const name = data?.genres.find((g) => g.id === id)?.name;
    return name ? capitalize(name, locale) : `#${id}`;
  };
  const minutes = (m: number) => formatRuntime(m, (k, v) => tr(k as "common.minutes", v)) ?? "";
  // Why a result is there, said under its card when it says more than the description itself: like a referenced
  // title, or a named person's work (a title picked as fitting the description needs no line of its own).
  const why = (w: AiResultTitle["why"]) =>
    !w || w.kind === "pick"
      ? null
      : w.kind === "like"
        ? t("aiSimilar", { title: w.title })
        : t(w.role === "director" ? "aiWhyDirector" : w.role === "actor" ? "aiWhyActor" : "aiWhyPerson", { name: w.name });

  const examples = (
    <section className="mt-8" aria-labelledby="ai-examples">
      <h2 id="ai-examples" className="text-title text-text-1">
        {tg("aiExamples")}
      </h2>
      <ul className="mt-3 flex flex-col items-start gap-2">
        {EXAMPLES.map((k) => (
          <li key={k} className="max-w-full">
            {/* Puts the example in the field and searches it. */}
            <Button variant="secondary" size="sm" icon={Sparkles} className="max-w-full" onClick={() => onExample(tg(k))}>
              <span className="truncate">{tg(k)}</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="min-h-[60svh]">
      {busy ? (
        <div className="mt-8" aria-busy>
          <span className="sr-only" role="status">
            {t("aiWorking")}
          </span>
          <TitleGrid>
            {Array.from({ length: 12 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
              <PosterCardSkeleton key={i} />
            ))}
          </TitleGrid>
        </div>
      ) : error != null ? (
        // In words by the error's code (a limit, an outage), never over the previous results (SRCH-02).
        <ErrorState className="mt-8" error={error} title={t("aiFailed")} onRetry={ai.retry} retrying={busy} />
      ) : data && data.understood === false ? (
        <>
          <EmptyState icon={CircleHelp} title={t("aiNotUnderstood")} text={t("aiNotUnderstoodText")} className="max-w-3xl" />
          {examples}
        </>
      ) : f && data ? (
        <div className="mt-8" aria-live="polite">
          <Conditions f={f} data={data} edit={ai.edit} genre={genre} minutes={minutes} locale={locale} />
          <div className="mt-6 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-body-s tabular-nums text-text-2">{t("aiCount", { count: data.results.length })}</p>
            <Link variant="action" arrow href={catalogHref(f)}>
              {t("aiOpenCatalog")}
            </Link>
          </div>
          {data.results.length === 0 ? (
            <EmptyState icon={Sparkles} title={t("aiEmptyTitle")} text={t("aiEmpty")} />
          ) : (
            <TitleGrid>
              {data.results.map((r) => (
                <PosterCard
                  key={r.id}
                  title={r}
                  subtitle={[r.year, r.runtime ? minutes(r.runtime) : null, why(r.why) ?? (r.kind === "movie" ? tc("movie") : tc("series"))].filter(Boolean).join(" · ")}
                />
              ))}
            </TitleGrid>
          )}
        </div>
      ) : (
        examples
      )}
    </div>
  );
}

/**
 * The conditions the search applies (SRCH-09): the hard ones — Selects for the kind, a series' type and status, the
 * length and the sort, InputChips for genres, years, rating and language — and, apart, the wishes that only order or
 * widen the result ("Like …", keywords, "shorter first"). One look, always shown; each change re-queries the catalog.
 * On a phone each row is one line that scrolls sideways, so the first results are on the first screen (R3).
 */
const ROW =
  "scroll-row flex items-center gap-2 *:shrink-0 max-sm:-mx-(--gutter) max-sm:-my-1 max-sm:overflow-x-auto max-sm:px-(--gutter) max-sm:py-1 sm:flex-wrap";

function Conditions({
  f,
  data,
  edit,
  genre,
  minutes,
  locale,
}: {
  f: AiFilters;
  data: AiSearchResponse;
  edit: (patch: Partial<AiFilters>) => void;
  genre: (id: number) => string;
  minutes: (m: number) => string;
  locale: string;
}) {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const tb = useTranslations("browse");
  const tv = f.kind === "tv";
  const notes = [
    data.approximate.length > 0 ? t("aiApproxShort", { list: data.approximate.map((x) => t("aiQuote", { text: x })).join(", ") }) : null,
    data.unsupported.length > 0 ? t("aiUnsupportedShort", { list: data.unsupported.map((x) => t("aiQuote", { text: x })).join(", ") }) : null,
    data.keywordsRelaxed ? t("aiKeywordsRelaxedShort") : null,
  ].filter(Boolean);
  return (
    <section aria-labelledby="ai-conditions" className="flex flex-col gap-3">
      <h2 id="ai-conditions" className="text-title text-text-1">
        {t("aiInterpretation")}
      </h2>
      <div className={ROW}>
        <Select
          aria-label={t("aiKind")}
          size="sm"
          className="w-auto"
          value={f.kind}
          onValueChange={(kind) => edit({ kind })}
          options={[
            { value: "movie", label: tc("movie") },
            { value: "tv", label: tc("series") },
          ]}
        />
        {tv && (
          <>
            <Select
              aria-label={tb("type")}
              size="sm"
              className="w-auto"
              value={f.tvType ?? ANY}
              onValueChange={(v) => edit({ tvType: v === ANY ? null : (v as "mini" | "scripted") })}
              options={[
                { value: ANY, label: t("aiAnyType") },
                { value: "scripted", label: tb("typeScripted") },
                { value: "mini", label: tb("typeMini") },
              ]}
            />
            <Select
              aria-label={tb("status")}
              size="sm"
              className="w-auto"
              value={f.tvStatus ?? ANY}
              onValueChange={(v) => edit({ tvStatus: v === ANY ? null : (v as "ended" | "returning") })}
              options={[
                { value: ANY, label: t("aiAnyStatus") },
                { value: "ended", label: tb("statusEnded") },
                { value: "returning", label: tb("statusReturning") },
              ]}
            />
          </>
        )}
        <Select
          aria-label={t("aiRuntime")}
          size="sm"
          className="w-auto"
          value={f.runtimeMax ? String(f.runtimeMax) : ANY}
          onValueChange={(v) => edit({ runtimeMax: v === ANY ? null : Number(v) })}
          options={[
            { value: ANY, label: t("aiRuntimeAny") },
            ...[...new Set([...RUNTIMES, ...(f.runtimeMax ? [f.runtimeMax] : [])])]
              .sort((a, b) => a - b)
              .map((m) => ({ value: String(m), label: t(tv ? "aiRuntimeEpisode" : "aiRuntimeMax", { time: minutes(m) }) })),
          ]}
        />
        {f.genres.map((g) => (
          <InputChip key={`g${g}`} label={genre(g)} onRemove={() => edit({ genres: f.genres.filter((x) => x !== g) })} />
        ))}
        {f.anyGenres.length > 0 && <InputChip label={t("aiAnyOfList", { list: f.anyGenres.map(genre).join(", ") })} onRemove={() => edit({ anyGenres: [] })} />}
        {f.excludeGenres.map((g) => (
          <InputChip key={`x${g}`} label={t("aiExclude", { genre: genre(g) })} onRemove={() => edit({ excludeGenres: f.excludeGenres.filter((x) => x !== g) })} />
        ))}
        {(f.yearFrom || f.yearTo) && (
          <InputChip
            label={f.yearFrom && f.yearTo ? `${f.yearFrom}–${f.yearTo}` : f.yearFrom ? t("aiYearFrom", { year: f.yearFrom }) : t("aiYearTo", { year: f.yearTo ?? "" })}
            onRemove={() => edit({ yearFrom: null, yearTo: null })}
          />
        )}
        {f.ratingMin !== null && <InputChip label={t("aiRating", { rating: f.ratingMin })} onRemove={() => edit({ ratingMin: null })} />}
        {f.language && <InputChip label={t("aiLanguage", { language: languageName(f.language, locale) ?? f.language })} onRemove={() => edit({ language: null })} />}
        {f.anime && <InputChip label={tc("anime")} onRemove={() => edit({ anime: false })} />}
        {/* The people the request names: only their work is shown (a hard condition). */}
        {(f.people ?? []).map((p) => (
          <InputChip
            key={`p${p.name}`}
            label={t(p.role === "director" ? "aiChipDirector" : p.role === "actor" ? "aiChipActor" : "aiChipPerson", { name: p.name })}
            onRemove={() => edit({ people: (f.people ?? []).filter((x) => x.name !== p.name) })}
          />
        ))}
        <Select
          aria-label={tb("sort")}
          size="sm"
          className="w-auto"
          value={f.sort}
          onValueChange={(sort) => edit({ sort })}
          // The catalog's names for the same orders (CAT-08).
          options={[
            { value: "popularity", label: tb("sortPopularity") },
            { value: "rating", label: tb("sortRating") },
            { value: "release_desc", label: tb("sortNewest") },
          ]}
        />
      </div>
      {(f.keywords.length > 0 || f.similarTo.length > 0 || f.preferShort) && (
        <div className={ROW}>
          <span className="text-body-s text-text-2">{t("aiPreferences")}</span>
          {f.similarTo.map((s) => (
            <InputChip key={`s${s}`} label={t("aiSimilar", { title: s })} onRemove={() => edit({ similarTo: f.similarTo.filter((x) => x !== s) })} />
          ))}
          {f.keywords.length > 0 && <InputChip label={t("aiKeywords", { list: f.keywords.join(", ") })} onRemove={() => edit({ keywords: [] })} />}
          {f.preferShort && <InputChip label={t("aiPreferShort")} onRemove={() => edit({ preferShort: false })} />}
        </div>
      )}
      {notes.length > 0 && <p className="text-body-s text-text-2">{notes.join(" · ")}</p>}
      {f.runtimeMax && <p className="text-body-s text-text-2">{t("aiUnknownRuntime")}</p>}
    </section>
  );
}
