import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// Item 9 (A10, A11): the service worker forwards to a TorrServer, with its password, only what the player asks for,
// and asks the API for the password once however many requests come at once. sw.js runs in a VM with a fake fetch.
const CONN = "7b0f7f8e-6a7c-4d0e-9d55-6f1f1f0f0a01";
const HASH = "a".repeat(40);

function worker() {
  const handlers: Record<string, (e: unknown) => void> = {};
  const calls: string[] = [];
  const fetch = async (u: string) => {
    calls.push(String(u));
    if (String(u).startsWith("/api/connections/"))
      return new Response(JSON.stringify({ baseUrl: "http://192.168.1.5:8090", auth: { kind: "torrserver", username: "admin", password: "x" } }));
    return new Response("video", { status: 206 });
  };
  const self = { addEventListener: (t: string, f: (e: unknown) => void) => (handlers[t] = f), location: { origin: "https://lumovio.test" }, skipWaiting() {}, clients: { claim() {} } };
  runInNewContext(readFileSync("public/sw.js", "utf8"), { self, fetch, URL, URLSearchParams, Headers, Response, TextEncoder, btoa, Date, Promise, Map });
  const request = async (path: string, mode = "cors") => {
    let out: Promise<Response> | null = null;
    handlers.fetch!({ request: { url: `https://lumovio.test${path}`, mode, headers: new Headers() }, respondWith: (p: Promise<Response>) => (out = Promise.resolve(p)) });
    return out ? (await out).status : null;
  };
  return { request, calls };
}

describe("the TorrServer bridge (item 9)", () => {
  it("forwards a file's stream by hash, subtitles and a playlist", async () => {
    const w = worker();
    expect(await w.request(`/__ts/${CONN}/stream/F1.mkv?link=${HASH}&index=1&play`)).toBe(206);
    expect(await w.request(`/__ts/${CONN}/subs/${HASH}/1?track=2`)).toBe(206);
    expect(await w.request(`/__ts/${CONN}/play/${HASH}/1`)).toBe(206);
  });

  it("refuses an add by link, settings, removal and a page opened by address", async () => {
    const w = worker();
    expect(await w.request(`/__ts/${CONN}/stream/x?link=magnet:?xt=urn:btih:${HASH}&save&play`)).toBe(403);
    expect(await w.request(`/__ts/${CONN}/stream/x?link=${HASH}&index=1&stat`)).toBe(403);
    expect(await w.request(`/__ts/${CONN}/settings`)).toBe(403);
    expect(await w.request(`/__ts/${CONN}/torrents`)).toBe(403);
    expect(await w.request(`/__ts/${CONN}/stream/F1.mkv?link=${HASH}&index=1&play`, "navigate")).toBe(403);
    expect(w.calls.filter((c) => !c.startsWith("/api/"))).toEqual([]);
  });

  it("asks for the password once for requests that come together", async () => {
    const w = worker();
    await Promise.all([1, 2, 3, 4].map((i) => w.request(`/__ts/${CONN}/stream/F1.mkv?link=${HASH}&index=${i}&play`)));
    expect(w.calls.filter((c) => c.startsWith("/api/connections/")).length).toBe(1);
  });
});
