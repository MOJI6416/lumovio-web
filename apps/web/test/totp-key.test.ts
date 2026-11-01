import { describe, expect, it } from "vitest";
import { groupKey, totpSecret } from "@/lib/totp-key";

describe("two-step verification setup key", () => {
  it("takes the secret out of an otpauth address", () => {
    expect(
      totpSecret("otpauth://totp/Lumovio:a%40b.c?secret=jbsw y3dp&issuer=Lumovio&digits=6&period=30"),
    ).toBe("JBSWY3DP");
    expect(totpSecret("otpauth://totp/Lumovio:a%40b.c?issuer=Lumovio")).toBe("");
    expect(totpSecret("not an address")).toBe("");
  });

  it("prints the key in groups of four", () => {
    expect(groupKey("JBSWY3DPEHPK3PXPA")).toBe("JBSW Y3DP EHPK 3PXP A");
    expect(groupKey("")).toBe("");
  });
});
