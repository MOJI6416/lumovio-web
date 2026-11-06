"use client";

import { Check, Info, Play, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { GuestGate } from "@/components/shell/GuestGate";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { IconButton } from "@/components/ui/IconButton";
import { Link } from "@/i18n/navigation";
import { titleHref } from "@/lib/slug";
import { type ActionTitle, usePersonalActions } from "./usePersonalActions";

/**
 * The actions of a billboard slide (design-system 7.14, 8.2; redesign-2026-11.md 2): one primary — "Continue" when the
 * profile is part-way through, "Watch" when a copy can be played, else "More info" — and circles beside it: "More info"
 * (i) next to a play button, and always "Watchlist" (+ / ✓; a guest gets the sign-in sheet for it, 8.6). "More info"
 * is the one label for opening the title everywhere (2.4, HOME-10). `playable` is undefined while it is being checked.
 */
export function HeroActions({ title, playable, size = "lg", className }: { title: ActionTitle; playable: boolean | undefined; size?: "md" | "lg"; className?: string }) {
  const t = useTranslations();
  const a = usePersonalActions(title);
  const p = a.state?.progress;
  const resume = p && !p.completed && p.positionSec > 30 ? p : null;
  const watch = resume
    ? `/watch/${title.kind}/${title.tmdbId}${resume.season !== null ? `?s=${resume.season}&e=${resume.episode ?? 1}` : ""}`
    : playable
      ? `/watch/${title.kind}/${title.tmdbId}`
      : null;
  const details = titleHref(title.kind, title.tmdbId, title.title);
  // The primary takes the width the circles leave on a phone; from a tablet it keeps its own (redesign-2026-11.md 2).
  return (
    <div className={cn("flex w-full items-center gap-3 md:w-auto", className)}>
      {watch ? (
        <>
          <Link href={watch} className={buttonClass("primary", size, "max-md:flex-1 md:min-w-38")}>
            <Play aria-hidden className="fill-current" />
            {resume ? t("home.continue") : t("title.play")}
          </Link>
          <Link href={details} aria-label={t("home.moreInfo")} className={cn(buttonClass("secondary", size), size === "lg" ? "w-12 px-0" : "w-10 px-0 max-sm:w-11")}>
            <Info aria-hidden />
          </Link>
        </>
      ) : (
        <Link href={details} className={buttonClass("primary", size, "max-md:flex-1 md:min-w-38")}>
          <Info aria-hidden />
          {t("home.moreInfo")}
        </Link>
      )}
      {/* "Watchlist" as a circle beside it: + off, ✓ on; a guest gets the sign-in sheet for it (8.6). */}
      <IconButton
        icon={a.inWatchlist ? Check : Plus}
        variant="secondary"
        size={size}
        label={t("titlePage.watchlist")}
        aria-pressed={a.signedIn ? a.inWatchlist : undefined}
        disabled={a.busy === "wl"}
        onClick={() => void a.setWatchlist(!a.inWatchlist)}
      />
      <GuestGate {...a.gate} />
    </div>
  );
}
