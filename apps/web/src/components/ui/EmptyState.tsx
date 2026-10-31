import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

/** Where a state stands: alone on a page (centred, 96 from the top) or inside a panel or tab (compact). */
export type StateVariant = "page" | "section";

/**
 * Nothing to show yet (design-system 7.11): a 24 px icon in a 48 px --surface-2 circle, an h3-sized title, up to two
 * lines of body text, one main action and, if needed, a second way out (a link). Not for a failed load — that is
 * ErrorState — and never for a shelf: an empty shelf is hidden. Works in server components too.
 */
export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  secondaryAction,
  variant = "section",
  headingLevel = 2,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  text?: ReactNode;
  /** The one main action (a Button, or a Link styled with buttonClass). */
  action?: ReactNode;
  /** A second, quieter way out: a link or a tertiary button. */
  secondaryAction?: ReactNode;
  variant?: StateVariant;
  /** The heading's level in the page outline (the look is h3 either way). */
  headingLevel?: 2 | 3;
  /** Extra content under the actions (ErrorState's technical details). */
  children?: ReactNode;
  /** Placement only. */
  className?: string;
}) {
  const H = headingLevel === 3 ? "h3" : "h2";
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        variant === "page" ? "px-4 pt-24 pb-12" : "px-4 py-10",
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-surface-2 text-text-2">
          <Icon aria-hidden className="size-6" />
        </div>
      )}
      <H className="text-balance text-h3 text-text-1">{title}</H>
      {text && <p className="mt-2 max-w-md text-body text-text-2">{text}</p>}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {action}
          {secondaryAction}
        </div>
      )}
      {children}
    </div>
  );
}
