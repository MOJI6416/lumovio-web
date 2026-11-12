import { headers } from "next/headers";
import { userAgent } from "next/server";
import { type ReactNode, Suspense } from "react";
import { RouteLoading } from "./RouteLoading";

/**
 * The first page of a visit streams its brand intro while its data comes: the response starts at
 * once, the page follows. A robot (search engines, link previews) is answered with the whole page instead — a stream that
 * has begun is a 200, so a page's own 404 and its 308 to the canonical address reach it only this way.
 *
 * In a layout, around its pages: a later page of the same layout comes in a transition, which keeps the shown page rather
 * than this fallback (navigations have shell/NavigationLoading).
 */
export async function BootBoundary({ children, stage, tv }: { children: ReactNode; stage?: boolean; tv?: boolean }) {
  if (userAgent({ headers: await headers() }).isBot) return children;
  return <Suspense fallback={<RouteLoading stage={stage} tv={tv} />}>{children}</Suspense>;
}
