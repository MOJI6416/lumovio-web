"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { cn } from "./cn";
import type { StateVariant } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { InlineAlert } from "./InlineAlert";
import { Progress } from "./Progress";
import { Skeleton } from "./Skeleton";

/** What QueryState reads from a react-query result (useQuery and useInfiniteQuery both fit). */
export interface QueryLike<T> {
  data: T | undefined;
  error: unknown;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  refetch: () => unknown;
}

/**
 * One wrapper for the states of a request (design-system 8.4; audit X-14, X-17):
 * - first load → `loading` (a Skeleton of the same layout) with "Loading…" for screen readers;
 * - failed with nothing to show → ErrorState with "Retry" (refetch), never an empty state or an endless skeleton;
 * - failed while refreshing shown data → the data stays, an InlineAlert with "Retry" above it;
 * - `isEmpty(data)` → `empty` (an EmptyState; nothing, if not given);
 * - data → `children(data)`, with a thin bar on top while it refreshes.
 *
 *   <QueryState query={servers} loading={<ServerRowsSkeleton />} isEmpty={(d) => d.length === 0}
 *     empty={<EmptyState icon={Server} title={t("noServers")} action={…} />}>
 *     {(list) => <ServerList servers={list} />}
 *   </QueryState>
 *
 * A disabled query that never ran renders nothing.
 */
export function QueryState<T>({
  query,
  loading,
  isEmpty,
  empty,
  error,
  variant = "section",
  className,
  children,
}: {
  query: QueryLike<T>;
  loading?: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  /** Already translated words for the failure, instead of the ones chosen from the error. */
  error?: { title?: string; text?: string };
  variant?: StateVariant;
  /** Placement of the wrapper. */
  className?: string;
  children: (data: T) => ReactNode;
}) {
  const tc = useTranslations("common");
  const t = useTranslations("ui");
  const { data } = query;
  const failed = (
    <ErrorState
      className={className}
      error={query.error}
      title={error?.title}
      text={error?.text}
      variant={variant}
      onRetry={() => void query.refetch()}
      retrying={query.isFetching}
    />
  );

  if (data === undefined) {
    if (query.isError) return failed;
    if (query.isPending && query.fetchStatus === "idle") return null;
    return (
      <div aria-busy="true" className={className}>
        <span className="sr-only" role="status">
          {tc("loading")}
        </span>
        {loading ?? <Skeleton className="h-40 w-full" />}
      </div>
    );
  }

  // An empty answer that then failed to refresh is a failure, not "nothing here".
  if (isEmpty?.(data)) {
    if (query.isError) return failed;
    return empty ? <div className={className}>{empty}</div> : null;
  }

  return (
    <div className={cn("relative", className)} aria-busy={query.isFetching || undefined}>
      {query.isFetching && (
        <Progress value={null} label={tc("loading")} className="absolute inset-x-0 top-0" />
      )}
      {query.isError && (
        <InlineAlert
          tone="danger"
          className="mb-4"
          title={t("refreshFailed")}
          action={
            <Button
              variant="tertiary"
              size="sm"
              loading={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {tc("retry")}
            </Button>
          }
        />
      )}
      {children(data)}
    </div>
  );
}
