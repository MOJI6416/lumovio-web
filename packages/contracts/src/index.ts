export * from "./account";
export * from "./ai";
export * from "./imports";
export * from "./integrations";
export * from "./library";
export * from "./media";
export * from "./providers";
export * from "./recommendations";

/** Error body returned by every failing Lumovio API call. */
export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field-level validation issues, when relevant. */
    issues?: { path: string; message: string }[];
    requestId?: string;
  };
}

export const API_ERROR_CODES = [
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "profile_required",
  "pin_required",
  "password_required",
  /** The active profile is a kids profile and the action belongs to an adult (account, servers, import, profiles). */
  "kids_restricted",
  /** A TV's session and an action that is done on a phone or a computer (account, servers, import, profiles). */
  "tv_restricted",
  /** The admin's request without a live admin session: confirm with the second factor first (admin handoff A0). */
  "step_up_required",
  "maturity_blocked",
  /** The title is hidden at a rights holder's request (Admin → Catalog): its pages answer this for everyone. */
  "title_unavailable",
  "upstream_unavailable",
  "not_configured",
  "internal",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
