import { getLocale, getTranslations } from "next-intl/server";
import { ImportWizard } from "@/components/imports/ImportWizard";
import { AdultOnly } from "@/components/profiles/AdultOnly";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "@/i18n/navigation";
import { getMeState } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("import");
  return { title: t("title") };
}

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ job?: string | string[] }> }) {
  const me = await getMeState();
  if (!me) redirect({ href: "/auth/sign-in?next=/import", locale: await getLocale() });
  const t = await getTranslations("import");
  const ts = await getTranslations("services");
  const { job } = await searchParams;
  // An import has an address of its own (/import?job=…): its page brings "← Import history" and its own h1.
  const jobId = typeof job === "string" ? job : null;
  const jobView = jobId !== null && me !== "unavailable" && !me?.activeProfile?.isKids;
  return (
    // The Tool template: the tool width, centred on the page — no block left against the start
    // edge with the other half empty on a wide screen; the h1 is in the same column.
    <div className="page-x">
      <div className="mx-auto max-w-tool">
        {/* Its parent is Settings → Sync, where it is listed. No intro on the screen; a screen reader hears it. */}
        {!jobView && <PageHeader back={{ href: "/settings/services", label: ts("title") }} title={t("title")} />}
        {!jobView && <p className="sr-only">{t("intro")}</p>}
        {me === "unavailable" ? (
          <ServiceUnavailable />
        ) : (
          <AdultOnly from="/import">
            {/* A fresh wizard for each address: back on the list, no source stays picked. */}
            <ImportWizard key={jobView ? jobId : "list"} />
          </AdultOnly>
        )}
      </div>
    </div>
  );
}
