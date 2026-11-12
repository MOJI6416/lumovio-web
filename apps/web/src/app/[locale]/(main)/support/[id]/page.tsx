import { getLocale, getTranslations } from "next-intl/server";
import { KidsRestricted } from "@/components/profiles/KidsRestricted";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { SupportThread } from "@/components/support/SupportThread";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "@/i18n/navigation";
import { getMeState } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("support");
  return { title: t("title"), robots: { index: false } };
}

/** One of the person's requests: the messages and their answer; the support's answer mail links here. */
export default async function SupportRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMeState();
  if (!me) redirect({ href: `/auth/sign-in?next=${encodeURIComponent(`/support/${id}`)}`, locale: await getLocale() });
  const t = await getTranslations("support");
  return (
    <div className="page-x">
      <div className="mx-auto max-w-tool">
        <PageHeader title={t("mine")} back={{ href: "/support", label: t("title") }} />
        {me === "unavailable" ? (
          <ServiceUnavailable />
        ) : me?.activeProfile?.isKids ? (
          <KidsRestricted from={`/support/${id}`} />
        ) : (
          <SupportThread id={id} email={me!.user.email} />
        )}
      </div>
    </div>
  );
}
