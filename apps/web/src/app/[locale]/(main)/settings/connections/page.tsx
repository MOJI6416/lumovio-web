import { getTranslations } from "next-intl/server";
import { ConnectionsView } from "@/components/connections/ConnectionsView";
import { AdultOnly } from "@/components/profiles/AdultOnly";

export async function generateMetadata() {
  const t = await getTranslations("connections");
  return { title: t("title") };
}

export default function ConnectionsPage() {
  return (
    <AdultOnly from="/settings/connections">
      <ConnectionsView />
    </AdultOnly>
  );
}
