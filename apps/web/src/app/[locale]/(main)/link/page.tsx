import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { KidsRestricted } from "@/components/profiles/KidsRestricted";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { LinkDevice } from "@/components/tv/LinkDevice";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "@/i18n/navigation";
import { getMeState } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("tv");
  return { title: t("linkTitle"), robots: { index: false } };
}

export default async function LinkPage({ searchParams }: { searchParams: Promise<{ user_code?: string; approve?: string }> }) {
  const { user_code, approve } = await searchParams;
  const me = await getMeState();
  if (!me) {
    const q = user_code ? `?user_code=${encodeURIComponent(user_code)}` : approve ? `?approve=${encodeURIComponent(approve)}` : "";
    const next = `/link${q}`;
    redirect({ href: `/auth/sign-in?next=${encodeURIComponent(next)}`, locale: await getLocale() });
  }
  const t = await getTranslations("tv");
  // Approving a TV would sign a new device into the account: an adult's call.
  const blocked = me === "unavailable" ? <ServiceUnavailable /> : me?.activeProfile?.isKids ? <KidsRestricted from="/link" /> : null;
  if (blocked) {
    return (
      <div className="page-x">
        <div className="mx-auto max-w-tool">
          <PageHeader title={t("linkTitle")} />
          {blocked}
        </div>
      </div>
    );
  }
  // The Focus template: LinkDevice is the 440 card over the stage.
  return (
    <Suspense>
      <LinkDevice initialCode={user_code ?? ""} approve={approve} />
    </Suspense>
  );
}
