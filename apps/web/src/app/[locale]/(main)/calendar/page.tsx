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
  const tn = await getTranslations("nav");
  return (
    // The Tool template, centred; a schedule's column is narrower than the tool width (56rem), so a
    // line's time stays near its name — no half-empty rows on a wide screen. The h1 is in the same column.
    <div className="page-x">
      <div className="mx-auto max-w-4xl">
        {/* Its parent is the library, where it is opened from. No intro on the screen; a screen reader hears it. */}
        <PageHeader back={{ href: "/library", label: tn("library") }} title={t("title")} />
        <p className="sr-only">{t("intro")}</p>
        {me === "unavailable" ? <ServiceUnavailable /> : <CalendarView />}
      </div>
    </div>
  );
}
