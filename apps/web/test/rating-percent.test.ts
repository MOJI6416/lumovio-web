import { describe, expect, it } from "vitest";
import { percent } from "@/components/title/ratings";

// The space before "%" is a no-break one (U+00A0 or the narrow U+202F, by the ICU version), never a plain space.
const NO_BREAK = [String.fromCharCode(0xa0), String.fromCharCode(0x202f)];

describe("the Tomatometer in per cent", () => {
  it("follows the locale's own way of writing a per cent", () => {
    expect(percent(83, "en")).toBe("83%");
    for (const locale of ["fr", "de"]) {
      const s = percent(83, locale);
      expect(s.startsWith("83") && s.endsWith("%") && s.length === 4).toBe(true);
      expect(NO_BREAK).toContain(s[2]);
    }
    expect(percent(83, "tr")).toBe("%83");
  });
});
