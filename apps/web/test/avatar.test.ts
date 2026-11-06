import { AVATARS } from "@lumovio/contracts";
import { describe, expect, it } from "vitest";
import { AVATAR_COLORS, avatarColor } from "@/components/ui/Avatar";

// Avatars (design-system 7.17, owner 2026-11-06): the profile's photo or its colour with the letter; the drawn marks
// of 2026-11-01 are gone.
describe("avatar colours", () => {
  it("draws every colour the API knows", () => {
    expect([...AVATAR_COLORS].sort()).toEqual([...AVATARS].sort());
  });

  it("reads a value saved with a mark, or an unknown one, as a colour", () => {
    expect(avatarColor("ember")).toBe("ember");
    expect(avatarColor("ember.fox")).toBe("ember");
    expect(avatarColor("teal")).toBe("aurora");
    expect(avatarColor("")).toBe("aurora");
  });
});
