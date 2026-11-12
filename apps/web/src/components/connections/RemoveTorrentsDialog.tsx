"use client";

import type { ConnectionSummary, ConnectionTorrentIndex } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { ApiRequestError } from "@/lib/api";
import { apiErrorKey } from "@/lib/api-errors";
import { formatSize } from "@/components/sources/release-text";
import { forgetTorrents, invalidateAvailability, type ManagedTorrent, type RemovalResult, removalScope, removeTorrents } from "@/lib/media/torrent-manage";
import { titleHref } from "@/lib/slug";
import { netErrorText } from "./net-errors";

type Titles = ConnectionTorrentIndex["titles"];
export type TorrentConnection = Pick<ConnectionSummary, "id" | "name" | "baseUrl" | "profileIds">;

/** "1–3, 5" */
export function ranges(nums: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < nums.length; i++) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j]! + 1) j++;
    out.push(j > i ? `${nums[i]}–${nums[j]}` : `${nums[i]}`);
    i = j;
  }
  return out.join(", ");
}

const TITLE_ID = /^(movie|tv):(\d+)$/;

/**
 * What a torrent is linked to in Lumovio, per title: its name ("Dune (2021)"), its page, and the scope — "Film", or
 * "Season 2: episodes 1–3 · 3 episodes" for a pack's files bound to episodes.
 */
export function useLinks() {
  const t = useTranslations("torrentManager");
  return (torrent: Pick<ManagedTorrent, "links">, titles: Titles): { titleId: string; title: string; href: string | null; scope: string | null }[] =>
    removalScope(torrent).titles.map((id) => {
      const info = titles[id];
      const name = info ? `${info.title}${info.year ? ` (${info.year})` : ""}` : id;
      const ref = TITLE_ID.exec(id);
      const href = ref && info ? titleHref(ref[1] as "movie" | "tv", Number(ref[2]), info.title) : null;
      if (id.startsWith("movie:")) return { titleId: id, title: name, href, scope: t("film") };
      const eps = torrent.links.filter((l) => l.titleId === id && l.season !== null && l.episode !== null);
      if (eps.length === 0) return { titleId: id, title: name, href, scope: null };
      const seasons = [...new Set(eps.map((l) => l.season!))].sort((a, b) => a - b);
      const parts = seasons.map((s) => t("season", { season: s, episodes: ranges([...new Set(eps.filter((l) => l.season === s).map((l) => l.episode!))].sort((a, b) => a - b)) }));
      return { titleId: id, title: name, href, scope: [...parts, t("episodes", { count: new Set(eps.map((l) => `${l.season}:${l.episode}`)).size })].join(" · ") };
    });
}

/** What a torrent is linked to in Lumovio, a line per title: "Dune (2021) · Film", "Show · Season 2: episodes 1–3 · 3 episodes". */
export function useLinkLines() {
  const links = useLinks();
  return (torrent: Pick<ManagedTorrent, "links">, titles: Titles): string[] => links(torrent, titles).map((l) => [l.title, l.scope].filter(Boolean).join(" · "));
}

const sentence = (s: string) => (/[.!?…)]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

/**
 * Confirms and runs a removal from one TorrServer: names the server, every torrent and what it takes
 * away (a season pack: all its episodes), who else uses the server and what is active there. Cancel
 * changes nothing. Afterwards one result per torrent, with a retry when only Lumovio's links are left.
 */
export function RemoveTorrentsDialog({
  connection,
  torrents,
  titles,
  onClose,
}: {
  connection: TorrentConnection;
  torrents: ManagedTorrent[];
  titles: Titles;
  /** Results when something was attempted, null when cancelled. */
  onClose: (results: RemovalResult[] | null) => void;
}) {
  const t = useTranslations("torrentManager");
  const tc = useTranslations("connections");
  const tr = useTranslations();
  const locale = useLocale();
  const formatBytes = (n: number | null) => formatSize(n, locale);
  const { me } = useSession();
  const qc = useQueryClient();
  const linkLines = useLinkLines();
  const [phase, setPhase] = useState<"confirm" | "running" | "done">("confirm");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<RemovalResult[]>([]);
  const [retrying, setRetrying] = useState(false);

  // Never the error's own text (X-15): Lumovio's API errors by their code, the server's by netErrorText.
  const errorText = (e: unknown) => sentence(e instanceof ApiRequestError ? tr(apiErrorKey(e)) : netErrorText(tc, e));
  const size = torrents.reduce((s, x) => s + (x.sizeBytes ?? 0), 0);
  const packs = torrents.some((x) => removalScope(x).episodes > 1);
  const active = torrents.filter((x) => x.active).length;
  // The person's own releases (no mark of Lumovio's): removing them is their call, said as a risk (finding 29).
  const outside = torrents.filter((x) => !x.fromLumovio).length;
  const users = (me?.profiles ?? []).filter((p) => (connection.profileIds.length === 0 ? !p.isKids : connection.profileIds.includes(p.id)));
  const others = users.filter((p) => p.id !== me?.activeProfile?.id);

  const run = async () => {
    setPhase("running");
    let out: RemovalResult[];
    try {
      out = await removeTorrents(connection.id, torrents.map((x) => x.hash), (done, total) => setProgress({ done, total }));
    } catch (e) {
      // Credentials couldn't be had: nothing was sent.
      out = torrents.map((x) => ({ hash: x.hash, status: "unknown", links: 0, error: e }));
    }
    setResults(out);
    setPhase("done");
    if (out.some((r) => r.status === "removed" || r.status === "index_pending")) invalidateAvailability(qc);
  };

  const retryIndex = async () => {
    setRetrying(true);
    const pending = results.filter((r) => r.status === "index_pending").map((r) => r.hash);
    const again = await forgetTorrents(connection.id, pending);
    setResults((rs) => rs.map((r) => again.find((a) => a.hash === r.hash) ?? r));
    setRetrying(false);
    invalidateAvailability(qc);
  };

  const close = (open: boolean) => {
    if (open || phase === "running") return;
    onClose(phase === "done" ? results : null);
  };
  const removed = results.filter((r) => r.status === "removed").length;

  return (
    <Dialog
      open
      onOpenChange={close}
      size="lg"
      title={phase === "done" ? t("resultTitle", { removed, total: results.length }) : t("confirmTitle", { count: torrents.length })}
      description={t("confirmServer", { server: connection.name, url: connection.baseUrl })}
    >
      <ul className="divide-y divide-line rounded-md border border-line">
        {torrents.map((x) => {
          const r = results.find((y) => y.hash === x.hash);
          const lines = linkLines(x, titles);
          return (
            <li key={x.hash} className="flex gap-3 p-3.5">
              {r && <ResultIcon status={r.status} />}
              <div className="min-w-0 flex-1">
                <p className="break-words text-body-s font-semibold text-text-1">{lines[0] ?? x.name}</p>
                {lines.slice(1).map((l) => (
                  <p key={l} className="text-body-s text-text-1">
                    {l}
                  </p>
                ))}
                {lines.length > 0 && <p className="mt-0.5 break-words text-body-s text-text-3">{x.name}</p>}
                {lines.length === 0 && <p className="mt-0.5 text-body-s text-text-2">{t("notLinked")}</p>}
                {!x.fromLumovio && <p className="mt-0.5 text-body-s text-text-2">{t("notFromLumovio")}</p>}
                {!r && (
                  <p className="mt-1 text-body-s text-text-2">
                    {[formatBytes(x.sizeBytes) && t("size", { size: formatBytes(x.sizeBytes)! }), x.active && t("active")].filter(Boolean).join(" · ")}
                  </p>
                )}
                {r && (
                  // The icon at the start carries the status colour; the words stay in the text colour (X-23).
                  <p className="mt-1 text-body-s text-text-1">
                    {r.status === "removed"
                      ? t("status_removed", { links: r.links })
                      : r.status === "index_pending"
                        ? t("status_index_pending", { error: errorText(r.error) })
                        : r.status === "still_there"
                          ? r.error
                            ? t("status_still_there_error", { error: errorText(r.error) })
                            : t("status_still_there")
                          : t("status_unknown", { error: errorText(r.error) })}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {phase === "confirm" && (
        <div className="mt-4 space-y-2 text-body-s text-text-2">
          {/* On screen (37, 7.x confirm dialog): the risks with their sign and what stays; the rest is for a screen reader. */}
          {packs && <p className="sr-only">{t("confirmPack")}</p>}
          {active > 0 && (
            <p className="flex gap-2 text-text-1">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              {t("confirmActive", { count: active })}
            </p>
          )}
          {outside > 0 && (
            <p className="flex gap-2 text-text-1">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              {t("confirmOutside", { count: outside })}
            </p>
          )}
          {others.length > 0 && <p className="sr-only">{t("confirmShared", { profiles: connection.profileIds.length === 0 ? `${t("allAdults")} (${users.map((p) => p.name).join(", ")})` : users.map((p) => p.name).join(", ") })}</p>}
          {size > 0 && <p className="sr-only">{t("confirmSize", { size: formatBytes(size)! })}</p>}
          <p>{t("confirmKeeps")}</p>
        </div>
      )}
      {phase === "running" && (
        <p className="mt-4 flex items-center gap-2 text-body-s text-text-2" role="status">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          {progress && progress.done < progress.total ? t("removing", progress) : t("checking")}
        </p>
      )}

      <DialogActions>
        {phase === "confirm" && (
          <>
            <Button variant="secondary" onClick={() => onClose(null)}>
              {tr("common.cancel")}
            </Button>
            <Button variant="danger" onClick={run}>
              {t("confirm", { count: torrents.length })}
            </Button>
          </>
        )}
        {phase === "done" && (
          <>
            {results.some((r) => r.status === "index_pending") && (
              <Button variant="secondary" loading={retrying} onClick={retryIndex}>
                {t("retryIndex")}
              </Button>
            )}
            <Button onClick={() => onClose(results)}>{tr("common.done")}</Button>
          </>
        )}
      </DialogActions>

    </Dialog>
  );
}

function ResultIcon({ status }: { status: RemovalResult["status"] }) {
  const Icon = status === "removed" ? CheckCircle2 : status === "unknown" ? CircleHelp : status === "index_pending" ? AlertTriangle : XCircle;
  return <Icon aria-hidden className={clsx("mt-0.5 size-5 shrink-0", status === "removed" ? "text-success" : status === "still_there" ? "text-danger" : "text-warning")} />;
}
