import type { RangeReader } from "./subs/matroska";

/*
 * A file on a media server read by HTTP ranges, with the server's sign-in sent by the page itself (no service worker):
 * the subtitle engine's Matroska reads and the AVI engine's (`legacy.ts`). A server that ignores ranges is refused
 * rather than read whole.
 */

/** An HTTP source with the server's sign-in (never shown or logged). */
export interface HttpSource {
  url: string;
  headers: Record<string, string>;
  targetAddressSpace?: "loopback" | "local";
}

/** Waiting for a torrent's piece can take a while; a read gives up after this. */
const READ_TIMEOUT = 60_000;

/** Range reads of `src`; a server that ignores ranges is refused rather than read whole. */
export function httpReader(src: HttpSource, signal: AbortSignal): RangeReader {
  return async (start, end) => {
    const res = await fetch(src.url, {
      headers: { ...src.headers, Range: `bytes=${start}-${end - 1}` },
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(READ_TIMEOUT)]),
      ...(src.targetAddressSpace ? { targetAddressSpace: src.targetAddressSpace } : {}),
    } as RequestInit);
    if (res.status === 416) return new Uint8Array(0);
    if (res.status !== 206) {
      await res.body?.cancel();
      throw new Error(`range read: HTTP ${res.status}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  };
}

const MAX_FILE = 8 * 1024 * 1024;

export async function httpFile(src: HttpSource, signal: AbortSignal): Promise<Uint8Array> {
  const res = await fetch(src.url, {
    headers: src.headers,
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(READ_TIMEOUT)]),
    ...(src.targetAddressSpace ? { targetAddressSpace: src.targetAddressSpace } : {}),
  } as RequestInit);
  if (!res.ok) throw new Error(`subtitle file: HTTP ${res.status}`);
  const b = new Uint8Array(await res.arrayBuffer());
  if (b.length > MAX_FILE) throw new Error("subtitle file too big");
  return b;
}
