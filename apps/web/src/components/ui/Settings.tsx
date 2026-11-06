import { ChevronRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MouseEvent, ReactNode } from "react";
import { useId } from "react";
import { Link as IntlLink } from "@/i18n/navigation";
import type { SaveState } from "@/lib/use-action";
import { SavedCheck } from "./BrandMotion";
import { Button } from "./Button";
import { cn } from "./cn";
import { InlineAlert } from "./InlineAlert";

/**
 * "Saving…" and then "Saved" for a moment (8.8): by a group's title, or at the start of a settings dialog's actions.
 * Always in the DOM, so the change is announced.
 */
export function SaveStatus({ save, className }: { save?: SaveState; className?: string }) {
  const t = useTranslations();
  return (
    <span role="status" className={cn("inline-flex items-center gap-1 text-body-s text-text-2", className)}>
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
  );
}

/** A failed save, rolled back already (8.8): what happened and "Retry", in the group or dialog that made it. */
export function SaveError({ save, className }: { save?: SaveState; className?: string }) {
  const t = useTranslations();
  if (save?.status !== "error") return null;
  return (
    <InlineAlert
      tone="danger"
      className={className}
      title={t("ui.saveFailed")}
      action={
        <Button variant="tertiary" size="sm" onClick={save.retry}>
          {t("common.retry")}
        </Button>
      }
    >
      {save.message}
    </InlineAlert>
  );
}

/**
 * A group of settings (design-system 7.18, as Apple's grouped lists): a small title (an h2 under the page's h1) over a
 * --surface-1 panel of radius 16 without a border, rows split by --line; the description is for screen readers only. A
 * group may go without a title (a lone action: "Sign out"). Settings that apply at once (8.8) pass `save` from
 * `useSettingsSave()` (lib/use-action): "Saved" appears by the title for a moment; a failure — rolled back already — stays
 * in the group as an InlineAlert with "Retry". `footer` goes under the panel, at its end (a group's own button).
 */
export function SettingsSection({
  title,
  description,
  save,
  footer,
  children,
  className,
}: {
  title?: string;
  description?: ReactNode;
  save?: SaveState;
  /** Under the rows, at the end: the group's own action ("Remove all other devices", a form's "Save"). */
  footer?: ReactNode;
  children: ReactNode;
  /** Placement only. */
  className?: string;
}) {
  const headingId = useId();
  const descriptionId = useId();
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      className={className}
    >
      {title && (
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4">
          <h2 id={headingId} className="text-body-s font-semibold text-text-3">
            {title}
          </h2>
          <SaveStatus save={save} />
        </div>
      )}
      {/* No visible explanations (1.2, principle 6): the title says what the group is; a screen reader still hears it. */}
      {description && (
        <p id={descriptionId} className="sr-only">
          {description}
        </p>
      )}
      <SaveError save={save} className="mb-3" />
      {/* overflow-hidden: a row's highlight (SettingsLink) follows the panel's corners. */}
      <div className="divide-y divide-line overflow-hidden rounded-md bg-surface-1 px-4">{children}</div>
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
 * One setting with its control (7.18): the label at the start, the control at the end (Switch, Select, SegmentedControl,
 * a value). On a phone a field or a segmented control goes under the label at the full width; a switch stays at the end
 * of the label's line (X-42). The description is visible only with `risk` (deleting, resetting); otherwise it is the
 * control's description for a screen reader.
 */
export function SettingsRow({
  label,
  description,
  risk,
  inline,
  htmlFor,
  children,
  className,
}: {
  label: string;
  description?: ReactNode;
  /** A destructive setting: its description stays visible. */
  risk?: boolean;
  /** A short value control (a select's pill): it stays at the end of the line on a phone too, the label wraps. */
  inline?: boolean;
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
    <div className={cn("flex min-h-13 flex-wrap justify-between gap-x-6 gap-y-3 py-3", risk ? "items-start" : "items-center", className)}>
      <div className={cn("min-w-0 flex-1", inline ? "basis-28 sm:basis-48" : "basis-48")}>
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
      <div
        className={cn(
          "flex shrink-0 items-center gap-2",
          !inline && "max-sm:[&:not(:has([role=switch]))]:basis-full max-sm:[&:not(:has([role=switch]))>*]:grow",
        )}
      >
        {control}
      </div>
    </div>
  );
}

/**
 * A row that leads somewhere (7.18, as Apple's): the label, the current value at the end in --text-2 and a chevron — a
 * page (`href`) or a sub-screen in a dialog (`onClick` with `opens`); the whole row is the target, its highlight the
 * panel's width. Without `href` or `opens` it is an action row with no chevron ("Sign out"); `tone="danger"` paints its
 * label --danger (deleting the account), with `detail` — the consequence — visible under it (1.2, principle 6). `leading`
 * puts a mark before the label (a server's logo), `detail` lines under it (an address, a state).
 */
export function SettingsLink({
  label,
  value,
  detail,
  description,
  leading,
  after,
  href,
  download,
  onClick,
  opens,
  tone,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  label: ReactNode;
  /** The current value or state ("Ukrainian, English", a StatusBadge). */
  value?: ReactNode;
  detail?: ReactNode;
  /** What it is about, for a screen reader only (1.2, principle 6). */
  description?: ReactNode;
  leading?: ReactNode;
  /** Under the row's own target, inside the row: what needs a target of its own (a server's "What to do"). */
  after?: ReactNode;
  /** A page of the site. */
  href?: string;
  /** A file to save (a plain `<a download>`). */
  download?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  /** It opens a dialog: a chevron and aria-haspopup. */
  opens?: boolean;
  tone?: "danger";
  disabled?: boolean;
  /** Placement only. */
  className?: string;
  "aria-label"?: string;
}) {
  const descriptionId = useId();
  const chevron = Boolean(href && download === undefined) || opens;
  const body = (
    <>
      {leading && <span className="flex shrink-0 self-start sm:self-center">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-body", tone === "danger" ? "font-semibold text-danger" : "text-text-1")}>{label}</span>
        {detail && <span className="mt-0.5 block text-body-s text-text-2">{detail}</span>}
      </span>
      {value != null && value !== "" && (
        <span className="flex min-w-0 max-w-1/2 shrink items-center justify-end gap-2 text-end text-body text-text-2">{value}</span>
      )}
      {chevron && <ChevronRight aria-hidden className="size-5 shrink-0 text-text-3 rtl:rotate-180" />}
    </>
  );
  const look = cn(
    // The panel's px-4 is undone, so the highlight reaches its edges; the ring stays inside (the panel clips).
    "-mx-4 flex min-h-13 w-[calc(100%+2rem)] items-center gap-3 px-4 py-3 text-start transition-colors duration-fast ease-fast focus-visible:-outline-offset-2",
    disabled ? "cursor-not-allowed opacity-40" : "hover:bg-surface-2",
  );
  const a11y = { "aria-label": ariaLabel, "aria-describedby": description ? descriptionId : undefined };
  const control =
    href && download !== undefined ? (
      <a href={href} download={download || true} className={look} {...a11y}>
        {body}
      </a>
    ) : href && !disabled ? (
      <IntlLink href={href} className={look} {...a11y}>
        {body}
      </IntlLink>
    ) : (
      <button type="button" onClick={onClick} disabled={disabled} aria-haspopup={opens ? "dialog" : undefined} className={look} {...a11y}>
        {body}
      </button>
    );
  // A wrapper of its own in the panel: the line between rows stays inset as SettingsRow's while the highlight is full width.
  return (
    <div className={className}>
      {control}
      {after}
      {description && (
        <span id={descriptionId} className="sr-only">
          {description}
        </span>
      )}
    </div>
  );
}
