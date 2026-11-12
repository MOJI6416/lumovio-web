import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../src/lib/api";
import { meFailure } from "../src/lib/me-state";
import { MediaNetError, refineAddressError } from "../src/lib/media/net";

describe("a failed /api/me: sign in or 'temporarily unavailable'", () => {
  it("sends only a missing session to sign in", () => {
    expect(meFailure(new ApiRequestError(401, "unauthorized", "Sign in required"))).toBe("signed-out");
    expect(meFailure(new ApiRequestError(403, "forbidden", "Forbidden"))).toBe("signed-out");
  });
  it("treats a network error, a timeout and a 5xx as Lumovio being down", () => {
    expect(meFailure(new ApiRequestError(0, "network", "API unreachable"))).toBe("unavailable");
    expect(meFailure(new ApiRequestError(500, "internal", "Something went wrong"))).toBe("unavailable");
    expect(meFailure(new ApiRequestError(502, "upstream_unavailable", "Bad gateway"))).toBe("unavailable");
    expect(meFailure(new ApiRequestError(503, "internal", "Service Unavailable"))).toBe("unavailable");
    expect(meFailure(new DOMException("The operation timed out.", "TimeoutError"))).toBe("unavailable");
    expect(meFailure(new Error("anything else"))).toBe("unavailable");
  });
});

describe("add-server errors for a host name that doesn't exist", () => {
  const url = "http://no-such-host.invalid:8096";
  it("turns certificate, unreachable, timeout and mixed-content errors into 'not found' when DNS says so", async () => {
    for (const code of ["tls", "unreachable", "timeout", "mixed_content"] as const) {
      const out = await refineAddressError(new MediaNetError(code, "x"), url, async () => false);
      expect(out instanceof MediaNetError && out.code, code).toBe("not_found");
    }
  });
  it("keeps the original error when the name exists, can't be judged or the check fails", async () => {
    const tls = new MediaNetError("tls", "x");
    expect(await refineAddressError(tls, url, async () => true)).toBe(tls);
    expect(await refineAddressError(tls, url, async () => null)).toBe(tls);
    expect(
      await refineAddressError(tls, url, async () => {
        throw new Error("API down");
      }),
    ).toBe(tls);
  });
  it("doesn't ask about errors a server's answer caused", async () => {
    let asked = false;
    const lookup = async () => {
      asked = true;
      return false;
    };
    for (const code of ["auth", "cors", "http", "local_network"] as const) {
      const e = new MediaNetError(code, "x");
      expect(await refineAddressError(e, url, lookup)).toBe(e);
    }
    expect(asked).toBe(false);
  });
});
