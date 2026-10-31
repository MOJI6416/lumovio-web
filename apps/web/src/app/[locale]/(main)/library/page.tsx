import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LibraryView } from "@/components/library/LibraryView";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { Link } from "@/components/ui/Link";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "@/i18n/navigation";
import { getMeState } from "@/lib/server-api";

const TABS = ["watchlist", "favorites", "history", "ratings", "lists"] as const;

/** The tab is named after the open tab — "Буду смотреть · Lumovio" (SH-12); "Overview" is the library itself. */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("library");
  const { tab } = await searchParams;
  const open = TABS.find((x) => x === tab);
  return { title: open ? t(open) : t("title") };
}

export default async function LibraryPage() {
  const me = await getMeState();
  if (!me) redirect({ href: "/auth/sign-in?next=/library", locale: await getLocale() });
  const t = await getTranslations("nav");
  const tl = await getTranslations("library");
  return (
    // The Collection template (design-system 9) on the page gutter: the h1 under the header's logo (5.3, X-02).
    <div className="page-x mx-auto max-w-media">
      <PageHeader
        title={tl("title")}
        // The calendar and the statistics are about the library too: reachable from it, not only from the account menu (INS-03).
        actions={
          me !== "unavailable" && (
            <>
              <Link variant="action" arrow href="/calendar">
                {t("calendar")}
              </Link>
              <Link variant="action" arrow href="/stats">
                {t("stats")}
              </Link>
            </>
          )
        }
      />
      {me === "unavailable" ? (
        <ServiceUnavailable />
      ) : (
        <Suspense>
          <LibraryView />
        </Suspense>
      )}
    </div>
  );
}
