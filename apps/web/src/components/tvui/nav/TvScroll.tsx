import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * A vertically scrolled area of the TV shell (a panel's list, a page): the remote's focus slides its content into view
 * (tvui/nav/engine `reveal`); the area itself never scrolls natively, so nothing jumps under the focus.
 */
export function TvScroll({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div data-tv-scroller className={cn("relative min-h-0 flex-1 overflow-hidden", className)}>
      <div data-tv-content className={contentClassName}>
        {children}
      </div>
    </div>
  );
}
