"use client";

import type { SetupState } from "@lumovio/contracts";
import { lazy, Suspense } from "react";

// Only a new account sees "Finish setting up": its code is a chunk of its own, not in every visitor's first load
// (React.lazy rather than next/dynamic, which costs more than it splits here).
const SetupShelf = lazy(() => import("./SetupShelf").then((m) => ({ default: m.SetupShelf })));

/** The home page's "Finish setting up", loaded only where it is shown. */
export function SetupShelfLazy({ state }: { state: SetupState }) {
  return (
    <Suspense fallback={null}>
      <SetupShelf state={state} />
    </Suspense>
  );
}
