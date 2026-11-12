"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "./cn";
import type { StateVariant } from "./EmptyState";
import { ErrorState } from "./ErrorState";
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
  /** useInfiniteQuery: only the next page failed — LoadMore says so in its place, not this wrapper. */
  isFetchNextPageError?: boolean;
}

/**
 * One wrapper for the states of a request:
 * - first load → `loading` (a Skeleton of the same layout) with "Loading…" for screen readers;
 * - offline before anything came (react-query pauses the request) → "No connection" with Retry, not an endless
 *   skeleton; the request goes on by itself once the connection is back;
 * - failed with nothing to show → ErrorState with "Retry" (refetch), never an empty state or an endless skeleton;
 * - failed while refreshing shown data → the data stays, one line "Couldn't refresh" with Retry above it (a next page
 *   that failed is LoadMore's to say, under the list);
 * - `isEmpty(data)` → `empty` (an EmptyState; nothing, if not given);
 * - data → `children(data)`, with a thin bar on top while it refreshes.
 *
 *   <QueryState query={servers} loading={<ServerRowsSkeleton />} isEmpty={(d) => d.length === 0}
 *     empty={<EmptyState icon={Server} title={t("noServers")} action={…} />}>
 *     {(list) => <ServerList servers={list} />}
 *   </QueryState>
 *
 * `variant`: the failure's place — `section` (the content under the page's header), `page`, or `inline` for a part of
 * a page whose other parts live. A disabled query that never ran renders nothing.
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
  error?: { title?: string; about?: string };
  variant?: StateVariant;
  /** Placement of the wrapper. */
  className?: string;
  children: (data: T) => ReactNode;
}) {
  const tc = useTranslations("common");
  const t = useTranslations("ui");
  const { data } = query;
  const retry = () => void query.refetch();
  const failed = (
    <ErrorState
      className={className}
      error={query.error}
      title={error?.title}
      about={error?.about}
      variant={variant}
      onRetry={retry}
      retrying={query.isFetching}
    />
  );

  if (data === undefined) {
    if (query.isError) return failed;
    if (query.isPending && query.fetchStatus === "idle") return null;
    // Offline: react-query holds the request until the connection is back — say so instead of a skeleton for ever.
    if (query.fetchStatus === "paused")
      return <ErrorState className={className} error={null} variant={variant} onRetry={retry} />;
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
      {query.isError && !query.isFetchNextPageError && (
        <ErrorState
          className="mb-4"
          error={query.error}
          title={t("refreshFailed")}
          variant="inline"
          onRetry={retry}
          retrying={query.isFetching}
        />
      )}
      {children(data)}
    </div>
  );
}
