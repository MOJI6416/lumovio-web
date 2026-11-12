import type { ConnectionSummary } from "@lumovio/contracts";
import { getTranslations } from "next-intl/server";
import { TorrentManager } from "@/components/connections/TorrentManager";
import { AdultOnly } from "@/components/profiles/AdultOnly";
import { PageHeader } from "@/components/ui/PageHeader";
import { optional } from "@/lib/optional";
import { serverApi } from "@/lib/server-api";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata() {
  const t = await getTranslations("torrentManager");
  return { title: t("title") };
}

/** A page under "Servers" (the Tool template): "← Servers" over its h1, which names the server. */
export default async function TorrentsPage({ params }: { params: Params }) {
  const { id } = await params;
  const t = await getTranslations("torrentManager");
  const tc = await getTranslations("connections");
  // Only the server's name for the heading: without it (refused, not found, no answer) the page says the rest itself.
  const name = await optional(
    serverApi<{ connections: ConnectionSummary[] }>("/api/connections").then((d) => d.connections.find((c) => c.id === id)?.name ?? null),
    null,
  );
  return (
    <>
      <PageHeader
        back={{ href: "/settings/connections", label: tc("title") }}
        title={name ? `${t("title")} · ${name}` : t("title")}
        description={name ? t("intro", { server: name }) : undefined}
      />
      <AdultOnly from={`/settings/connections/${id}/torrents`}>
        <TorrentManager connectionId={id} />
      </AdultOnly>
    </>
  );
}
