"use client";

import { CircleAlert, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { TvButton } from "@/components/ui/tv/TvButton";
import { SITE_URL } from "@/lib/seo";
import { TV_APP_MIN_VERSION, tvAppToUpdate } from "@/lib/tv";
import { TvLayer } from "../nav/TvLayer";

/** The newest TV app the site offers (public/downloads/lumovio-tv.json, read at build time by next.config.ts). */
function latestApp(): string | null {
  try {
    return process.env.LUMOVIO_TV_APP ? ((JSON.parse(process.env.LUMOVIO_TV_APP) as { versionName?: string }).versionName ?? null) : null;
  } catch {
    return null;
  }
}

const ASKED = "tv.app-update-asked";

/**
 * The TV app is older than the site's minimum (lib/tv.ts): a dialog over the first
 * screen, once per start of the app (its WebView's session), says so and how. The app's own way is its update offer
 * when it starts — so "Leave Lumovio" asks the app's own question to leave, and opened again it offers the new
 * version; or the APK by Downloader. "Not now" keeps going with the old app.
 */
export function TvAppUpdate() {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    const v = tvAppToUpdate(navigator.userAgent, latestApp());
    if (!v) return;
    try {
      if (sessionStorage.getItem(ASKED)) return;
      sessionStorage.setItem(ASKED, "1");
    } catch {
      // No storage: asked on every page load of the app, still closed with "Not now".
    }
    setVersion(v);
  }, []);
  return version ? <UpdateDialog version={version} onClose={() => setVersion(null)} /> : null;
}

function UpdateDialog({ version, onClose }: { version: string; onClose: () => void }) {
  const t = useTranslations("tvui");
  const app = (window as { LumovioTV?: { exitPrompt?: () => void } }).LumovioTV;
  const address = `${SITE_URL.replace(/^https?:\/\//, "")}/apk`;
  return (
    <TvLayer look="dialog" className="max-w-200" label={t("updateTitle")} onClose={onClose}>
      {(close) => (
        <>
          <CircleAlert aria-hidden className="size-14 text-warning" />
          <h2 className="text-h2 text-text-1">{t("updateTitle")}</h2>
          <p className="text-body-l text-text-2">
            {t("updateText", { version, min: TV_APP_MIN_VERSION, address })}
          </p>
          <div data-zone="update" data-zone-axis="x" className="flex flex-wrap gap-4">
            {app?.exitPrompt && (
              <TvButton icon={LogOut} data-tv-initial onClick={() => app.exitPrompt?.()}>
                {t("updateLeave")}
              </TvButton>
            )}
            <TvButton onClick={close}>{t("updateLater")}</TvButton>
          </div>
        </>
      )}
    </TvLayer>
  );
}
