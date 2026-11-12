"use client";

import type { ListDetails, ListSource } from "@lumovio/contracts";
import { type InfiniteData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, ExternalLink, ListVideo, Search, Share2, SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { PosterCard } from "@/components/media/PosterCard";
import { useSession } from "@/components/providers/Providers";
import { sharePage } from "@/components/share/share";
import { ProfileAvatar } from "@/components/ui/Avatar";
import { Button, buttonClass } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LoadMore } from "@/components/ui/LoadMore";
import { SearchInput } from "@/components/ui/Input";
import { lazyControl, useLazySwap, useStandIn } from "@/components/ui/lazy-swap";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "@/components/ui/Toast";
import { libraryKey } from "@/hooks/useLibraryState";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { CollectionToolbar } from "./CollectionToolbar";
import { GridSkeleton } from "./GridSkeleton";
import { ListGrid } from "./ListGrid";
import type { ListDialog } from "./ListMenu";
import { rulesHref } from "./rules-url";
import { sortItems, useTitleSorts } from "./sorting";
import { readFilters, readSort, useUrlState } from "./url-state";
import { mergedItems } from "./whole-list";

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
/** Cards drawn at a time: a Top 250 isn't 13 000 px of posters at once; "Show more" draws the next ones. */
const PAGE = 60;

/**
 * A list (the Collection template): "← Lists" for its members, the name, the owner's
 * description, one line of facts — who sees it (the owner), whose it is (anyone else), the members as faces and names
 * that open "Members", where a followed list comes from — and the actions: "Share" (when it isn't private), a smart
 * list's "Edit conditions" (its owner), "More" (edit, members, invite, refresh or unfollow, delete or leave). A smart
 * list's conditions stand under the heading as labels. The filters, the sort and a search over the grid edge to edge,
 * drawn 60 at a time; a title leaves from its card's "More" with "Undo". "Added by" is said only where more
 * than one person added titles. The server sends the list page by page: "Show more" goes on to the next one,
 * and a search, a type chip or a sort first loads the rest, so they work on the whole list.
 */
export function ListView({ initial }: { initial: ListDetails }) {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const tr = useTranslations();
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
    // A smart list being filled by its conditions is asked again until it is (about two minutes at most).
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

  // A title is removed at once, with "Undo"; the card's state, the lists' counts and covers follow.
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

  const share = () => sharePage({ title: l.name, url: window.location.href.split("?")[0]! });

  // Deleting and leaving are confirmed first; the request runs in the dialog.
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

  // Unfollowing keeps every title as an ordinary list: asked as a question, not as a deletion; "Undo" isn't offered
  // (following again re-reads the list).
  const unfollow = async () => {
    const source = l.source;
    if (!source) return;
    const ok = await confirm({
      title: t("sourceDisconnectTitle", { name: source.name }),
      text: t("sourceDisconnectConfirm"),
      confirmLabel: t("sourceDisconnect"),
      tone: "primary",
      action: () => api(`/api/lists/${l.id}/source`, { method: "DELETE" }),
    });
    if (!ok) return;
    toast.success(t("sourceDisconnected", { name: source.name }));
    void refresh();
  };

  // A member came here from their library: "← Lists" (or the system list's page) over the h1.
  const back = !isMember ? undefined : custom ? { href: "/library?tab=lists", label: t("lists") } : { href: `/library?tab=${l.kind}`, label: t(l.kind) };

  const needle = query.trim().toLocaleLowerCase(locale);
  // A search, a type chip or a sort works on the whole list: the pages not loaded yet come first. So does
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
  // The type chips only where the list holds both films and series (a page not loaded yet may: then they stay).
  const mixed = q.hasNextPage || (l.items.some((i) => i.title.kind === "movie") && l.items.some((i) => i.title.kind === "tv"));
  // "Added by" only says something where more than one person added titles.
  const adders = new Set(l.items.map((i) => i.addedBy?.profileId).filter(Boolean));
  const byWhom = l.collaborative && adders.size > 1;

  const moreLabel = t("listMoreLabel", { list: l.name });
  const showMenu = (custom || isOwner) && isMember;
  const menu =
    showMenu &&
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
        onUnfollow={() => void unfollow()}
        onChange={refresh}
      />
    ) : (
      <IconButton ref={moreLight} icon={Ellipsis} variant="secondary" label={moreLabel} aria-haspopup="menu" aria-expanded={false} {...moreIn.handlers} />
    ));
  const editRules = isOwner && l.rules && (
    <Link href={rulesHref(l.rules.rules, l.id)} className={buttonClass("secondary")}>
      <SlidersHorizontal aria-hidden />
      {t("rulesEdit")}
    </Link>
  );

  // The line of facts under the name: who sees it (the owner) or whose it is, a followed list's source.
  const who = isOwner ? t(`visibility_${l.visibility}`) : t("ownerIs", { name: l.owner.name });
  const facts = [who, l.collaborative && t("collaborative"), l.source && <SourceFact key="source" source={l.source} />].filter(Boolean);
  const problem = l.source && (l.source.status === "not_found" ? t("sourceGone") : l.source.status === "unavailable" ? t("sourceUnavailable") : l.source.status === "pending" ? t("sourcePending") : null);

  return (
    <div>
      <PageHeader
        back={back}
        title={l.name}
        description={
          <>
            {l.description && <span className="block">{l.description}</span>}
            <span className={l.description ? "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-s" : "flex flex-wrap items-center gap-x-2 gap-y-1 text-body-s"}>
              {l.members.length > 1 && (
                // The members as faces and names: the way to "Members" (roles, removing a profile).
                <Button variant="tertiary" size="sm" onClick={() => setDialog("members")} aria-label={`${t("members")}: ${l.members.map((m) => m.name).join(", ")}`} className="-ms-3">
                  <span className="flex -space-x-1.5">
                    {l.members.slice(0, 4).map((m) => (
                      <ProfileAvatar key={m.profileId} avatar={m.avatar} photo={m.photo} name={m.name} size={20} className="ring-2 ring-bg" />
                    ))}
                  </span>
                  <span className="max-w-64 truncate">{l.members.map((m) => m.name).join(", ")}</span>
                </Button>
              )}
              {facts.map((f, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed line of facts
                <span key={i} className="inline-flex items-center gap-2">
                  {(i > 0 || l.members.length > 1) && <span aria-hidden>·</span>}
                  {f}
                </span>
              ))}
            </span>
          </>
        }
        actions={
          (l.visibility !== "private" || editRules || menu) && (
            <>
              {editRules}
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

      {problem && <InlineAlert tone={l.source?.status === "pending" ? "info" : "warning"} className="mb-6" title={problem} />}
      {l.rules && (
        <Suspense>
          <RulesNotice list={l} isOwner={isOwner} canEdit={canEdit} />
        </Suspense>
      )}
      {/* What a followed list does with titles, for a screen reader. */}
      {l.source && (
        <p className="sr-only">
          {tr("library.sourceRules")} {l.source.total !== null && l.source.total > l.source.limit ? t("sourceLimit", { limit: l.source.limit }) : ""}
        </p>
      )}

      {l.items.length === 0 && q.hasNextPage ? (
        // A first page a kids profile sees nothing of: the next one comes, or the way to ask for it again.
        isFetchNextPageError ? (
          <LoadMore failed className="flex justify-center" onMore={() => void fetchNextPage()} loading={isFetchingNextPage} />
        ) : (
          <GridSkeleton />
        )
      ) : l.items.length === 0 && l.rules?.status === "pending" ? (
        // A smart list being filled by its conditions: its titles come in a moment (the line above says so).
        <GridSkeleton />
      ) : l.items.length === 0 && l.rules ? (
        // A smart list whose conditions match nothing now: they can be changed, or it fills by itself later.
        <EmptyState
          icon={ListVideo}
          title={t("rulesEmpty")}
          about={isOwner ? t("rulesEmptyHint") : t("emptyListReader")}
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
          about={canEdit ? t("emptyListHint") : t("emptyListReader")}
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
            types={mixed}
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
              <ListGrid>
                {shownItems.map((i) => (
                  <PosterCard
                    key={i.title.id}
                    title={i.title}
                    subtitle={byWhom && i.addedBy ? t("addedBy", { name: i.addedBy.name }) : (l.source || l.rules) && !i.fromSource ? t("sourceOwnAddition") : undefined}
                    // Removing is in the card's "More", seen on touch screens too.
                    more={canEdit ? { remove: { label: t("removeFromList"), run: () => void removeTitle.run(i) } } : true}
                    moreVisibility={canEdit ? "always" : undefined}
                  />
                ))}
              </ListGrid>
              {/* The next page that didn't come: what is here stays, Retry in the button's place. */}
              <LoadMore
                onMore={showMore}
                onRetry={() => void fetchNextPage()}
                loading={isFetchingNextPage}
                failed={isFetchNextPageError}
                hasMore={items.length > shownItems.length || q.hasNextPage}
                shown={shownItems.length}
                total={total}
              />
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
 * Where a followed list comes from, as one fact of the line under its name: "MDBList · by snoak · updated
 * 23 Oct", the source's own page as a link (44 px on a phone). Refreshing and unfollowing are in "More"; a problem is
 * a warning over the grid.
 */
function SourceFact({ source }: { source: ListSource }) {
  const t = useTranslations("library");
  const tr = useTranslations();
  const locale = useLocale();
  const parts = [
    source.owner && t("sourceBy", { name: source.owner }),
    source.lastSyncedAt ? t("sourceLastSync", { when: relativeTime(source.lastSyncedAt, locale, tr("common.justNow")) }) : null,
    source.dynamic ? t("sourceDynamicShort") : null,
  ].filter(Boolean);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`${t("sourceOpen")}: ${source.name}`}
        className="-my-3.5 inline-flex items-center gap-1 py-3.5 text-text-1 underline underline-offset-3 md:-my-2 md:py-2"
      >
        MDBList
        <ExternalLink aria-hidden className="size-3.5" />
      </a>
      {parts.length > 0 && <span>{parts.join(" · ")}</span>}
    </span>
  );
}
