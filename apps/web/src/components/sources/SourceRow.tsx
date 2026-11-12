import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * One way to start watching: a copy on the profile's server, a file of a torrent,
 * a copy in the player's "Source" panel — a row on `--surface-1`, `--radius-lg`, no
 * border, the type's mark in a circle. Line 1 (`title`): what it is; line 2 (`meta`, body-s): where and how much; one
 * label above (`badges`: "Now", "Didn't start"); on the end the one action, always labelled "Watch" (`action`), and
 * "More" for what can be done with it (`more`: details, unlink, remove — each confirmed where it can't be undone).
 * The row itself is not a button: the action says what happens. The sources screen's releases and copies
 * are its own lists (ReleaseFinder, CopyChoice).
 *
 * Phones: the action moves under the text, across the row, so a long name is never squeezed. TV: under the text too,
 * at the row's start, so the remote's ↓ goes from row to row (spatial navigation prefers the same column).
 */
export function SourceRow({
  icon,
  title,
  meta,
  badges,
  action,
  more,
  selected,
  className,
}: {
  /** 24 px: the server type's icon, or the service's logo. */
  icon: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  action?: ReactNode;
  more?: ReactNode;
  /** The one playing or the one the main button starts: a quiet edge, not a colour of its own. */
  selected?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg bg-surface-1 p-4", selected && "ring-1 ring-line-2 ring-inset", className)}>
      <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-text-2 [&>svg]:size-5">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          {badges && <div className="mb-1 flex flex-wrap items-center gap-1.5">{badges}</div>}
          <p className="text-title break-words text-text-1">{title}</p>
          {meta && <p className="mt-0.5 text-body-s break-words text-text-2">{meta}</p>}
        </div>
      </div>
      {(action || more) && (
        <div className="flex shrink-0 items-center gap-2 max-sm:w-full in-data-[tv=1]:w-full [&>*:first-child]:max-sm:flex-1">
          {action}
          {more}
        </div>
      )}
    </div>
  );
}

/** A section of "Where to watch": an h2 with an optional "i", then its rows. */
export function SourceSection({ id, title, info, children, footer }: { id: string; title: string; info?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <h2 id={id} className="text-h3 text-text-1">
          {title}
        </h2>
        {info}
      </div>
      {children}
      {footer}
    </section>
  );
}
