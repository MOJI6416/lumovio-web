import { getTranslations } from "next-intl/server";
import { AdultOnly } from "@/components/profiles/AdultOnly";
import { TrackingServices } from "@/components/settings/TrackingServices";

export async function generateMetadata() {
  const t = await getTranslations("services");
  return { title: t("title") };
}

export default function Page() {
  return (
    <AdultOnly from="/settings/services">
      <TrackingServices />
    </AdultOnly>
  );
}
