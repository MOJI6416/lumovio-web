import "server-only";
import { cookies, headers } from "next/headers";
import { locale as rootLocale } from "next/root-params";
import { cache } from "react";
import { ApiRequestError, handle } from "./api";
import { meFailure } from "./me-state";

const INTERNAL = process.env.API_INTERNAL_URL ?? process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";

/**
 * Server Component → API call. Forwards the visitor's cookies (session/profile) and locale/region
 * so SSR output matches what the browser would get. Never cached across users.
 */
export async function serverApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const [c, h, locale] = await Promise.all([cookies(), headers(), rootLocale()]);
  const fwd = new Headers(init.headers);
  const cookieHeader = c.toString();
  if (cookieHeader) fwd.set("cookie", cookieHeader);
  if (locale) fwd.set("x-lumovio-locale", locale);
  for (const k of ["cf-ipcountry", "cf-connecting-ip", "x-forwarded-for", "user-agent"]) {
    const v = h.get(k);
    if (v) fwd.set(k, v);
  }
  let res: Response;
  try {
    res = await fetch(`${INTERNAL}${path}`, { ...init, headers: fwd, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new ApiRequestError(0, "network", "API unreachable");
  }
  return handle<T>(res);
}

/**
 * Same request deduplicated within one render (layout + page both asking for /api/me). `null` means
 * signed out; an API outage throws (see `getMeState`).
 */
export const getMe = cache(async () => {
  try {
    return await serverApi<import("@lumovio/contracts").Me>("/api/me");
  } catch (e) {
    if (meFailure(e) === "signed-out") return null;
    throw e;
  }
});

/**
 * For pages that send a signed-out visitor to sign in: `"unavailable"` when the API can't answer
 * (network, timeout, 5xx), so a signed-in person sees "temporarily unavailable" instead (SH-03).
 */
export const getMeState = cache(async (): Promise<import("@lumovio/contracts").Me | null | "unavailable"> => {
  try {
    return await getMe();
  } catch {
    // Without a session cookie nobody is signed in, outage or not: such a visitor still goes to sign in.
    const c = await cookies();
    return c.getAll().some((x) => x.name.endsWith("session_token")) ? "unavailable" : null;
  }
});
