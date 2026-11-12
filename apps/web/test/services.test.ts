import type { WatchProvider } from "@lumovio/contracts";
import { describe, expect, it } from "vitest";
import { withNameLang } from "../src/components/media/recommendation-copy";
import { serviceOf, serviceOffers } from "../src/components/title/services";

const p = (id: number, name: string, kind: WatchProvider["kind"]): WatchProvider => ({ id, name, kind, logoPath: `/${id}.png` });
const KINDS: WatchProvider["kind"][] = ["flatrate", "free", "ads", "rent", "buy"];

describe("a streaming service once, its plan with ads folded in", () => {
  it("knows a plan with ads by its name", () => {
    expect(serviceOf("Netflix Standard with Ads")).toEqual({ name: "Netflix", withAds: true });
    expect(serviceOf("Amazon Prime Video with Ads")).toEqual({ name: "Amazon Prime Video", withAds: true });
    expect(serviceOf("Disney Plus Basic With Ads")).toEqual({ name: "Disney Plus", withAds: true });
    expect(serviceOf("Netflix")).toEqual({ name: "Netflix", withAds: false });
    // A channel sold through another store is a place of its own.
    expect(serviceOf("HBO Max Amazon Channel")).toEqual({ name: "HBO Max Amazon Channel", withAds: false });
  });
  it("gives Heat's US offers one row per service, named and drawn by the service itself", () => {
    const rows = serviceOffers(
      [
        p(8, "Netflix", "flatrate"),
        p(9, "Amazon Prime Video", "flatrate"),
        p(1796, "Netflix Standard with Ads", "flatrate"),
        p(2100, "Amazon Prime Video with Ads", "flatrate"),
        p(10, "Amazon Video", "rent"),
        p(10, "Amazon Video", "buy"),
      ],
      KINDS,
    );
    expect(rows.map((r) => [r.name, r.provider.id, r.kinds.join("+"), r.withAds, r.ids.join("+")])).toEqual([
      ["Netflix", 8, "flatrate", true, "8+1796"],
      ["Amazon Prime Video", 9, "flatrate", true, "9+2100"],
      ["Amazon Video", 10, "rent+buy", false, "10"],
    ]);
  });
  it("names a service by its plan's provider when TMDB lists only the plan, and by the service once it appears", () => {
    expect(serviceOffers([p(1796, "Netflix Standard with Ads", "flatrate")], KINDS).map((r) => [r.name, r.provider.id, r.withAds])).toEqual([["Netflix", 1796, true]]);
    expect(serviceOffers([p(1796, "Netflix Standard with Ads", "flatrate"), p(8, "Netflix", "buy")], KINDS).map((r) => [r.name, r.provider.id, r.kinds.join("+")])).toEqual([["Netflix", 8, "flatrate+buy"]]);
  });
});

describe("a person's name TMDB has only in Latin letters is marked with its language", () => {
  it("wraps the name in a ru/uk heading and leaves a translated one, or an English page, as text", () => {
    const marked = withNameLang("Режиссёр: Michael Mann", "Michael Mann", "ru") as unknown[];
    expect(marked[0]).toBe("Режиссёр: ");
    expect((marked[1] as { props: { lang: string; children: string } }).props).toMatchObject({ lang: "en", children: "Michael Mann" });
    expect(withNameLang("Режиссёр: Майкл Манн", "Майкл Манн", "ru")).toBe("Режиссёр: Майкл Манн");
    expect(withNameLang("Director: Michael Mann", "Michael Mann", "en")).toBe("Director: Michael Mann");
  });
});
