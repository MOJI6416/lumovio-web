import type { ConnectionSummary } from "@lumovio/contracts";
import { getTranslations } from "next-intl/server";
import { ConnectionsView } from "@/components/connections/ConnectionsView";
import { AdultOnly } from "@/components/profiles/AdultOnly";
import { serverApi } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("connections");
  return { title: t("title") };
}

export default async function ConnectionsPage() {
  // Rendered with the list, so the rows are in place from the first paint; a kids profile (403) or an outage leaves it
  // to the page itself, which says so.
  const initial = await serverApi<{ connections: ConnectionSummary[] }>("/api/connections").catch(() => undefined); // ui-lint-ignore swallowed-error: the page reads the list itself and shows its error
  return (
    <AdultOnly from="/settings/connections">
      <ConnectionsView initial={initial} />
    </AdultOnly>
  );
}
