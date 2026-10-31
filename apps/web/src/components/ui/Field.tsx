import { CircleAlert } from "lucide-react";
import { type ReactNode, useId } from "react";
import { cn } from "./cn";

/**
 * A labelled field (design-system 7.6): the label above (13/600), the control, then a hint (12, --text-3) or an
 * error (12, --danger, with an icon) that replaces it. The control gets the id, the description id and whether
 * there is an error: `{(id, describedBy, invalid) => <Input id={id} aria-describedby={describedBy} invalid={invalid} />}`.
 * `hideLabel` keeps the label for screen readers only (a search field with its icon).
 */
export function Field({
  label,
  hint,
  error,
  hideLabel,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  hideLabel?: boolean;
  /** Placement only. */
  className?: string;
  children: (id: string, describedBy: string | undefined, invalid: boolean) => ReactNode;
}) {
  const id = useId();
  const hintId = hint || error ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className={cn("text-body-s font-semibold text-text-1", hideLabel && "sr-only")}>
        {label}
      </label>
      {children(id, hintId, Boolean(error))}
      {error ? (
        <p id={hintId} role="alert" className="flex items-start gap-1 text-caption font-medium text-danger">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption font-medium text-text-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
