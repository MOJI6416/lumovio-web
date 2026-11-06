import { describe, expect, it } from "vitest";
import { nameFromEmail } from "../src/components/auth/email";
import { inboxOf } from "../src/components/auth/inboxes";

describe("sign-up without a name field: the first profile is named from the address", () => {
  it("takes the first word, capitalised, without trailing digits", () => {
    expect(nameFromEmail("ivan.petrov88@gmail.com")).toBe("Ivan");
    expect(nameFromEmail("petrov88@ukr.net")).toBe("Petrov");
    expect(nameFromEmail("anna_k+films@proton.me")).toBe("Anna");
    expect(nameFromEmail("олена.коваль@ukr.net")).toBe("Олена");
    expect(nameFromEmail("e2e-lk3j2-1234-0@example.test")).toBe("E2e");
  });
  it("keeps an address without letters as it is, and never gives an empty name", () => {
    expect(nameFromEmail("12345@mail.ru")).toBe("12345");
    expect(nameFromEmail("@x.y")).toBe("Me");
    expect(nameFromEmail(`${"a".repeat(60)}@x.y`)).toHaveLength(40);
  });
});

describe("\"Open email\" for the common mail services only", () => {
  it("knows the service by the address's domain, in any case", () => {
    expect(inboxOf("someone@Gmail.com")).toBe("https://mail.google.com/mail/u/0/#inbox");
    expect(inboxOf("someone@hotmail.com")).toBe("https://outlook.live.com/mail/0/");
    expect(inboxOf("someone@ukr.net")).toBe("https://mail.ukr.net/");
  });
  it("offers nothing for any other domain", () => {
    expect(inboxOf("someone@lumovio.test")).toBeNull();
    expect(inboxOf("no-at-sign")).toBeNull();
  });
});
