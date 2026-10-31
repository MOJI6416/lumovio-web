import type { ConnectionSummary } from "@lumovio/contracts";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { SettingsScreen } from "@/components/tvui/screens/SettingsScreen";
import { TvUnavailable } from "@/components/tvui/shell/TvUnavailable";
import { optional } from "@/lib/optional";
import { serverApi } from "@/lib/server-api";
import { tvAppVersion } from "@/lib/tv";
import { requireTvProfile } from "@/lib/tv-server";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { robots: { index: false }, title: t("settings") };
}

/** Settings on a TV (S14 TV): the servers' status is read here, a kids profile has none (403 → not shown). */
export default async function TvSettingsPage() {
  const me = await requireTvProfile();
  if (me === "unavailable") return <TvUnavailable />;
  const servers = me.activeProfile?.isKids ? null : await optional(serverApi<{ connections: ConnectionSummary[] }>("/api/connections").then((r) => r.connections), null);
  return <SettingsScreen me={me} servers={servers} appVersion={tvAppVersion((await headers()).get("user-agent"))} />;
}
