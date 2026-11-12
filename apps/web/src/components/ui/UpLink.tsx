"use client";

import type { ComponentProps } from "react";
import { useGoUp } from "@/hooks/useGoUp";
import { Link as IntlLink } from "@/i18n/navigation";

/**
 * A link to the page above this one ("‹ Settings"): a plain click goes up without a new history entry (useGoUp);
 * a click that opens a new tab or window stays a link.
 */
export function UpLink({ href, onClick, ...rest }: Omit<ComponentProps<typeof IntlLink>, "href"> & { href: string }) {
  const goUp = useGoUp();
  return (
    <IntlLink
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        goUp(href);
      }}
      {...rest}
    />
  );
}
