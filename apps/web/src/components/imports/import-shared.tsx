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

/**
 * Each source's official mark (IMP-10; trademarks of their owners, credited on the Credits page). An app icon with its
 * own square (Trakt, Simkl, Lampa, Plex) fills the tile; the others sit in it at 24 px. Decorative: the name is written next to it.
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

/** The source's mark in its 40 tile (`--surface-2`, radius sm): the source grid and past imports. */
export function SourceLogo({ source }: { source: ImportSource }) {
  const logo = LOGO[source];
  return (
    <span aria-hidden className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-sm bg-surface-2">
      <img src={logo.src} alt="" draggable={false} className={logo.fill ? "size-full object-cover" : "max-h-6 max-w-8 object-contain"} />
    </span>
  );
}

/**
 * Where each service hands out its export (public pages; the person signs in there). Simkl, Lampa and Stremio have no
 * page of their own for it — their path is in the window's line; Lumovio's own copy is on Privacy and data.
 */
export const EXPORT_PAGE: Partial<Record<ImportSource, string>> = {
  trakt: "https://app.trakt.tv/settings/data",
  letterboxd: "https://letterboxd.com/settings/data/",
  imdb: "https://www.imdb.com/list/ratings",
  netflix: "https://www.netflix.com/settings/viewing-history",
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
