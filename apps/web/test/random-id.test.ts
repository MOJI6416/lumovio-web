import { afterEach, describe, expect, it, vi } from "vitest";
import { randomId } from "../src/lib/random-id";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.restoreAllMocks());

describe("randomId — also where crypto.randomUUID is missing (http from a LAN address, as on a phone)", () => {
  it("is crypto.randomUUID where there is one", () => {
    const spy = vi.spyOn(crypto, "randomUUID");
    expect(randomId()).toMatch(V4);
    expect(spy).toHaveBeenCalled();
  });

  it("makes a v4 UUID from getRandomValues without it", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const ids = new Set(Array.from({ length: 50 }, () => randomId()));
      expect(ids.size).toBe(50);
      for (const id of ids) expect(id).toMatch(V4);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});
