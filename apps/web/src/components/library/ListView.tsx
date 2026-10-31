"use client";

import type { ListDetails, ListSource } from "@lumovio/contracts";
import { type InfiniteData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, ExternalLink, ListVideo, RefreshCw, Search, Share2, Unlink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { PosterCard } from "@/components/media/PosterCard";
import { TitleGrid } from "@/components/media/Row";
import { useSession } from "@/components/providers/Providers";
import { ProfileAvatar } from "@/components/ui/Avatar";
import { Button, buttonClass } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { SearchInput } from "@/components/ui/Input";
import { lazyControl, useLazySwap, useStandIn } from "@/components/ui/lazy-swap";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "@/components/ui/Toast";
import { libraryKey } from "@/hooks/useLibraryState";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { apiErrorKey } from "@/lib/api-errors";
import { relativeTime } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { sortItems, useTitleSorts } from "./sorting";
import { CollectionToolbar } from "./CollectionToolbar";
import { sourceErrorKey } from "./ConnectListDialog";
import type { ListDialog } from "./ListMenu";
import { GridSkeleton } from "./GridSkeleton";
import { readFilters, readSort, useUrlState } from "./url-state";
import { mergedItems } from "./whole-list";
import { rulesHref } from "./rules-url";

type Item = ListDetails["items"][number];
type Pages = InfiniteData<ListDetails, number>;

const menuModule = lazyControl(() => import("./ListMenu"));
const EditListDialog = lazy(() => import("./ListDialogs").then((m) => ({ default: m.EditListDialog })));
const MembersDialog = lazy(() => import("./ListDialogs").then((m) => ({ default: m.MembersDialog })));
const InviteDialog = lazy(() => import("./ListDialogs").then((m) => ({ default: m.InviteDialog })));
const CopyListDialog = lazy(() => import("./CopyListDialog").then((m) => ({ default: m.CopyListDialog })));
const RulesNotice = lazy(() => import("./RulesNotice").then((m) => ({ default: m.RulesNotice })));

const SORTS = ["list", "added", "title", "year", "rating"] as const;
type Sort = (typeof SORTS)[number];
/** Cards drawn at a time (LIB-14): a Top 250 isn't 13 000 px of posters at once; "Show more" draws the next ones. */
const PAGE = 60;

/**
 * A list (S10, Collection template; LIB-06…LIB-08, LIB-14…LIB-16): "← Lists" for its members, the name, the
 * description, and one line with the count, who owns it and who sees it. "Share" (when it isn't private) and "More" —
 * edit, members and roles, invite, delete or leave (confirmed) — instead of a row of controls. A followed MDBList list
 * says so in a banner with "Refresh" and "Unfollow". A search, type chips and the sort over the grid, drawn 60 at a
 * time; a title leaves from its card's "More" with "Undo" (LIB-01). An empty list points to finding titles (LIB-07).
 * The server sends the list page by page (LIB-24): "Show more" goes on to the next one, and a search, a type chip or
 * a sort first loads the rest, so they work on the whole list.
 */
export function ListView({ initial }: { initial: ListDetails }) {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { me } = useSession();
  const q = useInfiniteQuery({
    queryKey: ["list", initial.id],
    queryFn: ({ pageParam }) => api<ListDetails>(`/api/lists/${initial.id}${pageParam ? `?offset=${pageParam}` : ""}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    initialData: { pages: [initial], pageParams: [0] },
    // A smart list being filled by its conditions (package F) is asked again until it is (about two minutes at most).
    refetchInterval: (query) => (query.state.data?.pages[0]?.rules?.status === "pending" && query.state.dataUpdateCount < 40 ? 3000 : false),
  });
  const l: ListDetails = { ...q.data.pages[0]!, items: mergedItems(q.data.pages) };
  const { params, set } = useUrlState();
  const filters = readFilters(params);
  const sort = readSort<Sort>(params, SORTS, "list");
  const sorts = useTitleSorts();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [dialog, setDialog] = useState<ListDialog | null>(null);
  const moreLight = useRef<HTMLButtonElement>(null);
  const more = useLazySwap(menuModule, moreLight);
  const moreIn = useStandIn(more);
  const isOwner = l.role === "owner";
  const isMember = l.members.length > 0;
  const canEdit = l.role === "owner" || l.role === "editor";
  const custom = l.kind === "custom";
  const kids = Boolean(me?.activeProfile?.isKids);
  const key = ["list", l.id];
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  // A title is removed at once, with "Undo" (LIB-01); the card's state, the lists tab's counts and covers follow.
  const removeTitle = useAction({
    run: (item: Item) => api(`/api/lists/${l.id}/items/${item.title.id}`, { method: "DELETE" }),
    optimistic: (item: Item) => {
      const titleId = item.title.id;
      const before = qc.getQueryData<Pages>(key);
      void qc.cancelQueries({ queryKey: key });
      qc.setQueryData<Pages>(
        key,
        (d) => d && { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.filter((x) => x.title.id !== titleId), itemCount: Math.max(0, p.itemCount - 1) })) },
      );
      return () => qc.setQueryData<Pages>(key, before);
    },
    success: (_, item) => t("removedFromList", { title: item.title.title, list: l.name }),
    undo: async (_, item) => {
      await api(`/api/lists/${l.id}/items/${item.title.id}/restore`, { method: "POST", json: {} });
      void qc.invalidateQueries({ queryKey: libraryKey(item.title.id) });
    },
    error: (_, item) => t("removeFromListFailed", { title: item.title.title }),
    sync: () => {
      void refresh();
      void qc.invalidateQueries({ queryKey: ["lists"] });
      void qc.invalidateQueries({ queryKey: ["library"] });
      void qc.invalidateQueries({ queryKey: ["library-state"] });
    },
  });

  const copy = useAction({ run: (text: string) => navigator.clipboard.writeText(text), success: t("linkCopied") });
  const share = async () => {
    const url = window.location.href.split("?")[0]!;
    if (!navigator.share) return void copy.run(url);
    try {
      await navigator.share({ title: l.name, url });
    } catch (e) {
      // Closing the share sheet is not a failure; anything else falls back to copying the link.
      if (!(e instanceof DOMException && e.name === "AbortError")) void copy.run(url);
    }
  };

  // Deleting and leaving are confirmed first (8.3); the request runs in the dialog.
  const deleteOrLeave = async () => {
    const ok = await confirm({
      ...(isOwner
        ? { title: t("deleteListTitle", { list: l.name }), text: t("deleteListText"), confirmLabel: t("deleteList") }
        : { title: t("leaveTitle", { list: l.name }), text: t("leaveText"), confirmLabel: t("leave") }),
      action: () => api(`/api/lists/${l.id}`, { method: "DELETE" }),
      error: isOwner ? t("deleteListFailed") : t("leaveFailed"),
    });
    if (!ok) return;
    toast.success(isOwner ? t("listDeleted", { list: l.name }) : t("listLeft", { list: l.name }));
    void qc.invalidateQueries({ queryKey: ["lists"] });
    router.push("/library?tab=lists");
  };

  // A member came here from their library: "← Lists" (or the system list's tab) over the h1 (8.7, LIB-07).
  const back = !isMember ? undefined : custom ? { href: "/library?tab=lists", label: t("lists") } : { href: `/library?tab=${l.kind}`, label: t(l.kind) };
  const who = isOwner ? (l.collaborative ? `${t(`visibility_${l.visibility}`)} · ${t("collaborative")}` : t(`visibility_${l.visibility}`)) : t("ownerIs", { name: l.owner.name });

  const needle = query.trim().toLocaleLowerCase(locale);
  // A search, a type chip or a sort works on the whole list: the pages not loaded yet come first (LIB-24). So does
  // a first page with nothing a kids profile may see.
  const narrowed = Boolean(needle || filters.show || sort !== "list");
  const completing = (narrowed || l.items.length === 0) && q.hasNextPage;
  const { fetchNextPage, isFetchingNextPage, isFetchNextPageError } = q;
  useEffect(() => {
    if (completing && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  }, [completing, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);
  // The list's count; once every page is here, the titles themselves (a kids profile's count leaves out only the
  // blocked titles of the pages it has read).
  const count = q.hasNextPage ? Math.max(l.itemCount, l.items.length) : l.items.length;
  const matching = l.items.filter(
    (i) =>
      (!filters.show || i.title.kind === filters.show) &&
      (!needle || i.title.title.toLocaleLowerCase(locale).includes(needle) || (i.title.originalTitle?.toLocaleLowerCase(locale).includes(needle) ?? false)),
  );
  const items = sort === "added" ? [...matching].sort((a, b) => b.addedAt.localeCompare(a.addedAt)) : sortItems(matching, sort, locale);
  const shownItems = items.slice(0, limit);
  const total = narrowed ? items.length : count;
  // The next cards: from the loaded titles, and the next page of the list once those are all drawn.
  const showMore = () => {
    setLimit((n) => n + PAGE);
    if (limit + PAGE >= items.length && q.hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };
  const listOrderLabel = l.source ? t("sortSource") : t("sortList");

  const moreLabel = t("listMoreLabel", { list: l.name });
  const showMenu = (custom || isOwner) && isMember;
  const menu = showMenu &&
    (moreIn.full ? (
      <moreIn.full.ListMenu
        list={l}
        isOwner={isOwner}
        kids={kids}
        label={moreLabel}
        initialOpen={more.start.open}
        focusTrigger={more.start.focus}
        onDialog={setDialog}
        onDeleteOrLeave={() => void deleteOrLeave()}
        onChange={refresh}
        onEditRules={l.rules ? () => router.push(rulesHref(l.rules!.rules, l.id)) : undefined}
      />
    ) : (
      <IconButton ref={moreLight} icon={Ellipsis} variant="secondary" label={moreLabel} aria-haspopup="menu" aria-expanded={false} {...moreIn.handlers} />
    ));

  return (
    <div>
      <PageHeader
        back={back}
        title={l.name}
        description={
          <>
            {l.description && <span className="block">{l.description}</span>}
            <span className={l.description ? "mt-1 block text-body-s" : "block text-body-s"}>
              {[tc("titlesCount", { count }), who].join(" · ")}
            </span>
          </>
        }
        actions={
          (l.visibility !== "private" || menu) && (
            <>
              {l.visibility !== "private" && (
                <Button variant="secondary" icon={Share2} onClick={() => void share()}>
                  {tc("share")}
                </Button>
              )}
              {menu}
            </>
          )
        }
      />

      {l.source && <SourceNotice listId={l.id} source={l.source} isOwner={isOwner} onChange={refresh} />}
      {l.rules && (
        <Suspense>
          <RulesNotice list={l} isOwner={isOwner} canEdit={canEdit} />
        </Suspense>
      )}

      {l.members.length > 1 && (
        <section className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2" aria-label={t("members")}>
          <ul className="flex -space-x-2">
            {l.members.slice(0, 6).map((m) => (
              <li key={m.profileId}>
                <ProfileAvatar avatar={m.avatar} name={m.name} size={28} className="ring-2 ring-bg" />
              </li>
            ))}
          </ul>
          <p className="text-body-s text-text-2">{l.members.map((m) => m.name).join(", ")}</p>
          <Button variant="tertiary" size="sm" onClick={() => setDialog("members")}>
            {isOwner ? t("manageMembers") : t("showMembers")}
          </Button>
        </section>
      )}

      {l.items.length === 0 && q.hasNextPage ? (
        // A first page a kids profile sees nothing of: the next one comes, or the way to ask for it again.
        isFetchNextPageError ? (
          <InlineAlert
            tone="danger"
            action={
              <Button variant="tertiary" size="sm" loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                {tc("retry")}
              </Button>
            }
          >
            {t("listMoreFailed")}
          </InlineAlert>
        ) : (
          <GridSkeleton />
        )
      ) : l.items.length === 0 && l.rules?.status === "pending" ? (
        // A smart list being filled by its conditions: its titles come in a moment (the banner says so).
        <GridSkeleton />
      ) : l.items.length === 0 && l.rules ? (
        // A smart list whose conditions match nothing now: they can be changed, or it fills by itself later.
        <EmptyState
          icon={ListVideo}
          title={t("rulesEmpty")}
          text={isOwner ? t("rulesEmptyHint") : t("emptyListReader")}
          action={
            isOwner && (
              <Link href={rulesHref(l.rules.rules, l.id)} className={buttonClass("secondary")}>
                {t("rulesEdit")}
              </Link>
            )
          }
        />
      ) : l.items.length === 0 ? (
        <EmptyState
          icon={ListVideo}
          title={t("emptyList")}
          text={canEdit ? t("emptyListHint") : t("emptyListReader")}
          action={
            canEdit && (
              <Link href="/search" className={buttonClass("primary")}>
                <Search aria-hidden />
                {t("findTitles")}
              </Link>
            )
          }
        />
      ) : (
        <>
          <CollectionToolbar
            filters={filters}
            set={(patch) => {
              setLimit(PAGE);
              set(patch);
            }}
            sort={{
              value: sort,
              onChange: (v) => {
                setLimit(PAGE);
                set({ sort: v === "list" ? null : v });
              },
              options: [{ value: "list", label: listOrderLabel }, ...sorts({ value: "added", label: t("sortAdded") })] as { value: Sort; label: string }[],
            }}
            shown={narrowed && !q.hasNextPage ? items.length : count}
            total={count}
          >
            {count > 12 && (
              <SearchInput
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE);
                }}
                aria-label={t("searchInList")}
                placeholder={t("searchInList")}
                maxLength={100}
                className="max-w-md"
              />
            )}
          </CollectionToolbar>
          {completing && !isFetchNextPageError ? (
            <GridSkeleton />
          ) : items.length === 0 && !q.hasNextPage ? (
            <EmptyState
              icon={Search}
              title={needle ? t("listNoMatch", { q: query.trim() }) : t("filterEmpty")}
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    set({ show: null });
                  }}
                >
                  {tc("resetFilters")}
                </Button>
              }
            />
          ) : (
            <>
              <TitleGrid>
                {shownItems.map((i) => (
                  <PosterCard
                    key={i.title.id}
                    title={i.title}
                    subtitle={i.addedBy && l.collaborative ? t("addedBy", { name: i.addedBy.name }) : (l.source || l.rules) && !i.fromSource ? t("sourceOwnAddition") : undefined}
                    // Removing is in the card's "More", seen on touch screens too (LIB-01, 8.3).
                    more={canEdit ? { remove: { label: t("removeFromList"), run: () => void removeTitle.run(i) } } : true}
                    moreVisibility={canEdit ? "always" : undefined}
                  />
                ))}
              </TitleGrid>
              {isFetchNextPageError ? (
                // The next page didn't come: what is here stays, with the way to ask again (8.4).
                <InlineAlert
                  tone="danger"
                  className="mt-8"
                  action={
                    <Button variant="tertiary" size="sm" loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                      {tc("retry")}
                    </Button>
                  }
                >
                  {t("listMoreFailed")}
                </InlineAlert>
              ) : (
                (items.length > shownItems.length || q.hasNextPage) && (
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <Button variant="secondary" loading={isFetchingNextPage} onClick={showMore}>
                      {tc("showMore")}
                    </Button>
                    <p className="text-body-s text-text-2">{t("shownOf", { shown: shownItems.length, total })}</p>
                  </div>
                )
              )}
            </>
          )}
        </>
      )}

      {/* The dialogs load when one is opened (bundle budget). */}
      <Suspense>
        {isOwner && dialog === "edit" && <EditListDialog list={l} open onOpenChange={(o) => setDialog(o ? "edit" : null)} kids={kids} />}
        {custom && isMember && dialog === "members" && <MembersDialog list={l} open onOpenChange={(o) => setDialog(o ? "members" : null)} isOwner={isOwner} />}
        {isOwner && custom && !kids && dialog === "invite" && <InviteDialog list={l} open onOpenChange={(o) => setDialog(o ? "invite" : null)} />}
        {isOwner && l.rules && dialog === "copy" && <CopyListDialog list={l} open onOpenChange={(o) => setDialog(o ? "copy" : null)} />}
      </Suspense>
    </div>
  );
}

/**
 * A list that follows an MDBList list (LIB-08, C23): one banner — where the titles come from, when it last synced, a
 * problem if there is one — with "Refresh" and "Unfollow" for the owner. Unfollowing keeps every title as an ordinary
 * list, so it is asked as a question, not as a deletion; "Undo" isn't offered (following again re-reads the list).
 */
function SourceNotice({ listId, source, isOwner, onChange }: { listId: string; source: ListSource; isOwner: boolean; onChange: () => unknown }) {
  const t = useTranslations("library");
  const tr = useTranslations();
  const locale = useLocale();
  const confirm = useConfirm();
  const words = (e: unknown) => {
    const k = sourceErrorKey(e);
    return k ? t(k) : tr(apiErrorKey(e));
  };
  const refresh = useAction({
    run: () => api<{ sync: { added: number; removed: number } | null }>(`/api/lists/${listId}/source/refresh`, { method: "POST", json: {} }),
    success: (r) => (r.sync ? t("sourceSynced", { added: r.sync.added, removed: r.sync.removed }) : t("sourceUpToDate")),
    error: words,
    sync: onChange,
  });
  const unfollow = async () => {
    const ok = await confirm({
      title: t("sourceDisconnectTitle", { name: source.name }),
      text: t("sourceDisconnectConfirm"),
      confirmLabel: t("sourceDisconnect"),
      tone: "primary",
      action: () => api(`/api/lists/${listId}/source`, { method: "DELETE" }),
    });
    if (!ok) return;
    toast.success(t("sourceDisconnected", { name: source.name }));
    void onChange();
  };

  const problem = source.status === "not_found" ? t("sourceGone") : source.status === "unavailable" ? t("sourceUnavailable") : source.status === "pending" ? t("sourcePending") : null;
  const facts = [
    source.owner && t("sourceBy", { name: source.owner }),
    source.lastSyncedAt ? t("sourceLastSync", { when: relativeTime(source.lastSyncedAt, locale, tr("common.justNow")) }) : null,
    source.dynamic ? t("sourceDynamicShort") : null,
  ].filter(Boolean);

  return (
    <InlineAlert
      tone={problem && source.status !== "pending" ? "warning" : "info"}
      className="mb-6"
      title={t("sourceFollowsMdb", { name: source.name })}
      action={
        isOwner && (
          <div className="flex flex-wrap gap-1">
            <Button variant="tertiary" size="sm" icon={RefreshCw} loading={refresh.pending} onClick={() => void refresh.run()}>
              {t("sourceRefresh")}
            </Button>
            <Button variant="tertiary" size="sm" icon={Unlink} onClick={() => void unfollow()}>
              {t("sourceDisconnect")}
            </Button>
          </div>
        )
      }
    >
      {problem && <span className="block text-text-1">{problem}</span>}
      {facts.length > 0 && <span className="block">{facts.join(" · ")}</span>}
      <span className="block">
        {t("sourceRules")}{" "}
        {source.total !== null && source.total > source.limit && `${t("sourceLimit", { limit: source.limit })} `}
        {/* A 44 px target on a phone, 32+ on a computer (5.6, LIB-28): padding taken back by a negative margin, so the line stays as it is. */}
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="-my-3.5 inline-flex items-center gap-1 py-3.5 underline underline-offset-3 hover:text-text-1 md:-my-2 md:py-2"
        >
          {t("sourceOpen")}
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      </span>
    </InlineAlert>
  );
}
