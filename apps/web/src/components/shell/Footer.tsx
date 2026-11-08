import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// 44 px on a phone (5.6) — wide too, for a short word ("Умови" in Ukrainian was 40), 32 high on a desktop; on a TV
// (data-tv) every text is at least body (10.3).
const LINK =
  "inline-flex min-h-11 min-w-11 items-center text-body-s text-text-2 transition-colors duration-fast ease-fast hover:text-text-1 md:min-h-8 md:min-w-0 in-data-[tv=1]:text-body";

/**
 * `document`: a link that loads the whole page, never prefetched — the TV version (`/tv`) is another shell of the site
 * and switches this browser to it (proxy.ts), which a prefetch must not do on its own.
 */
function Links({ label, links }: { label: string; links: { href: string; label: string; document?: boolean }[] }) {
  const locale = useLocale();
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-x-5 md:gap-x-6">
        {links.map((l) => (
          <li key={l.href}>
            {l.document ? (
              <a href={`${locale === "en" ? "" : `/${locale}`}${l.href}`} className={LINK}>
                {l.label}
              </a>
            ) : (
              <Link href={l.href} className={LINK}>
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The footer (design-system 7.19): on the page gutter, the links nobody needs every day — the TV and help, the legal
 * pages (one line from md, at its two ends) — and the year with what the service is not (it holds no video). No logo,
 * no column headings and no catalog links: the header has those. Language and theme are in the header (the account's
 * settings, or "Language and theme" without an account); the TMDB attribution is on "Credits" (owner, 2026-10-25).
 * Not async: the 404 and the error page (a client component) render it too.
 */
export function Footer() {
  const t = useTranslations();
  return (
    <footer className="mt-16 border-t border-line md:mt-24">
      {/* From md one line: the TV and help at the start, the legal pages at the end (nothing hangs at one edge, 5.3). */}
      <div className="page-x mx-auto flex max-w-media flex-col gap-2 pt-6 pb-8 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-10 md:gap-y-1 md:pt-8 md:pb-10">
        <Links
          label={t("shell.support")}
          links={[
            { href: "/link", label: t("nav.linkDevice") },
            // The Android TV app's page: its APK and how a TV gets it (S58).
            { href: "/android-tv", label: t("nav.tvApp") },
            // The TV version for a TV whose browser isn't recognised (TV document §4.1).
            { href: "/tv", label: t("nav.tvVersion"), document: true },
            { href: "/support", label: t("support.write") },
          ]}
        />
        <Links
          label={t("common.legal")}
          links={[
            { href: "/legal/terms", label: t("legal.terms") },
            { href: "/legal/privacy", label: t("legal.privacy") },
            { href: "/legal/credits", label: t("legal.credits") },
            { href: "/legal/copyright", label: t("legal.copyright") },
          ]}
        />
        <p className="mt-3 text-caption text-text-3 md:mt-3 md:basis-full in-data-[tv=1]:text-body">
          © {new Date().getFullYear()} Lumovio · {t("shell.footerNote")}
        </p>
      </div>
    </footer>
  );
}
