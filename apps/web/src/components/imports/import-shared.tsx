import type { ImportJob, ImportSource } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import { type Status, StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";

/** "23 окт." this year, "23 окт. 2025 г." before (2.3). */
export const shortDate = (iso: string, locale: string) =>
  formatDate(iso, locale, { day: "numeric", month: "short", ...(iso.startsWith(String(new Date().getFullYear())) ? {} : { year: "numeric" }) });

export const LABEL: Record<ImportSource, string> = {
  trakt: "Trakt",
  letterboxd: "Letterboxd",
  imdb: "IMDb",
  simkl: "Simkl",
  netflix: "Netflix",
  lampa: "Lampa / CUB",
  stremio: "Stremio",
  lumovio: "Lumovio",
  jellyfin: "Jellyfin",
  plex: "Plex",
};

/** The file name for an upload; Trakt/Simkl imports are named by what started them (IMP-02). */
export function JobName({ job }: { job: ImportJob }) {
  const t = useTranslations("import");
  if (job.origin === "sync") return t("originSync", { source: LABEL[job.source] });
  if (job.origin === "account") return t("originAccount", { source: LABEL[job.source] });
  // Read from the person's own server: the file is this device's, not one they chose.
  if (job.source === "jellyfin" || job.source === "plex") return t("originServer", { source: LABEL[job.source] });
  return job.fileName ?? LABEL[job.source];
}

const JOB_STATUS: Partial<Record<ImportJob["status"], Status>> = { done: "success", failed: "danger", review: "warning" };

/** The state of an import: a dot in the status colour and the word (7.4); a step nothing works on — "Stopped". */
export function JobStatus({ job }: { job: ImportJob }) {
  const t = useTranslations("import");
  if (job.stalled) return <StatusBadge status="warning">{t("status_stalled")}</StatusBadge>;
  return <StatusBadge status={JOB_STATUS[job.status] ?? "neutral"}>{t(`status_${job.status}`)}</StatusBadge>;
}
