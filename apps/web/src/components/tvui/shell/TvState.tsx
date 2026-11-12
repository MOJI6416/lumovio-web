import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * Empty, error and "not here" states of the TV shell: an icon, what happened in one
 * line, what to do, and the actions as one zone of the remote — the first is where the focus lands.
 */
export function TvState({
  icon: Icon,
  title,
  text,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  text?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-200 flex-col items-start gap-5", className)}>
      <Icon aria-hidden className="size-14 text-text-3" />
      <h2 className="text-h3 text-text-1">{title}</h2>
      {text && <div className="max-w-measure text-body-l text-text-2">{text}</div>}
      {children && (
        <div
          data-zone="state"
          data-zone-axis="x"
          data-zone-entry="first"
          className="mt-2 flex flex-wrap gap-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}
