import { CircleAlert, type LucideIcon, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { errorDetails, isRetryable, loadErrorKeys } from "@/lib/api-errors";
import { Button } from "./Button";
import { EmptyState, type StateVariant } from "./EmptyState";

/**
 * A failed load (design-system 7.11, 8.4–8.5): never shown as "empty" or as an endless skeleton. EmptyState's layout
 * with CircleAlert, the texts picked from the error (lib/api-errors `loadErrorKeys`: offline, temporarily unavailable,
 * not found, kids profile…), "Retry" when retrying can help, and the status, code and request id folded under
 * "Technical details". `variant="page"` for a whole page (Retry is then the main button), `section` inside it.
 *
 * Covers the ready-made states: ServiceUnavailable = `<ErrorState variant="page" icon={CloudOff}
 * title={t("errors.unavailableTitle")} text={t("errors.unavailableText")} onRetry=… retrying=… />`; the library's
 * LoadError = `<ErrorState title={t("library.loadError")} onRetry=… />`; KidsRestricted stays an EmptyState
 * (nothing failed). In a server component pass `action` instead of `onRetry`.
 */
export function ErrorState({
  error,
  title,
  text,
  onRetry,
  retrying,
  action,
  icon = CircleAlert,
  variant = "section",
  headingLevel,
  details,
  className,
}: {
  /** The error that happened: chooses the words and the details. */
  error?: unknown;
  /** Already translated; replaces the title chosen from the error. */
  title?: string;
  text?: string;
  onRetry?: () => void;
  /** The retry is running: the button spins. */
  retrying?: boolean;
  /** Another way out next to Retry ("Switch profile", "Home"). */
  action?: ReactNode;
  icon?: LucideIcon;
  variant?: StateVariant;
  headingLevel?: 2 | 3;
  /** Replaces the details read from the error; null hides them. */
  details?: string | null;
  className?: string;
}) {
  const t = useTranslations();
  const keys = loadErrorKeys(error, variant);
  const info = details === undefined ? errorDetails(error) : details;
  const retry =
    onRetry && isRetryable(error) ? (
      <Button
        variant={variant === "page" ? "primary" : "secondary"}
        icon={RefreshCw}
        loading={retrying}
        onClick={onRetry}
      >
        {t("common.retry")}
      </Button>
    ) : undefined;
  return (
    <div role="alert" className={className}>
      <EmptyState
        icon={icon}
        title={title ?? t(keys.title)}
        text={text ?? t(keys.text)}
        action={retry ?? action}
        secondaryAction={retry ? action : undefined}
        variant={variant}
        headingLevel={headingLevel}
      >
        {info && (
          <details className="mt-4 text-body-s text-text-3">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-text-2 hover:text-text-1 md:min-h-8">
              {t("ui.technicalDetails")}
            </summary>
            <p className="mt-1 break-all tabular-nums [font-variant-ligatures:none]">{info}</p>
          </details>
        )}
      </EmptyState>
    </div>
  );
}
