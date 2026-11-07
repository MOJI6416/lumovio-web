import { BarChart3, CalendarDays } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LibraryView } from "@/components/library/LibraryView";
import { librarySection } from "@/components/library/sections";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Link, redirect } from "@/i18n/navigation";
import { getMeState } from "@/lib/server-api";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The tab is named after the collection — "Буду смотреть · Lumovio" (SH-12); the screen itself is the library. */
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("library");
  const section = librarySection((await searchParams).tab);
  return { title: section ? t(section) : t("title") };
}

/**
 * The library (S09, design-system 9 "Library"): its screen — the h1, the calendar and the statistics as quiet buttons,
 * the shelves — or a collection's page with "← Library" over its h1 (8.7), as a list's page has "← Lists".
 */
export default async function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const me = await getMeState();
  if (!me) {
    // Back to the same collection after signing in (C05).
    const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
    redirect({ href: `/auth/sign-in?next=${encodeURIComponent(`/library${qs ? `?${qs}` : ""}`)}`, locale: await getLocale() });
  }
  const section = librarySection(sp.tab);
  const t = await getTranslations("nav");
  const tl = await getTranslations("library");
  return (
    // The Collection template (design-system 9) on the page gutter: the h1 under the header's logo (5.3, X-02).
    <div className="page-x mx-auto max-w-media">
      {section ? (
        <PageHeader back={{ href: "/library", label: tl("title") }} title={tl(section)} />
      ) : (
        <PageHeader
          title={tl("title")}
          // The calendar and the statistics are about the library too (INS-03): quiet, the shelves are the screen.
          actions={
            me !== "unavailable" && (
              <>
                <Link href="/calendar" className={buttonClass("secondary", "sm")}>
                  <CalendarDays aria-hidden />
                  {t("calendar")}
                </Link>
                <Link href="/stats" className={buttonClass("secondary", "sm")}>
                  <BarChart3 aria-hidden />
                  {t("stats")}
                </Link>
              </>
            )
          }
        />
      )}
      {me === "unavailable" ? (
        <ServiceUnavailable />
      ) : (
        <Suspense>
          <LibraryView section={section} />
        </Suspense>
      )}
    </div>
  );
}
