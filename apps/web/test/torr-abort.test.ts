import { afterEach, describe, expect, it, vi } from "vitest";
import { torrServerClient } from "@/lib/media/torrserver";

// P7: "Cancel" (or another source) aborts the launch's requests on the TorrServer too — the stat that waits up to 60 s for
// the torrent's metadata, ffprobe, subtitles — instead of leaving them running beside the next launch.
afterEach(() => vi.unstubAllGlobals());

describe("a cancelled launch stops on the server", () => {
  it("aborts the metadata wait of prepare and of the file list", async () => {
    const seen: (AbortSignal | undefined)[] = [];
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      // The torrent's own record answers at once (no files yet); the metadata wait hangs until aborted.
      if (init.method === "POST") return Promise.resolve(new Response("{}"));
      seen.push(init.signal ?? undefined);
      return new Promise((_ok, fail) => init.signal?.addEventListener("abort", () => fail(new DOMException("aborted", "AbortError"))));
    });
    const ts = torrServerClient("http://ts.test:8090", { kind: "torrserver", username: null, password: null } as never);
    const ctrl = new AbortController();
    const prep = ts.prepare(`${"a".repeat(40)}:1`, { signal: ctrl.signal });
    const files = ts.files("a".repeat(40), ctrl.signal);
    await new Promise((r) => setTimeout(r, 20));
    ctrl.abort();
    await expect(prep).rejects.toBeTruthy();
    await expect(files).rejects.toBeTruthy();
    expect(seen.length).toBeGreaterThan(0);
  }, 3000);
});
