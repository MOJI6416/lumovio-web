import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { ProfilesScreen } from "@/components/tvui/screens/ProfilesScreen";
import { TvUnavailable } from "@/components/tvui/shell/TvUnavailable";
import { redirect } from "@/i18n/navigation";
import { safeNext } from "@/lib/safe-next";
import { getMeState } from "@/lib/server-api";
import { tvAppVersion } from "@/lib/tv";

export async function generateMetadata() {
  const t = await getTranslations("profiles");
  return { title: t("whoIsWatching"), robots: { index: false } };
}

/** "Who's watching?" on a TV: a guest gets the code screen first, keeping where it was going. */
export default async function TvProfilesPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next ?? null);
  const me = await getMeState();
  if (me === "unavailable") return <TvUnavailable />;
  if (!me) redirect({ href: `/tv${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`, locale: await getLocale() });
  return <ProfilesScreen me={me!} next={next} appVersion={tvAppVersion((await headers()).get("user-agent"))} />;
}
