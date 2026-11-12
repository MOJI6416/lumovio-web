import { Check, CircleAlert, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * A progress bar: 4 px on --surface-3, filled with --progress. `value` 0–100; `null` — the
 * length is unknown (a running stripe; still with reduced motion). Always named by `label`.
 */
export function Progress({
  value,
  label,
  className,
}: {
  value: number | null;
  label: string;
  className?: string;
}) {
  const known = value !== null;
  const pct = known ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? Math.round(pct) : undefined}
      className={cn("h-1 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      {known ? (
        <div
          className="h-full rounded-full bg-progress transition-[width] duration-base ease-base"
          style={{ width: `${pct}%` }}
        />
      ) : (
        // The globals.css shimmer, in the progress colour.
        <div
          className="h-full w-full"
          style={{
            backgroundImage: "linear-gradient(100deg, transparent 30%, var(--progress) 50%, transparent 70%)",
            backgroundSize: "300% 100%",
            animation: "shimmer 1.6s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
}

export type StepState = "done" | "current" | "pending" | "error";

export interface Step {
  id: string;
  label: string;
  state: StepState;
  /** One line under the step: "3 of 120 titles", what went wrong. */
  detail?: string;
}

/**
 * A multi-step operation: preparing a source, an import. The list of steps with the current
 * one marked, a progress bar and an understandable way to stop it (`action`, e.g. a secondary "Cancel" Button).
 * Announced politely as it moves on.
 */
export function Steps({
  steps,
  label,
  progress,
  action,
  className,
}: {
  steps: Step[];
  /** Names the operation ("Preparing the source"). */
  label: string;
  /** 0–100; leave out to count finished steps; null — unknown. */
  progress?: number | null;
  action?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("ui");
  const done = steps.filter((s) => s.state === "done").length;
  const value = progress === undefined ? (steps.length ? (done / steps.length) * 100 : 0) : progress;
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <ol aria-label={label} aria-live="polite" className="flex flex-col gap-3">
        {steps.map((s) => (
          <li
            key={s.id}
            aria-current={s.state === "current" ? "step" : undefined}
            className="flex items-start gap-3"
          >
            <StepIcon state={s.state} />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-body",
                  s.state === "current"
                    ? "font-semibold text-text-1"
                    : s.state === "pending"
                      ? "text-text-3"
                      : "text-text-1",
                )}
              >
                {s.label}
                {(s.state === "done" || s.state === "error") && (
                  <span className="sr-only"> · {t(s.state === "done" ? "stepDone" : "stepFailed")}</span>
                )}
              </p>
              {s.detail && (
                <p className={cn("text-body-s", s.state === "error" ? "text-danger" : "text-text-2")}>
                  {s.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <Progress value={value} label={label} />
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

function StepIcon({ state }: { state: StepState }) {
  const box = "mt-0.5 grid size-5 shrink-0 place-items-center";
  if (state === "done") return <Check aria-hidden className={cn(box, "text-progress")} />;
  if (state === "current") return <Loader2 aria-hidden className={cn(box, "animate-spin text-text-1")} />;
  if (state === "error") return <CircleAlert aria-hidden className={cn(box, "text-danger")} />;
  return (
    <span aria-hidden className={box}>
      <span className="size-2 rounded-full bg-text-3" />
    </span>
  );
}
