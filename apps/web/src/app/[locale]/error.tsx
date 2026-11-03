"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useTransition } from "react";
import { FocusCard } from "@/components/shell/FocusCard";
import { Shell } from "@/components/shell/Shell";
import { Button, buttonClass } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { RATE_LIMITED_DIGEST } from "@/lib/api";

const CHUNK_RELOAD_KEY = "lumovio:chunk-reload";

/**
 * Route-level error boundary (SH-02): the Focus template inside the shell, "Retry" that really asks the server again
 * (Next 16.4 `retry` re-fetches and re-renders the segment; `reset` alone only clears the client state) and "To the
 * home page"; plus a privacy-safe client error report.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  // The API's rate limit on a server render (api.ts): "Too many requests", not a failure to report (React #441 reports).
  const limited = error instanceof Error && (error as Error & { digest?: string }).digest === RATE_LIMITED_DIGEST;
  useEffect(() => {
    if (limited) return;
    const e = error instanceof Error ? (error as Error & { digest?: string }) : null;
    // A tab opened before a deploy asks for code the new build no longer has: the page loads again, once a minute at
    // most, instead of saying the server failed (most "render" reports in the admin, 2026-10-29).
    if (/Failed to load chunk|ChunkLoadError|Loading chunk .+ failed/.test(e?.message ?? "")) {
      try {
        const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY));
        if (!(Date.now() - last < 60_000)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        // Without storage the error page stays, as before.
      }
    }
    void (async () => {
      try {
        await fetch("/api/client-errors", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "render",
            message: (e?.digest ? `${e.digest}: ` : "") + (e?.message ?? String(error)).slice(0, 400),
            url: window.location.pathname,
          }),
        });
      } catch {
        // The report is best effort: the error page itself must not fail on it.
      }
    })();
  }, [error, limited]);
  return (
    <Shell overlay>
      <title>{`${t("errors.serverTitle")} · ${t("common.appName")}`}</title>
      <FocusCard icon={TriangleAlert} title={t("errors.serverTitle")} text={t(limited ? "errors.rateLimited" : "errors.serverText")}>
        <Button
          icon={RefreshCw}
          loading={pending}
          onClick={() => start(retry)}
        >
          {t("common.retry")}
        </Button>
        <Link href="/" className={buttonClass("secondary")}>
          {t("shell.toHome")}
        </Link>
      </FocusCard>
    </Shell>
  );
}
