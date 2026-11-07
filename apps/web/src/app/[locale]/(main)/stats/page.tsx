import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { StatsView } from "@/components/insights/StatsView";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "@/i18n/navigation";
import { getMeState } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("stats");
  return { title: t("title") };
}

export default async function StatsPage() {
  const me = await getMeState();
  if (!me) redirect({ href: "/auth/sign-in?next=/stats", locale: await getLocale() });
  const t = await getTranslations("stats");
  const tn = await getTranslations("nav");
  return (
    // The Tool template (design-system 9): the tool width, centred on the page — no block left against the start
    // edge with the other half empty on a wide screen (owner, 2026-10-25); the h1 is in the same column.
    <div className="page-x">
      <div className="mx-auto max-w-tool">
        {me === "unavailable" ? (
          <>
            <PageHeader back={{ href: "/library", label: tn("library") }} title={t("title")} />
            <ServiceUnavailable />
          </>
        ) : (
          <Suspense>
            <StatsView />
          </Suspense>
        )}
      </div>
    </div>
  );
}
