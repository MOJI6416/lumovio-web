"use client";

import { Bookmark, BookmarkCheck, Info, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { GuestGate } from "@/components/shell/GuestGate";
import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Link } from "@/i18n/navigation";
import { titleHref } from "@/lib/slug";
import { type ActionTitle, usePersonalActions } from "./usePersonalActions";

/**
 * The actions of a billboard slide (design-system 7.14, 8.2): one primary — "Continue" when the
 * profile is part-way through, "Watch" when a copy can be played, else "More info" — and one secondary: "More info"
 * beside a play button, else "Watchlist" (a guest gets the sign-in sheet for it, 8.6). "More info" is the one label
 * for opening the title everywhere (2.4, HOME-10). `playable` is undefined while it is being checked.
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
  // On a phone the two buttons share the row (the primary first), from a tablet they keep their own width.
  const fill = "max-md:flex-1";
  return (
    <div className={cn("flex w-full items-center gap-3 md:w-auto", className)}>
      {watch ? (
        <>
          <Link href={watch} className={buttonClass("primary", size, cn(fill, "md:min-w-38"))}>
            <Play aria-hidden className="fill-current" />
            {resume ? t("home.continue") : t("title.play")}
          </Link>
          <Link href={details} className={buttonClass("secondary", size, fill)}>
            <Info aria-hidden />
            {t("home.moreInfo")}
          </Link>
        </>
      ) : (
        <>
          <Link href={details} className={buttonClass("primary", size, cn(fill, "md:min-w-38"))}>
            <Info aria-hidden />
            {t("home.moreInfo")}
          </Link>
          <Button
            variant="secondary"
            size={size}
            icon={a.inWatchlist ? BookmarkCheck : Bookmark}
            aria-pressed={a.signedIn ? a.inWatchlist : undefined}
            disabled={a.busy === "wl"}
            // Wide enough for both labels, so it doesn't change width when pressed (7.1).
            className={cn(fill, "md:min-w-48")}
            onClick={() => void a.setWatchlist(!a.inWatchlist)}
          >
            {a.inWatchlist ? t("title.watchlistRemove") : t("title.watchlistAdd")}
          </Button>
          <GuestGate {...a.gate} />
        </>
      )}
    </div>
  );
}
