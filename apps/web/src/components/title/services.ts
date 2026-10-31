import type { WatchProvider } from "@lumovio/contracts";

/*
 * Streaming services as a person knows them (TTL-26): TMDB lists a service's plan with ads as a service of its own
 * ("Netflix Standard with Ads", "Amazon Prime Video with Ads"), so the same service showed up twice in "Where to watch"
 * and in the hero's line. Such a plan is folded into its service; a channel sold through another store ("HBO Max Amazon
 * Channel") is a different place to subscribe and stays on its own.
 */

const WITH_ADS = /\s+(?:standard\s+|basic\s+)?with\s+ads$/i;

/** The service a TMDB provider name stands for, and whether the name is its plan with ads. */
export function serviceOf(name: string): { name: string; withAds: boolean } {
  const base = name.replace(WITH_ADS, "").trim();
  return base && base !== name.trim() ? { name: base, withAds: true } : { name: name.trim(), withAds: false };
}

/** One service with every way it offers the title ("Subscription · Rent"), its plan with ads folded in. */
export interface ServiceOffer {
  /** The provider the row is named and drawn by: the service itself when TMDB lists it, else its plan. */
  provider: WatchProvider;
  name: string;
  kinds: WatchProvider["kind"][];
  /** TMDB lists a plan with ads of it besides (or instead of) the plain one. */
  withAds: boolean;
  /** Every TMDB provider id folded into the row, in TMDB's order (for a link to the service). */
  ids: number[];
}

/** The offers of a region by service, in the order of `kinds` and then TMDB's order. */
export function serviceOffers(providers: WatchProvider[], kinds: WatchProvider["kind"][]): ServiceOffer[] {
  const rows = new Map<string, ServiceOffer>();
  for (const kind of kinds)
    for (const p of providers.filter((x) => x.kind === kind)) {
      const s = serviceOf(p.name);
      const key = s.name.toLocaleLowerCase("en");
      const row = rows.get(key) ?? { provider: p, name: s.name, kinds: [], withAds: false, ids: [] };
      // The plain service names the row when TMDB lists both.
      if (!s.withAds && serviceOf(row.provider.name).withAds) row.provider = p;
      if (!row.kinds.includes(kind)) row.kinds.push(kind);
      if (!row.ids.includes(p.id)) row.ids.push(p.id);
      row.withAds ||= s.withAds;
      rows.set(key, row);
    }
  return [...rows.values()];
}
