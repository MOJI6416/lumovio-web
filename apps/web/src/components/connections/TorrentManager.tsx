"use client";

import type { ConnectionSummary } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListVideo, Lock, RefreshCw, SearchX, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { formatSize, useReleaseText } from "@/components/sources/release-text";
import { StatusBadge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { SearchInput } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { formatDate, relativeTime } from "@/lib/format";
import { parseRelease } from "@/lib/media/releases";
import { forgetTorrents, invalidateAvailability, loadTorrentManager, type ManagedTorrent, type RemovalResult } from "@/lib/media/torrent-manage";
import { netErrorText } from "./net-errors";
import { RemoveTorrentsDialog, useLinks, useLinkLines } from "./RemoveTorrentsDialog";
import { profileHasAccess } from "./server-actions";

/**
 * "TorrServer → Added torrents" (S20, C35; design-system 9 Tool; SRC-20): the server's own list, read from this
 * device, with what Lumovio links to each torrent — the film or series a link to its page. Every full read reconciles
 * the index with it; removal is by hash, one or several at a time, after a confirmation (7.9) that names the server,
 * each torrent and what goes with it. Checkboxes are 44 px on a phone and "Remove selected" stays in sight in a bar at
 * the bottom while the list scrolls. Errors in words. Adult profiles with access to the server only (the API refuses
 * the others too); without access it says so instead of failing.
 */
export function TorrentManager({ connectionId }: { connectionId: string }) {
  const t = useTranslations("torrentManager");
  const tc = useTranslations("connections");
  const te = useTranslations("errors");
  const tm = useTranslations("common");
  const locale = useLocale();
  const { me } = useSession();
  const qc = useQueryClient();
  const kids = me?.activeProfile?.isKids ?? false;
  const conns = useQuery({ queryKey: ["connections"], queryFn: () => api<{ connections: ConnectionSummary[] }>("/api/connections"), enabled: !kids });
  const conn = conns.data?.connections.find((c) => c.id === connectionId);
  const access = conn ? profileHasAccess(conn, me) : false;
  const data = useQuery({
    queryKey: ["torrent-manager", connectionId],
    queryFn: async () => {
      const d = await loadTorrentManager(connectionId);
      if (d.reconciled.some((r) => r.status === "removed")) invalidateAvailability(qc);
      return d;
    },
    enabled: conn?.kind === "torrserver" && access,
    retry: false,
    // Each read may reconcile the index: only on opening and on "Refresh".
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  });
  const linkLines = useLinkLines();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<ManagedTorrent[] | null>(null);
  const [clearing, setClearing] = useState(false);

  if (kids) return <EmptyState icon={ListVideo} title={t("title")} text={t("kidsOnly")} />;
  if (conns.isLoading) return <Skeleton shape="md" className="h-40 w-full" />;
  // The servers didn't load: an error with Retry, not "no such server" (X-14).
  if (!conns.data && conns.isError) return <ErrorState error={conns.error} onRetry={() => void conns.refetch()} retrying={conns.isFetching} />;
  if (!conn) return <EmptyState icon={ListVideo} title={t("title")} text={t("notFound")} action={<ServersLink />} />;
  if (conn.kind !== "torrserver") return <EmptyState icon={ListVideo} title={t("title")} text={t("notTorrServer")} action={<ServersLink />} />;
  // The list comes through the profile's own access to the server (SRV-03): without it, said — not a failed read.
  if (!access) return <EmptyState icon={Lock} title={t("noAccessTitle", { profile: me?.activeProfile?.name ?? "" })} text={t("noAccessText", { server: conn.name })} action={<ServersLink />} />;

  const titles = data.data?.titles ?? {};
  const all = data.data?.torrents ?? [];
  const q = query.trim().toLowerCase();
  const rows = q ? all.filter((x) => [x.name, x.hash, x.addedFor ?? "", ...linkLines(x, titles)].some((s) => s.toLowerCase().includes(q))) : all;
  const shownSelected = rows.filter((x) => selected.has(x.hash));
  const toggle = (hash: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(hash)) n.delete(hash);
      else n.add(hash);
      return n;
    });
  const allShown = rows.length > 0 && rows.every((x) => selected.has(x.hash));
  const refresh = () => void data.refetch();
  const reconciled = data.data?.reconciled ?? [];
  const forgotten = reconciled.filter((r) => r.status === "removed");
  const pending = reconciled.filter((r) => r.status !== "removed");
  const empty = data.data?.emptyServer ?? [];

  const clearLinks = async (hashes: string[]) => {
    setClearing(true);
    try {
      const out = await forgetTorrents(connectionId, hashes);
      invalidateAvailability(qc);
      if (out.some((r) => r.status !== "removed")) toast.error(te("generic"));
      refresh();
    } finally {
      setClearing(false);
    }
  };

  const finished = (results: RemovalResult[] | null) => {
    setRemoving(null);
    if (!results) return;
    const gone = new Set(results.filter((r) => r.status === "removed" || r.status === "index_pending").map((r) => r.hash));
    setSelected((s) => new Set([...s].filter((h) => !gone.has(h))));
    refresh();
  };

  const retryButton = (
    <Button variant="tertiary" size="sm" onClick={refresh}>
      {tm("retry")}
    </Button>
  );

  return (
    // "← Servers", the h1 with the server's name and what the page does come from the page (PageHeader, 8.7).
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} placeholder={t("searchPlaceholder")} aria-label={t("search")} className="min-w-0 flex-1 basis-60" />
        <Button variant="secondary" icon={RefreshCw} onClick={refresh} loading={data.isFetching}>
          {t("refresh")}
        </Button>
      </div>

      {data.isError && (
        <InlineAlert tone="danger" title={t("readFailedTitle", { server: conn.name })} action={retryButton}>
          {t("readFailed", { error: netErrorText(tc, data.error) })}
        </InlineAlert>
      )}
      {data.data?.indexError != null && <InlineAlert tone="warning">{t("indexFailed")}</InlineAlert>}
      {forgotten.length > 0 && <InlineAlert tone="success">{t("reconciled", { count: forgotten.length, links: forgotten.reduce((s, r) => s + r.links, 0) })}</InlineAlert>}
      {pending.length > 0 && (
        <InlineAlert tone="warning" action={retryButton}>
          {t("reconcileFailed", { count: pending.length })}
        </InlineAlert>
      )}
      {empty.length > 0 && (
        <InlineAlert
          tone="warning"
          action={
            <Button variant="tertiary" size="sm" loading={clearing} onClick={() => void clearLinks(empty)}>
              {t("emptyServerAction", { count: empty.length })}
            </Button>
          }
        >
          {t("emptyServer", { count: empty.length })}
        </InlineAlert>
      )}

      {data.isLoading ? (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton shape="md" className="h-24 w-full" />
          <Skeleton shape="md" className="h-24 w-full" />
          <Skeleton shape="md" className="h-24 w-full" />
        </div>
      ) : data.data && all.length === 0 ? (
        <EmptyState icon={ListVideo} title={t("empty")} text={t("emptyText")} />
      ) : data.data ? (
        <section aria-label={t("title")} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-body-s text-text-2">
            <Checkbox
              label={t("selectAll")}
              checked={allShown}
              indeterminate={!allShown && shownSelected.length > 0}
              disabled={rows.length === 0}
              onCheckedChange={() => setSelected(allShown ? new Set([...selected].filter((h) => !rows.some((x) => x.hash === h))) : new Set([...selected, ...rows.map((x) => x.hash)]))}
            />
            <span className="tabular-nums">
              {rows.length === all.length ? t("count", { count: all.length }) : t("shown", { shown: rows.length, total: all.length })} ·{" "}
              {t("readAt", { time: relativeTime(new Date(data.data.readAt).toISOString(), locale, tm("justNow")) })}
            </span>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={SearchX} title={t("noMatch", { query })} action={<Button variant="secondary" onClick={() => setQuery("")}>{t("clearSearch")}</Button>} />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface-1">
              {rows.map((x) => (
                <TorrentRow key={x.hash} x={x} titles={titles} selected={selected.has(x.hash)} onToggle={() => toggle(x.hash)} onRemove={() => setRemoving([x])} locale={locale} />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* The bulk action stays in sight while the list scrolls (SRC-20), above the phone's bottom bar. */}
      {shownSelected.length > 0 && (
        <section className="sticky bottom-20 z-sticky flex items-center gap-2 rounded-md border border-line bg-surface-1 p-2 shadow-float md:bottom-4 md:gap-3 md:p-3" aria-label={t("selection")}>
          <IconButton icon={X} label={t("clearSelection")} onClick={() => setSelected(new Set())} />
          <p className="min-w-0 flex-1 text-body-s text-text-1 tabular-nums" aria-live="polite">
            {t("selectedCount", { count: shownSelected.length, size: formatSize(shownSelected.reduce((s, x) => s + (x.sizeBytes ?? 0), 0), locale) ?? "—" })}
          </p>
          <Button variant="danger-tertiary" icon={Trash2} onClick={() => setRemoving(shownSelected)} className="shrink-0">
            {t("removeSelectedShort", { count: shownSelected.length })}
          </Button>
        </section>
      )}

      {removing && <RemoveTorrentsDialog connection={conn} torrents={removing} titles={titles} onClose={finished} />}
    </div>
  );
}

function ServersLink() {
  const tc = useTranslations("connections");
  return (
    <Link href="/settings/connections" className={buttonClass("secondary")}>
      {tc("title")}
    </Link>
  );
}

/**
 * One added torrent: what it is linked to (each film or series a link to its page, with the episodes a pack's files are
 * bound to), the release in words and its full name, size, when it was added and whether it plays now; one statement of
 * where it came from (SRC-06), never "not linked · added from Lumovio" side by side.
 */
function TorrentRow({
  x,
  titles,
  selected,
  onToggle,
  onRemove,
  locale,
}: {
  x: ManagedTorrent;
  titles: Parameters<ReturnType<typeof useLinks>>[1];
  selected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  locale: string;
}) {
  const t = useTranslations("torrentManager");
  const text = useReleaseText();
  const links = useLinks()(x, titles);
  const info = parseRelease(x.name);
  const words = [info.resolution !== null || info.source !== null ? text.picture(info) : null, text.audio({ info, language: null })].filter(Boolean).join(" · ");
  const name = links[0]?.title ?? x.name;
  const origin = links.length > 0 ? null : x.fromLumovio ? (x.addedFor ? t("addedForUnlinked", { title: x.addedFor }) : t("addedUnlinked")) : t("notLinkedOutside");
  const facts = [formatSize(x.sizeBytes, locale) && t("size", { size: formatSize(x.sizeBytes, locale)! }), x.addedAt ? t("addedAt", { date: formatDate(new Date(x.addedAt * 1000).toISOString(), locale) ?? "" }) : null].filter(Boolean).join(" · ");
  return (
    <li className="flex items-start gap-3 p-4 data-selected:bg-accent-soft" data-selected={selected || undefined}>
      <Checkbox hideLabel label={t("select", { name })} checked={selected} onCheckedChange={onToggle} className="shrink-0 max-sm:-m-3" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {links.length > 0 ? (
          links.map((l) => (
            <p key={l.titleId} className="text-title text-text-1">
              {l.href ? (
                <Link href={l.href} className="inline-flex min-h-8 items-center underline decoration-line-2 underline-offset-3 hover:decoration-text-1 max-sm:min-h-11">
                  {l.title}
                </Link>
              ) : (
                l.title
              )}
              {l.scope && <span className="text-body-s font-normal text-text-2"> · {l.scope}</span>}
            </p>
          ))
        ) : (
          <p className="text-title break-words text-text-1">{words || x.name}</p>
        )}
        {links.length > 0 && words && <p className="text-body-s text-text-1">{words}</p>}
        <p className="text-body-s break-words text-text-3">{x.name}</p>
        {origin && <p className="text-body-s text-text-2">{origin}</p>}
        {(facts || x.active) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-s text-text-2">
            {facts && <span>{facts}</span>}
            {x.active && <StatusBadge status="warning">{t("active")}</StatusBadge>}
          </p>
        )}
      </div>
      <Button variant="danger-tertiary" size="sm" className="shrink-0" onClick={onRemove} aria-label={t("removeOne", { name })}>
        {t("removeShort")}
      </Button>
    </li>
  );
}
