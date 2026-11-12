"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "./cn";

// Labels that say something about an object. None of them is a control.

export type Status = "success" | "warning" | "danger" | "neutral";

const DOT: Record<Status, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-text-3",
};

const TAG = "inline-flex h-6 shrink-0 items-center gap-2 whitespace-nowrap rounded-xs bg-surface-2 px-2 text-caption text-text-1";

/** A neutral label: "Kids", "Your language", "This device". */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(TAG, className)}>{children}</span>;
}

/**
 * The state of a server, an import or a release: a status-coloured dot and the word, on a neutral surface. Never a
 * fill or text in the status colour and never colour alone — the word is required.
 */
export function StatusBadge({ status, children, className }: { status: Status; children: ReactNode; className?: string }) {
  return (
    <span className={cn(TAG, className)}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[status])} />
      {children}
    </span>
  );
}

/** "Recommended", "New": lime fill with --on-accent text, at most one per card. */
export function AccentBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5.5 shrink-0 items-center whitespace-nowrap rounded-xs bg-accent px-2 text-caption font-bold text-on-accent",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The one badge on artwork: "4K", "New episode", "On your server". Dark veil in either theme (stage). A few words
 * (about 16 characters read at a glance); a longer text takes a second line rather than being cut, within the width
 * the caller gives it (`max-w-…` with the placement). Dates and "Added …" go in the line under the card, not here.
 */
export function MediaBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "stage inline-flex min-h-5.5 shrink-0 items-center rounded-xs bg-stage/60 px-2 py-0.5 text-caption leading-tight text-text-1 backdrop-blur-md in-data-[tv=1]:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** An age rating ("16+", "PG-13"); screen readers hear "Age rating 16+". */
export function AgeRating({ rating, className }: { rating: string; className?: string }) {
  const t = useTranslations("ui");
  return (
    <span
      className={cn(
        "inline-flex h-5.5 shrink-0 items-center whitespace-nowrap rounded-xs border border-line-2 px-1.5 text-caption font-bold text-text-1",
        className,
      )}
    >
      <span className="sr-only">{t("ageRating")} </span>
      {rating}
    </span>
  );
}

/**
 * One rating: the source's logo (16 px) and the value, 15/700. A number is written with one decimal in the
 * locale's style (8,0 in ru/uk, 8.0 in en); a string ("92%") is shown as it is. `source` names the logo for
 * screen readers.
 */
export function RatingChip({
  logo,
  source,
  value,
  className,
}: {
  logo: ReactNode;
  source: string;
  value: number | string;
  className?: string;
}) {
  const locale = useLocale();
  const shown =
    typeof value === "number"
      ? new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
      : value;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-body font-bold text-text-1 tabular-nums", className)}>
      {/* 16 px tall; a wordmark (IMDb) keeps its width. */}
      <span aria-hidden className="inline-flex h-4 shrink-0 items-center [&>*]:h-4 [&>*]:w-auto">
        {logo}
      </span>
      <span className="sr-only">{source} </span>
      {shown}
    </span>
  );
}
