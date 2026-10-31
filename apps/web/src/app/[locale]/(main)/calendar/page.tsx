import { getLocale, getTranslations } from "next-intl/server";
import { CalendarView } from "@/components/insights/CalendarView";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "@/i18n/navigation";
import { getMeState } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("calendar");
  return { title: t("title") };
}

export default async function CalendarPage() {
  const me = await getMeState();
  if (!me) redirect({ href: "/auth/sign-in?next=/calendar", locale: await getLocale() });
  const t = await getTranslations("calendar");
  return (
    // The Tool template (design-system 9): the tool width, centred on the page — no block left against the start
    // edge with the other half empty on a wide screen (owner, 2026-10-25); the h1 is in the same column.
    <div className="page-x">
      <div className="mx-auto max-w-tool">
        <PageHeader title={t("title")} description={t("intro")} />
        {me === "unavailable" ? <ServiceUnavailable /> : <CalendarView />}
      </div>
    </div>
  );
}
