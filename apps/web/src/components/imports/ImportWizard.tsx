"use client";

import type { ImportJob, ImportSource, ImportSourceInfo } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { lazy, Suspense } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link as IntlLink } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { JobName, JobStatus, LABEL, shortDate, SourceLogo } from "./import-shared";

// An import's own page (its steps, rows and dialogs) and a source's window load only when they open (bundle budget).
const JobReview = lazy(() => import("./ImportJob").then((m) => ({ default: m.JobReview })));
const SourceDialog = lazy(() => import("./SourceDialog").then((m) => ({ default: m.SourceDialog })));

/**
 * Import history (the Tool template). The sources as tiles — the service's mark and its
 * name, nothing technical; a tile opens the source's window over the page (Dialog, a sheet on a phone): sign in to
 * Trakt or Simkl to keep in sync, or the export's page, the profile and "Choose file" — what to do is on the screen
 * where it is tapped, not under ten tiles. The source is in the address (`?source=`, replaced: Back leaves the page,
 * the window closes by its ×). An import has its own page (`?job=`). Past imports with their state in words.
 */
export function ImportWizard() {
  const t = useTranslations("import");
  const locale = useLocale();
  const params = useSearchParams();
  // An import has its own address, so Back returns to the list; Trakt/Simkl settings link straight to one.
  const jobId = params.get("job");
  const sources = useQuery({ queryKey: ["import-sources"], queryFn: () => api<{ sources: ImportSourceInfo[] }>("/api/imports/sources") });
  const history = useQuery({ queryKey: ["imports"], queryFn: () => api<{ jobs: ImportJob[] }>("/api/imports") });
  const chosen = sources.data?.sources.find((s) => s.source === params.get("source")) ?? null;
  // The window opens at once, without a server round trip: the address follows by replaceState.
  const choose = (source: ImportSource | null) => window.history.replaceState(null, "", `${window.location.pathname}${source ? `?source=${source}` : ""}`);

  if (jobId) {
    return (
      <Suspense fallback={<Skeleton shape="md" className="mt-8 h-64 w-full" />}>
        <JobReview jobId={jobId} />
      </Suspense>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="sources-h">
        <h2 id="sources-h" className="sr-only">
          {t("chooseSource")}
        </h2>
        <QueryState
          query={sources}
          error={{ title: t("sourcesError") }}
          loading={
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
              {Array.from({ length: 10 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder tiles
                <Skeleton key={i} shape="md" className="h-16 w-full" />
              ))}
            </div>
          }
        >
          {(d) => (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
              {d.sources.map((s) => (
                <li key={s.source}>
                  <IntlLink
                    href={`/import?source=${s.source}`}
                    replace
                    scroll={false}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      choose(s.source);
                    }}
                    aria-haspopup="dialog"
                    className="flex h-full min-h-16 items-center gap-3 rounded-md border border-line bg-surface-1 p-3 transition-colors duration-fast ease-fast hover:border-line-2 hover:bg-surface-2"
                  >
                    <SourceLogo source={s.source} />
                    <span className="min-w-0 text-title text-text-1">{LABEL[s.source]}</span>
                  </IntlLink>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </section>
      {chosen && (
        <Suspense>
          <SourceDialog key={chosen.source} info={chosen} onClose={() => choose(null)} />
        </Suspense>
      )}
      {(history.data?.jobs.length ?? 0) > 0 && (
        <section aria-labelledby="past-h">
          <h2 id="past-h" className="mb-2 text-h2 text-text-1 md:mb-3">
            {t("history")}
          </h2>
          <ul className="flex flex-col gap-1">
            {history.data!.jobs.map((j) => (
              <li key={j.id}>
                <IntlLink
                  href={`/import?job=${j.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-sm px-2 py-2 transition-colors duration-fast ease-fast hover:bg-surface-1 md:gap-4"
                >
                  <SourceLogo source={j.source} />
                  {/* Wraps on a phone rather than cutting the profile's name. */}
                  <span className="min-w-0 flex-1">
                    <span className="block text-title text-text-1 wrap-anywhere">
                      <JobName job={j} />
                    </span>
                    <span className="block text-body-s text-text-2">{[LABEL[j.source], j.profileName, shortDate(j.createdAt, locale)].filter(Boolean).join(" · ")}</span>
                  </span>
                  <JobStatus job={j} />
                </IntlLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
