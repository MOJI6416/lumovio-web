import type { ListDetails } from "@lumovio/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mergedItems, wholeList } from "../src/components/library/whole-list";
import { untilComplete } from "../src/lib/incomplete";

const item = (id: string) => ({ title: { id, kind: "movie", tmdbId: 1, title: id }, runtime: null, note: null, addedAt: "2026-10-01", addedBy: null, fromSource: false }) as ListDetails["items"][number];
const page = (ids: string[], nextOffset: number | null, itemCount = 3) => ({ id: "L", name: "L", itemCount, items: ids.map(item), members: [], nextOffset }) as unknown as ListDetails;

afterEach(() => vi.unstubAllGlobals());

describe("a list page by page", () => {
  it("reads Watchlist and Favourites to the end, one page after another", async () => {
    const asked: string[] = [];
    const answers: Record<string, ListDetails> = {
      "/api/library/watchlist": page(["movie:1", "movie:2"], 2),
      "/api/library/watchlist?offset=2": page(["movie:3"], null),
    };
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      return new Response(JSON.stringify(answers[url]), { status: 200, headers: { "content-type": "application/json" } });
    });
    const l = await wholeList("/api/library/watchlist");
    expect(asked).toEqual(["/api/library/watchlist", "/api/library/watchlist?offset=2"]);
    expect([l.items.map((i) => i.title.id), l.itemCount, l.nextOffset]).toEqual([["movie:1", "movie:2", "movie:3"], 3, null]);
  });

  it("shows a title once when the list moved between two pages", () => {
    expect(mergedItems([page(["movie:1", "movie:2"], 2), page(["movie:2", "movie:3"], null)]).map((i) => i.title.id)).toEqual(["movie:1", "movie:2", "movie:3"]);
  });
});

describe("a summary that says it is incomplete", () => {
  const q = (data: unknown, dataUpdateCount = 1) => ({ state: { data, dataUpdateCount } });
  it("is asked again a second later, a few times at most, and not at all when complete", () => {
    expect(untilComplete(q({ lists: [], incomplete: true }))).toBe(1000);
    expect(untilComplete(q({ lists: [], incomplete: true }, 6))).toBe(false);
    expect(untilComplete(q({ lists: [] }))).toBe(false);
    expect(untilComplete(q(undefined, 0))).toBe(false);
  });
});
