import { CircleAlert, type LucideIcon, RefreshCw, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { errorDetails, isRetryable, loadErrorKeys } from "@/lib/api-errors";
import { Button } from "./Button";
import { EmptyState, type StateVariant } from "./EmptyState";

/** No connection: the browser says it is offline, or a request couldn't leave it (`network`). */
export function isOffline(e: unknown) {
  return (
    (typeof navigator !== "undefined" && navigator.onLine === false) ||
    code(e) === "network"
  );
}

const code = (e: unknown) => (typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined);

/**
 * A failed load: never shown as "empty" or as an endless skeleton. EmptyState's layout:
 * the glyph and the few words picked from the error (lib/api-errors `loadErrorKeys`: no connection, Lumovio
 * unavailable, gone, kids profile…), "Retry" when retrying can help, the why for a screen reader. `page` — the whole
 * page (Retry is the main button, the status, code and request id folded under "Technical details"); `section` — the
 * page's content under its header; `inline` — one line in place of a part that failed while the rest works.
 *
 * In a server component pass `action` instead of `onRetry`.
 */
export function ErrorState({
  error,
  title,
  about,
  note,
  onRetry,
  retrying,
  action,
  icon,
  variant = "section",
  headingLevel,
  details,
  className,
}: {
  /** The error that happened: chooses the words, the glyph and the details. */
  error?: unknown;
  /** Already translated; replaces the title chosen from the error. */
  title?: string;
  /** For a screen reader; replaces the one chosen from the error. */
  about?: string;
  /** A visible line, only when the cause decides what to do next (the player: the file is gone, the server refused). */
  note?: string;
  onRetry?: () => void;
  /** The retry is running: the button spins. */
  retrying?: boolean;
  /** Another way out next to Retry ("Switch profile", "Home"), or the only one when Retry can't help. */
  action?: ReactNode;
  icon?: LucideIcon;
  variant?: StateVariant;
  headingLevel?: 2 | 3;
  /** Replaces the details read from the error; null hides them. Shown on a `page` only. */
  details?: string | null;
  className?: string;
}) {
  const t = useTranslations();
  const offline = isOffline(error);
  const keys = offline
    ? { title: "errors.offlineTitle", text: "errors.network" }
    : loadErrorKeys(error, variant === "page" ? "page" : "section");
  const info = variant !== "page" ? null : details === undefined ? errorDetails(error) : details;
  const retry =
    onRetry && isRetryable(error) ? (
      <Button
        variant={variant === "page" ? "primary" : variant === "inline" ? "tertiary" : "secondary"}
        size={variant === "page" ? "lg" : variant === "inline" ? "sm" : "md"}
        icon={variant === "inline" ? undefined : RefreshCw}
        loading={retrying}
        onClick={onRetry}
      >
        {t("common.retry")}
      </Button>
    ) : undefined;
  return (
    <EmptyState
      role="alert"
      icon={icon ?? (offline ? WifiOff : CircleAlert)}
      // No connection is the cause whatever the place calls its failure ("Couldn't search"): said so.
      title={offline ? t(keys.title) : (title ?? t(keys.title))}
      about={note ? about : (about ?? t(keys.text))}
      note={note}
      action={retry ?? action}
      secondaryAction={retry ? action : undefined}
      variant={variant}
      headingLevel={headingLevel}
      className={className}
    >
      {info && (
        <details className="mt-6 text-body-s text-text-3">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-text-3 hover:text-text-2 md:min-h-8">
            {t("ui.technicalDetails")}
          </summary>
          <p className="mt-1 break-all tabular-nums [font-variant-ligatures:none]">{info}</p>
        </details>
      )}
    </EmptyState>
  );
}
