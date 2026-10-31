import type { ConnectionCredentials, ConnectionSummary } from "@lumovio/contracts";
import { api } from "@/lib/api";
import { jellyfinClient } from "./jellyfin";
import { plexClient } from "./plex";
import { torrServerClient } from "./torrserver";
import type { ProviderClient } from "./types";

const creds = new Map<string, Promise<ConnectionCredentials>>();

/** Fetch (once per page) the owner's credentials for a connection; they stay in memory only. */
export function getCredentials(connectionId: string): Promise<ConnectionCredentials> {
  let p = creds.get(connectionId);
  if (!p) {
    p = api<ConnectionCredentials>(`/api/connections/${connectionId}/credentials`);
    p.catch(() => creds.delete(connectionId));
    creds.set(connectionId, p);
  }
  return p;
}

/** After the address or sign-in of a connection changed (Settings → Servers): the next request fetches them again. */
export function forgetCredentials(connectionId: string) {
  creds.delete(connectionId);
}

export async function clientFor(conn: Pick<ConnectionSummary, "id" | "kind" | "settings">): Promise<ProviderClient> {
  const c = await getCredentials(conn.id);
  switch (c.auth.kind) {
    case "jellyfin":
      return jellyfinClient(c.baseUrl, c.auth, { maxBitrateKbps: conn.settings.maxBitrateKbps, syncProgress: conn.settings.syncProgressToServer });
    case "plex":
      return plexClient(c.baseUrl, c.auth.serverAccessToken ?? c.auth.authToken, { syncProgress: conn.settings.syncProgressToServer });
    case "torrserver":
      return torrServerClient(c.baseUrl, c.auth, { connectionId: c.id });
  }
}
