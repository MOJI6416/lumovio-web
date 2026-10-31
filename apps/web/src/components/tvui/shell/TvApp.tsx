"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { TvLayer } from "../nav/TvLayer";
import { TvNavProvider } from "../nav/TvNav";
import { ContinueOnPhone } from "./ContinueOnPhone";

/** Announcements load apart from the TV shell's code: they're rare. */
const TvAnnouncements = dynamic(() => import("./TvAnnouncements").then((m) => m.TvAnnouncements), { ssr: false });

/**
 * The root of the TV shell (app/[locale]/tvui): the remote's navigation, the screen that never scrolls as a page, and
 * the host of its layers (tvui/nav/TvLayer), outside `data-tv-app` so that one can be made inert under them.
 */
export function TvApp({ children }: { children: ReactNode }) {
  return (
    <TvNavProvider>
      <div data-tv-root className="fixed inset-0 overflow-hidden bg-bg text-text-1">
        <div data-tv-app className="h-full">
          {children}
        </div>
        <div id="tv-layers" />
        <ExternalLinks />
        <TvAnnouncements />
      </div>
    </TvNavProvider>
  );
}

/**
 * The TV app (apps/tv-android) opens nothing but the site: an address elsewhere (a service's page, a legal source) comes
 * here as `lumovio:external` and is offered as a QR code to open on a phone.
 */
function ExternalLinks() {
  const t = useTranslations("tvui");
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const on = (e: Event) => setUrl((e as CustomEvent<string>).detail);
    window.addEventListener("lumovio:external", on);
    return () => window.removeEventListener("lumovio:external", on);
  }, []);
  if (!url) return null;
  return (
    <TvLayer look="dialog" className="max-w-240" label={t("phoneTitle")} onClose={() => setUrl(null)}>
      {() => <ContinueOnPhone url={url} title={t("phoneTitle")} text={t("externalText")} />}
    </TvLayer>
  );
}
