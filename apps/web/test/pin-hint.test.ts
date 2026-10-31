import { describe, expect, it } from "vitest";
import { adultWithoutPin, showPinHint } from "../src/components/profiles/pin-hint";

// "Set a PIN on adult profiles" on Who's watching? (design-system 8.10): when it shows and which profile it opens.

const adult = (name: string, hasPin = false) => ({ name, isKids: false, hasPin });
const kid = (name: string, hasPin = false) => ({ name, isKids: true, hasPin });
const now = Date.parse("2026-10-29T12:00:00Z");
const DAY = 86_400_000;
const open = { snoozedUntil: null };
const family = [adult("Anna"), adult("Ben", true), kid("Mia")];

describe("the adult profile Set PIN opens", () => {
  it("is the first adult profile without a PIN, in the picker's order", () => {
    expect(adultWithoutPin(family)?.name).toBe("Anna");
    expect(adultWithoutPin([adult("Anna", true), kid("Mia"), adult("Ben"), adult("Cleo")])?.name).toBe("Ben");
  });

  it("is none without a kids profile, or when every adult profile has a PIN", () => {
    expect(adultWithoutPin([adult("Anna"), adult("Ben")])).toBeNull();
    expect(adultWithoutPin([adult("Anna", true), kid("Mia")])).toBeNull();
    // A kids profile without a PIN isn't asked for one: it's the adult profiles that need closing.
    expect(adultWithoutPin([adult("Anna", true), kid("Mia"), kid("Leo")])).toBeNull();
  });
});

describe("whether Who's watching? shows the hint", () => {
  it("shows with a kids profile and an adult one without a PIN, in an adult session or with no profile chosen", () => {
    expect(showPinHint({ profiles: family, active: { isKids: false }, hint: open, now })).toBe(true);
    // Right after signing in again: no active profile yet.
    expect(showPinHint({ profiles: family, active: null, hint: open, now })).toBe(true);
  });

  it("doesn't show without a kids profile or when every adult profile has a PIN", () => {
    expect(showPinHint({ profiles: [adult("Anna"), adult("Ben")], active: null, hint: open, now })).toBe(
      false,
    );
    expect(
      showPinHint({
        profiles: [adult("Anna", true), adult("Ben", true), kid("Mia")],
        active: null,
        hint: open,
        now,
      }),
    ).toBe(false);
  });

  it("doesn't show in a kids session", () => {
    expect(showPinHint({ profiles: family, active: { isKids: true }, hint: open, now })).toBe(false);
  });

  it("Not now hides it until its time has passed", () => {
    const snoozed = (days: number) => ({ snoozedUntil: new Date(now + days * DAY).toISOString() });
    expect(showPinHint({ profiles: family, active: null, hint: snoozed(30), now })).toBe(false);
    expect(showPinHint({ profiles: family, active: null, hint: snoozed(1), now })).toBe(false);
    expect(showPinHint({ profiles: family, active: null, hint: snoozed(0), now })).toBe(true);
    expect(showPinHint({ profiles: family, active: null, hint: snoozed(-1), now })).toBe(true);
  });

  it("doesn't show when Not now couldn't be read", () => {
    expect(showPinHint({ profiles: family, active: null, hint: null, now })).toBe(false);
  });
});
