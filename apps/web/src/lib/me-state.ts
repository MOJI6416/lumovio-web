import { ApiRequestError } from "./api";

/**
 * What a failed /api/me means for a page: only "no session" (401/403) sends a person to sign in.
 * A network error, a timeout or a 5xx is Lumovio being briefly down — the person is still signed in, so
 * the page shows "temporarily unavailable" with Retry instead of the sign-in page.
 */
export function meFailure(e: unknown): "signed-out" | "unavailable" {
  return e instanceof ApiRequestError && (e.status === 401 || e.status === 403) ? "signed-out" : "unavailable";
}
