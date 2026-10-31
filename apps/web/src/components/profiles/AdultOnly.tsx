import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { redirect } from "@/i18n/navigation";
import { getMeState } from "@/lib/server-api";
import { KidsRestricted } from "./KidsRestricted";

/**
 * A page that needs an account sends a signed-out visitor to sign in with the way back to `from` — the very page,
 * not the section's start (AUTH-06). An API that doesn't answer is not "signed out" (SH-03): the page says so itself.
 */
export async function signInFirst(from: string) {
  const me = await getMeState();
  if (!me) redirect({ href: `/auth/sign-in?next=${encodeURIComponent(from)}`, locale: await getLocale() });
  return me;
}

/**
 * Content of an adult-only page (account, security, devices, servers, Trakt/Simkl, import, privacy):
 * a kids profile opening it by address gets the restricted state instead. The API refuses these
 * actions for a kids session as well (`kids_restricted`).
 */
export async function AdultOnly({ from, children }: { from: string; children: ReactNode }) {
  const me = await signInFirst(from);
  return me !== "unavailable" && me?.activeProfile?.isKids ? <KidsRestricted from={from} /> : children;
}
