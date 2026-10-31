import { AUTH_NETWORK_ERROR, type AuthError } from "@/lib/api-errors";

/**
 * Runs a Better Auth client call: a request that never got an answer (offline) comes back as an error too, so a
 * screen always gets `{ data, error }` and shows the error in words (lib/api-errors `authErrorKey`).
 */
export async function authCall<T extends { error: AuthError | null }>(
  run: () => Promise<T>,
): Promise<T | { data: null; error: AuthError }> {
  try {
    return await run();
  } catch {
    return { data: null, error: AUTH_NETWORK_ERROR };
  }
}
