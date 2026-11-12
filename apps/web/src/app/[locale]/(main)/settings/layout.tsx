import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SettingsFrame } from "@/components/settings/SettingsFrame";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { PageHeader } from "@/components/ui/PageHeader";
import { getMeState } from "@/lib/server-api";

/** "Аккаунт · Настройки · Lumovio": every settings page is named in the tab. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: { default: t("title"), template: `%s · ${t("title")} · Lumovio` } };
}

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const me = await getMeState();
  // No session: each page sends the visitor to sign in with its own address to come back to.
  if (!me) return children;
  const t = await getTranslations("settings");
  return (
    // The tool width, centred on the page, the h1 in it.
    <div className="page-x">
      {me === "unavailable" ? (
        <div className="mx-auto max-w-tool pb-10">
          <PageHeader title={t("title")} />
          <ServiceUnavailable />
        </div>
      ) : (
        <SettingsFrame kids={me.activeProfile?.isKids ?? false}>{children}</SettingsFrame>
      )}
    </div>
  );
}
