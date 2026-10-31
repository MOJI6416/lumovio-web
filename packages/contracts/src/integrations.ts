import { z } from "zod";

/** Tracking services a profile can link: history, ratings and watchlist sync, and scrobbling from the player. */
export const IntegrationProvider = z.enum(["trakt", "simkl"]);
export type IntegrationProvider = z.infer<typeof IntegrationProvider>;

export const IntegrationKind = z.enum(["history", "ratings", "watchlist"]);
export type IntegrationKind = z.infer<typeof IntegrationKind>;

/**
 * What flows where. Reading from the service starts on; writing to it stays off until the person
 * turns it on, and then covers Lumovio activity from that moment (older history only on request).
 */
export interface IntegrationSettings {
  import: Record<IntegrationKind, boolean>;
  /** When writing each kind to the service was turned on (ISO time); null while it's off. */
  export: Record<IntegrationKind, string | null>;
  scrobble: boolean;
}

export const IntegrationSettingsPatch = z.object({
  import: z.object({ history: z.boolean(), ratings: z.boolean(), watchlist: z.boolean() }).partial().optional(),
  export: z.object({ history: z.boolean(), ratings: z.boolean(), watchlist: z.boolean() }).partial().optional(),
  scrobble: z.boolean().optional(),
});
export type IntegrationSettingsPatch = z.infer<typeof IntegrationSettingsPatch>;

/** connecting = the first import is waiting for review; reauth = the service no longer accepts the sign-in. */
export type IntegrationStatus = "connecting" | "ok" | "error" | "reauth";

export interface IntegrationAccount {
  id: string;
  provider: IntegrationProvider;
  profileId: string;
  profileName: string;
  externalUser: string | null;
  status: IntegrationStatus;
  /** Technical detail of a failure, for diagnostics. */
  statusDetail: string | null;
  settings: IntegrationSettings;
  /** The first import (review it on the import page) while it's open. */
  initialJobId: string | null;
  /** Imports from later syncs that need a choice (uncertain matches). */
  reviewJobIds: string[];
  /** From the last sync: items Lumovio couldn't place (e.g. anime episodes without TV numbering) and items the service didn't find. */
  notes: { skipped: number; notFound: number };
  /** Simkl grants without media:write can't write to the service. */
  canWrite: boolean;
  lastSyncAt: string | null;
  connectedAt: string;
}

export interface IntegrationsOverview {
  /** Whether the server has the app registration for each service. */
  available: Record<IntegrationProvider, boolean>;
  accounts: IntegrationAccount[];
}

/** Lumovio items not yet on the service, sent only by an explicit "send my existing …" action. */
export type IntegrationBackfill = Record<IntegrationKind, number>;

export const IntegrationBackfillRequest = z.object({ kinds: z.array(IntegrationKind).min(1) });
