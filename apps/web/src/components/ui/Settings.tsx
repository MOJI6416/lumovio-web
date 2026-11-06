import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";
import type { SaveState } from "@/lib/use-action";
import { SavedCheck } from "./BrandMotion";
import { Button } from "./Button";
import { cn } from "./cn";
import { InlineAlert } from "./InlineAlert";

/**
 * A group of settings (redesign-2026-11.md 4): a small title (an h2 under the page's h1) over a --surface-1 panel of
 * radius 16 without a border, rows split by --line; the description is for screen readers only. Settings that apply at once (8.8) pass `save` from `useSettingsSave()`
 * (lib/use-action): "Saved" appears by the title for a moment; a failure — rolled back already — stays in the section
 * as an InlineAlert with "Retry". Forms with a Save button put it in `footer`.
 */
export function SettingsSection({
  title,
  description,
  save,
  footer,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  save?: SaveState;
  /** Under the rows: the section's own "Save" (primary, off until something changed). */
  footer?: ReactNode;
  children: ReactNode;
  /** Placement only. */
  className?: string;
}) {
  const t = useTranslations();
  const headingId = useId();
  const descriptionId = useId();
  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={description ? descriptionId : undefined}
      className={className}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4">
        <h2 id={headingId} className="text-body-s font-semibold text-text-3">
          {title}
        </h2>
        {/* Always in the DOM, so the change to "Saved" is announced. */}
        <span role="status" className="inline-flex items-center gap-1 text-body-s text-text-2">
          {save?.status === "saving" && (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {t("ui.saving")}
            </>
          )}
          {save?.status === "saved" && (
            <>
              <SavedCheck size="sm" />
              {t("common.saved")}
            </>
          )}
        </span>
      </div>
      {/* No visible explanations (redesign-2026-11.md 2): the title says what the group is; a screen reader still
          hears the description. */}
      {description && (
        <p id={descriptionId} className="sr-only">
          {description}
        </p>
      )}
      {save?.status === "error" && (
        <InlineAlert
          tone="danger"
          className="mt-4"
          title={t("ui.saveFailed")}
          action={
            <Button variant="tertiary" size="sm" onClick={save.retry}>
              {t("common.retry")}
            </Button>
          }
        >
          {save.message}
        </InlineAlert>
      )}
      <div className="mt-2 divide-y divide-line rounded-md bg-surface-1 px-4">{children}</div>
      {footer && <div className="mt-3 flex flex-wrap justify-end gap-2">{footer}</div>}
    </section>
  );
}

/** What a row's control gets to be named by the row (when it isn't a labelled `<input id>` — use `htmlFor` then). */
export interface RowA11y {
  "aria-labelledby": string;
  "aria-describedby"?: string;
}

/**
 * One setting (redesign-2026-11.md 4): the label at the start, the control at the end (Switch, Select, Button). On a
 * phone a field or button goes under the label at the full width; a switch stays at the end of the label's line (X-42).
 * The description is visible only with `risk` (deleting, resetting); otherwise it is the control's description for a
 * screen reader.
 */
export function SettingsRow({
  label,
  description,
  risk,
  htmlFor,
  children,
  className,
}: {
  label: string;
  description?: ReactNode;
  /** A destructive setting: its description stays visible. */
  risk?: boolean;
  /** The id of a field control, so a click on the label focuses it. */
  htmlFor?: string;
  /** The control, or a function that names it after the row. */
  children: ReactNode | ((a11y: RowA11y) => ReactNode);
  className?: string;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = description ? `${id}-desc` : undefined;
  const control =
    typeof children === "function"
      ? children({ "aria-labelledby": labelId, "aria-describedby": descriptionId })
      : children;
  return (
    <div className={cn("flex flex-wrap justify-between gap-x-6 gap-y-3 py-3", risk ? "items-start" : "items-center", className)}>
      <div className="min-w-0 flex-1 basis-64">
        {htmlFor ? (
          <label id={labelId} htmlFor={htmlFor} className="block text-body text-text-1">
            {label}
          </label>
        ) : (
          <p id={labelId} className="text-body text-text-1">
            {label}
          </p>
        )}
        {description && (
          <p id={descriptionId} className={risk ? "mt-1 text-body-s text-text-2" : "sr-only"}>
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 max-sm:[&:not(:has([role=switch]))]:basis-full max-sm:[&:not(:has([role=switch]))>*]:grow">
        {control}
      </div>
    </div>
  );
}
