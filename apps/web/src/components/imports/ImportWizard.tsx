"use client";

import type { ImportJob, ImportSource, ImportSourceInfo } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { FileUp } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { lazy, Suspense, useRef, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Link } from "@/components/ui/Link";
import { QueryState } from "@/components/ui/QueryState";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { Link as IntlLink, useRouter } from "@/i18n/navigation";
import { ApiRequestError, api, handle } from "@/lib/api";
import { importUploadErrorKey } from "@/lib/api-errors";
import { JobName, JobStatus, LABEL, shortDate } from "./import-shared";
import { ServerHistoryRead } from "./ServerHistoryRead";

/**
 * Each source's official mark (IMP-10; trademarks of their owners, credited on the Credits page). An app icon with its
 * own square (Trakt, Simkl, Lampa) fills the tile; the others sit in it at 24 px. Decorative: the name is written next to it.
 */
const LOGO: Record<ImportSource, { src: string; fill?: boolean }> = {
  trakt: { src: "/brands/trakt.svg", fill: true },
  simkl: { src: "/brands/simkl.png", fill: true },
  imdb: { src: "/brands/imdb.svg" },
  letterboxd: { src: "/brands/letterboxd-dots.svg" },
  netflix: { src: "/brands/netflix.svg" },
  lampa: { src: "/brands/lampa.png", fill: true },
  stremio: { src: "/brands/stremio.svg" },
  lumovio: { src: "/brand/mark.svg" },
  jellyfin: { src: "/brands/jellyfin.svg" },
  plex: { src: "/brands/plex.png", fill: true },
};
/** Sources that can also be connected by signing in (settings → Trakt and Simkl): then they keep in sync. */
const ACCOUNT: ImportSource[] = ["trakt", "simkl"];

// An import's own page (its steps, rows and dialogs) loads only there (bundle budget).
const JobReview = lazy(() => import("./ImportJob").then((m) => ({ default: m.JobReview })));

/**
 * Import history (S13, Tool template; IMP-01…IMP-07). The sources as cards with their logo and how they come in
 * ("File", "or sign in to the service"); a chosen source is in the address (`?source=`), so Back undoes the choice.
 * An import has its own page (`?job=`) with its steps on Steps. Past imports with their state in words.
 */
export function ImportWizard() {
  const t = useTranslations("import");
  const locale = useLocale();
  const { me } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  // An import has its own address (IMP-04), so Back returns to the list; Trakt/Simkl settings link straight to one.
  const jobId = params.get("job");
  const sources = useQuery({ queryKey: ["import-sources"], queryFn: () => api<{ sources: ImportSourceInfo[] }>("/api/imports/sources") });
  const history = useQuery({ queryKey: ["imports"], queryFn: () => api<{ jobs: ImportJob[] }>("/api/imports") });
  const chosen = sources.data?.sources.find((s) => s.source === params.get("source")) ?? null;

  if (jobId) {
    return (
      <Suspense fallback={<Skeleton shape="md" className="mt-8 h-64 w-full" />}>
        <JobReview jobId={jobId} />
      </Suspense>
    );
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="sources-h">
        {/* Sections of the page in the type scale (4.2), not grey captions (X-25). */}
        <h2 id="sources-h" className="mb-3 text-h2 text-text-1 md:mb-4">
          {t("chooseSource")}
        </h2>
        <QueryState
          query={sources}
          loading={
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder tiles
                <Skeleton key={i} shape="md" className="h-20 w-full" />
              ))}
            </div>
          }
        >
          {(d) => (
            <>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {d.sources.map((s) => (
                  <li key={s.source}>
                    <SourceCard info={s} selected={chosen?.source === s.source} />
                  </li>
                ))}
              </ul>
              <p className="mt-4 max-w-measure text-body-s text-text-2">
                {t("accountHint")}{" "}
                <Link href="/settings/services">{t("accountHintLink")}</Link>
              </p>
            </>
          )}
        </QueryState>
      </section>
      {chosen && me && (
        <Upload
          key={chosen.source}
          source={chosen.source}
          info={chosen}
          profiles={me.profiles}
          onStarted={(id) => router.push(`/import?job=${id}`)}
        />
      )}
      {(history.data?.jobs.length ?? 0) > 0 && (
        <section aria-labelledby="past-h">
          <h2 id="past-h" className="mb-3 text-h2 text-text-1 md:mb-4">
            {t("history")}
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface-1">
            {history.data!.jobs.map((j) => (
              <li key={j.id}>
                <IntlLink href={`/import?job=${j.id}`} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-start transition-colors duration-fast ease-fast hover:bg-surface-2">
                  <span className="min-w-0 flex-1 basis-56">
                    <span className="block text-title text-text-1">
                      <JobName job={j} />
                    </span>
                    {/* Wraps on a phone rather than cutting the profile's name (IMP-07). */}
                    <span className="block text-body-s text-text-2">
                      {[LABEL[j.source], j.profileName, shortDate(j.createdAt, locale)].filter(Boolean).join(" · ")}
                    </span>
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

/** A source to import from: its logo, its name and how it comes in; the card is a link that picks it. */
function SourceCard({ info: s, selected }: { info: ImportSourceInfo; selected: boolean }) {
  const t = useTranslations("import");
  const logo = LOGO[s.source];
  return (
    <IntlLink
      href={`/import?source=${s.source}`}
      replace
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={clsx(
        "flex h-full items-center gap-3 rounded-md border p-3 transition-colors duration-fast ease-fast",
        selected ? "border-text-1 bg-surface-2" : "border-line bg-surface-1 hover:border-line-2 hover:bg-surface-2",
      )}
    >
      <span aria-hidden className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-sm bg-surface-2">
        <img src={logo.src} alt="" draggable={false} className={logo.fill ? "size-full object-cover" : "max-h-6 max-w-8 object-contain"} />
      </span>
      <span className="min-w-0">
        <span className="block text-title text-text-1">{LABEL[s.source]}</span>
        <span className="block text-body-s text-text-2">
          {s.method === "server" ? t("methodServer") : t("methodFile", { types: s.accept.join(", ") })}
          {ACCOUNT.includes(s.source) && ` · ${t("methodAccount")}`}
        </span>
      </span>
    </IntlLink>
  );
}

function Upload({ source, info, profiles, onStarted }: { source: ImportSource; info: ImportSourceInfo; profiles: { id: string; name: string; isKids: boolean }[]; onStarted: (id: string) => void }) {
  const t = useTranslations("import");
  const tr = useTranslations();
  const { me } = useSession();
  // Adults first; a kids profile is never the default target (IMP-05).
  const ordered = [...profiles.filter((p) => !p.isKids), ...profiles.filter((p) => p.isKids)];
  const [profileId, setProfileId] = useState(me?.activeProfile && !me.activeProfile.isKids ? me.activeProfile.id : (ordered[0]?.id ?? ""));
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const target = profiles.find((p) => p.id === profileId);

  const upload = async (file: File) => {
    // Only the files the source exports (IMP-05): a .txt is refused here, in words, before any upload.
    const ext = /\.[a-z0-9]+$/i.exec(file.name)?.[0]?.toLowerCase() ?? "";
    if (!info.accept.includes(ext)) {
      toast.error(t("errWrongType", { source: LABEL[source], types: info.accept.join(", ") }));
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("source", source);
    fd.set("profileId", profileId);
    fd.set("file", file);
    try {
      // The server names what's wrong with a refused file; the toast says it in the person's language.
      const res = await fetch("/api/imports", { method: "POST", body: fd, credentials: "same-origin" }).catch(() => {
        throw new ApiRequestError(0, "network", "Network error");
      });
      const job = await handle<ImportJob>(res);
      onStarted(job.id);
    } catch (e) {
      toast.error(tr(importUploadErrorKey(e), { source: LABEL[source] }));
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="upload-h" className="space-y-5 rounded-md border border-line bg-surface-1 p-4 md:p-6">
      <div>
        <h2 id="upload-h" className="text-h3 text-text-1">
          {t("uploadFrom", { source: LABEL[source] })}
        </h2>
        <p className="mt-1 max-w-measure text-body-s text-text-2">
          <span className="font-semibold text-text-1">{info.method === "server" ? t("whatItReads") : t("howToExport")}: </span>
          {t(info.helpKey.replace("import.", "") as "help_trakt")}
        </p>
      </div>
      <Field label={t("toProfile")} hint={t("sharedImports")} className="max-w-sm">
        {(id, describedBy) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            value={profileId}
            onValueChange={setProfileId}
            options={ordered.map((p) => ({ value: p.id, label: p.isKids ? t("kidsProfile", { name: p.name }) : p.name }))}
          />
        )}
      </Field>
      {target?.isKids && (
        <InlineAlert tone="warning" title={t("kidsTargetTitle", { name: target.name })}>
          {t("kidsTargetText")}
        </InlineAlert>
      )}
      {info.method === "server" && (source === "jellyfin" || source === "plex") ? (
        <ServerHistoryRead source={source} busy={busy} onFile={(f) => void upload(f)} />
      ) : (
        <>
      {/* The drop area takes a dropped file; "Choose file" opens the picker (one control, no clickable tile). */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f && !busy) void upload(f);
        }}
        className={clsx(
          "flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors duration-fast ease-fast",
          drag ? "border-text-1 bg-surface-2" : "border-line-2",
        )}
      >
        <FileUp aria-hidden className="size-8 text-text-2" />
        <p className="text-body text-text-1">{busy ? t("parsing") : t("dropHere")}</p>
        <Button icon={FileUp} loading={busy} onClick={() => input.current?.click()}>
          {t("chooseFile")}
        </Button>
        <p className="text-body-s text-text-2">{t("acceptedTypes", { types: info.accept.join(", ") })}</p>
      </div>
      <input
        ref={input}
        type="file"
        accept={info.accept.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // Cleared, so the same file can be chosen again after a refused or failed upload.
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
        </>
      )}
    </section>
  );
}
