import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AnimeOnly } from "./AnimeOnly";
import { Wordmark } from "./Wordmark";

// 44 px high on a phone (5.6), 32 on a desktop.
const LINK =
  "inline-flex min-h-11 min-w-11 items-center text-body-s text-text-2 transition-colors duration-fast ease-fast hover:text-text-1 md:min-h-8 in-data-[tv=1]:text-body";

/**
 * `document`: a link that loads the whole page, never prefetched — the TV version (`/tv`) is another shell of the site
 * and switches this browser to it (proxy.ts), which a prefetch must not do on its own.
 */
function Column({ title, links }: { title: string; links: { href: string; label: string; document?: boolean; anime?: boolean }[] }) {
  const locale = useLocale();
  return (
    <nav aria-label={title}>
      <p className="mb-2 text-body-s font-semibold text-text-1 in-data-[tv=1]:text-body">{title}</p>
      <ul>
        {links.map((l) => {
          const item = (
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
          );
          // Anime only while the profile has it on (8.14).
          return l.anime ? <AnimeOnly key={l.href}>{item}</AnimeOnly> : item;
        })}
      </ul>
    </nav>
  );
}

// On a TV (data-tv) every text is at least body (20 px at 1080p, 10.3).

/**
 * The footer (design-system 7.19, audit SH-11): on the page gutter, so its logo stands under the header's (5.3); one
 * line about the product, links in three columns, the year. Language and theme are in the header (the account menu, or
 * "Language and theme" without an account) and the TMDB attribution is on "Credits" — not here (owner, 2026-10-25).
 * Not async: the 404 and the error page (a client component) render it too.
 */
export function Footer() {
  const t = useTranslations();
  return (
    <footer className="mt-16 border-t border-line md:mt-24">
      <div className="page-x mx-auto max-w-media pt-10 pb-8 md:pt-12">
        <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] md:gap-10">
          <div>
            <Link href="/" className="inline-flex h-11 items-center rounded-xs text-text-1" aria-label={`Lumovio — ${t("nav.home")}`}>
              <Wordmark />
            </Link>
            <p className="mt-2 max-w-measure text-body-s text-text-2 in-data-[tv=1]:text-body">{t("shell.footerAbout")}</p>
          </div>
          <Column
            title={t("shell.catalog")}
            links={[
              { href: "/browse/movie", label: t("nav.movies") },
              { href: "/browse/tv", label: t("nav.series") },
              { href: "/anime", label: t("nav.anime"), anime: true },
            ]}
          />
          <Column
            title={t("shell.support")}
            links={[
              { href: "/link", label: t("nav.linkDevice") },
              // The TV version for a TV whose browser isn't recognised (TV document §4.1).
              { href: "/tv", label: t("nav.tvVersion"), document: true },
              // The Android TV app's page: its APK and how a TV gets it (S58).
              { href: "/android-tv", label: t("nav.tvApp") },
              { href: "/legal/credits#lumovio-score", label: t("shell.scoreMethod") },
              { href: "/support", label: t("support.write") },
            ]}
          />
          <Column
            title={t("common.legal")}
            links={[
              { href: "/legal/terms", label: t("legal.terms") },
              { href: "/legal/privacy", label: t("legal.privacy") },
              { href: "/legal/credits", label: t("legal.credits") },
              { href: "/legal/copyright", label: t("legal.copyright") },
            ]}
          />
        </div>
        <p className="mt-10 border-t border-line pt-6 text-caption text-text-3 in-data-[tv=1]:text-body">© {new Date().getFullYear()} Lumovio</p>
      </div>
    </footer>
  );
}
