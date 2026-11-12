import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ru from "../messages/ru.json";
import uk from "../messages/uk.json";
import { ApiRequestError } from "../src/lib/api";
import { AUTH_NETWORK_ERROR, apiErrorKey, authErrorKey, importUploadErrorKey } from "../src/lib/api-errors";

const has = (messages: unknown, key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages) !== undefined;

describe("auth errors are translated, never shown raw", () => {
  const cases: [Parameters<typeof authErrorKey>[0], string][] = [
    [{ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password", status: 401 }, "auth.invalidCredentials"],
    [{ code: "INVALID_EMAIL", message: "Invalid email", status: 400 }, "auth.errInvalidEmail"],
    [{ code: "VALIDATION_ERROR", message: "[body.email] Invalid email address", status: 400 }, "auth.errInvalidEmail"],
    [{ code: "VALIDATION_ERROR", message: "[body.newPassword] Too small", status: 400 }, "auth.errPasswordShort"],
    [{ code: "VALIDATION_ERROR", message: "[body.name] Too big", status: 400 }, "auth.errInvalidInput"],
    [{ code: "INVALID_TOKEN", message: "Invalid token", status: 400 }, "auth.errLinkExpired"],
    [{ code: "INVALID_TWO_FACTOR_COOKIE", message: "Invalid two factor cookie", status: 401 }, "auth.errCodeExpired"],
    [{ code: "INVALID_CODE", message: "Invalid code", status: 401 }, "auth.errCode"],
    [{ code: "PASSWORD_COMPROMISED", message: "This password appeared in a known data breach.", status: 400 }, "auth.errPasswordCompromised"],
    [{ message: "Too many requests. Please try again later.", status: 429 }, "errors.rateLimited"],
    [AUTH_NETWORK_ERROR, "errors.network"],
    [{ code: "SOMETHING_NEW", message: "Some English sentence", status: 400 }, "auth.genericError"],
    [null, "auth.genericError"],
  ];
  it.each(cases)("%j → %s", (err, key) => {
    expect(authErrorKey(err)).toBe(key);
  });

  it("has every key in ru, uk and en", () => {
    for (const [err] of cases) {
      const key = authErrorKey(err);
      for (const m of [ru, uk, en]) expect(has(m, key), key).toBe(true);
    }
  });
});

describe("API and import errors", () => {
  it("names the problem of a refused import file", () => {
    const refused = (problem: string, status = 400, code: "bad_request" | "rate_limited" = "bad_request") =>
      new ApiRequestError(status, code, "English text", [{ path: "file", message: problem }]);
    expect(importUploadErrorKey(refused("unreadable"))).toBe("import.errUnreadable");
    expect(importUploadErrorKey(refused("unrecognised"))).toBe("import.errUnrecognised");
    expect(importUploadErrorKey(refused("empty"))).toBe("import.errEmpty");
    expect(importUploadErrorKey(refused("daily_limit", 429, "rate_limited"))).toBe("import.errDailyLimit");
    expect(importUploadErrorKey(new ApiRequestError(413, "bad_request", "request file too large"))).toBe("import.errTooLarge");
    expect(importUploadErrorKey(new ApiRequestError(400, "bad_request", "Invalid request"))).toBe("import.errorFile");
    expect(importUploadErrorKey(new ApiRequestError(429, "rate_limited", "Too many requests. Retry in 30s."))).toBe("errors.rateLimited");
    expect(importUploadErrorKey(new ApiRequestError(0, "network", "Network error"))).toBe("errors.network");
  });

  it("never passes a server message through", () => {
    expect(apiErrorKey(new ApiRequestError(500, "internal", 'Failed query: insert into "rating"'))).toBe("errors.generic");
    expect(apiErrorKey(new Error("boom"))).toBe("errors.generic");
    expect(apiErrorKey(new ApiRequestError(429, "rate_limited", "x"))).toBe("errors.rateLimited");
  });

  it("has every import and API key in ru, uk and en", () => {
    const keys = ["import.errUnreadable", "import.errUnrecognised", "import.errEmpty", "import.errNotLumovio", "import.errNoFile", "import.errDailyLimit", "import.errTooLarge", "import.errorFile", "errors.generic", "errors.network", "errors.rateLimited", "errors.upstream", "errors.signInRequired", "errors.profileRequired"];
    for (const key of keys) for (const m of [ru, uk, en]) expect(has(m, key), key).toBe(true);
  });
});
