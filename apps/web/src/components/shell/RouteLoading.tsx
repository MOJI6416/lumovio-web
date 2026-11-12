"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { BrandIntro, BrandLoader } from "@/components/ui/BrandMotion";

const subscribe = () => () => {};

/**
 * What a layout's page shows while its data comes (BootBoundary) — only once the wait is
 * noticeable (--loader-delay), so a quick page comes without a flash.
 *
 * The first page of a visit is rendered by the server, and its loading state is the brand intro on the stage over the
 * whole window until the page is there (a page that is ready sooner cuts it short; no minimum wait). A layout entered
 * later, in the browser (from "Who's watching?" to the home page), keeps the header: the loader in the page's place, or
 * on the stage for the player. The server's snapshot also holds while that first HTML hydrates, so the two never mismatch.
 *
 * `tv` (the TV shell): the first screen continues the TV app's native launch mark (apps/tv-android, the loader's own
 * shape at 128 dp in the middle) — the same mark at once, then breathing from its brightest point, with no intro; a later
 * screen has the loader in the screen's place beside the menu.
 */
export function RouteLoading({ stage, tv }: { stage?: boolean; tv?: boolean }) {
  const t = useTranslations("common");
  const first = useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
  if (first && tv)
    return (
      <div role="status" aria-label={t("loading")} className="stage fixed inset-0 z-scrim grid place-items-center bg-stage">
        <BrandLoader className="boot-tv size-[128px]" />
      </div>
    );
  if (first)
    return (
      <>
        {/* The page's place holds the window's height under the intro: else the footer stood in the window and the
            page coming in pushed it out — a layout shift of 1.0 on every first page. */}
        <div aria-hidden className="min-h-dvh" />
        {/* The page's own colour at once (the header isn't shown and then covered); the stage and the intro from the delay. */}
        <div role="status" aria-label={t("loading")} className="fixed inset-0 z-scrim bg-bg">
          <div className="boot stage loader-appear absolute inset-0 grid place-items-center bg-stage">
            <BrandIntro className="w-[min(80vw,30rem)]" />
          </div>
        </div>
      </>
    );
  return (
    <div
      role="status"
      aria-label={t("loading")}
      className={clsx(
        "loader-appear grid place-items-center",
        // Under the header the whole screen's height, so the footer doesn't come up and go down again.
        tv ? "h-full" : stage ? "stage min-h-dvh bg-stage" : "min-h-[calc(100dvh-var(--header-h))]",
      )}
    >
      <BrandLoader size={tv ? "lg" : "md"} />
    </div>
  );
}
