"use client";

import type { ImportJob, TitleSummary } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, RotateCcw, Search, Trash2, TriangleAlert, Undo2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/Chip";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { SearchInput } from "@/components/ui/Input";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { PageHeader } from "@/components/ui/PageHeader";
import { type Step, Steps } from "@/components/ui/Progress";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { JobName, JobStatus, LABEL, shortDate } from "./import-shared";
import { tmdbImage } from "@/lib/images";
import { useAction } from "@/lib/use-action";


export type JobView = ImportJob & { progress: { done: number; total: number } | null };

export interface RowView {
  id: string;
  kind: string;
  status: string;
  sourceTitle: string;
  sourceYear: number | null;
  season: number | null;
  episode: number | null;
  watchedAt: string | null;
  rating: number | null;
  listName: string | null;
  sourceIds: Record<string, string>;
  match: { id: string; title: string; year: number | null; posterPath: string | null } | null;
  candidates: { id: string; title: string; year: number | null; posterPath: string | null; kind: string }[];
  confidence: number | null;
}

const STATUSES = ["ambiguous", "matched", "unmatched", "restricted", "duplicate", "skipped", "applied"] as const;
type RowStatus = (typeof STATUSES)[number];

export function JobReview({ jobId }: { jobId: string }) {
  const t = useTranslations("import");
  const tc = useTranslations("common");
  const locale = useLocale();
  const qc = useQueryClient();
  const router = useRouter();
  // Back on the list, the past imports show this one's new state.
  useEffect(() => () => void qc.invalidateQueries({ queryKey: ["imports"] }), [qc]);
  const confirm = useConfirm();
  const [filter, setFilter] = useState<RowStatus | null>(null);
  const [kinds, setKinds] = useState<string[]>(["watch", "rating", "watchlist", "favorite", "list_item"]);
  const [keepRatings, setKeepRatings] = useState(true);
  const [choosing, setChoosing] = useState<RowView | null>(null);
  const job = useQuery({
    queryKey: ["import", jobId],
    queryFn: () => api<JobView>(`/api/imports/${jobId}`),
    refetchInterval: (q) => (["matching", "parsing", "applying", "uploaded"].includes(q.state.data?.status ?? "") ? (q.state.data?.stalled ? 10_000 : 1500) : false),
  });
  const j = job.data;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["import", jobId] });
    void qc.invalidateQueries({ queryKey: ["import-rows", jobId] });
  };
  const count = (s: RowStatus) => {
    if (!j) return 0;
    const st = j.stats;
    const restricted = st.restricted ?? 0;
    const known = st.matched + st.ambiguous + st.unmatched + st.duplicates + st.applied + restricted;
    return { matched: st.matched, ambiguous: st.ambiguous, unmatched: st.unmatched, duplicate: st.duplicates, applied: st.applied, restricted, skipped: Math.max(0, st.rows - known) }[s];
  };
  // The open filter: the one chosen, else the first that needs the person — the choices, then what was found.
  const chips = j ? STATUSES.filter((s) => count(s) > 0 && (s !== "applied" || j.status === "done")) : [];
  const effective = filter && chips.includes(filter) ? filter : j?.status === "done" && chips.includes("applied") ? "applied" : (chips[0] ?? null);
  const rows = useQuery({
    queryKey: ["import-rows", jobId, effective, j?.status],
    queryFn: () => api<{ rows: RowView[] }>(`/api/imports/${jobId}/rows?status=${effective}`),
    enabled: Boolean(j && effective && !["matching", "parsing", "uploaded"].includes(j.status)),
  });

  const resolve = useAction({
    run: (rowIds: string[], action: "accept" | "skip" | "choose", titleId?: string, group?: boolean) =>
      api(`/api/imports/${jobId}/resolve`, { method: "POST", json: { rowIds, action, titleId, group } }),
    sync: refresh,
  });
  // Continues from the step the import stopped at, or starts a stalled step again; the progress shows up in place.
  const retry = useAction({ run: () => api(`/api/imports/${jobId}/retry`, { method: "POST" }), sync: refresh });
  const applyAll = useAction({
    run: () => api(`/api/imports/${jobId}/apply`, { method: "POST", json: { includeKinds: kinds, keepExistingRatings: keepRatings } }),
    sync: refresh,
  });
  // Takes back everything the import added: asked first with what it removes, the request runs in the dialog (IMP-06).
  const rollback = async () => {
    if (!j) return;
    const ok = await confirm({
      title: t("rollbackConfirm"),
      text: t("rollbackText", { count: j.stats.applied, profile: j.profileName }),
      confirmLabel: t("rollback"),
      action: () => api(`/api/imports/${jobId}/rollback`, { method: "POST" }),
    });
    if (!ok) return;
    toast.success(t("rolledBack"));
    refresh();
  };
  // Stops an import before anything is in the profile (IMP-03), or removes a finished one from the list.
  const remove = async (running: boolean) => {
    const ok = await confirm({
      ...(running
        ? { title: t("cancelTitle"), text: t("cancelText"), confirmLabel: t("cancelImport") }
        : { title: t("deleteTitle"), text: j?.status === "done" ? t("deleteTextDone") : t("deleteText"), confirmLabel: t("deleteImport") }),
      action: () => api(`/api/imports/${jobId}`, { method: "DELETE" }),
    });
    if (!ok) return;
    toast.success(running ? t("cancelled") : t("deleted"));
    void qc.invalidateQueries({ queryKey: ["imports"] });
    router.push("/import");
  };

  // "← Import history" over the import's own h1: the way back to the list (8.7, IMP-04).
  const back = { href: "/import", label: t("title") };
  // A failed load is said with Retry, never an endless skeleton (X-14).
  if (!j) {
    return job.isError ? (
      <>
        <PageHeader back={back} title={t("jobTitleUnknown")} />
        <ErrorState error={job.error} onRetry={() => void job.refetch()} retrying={job.isFetching} />
      </>
    ) : (
      <>
        <PageHeader
          back={back}
          title={
            <>
              <span className="sr-only">{t("jobTitleUnknown")}</span>
              <Skeleton shape="sm" className="h-10 w-72 max-w-full" />
            </>
          }
        />
        <Skeleton shape="md" className="h-64 w-full" />
      </>
    );
  }

  const running = ["matching", "parsing", "uploaded"].includes(j.status);
  const applying = j.status === "applying";
  const progress = j.progress?.total ? (j.progress.done / j.progress.total) * 100 : null;
  const failedStep = j.status === "failed" ? (j.error === "apply_failed" ? "save" : "match") : null;
  const stepState = (id: "read" | "match" | "review" | "save"): Step["state"] => {
    const order = ["read", "match", "review", "save"] as const;
    const at = running ? 1 : applying ? 3 : j.status === "review" ? 2 : failedStep === "match" ? 1 : failedStep === "save" ? 3 : 4;
    const i = order.indexOf(id);
    if (i < at) return "done";
    if (i > at) return "pending";
    return failedStep || j.stalled ? "error" : "current";
  };
  const detail = (id: "match" | "save") => {
    if (j.stalled && ((id === "match" && running) || (id === "save" && applying))) return t("stalledDetail");
    if (id === "match" && failedStep === "match") return t("failedMatch");
    if (id === "save" && failedStep === "save") return t("failedApply");
    if (id === "match" && running) return t("matchingCount", { done: j.progress?.done ?? 0, total: j.progress?.total || j.stats.rows });
    return undefined;
  };
  const showSteps = running || applying || j.status === "failed";
  const restrictedTitles = j.stats.restrictedTitles ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        // Its own distance to the content (9), not the list's extra 24.
        className="pb-0 sm:pb-0"
        back={back}
        title={t("jobTitle", { source: LABEL[j.source] })}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <JobStatus job={j} />
            <span>
              <JobName job={j} /> · {j.profileName} · {shortDate(j.createdAt, locale)}
            </span>
          </span>
        }
        actions={
          !running &&
          j.canDelete && (
            <Menu label={t("jobMenu")} title={t("jobTitle", { source: LABEL[j.source] })} trigger={<IconButton icon={Ellipsis} variant="secondary" label={t("jobMenu")} />}>
              <MenuItem icon={Trash2} tone="danger" onSelect={() => void remove(false)}>
                {t("deleteImport")}
              </MenuItem>
            </Menu>
          )
        }
      />

      {showSteps && (
        <section className="rounded-md border border-line bg-surface-1 p-4 md:p-6" aria-label={t("stepsLabel")}>
          <Steps
            label={t("stepsLabel")}
            progress={running && !j.stalled ? progress : undefined}
            steps={[
              { id: "read", label: t("stepRead"), state: stepState("read") },
              { id: "match", label: t("stepMatch"), state: stepState("match"), detail: detail("match") },
              { id: "review", label: t("stepReview"), state: stepState("review") },
              { id: "save", label: t("stepSave"), state: stepState("save"), detail: detail("save") },
            ]}
            action={
              <>
                {j.canRetry && (
                  <Button icon={RotateCcw} loading={retry.pending} onClick={() => void retry.run()}>
                    {tc("retry")}
                  </Button>
                )}
                {running && (
                  <Button variant="secondary" icon={X} onClick={() => void remove(true)}>
                    {t("cancelImport")}
                  </Button>
                )}
              </>
            }
          />
        </section>
      )}
      {j.status === "done" && (
        <InlineAlert
          tone="success"
          title={t("done")}
          action={
            <Button variant="tertiary" size="sm" icon={Undo2} onClick={() => void rollback()}>
              {t("rollback")}
            </Button>
          }
        >
          {t("report", { applied: j.stats.applied, skipped: count("skipped") + j.stats.duplicates, unmatched: j.stats.unmatched })}
          {restrictedTitles > 0 && <span className="block">{t("restrictedReport", { count: restrictedTitles, profile: j.profileName })}</span>}
        </InlineAlert>
      )}
      {j.status === "rolled_back" && <InlineAlert tone="info" title={t("rolledBackTitle")}>{t("rolledBackText")}</InlineAlert>}
      {j.status === "review" && restrictedTitles > 0 && (
        <InlineAlert tone="warning" title={t("restrictedTitle", { count: restrictedTitles })}>
          {t("restrictedText", { profile: j.profileName })}
        </InlineAlert>
      )}

      {j.status === "review" && (
        // What goes into the profile, decided before the rows (they are what is checked): kinds and the ratings rule.
        <section aria-labelledby="kinds-h" className="flex flex-col gap-3">
          <h2 id="kinds-h" className="text-h3 text-text-1">
            {t("includeKinds")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {(["watch", "rating", "watchlist", "favorite", "list_item"] as const)
              .filter((k) => (j.stats.byKind[k] ?? 0) > 0)
              .map((k) => {
                const on = kinds.includes(k);
                return (
                  <FilterChip key={k} selected={on} count={j.stats.byKind[k]} onClick={() => setKinds(on ? kinds.filter((x) => x !== k) : [...kinds, k])}>
                    {t(`kind_${k}`)}
                  </FilterChip>
                );
              })}
          </div>
          <Switch checked={keepRatings} onCheckedChange={setKeepRatings} label={t("keepRatings")} className="max-w-xl" />
        </section>
      )}

      {!running && chips.length > 0 && (
        <>
          {/* Under "What to import" the rows have a heading of their own: two rows of chips read as one otherwise. */}
          {j.status === "review" && <h2 className="-mb-3 text-h3 text-text-1">{t("rowsFilter")}</h2>}
          {/* A fieldset names the chips as one group; min-w-0, or a fieldset grows to its content and the row can't scroll. */}
          <fieldset className="scroll-row -mx-(--gutter) flex min-w-0 gap-2 overflow-x-auto px-(--gutter)" aria-label={t("rowsFilter")}>
            {chips.map((s) => (
              <FilterChip key={s} selected={effective === s} count={count(s)} onClick={() => setFilter(s)}>
                {t(`rows_${s}`)}
              </FilterChip>
            ))}
          </fieldset>
          <QueryState
            query={rows}
            loading={<Skeleton shape="md" className="h-40 w-full" />}
            isEmpty={(d) => d.rows.length === 0}
            empty={<EmptyState icon={Search} title={t("rowsEmpty")} />}
          >
            {(d) => (
              <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface-1">
                {d.rows.map((r) => (
                  <ImportRowItem
                    key={r.id}
                    row={r}
                    editable={j.status === "review"}
                    onResolve={(ids, a, titleId, group) => void resolve.run(ids, a, titleId, group)}
                    onChoose={() => setChoosing(r)}
                  />
                ))}
              </ul>
            )}
          </QueryState>
        </>
      )}

      {j.status === "review" && (
        // Only the button stays at hand while the rows scroll: on a phone the whole panel took a third of the screen
        // over the rows it was about (2026-11-07). A floating pill over the content, above the phone's tab bar.
        <div className="pointer-events-none sticky bottom-24 z-sticky flex md:bottom-6">
          <Button
            size="lg"
            className="pointer-events-auto shadow-float"
            disabled={kinds.length === 0 || j.stats.matched === 0}
            loading={applyAll.pending}
            onClick={() => void applyAll.run()}
          >
            {t("apply", { count: j.stats.matched })}
          </Button>
        </div>
      )}
      {choosing && (
        <ChooseTitle
          row={choosing}
          onClose={() => setChoosing(null)}
          onPick={(titleId) => {
            void resolve.run([choosing.id], "choose", titleId);
            setChoosing(null);
          }}
        />
      )}
    </div>
  );
}

function ImportRowItem({
  row: r,
  editable,
  onResolve,
  onChoose,
}: {
  row: RowView;
  editable: boolean;
  onResolve: (ids: string[], a: "accept" | "skip" | "choose", titleId?: string, group?: boolean) => void;
  onChoose: () => void;
}) {
  const t = useTranslations("import");
  const tc = useTranslations("common");
  const tcard = useTranslations("card");
  const locale = useLocale();
  // Simkl's TheTVDB numbering that TMDB's seasons don't confirm: the choice covers the whole title.
  const tvdb = r.sourceIds?.coords === "tvdb" && r.status === "ambiguous";
  // The episode as 2.3 writes it, "1 сезон · 4 серия" (IMP-07).
  const episode = r.season !== null ? (r.episode !== null ? tcard("episode", { season: r.season, episode: r.episode }) : t("seasonOnly", { season: r.season })) : null;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
      <div className="min-w-0 flex-1 basis-60">
        <p className="text-title text-text-1">
          {r.sourceTitle}
          {r.sourceYear ? ` (${r.sourceYear})` : ""}
        </p>
        <p className="text-body-s text-text-2">
          {[t(`kind_${r.kind}` as "kind_watch"), episode, r.watchedAt && formatDate(r.watchedAt, locale), r.rating !== null && `${r.rating}/10`, r.listName].filter(Boolean).join(" · ")}
        </p>
        {tvdb && (
          <p className="mt-1 flex gap-1.5 text-body-s text-text-2">
            <TriangleAlert aria-hidden className="size-4 shrink-0 text-warning" />
            {t("tvdbNumbering")}
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-1 basis-60 items-center gap-3">
        {r.match ? (
          <>
            <img src={tmdbImage(r.match.posterPath, "w92") ?? undefined} alt="" className="h-12 w-8 shrink-0 rounded-xs bg-surface-2 object-cover" />
            <span className="min-w-0 text-body text-text-1">
              {r.match.title} {r.match.year ? `(${r.match.year})` : ""}
            </span>
          </>
        ) : r.candidates.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {r.candidates.slice(0, 3).map((c) => {
              // Three "Flow (2024)" can't be told apart by name: each choice shows its poster and whether it is a film
              // or a series.
              const name = [`${c.title}${c.year ? ` (${c.year})` : ""}`, c.kind === "tv" ? tc("series") : tc("movie")].join(" · ");
              return (
                <Button
                  key={c.id}
                  variant="secondary"
                  disabled={!editable}
                  onClick={() => onResolve([r.id], "choose", c.id, tvdb)}
                  // TheTVDB numbering: the choice is for every episode of the title, as the line above says.
                  aria-label={tvdb ? `${name} — ${t("useForAll")}` : name}
                >
                  {c.posterPath ? (
                    <img src={tmdbImage(c.posterPath, "w92") ?? undefined} alt="" className="-ms-2 h-7 w-5 shrink-0 rounded-xs bg-surface-3 object-cover" />
                  ) : (
                    <span aria-hidden className="-ms-2 h-7 w-5 shrink-0 rounded-xs bg-surface-3" />
                  )}
                  {name}
                </Button>
              );
            })}
          </div>
        ) : (
          <span className="text-body-s text-text-2">{r.status === "restricted" ? t("rows_restricted") : t("unmatched")}</span>
        )}
      </div>
      {editable && r.status !== "restricted" && (
        <div className="flex gap-1">
          <IconButton icon={Search} size="sm" label={t("searchMatchFor", { title: r.sourceTitle })} onClick={onChoose} />
          {r.status === "matched" || r.status === "ambiguous" ? (
            <Button variant="tertiary" size="sm" onClick={() => onResolve([r.id], "skip", undefined, tvdb)}>
              {t("skip")}
            </Button>
          ) : r.status === "skipped" || r.status === "duplicate" ? (
            <Button variant="tertiary" size="sm" icon={RotateCcw} onClick={() => onResolve([r.id], "accept")} disabled={!r.match}>
              {t("accept")}
            </Button>
          ) : null}
        </div>
      )}
    </li>
  );
}

function ChooseTitle({ row, onClose, onPick }: { row: RowView; onClose: () => void; onPick: (titleId: string) => void }) {
  const t = useTranslations("import");
  const tc = useTranslations("common");
  const ts = useTranslations("search");
  const [q, setQ] = useState(row.sourceTitle);
  const [query, setQuery] = useState(row.sourceTitle);
  const res = useQuery({ queryKey: ["search", query], queryFn: () => api<{ titles: { results: TitleSummary[] } }>(`/api/catalog/search?q=${encodeURIComponent(query)}`), enabled: query.length > 0 });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t("searchMatch")} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
        className="mb-4 flex gap-2"
      >
        <SearchInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("searchMatch")} maxLength={200} className="min-w-0 flex-1" />
        <Button type="submit" disabled={!q.trim()}>
          {tc("search")}
        </Button>
      </form>
      <QueryState
        query={res}
        loading={<Skeleton shape="sm" className="h-40 w-full" />}
        isEmpty={(d) => d.titles.results.length === 0}
        empty={<EmptyState icon={Search} title={ts("noResults", { q: query })} />}
      >
        {(d) => (
          <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto">
            {d.titles.results.slice(0, 12).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <img src={tmdbImage(r.posterPath, "w92") ?? undefined} alt="" className="h-14 w-10 shrink-0 rounded-xs bg-surface-2 object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block text-title text-text-1">{r.title}</span>
                  <span className="block text-body-s text-text-2">{[r.year, r.kind === "movie" ? tc("movie") : tc("series")].filter(Boolean).join(" · ")}</span>
                </span>
                <Button variant="secondary" size="sm" onClick={() => onPick(r.id)} aria-label={t("chooseThis", { title: r.title })}>
                  {t("choose")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </Dialog>
  );
}
