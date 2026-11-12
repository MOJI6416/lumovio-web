import type { AuthCapabilities, ConnectionSummary, DeviceSession, IntegrationsOverview, TasteProfile } from "@lumovio/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Prefs } from "./prefs";
import type { PublicPage } from "./ProfileDialogs";

/*
 * The settings sections' own data, one definition for the section and for the frame that reads it ahead
 * (without it a section came up as a skeleton for its first 0.1–0.4 s).
 * A light module: types only from the rest.
 */

export const sessionsQuery = { queryKey: ["sessions"], queryFn: () => api<{ sessions: DeviceSession[] }>("/api/sessions") };
export const integrationsQuery = { queryKey: ["integrations"], queryFn: () => api<IntegrationsOverview>("/api/integrations") };
export const prefsQuery = { queryKey: ["prefs"], queryFn: () => api<Prefs>("/api/preferences") };
export const authCapsQuery = { queryKey: ["auth-caps"], queryFn: () => api<AuthCapabilities>("/api/auth-capabilities"), staleTime: Infinity };
export const connectionsQuery = { queryKey: ["connections"], queryFn: () => api<{ connections: ConnectionSummary[] }>("/api/connections") };
export const tasteQuery = { queryKey: ["recommendations-taste"], queryFn: () => api<TasteProfile>("/api/recommendations/taste") };
export const publicPageQuery = (profileId: string) => ({
  queryKey: ["public-settings", profileId],
  queryFn: () => api<PublicPage>(`/api/profiles/${profileId}/public`),
});

/** Read ahead only while it is fresh enough to be shown (the client's default staleTime). */
const FRESH = 60_000;

/** What a section shows first: its queries, read ahead when the menu's row is pointed at, focused or pressed. */
export function prefetchSection(qc: QueryClient, href: string, profileId: string | undefined) {
  const read = (q: { queryKey: readonly unknown[]; queryFn: () => Promise<unknown>; staleTime?: number }) =>
    void qc.prefetchQuery({ ...q, staleTime: q.staleTime ?? FRESH });
  if (href === "/settings" || href === "/settings/profile") return profileId && read(publicPageQuery(profileId));
  if (href === "/settings/recommendations") return read(tasteQuery);
  if (href === "/settings/account") return read(authCapsQuery);
  if (href === "/settings/security") return read(sessionsQuery);
  if (href === "/settings/connections") return read(connectionsQuery);
  if (href === "/settings/services") return read(integrationsQuery);
  if (href === "/settings/notifications" || href === "/settings/privacy") return read(prefsQuery);
}

/**
 * The adult sections' light answers, read once the settings page is idle, so their first visit draws at once; the
 * recommendations' taste (a computation) waits for the row's hover or press. A kids profile has none of these.
 */
export function prefetchLight(qc: QueryClient, profileId: string | undefined) {
  for (const href of ["/settings", "/settings/account", "/settings/security", "/settings/connections", "/settings/services", "/settings/notifications"])
    prefetchSection(qc, href, profileId);
}
