import { getLocale, getTranslations } from "next-intl/server";
import { KidsRestricted } from "@/components/profiles/KidsRestricted";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { RemoteControl } from "@/components/tv/RemoteControl";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "@/i18n/navigation";
import { getMeState } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("remote");
  return { title: t("title"), robots: { index: false } };
}

/** The phone remote of the account's TVs (S56, TV document §7.3): an adult profile on a phone or a computer. */
export default async function RemotePage() {
  const me = await getMeState();
  if (!me) redirect({ href: `/auth/sign-in?next=${encodeURIComponent("/remote")}`, locale: await getLocale() });
  const t = await getTranslations("remote");
  const ts = await getTranslations("nav");
  return (
    <div className="page-x">
      <div className="mx-auto max-w-tool">
        <PageHeader title={t("title")} description={t("description")} back={{ href: "/settings/devices", label: ts("settings") }} />
        {me === "unavailable" ? <ServiceUnavailable /> : me?.activeProfile?.isKids ? <KidsRestricted from="/remote" /> : <RemoteControl />}
      </div>
    </div>
  );
}
