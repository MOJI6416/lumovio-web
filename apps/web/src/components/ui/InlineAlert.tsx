import { CircleAlert, CircleCheck, Info, type LucideIcon, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type AlertTone = "info" | "success" | "warning" | "danger";

const TONE: Record<AlertTone, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: "bg-info-soft", icon: "text-text-2", Icon: Info },
  success: { box: "bg-success-soft", icon: "text-success", Icon: CircleCheck },
  warning: { box: "bg-warning-soft", icon: "text-warning", Icon: TriangleAlert },
  danger: { box: "bg-danger-soft", icon: "text-danger", Icon: CircleAlert },
};

/**
 * A banner inside a page, panel or dialog: the status's soft fill, its icon, a 15/600 title,
 * body-s text, one action at the end (a `tertiary` Button). No coloured frame; the text keeps the text colours, so it
 * reads in both themes. An error is announced (`role="alert"`), the other tones politely (`role="status"`).
 * The text says what happened and what to do — never the server's own message.
 */
export function InlineAlert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  /** One `<Button variant="tertiary" size="sm">`: "Retry", "Open". */
  action?: ReactNode;
  /** Placement only. */
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md px-4 py-3", t.box, className)}
    >
      <t.Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", t.icon)} />
      <div className="min-w-0 flex-1 basis-48">
        {title && <p className="text-title text-text-1">{title}</p>}
        {children && <div className={cn("text-body-s text-text-2", title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="-my-1 ms-auto shrink-0">{action}</div>}
    </div>
  );
}
