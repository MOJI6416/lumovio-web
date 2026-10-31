import type { ImportFileProblem } from "@lumovio/contracts";
import { ApiRequestError } from "./api";

/**
 * Error codes → message keys (AUTH-03, IMP-01, IMP-02). Screens never show an error's own text: it is
 * English, sometimes technical ("[body.email] Invalid email address", a database error). They translate
 * the key returned here with `useTranslations()` (keys include their namespace); an unknown code gets
 * the plain "something went wrong" of its area.
 */

/** What Better Auth's client returns as `error` (or what a thrown fetch turns into). */
export interface AuthError {
  code?: string;
  message?: string;
  status?: number;
}

const AUTH_CODES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "auth.invalidCredentials",
  INVALID_PASSWORD: "auth.errWrongPassword",
  EMAIL_NOT_VERIFIED: "auth.notVerified",
  INVALID_EMAIL: "auth.errInvalidEmail",
  PASSWORD_TOO_SHORT: "auth.errPasswordShort",
  PASSWORD_TOO_LONG: "auth.errPasswordLong",
  PASSWORD_COMPROMISED: "auth.errPasswordCompromised",
  USER_ALREADY_EXISTS: "auth.errUserExists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "auth.errUserExists",
  INVALID_TOKEN: "auth.errLinkExpired",
  TOKEN_EXPIRED: "auth.errLinkExpired",
  INVALID_CODE: "auth.errCode",
  INVALID_BACKUP_CODE: "auth.errCode",
  OTP_HAS_EXPIRED: "auth.errCodeExpired",
  INVALID_TWO_FACTOR_COOKIE: "auth.errCodeExpired",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "auth.errTooManyAttempts",
  ACCOUNT_TEMPORARILY_LOCKED: "auth.errTooManyAttempts",
  BANNED_USER: "auth.errBanned",
  REGISTRATION_CLOSED: "auth.errRegistrationClosed",
};

/** Better Auth sign-in, sign-up, password reset, 2FA and social sign-in errors. */
export function authErrorKey(err: AuthError | null | undefined): string {
  if (!err) return "auth.genericError";
  if (err.status === 429) return "errors.rateLimited";
  if (err.status === 0 || err.code === "network") return "errors.network";
  const known = err.code ? AUTH_CODES[err.code] : undefined;
  if (known) return known;
  if (err.code === "VALIDATION_ERROR") {
    // The field comes first in the message: "[body.email] Invalid email address".
    const field = /^\[body\.(\w+)/.exec(err.message ?? "")?.[1];
    if (field === "email") return "auth.errInvalidEmail";
    if (field === "password" || field === "newPassword") return "auth.errPasswordShort";
    return "auth.errInvalidInput";
  }
  return "auth.genericError";
}

/** A request that never reached Better Auth (offline, DNS): the client throws instead of returning an error. */
export const AUTH_NETWORK_ERROR: AuthError = { code: "network", status: 0 };

const API_CODES: Partial<Record<ApiRequestError["code"], string>> = {
  network: "errors.network",
  rate_limited: "errors.rateLimited",
  upstream_unavailable: "errors.upstream",
  unauthorized: "errors.signInRequired",
  profile_required: "errors.profileRequired",
  // Ф1 (design-system 8.5): every code the API sends has words.
  kids_restricted: "errors.kidsRestricted",
  maturity_blocked: "errors.maturityBlocked",
  title_unavailable: "errors.titleUnavailable",
  forbidden: "errors.forbidden",
  not_found: "errors.notFound",
  conflict: "errors.conflict",
  not_configured: "errors.notConfigured",
  pin_required: "errors.pinRequired",
  password_required: "errors.passwordRequired",
  step_up_required: "errors.stepUpRequired",
};

/** Lumovio API errors in actions (toasts): what went wrong in words, never the server's message. */
export function apiErrorKey(e: unknown): string {
  if (e instanceof ApiRequestError) return API_CODES[e.code] ?? "errors.generic";
  return "errors.generic";
}

/** Where a failed load is shown (ErrorState, QueryState): the whole page or one section of it. */
export type ErrorPlace = "page" | "section";

/**
 * The title and text of a failed load (ErrorState): what happened and what to do (2.1, 8.5). A section says
 * "Couldn't load this" and why; a page names the situation (not found, temporarily unavailable…).
 */
export function loadErrorKeys(e: unknown, place: ErrorPlace = "section"): { title: string; text: string } {
  const page = place === "page";
  const temporary = {
    title: page ? "errors.serverTitle" : "errors.loadTitle",
    text: page ? "errors.serverText" : "errors.loadText",
  };
  if (!(e instanceof ApiRequestError)) return temporary;
  switch (e.code) {
    case "network":
      return { title: page ? "errors.unavailableTitle" : "errors.loadTitle", text: "errors.network" };
    case "kids_restricted":
      return { title: "profiles.kidsRestrictedTitle", text: "profiles.kidsRestrictedText" };
    case "not_found":
      return page
        ? { title: "errors.notFoundTitle", text: "errors.notFoundText" }
        : { title: "errors.loadTitle", text: "errors.notFound" };
    case "bad_request":
    case "conflict":
    case "internal":
      return temporary;
    default: {
      const key = API_CODES[e.code];
      return key ? { title: page ? "errors.serverTitle" : "errors.loadTitle", text: key } : temporary;
    }
  }
}

/**
 * Whether "Retry" can help: not when the answer is about who is asking (kids profile, no access, signed out) or
 * the thing is gone — there the state offers its own way out instead of a button that fails again.
 */
export function isRetryable(e: unknown) {
  if (!(e instanceof ApiRequestError)) return true;
  return ![
    "kids_restricted",
    "maturity_blocked",
    "title_unavailable",
    "forbidden",
    "not_found",
    "unauthorized",
    "profile_required",
    "pin_required",
    "password_required",
    "step_up_required",
  ].includes(e.code);
}

/**
 * The technical details folded under ErrorState's "Technical details": the status, the code and the request id the
 * server logs carry ("HTTP 500 · internal · 7f3a…"). Never the error's message (8.5); null when there is nothing
 * worth showing (not an API error).
 */
export function errorDetails(e: unknown): string | null {
  if (!(e instanceof ApiRequestError)) return null;
  // The API sends `requestId` in every error body (contracts ApiError); ApiRequestError carries it once lib/api.ts keeps it.
  const requestId = (e as { requestId?: unknown }).requestId;
  return [e.status > 0 ? `HTTP ${e.status}` : null, e.code, typeof requestId === "string" ? requestId : null]
    .filter(Boolean)
    .join(" · ");
}

const FILE_PROBLEMS: Record<ImportFileProblem, string> = {
  no_file: "import.errNoFile",
  unreadable: "import.errUnreadable",
  unrecognised: "import.errUnrecognised",
  empty: "import.errEmpty",
  not_lumovio: "import.errNotLumovio",
  daily_limit: "import.errDailyLimit",
};

/** A refused import upload: the server names the problem as the "file" issue. */
export function importUploadErrorKey(e: unknown): string {
  if (!(e instanceof ApiRequestError)) return "errors.generic";
  const problem = e.issues?.find((i) => i.path === "file")?.message as ImportFileProblem | undefined;
  if (problem && FILE_PROBLEMS[problem]) return FILE_PROBLEMS[problem];
  if (e.status === 413) return "import.errTooLarge";
  if (e.code === "bad_request") return "import.errorFile";
  return apiErrorKey(e);
}
