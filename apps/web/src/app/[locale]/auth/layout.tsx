import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/shell/Wordmark";
import { Link } from "@/i18n/navigation";

/**
 * The sign-in pages (design-system 9, "Вход"): the page's own background in either theme, the logo where the header's
 * stands (a 64 bar on the page gutter, SH-15, the way home) and one 360 column under it — no card, no art, nothing else
 * to look at. The column starts at the same height on every screen, so an error under a form never moves it.
 * TV mode never gets here: every /auth address is the TV's sign-in by code there (lib/tv `tvShellPath`).
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("nav");
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* Below a home-screen app's status bar, as the site's header (7.19). */}
      <header className="page-x flex h-(--header-h) shrink-0 items-center pt-[env(safe-area-inset-top)]">
        <Link href="/" className="flex h-11 items-center rounded-xs text-text-1" aria-label={`Lumovio — ${t("home")}`}>
          <Wordmark />
        </Link>
      </header>
      <main id="main" className="page-x flex flex-1 flex-col items-center pt-6 pb-16 md:pt-24 lg:pt-28">
        <div className="w-full max-w-90">{children}</div>
      </main>
    </div>
  );
}
