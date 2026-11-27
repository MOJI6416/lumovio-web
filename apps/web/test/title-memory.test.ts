import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { memoryId } from "../src/lib/title-memory";
import { moveTitleMemory } from "../src/lib/title-memory-move";

/** A device's storage, in memory. */
function storage(initial: Record<string, string>) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
    m,
  };
}

const CODES: Record<string, string> = { "movie:603": "ewzsjd5z", "tv:1396": "yqhpj8hb" };
let asked: string[][] = [];
const ask = async (ids: string[]) => {
  asked.push(ids);
  return Object.fromEntries(ids.flatMap((id) => (CODES[id] ? [[id, CODES[id]]] : [])));
};

describe("this device's memory by title", () => {
  let s: ReturnType<typeof storage>;
  beforeEach(() => {
    asked = [];
    s = storage({
      "lumovio.player.voice": JSON.stringify({ "p1:movie:603": "ru|LostFilm", "guest:tv:1396": "en|", "p1:movie:999": "de|" }),
      "lumovio.player.subtitles": JSON.stringify({ "p1:tv:1396": { lang: "ru" } }),
      "lumovio.player.subtitle-offset": JSON.stringify({ "p1:movie:603": 1.5 }),
      "lumovio.finds.tried:p1": JSON.stringify({ "tv:1396": 1, "movie:603": 2 }),
      "lumovio:guest-intent": JSON.stringify({ titleId: "movie:603", action: "watchlist", at: 5 }),
      "lumovio.player.volume": "0.5",
    });
    // Object.keys(localStorage) lists the stored keys, as in a browser.
    const proxy = new Proxy(s, { ownKeys: () => [...s.m.keys()], getOwnPropertyDescriptor: (_t, k) => (s.m.has(String(k)) ? { enumerable: true, configurable: true, value: s.m.get(String(k)) } : undefined) });
    (globalThis as { localStorage?: unknown }).localStorage = proxy;
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it("is kept under the title's code, else its older key", () => {
    expect(memoryId({ code: "ewzsjd5z", id: "movie:603" })).toBe("ewzsjd5z");
    expect(memoryId({ id: "movie:603" })).toBe("movie:603");
  });

  it("moves from the older keys to the codes once, with one request, keeping the order and the rest", async () => {
    await moveTitleMemory(ask);
    expect(asked).toHaveLength(1);
    expect(asked[0]!.sort()).toEqual(["movie:603", "movie:999", "tv:1396"]);
    expect(Object.entries(JSON.parse(s.getItem("lumovio.player.voice")!))).toEqual([
      ["p1:ewzsjd5z", "ru|LostFilm"],
      ["guest:yqhpj8hb", "en|"],
      // Not in the catalog: left as it was.
      ["p1:movie:999", "de|"],
    ]);
    expect(JSON.parse(s.getItem("lumovio.player.subtitles")!)).toEqual({ "p1:yqhpj8hb": { lang: "ru" } });
    expect(JSON.parse(s.getItem("lumovio.player.subtitle-offset")!)).toEqual({ "p1:ewzsjd5z": 1.5 });
    expect(JSON.parse(s.getItem("lumovio.finds.tried:p1")!)).toEqual({ yqhpj8hb: 1, ewzsjd5z: 2 });
    expect(JSON.parse(s.getItem("lumovio:guest-intent")!)).toEqual({ titleId: "ewzsjd5z", action: "watchlist", at: 5 });
    expect(s.getItem("lumovio.player.volume")).toBe("0.5");
    await moveTitleMemory(ask);
    expect(asked).toHaveLength(1);
  });

  it("tries again on the next visit when the request fails", async () => {
    await expect(
      moveTitleMemory(async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow();
    expect(s.getItem("lumovio.memory.codes")).toBeNull();
    expect(JSON.parse(s.getItem("lumovio.player.voice")!)["p1:movie:603"]).toBe("ru|LostFilm");
    await moveTitleMemory(ask);
    expect(s.getItem("lumovio.memory.codes")).toBe("1");
  });
});
