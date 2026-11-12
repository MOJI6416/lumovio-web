"use client";

import type { ConnectionSummary } from "@lumovio/contracts";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, ListVideo, Lock, RefreshCw, SearchX, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { lazy, Suspense, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { formatSize, ReleaseLine, releaseMarks, useReleaseText } from "@/components/sources/release-text";
import { StatusBadge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FilterChip } from "@/components/ui/Chip";
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
import { matchTorrents, type TorrentMatch, titleName } from "@/lib/media/torrent-link";
import {
  forgetTorrents,
  invalidateAvailability,
  loadTorrentManager,
  type ManagedTorrent,
  type RemovalResult,
  type WatchedState,
  watchedInProfile,
} from "@/lib/media/torrent-manage";
import { netErrorText } from "./net-errors";
import { RemoveTorrentsDialog, useLinks, useLinkLines } from "./RemoveTorrentsDialog";
import { profileHasAccess } from "./server-actions";

// The linking dialogs load when one opens, not with the list (bundle budget).
const LinkTorrentDialog = lazy(() => import("./LinkTorrentsDialog").then((m) => ({ default: m.LinkTorrentDialog })));
const LinkAllDialog = lazy(() => import("./LinkTorrentsDialog").then((m) => ({ default: m.LinkAllDialog })));

/** Releases not linked in Lumovio matched to titles on opening, at most (two requests to the catalog). */
const MATCH_MAX = 80;

/** What the active profile has watched of these titles (`/api/library/state`, 100 a request). */
async function watchedStates(titleIds: string[]): Promise<Map<string, WatchedState>> {
  const out = new Map<string, WatchedState>();
  for (let i = 0; i < titleIds.length; i += 100) {
    const { states } = await api<{ states: (WatchedState & { titleId: string })[] }>(`/api/library/state?ids=${titleIds.slice(i, i + 100).join(",")}`);
    for (const s of states) out.set(s.titleId, s);
  }
  return out;
}

/**
 * "TorrServer → Added torrents" (the Tool template): the server's own list, read from this
 * device, with what Lumovio links to each torrent — the film or series a link to its page. Every full read reconciles
 * the index with it; removal is by hash, one or several at a time, after a confirmation that names the server,
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
  const [filter, setFilter] = useState<"all" | "unlinked" | "watched">("all");
  const [linking, setLinking] = useState<ManagedTorrent | null>(null);
  const [linkingAll, setLinkingAll] = useState(false);

  // Releases not linked in Lumovio, matched to catalog titles on this device (lib/media/torrent-link): a sure match is
  // proposed, anything less is the person's choice; nothing is linked by itself.
  const unlinked = (data.data?.torrents ?? []).filter((x) => x.links.length === 0).slice(0, MATCH_MAX);
  const matches = useQuery({
    queryKey: ["torrent-matches", connectionId, unlinked.map((x) => x.hash).join(",")],
    queryFn: () => matchTorrents(unlinked.map((x) => ({ hash: x.hash, name: x.name, mark: x.mark }))),
    enabled: unlinked.length > 0,
    retry: false,
    staleTime: 10 * 60_000,
  });
  // What this profile has watched of the linked titles: the "Watched in this profile" filter, read again with the list.
  const linkedTitles = [...new Set((data.data?.torrents ?? []).flatMap((x) => x.links.map((l) => l.titleId)))].sort();
  const watched = useQuery({
    queryKey: ["torrent-watched", connectionId, me?.activeProfile?.id ?? null, data.data?.readAt ?? 0, linkedTitles.join(",")],
    queryFn: () => watchedStates(linkedTitles),
    enabled: linkedTitles.length > 0,
    // The chip stays while a refresh reads them again.
    placeholderData: keepPreviousData,
    retry: false,
  });

  if (kids) return <EmptyState icon={ListVideo} title={t("kidsOnly")} />;
  if (conns.isLoading) return <Skeleton shape="md" className="h-40 w-full" />;
  // The servers didn't load: an error with Retry, not "no such server".
  if (!conns.data && conns.isError) return <ErrorState error={conns.error} onRetry={() => void conns.refetch()} retrying={conns.isFetching} />;
  if (!conn) return <EmptyState icon={ListVideo} title={t("notFound")} action={<ServersLink />} />;
  if (conn.kind !== "torrserver") return <EmptyState icon={ListVideo} title={t("notTorrServer")} action={<ServersLink />} />;
  // The list comes through the profile's own access to the server: without it, said — not a failed read.
  if (!access) return <EmptyState icon={Lock} title={t("noAccessTitle", { profile: me?.activeProfile?.name ?? "" })} about={t("noAccessText", { server: conn.name })} action={<ServersLink />} />;

  const titles = data.data?.titles ?? {};
  const all = data.data?.torrents ?? [];
  const q = query.trim().toLowerCase();
  const states = watched.data;
  const isWatched = (x: ManagedTorrent) => (states ? watchedInProfile(x, states) : false);
  const watchedCount = all.filter(isWatched).length;
  const unlinkedCount = all.filter((x) => x.links.length === 0).length;
  // A filter whose chip is gone (its last release linked or removed) shows everything again.
  const shownFilter = filter === "unlinked" && unlinkedCount === 0 ? "all" : filter === "watched" && watchedCount === 0 && !watched.isLoading ? "all" : filter;
  const byFilter = shownFilter === "unlinked" ? all.filter((x) => x.links.length === 0) : shownFilter === "watched" ? all.filter(isWatched) : all;
  const rows = q ? byFilter.filter((x) => [x.name, x.hash, x.addedFor ?? "", ...linkLines(x, titles)].some((s) => s.toLowerCase().includes(q))) : byFilter;
  const matched = matches.data ?? {};
  const sure = unlinked.flatMap((x) => {
    const m = matched[x.hash];
    return m?.status === "sure" && all.some((y) => y.hash === x.hash && y.links.length === 0) ? [{ torrent: x, title: m.title }] : [];
  });
  const linked = (done: boolean) => {
    setLinking(null);
    setLinkingAll(false);
    if (!done) return;
    invalidateAvailability(qc);
    refresh();
  };
  const shownSelected = rows.filter((x) => selected.has(x.hash));
  const toggle = (hash: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(hash)) n.delete(hash);
      else n.add(hash);
      return n;
    });
  // Picking many at once takes only what Lumovio added: the person's own releases are picked one by one.
  const ours = rows.filter((x) => x.fromLumovio);
  const oursAll = all.filter((x) => x.fromLumovio);
  const allShown = ours.length > 0 && ours.every((x) => selected.has(x.hash));
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
    // "← Servers", the h1 with the server's name and what the page does come from the page (PageHeader).
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} placeholder={t("searchPlaceholder")} aria-label={t("search")} className="min-w-0 flex-1 basis-60" />
        <Button variant="secondary" icon={RefreshCw} onClick={refresh} loading={data.isFetching}>
          {t("refresh")}
        </Button>
        {/* Everything Lumovio added, in one press — the person's own releases never. */}
        {oursAll.length > 0 && (
          <Button variant="danger-tertiary" icon={Trash2} onClick={() => setRemoving(oursAll)}>
            {t("clearOurs", { count: oursAll.length })}
          </Button>
        )}
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
      {/* Releases added outside Lumovio (or unlinked) whose title is sure: linked after a review, never by themselves. */}
      {sure.length > 0 && (
        <InlineAlert
          tone="info"
          action={
            <Button variant="tertiary" size="sm" icon={Link2} aria-haspopup="dialog" onClick={() => setLinkingAll(true)}>
              {t("reviewLink")}
            </Button>
          }
        >
          {t("matchedBanner", { count: unlinkedCount, sure: sure.length })}
        </InlineAlert>
      )}
      {matches.isError && (
        <InlineAlert
          tone="warning"
          action={
            <Button variant="tertiary" size="sm" onClick={() => void matches.refetch()}>
              {tm("retry")}
            </Button>
          }
        >
          {t("matchFailed")}
        </InlineAlert>
      )}

      {data.isLoading ? (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton shape="md" className="h-24 w-full" />
          <Skeleton shape="md" className="h-24 w-full" />
          <Skeleton shape="md" className="h-24 w-full" />
        </div>
      ) : data.data && all.length === 0 ? (
        <EmptyState icon={ListVideo} title={t("empty")} about={t("emptyText")} />
      ) : data.data ? (
        <section aria-label={t("title")} className="flex flex-col gap-2">
          {(unlinkedCount > 0 || watchedCount > 0) && (
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">{t("filters")}</legend>
              {unlinkedCount > 0 && (
                <FilterChip selected={shownFilter === "unlinked"} count={unlinkedCount} onClick={() => setFilter(shownFilter === "unlinked" ? "all" : "unlinked")}>
                  {t("filterUnlinked")}
                </FilterChip>
              )}
              {watchedCount > 0 && (
                <FilterChip selected={shownFilter === "watched"} count={watchedCount} onClick={() => setFilter(shownFilter === "watched" ? "all" : "watched")}>
                  {t("filterWatched")}
                </FilterChip>
              )}
            </fieldset>
          )}
          {/* It helps make a list to remove; it says nothing of the other profiles. */}
          {shownFilter === "watched" && <p className="px-1 text-body-s text-text-2">{t("watchedNote", { profile: me?.activeProfile?.name ?? "" })}</p>}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-body-s text-text-2">
            <Checkbox
              label={t("selectAll")}
              checked={allShown}
              indeterminate={!allShown && shownSelected.length > 0}
              disabled={ours.length === 0}
              onCheckedChange={() => setSelected(allShown ? new Set([...selected].filter((h) => !ours.some((x) => x.hash === h))) : new Set([...selected, ...ours.map((x) => x.hash)]))}
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
                <TorrentRow
                  key={x.hash}
                  x={x}
                  titles={titles}
                  match={x.links.length === 0 ? (matched[x.hash] ?? null) : null}
                  selected={selected.has(x.hash)}
                  onToggle={() => toggle(x.hash)}
                  onRemove={() => setRemoving([x])}
                  onLink={() => setLinking(x)}
                  locale={locale}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* The bulk action stays in sight while the list scrolls, above the phone's bottom bar. */}
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
      <Suspense fallback={null}>
        {linking && (
          <LinkTorrentDialog
            connection={conn}
            torrent={linking}
            candidates={matched[linking.hash]?.candidates ?? []}
            initial={matched[linking.hash]?.title ?? null}
            onClose={linked}
          />
        )}
        {linkingAll && <LinkAllDialog connection={conn} pairs={sure} onClose={linked} />}
      </Suspense>
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
 * where it came from, never "not linked · added from Lumovio" side by side.
 */
function TorrentRow({
  x,
  titles,
  match,
  selected,
  onToggle,
  onRemove,
  onLink,
  locale,
}: {
  x: ManagedTorrent;
  titles: Parameters<ReturnType<typeof useLinks>>[1];
  /** For a release not linked in Lumovio: the titles its name or data fit (null while they are looked up). */
  match: TorrentMatch | null;
  selected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onLink: () => void;
  locale: string;
}) {
  const t = useTranslations("torrentManager");
  const text = useReleaseText();
  const links = useLinks()(x, titles);
  const info = parseRelease(x.name);
  const audio = text.audio({ info, language: null });
  // The release as its quality marks and words (ReleaseLine), or in words when its name gives no marks.
  const quality = releaseMarks(info).length ? <ReleaseLine info={info} rest={[audio]} /> : [info.resolution !== null || info.source !== null ? text.picture(info) : null, audio].filter(Boolean).join(" · ") || null;
  const name = links[0]?.title ?? x.name;
  const origin = links.length > 0 ? (x.fromLumovio ? null : t("notFromLumovio")) : x.fromLumovio ? (x.addedFor ? t("addedForUnlinked", { title: x.addedFor }) : t("addedUnlinked")) : t("notLinkedOutside");
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
          <p className="text-title break-words text-text-1">{quality || x.name}</p>
        )}
        {links.length > 0 && quality && <p className="text-body-s text-text-1">{quality}</p>}
        <p className="text-body-s break-words text-text-3">{x.name}</p>
        {origin && <p className="text-body-s text-text-2">{origin}</p>}
        {/* Not linked: the title it looks like, when one is sure, or how many fit; linking is the person's choice. */}
        {links.length === 0 && (
          <div className="flex flex-wrap items-center gap-x-3">
            {match?.status === "sure" && <p className="text-body-s text-text-1">{t("looksLike", { title: titleName(match.title) })}</p>}
            {match?.status === "unsure" && <p className="text-body-s text-text-2">{t("severalFit", { count: match.candidates.length })}</p>}
            <Button variant="tertiary" size="sm" icon={Link2} aria-haspopup="dialog" className="-ms-3" onClick={onLink} aria-label={t("linkOne", { name: x.name })}>
              {t("link")}
            </Button>
          </div>
        )}
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
