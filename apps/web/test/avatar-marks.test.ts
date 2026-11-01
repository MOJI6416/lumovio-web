import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avatarOf, avatarParts } from "@/components/ui/Avatar";
import { AVATAR_MARK_IDS, avatarMarkHref } from "@/components/ui/avatar-marks";

const sprite = readFileSync(new URL("../public/brand/avatar-marks.svg", import.meta.url), "utf8");

// Avatars "mark on a colour" (design-system 7.17): the marks are symbols of one sprite.
describe("avatar marks", () => {
  it("the sprite draws every mark, on a 24 grid", () => {
    expect(AVATAR_MARK_IDS).toHaveLength(16);
    for (const m of AVATAR_MARK_IDS) expect(sprite).toContain(`<symbol id="${m}" viewBox="0 0 24 24">`);
    expect(sprite.match(/<symbol /g)).toHaveLength(AVATAR_MARK_IDS.length);
    // The stroke and fill come from the page's <svg>: the sprite sets neither (only the eyes' heavier dots).
    expect(sprite).not.toMatch(/fill=|stroke="/);
    expect(avatarMarkHref("fox")).toMatch(/^\/brand\/avatar-marks\.svg\?v=\d+#fox$/);
  });

  it("reads an avatar's colour and mark, an older or unknown one too", () => {
    expect(avatarParts("ember.fox")).toEqual({ color: "ember", mark: "fox" });
    expect(avatarParts("ember")).toEqual({ color: "ember", mark: null });
    expect(avatarParts("ember.unicorn")).toEqual({ color: "ember", mark: null });
    expect(avatarParts("teal.fox")).toEqual({ color: "aurora", mark: "fox" });
    expect(avatarOf("moss", "wave")).toBe("moss.wave");
    expect(avatarOf("moss", null)).toBe("moss");
  });
});
