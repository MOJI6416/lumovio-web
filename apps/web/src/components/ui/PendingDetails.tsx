"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { buttonClass } from "./button-class";
import { EmptyState } from "./EmptyState";

/** How often the page asks again, and for how long before it says the details haven't come. */
const EVERY_MS = 5_000;
const FOR_MS = 120_000;

/**
 * Details the catalog is still loading (a title or person it knows only briefly): the page shows what there is and
 * asks the server again every few seconds — a refresh in place, the scroll, the focus and open dialogs stay — until the
 * answer is complete (then this part is gone). After two minutes it says so, with "Retry". `quiet` (a TV) — the asking
 * without the line.
 */
export function PendingDetails({ quiet = false, demo }: { quiet?: boolean; /** The showcase: one state, without asking. */ demo?: "loading" | "stopped" }) {
  const t = useTranslations();
  const router = useRouter();
  // Since when it asks: "Retry" starts the two minutes again.
  const [since, setSince] = useState(() => Date.now());
  const [stopped, setStopped] = useState(false);
  useEffect(() => {
    if (demo) return;
    setStopped(false);
    const timer = setInterval(() => {
      if (Date.now() - since > FOR_MS) {
        clearInterval(timer);
        setStopped(true);
        return;
      }
      // A tab out of sight doesn't ask: it asks on its next turn, when it is seen again.
      if (document.visibilityState === "visible") router.refresh();
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [since, router, demo]);
  if (quiet) return null;
  if (stopped || demo === "stopped")
    return (
      <EmptyState
        variant="inline"
        role="status"
        title={t("titlePage.detailsNotLoaded")}
        action={
          // A plain button in Button's look: Button and Progress bring icons, and pages show this rarely.
          <button
            type="button"
            className={buttonClass("tertiary", "sm")}
            onClick={() => {
              router.refresh();
              setSince(Date.now());
            }}
          >
            {t("common.retry")}
          </button>
        }
      />
    );
  return (
    <div role="status" className="flex min-h-11 flex-col justify-center gap-2">
      <p className="text-body text-text-2">{t("titlePage.detailsLoading")}</p>
      {/* Progress's running stripe, without the module's step icons. */}
      <div role="progressbar" aria-label={t("titlePage.detailsLoading")} className="h-1 w-40 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: "linear-gradient(100deg, transparent 30%, var(--progress) 50%, transparent 70%)",
            backgroundSize: "300% 100%",
            animation: "shimmer 1.6s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}
