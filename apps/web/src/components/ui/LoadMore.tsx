"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

/**
 * "Show more" under a grid or a list, centred (design-system 7.11, 8.4): the next page as a `secondary` button that
 * spins while it comes, "Showing 60 of 7 088" under it when the total is known, and nothing once all is shown. The next
 * page that didn't come is one line in the button's place — "Couldn't load more" with Retry — and what is shown stays.
 */
export function LoadMore({
  onMore,
  loading,
  failed,
  onRetry,
  shown,
  total,
  hasMore,
  className,
}: {
  onMore: () => void;
  /** The next page is coming. */
  loading?: boolean;
  /** The next page failed: the line with Retry instead of the button. */
  failed?: boolean;
  /** Retry of the failed page; `onMore` when not given. */
  onRetry?: () => void;
  /** With `total`: the line under the button. */
  shown?: number;
  total?: number;
  /** There is more to show; by default `shown < total` when both are given, else true. */
  hasMore?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  const counted = shown !== undefined && total !== undefined;
  if (failed)
    return (
      <div className={className ?? "mt-8 flex justify-center"}>
        {/* ErrorState's line, without its error words (bundle: the person page's credits page in the browser). */}
        <EmptyState
          variant="inline"
          role="alert"
          icon={CircleAlert}
          title={t("moreFailed")}
          action={
            <Button variant="tertiary" size="sm" loading={loading} onClick={onRetry ?? onMore}>
              {t("retry")}
            </Button>
          }
        />
      </div>
    );
  if (!(hasMore ?? (counted ? shown < total : true))) return null;
  return (
    <div className={className ?? "mt-8 flex flex-col items-center gap-2"}>
      <Button variant="secondary" loading={loading} onClick={onMore}>
        {t("showMore")}
      </Button>
      {counted && <p className="text-body-s text-text-2">{t("shownOf", { shown, total })}</p>}
    </div>
  );
}
