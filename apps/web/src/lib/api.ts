import type { ApiError, ApiErrorCode } from "@lumovio/contracts";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | "network",
    message: string,
    readonly issues?: { path: string; message: string }[],
    /** The id the server logs this request under; ErrorState shows it under "Technical details". */
    readonly requestId?: string,
  ) {
    super(message);
  }
}

let clientLocale = "en";
/** Set once by the locale provider so every client request carries the UI language. */
export function setClientLocale(locale: string) {
  clientLocale = locale;
}

/** Running as the installed app (the PWA): the API marks such a session for the admin's Sessions screen. */
const installed =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

/** Browser-side API call (same origin, cookies included). */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-lumovio-locale", clientLocale);
  if (installed) headers.set("x-lumovio-display", "standalone");
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, body, credentials: "same-origin" });
  } catch {
    throw new ApiRequestError(0, "network", "Network error");
  }
  return handle<T>(res);
}

export async function handle<T>(res: Response): Promise<T> {
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
  let err: ApiError["error"] | undefined;
  try {
    err = ((await res.json()) as ApiError).error;
  } catch {
    err = undefined;
  }
  const e = new ApiRequestError(
    res.status,
    err?.code ?? "internal",
    err?.message ?? res.statusText,
    err?.issues,
    err?.requestId,
  );
  // Next keeps an error's own digest from a server render to the browser, so the error page can tell the API's rate
  // limit (crawlers over 300 requests a minute) from a failure: it says so and doesn't report it.
  if (res.status === 429) Object.assign(e, { digest: RATE_LIMITED_DIGEST });
  throw e;
}

export const RATE_LIMITED_DIGEST = "rate_limited";
