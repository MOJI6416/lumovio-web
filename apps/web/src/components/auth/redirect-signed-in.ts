import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { safeNext } from "@/lib/safe-next";
import { getMeState } from "@/lib/server-api";

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * Someone already signed in who opens sign-in, sign-up or "forgot password" goes on into the product — to `next`, or
 * the home page (design-system 8.6, audit SH-04) — instead of signing in a second time. An API that doesn't answer
 * leaves the form: whether there is a session can't be told then.
 */
export async function redirectSignedIn(searchParams: Search) {
  const me = await getMeState();
  if (!me || me === "unavailable") return;
  const raw = (await searchParams).next;
  const next = safeNext(typeof raw === "string" ? raw : null);
  redirect({ href: me.activeProfile ? next : `/profiles?next=${encodeURIComponent(next)}`, locale: await getLocale() });
}
