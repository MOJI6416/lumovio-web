import { getTranslations } from "next-intl/server";
import { ContinueOnPhone } from "@/components/tvui/shell/ContinueOnPhone";
import { TvBackButton } from "@/components/tvui/shell/TvBackButton";
import { tvPath } from "@/lib/tv-server";

export async function generateMetadata() {
  const t = await getTranslations("tvui");
  return { robots: { index: false }, title: t("phoneTitle") };
}

/**
 * Any address the TV shell has no screen for — settings pages, import, the calendar, statistics, legal texts, the admin
 * panel — is continued on a phone or a computer (TV document §1: "ПК/телефон — настройка, ТВ — выбор и просмотр").
 */
export default async function TvElsewherePage() {
  const t = await getTranslations("tvui");
  const path = await tvPath();
  return (
    <div data-tv-screen="detail" className="flex h-full flex-col justify-center gap-12 ps-(--tv-pad) pe-(--gutter)">
      <div data-zone="back" data-zone-axis="x">
        <TvBackButton />
      </div>
      <ContinueOnPhone path={path} title={t("phoneTitle")} />
    </div>
  );
}
