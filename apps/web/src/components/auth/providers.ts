import type { AuthCapabilities } from "@lumovio/contracts";

/** The social sign-in providers Lumovio supports, in the order of the buttons. A plain module: pages call it too. */
export const SOCIAL_PROVIDERS = ["google", "apple", "discord"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/** The providers this server has credentials for, from /api/auth-capabilities (null when it didn't answer). */
export function configuredProviders(caps: AuthCapabilities | null): SocialProvider[] | null {
  return caps ? SOCIAL_PROVIDERS.filter((p) => caps[p]) : null;
}
