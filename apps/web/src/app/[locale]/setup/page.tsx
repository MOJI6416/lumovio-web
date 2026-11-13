import type { SetupState } from "@lumovio/contracts";
import { getLocale, getTranslations } from "next-intl/server";
import { type SetupOpen, SetupScreen } from "@/components/setup/SetupScreen";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { Wordmark } from "@/components/shell/Wordmark";
import { Link, redirect } from "@/i18n/navigation";
import { safeNext } from "@/lib/safe-next";
import { getMeState, serverApi } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("setup");
  return { title: t("title"), robots: { index: false } };
}

const OPENS = new Set<SetupOpen>(["audio", "subtitles", "server"]);

/**
 * The first run's screen ("Let's set up Lumovio"), in the Picker template it follows: the page's own background, the
 * logo where the header has it, one column in the middle. Signed out — sign-in and back here; a kids profile or no
 * profile chosen — not for it (home, or "Who's watching?" first). `?open=` opens a row's dialog at once (the home
 * shelf's tiles), `?next=` is where "Done" and "Later" go.
 */
export default async function SetupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const locale = await getLocale();
  const query = await searchParams;
  const next = safeNext(typeof query.next === "string" ? query.next : null, "/");
  const me = await getMeState();
  if (!me) redirect({ href: "/auth/sign-in?next=/setup", locale });
  if (me && me !== "unavailable" && !me.activeProfile) redirect({ href: "/profiles?next=/setup", locale });
  if (me && me !== "unavailable" && me.activeProfile?.isKids) redirect({ href: "/", locale });
  const state = me === "unavailable" ? null : await serverApi<SetupState>("/api/setup").catch(() => null); // ui-lint-ignore swallowed-error: no answer is the page's "Lumovio is unavailable" below
  const tn = await getTranslations("nav");
  const open = typeof query.open === "string" && OPENS.has(query.open as SetupOpen) ? (query.open as SetupOpen) : null;
  return (
    <div className="min-h-dvh bg-bg pb-16">
      <div className="page-x mx-auto flex h-(--header-h) max-w-media items-center pt-[env(safe-area-inset-top)]">
        <Link href="/" className="flex h-11 items-center rounded-xs text-text-1" aria-label={`Lumovio — ${tn("home")}`}>
          <Wordmark />
        </Link>
      </div>
      <main id="main" className="mx-auto mt-6 w-full max-w-140 px-4 sm:mt-12">
        {state ? (
          <SetupScreen initial={state} next={next} open={open} />
        ) : (
          <div className="pt-12">
            <ServiceUnavailable />
          </div>
        )}
      </main>
    </div>
  );
}
