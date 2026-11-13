import type { PinHintState, SetupOffer, SetupState } from "@lumovio/contracts";
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
 * "Not now" of the hint to set a PIN on adult profiles. null when it can't be read — signed out, a kids session
 * (403), the API down — and then the hint isn't shown.
 */
async function pinHintState(): Promise<PinHintState | null> {
  try {
    return await serverApi<PinHintState>("/api/profiles/pin-hint");
  } catch {
    return null;
  }
}

/** Whether a new account goes on to the first run's screen after choosing (null when it can't be read). */
async function setupOffer(): Promise<SetupOffer> {
  try {
    return (await serverApi<SetupState>("/api/setup")).offer;
  } catch {
    return null;
  }
}

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Side by side: the hint's state doesn't wait for the session's.
  const [me, pinHint, setup] = await Promise.all([getMeState(), pinHintState(), setupOffer()]);
  if (!me) {
    // Signed out: sign-in comes back through this choice anyway, so it keeps only where that was to lead.
    const { next } = await searchParams;
    const back = safeNext(typeof next === "string" ? next : null);
    redirect({ href: `/auth/sign-in${back === "/" ? "" : `?next=${encodeURIComponent(back)}`}`, locale: await getLocale() });
  }
  const t = await getTranslations("profiles");
  const tn = await getTranslations("nav");
  return (
    // The Picker template: the page's own background in its theme, as sign-in before it — no art to
    // hold, so no stage — the logo where the header has it, the question and the faces in the middle.
    <div className="min-h-dvh bg-bg pb-16">
      {/* The logo where the header has it: a 64 bar on the page gutter, below a home-screen app's status bar. */}
      <div className="page-x mx-auto flex h-(--header-h) max-w-media items-center pt-[env(safe-area-inset-top)]">
        <Link href="/" className="flex h-11 items-center rounded-xs text-text-1" aria-label={`Lumovio — ${tn("home")}`}>
          <Wordmark />
        </Link>
      </div>
      <main id="main" className="mx-auto mt-6 max-w-5xl px-4 sm:mt-12">
        {me === "unavailable" ? (
          <div className="text-center">
            <h1 className="mb-12 text-h1 text-text-1">{t("whoIsWatching")}</h1>
            <ServiceUnavailable />
          </div>
        ) : (
          <Suspense>
            <ProfilePicker me={me!} pinHint={pinHint} setup={setup} />
          </Suspense>
        )}
      </main>
    </div>
  );
}
