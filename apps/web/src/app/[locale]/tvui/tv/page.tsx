import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { PairScreen } from "@/components/tvui/screens/PairScreen";
import { redirect } from "@/i18n/navigation";
import { safeNext } from "@/lib/safe-next";
import { SITE_URL } from "@/lib/seo";
import { getMeState } from "@/lib/server-api";
import { isTvUserAgent, tvAppVersion } from "@/lib/tv";

export async function generateMetadata() {
  const t = await getTranslations("shell");
  return { robots: { index: false }, title: t("tvTitle") };
}

/**
 * The TV's way in: a guest gets the code; a TV already signed in goes on — to the profile
 * picker or to the address it was opened with — without a new code.
 */
export default async function TvPairPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next ?? null);
  const me = await getMeState();
  if (me && me !== "unavailable") {
    const q = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
    redirect({ href: me.activeProfile ? next : `/profiles${q}`, locale: await getLocale() });
  }
  // An Android TV's own browser, not the app: the app is offered by its short address.
  const ua = (await headers()).get("user-agent");
  const androidBrowser = isTvUserAgent(ua) && /Android/i.test(ua ?? "") && !tvAppVersion(ua);
  return <PairScreen next={next} appAddress={androidBrowser ? `${SITE_URL.replace(/^https?:\/\//, "")}/apk` : null} />;
}
