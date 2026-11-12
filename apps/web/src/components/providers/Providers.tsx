"use client";

import type { Me } from "@lumovio/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { ApiRequestError, setClientLocale } from "@/lib/api";
import { shareStore } from "../share/share";
import { BackCover } from "../shell/BackCover";
import { Toaster, toast } from "../ui/Toast";

// The share window (fields, QR) loads only once something is shared, not with every page (bundle budget).
const ShareHost = dynamic(() => import("../share/ShareDialog").then((m) => m.ShareHost), { ssr: false });
const sharing = () => shareStore.get() !== null;

function LazyShareHost() {
  const open = useSyncExternalStore(shareStore.subscribe, sharing, () => false);
  return open ? <ShareHost /> : null;
}

// The speed meter (`?perf=1`, performance handoff §5.2) loads only in a tab that turned it on.
const PerfMeter = dynamic(() => import("../perf/PerfMeter").then((m) => m.PerfMeter), { ssr: false });
const PERF_KEY = "lumovio.perf";

function PerfGate({ tv }: { tv: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const asked = new URLSearchParams(location.search).get("perf");
    try {
      if (asked === "1") sessionStorage.setItem(PERF_KEY, "1");
      if (asked === "0") sessionStorage.removeItem(PERF_KEY);
      setOn(sessionStorage.getItem(PERF_KEY) === "1");
    } catch {
      setOn(asked === "1");
    }
    // The page's own speed in the field (lib/vitals), once the page is idle: not with the first JS.
    const start = () => void import("@/lib/vitals").then((m) => m.startVitals(tv));
    if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 4000 });
    else setTimeout(start, 2000);
  }, [tv]);
  const off = () => {
    try {
      sessionStorage.removeItem(PERF_KEY);
    } catch {
      // Without storage it was on for this page only.
    }
    setOn(false);
  };
  return on ? <PerfMeter tv={tv} onOff={off} /> : null;
}

/**
 * The e-mailed link that deletes the account lands on home with `?account=deleted` (PrivacySettings): said once, then
 * the address is cleaned — the person came as a guest with no word of it (stand QA, 2026-11-06).
 */
function AccountDeletedNotice() {
  const t = useTranslations("settings");
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("account") !== "deleted") return;
    url.searchParams.delete("account");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    toast.success(t("accountDeleted"));
  }, [t]);
  return null;
}

interface Session {
  me: Me | null;
  /** /api/me didn't answer (network, timeout, 5xx): `me` is unknown, not "signed out" (SH-03). */
  apiDown: boolean;
  tv: boolean;
  locale: string;
}

const SessionContext = createContext<Session>({ me: null, apiDown: false, tv: false, locale: "en" });

export const useSession = () => useContext(SessionContext);
// The clean-up of what Lumovio added to the profile's TorrServers (lib/media/torrent-sweep, docs/torrserver-2026-11.md
// 18а): an adult profile's, at most every 12 hours on a device, 15 s after a page opens — never on the player's page,
// whose start shares the server (23б), nor the TV's. Without storage it doesn't run (it would on every page).
const SWEEP_EVERY_MS = 12 * 3_600_000;

function TorrentSweep({ profileId, client }: { profileId: string; client: QueryClient }) {
  useEffect(() => {
    if (/(^|\/)watch(\/|$)/.test(location.pathname)) return;
    const key = `lumovio.sweep.${profileId}`;
    try {
      if (Date.now() - Number(localStorage.getItem(key) ?? 0) < SWEEP_EVERY_MS) return;
    } catch {
      return;
    }
    const run = () => void import("@/lib/media/torrent-sweep").then((m) => m.sweepProfile(key, client)).catch(() => {}); // ui-lint-ignore swallowed-error: housekeeping; a failed clean-up is tried again in 12 hours, unsaid
    const timer = setTimeout(run, 15_000);
    return () => clearTimeout(timer);
  }, [profileId, client]);
  return null;
}

export function Providers({ children, me, apiDown = false, locale, tv }: { children: ReactNode; me: Me | null; apiDown?: boolean; locale: string; tv: boolean }) {
  setClientLocale(locale);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: (count, err) => !(err instanceof ApiRequestError && err.status > 0 && err.status < 500) && count < 2,
          },
        },
      }),
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Without the worker the site works the same, only the offline page is missing.
      }
    })();
  }, []);

  return (
    <SessionContext.Provider value={{ me, apiDown, tv, locale }}>
      <QueryClientProvider client={client}>
        {children}
        <Toaster />
        {!tv && <LazyShareHost />}
        <PerfGate tv={tv} />
        {!tv && <AccountDeletedNotice />}
        {!tv && <BackCover />}
        {!tv && me?.activeProfile && !me.activeProfile.isKids && <TorrentSweep profileId={me.activeProfile.id} client={client} />}
      </QueryClientProvider>
    </SessionContext.Provider>
  );
}
