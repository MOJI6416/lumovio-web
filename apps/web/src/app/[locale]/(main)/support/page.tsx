import { getTranslations } from "next-intl/server";
import { KidsRestricted } from "@/components/profiles/KidsRestricted";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { SupportView } from "@/components/support/SupportView";
import { PageHeader } from "@/components/ui/PageHeader";
import { getMeState } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("support");
  return { title: t("title"), robots: { index: false } };
}

/**
 * Support: anyone can write — a guest with the e-mail for the answer, signed in with
 * «Мои обращения» under the form; not from a kids profile.
 */
export default async function SupportPage() {
  const me = await getMeState();
  const t = await getTranslations("support");
  const account = me && me !== "unavailable" ? me : null;
  return (
    <div className="page-x">
      <div className="mx-auto max-w-tool">
        {/* A kids profile isn't told the parent's address; it gets no form either. */}
        <PageHeader title={t("title")} description={account?.activeProfile?.isKids ? undefined : account ? t("introSignedIn", { email: account.user.email }) : t("intro")} />
        {me === "unavailable" ? (
          <ServiceUnavailable />
        ) : account?.activeProfile?.isKids ? (
          <KidsRestricted from="/support" />
        ) : (
          <SupportView email={account?.user.email ?? null} />
        )}
      </div>
    </div>
  );
}
