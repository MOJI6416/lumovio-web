import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { UpLink } from "./UpLink";

/**
 * The head of a page (design-system 9; Collection, Tool and Settings templates): "← Parent" over the h1 on nested
 * pages (8.7), the h1, a description of up to two lines, actions on the end — under the description on a phone.
 * It brings the distance from the site header (24 phone / 32 desktop) and to the content (24 / 32); put it first in
 * the page's container, without a top padding of the page's own. Works in server components.
 */
export function PageHeader({
  title,
  description,
  back,
  actions,
  titleId,
  size = "h1",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /**
   * The parent page: `{ href: "/settings", label: t("nav.settings") }` → "‹ Settings". `below: "lg"` shows it only
   * below lg, where the parent's menu isn't beside the page (Settings).
   */
  back?: { href: string; label: string; below?: "lg" };
  /** `display` for a page whose title is its headline ("Your 2026", 4.2); `h1` otherwise. */
  size?: "h1" | "display";
  /** The page's buttons: the main one first (7.1). */
  actions?: ReactNode;
  /** For `aria-labelledby` of the page's main region. */
  titleId?: string;
  /** Placement only. */
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 pt-6 pb-6 sm:pt-8 sm:pb-8", className)}>
      {back && (
        // Up without a new history entry (UpLink), so Back never returns to this page from its parent.
        <UpLink
          href={back.href}
          className={cn(
            "-ms-1 inline-flex min-h-11 w-fit items-center gap-1 pe-2 text-body-s font-semibold text-text-2 transition-colors duration-fast ease-fast hover:text-text-1 sm:min-h-8",
            back.below === "lg" && "lg:hidden",
          )}
        >
          <ChevronLeft aria-hidden className="size-4 shrink-0" />
          {back.label}
        </UpLink>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <h1 id={titleId} className={cn("text-balance text-text-1", size === "display" ? "text-display" : "text-h1")}>
            {title}
          </h1>
          {description && <p className="mt-2 max-w-measure text-body text-text-2">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
