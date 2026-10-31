"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { lazy, Suspense } from "react";
import { LinkTabPanel, LinkTabs } from "@/components/ui/Tabs";
import { usePathname } from "@/i18n/navigation";
import { TabSkeleton } from "./GridSkeleton";
import { FILTER_KEYS } from "./url-state";

// Each tab is its own chunk (bundle budget): the page loads the open tab only — the history's and ratings' menus,
// the lists' dialogs come with their tabs. React.lazy, not next/dynamic (which costs more than it splits here).
const LibraryOverview = lazy(() => import("./LibraryOverview").then((m) => ({ default: m.LibraryOverview })));
const CollectionTab = lazy(() => import("./CollectionTab").then((m) => ({ default: m.CollectionTab })));
const HistoryTab = lazy(() => import("./HistoryTab").then((m) => ({ default: m.HistoryTab })));
const RatingsTab = lazy(() => import("./RatingsTab").then((m) => ({ default: m.RatingsTab })));
const ListsTab = lazy(() => import("./ListsTab").then((m) => ({ default: m.ListsTab })));

export const LIBRARY_TABS = ["overview", "watchlist", "favorites", "history", "ratings", "lists"] as const;
export type LibraryTab = (typeof LIBRARY_TABS)[number];

/**
 * The library (S09, Collection template): the tabs first, right under the page's h1 (LIB-02) — "Overview" with the
 * shelves, then the collections. The tab is in the address (`?tab=`, 7.5, 8.7); the filters travel with it, so
 * "Films only" stays on when "Favourites" is opened (LIB-10); the sort belongs to its tab.
 */
export function LibraryView() {
  const t = useTranslations("library");
  const locale = useLocale();
  const params = useSearchParams();
  const pathname = usePathname();
  const tab = (LIBRARY_TABS.includes(params.get("tab") as LibraryTab) ? params.get("tab") : "overview") as LibraryTab;
  const href = (k: LibraryTab) => {
    const sp = new URLSearchParams();
    if (k !== "overview") sp.set("tab", k);
    for (const f of FILTER_KEYS) {
      const v = params.get(f);
      if (v) sp.set(f, v);
    }
    // A smart list's "Edit conditions" stays on between the tabs its titles come from (package F).
    const editing = params.get("editList");
    if (editing && (k === "watchlist" || k === "favorites")) sp.set("editList", editing);
    const qs = sp.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <LinkTabs className="mb-6 md:mb-8" label={t("title")} panelId="library-tab" activeId={tab} tabs={LIBRARY_TABS.map((k) => ({ id: k, href: href(k), label: t(k) }))} />
      <LinkTabPanel panelId="library-tab" activeId={tab}>
        <Suspense fallback={<TabSkeleton tab={tab} />}>
          {tab === "overview" && <LibraryOverview />}
          {(tab === "watchlist" || tab === "favorites") && <CollectionTab key={tab} kind={tab} locale={locale} />}
          {tab === "history" && <HistoryTab />}
          {tab === "ratings" && <RatingsTab />}
          {tab === "lists" && <ListsTab />}
        </Suspense>
      </LinkTabPanel>
    </div>
  );
}
