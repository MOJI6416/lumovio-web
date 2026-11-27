"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const AGAIN_MS = 4_000;
const TRIES = 20;

/**
 * A page the catalog is still loading details for (its answer was `pending`): the server's page is asked again every
 * few seconds, for about a minute and a half — what came is shown in place, the rest of the page stays as it is. Gone
 * once an answer is complete (the page renders without it).
 */
export function RefreshWhilePending() {
  const router = useRouter();
  useEffect(() => {
    let left = TRIES;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (left-- <= 0) clearInterval(timer);
      else router.refresh();
    }, AGAIN_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
