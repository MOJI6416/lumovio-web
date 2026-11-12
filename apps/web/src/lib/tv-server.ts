import "server-only";
import type { Me } from "@lumovio/contracts";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { safeNext } from "./safe-next";
import { getMeState } from "./server-api";
import { TV_PATH_HEADER } from "./tv";

/** The address the TV shows (what the person opened, without the locale), from the proxy. */
export async function tvPath(): Promise<string> {
  return safeNext((await headers()).get(TV_PATH_HEADER) ?? "/");
}

/**
 * The TV shell's screens need a signed-in profile: a guest gets the code screen and a session without a profile
 * "Who's watching?", each keeping the address to come back to. `"unavailable"`: the API didn't answer.
 */
export async function requireTvProfile(): Promise<Me | "unavailable"> {
  const me = await getMeState();
  if (me === "unavailable") return me;
  const next = await tvPath();
  const q = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  if (!me) redirect({ href: `/tv${q}`, locale: await getLocale() });
  if (!me!.activeProfile) redirect({ href: `/profiles${q}`, locale: await getLocale() });
  return me!;
}
