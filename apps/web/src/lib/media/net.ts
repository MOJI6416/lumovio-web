import { randomId } from "../random-id";

/**
 * Direct device → media-server requests, with errors classified into things a person can fix
 * (mixed content, CORS, local-network permission, TLS, auth, timeout).
 */
export type NetErrorCode = "mixed_content" | "cors" | "timeout" | "auth" | "local_network" | "tls" | "http" | "unreachable" | "not_found";

export class MediaNetError extends Error {
  constructor(
    readonly code: NetErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1\]?|[^.]+\.local$|[^.]+\.lan$|[^.]+\.home\.arpa$)/i;

const LOOPBACK_HOST = /^(localhost|127(\.\d{1,3}){3}|\[::1\])$/i;

export function isPrivateHost(url: string): boolean {
  try {
    return PRIVATE_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Chrome's Local Network Access address space of a server: "loopback" for this device, "local" for
 * the LAN. Chrome refuses a request whose server turns out to be in another space than the one
 * declared, even with the permission granted ("target IP address space of `local` yet the resource
 * is in address space `loopback`"), so localhost must never be declared "local".
 */
export function targetAddressSpace(url: string): "loopback" | "local" | undefined {
  if (!isPrivateHost(url)) return undefined;
  return LOOPBACK_HOST.test(new URL(url).hostname) ? "loopback" : "local";
}

/** The person (or a policy) refused this page access to that address space. Chrome 142+; secure pages only. */
async function localNetworkDenied(space: "loopback" | "local" | undefined): Promise<boolean> {
  if (!space || typeof navigator === "undefined" || !navigator.permissions || !globalThis.isSecureContext) return false;
  // Chrome 151/155 answer per space; "local-network-access" is the name LNA launched with (142).
  for (const name of [space === "loopback" ? "loopback-network" : "local-network", "local-network-access"]) {
    try {
      return (await navigator.permissions.query({ name: name as PermissionName })).state === "denied";
    } catch {
      // name not known to this browser
    }
  }
  return false;
}

/** Plain-HTTP servers can't be called from an HTTPS page (mixed content), except via Chrome's LNA path. */
export function mixedContentBlocked(url: string): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:" && url.startsWith("http://");
}

export async function mediaFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 12_000, ...rest } = init;
  // Chrome's Local Network Access: annotate requests to private addresses so the browser can ask
  // the user for permission (and exempt http:// LAN targets from mixed-content blocking; Chrome
  // never counts loopback as mixed content).
  const space = targetAddressSpace(url);
  const opts: RequestInit & { targetAddressSpace?: string } = { ...rest, signal: rest.signal ?? AbortSignal.timeout(timeoutMs), credentials: "omit", cache: "no-store", targetAddressSpace: space };
  let res: Response;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    const e = err as Error;
    if (e.name === "TimeoutError" || e.name === "AbortError") throw new MediaNetError("timeout", "The server didn't answer in time");
    if (/permission|local network|private network/i.test(e.message) || (await localNetworkDenied(space))) {
      throw new MediaNetError("local_network", "The browser isn't allowed to reach this device or network");
    }
    const lnaExempt = space === "loopback" || (space === "local" && "targetAddressSpace" in Request.prototype);
    if (mixedContentBlocked(url) && !lnaExempt) throw new MediaNetError("mixed_content", "Blocked: HTTP server on an HTTPS page");
    // fetch() hides the reason; a CORS failure and a dead host look identical. Probe with no-cors.
    try {
      await fetch(url, { mode: "no-cors", signal: AbortSignal.timeout(5000), targetAddressSpace: space } as RequestInit);
      throw new MediaNetError("cors", "The server answered but refused cross-origin access (CORS)");
    } catch (probe) {
      if (probe instanceof MediaNetError) throw probe;
      // Not even an opaque answer: the server is off, the name or port is wrong, or (https) its certificate is refused.
      // fetch() can't tell which, so it isn't called a certificate problem (PLR-17).
      throw new MediaNetError("unreachable", "The server is unreachable from this device");
    }
  }
  if (res.status === 401 || res.status === 403) throw new MediaNetError("auth", "The server rejected the credentials", res.status);
  if (!res.ok) throw new MediaNetError("http", `Server responded with ${res.status}`, res.status);
  return res;
}

/** Failures a misspelt or non-existent host name also produces: fetch() can't tell them apart. */
const ADDRESS_SUSPECT: NetErrorCode[] = ["tls", "unreachable", "timeout", "mixed_content"];

/**
 * A failed request to a typed server address, refined for the "add server" dialog (SRV-02): the
 * browser reports a host name that doesn't exist like a certificate or network problem, so Lumovio is
 * asked whether the name exists in DNS at all. `lookup` answers true / false / null (can't tell); only
 * a definite "no such name" becomes `not_found`, anything else keeps the original error.
 */
export async function refineAddressError(err: unknown, url: string, lookup: (url: string) => Promise<boolean | null>): Promise<unknown> {
  if (!(err instanceof MediaNetError) || !ADDRESS_SUSPECT.includes(err.code)) return err;
  let found: boolean | null;
  try {
    found = await lookup(url);
  } catch {
    // The check is a hint: when it fails, the original error stands.
    found = null;
  }
  return found === false ? new MediaNetError("not_found", "No server with this name exists") : err;
}

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/** Stable per-browser device id (needed by Jellyfin/Plex session APIs). */
export function deviceId(): string {
  const k = "lumovio.deviceId";
  try {
    let id = localStorage.getItem(k);
    if (!id) {
      id = randomId();
      localStorage.setItem(k, id);
    }
    return id;
  } catch {
    return "lumovio-web";
  }
}
