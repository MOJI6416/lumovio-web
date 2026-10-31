"use client";

import type { Me } from "@lumovio/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { ApiRequestError, setClientLocale } from "@/lib/api";
import { shareStore } from "../share/share";
import { BackCover } from "../shell/BackCover";
import { Toaster } from "../ui/Toast";

// The share window (fields, QR) loads only once something is shared, not with every page (bundle budget).
const ShareHost = dynamic(() => import("../share/ShareDialog").then((m) => m.ShareHost), { ssr: false });
const sharing = () => shareStore.get() !== null;

function LazyShareHost() {
  const open = useSyncExternalStore(shareStore.subscribe, sharing, () => false);
  return open ? <ShareHost /> : null;
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
        {!tv && <BackCover />}
      </QueryClientProvider>
    </SessionContext.Provider>
  );
}
