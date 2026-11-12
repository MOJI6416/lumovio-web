import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Where a state stands: the whole page (404, a closed page, the API down — the page's h1, in the
 * middle of the space under the header), a section of a page (an empty list, a failed tab — under the section's own
 * header) or one line in place of a part that failed while the rest of the page works (a shelf, the next page).
 */
export type StateVariant = "page" | "section" | "inline";

const ICON: Record<StateVariant, string> = { page: "size-12", section: "size-8", inline: "size-5" };

/**
 * The one layout of every state: a bare glyph, what happened in a few words, and one way on —
 * nothing else in sight. Why, and what comes after, is `about`: said by a screen reader after the heading, never shown
 * (the site keeps no explaining paragraphs). `note` is the rare visible line for a limit the person can't guess —
 * a kids profile, an age limit, a title taken down — and the search's own query. Not for a failed load — that is
 * ErrorState, built on this — and never for a shelf: an empty shelf is hidden. Works in server components too.
 */
export function EmptyState({
  icon: Icon,
  title,
  about,
  note,
  action,
  secondaryAction,
  variant = "section",
  headingLevel = 2,
  role,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  /** For a screen reader: why it is so, what the action does. Never shown. */
  about?: ReactNode;
  /** One visible line, only for a limit that isn't evident (kids profile, age limit, legal removal). */
  note?: ReactNode;
  /** The one main action: `page` — a primary `lg` Button or Link; `section` — `secondary`; `inline` — `tertiary sm`. */
  action?: ReactNode;
  /** A second, quieter way out (`tertiary`): "Home". */
  secondaryAction?: ReactNode;
  variant?: StateVariant;
  /** The heading's level in the page outline (`page` is always the h1; the look is fixed by the variant). */
  headingLevel?: 2 | 3;
  /** `alert` for a failure (ErrorState), `status` for a quiet change. */
  role?: "alert" | "status";
  /** Extra content under the actions (the page error's technical details). */
  children?: ReactNode;
  /** Placement only. */
  className?: string;
}) {
  // A state's heading has no full stop, even when its words are a sentence elsewhere ("Nothing on these filters.").
  const heading = /[^.]\.$/.test(title) ? title.slice(0, -1) : title;
  if (variant === "inline")
    return (
      <div role={role} className={cn("flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1", className)}>
        {Icon && <Icon aria-hidden className={cn(ICON.inline, "shrink-0 text-text-2")} />}
        {/* A failure reads as a fact to act on; "nothing here" in a panel is a quiet line, as a row's value. */}
        <p className={cn("text-body", role === "alert" ? "text-text-1" : "text-text-2")}>
          {heading}
          {about && <span className="sr-only"> {about}</span>}
        </p>
        {action}
        {secondaryAction}
      </div>
    );
  const H = variant === "page" ? "h1" : headingLevel === 3 ? "h3" : "h2";
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center text-center",
        variant === "page"
          ? "page-x min-h-[calc(100svh-var(--header-h))] justify-center pt-12 pb-24"
          : "px-4 py-12 md:py-16",
        className,
      )}
    >
      {Icon && (
        <Icon aria-hidden strokeWidth={variant === "page" ? 1.5 : 1.75} className={cn(ICON[variant], "mb-4 text-text-3")} />
      )}
      <H className={cn("max-w-md text-balance text-text-1", variant === "page" ? "text-h2" : "text-h3")}>{heading}</H>
      {about && <p className="sr-only">{about}</p>}
      {note && <p className="mt-2 max-w-md text-balance text-body text-text-2">{note}</p>}
      {(action || secondaryAction) && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-x-4 gap-y-3",
            variant === "page" ? "mt-8" : "mt-6",
          )}
        >
          {action}
          {secondaryAction}
        </div>
      )}
      {children}
    </div>
  );
}
