import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";
import type { SaveState } from "@/lib/use-action";
import { SavedCheck } from "./BrandMotion";
import { Button } from "./Button";
import { cn } from "./cn";
import { InlineAlert } from "./InlineAlert";

/**
 * A group of settings (design-system 7.18): a --surface-1 panel, an h3-sized title (an h2 under the page's h1) with a
 * description, rows split by --line. Settings that apply at once (8.8) pass `save` from `useSettingsSave()`
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
  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-md border border-line bg-surface-1 p-4 md:p-6", className)}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={headingId} className="text-h3 text-text-1">
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
      {description && <p className="mt-1 max-w-measure text-body-s text-text-2">{description}</p>}
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
      <div className="mt-2 divide-y divide-line">{children}</div>
      {footer && <div className="mt-4 flex flex-wrap justify-end gap-2">{footer}</div>}
    </section>
  );
}

/** What a row's control gets to be named by the row (when it isn't a labelled `<input id>` — use `htmlFor` then). */
export interface RowA11y {
  "aria-labelledby": string;
  "aria-describedby"?: string;
}

/**
 * One setting (7.18): a 15/600 label and a body-s description at the start, the control at the end (Switch, Select,
 * Button), both from the top of the row. On a phone a field or button goes under the label at the full width; a
 * switch stays at the end of the label's line (X-42).
 */
export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
  className,
}: {
  label: string;
  description?: ReactNode;
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
    <div className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-3 py-4", className)}>
      <div className="min-w-0 flex-1 basis-64">
        {htmlFor ? (
          <label id={labelId} htmlFor={htmlFor} className="block text-title text-text-1">
            {label}
          </label>
        ) : (
          <p id={labelId} className="text-title text-text-1">
            {label}
          </p>
        )}
        {description && (
          <p id={descriptionId} className="mt-1 text-body-s text-text-2">
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
