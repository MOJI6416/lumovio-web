import { clsx } from "clsx";
import { Check, Play } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * "Watch now" switch: the same page with only the titles that have a copy on the profile's servers, or back to the
 * whole catalog. A link that works like a filter chip (7.4: the on state is the selection colour); a page-level filter
 * (a section's heading row, the home page's "Watch now" page), never inside a shelf (7.13).
 */
export function WatchNowToggle({ on, href, label, describedBy }: { on: boolean; href: string; label: string; describedBy?: string }) {
  const Icon = on ? Check : Play;
  return (
    <Link
      href={href}
      aria-current={on ? "true" : undefined}
      aria-describedby={describedBy}
      className={clsx(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-body-s font-semibold transition-colors duration-fast ease-fast max-sm:min-h-11",
        on ? "border-transparent bg-selected-bg text-selected-fg" : "border-line-2 text-text-1 hover:bg-surface-2",
      )}
    >
      <Icon aria-hidden className={clsx("size-4", !on && "fill-current")} strokeWidth={on ? 3 : 2} />
      {label}
    </Link>
  );
}
