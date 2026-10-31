import { ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";
import { Link as IntlLink } from "@/i18n/navigation";
import { cn } from "./cn";

export type LinkVariant = "inline" | "action";

const VARIANTS: Record<LinkVariant, string> = {
  // Inside running text: the text colour, underlined (7.3); size and weight come from the text around it.
  inline: "text-text-1 underline decoration-1 underline-offset-3 hover:decoration-2",
  // A link of its own ("All releases", "Show all"): --link, 15/600, underlined in the light theme where --link is
  // black (3.3) — not on a stage inside it, where --link is lime again (--link-decoration follows the nearest theme or
  // stage, globals.css); at least 32 px tall, 44 on a phone (5.6).
  action:
    "inline-flex min-h-8 items-center gap-1 text-body font-semibold text-link underline-offset-3 [text-decoration-line:var(--link-decoration)] hover:underline max-sm:min-h-11",
};

/** Classes of a link, for a plain `<a>` (an external address, a download). */
export function linkClass(variant: LinkVariant = "inline", extra?: string) {
  return cn(VARIANTS[variant], extra);
}

export interface LinkProps extends ComponentProps<typeof IntlLink> {
  variant?: LinkVariant;
  /** `action` links that open another page end with a chevron. */
  arrow?: boolean;
}

/**
 * A link (design-system 7.3) on the locale-aware next-intl Link. A link goes somewhere; anything that changes data
 * is a Button, so a link never looks like a button and a button never looks like a link.
 */
export function Link({ variant = "inline", arrow, className, children, ...rest }: LinkProps) {
  return (
    <IntlLink className={linkClass(variant, className)} {...rest}>
      {children}
      {variant === "action" && arrow && <ChevronRight aria-hidden className="size-4 shrink-0" />}
    </IntlLink>
  );
}
