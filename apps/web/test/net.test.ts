import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaNetError, mediaFetch, targetAddressSpace } from "../src/lib/media/net";

// Chrome's Local Network Access refuses a request declared "local" whose server is on loopback (and the
// reverse), even with the permission granted — checked in Chrome 155 from https://lumovio.app.

describe("targetAddressSpace", () => {
  it("declares this device loopback", () => {
    for (const url of [
      "http://localhost:8090",
      "http://127.0.0.1:8090/echo",
      "http://127.1.2.3",
      "http://[::1]:8096",
    ]) {
      expect(targetAddressSpace(url), url).toBe("loopback");
    }
  });

  it("declares the LAN local", () => {
    for (const url of [
      "http://192.168.1.20:8090",
      "http://10.0.0.5:8096",
      "http://172.16.4.2",
      "http://169.254.10.1",
      "http://nas.local:8096",
      "http://box.lan",
      "https://tv.home.arpa",
    ]) {
      expect(targetAddressSpace(url), url).toBe("local");
    }
  });

  it("declares nothing for public servers or bad URLs", () => {
    for (const url of ["https://torr.example.org", "http://8.8.8.8", "http://172.32.0.1", "not a url"]) {
      expect(targetAddressSpace(url), url).toBeUndefined();
    }
  });
});

describe("mediaFetch on an HTTPS page", () => {
  const refused = () => Promise.reject(new TypeError("Failed to fetch"));
  const permission = (states: Record<string, string>) =>
    vi.stubGlobal("navigator", {
      permissions: {
        query: async ({ name }: { name: string }) => {
          if (!(name in states)) throw new TypeError(`unknown permission ${name}`);
          return { state: states[name] };
        },
      },
    });

  afterEach(() => vi.unstubAllGlobals());
  const onLumovio = () => {
    vi.stubGlobal("window", { location: { protocol: "https:" } });
    vi.stubGlobal("isSecureContext", true);
  };
  const codeOf = (url: string) =>
    mediaFetch(url).then(
      () => "ok",
      (e) => (e instanceof MediaNetError ? e.code : String(e)),
    );

  it("sends the address space with the request and the probe", async () => {
    onLumovio();
    const fetch = vi.fn(async () => new Response("MatriX"));
    vi.stubGlobal("fetch", fetch);
    await mediaFetch("http://localhost:8090/echo");
    await mediaFetch("http://192.168.1.20:8090/echo");
    await mediaFetch("https://torr.example.org/echo");
    expect(
      fetch.mock.calls.map(
        (c) => (c as unknown as [string, { targetAddressSpace?: string }])[1].targetAddressSpace,
      ),
    ).toEqual(["loopback", "local", undefined]);
  });

  it("reports a refused permission as local_network, not CORS or mixed content", async () => {
    onLumovio();
    permission({ "loopback-network": "denied", "local-network": "granted" });
    // the no-cors probe would succeed, which used to read as "cors"
    vi.stubGlobal(
      "fetch",
      vi.fn((_: string, init?: RequestInit) =>
        init?.mode === "no-cors" ? Promise.resolve(new Response()) : refused(),
      ),
    );
    expect(await codeOf("http://localhost:8090/echo")).toBe("local_network");
  });

  it("falls back to the single permission of Chrome 142", async () => {
    onLumovio();
    permission({ "local-network-access": "denied" });
    vi.stubGlobal("fetch", vi.fn(refused));
    expect(await codeOf("http://127.0.0.1:8090/echo")).toBe("local_network");
  });

  it("calls an https server that doesn't answer at all unreachable, not a certificate problem", async () => {
    onLumovio();
    vi.stubGlobal("fetch", vi.fn(refused));
    expect(await codeOf("https://torr.example.org/echo")).toBe("unreachable");
  });

  it("never calls an HTTP server on this device mixed content", async () => {
    onLumovio();
    permission({ "loopback-network": "granted" });
    vi.stubGlobal("fetch", vi.fn(refused));
    expect(await codeOf("http://localhost:8090/echo")).toBe("unreachable");
    expect(await codeOf("http://torr.example.org/echo")).toBe("mixed_content");
  });
});

describe("an http:// server of the home network on an HTTPS page (limitations: LAN address pre-check)", () => {
  const refused = () => Promise.reject(new TypeError("Failed to fetch"));
  afterEach(() => vi.unstubAllGlobals());
  const onLumovio = (lna: boolean) => {
    vi.stubGlobal("window", { location: { protocol: "https:" } });
    vi.stubGlobal("isSecureContext", true);
    // Chrome 142+ knows `targetAddressSpace` on its requests; other browsers don't.
    vi.stubGlobal("Request", lna ? class { targetAddressSpace = "unknown"; } : class {});
  };
  const codeOf = (url: string) =>
    mediaFetch(url).then(
      () => "ok",
      (e) => (e instanceof MediaNetError ? e.code : String(e)),
    );

  it("is tried, and reached once the browser lets it through", async () => {
    onLumovio(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("MatriX")));
    expect(await codeOf("http://192.168.1.20:8090/echo")).toBe("ok");
  });

  it("says the person refused the local network, when they did", async () => {
    onLumovio(true);
    vi.stubGlobal("navigator", { permissions: { query: async () => ({ state: "denied" }) } });
    vi.stubGlobal("fetch", vi.fn(refused));
    expect(await codeOf("http://192.168.1.20:8090/echo")).toBe("local_network");
  });

  it("is mixed content in a browser without Local Network Access", async () => {
    onLumovio(false);
    vi.stubGlobal("fetch", vi.fn(refused));
    expect(await codeOf("http://192.168.1.20:8090/echo")).toBe("mixed_content");
  });
});

describe("a failed check as the server's row keeps it", () => {
  it("is the failure's kind, read back; anything else is no failure", async () => {
    const { failureDetail, storedFailure } = await import("../src/components/connections/net-errors");
    expect(storedFailure(failureDetail(new MediaNetError("local_network", "x")))).toBe("local_network");
    expect(failureDetail(new Error("x"))).toBeNull();
    expect(storedFailure("Jellyfin 10.10.7")).toBeNull();
    expect(storedFailure("net:nonsense")).toBeNull();
    expect(storedFailure(null)).toBeNull();
  });
});
