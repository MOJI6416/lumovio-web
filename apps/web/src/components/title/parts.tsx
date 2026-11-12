"use client";

import { type ComponentProps, type ComponentType, lazy, type ReactNode, Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

/*
 * The client parts of the title page's sections as chunks of their own (bundle budget): the page's
 * first load carries the hero, and each section's code comes on its own. React.lazy: rendered on the server like any
 * client component, hydrated once its chunk is there. (next/dynamic would add a preload hint whose chunk name the dev
 * server doesn't serve.)
 */

const rows = (
  <div className="page-x flex flex-col gap-3">
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
export const RelatedShelves = part(() => import("./RelatedShelves").then((m) => m.RelatedShelves));
export const VideoShelf = part(() => import("./VideoShelf").then((m) => m.VideoShelf));
export const PeopleRows = part(() => import("./PeopleRows").then((m) => m.PeopleRows));
export const RatingsSection = part(() => import("./RatingsSection").then((m) => m.RatingsSection), <div className="page-x"><Skeleton className="h-48 w-full" /></div>);
export const Soundtrack = part(() => import("./Soundtrack").then((m) => m.Soundtrack));
export const ExternalLinks = part(() => import("./ExternalLinks").then((m) => m.ExternalLinks));
export const FactsInfo = part(() => import("@/components/sources/InfoTip").then((m) => m.InfoTip));
