"use client";

import type { Me } from "@lumovio/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { ApiRequestError, setClientLocale } from "@/lib/api";
import { BackCover } from "../shell/BackCover";
import { Toaster } from "../ui/Toast";

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
        {!tv && <BackCover />}
      </QueryClientProvider>
    </SessionContext.Provider>
  );
}
