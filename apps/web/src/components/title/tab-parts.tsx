"use client";

import { type ComponentProps, type ComponentType, lazy, type ReactNode, Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

/*
 * The title's tabs are drawn by the server one at a time (?tab=), and the code of each comes with it: these are the
 * tabs' client parts as chunks of their own, so a page doesn't ship the code of the tabs that aren't open (bundle
 * budget, brief Ф4 item 7). React.lazy: rendered on the server like any client component, hydrated once its chunk is
 * there; on a tab switch the chunk loads with the tab and its skeleton shows meanwhile. (next/dynamic would add a
 * preload hint whose chunk name the dev server doesn't serve.)
 */

const rows = (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-20 w-full" />
  </div>
);

// biome-ignore lint/suspicious/noExplicitAny: any component's props pass through
function part<C extends ComponentType<any>>(load: () => Promise<C>, fallback: ReactNode = null) {
  const Lazy = lazy(async () => ({ default: await load() }));
  // biome-ignore lint/correctness/noComponentHookFactories: made once per part, at module level, below
  return function Part(props: ComponentProps<C>) {
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}

export const SeasonBrowser = part(() => import("./SeasonBrowser").then((m) => m.SeasonBrowser), rows);
export const Availability = part(() => import("./Availability").then((m) => m.Availability), rows);
export const RelatedTab = part(() => import("./RelatedTab").then((m) => m.RelatedTab), <div className="page-x">{rows}</div>);
export const VideosTab = part(() => import("./VideosTab").then((m) => m.VideosTab), <div className="page-x">{rows}</div>);
export const PeopleRows = part(() => import("./PeopleRows").then((m) => m.PeopleRows));
export const RatingsSection = part(() => import("./RatingsSection").then((m) => m.RatingsSection), <Skeleton className="h-48 w-full" />);
export const Soundtrack = part(() => import("./Soundtrack").then((m) => m.Soundtrack));
export const ExternalLinks = part(() => import("./ExternalLinks").then((m) => m.ExternalLinks));
export const FactsInfo = part(() => import("@/components/sources/InfoTip").then((m) => m.InfoTip));
