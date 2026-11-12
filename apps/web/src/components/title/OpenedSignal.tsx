"use client";

import { useEffect } from "react";
import { useSession } from "@/components/providers/Providers";
import { background } from "@/lib/optional";

/** Seconds in view before the page counts as opened: passing through on the way elsewhere doesn't. */
const STAY_SEC = 8;

/**
 * Tells recommendations the profile stayed on this title's page (a weak signal): once per title and
 * day in this tab, after STAY_SEC seconds while the page is visible. The server keeps nothing while the profile's
 * "Use opened pages" is off. Renders nothing.
 */
export function OpenedSignal({ titleId }: { titleId: string }) {
  const { me } = useSession();
  const profileId = me?.activeProfile?.id;
  useEffect(() => {
    if (!profileId) return;
    const key = `lumovio:opened:${profileId}:${titleId}:${new Date().toISOString().slice(0, 10)}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* storage blocked: the server keeps one row per day anyway */
    }
    let seen = 0;
    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (++seen < STAY_SEC) return;
      window.clearInterval(tick);
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        /* see above */
      }
      background(fetch("/api/recommendations/opened", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ titleId }), credentials: "include" }));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [profileId, titleId]);
  return null;
}
