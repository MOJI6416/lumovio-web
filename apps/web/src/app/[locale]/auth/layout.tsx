import type { CatalogRow } from "@lumovio/contracts";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LanguageField } from "@/components/shell/Preferences";
import { Wordmark } from "@/components/shell/Wordmark";
import { Link } from "@/i18n/navigation";
import { tmdbImage } from "@/lib/images";
import { optional } from "@/lib/optional";
import { serverApi } from "@/lib/server-api";

/**
 * Sign-in flows (the Focus template, design-system 9) on a dimmed, tilted wall of what's trending — the streaming
 * welcome — with the form on a 440 card. The logo stands where the header's does: a 64 bar on the page gutter (SH-15).
 * The wall is artwork, so the whole screen is on the stage (dark in either theme, 3.5); the interface language can be
 * changed here by a guest (SH-07).
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("nav");
  // Only decoration: without the catalog the plain backdrop stays.
  const home = await optional(serverApi<{ rows: CatalogRow[] }>("/api/catalog/home"), null);
  const posters = (home?.rows ?? [])
    .flatMap((r) => r.items)
    .map((x) => x.posterPath)
    .filter((p, i, a): p is string => Boolean(p) && a.indexOf(p) === i)
    .slice(0, 36);

  return (
    <div className="stage relative isolate flex min-h-dvh flex-col overflow-hidden bg-stage">
      {posters.length > 0 && (
        <div aria-hidden className="absolute inset-0 -z-20 overflow-hidden">
          <div className="absolute -inset-1/5 grid rotate-[-8deg] grid-cols-4 gap-3 opacity-60 sm:grid-cols-6 lg:grid-cols-9">
            {[...posters, ...posters].slice(0, 54).map((p, i) => (
              <img key={`${p}-${i}`} src={tmdbImage(p, "w185") ?? undefined} alt="" loading="lazy" decoding="async" className="aspect-[2/3] w-full rounded-sm object-cover" />
            ))}
          </div>
        </div>
      )}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--bg-stage)_55%,transparent),color-mix(in_oklab,var(--bg-stage)_92%,transparent))]"
      />
      {/* Below a home-screen app's status bar, as the site's header (7.19). */}
      <header className="page-x flex h-(--header-h) shrink-0 items-center pt-[env(safe-area-inset-top)]">
        <Link href="/" className="flex h-11 items-center rounded-xs text-text-1" aria-label={`Lumovio — ${t("home")}`}>
          <Wordmark />
        </Link>
      </header>
      <div className="page-x flex flex-1 flex-col items-center justify-center gap-6 pt-8 pb-12">
        <main id="main" className="w-full max-w-110 rounded-lg border border-line bg-bg/86 p-6 shadow-float backdrop-blur-xl md:p-10">
          {children}
        </main>
        {/* Not on a TV, where nobody types an address or a password (10.3). */}
        <LanguageField className="w-full max-w-60 in-data-[tv=1]:hidden" />
      </div>
    </div>
  );
}
