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

/**
 * The phone remote of the account's TVs: an adult profile on a phone or a
 * computer. Reached from the header while a TV is open (RemoteEntry), from "Watch on TV" and from Settings → Devices;
 * the title alone, as Apple TV's Remote — the surface says what it does.
 */
export default async function RemotePage() {
  const me = await getMeState();
  if (!me) redirect({ href: `/auth/sign-in?next=${encodeURIComponent("/remote")}`, locale: await getLocale() });
  const t = await getTranslations("remote");
  return (
    <div className="page-x">
      {/* One centred column: the title over the remote, as the remote's own width. */}
      <div className="mx-auto max-w-sm">
        <PageHeader title={t("title")} />
        {me === "unavailable" ? <ServiceUnavailable /> : me?.activeProfile?.isKids ? <KidsRestricted from="/remote" /> : <RemoteControl />}
      </div>
    </div>
  );
}
