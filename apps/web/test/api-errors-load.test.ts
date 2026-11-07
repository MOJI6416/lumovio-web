import { API_ERROR_CODES } from "@lumovio/contracts";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ru from "../messages/ru.json";
import uk from "../messages/uk.json";
import { ApiRequestError } from "../src/lib/api";
import { apiErrorKey, errorDetails, isRetryable, loadErrorKeys } from "../src/lib/api-errors";

// design-system 8.5, audit L10N-04: every API code has words in one place; e.message never reaches the user.

const has = (messages: unknown, key: string) =>
  key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages) !==
  undefined;
const err = (status: number, code: ConstructorParameters<typeof ApiRequestError>[1]) =>
  new ApiRequestError(status, code, "Some English text from the server");

describe("API error words (Ф1)", () => {
  it("gives every code the API sends a key that exists in ru, uk and en", () => {
    for (const code of [...API_ERROR_CODES, "network" as const]) {
      const e = err(code === "network" ? 0 : 400, code);
      for (const place of ["page", "section"] as const) {
        const { title, text } = loadErrorKeys(e, place);
        for (const key of [apiErrorKey(e), title, text])
          for (const m of [ru, uk, en]) expect(has(m, key), `${code} ${key}`).toBe(true);
      }
    }
  });

  it("maps the new codes in actions", () => {
    expect(apiErrorKey(err(403, "kids_restricted"))).toBe("errors.kidsRestricted");
    expect(apiErrorKey(err(404, "not_found"))).toBe("errors.notFound");
    expect(apiErrorKey(err(403, "forbidden"))).toBe("errors.forbidden");
    expect(apiErrorKey(err(409, "conflict"))).toBe("errors.conflict");
    // The 5xx and validation stay "something went wrong": the details go to the server log.
    expect(apiErrorKey(err(500, "internal"))).toBe("errors.generic");
    expect(apiErrorKey(err(400, "bad_request"))).toBe("errors.generic");
  });

  it("words a failed load by place and cause", () => {
    expect(loadErrorKeys(err(0, "network"), "section")).toEqual({
      title: "errors.loadTitle",
      text: "errors.network",
    });
    expect(loadErrorKeys(err(0, "network"), "page")).toEqual({
      title: "errors.unavailableTitle",
      text: "errors.network",
    });
    expect(loadErrorKeys(err(500, "internal"), "section")).toEqual({
      title: "errors.loadTitle",
      text: "errors.loadText",
    });
    expect(loadErrorKeys(err(500, "internal"), "page")).toEqual({
      title: "errors.serverTitle",
      text: "errors.loadText",
    });
    expect(loadErrorKeys(err(403, "kids_restricted"))).toEqual({
      title: "profiles.kidsRestrictedTitle",
      text: "profiles.kidsRestrictedText",
    });
    expect(loadErrorKeys(err(404, "not_found"), "page")).toEqual({
      title: "errors.notFoundTitle",
      text: "errors.notFoundText",
    });
    expect(loadErrorKeys(err(429, "rate_limited"))).toEqual({
      title: "errors.loadTitle",
      text: "errors.rateLimited",
    });
    expect(loadErrorKeys(new TypeError("x is undefined"))).toEqual({
      title: "errors.loadTitle",
      text: "errors.loadText",
    });
  });

  it("offers Retry only where retrying can help", () => {
    expect(isRetryable(err(0, "network"))).toBe(true);
    expect(isRetryable(err(500, "internal"))).toBe(true);
    expect(isRetryable(err(429, "rate_limited"))).toBe(true);
    expect(isRetryable(new Error("boom"))).toBe(true);
    expect(isRetryable(err(403, "kids_restricted"))).toBe(false);
    expect(isRetryable(err(404, "not_found"))).toBe(false);
    expect(isRetryable(err(401, "unauthorized"))).toBe(false);
  });

  it("folds only the status, code and request id into the details", () => {
    expect(errorDetails(err(500, "internal"))).toBe("HTTP 500 · internal");
    expect(errorDetails(err(0, "network"))).toBe("network");
    const withId = Object.assign(err(502, "upstream_unavailable"), { requestId: "req-7f3a" });
    expect(errorDetails(withId)).toBe("HTTP 502 · upstream_unavailable · req-7f3a");
    expect(errorDetails(err(500, "internal"))).not.toContain("English");
    expect(errorDetails(new Error("Some English text"))).toBeNull();
  });
});
