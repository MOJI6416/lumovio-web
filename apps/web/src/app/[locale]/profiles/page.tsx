import type { PinHintState } from "@lumovio/contracts";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ProfilePicker } from "@/components/profiles/ProfilePicker";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { Wordmark } from "@/components/shell/Wordmark";
import { Link, redirect } from "@/i18n/navigation";
import { safeNext } from "@/lib/safe-next";
import { getMeState, serverApi } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("profiles");
  return { title: t("whoIsWatching"), robots: { index: false } };
}

/**
 * "Not now" of the hint to set a PIN on adult profiles (8.10). null when it can't be read — signed out, a kids session
 * (403), the API down — and then the hint isn't shown.
 */
async function pinHintState(): Promise<PinHintState | null> {
  try {
    return await serverApi<PinHintState>("/api/profiles/pin-hint");
  } catch {
    return null;
  }
}

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Side by side: the hint's state doesn't wait for the session's.
  const [me, pinHint] = await Promise.all([getMeState(), pinHintState()]);
  if (!me) {
    // Signed out: sign-in comes back through this choice anyway, so it keeps only where that was to lead (AUTH-06).
    const { next } = await searchParams;
    const back = safeNext(typeof next === "string" ? next : null);
    redirect({ href: `/auth/sign-in${back === "/" ? "" : `?next=${encodeURIComponent(back)}`}`, locale: await getLocale() });
  }
  const t = await getTranslations("profiles");
  const tn = await getTranslations("nav");
  return (
    // "Who's watching?" is a system screen: on the stage, dark in either theme (3.5, 7.17).
    <div className="stage min-h-dvh bg-stage pb-10">
      {/* The logo where the header has it: a 64 bar on the page gutter (SH-15), below a home-screen app's status bar (7.19). */}
      <div className="page-x mx-auto flex h-(--header-h) max-w-media items-center pt-[env(safe-area-inset-top)]">
        <Link href="/" className="flex h-11 items-center rounded-xs text-text-1" aria-label={`Lumovio — ${tn("home")}`}>
          <Wordmark />
        </Link>
      </div>
      {/* The Picker template (design-system 9): the stage, the question, the grid of profiles in the middle. */}
      <main id="main" className="mx-auto mt-10 max-w-4xl px-4">
        {me === "unavailable" ? (
          <div className="text-center">
            <h1 className="mb-12 text-h1 text-text-1">{t("whoIsWatching")}</h1>
            <ServiceUnavailable />
          </div>
        ) : (
          <Suspense>
            <ProfilePicker me={me!} pinHint={pinHint} />
          </Suspense>
        )}
      </main>
    </div>
  );
}
