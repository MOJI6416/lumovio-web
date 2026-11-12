"use client";

import { useLocale } from "next-intl";
import { lazy, Suspense } from "react";
import { SectionSkeleton } from "./GridSkeleton";
import type { LibrarySection } from "./sections";

// Each part is its own chunk (bundle budget): the page loads the open one only — the history's and ratings' menus,
// the lists' dialogs come with their pages. React.lazy, not next/dynamic (which costs more than it splits here).
const LibraryOverview = lazy(() => import("./LibraryOverview").then((m) => ({ default: m.LibraryOverview })));
const CollectionTab = lazy(() => import("./CollectionTab").then((m) => ({ default: m.CollectionTab })));
const HistoryTab = lazy(() => import("./HistoryTab").then((m) => ({ default: m.HistoryTab })));
const RatingsTab = lazy(() => import("./RatingsTab").then((m) => ({ default: m.RatingsTab })));
const ListsTab = lazy(() => import("./ListsTab").then((m) => ({ default: m.ListsTab })));
const ServersTab = lazy(() => import("./ServersTab").then((m) => ({ default: m.ServersTab })));

/**
 * The library: its screen of shelves, or one of its collections on a page of its own (`?tab=`) — the page
 * (`app/…/library/page.tsx`) brings the heading, "← Library" over it on a collection's page.
 */
export function LibraryView({ section }: { section: LibrarySection | null }) {
  const locale = useLocale();
  return (
    <Suspense fallback={<SectionSkeleton section={section} />}>
      {section === null && <LibraryOverview />}
      {section === "servers" && <ServersTab />}
      {(section === "watchlist" || section === "favorites") && <CollectionTab key={section} kind={section} locale={locale} />}
      {section === "history" && <HistoryTab />}
      {section === "ratings" && <RatingsTab />}
      {section === "lists" && <ListsTab />}
    </Suspense>
  );
}
